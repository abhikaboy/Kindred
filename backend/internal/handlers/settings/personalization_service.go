package settings

import (
	"context"
	"fmt"
	"sort"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// UserMemoryCollection is the collection the productivity-agent worker owns.
// The collection is the entire interface between the two processes; see
// docs/user-memory-contract.md in that repo.
const UserMemoryCollection = "user_memory"

// personalizationField is the bson name of UserSettings.Personalization.
const personalizationField = "personalization"

// The `user_memory` keys Kindred owns. The worker never overwrites or prunes a
// row whose `source` is "stated", which is what makes "your correction always
// wins over what we observe" true.
const (
	StatedKeyPlanningStyle  = "planning-style"
	StatedKeyTone           = "tone"
	StatedKeyNudgeFrequency = "nudge-frequency"
	StatedKeyPeakHours      = "peak-hours"
)

// Where an answer came from. Recorded in evidence.surface so a first answer can
// be told apart from a later correction.
const (
	SurfaceOnboarding = "onboarding"
	SurfaceSettings   = "settings"
)

// statedSource is the one `source` value Kindred is allowed to write.
const statedSource = "stated"

// statedFactSpec describes one answer Kindred owns in `user_memory`.
type statedFactSpec struct {
	// Kind has to match the derived fact carrying the same key, because the
	// worker's precedence check matches on key alone — `peak-hours` stays
	// "rhythm" so a stated answer and an inferred one are interchangeable.
	Kind string
	// Options maps the answer the user picked to what gets stored for it.
	Options map[string]statedFactOption
}

type statedFactOption struct {
	// Content is interpolated straight into a Gemini prompt: a full sentence
	// with an actionable second half. It is never shown to the user.
	Content string
	// Evidence is merged over the defaults every stated fact gets. `peak-hours`
	// mirrors the derived evidence shape (windowStartHour / windowEndHour) so
	// the settings screen renders a stated answer and an inferred one with the
	// same code, without ever touching `content`.
	Evidence bson.M
}

var statedFactSpecs = map[string]statedFactSpec{
	StatedKeyPlanningStyle: {
		Kind: "pacing",
		Options: map[string]statedFactOption{
			"detailed":    {Content: "Plans in detail before starting and wants work broken into concrete steps. Prefer several small explicit tasks over one broad one, and add a checklist where the work has real sub-steps."},
			"flexible":    {Content: "Keeps a loose plan and adjusts as the day goes. Suggest a short ordered set of tasks and leave room to reshuffle rather than committing the whole day up front."},
			"spontaneous": {Content: "Decides what to work on in the moment rather than planning ahead. Keep suggestions short and immediate, and avoid multi-day plans or long checklists."},
		},
	},
	StatedKeyTone: {
		Kind: "style",
		Options: map[string]statedFactOption{
			"encouraging": {Content: "Prefers warm, encouraging phrasing. Lead with what is going well and frame suggestions as support rather than correction."},
			"direct":      {Content: "Prefers plain, direct phrasing. Skip preamble and encouragement and state the suggestion in as few words as it takes."},
			"playful":     {Content: "Prefers light, playful phrasing. A little humor is welcome, but never at the cost of being clear about what to do next."},
		},
	},
	StatedKeyNudgeFrequency: {
		Kind: "social",
		Options: map[string]statedFactOption{
			"none":         {Content: "Does not want to be nudged. Do not generate proactive reminders or check-ins; respond only when asked."},
			"occasionally": {Content: "Wants nudging sparingly. Reserve proactive messages for things that genuinely matter, such as a deadline that is about to pass."},
			"regularly":    {Content: "Is comfortable with regular nudging. A daily check-in and reminders on approaching deadlines are welcome."},
			"frequently":   {Content: "Wants frequent nudging. Check in more than once a day and surface upcoming work proactively."},
		},
	},
	StatedKeyPeakHours: {
		Kind: "rhythm",
		Options: map[string]statedFactOption{
			"morning": {
				Content:  "Says they focus best in the morning, roughly 6am to noon local time. Favor that window for scheduling suggestions and reminders.",
				Evidence: bson.M{"windowStartHour": 6, "windowEndHour": 12},
			},
			"afternoon": {
				Content:  "Says they focus best in the afternoon, roughly noon to 5pm local time. Favor that window for scheduling suggestions and reminders.",
				Evidence: bson.M{"windowStartHour": 12, "windowEndHour": 17},
			},
			"evening": {
				Content:  "Says they focus best in the evening, roughly 5pm to 9pm local time. Favor that window for scheduling suggestions and reminders.",
				Evidence: bson.M{"windowStartHour": 17, "windowEndHour": 21},
			},
			"night": {
				Content:  "Says they focus best late at night, roughly 9pm to midnight local time. Favor that window for scheduling suggestions and reminders.",
				Evidence: bson.M{"windowStartHour": 21, "windowEndHour": 24},
			},
		},
	},
}

// statedAnswer is one (key, value) pair on its way to `user_memory`.
type statedAnswer struct {
	Key   string
	Value string
}

// ValidateStatedAnswer reports whether a key/value pair is one Kindred knows
// how to store.
func ValidateStatedAnswer(key, value string) error {
	spec, ok := statedFactSpecs[key]
	if !ok {
		return fmt.Errorf("unknown personalization key %q", key)
	}
	if _, ok := spec.Options[value]; !ok {
		return fmt.Errorf("invalid value %q for %q, expected one of %v", value, key, statedOptionNames(spec))
	}
	return nil
}

func statedOptionNames(spec statedFactSpec) []string {
	names := make([]string, 0, len(spec.Options))
	for name := range spec.Options {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// UpdatePersonalization applies a partial change to the user's consent state
// and returns the result. An omitted field is left alone; turning
// personalization back on also ends any pause, since otherwise "on" would keep
// being skipped by the worker until the stale pause expired.
func (s *Service) UpdatePersonalization(userID primitive.ObjectID, req UpdatePersonalizationRequest) (*types.PersonalizationSettings, error) {
	ctx := context.Background()

	set := bson.M{}
	unset := bson.M{}
	if req.Enabled != nil {
		set["settings.personalization.enabled"] = *req.Enabled
		if *req.Enabled && req.PausedUntil == nil {
			unset["settings.personalization.pausedUntil"] = ""
		}
	}
	if req.PausedUntil != nil {
		set["settings.personalization.pausedUntil"] = *req.PausedUntil
	}
	// Written only when the client says something about it. An omitted field
	// leaves the stored value alone, and a never-answered account keeps having
	// no value at all — which types.UserSettings.MayShareStruggles reads as no.
	// Note the asymmetry with Enabled above: turning personalization back on
	// clears a pause, but never turns disclosure on as a side effect. Consent to
	// be learned about is not consent to be talked about.
	if req.ShareStruggles != nil {
		set["settings.personalization.shareStruggles"] = *req.ShareStruggles
	}

	var doc struct {
		Settings types.UserSettings `bson:"settings"`
	}
	projection := bson.M{"settings": 1}

	// Nothing to change: report the current state rather than writing anything.
	// This matters more than it looks — a no-op that wrote defaults would be a
	// migration in disguise for every user who has never answered.
	if len(set) == 0 && len(unset) == 0 {
		err := s.Users.FindOne(ctx, bson.M{"_id": userID}, options.FindOne().SetProjection(projection)).Decode(&doc)
		if err != nil {
			return nil, fmt.Errorf("failed to get user: %w", err)
		}
		current := doc.Settings.PersonalizationOrDefault()
		return &current, nil
	}

	update := bson.M{}
	if len(set) > 0 {
		update["$set"] = set
	}
	if len(unset) > 0 {
		update["$unset"] = unset
	}

	err := s.Users.FindOneAndUpdate(ctx, bson.M{"_id": userID}, update,
		options.FindOneAndUpdate().SetReturnDocument(options.After).SetProjection(projection),
	).Decode(&doc)
	if err != nil {
		return nil, fmt.Errorf("failed to update personalization settings: %w", err)
	}

	current := doc.Settings.PersonalizationOrDefault()
	return &current, nil
}

// ExportPersonalizationData returns everything held about the user, for
// "download everything Kindred has learned".
//
// `content` and `embedding` are projected away. `content` is prompt text
// written as an instruction to a model, not a statement fit for the person it
// describes; `evidence` carries the same information in a structured form the
// UI can render. See rule 5 of docs/user-memory-contract.md.
func (s *Service) ExportPersonalizationData(userID primitive.ObjectID) ([]PersonalizationFact, *types.PersonalizationSettings, error) {
	ctx := context.Background()

	var doc struct {
		Settings types.UserSettings `bson:"settings"`
	}
	err := s.Users.FindOne(ctx, bson.M{"_id": userID}, options.FindOne().SetProjection(bson.M{"settings": 1})).Decode(&doc)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get user: %w", err)
	}
	consent := doc.Settings.PersonalizationOrDefault()

	cursor, err := s.UserMemory.Find(ctx, bson.M{"userId": userID},
		options.Find().
			SetProjection(bson.M{"content": 0, "embedding": 0}).
			SetSort(bson.D{{Key: "key", Value: 1}}),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read personalization data: %w", err)
	}
	defer cursor.Close(ctx)

	facts := make([]PersonalizationFact, 0)
	if err := cursor.All(ctx, &facts); err != nil {
		return nil, nil, fmt.Errorf("failed to decode personalization data: %w", err)
	}

	return facts, &consent, nil
}

// DeletePersonalizationData erases everything the worker holds for this user
// and turns personalization off.
//
// The order is deliberate. Disabling first means a failure halfway through
// leaves the user opted out with their data intact, which they can undo.
// Deleting first and failing to disable leaves the nightly run free to rebuild
// exactly what they just erased.
func (s *Service) DeletePersonalizationData(userID primitive.ObjectID) (int64, error) {
	ctx := context.Background()

	// shareStruggles is cleared alongside enabled. "Delete everything you hold
	// about me" has to include the standing permission to tell friends when I am
	// stuck, otherwise re-enabling personalization months later silently
	// resurrects a consent the user believed they had erased.
	res, err := s.Users.UpdateOne(ctx,
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{
			"settings.personalization.enabled":        false,
			"settings.personalization.shareStruggles": false,
		}},
	)
	if err != nil {
		return 0, fmt.Errorf("failed to disable personalization: %w", err)
	}
	if res.MatchedCount == 0 {
		return 0, fmt.Errorf("failed to disable personalization: %w", mongo.ErrNoDocuments)
	}

	deleted, err := s.UserMemory.DeleteMany(ctx, bson.M{"userId": userID})
	if err != nil {
		return 0, fmt.Errorf("failed to delete personalization data: %w", err)
	}

	return deleted.DeletedCount, nil
}

// SaveStatedPreferences writes the onboarding answers as `source: "stated"`
// rows. Answers left blank are skipped rather than defaulted.
func (s *Service) SaveStatedPreferences(userID primitive.ObjectID, req StatedPreferencesRequest, surface string) ([]string, error) {
	// Fixed order so the written keys read the same way every time.
	candidates := []statedAnswer{
		{Key: StatedKeyPlanningStyle, Value: req.PlanningStyle},
		{Key: StatedKeyTone, Value: req.Tone},
		{Key: StatedKeyNudgeFrequency, Value: req.NudgeFrequency},
		{Key: StatedKeyPeakHours, Value: req.PeakHours},
	}

	answers := make([]statedAnswer, 0, len(candidates))
	for _, answer := range candidates {
		if answer.Value == "" {
			continue
		}
		if err := ValidateStatedAnswer(answer.Key, answer.Value); err != nil {
			return nil, err
		}
		answers = append(answers, answer)
	}

	if err := s.writeStatedFacts(userID, answers, surface); err != nil {
		return nil, err
	}

	keys := make([]string, 0, len(answers))
	for _, answer := range answers {
		keys = append(keys, answer.Key)
	}
	return keys, nil
}

// UpdateStatedFact rewrites a single stated answer, for the settings screen's
// "tap any row to correct it".
func (s *Service) UpdateStatedFact(userID primitive.ObjectID, key, value, surface string) error {
	if err := ValidateStatedAnswer(key, value); err != nil {
		return err
	}
	return s.writeStatedFacts(userID, []statedAnswer{{Key: key, Value: value}}, surface)
}

// writeStatedFacts upserts stated answers into `user_memory`.
//
// Three details are load-bearing:
//   - `userId` is a real ObjectId. The worker matches on ObjectId; a hex string
//     would be invisible to it and to the Go read path.
//   - `source` is "stated", which is what buys the never-overwritten and
//     never-pruned guarantees on the worker's side.
//   - `expiresAt` is removed rather than set. The collection has a TTL index on
//     that field, so a stated answer inheriting the 45-day expiry of a derived
//     fact it replaced would quietly evaporate — a prune the worker's
//     `source != "stated"` filter cannot protect against.
func (s *Service) writeStatedFacts(userID primitive.ObjectID, answers []statedAnswer, surface string) error {
	if len(answers) == 0 {
		return nil
	}

	ctx := context.Background()
	now := xutils.NowUTC()

	models := make([]mongo.WriteModel, 0, len(answers))
	for _, answer := range answers {
		spec := statedFactSpecs[answer.Key]
		option := spec.Options[answer.Value]

		evidence := bson.M{
			"sampleSize": 0,
			"windowDays": 0,
			"statedAt":   now,
			"surface":    surface,
			// The raw answer, so the settings screen can render and re-edit the
			// row without reading `content`.
			"value": answer.Value,
		}
		for field, value := range option.Evidence {
			evidence[field] = value
		}

		models = append(models, mongo.NewUpdateOneModel().
			SetFilter(bson.M{"userId": userID, "key": answer.Key}).
			SetUpdate(bson.M{
				"$set": bson.M{
					"kind":       spec.Kind,
					"content":    option.Content,
					"confidence": 1.0,
					"evidence":   evidence,
					"source":     statedSource,
					"updatedAt":  now,
				},
				"$setOnInsert": bson.M{"createdAt": now},
				"$unset":       bson.M{"expiresAt": ""},
			}).
			SetUpsert(true))
	}

	if _, err := s.UserMemory.BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false)); err != nil {
		return fmt.Errorf("failed to write stated preferences: %w", err)
	}

	return nil
}
