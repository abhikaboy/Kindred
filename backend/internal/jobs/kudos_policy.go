package jobs

import (
	"fmt"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// The decision half of the kudos suggester, kept free of Mongo and clocks so it
// can be exercised exhaustively. KudosSuggesterJob gathers the state; every
// judgement about whether a prompt may be sent is made here.

// TriggerType names a kind of moment Kindred detects.
//
// The split between the two groups is a consent boundary, not a taxonomy.
// Achievement triggers surface something the user already made visible — they
// closed their rings, they hit a streak, they finished something. Struggle
// triggers disclose something the user never chose to share, to a third party,
// and are gated on that user's explicit opt-in.
type TriggerType string

const (
	// Achievement triggers — always allowed.
	TriggerRingsClosed       TriggerType = "rings_closed"
	TriggerStreakMilestone   TriggerType = "streak_milestone"
	TriggerNotableCompletion TriggerType = "notable_completion"

	// Struggle triggers — require the subject's ShareStruggles consent.
	TriggerTaskStalled  TriggerType = "task_stalled"
	TriggerStreakAtRisk TriggerType = "streak_at_risk"
)

// achievementTriggers is an allowlist, and that direction is the whole point.
// IsStruggle answers "no" only for a trigger explicitly listed here, so a new
// trigger added without thinking about consent is treated as a disclosure and
// gated. Getting this backwards — a denylist of struggle triggers — would mean
// the failure mode of forgetting is leaking someone's bad week to their
// friends.
var achievementTriggers = map[TriggerType]bool{
	TriggerRingsClosed:       true,
	TriggerStreakMilestone:   true,
	TriggerNotableCompletion: true,
}

// IsStruggle reports whether this trigger discloses a difficulty rather than an
// achievement. Unknown triggers are struggles.
func (t TriggerType) IsStruggle() bool { return !achievementTriggers[t] }

// KudosMoment is one piece of fast-moving state Kindred noticed about a user.
// The nightly worker cannot see any of these; that is the entire reason this
// job exists.
type KudosMoment struct {
	// RecipientID is the person the kudos would be FOR — the one the moment
	// happened to. Not the person who gets the push.
	RecipientID primitive.ObjectID
	Trigger     TriggerType
	// Subject identifies the specific thing that happened (a task id, a template
	// id plus streak length, a date). It makes the dedupe key specific enough
	// that two different stalled tasks are two different moments.
	Subject string
	// Detail is a short phrase about the moment, safe to show the sender.
	Detail     string
	OccurredAt time.Time
}

// KudosPolicy holds every tunable in one place so the numbers can be read
// without reading the code.
type KudosPolicy struct {
	// HardDailyCap is the ceiling on kudos prompts per sender per day,
	// regardless of how chatty their notification settings allow us to be.
	HardDailyCap int
	// ReducedDailyCap applies when nudge-receptivity says to back off.
	ReducedDailyCap int
	// TriggerCooldown is how long the same (sender, recipient, trigger) triple
	// stays off limits after a prompt, whatever the subject.
	TriggerCooldown time.Duration
	// CongratulationFreshness is how long after an achievement it still reads as
	// congratulation rather than as a reminder of last week.
	CongratulationFreshness time.Duration

	// DayStartHour and DayEndHour bound the hours a person may be buzzed in
	// their own local time. Kindred has no quiet-hours setting yet, so these are
	// the quiet hours: everything outside [DayStartHour, DayEndHour) is quiet.
	DayStartHour int
	DayEndHour   int
	// PrePeakLeadHours is how far ahead of the recipient's peak window an
	// encouragement should land, so it arrives while they are working.
	PrePeakLeadHours int

	// MinAffinity is the floor on the kudos-affinity composite. Below it the
	// worker is telling us this friend's voice does not carry.
	MinAffinity float64
	// ReducedMinAffinity is the higher floor used for senders who should be
	// nudged less: fewer prompts, and only the ones most likely to land.
	ReducedMinAffinity float64
	// MaxSendersPerMoment caps the fan-out. One moment must not light up a
	// person's entire circle.
	MaxSendersPerMoment int

	// Detection tuning.
	StalledAfter         time.Duration
	MinStreakAtRisk      int
	AtRiskLocalHour      int
	MaxMomentsPerTrigger int64
	LedgerRetention      time.Duration
}

// DefaultKudosPolicy is deliberately conservative. A kudos prompt is an
// interruption asking someone to do unpaid emotional labour; the failure mode
// of being too quiet is that a feature underperforms, and the failure mode of
// being too loud is that people turn notifications off entirely.
func DefaultKudosPolicy() KudosPolicy {
	return KudosPolicy{
		HardDailyCap:            2,
		ReducedDailyCap:         1,
		TriggerCooldown:         72 * time.Hour,
		CongratulationFreshness: 6 * time.Hour,
		DayStartHour:            8,
		DayEndHour:              21,
		PrePeakLeadHours:        2,
		MinAffinity:             0.4,
		ReducedMinAffinity:      0.65,
		MaxSendersPerMoment:     2,
		StalledAfter:            72 * time.Hour,
		MinStreakAtRisk:         3,
		AtRiskLocalHour:         19,
		MaxMomentsPerTrigger:    200,
		LedgerRetention:         30 * 24 * time.Hour,
	}
}

// KudosRecipient is the person a moment happened to — the one the kudos would
// be about. Their consent governs disclosure; their rhythm governs timing.
type KudosRecipient struct {
	ID          primitive.ObjectID
	DisplayName string
	Settings    types.UserSettings
	Location    *time.Location
	// PeakStartHour is the local hour their peak window opens, from the
	// `peak-hours` fact. Nil when we do not know, which must not block anything.
	PeakStartHour *int
	// EncouragementWorthwhile is the `encouragement-effect` verdict. True unless
	// we have real evidence encouragement does nothing for this person.
	EncouragementWorthwhile bool
}

// KudosSender is the person we would prompt. Their settings govern whether we
// may buzz them at all.
type KudosSender struct {
	ID        primitive.ObjectID
	PushToken string
	Settings  types.UserSettings
	Location  *time.Location
	// Affinity is this sender's rank in the recipient's kudos-affinity list.
	Affinity float64
	// ShouldReduceFrequency comes from the sender's own `nudge-receptivity`.
	ShouldReduceFrequency bool
	// PromptsSentToday counts kudos prompts already dispatched to this sender in
	// their own local day.
	PromptsSentToday int
	// LastPromptForTrigger is when this sender was last prompted about this
	// recipient for this trigger, whatever the subject. Nil for never.
	LastPromptForTrigger *time.Time
}

// SkipReason records why a candidate prompt was not sent. Logged and counted,
// so a feature that goes quiet can be explained rather than guessed at.
type SkipReason string

const (
	SkipNone SkipReason = ""
	// SkipNoStruggleConsent is the one that matters most. It means we detected a
	// real difficulty and deliberately said nothing.
	SkipNoStruggleConsent SkipReason = "no_struggle_consent"
	SkipSelfPrompt        SkipReason = "self_prompt"
	SkipNoPushToken       SkipReason = "no_push_token"
	SkipNudgesOff         SkipReason = "nudges_off"
	SkipFriendActivityOff SkipReason = "friend_activity_off"
	SkipQuietHours        SkipReason = "quiet_hours"
	SkipLowAffinity       SkipReason = "low_affinity"
	SkipEncouragementDead SkipReason = "encouragement_ineffective"
	SkipStale             SkipReason = "moment_stale"
	SkipWrongTimeOfDay    SkipReason = "outside_delivery_window"
	SkipCooldown          SkipReason = "cooldown"
	SkipDailyCap          SkipReason = "daily_cap"
)

// KudosVerdict is the outcome of evaluating one (moment, sender) pair.
type KudosVerdict struct {
	Send bool
	Skip SkipReason
}

func allow() KudosVerdict            { return KudosVerdict{Send: true, Skip: SkipNone} }
func deny(r SkipReason) KudosVerdict { return KudosVerdict{Send: false, Skip: r} }

// EvaluateKudosPrompt decides whether to prompt one sender about one moment.
//
// The order of the checks is load-bearing in exactly one place: the struggle
// consent gate runs first, before anything that could return early for a
// friendlier reason. Every other check is ordered cheapest-and-most-decisive
// first, purely so the logs name the most useful reason.
func EvaluateKudosPrompt(m KudosMoment, r KudosRecipient, s KudosSender, p KudosPolicy, now time.Time) KudosVerdict {
	// 1. Consent to disclose. Nothing below this line can reach a friend without
	//    passing it, and an unrecognised trigger counts as a struggle.
	if m.Trigger.IsStruggle() && !r.Settings.MayShareStruggles(now) {
		return deny(SkipNoStruggleConsent)
	}

	// 2. Never ask someone to congratulate themselves.
	if s.ID == r.ID {
		return deny(SkipSelfPrompt)
	}

	// 3. Nowhere to deliver it.
	if s.PushToken == "" {
		return deny(SkipNoPushToken)
	}

	// 4. The sender's own notification preferences. CheckinFrequency is the
	//    existing dial for how much proactive nudging this person wants, and
	//    "none" means none. FriendActivity is the toggle a kudos prompt sits
	//    under — it is a notification about what a friend just did.
	notif := s.Settings.Notifications
	if notif.CheckinFrequency == "none" {
		return deny(SkipNudgesOff)
	}
	if !notif.FriendActivity {
		return deny(SkipFriendActivityOff)
	}

	// 5. Quiet hours, in the sender's clock — they are the one whose phone
	//    lights up.
	if isQuietHour(localHour(now, s.Location), p) {
		return deny(SkipQuietHours)
	}

	// 6. Does this person's encouragement carry weight for this recipient? The
	//    worker owns this judgement; we only read the rank.
	floor := p.MinAffinity
	if s.ShouldReduceFrequency {
		floor = p.ReducedMinAffinity
	}
	if s.Affinity < floor {
		return deny(SkipLowAffinity)
	}

	// 7. Is encouragement worth sending to this recipient at all? Only applied
	//    to the encouragement direction: "well done" is not a nudge, and a
	//    measured absence of completion lift is no reason to withhold it.
	if m.Trigger.IsStruggle() && !r.EncouragementWorthwhile {
		return deny(SkipEncouragementDead)
	}

	// 8. Timing. Congratulation goes out right after the thing happened;
	//    encouragement is aimed at a window in the recipient's day. Same fact,
	//    opposite direction — which is why they are checked differently.
	if !m.Trigger.IsStruggle() {
		if age := now.Sub(m.OccurredAt); age > p.CongratulationFreshness {
			return deny(SkipStale)
		}
	} else {
		start, end := DeliveryWindow(m.Trigger, r.PeakStartHour, p)
		if !withinHours(localHour(now, r.Location), start, end) {
			return deny(SkipWrongTimeOfDay)
		}
	}

	// 9. Cooldown on the (sender, recipient, trigger) triple.
	if s.LastPromptForTrigger != nil && now.Sub(*s.LastPromptForTrigger) < p.TriggerCooldown {
		return deny(SkipCooldown)
	}

	// 10. Daily cap.
	if s.PromptsSentToday >= DailyPromptCap(notif.CheckinFrequency, s.ShouldReduceFrequency, p) {
		return deny(SkipDailyCap)
	}

	return allow()
}

// DailyPromptCap converts the sender's check-in frequency into a number of
// kudos prompts per day, then clamps it.
//
// The vocabulary is the one checkin.go already uses, including its habit of
// treating an unrecognised value as "regularly" — a user with a corrupt setting
// should get the middle of the road, not silence and not a firehose.
func DailyPromptCap(frequency string, reduce bool, p KudosPolicy) int {
	var limit int
	switch frequency {
	case "none":
		return 0
	case "occasionally":
		limit = 1
	case "regularly":
		limit = 2
	case "frequently":
		limit = 3
	default:
		limit = 2
	}

	ceiling := p.HardDailyCap
	if reduce {
		ceiling = p.ReducedDailyCap
	}
	if limit > ceiling {
		limit = ceiling
	}
	if limit < 0 {
		limit = 0
	}
	return limit
}

// DeliveryWindow returns the [start, end) window, in the RECIPIENT's local
// hours, during which an encouragement about this trigger should land.
//
// A streak about to break is the exception to the pre-peak rule and has to be.
// The general rule aims encouragement at the run-up to someone's working window
// because that is when it changes what they do. A streak breaking tonight is
// not general: it expires at midnight, so it is delivered late enough that the
// day is genuinely at risk and early enough that there is still time to act.
// Sending that one at 7am to match a peak window would be punctual and useless.
func DeliveryWindow(trigger TriggerType, peakStart *int, p KudosPolicy) (int, int) {
	if trigger == TriggerStreakAtRisk {
		start := p.AtRiskLocalHour
		if start < p.DayStartHour {
			start = p.DayStartHour
		}
		if start >= p.DayEndHour {
			return p.DayStartHour, p.DayEndHour
		}
		return start, p.DayEndHour
	}
	return EncouragementWindow(peakStart, p)
}

// EncouragementWindow returns the [start, end) local-hour window in which an
// encouragement should reach a recipient whose peak begins at *peakStart.
//
// The rule from the data is "before their peak window, so it lands while they
// are working". Two things complicate it:
//
//   - We may not know their peak. Then the whole civil day is the window; a
//     missing fact must never mean a missing feature.
//   - Their peak may begin before anyone should be buzzed — an early-morning
//     worker peaking at 6am would give a 4am window. Rather than send at 4am or
//     never send, the window clamps to the first hours of the civil day. That is
//     late by the letter of the rule and right by its intent, which is "while
//     they are still working", not "at a precise offset".
func EncouragementWindow(peakStart *int, p KudosPolicy) (int, int) {
	if peakStart == nil {
		return p.DayStartHour, p.DayEndHour
	}

	start := *peakStart - p.PrePeakLeadHours
	end := *peakStart

	if start < p.DayStartHour {
		start = p.DayStartHour
		if end < start+p.PrePeakLeadHours {
			end = start + p.PrePeakLeadHours
		}
	}
	if end > p.DayEndHour {
		end = p.DayEndHour
	}
	if start >= end {
		// A peak that starts at or after the end of the civil day leaves nothing
		// sensible to clamp to. Fall back to the whole day rather than to an
		// empty window that would silently disable the trigger.
		return p.DayStartHour, p.DayEndHour
	}
	return start, end
}

// DedupeKey identifies one prompt exactly. Its uniqueness in the ledger is what
// makes the job safe to run over and over: the second attempt to claim the same
// key loses, and no second push goes out.
func DedupeKey(senderID, recipientID primitive.ObjectID, trigger TriggerType, subject string) string {
	return fmt.Sprintf("%s:%s:%s:%s", senderID.Hex(), recipientID.Hex(), trigger, subject)
}

// LocalDay renders the day a moment belongs to in someone's own timezone. The
// daily cap counts against this rather than against UTC, so "two a day" means
// two in the sender's day and not two per rolling 24 hours straddling midnight.
func LocalDay(t time.Time, loc *time.Location) string {
	if loc == nil {
		loc = time.UTC
	}
	return t.In(loc).Format("2006-01-02")
}

func localHour(t time.Time, loc *time.Location) int {
	if loc == nil {
		loc = time.UTC
	}
	return t.In(loc).Hour()
}

func isQuietHour(hour int, p KudosPolicy) bool {
	return hour < p.DayStartHour || hour >= p.DayEndHour
}

// withinHours reports hour ∈ [start, end). Windows never wrap midnight —
// EncouragementWindow clamps them into the civil day first.
func withinHours(hour, start, end int) bool {
	return hour >= start && hour < end
}
