package jobs

import (
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func returnedMoment(age time.Duration) KudosMoment {
	return KudosMoment{
		RecipientID: recipientID,
		Trigger:     TriggerReturned,
		Subject:     testNow.Format("2006-01-02"),
		OccurredAt:  testNow.Add(-age),
	}
}

func TestReturnedIsCelebration(t *testing.T) {
	if TriggerReturned.IsStruggle() {
		t.Fatal("returned must be celebration-class")
	}
}

func TestReturnedMoments_FreshnessWindow(t *testing.T) {
	window := DefaultKudosPolicy().Freshness(TriggerReturned)
	if window != 12*time.Hour {
		t.Fatalf("window = %v, want 12h", window)
	}
	ts := func(d time.Duration) *time.Time { v := testNow.Add(d); return &v }
	ids := make([]primitive.ObjectID, 6)
	for i := range ids {
		ids[i] = primitive.NewObjectID()
	}
	rows := []returnedRow{
		{ID: ids[0], ReturnedAt: ts(-time.Minute)},        // fresh
		{ID: ids[1], ReturnedAt: ts(-12 * time.Hour)},     // edge, fresh
		{ID: ids[2], ReturnedAt: ts(-12*time.Hour - 1)},   // stale
		{ID: ids[3], ReturnedAt: ts(-3 * 24 * time.Hour)}, // stale
		{ID: ids[4], ReturnedAt: nil},                     // never
		{ID: ids[5], ReturnedAt: ts(time.Hour)},           // future clock skew
	}
	got := returnedMoments(rows, testNow, window)
	if len(got) != 2 || got[0].RecipientID != ids[0] || got[1].RecipientID != ids[1] {
		t.Fatalf("unexpected moments: %+v", got)
	}
	for _, m := range got {
		if m.Trigger != TriggerReturned {
			t.Errorf("trigger = %q", m.Trigger)
		}
	}

	f := returnedFilter(testNow, window)
	want := bson.M{"returnedAt": bson.M{"$gte": testNow.Add(-window), "$lte": testNow}}
	if f["returnedAt"].(bson.M)["$gte"] != want["returnedAt"].(bson.M)["$gte"] ||
		f["returnedAt"].(bson.M)["$lte"] != want["returnedAt"].(bson.M)["$lte"] {
		t.Errorf("filter = %v, want %v", f, want)
	}
}

func TestSortMomentsByPriority_ReturnedFirstStable(t *testing.T) {
	mk := func(tr TriggerType, subj string) KudosMoment { return KudosMoment{Trigger: tr, Subject: subj} }
	moments := []KudosMoment{
		mk(TriggerRingsClosed, "a"),
		mk(TriggerTaskStalled, "b"),
		mk(TriggerReturned, "r1"),
		mk(TriggerStreakMilestone, "c"),
		mk(TriggerReturned, "r2"),
		mk(TriggerNotableCompletion, "d"),
		mk(TriggerStreakAtRisk, "e"),
	}
	SortMomentsByPriority(moments)
	var got []string
	for _, m := range moments {
		got = append(got, m.Subject)
	}
	want := "r1,r2,a,b,c,d,e"
	if strings.Join(got, ",") != want {
		t.Errorf("order = %v, want %s", got, want)
	}
}

func TestEvaluateKudosPrompt_ReturnedNeedsNoStruggleConsent(t *testing.T) {
	p := DefaultKudosPolicy()
	r := baseRecipient()
	r.Settings = consent(false)
	r.Settings.Personalization = nil
	r.EncouragementWorthwhile = false // must not gate a celebration
	if v := EvaluateKudosPrompt(returnedMoment(time.Hour), r, baseSender(), p, testNow); !v.Send {
		t.Fatalf("want send, got skip %q", v.Skip)
	}
}

func TestEvaluateKudosPrompt_ReturnedRespectsGuards(t *testing.T) {
	p := DefaultKudosPolicy()
	r := baseRecipient()

	t.Run("cooldown", func(t *testing.T) {
		s := baseSender()
		s.LastPromptForTrigger = at(testNow.Add(-time.Hour))
		if v := EvaluateKudosPrompt(returnedMoment(time.Hour), r, s, p, testNow); v.Skip != SkipCooldown {
			t.Errorf("skip = %q, want cooldown", v.Skip)
		}
		s.LastPromptForTrigger = at(testNow.Add(-p.TriggerCooldown - time.Minute))
		if v := EvaluateKudosPrompt(returnedMoment(time.Hour), r, s, p, testNow); !v.Send {
			t.Errorf("after cooldown want send, got %q", v.Skip)
		}
	})
	t.Run("daily cap", func(t *testing.T) {
		s := baseSender()
		s.PromptsSentToday = 2
		if v := EvaluateKudosPrompt(returnedMoment(time.Hour), r, s, p, testNow); v.Skip != SkipDailyCap {
			t.Errorf("skip = %q, want daily_cap", v.Skip)
		}
	})
	t.Run("quiet hours", func(t *testing.T) {
		night := time.Date(2026, 7, 30, 23, 0, 0, 0, time.UTC)
		m := returnedMoment(0)
		m.OccurredAt = night.Add(-time.Hour)
		if v := EvaluateKudosPrompt(m, r, baseSender(), p, night); v.Skip != SkipQuietHours {
			t.Errorf("skip = %q, want quiet_hours", v.Skip)
		}
	})
	t.Run("stale after 12h", func(t *testing.T) {
		if v := EvaluateKudosPrompt(returnedMoment(13*time.Hour), r, baseSender(), p, testNow); v.Skip != SkipStale {
			t.Errorf("skip = %q, want moment_stale", v.Skip)
		}
	})
	t.Run("affinity floor slightly lower", func(t *testing.T) {
		s := baseSender()
		s.Affinity = 0.37
		if v := EvaluateKudosPrompt(returnedMoment(time.Hour), r, s, p, testNow); !v.Send {
			t.Errorf("0.37 should clear the returned floor, got %q", v.Skip)
		}
		if v := EvaluateKudosPrompt(achievement(), r, s, p, testNow); v.Skip != SkipLowAffinity {
			t.Errorf("0.37 should not clear the normal floor, got %q", v.Skip)
		}
		s.Affinity = 0.34
		if v := EvaluateKudosPrompt(returnedMoment(time.Hour), r, s, p, testNow); v.Skip != SkipLowAffinity {
			t.Errorf("0.34 should fail the returned floor, got %q", v.Skip)
		}
		s.Affinity = 0.62
		s.ShouldReduceFrequency = true
		if v := EvaluateKudosPrompt(returnedMoment(time.Hour), r, s, p, testNow); !v.Send {
			t.Errorf("0.62 should clear reduced returned floor 0.60, got %q", v.Skip)
		}
	})
}

func TestKudosPromptCopy_ReturnedRevealsNothing(t *testing.T) {
	title, body := kudosPromptCopy(returnedMoment(0), "Jordan")
	if title != "Cheer them on" {
		t.Errorf("title = %q", title)
	}
	if body != "Jordan is getting going today. A kind word from you would land well right now." {
		t.Errorf("body = %q", body)
	}
	all := strings.ToLower(title + " " + body)
	for _, banned := range []string{"back", "away", "miss", "gap", "days", "overdue", "task"} {
		if strings.Contains(all, banned) {
			t.Errorf("copy contains %q: %q", banned, all)
		}
	}
}
