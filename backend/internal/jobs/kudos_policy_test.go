package jobs

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// A fixed clock. 12:00 UTC sits inside the default civil day (08:00–21:00), so
// no case accidentally passes or fails on quiet hours it did not mean to test.
var testNow = time.Date(2026, 7, 30, 12, 0, 0, 0, time.UTC)

var (
	recipientID = primitive.NewObjectID()
	senderID    = primitive.NewObjectID()
)

func hourPtr(h int) *int        { return &h }
func at(t time.Time) *time.Time { return &t }
func consent(share bool) types.UserSettings {
	return types.UserSettings{
		Notifications:   types.NotificationSettings{CheckinFrequency: "regularly", FriendActivity: true},
		Personalization: &types.PersonalizationSettings{Enabled: true, ShareStruggles: share},
	}
}

// baseRecipient is a person everything is allowed for: opted in, encouragement
// works, and a peak window that opens two hours after testNow so the
// pre-peak delivery window contains it.
func baseRecipient() KudosRecipient {
	return KudosRecipient{
		ID:                      recipientID,
		DisplayName:             "Jordan",
		Settings:                consent(true),
		Location:                time.UTC,
		PeakStartHour:           hourPtr(14),
		EncouragementWorthwhile: true,
	}
}

// baseSender is a person we are allowed to prompt.
func baseSender() KudosSender {
	return KudosSender{
		ID:        senderID,
		PushToken: "ExponentPushToken[test]",
		Settings: types.UserSettings{
			Notifications: types.NotificationSettings{CheckinFrequency: "regularly", FriendActivity: true},
		},
		Location:         time.UTC,
		Affinity:         0.81,
		PromptsSentToday: 0,
	}
}

func achievement() KudosMoment {
	return KudosMoment{
		RecipientID: recipientID,
		Trigger:     TriggerRingsClosed,
		Subject:     "2026-07-30",
		OccurredAt:  testNow.Add(-30 * time.Minute),
	}
}

func struggle(trigger TriggerType) KudosMoment {
	return KudosMoment{
		RecipientID: recipientID,
		Trigger:     trigger,
		Subject:     "task-1",
		OccurredAt:  testNow,
	}
}

// ============================================================================
// The consent gate
// ============================================================================

// TestTriggerIsStruggle_FailsClosed pins the allowlist. A trigger nobody
// classified must be treated as a disclosure, so that forgetting to think about
// consent produces silence rather than a leak.
func TestTriggerIsStruggle_FailsClosed(t *testing.T) {
	tests := []struct {
		trigger TriggerType
		want    bool
	}{
		{TriggerRingsClosed, false},
		{TriggerStreakMilestone, false},
		{TriggerNotableCompletion, false},
		{TriggerTaskStalled, true},
		{TriggerStreakAtRisk, true},
		{TriggerType("something_added_later"), true},
		{TriggerType(""), true},
	}

	for _, tt := range tests {
		t.Run(string(tt.trigger), func(t *testing.T) {
			if got := tt.trigger.IsStruggle(); got != tt.want {
				t.Errorf("IsStruggle(%q) = %v, want %v", tt.trigger, got, tt.want)
			}
		})
	}
}

// TestEvaluateKudosPrompt_StruggleConsent is the most important test in this
// package. Every row where the recipient has not explicitly opted in must come
// back SkipNoStruggleConsent — and the sender is configured perfectly in all of
// them, so nothing else can be doing the blocking.
func TestEvaluateKudosPrompt_StruggleConsent(t *testing.T) {
	paused := types.UserSettings{
		Notifications: types.NotificationSettings{CheckinFrequency: "regularly", FriendActivity: true},
		Personalization: &types.PersonalizationSettings{
			Enabled: true, ShareStruggles: true, PausedUntil: at(testNow.Add(24 * time.Hour)),
		},
	}
	disabled := types.UserSettings{
		Notifications:   types.NotificationSettings{CheckinFrequency: "regularly", FriendActivity: true},
		Personalization: &types.PersonalizationSettings{Enabled: false, ShareStruggles: true},
	}

	tests := []struct {
		name              string
		trigger           TriggerType
		recipientSettings types.UserSettings
		wantSend          bool
		wantSkip          SkipReason
	}{
		{
			name:              "stalled task, consent absent entirely",
			trigger:           TriggerTaskStalled,
			recipientSettings: types.UserSettings{Notifications: types.NotificationSettings{CheckinFrequency: "regularly", FriendActivity: true}},
			wantSend:          false,
			wantSkip:          SkipNoStruggleConsent,
		},
		{
			name:              "stalled task, shareStruggles explicitly false",
			trigger:           TriggerTaskStalled,
			recipientSettings: consent(false),
			wantSend:          false,
			wantSkip:          SkipNoStruggleConsent,
		},
		{
			name:              "streak at risk, consent absent entirely",
			trigger:           TriggerStreakAtRisk,
			recipientSettings: types.UserSettings{},
			wantSend:          false,
			wantSkip:          SkipNoStruggleConsent,
		},
		{
			name:              "streak at risk, shareStruggles explicitly false",
			trigger:           TriggerStreakAtRisk,
			recipientSettings: consent(false),
			wantSend:          false,
			wantSkip:          SkipNoStruggleConsent,
		},
		{
			name:              "opted in, but personalization turned off",
			trigger:           TriggerTaskStalled,
			recipientSettings: disabled,
			wantSend:          false,
			wantSkip:          SkipNoStruggleConsent,
		},
		{
			name:              "opted in, but personalization paused",
			trigger:           TriggerTaskStalled,
			recipientSettings: paused,
			wantSend:          false,
			wantSkip:          SkipNoStruggleConsent,
		},
		{
			name:              "unknown trigger with no consent is treated as a struggle",
			trigger:           TriggerType("mystery_trigger"),
			recipientSettings: consent(false),
			wantSend:          false,
			wantSkip:          SkipNoStruggleConsent,
		},
		{
			name:              "stalled task, explicitly opted in",
			trigger:           TriggerTaskStalled,
			recipientSettings: consent(true),
			wantSend:          true,
			wantSkip:          SkipNone,
		},
		// The other half of the guarantee: withholding struggles must not
		// withhold congratulation. These recipients never opted in and still get
		// their wins celebrated.
		{
			name:              "rings closed needs no struggle consent",
			trigger:           TriggerRingsClosed,
			recipientSettings: consent(false),
			wantSend:          true,
			wantSkip:          SkipNone,
		},
		{
			name:              "streak milestone with no personalization document at all",
			trigger:           TriggerStreakMilestone,
			recipientSettings: types.UserSettings{},
			wantSend:          true,
			wantSkip:          SkipNone,
		},
		{
			name:              "notable completion while personalization is paused",
			trigger:           TriggerNotableCompletion,
			recipientSettings: paused,
			wantSend:          true,
			wantSkip:          SkipNone,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := struggle(tt.trigger)
			if !tt.trigger.IsStruggle() {
				m = achievement()
				m.Trigger = tt.trigger
			}

			r := baseRecipient()
			r.Settings = tt.recipientSettings

			got := EvaluateKudosPrompt(m, r, baseSender(), DefaultKudosPolicy(), testNow)

			if got.Send != tt.wantSend {
				t.Errorf("Send = %v, want %v (skip %q)", got.Send, tt.wantSend, got.Skip)
			}
			if got.Skip != tt.wantSkip {
				t.Errorf("Skip = %q, want %q", got.Skip, tt.wantSkip)
			}
		})
	}
}

// TestEvaluateKudosPrompt_ConsentGateRunsFirst proves the ordering claim. Every
// row is a struggle without consent AND some other disqualifying condition; the
// reason reported must always be the consent one, which is what stops a future
// reordering from letting a struggle slip through a friendlier branch.
func TestEvaluateKudosPrompt_ConsentGateRunsFirst(t *testing.T) {
	cooldownStart := testNow.Add(-1 * time.Hour)

	tests := []struct {
		name      string
		mutate    func(*KudosSender)
		mutateRec func(*KudosRecipient)
	}{
		{"sender has no push token", func(s *KudosSender) { s.PushToken = "" }, nil},
		{"sender turned nudges off", func(s *KudosSender) { s.Settings.Notifications.CheckinFrequency = "none" }, nil},
		{"sender turned friend activity off", func(s *KudosSender) { s.Settings.Notifications.FriendActivity = false }, nil},
		{"sender is over the daily cap", func(s *KudosSender) { s.PromptsSentToday = 99 }, nil},
		{"sender is in cooldown", func(s *KudosSender) { s.LastPromptForTrigger = &cooldownStart }, nil},
		{"sender affinity is far too low", func(s *KudosSender) { s.Affinity = 0.01 }, nil},
		{"sender is asleep", func(s *KudosSender) { s.Location = time.FixedZone("late", 10*3600) }, nil},
		{"sender is the recipient", func(s *KudosSender) { s.ID = recipientID }, nil},
		{"encouragement does nothing for this person", nil, func(r *KudosRecipient) { r.EncouragementWorthwhile = false }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := baseSender()
			if tt.mutate != nil {
				tt.mutate(&s)
			}
			r := baseRecipient()
			r.Settings = consent(false)
			if tt.mutateRec != nil {
				tt.mutateRec(&r)
			}

			got := EvaluateKudosPrompt(struggle(TriggerTaskStalled), r, s, DefaultKudosPolicy(), testNow)

			if got.Send {
				t.Fatal("a struggle without consent must never be sent")
			}
			if got.Skip != SkipNoStruggleConsent {
				t.Errorf("Skip = %q, want %q — consent must be decided before anything else", got.Skip, SkipNoStruggleConsent)
			}
		})
	}
}

// ============================================================================
// Anti-spam
// ============================================================================

func TestEvaluateKudosPrompt_AntiSpam(t *testing.T) {
	p := DefaultKudosPolicy()

	tests := []struct {
		name     string
		moment   KudosMoment
		sender   func(KudosSender) KudosSender
		wantSend bool
		wantSkip SkipReason
	}{
		{
			name:     "baseline is allowed",
			moment:   achievement(),
			sender:   func(s KudosSender) KudosSender { return s },
			wantSend: true,
			wantSkip: SkipNone,
		},
		{
			name:   "at the daily cap",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				s.PromptsSentToday = p.HardDailyCap
				return s
			},
			wantSend: false,
			wantSkip: SkipDailyCap,
		},
		{
			name:   "one below the daily cap",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				s.PromptsSentToday = p.HardDailyCap - 1
				return s
			},
			wantSend: true,
			wantSkip: SkipNone,
		},
		{
			name:   "reduced frequency lowers the cap",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				s.ShouldReduceFrequency = true
				s.Affinity = 0.9 // clears the higher affinity floor
				s.PromptsSentToday = p.ReducedDailyCap
				return s
			},
			wantSend: false,
			wantSkip: SkipDailyCap,
		},
		{
			name:   "reduced frequency raises the affinity floor",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				s.ShouldReduceFrequency = true
				s.Affinity = 0.5 // fine normally, not when backing off
				return s
			},
			wantSend: false,
			wantSkip: SkipLowAffinity,
		},
		{
			name:   "inside the cooldown",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				t := testNow.Add(-p.TriggerCooldown + time.Minute)
				s.LastPromptForTrigger = &t
				return s
			},
			wantSend: false,
			wantSkip: SkipCooldown,
		},
		{
			name:   "just past the cooldown",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				t := testNow.Add(-p.TriggerCooldown - time.Minute)
				s.LastPromptForTrigger = &t
				return s
			},
			wantSend: true,
			wantSkip: SkipNone,
		},
		{
			name:   "quiet hours in the sender's own timezone",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				// testNow is 12:00 UTC; +10 makes it 22:00 locally.
				s.Location = time.FixedZone("evening", 10*3600)
				return s
			},
			wantSend: false,
			wantSkip: SkipQuietHours,
		},
		{
			name:   "early morning in the sender's own timezone",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				// 12:00 UTC minus 7 is 05:00 locally.
				s.Location = time.FixedZone("early", -7*3600)
				return s
			},
			wantSend: false,
			wantSkip: SkipQuietHours,
		},
		{
			name:   "check-ins turned off",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				s.Settings.Notifications.CheckinFrequency = "none"
				return s
			},
			wantSend: false,
			wantSkip: SkipNudgesOff,
		},
		{
			name:   "friend activity notifications turned off",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				s.Settings.Notifications.FriendActivity = false
				return s
			},
			wantSend: false,
			wantSkip: SkipFriendActivityOff,
		},
		{
			name:   "no push token",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				s.PushToken = ""
				return s
			},
			wantSend: false,
			wantSkip: SkipNoPushToken,
		},
		{
			name:   "never prompt someone about themselves",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				s.ID = recipientID
				return s
			},
			wantSend: false,
			wantSkip: SkipSelfPrompt,
		},
		{
			name:   "affinity below the floor",
			moment: achievement(),
			sender: func(s KudosSender) KudosSender {
				s.Affinity = p.MinAffinity - 0.01
				return s
			},
			wantSend: false,
			wantSkip: SkipLowAffinity,
		},
		{
			name: "a stale achievement is no longer a congratulation",
			moment: func() KudosMoment {
				m := achievement()
				m.OccurredAt = testNow.Add(-p.CongratulationFreshness - time.Minute)
				return m
			}(),
			sender:   func(s KudosSender) KudosSender { return s },
			wantSend: false,
			wantSkip: SkipStale,
		},
		{
			name: "a fresh achievement is",
			moment: func() KudosMoment {
				m := achievement()
				m.OccurredAt = testNow.Add(-p.CongratulationFreshness + time.Minute)
				return m
			}(),
			sender:   func(s KudosSender) KudosSender { return s },
			wantSend: true,
			wantSkip: SkipNone,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := EvaluateKudosPrompt(tt.moment, baseRecipient(), tt.sender(baseSender()), p, testNow)
			if got.Send != tt.wantSend {
				t.Errorf("Send = %v, want %v (skip %q)", got.Send, tt.wantSend, got.Skip)
			}
			if got.Skip != tt.wantSkip {
				t.Errorf("Skip = %q, want %q", got.Skip, tt.wantSkip)
			}
		})
	}
}

func TestDailyPromptCap(t *testing.T) {
	p := DefaultKudosPolicy()

	tests := []struct {
		frequency string
		reduce    bool
		want      int
	}{
		{"none", false, 0},
		{"none", true, 0},
		{"occasionally", false, 1},
		{"regularly", false, 2},
		// "frequently" wants 3 but the hard cap is 2; the ceiling wins.
		{"frequently", false, p.HardDailyCap},
		{"", false, 2},
		{"nonsense", false, 2},
		{"frequently", true, p.ReducedDailyCap},
		{"occasionally", true, 1},
	}

	for _, tt := range tests {
		name := tt.frequency
		if tt.reduce {
			name += "_reduced"
		}
		t.Run(name, func(t *testing.T) {
			if got := DailyPromptCap(tt.frequency, tt.reduce, p); got != tt.want {
				t.Errorf("DailyPromptCap(%q, %v) = %d, want %d", tt.frequency, tt.reduce, got, tt.want)
			}
		})
	}
}

// ============================================================================
// Timing
// ============================================================================

func TestEncouragementWindow(t *testing.T) {
	p := DefaultKudosPolicy() // day 08:00–21:00, lead 2h

	tests := []struct {
		name               string
		peak               *int
		wantStart, wantEnd int
	}{
		{"unknown peak opens the whole civil day", nil, 8, 21},
		{"afternoon peak", hourPtr(14), 12, 14},
		{"evening peak", hourPtr(17), 15, 17},
		{"night peak", hourPtr(21), 19, 21},
		// A 6am peak would put the window at 4am. Rather than buzz someone in
		// the night or never send at all, it clamps to the start of the day.
		{"early peak clamps into the civil day", hourPtr(6), 8, 10},
		{"peak at the start of the day", hourPtr(8), 8, 10},
		{"peak after the day ends falls back to the whole day", hourPtr(23), 8, 21},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start, end := EncouragementWindow(tt.peak, p)
			if start != tt.wantStart || end != tt.wantEnd {
				t.Errorf("EncouragementWindow() = [%d,%d), want [%d,%d)", start, end, tt.wantStart, tt.wantEnd)
			}
		})
	}
}

// TestDeliveryWindow_StreakAtRiskIsLate pins the deliberate exception: a streak
// expiring at midnight is delivered in the evening, not in the run-up to a peak
// window that may have passed hours ago.
func TestDeliveryWindow_StreakAtRiskIsLate(t *testing.T) {
	p := DefaultKudosPolicy()
	morningPeak := hourPtr(9)

	start, end := DeliveryWindow(TriggerStreakAtRisk, morningPeak, p)
	if start != p.AtRiskLocalHour || end != p.DayEndHour {
		t.Errorf("streak-at-risk window = [%d,%d), want [%d,%d)", start, end, p.AtRiskLocalHour, p.DayEndHour)
	}

	// The same peak under the general rule wants 07:00–09:00, which clamps to
	// the first two hours of the civil day.
	start, end = DeliveryWindow(TriggerTaskStalled, morningPeak, p)
	if start != 8 || end != 10 {
		t.Errorf("stalled-task window = [%d,%d), want [8,10)", start, end)
	}
}

// TestEvaluateKudosPrompt_StruggleTiming checks the delivery window against the
// RECIPIENT's clock — the point is that the nudge lands while they are working,
// not that it is convenient for the sender.
func TestEvaluateKudosPrompt_StruggleTiming(t *testing.T) {
	p := DefaultKudosPolicy()

	tests := []struct {
		name         string
		trigger      TriggerType
		peak         *int
		recipientLoc *time.Location
		wantSend     bool
		wantSkip     SkipReason
	}{
		{
			name:         "inside the pre-peak window",
			trigger:      TriggerTaskStalled,
			peak:         hourPtr(14), // window [12,14); recipient-local 12:00
			recipientLoc: time.UTC,
			wantSend:     true,
			wantSkip:     SkipNone,
		},
		{
			name:         "after the peak has already opened",
			trigger:      TriggerTaskStalled,
			peak:         hourPtr(10), // window [8,10); recipient-local 12:00
			recipientLoc: time.UTC,
			wantSend:     false,
			wantSkip:     SkipWrongTimeOfDay,
		},
		{
			name:         "no peak fact means the whole civil day works",
			trigger:      TriggerTaskStalled,
			peak:         nil,
			recipientLoc: time.UTC,
			wantSend:     true,
			wantSkip:     SkipNone,
		},
		{
			name:         "streak at risk is too early at noon",
			trigger:      TriggerStreakAtRisk,
			peak:         hourPtr(14),
			recipientLoc: time.UTC,
			wantSend:     false,
			wantSkip:     SkipWrongTimeOfDay,
		},
		{
			name:         "streak at risk lands in the recipient's evening",
			trigger:      TriggerStreakAtRisk,
			peak:         hourPtr(14),
			recipientLoc: time.FixedZone("evening", 8*3600), // 12:00 UTC -> 20:00 local
			wantSend:     true,
			wantSkip:     SkipNone,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := baseRecipient()
			r.PeakStartHour = tt.peak
			r.Location = tt.recipientLoc

			got := EvaluateKudosPrompt(struggle(tt.trigger), r, baseSender(), p, testNow)
			if got.Send != tt.wantSend {
				t.Errorf("Send = %v, want %v (skip %q)", got.Send, tt.wantSend, got.Skip)
			}
			if got.Skip != tt.wantSkip {
				t.Errorf("Skip = %q, want %q", got.Skip, tt.wantSkip)
			}
		})
	}
}

// TestEvaluateKudosPrompt_EncouragementEffectOnlyGatesEncouragement — a
// measured absence of completion lift is a reason to stop nudging someone, not
// a reason to stop celebrating them.
func TestEvaluateKudosPrompt_EncouragementEffectOnlyGatesEncouragement(t *testing.T) {
	p := DefaultKudosPolicy()
	r := baseRecipient()
	r.EncouragementWorthwhile = false

	got := EvaluateKudosPrompt(struggle(TriggerTaskStalled), r, baseSender(), p, testNow)
	if got.Send || got.Skip != SkipEncouragementDead {
		t.Errorf("encouragement: Send=%v Skip=%q, want blocked as %q", got.Send, got.Skip, SkipEncouragementDead)
	}

	got = EvaluateKudosPrompt(achievement(), r, baseSender(), p, testNow)
	if !got.Send {
		t.Errorf("congratulation: Send=%v Skip=%q, want allowed", got.Send, got.Skip)
	}
}

// ============================================================================
// Dedupe keys
// ============================================================================

func TestDedupeKey(t *testing.T) {
	otherSender := primitive.NewObjectID()
	otherRecipient := primitive.NewObjectID()

	base := DedupeKey(senderID, recipientID, TriggerTaskStalled, "task-1")

	tests := []struct {
		name string
		key  string
		same bool
	}{
		{"identical inputs", DedupeKey(senderID, recipientID, TriggerTaskStalled, "task-1"), true},
		{"different sender", DedupeKey(otherSender, recipientID, TriggerTaskStalled, "task-1"), false},
		{"different recipient", DedupeKey(senderID, otherRecipient, TriggerTaskStalled, "task-1"), false},
		{"different trigger", DedupeKey(senderID, recipientID, TriggerStreakAtRisk, "task-1"), false},
		{"different subject", DedupeKey(senderID, recipientID, TriggerTaskStalled, "task-2"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if (tt.key == base) != tt.same {
				t.Errorf("DedupeKey collision mismatch: %q vs %q, wanted same=%v", tt.key, base, tt.same)
			}
		})
	}
}

func TestLocalDay(t *testing.T) {
	// 23:30 UTC is already tomorrow in Tokyo and still today in New York. The
	// daily cap counts in the sender's day, so this has to follow the zone.
	night := time.Date(2026, 7, 30, 23, 30, 0, 0, time.UTC)

	tests := []struct {
		name string
		loc  *time.Location
		want string
	}{
		{"utc", time.UTC, "2026-07-30"},
		{"nil falls back to utc", nil, "2026-07-30"},
		{"ahead of utc", time.FixedZone("tokyo", 9*3600), "2026-07-31"},
		{"behind utc", time.FixedZone("nyc", -4*3600), "2026-07-30"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := LocalDay(night, tt.loc); got != tt.want {
				t.Errorf("LocalDay() = %q, want %q", got, tt.want)
			}
		})
	}
}
