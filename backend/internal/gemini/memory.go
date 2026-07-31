package gemini

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// The read side of `user_memory`, the collection Kindred shares with the
// productivity-agent worker. The collection is the entire interface between the
// two processes; the contract lives in that repo at
// docs/user-memory-contract.md.
//
// This file sits in `gemini` because that is where the contract puts it and
// because the flows in flows.go are the highest-volume consumer — a prompt
// builder wanting a user's profile should not have to reach across packages for
// it. Nothing here talks to Genkit, so importing this package for the reader
// alone (as internal/jobs does) costs a link edge and no runtime behaviour:
// package gemini has no init(), and genkit.Init runs only from InitGenkit.

// UserMemoryCollection is the collection name the worker writes to.
const UserMemoryCollection = "user_memory"

// MinFactConfidence mirrors the worker's floor. Nothing below it is ever
// written, so filtering on it costs nothing and documents the invariant at the
// read site — where a future relaxation on the writing side would otherwise
// arrive silently.
const MinFactConfidence = 0.35

// Fact keys this codebase reads by name. The full list lives in the contract;
// these are the ones Go branches on rather than passes through as prose.
const (
	FactKeyPeakHours           = "peak-hours"
	FactKeyKudosAffinity       = "kudos-affinity"
	FactKeyKudosCircle         = "kudos-circle"
	FactKeyEncouragementEffect = "encouragement-effect"
	FactKeyNudgeReceptivity    = "nudge-receptivity"
)

// UserFact is one row of a user's personalization profile.
//
// Evidence is kept raw rather than decoded into map[string]any: most callers
// only ever interpolate Content, and the handful that need structure (see
// DecodeKudosAffinity) want a typed shape, not an any-tree they have to
// type-assert their way through.
type UserFact struct {
	UserID     primitive.ObjectID `bson:"userId"`
	Key        string             `bson:"key"`
	Kind       string             `bson:"kind"`
	Content    string             `bson:"content"`
	Confidence float64            `bson:"confidence"`
	Evidence   bson.Raw           `bson:"evidence"`
	Source     string             `bson:"source"`
	UpdatedAt  time.Time          `bson:"updatedAt"`
}

// LoadUserFacts returns this user's personalization profile, strongest first.
// Returns nil (not an error) when the user has no profile yet — every caller
// must work fine without one.
func LoadUserFacts(ctx context.Context, coll *mongo.Collection, userID primitive.ObjectID, limit int64) ([]UserFact, error) {
	if coll == nil {
		return nil, nil
	}

	cur, err := coll.Find(ctx,
		bson.M{"userId": userID, "confidence": bson.M{"$gte": MinFactConfidence}},
		options.Find().SetSort(bson.D{{Key: "confidence", Value: -1}}).SetLimit(limit),
	)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	var facts []UserFact
	if err := cur.All(ctx, &facts); err != nil {
		return nil, err
	}
	return facts, nil
}

// LoadUserFact reads a single fact by key, for callers that want one specific
// thing rather than a profile to interpolate. Returns (nil, nil) when the user
// does not have that fact — absence is meaningful and is never an error.
func LoadUserFact(ctx context.Context, coll *mongo.Collection, userID primitive.ObjectID, key string) (*UserFact, error) {
	if coll == nil {
		return nil, nil
	}

	var fact UserFact
	err := coll.FindOne(ctx, bson.M{
		"userId":     userID,
		"key":        key,
		"confidence": bson.M{"$gte": MinFactConfidence},
	}).Decode(&fact)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &fact, nil
}

// FindUserFact picks one fact out of an already-loaded profile. Saves a second
// round trip for callers that need both the prose and one structured evidence
// blob.
func FindUserFact(facts []UserFact, key string) (UserFact, bool) {
	for _, f := range facts {
		if f.Key == key {
			return f, true
		}
	}
	return UserFact{}, false
}

// FormatUserFacts renders facts for prompt interpolation. Empty string when
// there is no profile, so the prompt degrades to today's behavior exactly.
func FormatUserFacts(facts []UserFact) string {
	if len(facts) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("\nWhat we know about this user (observed from their own behavior):\n")
	for _, f := range facts {
		b.WriteString("- ")
		b.WriteString(f.Content)
		b.WriteByte('\n')
	}
	b.WriteString("Use this to make suggestions fit how they actually work. Never recite it back to them, and never imply they are being monitored.\n")
	return b.String()
}

// ============================================================================
// kudos-affinity
// ============================================================================

// KudosAffinity is the decoded `evidence` of the `kudos-affinity` fact — the
// one row in `user_memory` that describes a relationship rather than a person.
// The subject is whoever kudos would be sent TO; Friends ranks the people whose
// encouragement moves them.
//
// This one gets a typed accessor rather than being passed through as prose
// because it is the only fact Go makes a decision from rather than a sentence:
// "who should we prompt" is a ranked list lookup, not something to hand to a
// model.
type KudosAffinity struct {
	SampleSize int
	WindowDays int
	// Friends is ranked, strongest first, exactly as the worker wrote it.
	// Entries whose friendId could not be read are dropped rather than returned
	// zeroed — a nil ObjectID would silently address the wrong record.
	Friends []KudosFriend
}

// KudosFriend is one entry of `evidence.friends`.
type KudosFriend struct {
	FriendID primitive.ObjectID
	Handle   string
	// Received is how many kudos this friend sent the subject in the window.
	Received int
	// ReactedRate is whether the subject engages with this friend specifically.
	ReactedRate float64
	// CompletionLift is OBSERVATIONAL. Friends preferentially encourage tasks
	// that already mattered, so this is a ranking signal and nothing else.
	// Never show the multiple to a user and never describe it as causal.
	CompletionLift float64
	// Affinity is the 0..1 composite the worker ranks on.
	Affinity float64
	LastAt   time.Time
}

// rawKudosAffinity mirrors the on-disk evidence shape.
type rawKudosAffinity struct {
	SampleSize int              `bson:"sampleSize"`
	WindowDays int              `bson:"windowDays"`
	Friends    []rawKudosFriend `bson:"friends"`
}

type rawKudosFriend struct {
	// The contract writes the subject's `userId` as a real ObjectId but shows
	// `friendId` as a string, and the two codebases disagree about ObjectIds
	// often enough that guessing is not worth it. Both are accepted.
	FriendID       flexObjectID `bson:"friendId"`
	Handle         string       `bson:"handle"`
	Received       int          `bson:"received"`
	ReactedRate    float64      `bson:"reactedRate"`
	CompletionLift float64      `bson:"completionLift"`
	Affinity       float64      `bson:"affinity"`
	LastAt         flexTime     `bson:"lastAt"`
}

// DecodeKudosAffinity decodes the `evidence` of a kudos-affinity fact.
//
// Returns (nil, nil) for a fact with no evidence or no friends, which is the
// common case for a user nobody has encouraged yet. Callers treat that the same
// way they treat a missing fact: no prompt, no error.
func DecodeKudosAffinity(fact *UserFact) (*KudosAffinity, error) {
	if fact == nil || len(fact.Evidence) == 0 {
		return nil, nil
	}

	var raw rawKudosAffinity
	if err := bson.Unmarshal(fact.Evidence, &raw); err != nil {
		return nil, err
	}

	affinity := &KudosAffinity{
		SampleSize: raw.SampleSize,
		WindowDays: raw.WindowDays,
		Friends:    make([]KudosFriend, 0, len(raw.Friends)),
	}
	for _, f := range raw.Friends {
		id := primitive.ObjectID(f.FriendID)
		if id.IsZero() {
			continue
		}
		affinity.Friends = append(affinity.Friends, KudosFriend{
			FriendID:       id,
			Handle:         f.Handle,
			Received:       f.Received,
			ReactedRate:    f.ReactedRate,
			CompletionLift: f.CompletionLift,
			Affinity:       f.Affinity,
			LastAt:         time.Time(f.LastAt),
		})
	}

	if len(affinity.Friends) == 0 {
		return nil, nil
	}
	return affinity, nil
}

// LoadKudosAffinity reads and decodes kudos-affinity for one user in a single
// round trip. (nil, nil) when the user has no such fact.
func LoadKudosAffinity(ctx context.Context, coll *mongo.Collection, userID primitive.ObjectID) (*KudosAffinity, error) {
	fact, err := LoadUserFact(ctx, coll, userID, FactKeyKudosAffinity)
	if err != nil {
		return nil, err
	}
	return DecodeKudosAffinity(fact)
}

// TopFriends returns at most n entries of the ranked list. The worker already
// sorted it; this does not re-sort, so a change to the ranking key lands here
// automatically.
func (a *KudosAffinity) TopFriends(n int) []KudosFriend {
	if a == nil || n <= 0 {
		return nil
	}
	if n > len(a.Friends) {
		n = len(a.Friends)
	}
	return a.Friends[:n]
}

// ============================================================================
// Other evidence a product surface reads directly
// ============================================================================
//
// These three are decoded here rather than at their call sites so that the
// bson field names of `evidence` live in exactly one file. A consumer asks for
// "the hour their peak starts", not for `evidence.windowStartHour`, and a
// contract change lands here instead of in five packages.

// PeakHours is the decoded `evidence` of `peak-hours`: the local-hour window
// where completions concentrate. Hours are 0..24 in the user's own timezone.
type PeakHours struct {
	StartHour int
	EndHour   int
	// ShareInWindow is the fraction of completions inside the window, when the
	// worker recorded it. Zero for stated answers, which carry no histogram.
	ShareInWindow float64
}

// DecodePeakHours returns nil when the fact is missing or carries no usable
// window. Callers must behave sensibly without one — a new user has no rhythm
// yet and that has to be invisible.
func DecodePeakHours(fact *UserFact) *PeakHours {
	if fact == nil || len(fact.Evidence) == 0 {
		return nil
	}
	var raw struct {
		StartHour     *int    `bson:"windowStartHour"`
		EndHour       *int    `bson:"windowEndHour"`
		ShareInWindow float64 `bson:"shareInWindow"`
	}
	if err := bson.Unmarshal(fact.Evidence, &raw); err != nil {
		return nil
	}
	if raw.StartHour == nil || *raw.StartHour < 0 || *raw.StartHour > 23 {
		return nil
	}
	end := 0
	if raw.EndHour != nil {
		end = *raw.EndHour
	}
	return &PeakHours{StartHour: *raw.StartHour, EndHour: end, ShareInWindow: raw.ShareInWindow}
}

// NudgeReceptivity is the decoded `evidence` of `nudge-receptivity` — whether
// proactive suggestions get acted on, dismissed, or ignored.
//
// ShouldReduceFrequency is the boolean to act on; the contract is explicit that
// the rates behind it are directional rather than exact (the dismissal
// denominator only counts dismissible card types, and the interaction counters
// are lifetime while dismissals are windowed). Read the verdict, not the rates.
type NudgeReceptivity struct {
	ShouldReduceFrequency bool
	Verdict               string // dismissive | receptive | passive
}

// DecodeNudgeReceptivity returns nil when the fact is missing. Nil means "we
// have no reason to back off", which is the correct default: a user we know
// nothing about has not ignored anything.
func DecodeNudgeReceptivity(fact *UserFact) *NudgeReceptivity {
	if fact == nil || len(fact.Evidence) == 0 {
		return nil
	}
	var raw struct {
		ShouldReduceFrequency bool   `bson:"shouldReduceFrequency"`
		Verdict               string `bson:"verdict"`
	}
	if err := bson.Unmarshal(fact.Evidence, &raw); err != nil {
		return nil
	}
	return &NudgeReceptivity{ShouldReduceFrequency: raw.ShouldReduceFrequency, Verdict: raw.Verdict}
}

// EncouragementEffect is the decoded `evidence` of `encouragement-effect`:
// completion lift on encouraged tasks.
//
// OBSERVATIONAL, and the contract says so twice. Friends preferentially
// encourage tasks that already mattered, so a high lift is not proof that
// encouragement caused anything. It is usable in one direction only — as
// evidence that encouragement is NOT landing for this person, which is a reason
// to stop sending it. Never present the magnitude to a user.
type EncouragementEffect struct {
	Lift       float64
	SampleSize int
	Verdict    string
}

// DecodeEncouragementEffect returns nil when the fact is missing.
func DecodeEncouragementEffect(fact *UserFact) *EncouragementEffect {
	if fact == nil || len(fact.Evidence) == 0 {
		return nil
	}
	// `lift` is the documented name; `completionLift` is what the pairwise
	// friend entries call the same quantity. Accept either rather than depend on
	// which one the worker settled on.
	var raw struct {
		Lift           *float64 `bson:"lift"`
		CompletionLift *float64 `bson:"completionLift"`
		SampleSize     int      `bson:"sampleSize"`
		Verdict        string   `bson:"verdict"`
	}
	if err := bson.Unmarshal(fact.Evidence, &raw); err != nil {
		return nil
	}
	effect := &EncouragementEffect{SampleSize: raw.SampleSize, Verdict: raw.Verdict}
	switch {
	case raw.Lift != nil:
		effect.Lift = *raw.Lift
	case raw.CompletionLift != nil:
		effect.Lift = *raw.CompletionLift
	}
	return effect
}

// MinEffectSample is how much evidence it takes before a measured absence of
// effect is allowed to silence encouragement for someone. Below it, a couple of
// unlucky weeks would mute a person's friends entirely.
const MinEffectSample = 10

// Worthwhile reports whether encouragement is worth sending to this person.
//
// The default is yes, in every uncertain case: a nil effect, a thin sample, an
// unrecognised verdict. Only a confident measured "this does nothing" turns it
// off, because the cost of a wrong no (a person whose friends go quiet) is
// worse than the cost of a wrong yes (one extra prompt).
func (e *EncouragementEffect) Worthwhile() bool {
	if e == nil {
		return true
	}
	if e.SampleSize < MinEffectSample {
		return true
	}
	if e.Verdict == "none" || e.Verdict == "ineffective" {
		return false
	}
	// A lift at or below parity means encouraged tasks finish no more often than
	// anything else. Only trusted alongside a real sample, checked above.
	return !(e.Lift > 0 && e.Lift <= 1.0)
}

// ============================================================================
// Lenient scalar decoding
// ============================================================================

// flexObjectID accepts an ObjectId or its hex string. An unreadable value
// decodes to the zero ObjectID rather than failing the whole document: one
// malformed entry must not cost us the entire ranked list.
type flexObjectID primitive.ObjectID

func (f *flexObjectID) UnmarshalBSONValue(t bsontype.Type, data []byte) error {
	rv := bson.RawValue{Type: t, Value: data}
	switch t {
	case bson.TypeObjectID:
		if oid, ok := rv.ObjectIDOK(); ok {
			*f = flexObjectID(oid)
		}
	case bson.TypeString:
		if s, ok := rv.StringValueOK(); ok {
			if oid, err := primitive.ObjectIDFromHex(s); err == nil {
				*f = flexObjectID(oid)
			}
		}
	}
	return nil
}

// flexTime accepts a BSON date or an RFC3339 string, for the same reason.
type flexTime time.Time

func (f *flexTime) UnmarshalBSONValue(t bsontype.Type, data []byte) error {
	rv := bson.RawValue{Type: t, Value: data}
	switch t {
	case bson.TypeDateTime:
		if tm, ok := rv.TimeOK(); ok {
			*f = flexTime(tm.UTC())
		}
	case bson.TypeString:
		if s, ok := rv.StringValueOK(); ok {
			if tm, err := time.Parse(time.RFC3339, s); err == nil {
				*f = flexTime(tm.UTC())
			}
		}
	}
	return nil
}
