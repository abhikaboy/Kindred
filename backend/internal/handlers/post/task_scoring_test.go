package Post

import (
	"testing"
	"time"
)

var testNow = time.Date(2026, 6, 10, 12, 0, 0, 0, time.UTC)

func timePtr(t time.Time) *time.Time { return &t }

// baselineCandidate has no time fields and minimum priority/value — score ~0
// except recency (created now → recency component = 1.0 × weight).
func baselineCandidate() taskCandidate {
	return taskCandidate{
		feedTask:  FeedTaskData{Priority: 1, Value: 0},
		createdAt: testNow,
	}
}

func TestScoreTask_ImminentStartBeatsFarFuture(t *testing.T) {
	soon := baselineCandidate()
	soon.startTime = timePtr(testNow.Add(30 * time.Minute))

	far := baselineCandidate()
	far.startTime = timePtr(testNow.Add(72 * time.Hour))

	if scoreTask(&soon, defaultTaskScoring, testNow) <= scoreTask(&far, defaultTaskScoring, testNow) {
		t.Fatal("task starting in 30m should outscore task starting in 72h")
	}
}

func TestScoreTask_RecentlyStartedStillScores(t *testing.T) {
	started := baselineCandidate()
	started.startTime = timePtr(testNow.Add(-2 * time.Hour))

	base := baselineCandidate()

	if scoreTask(&started, defaultTaskScoring, testNow) <= scoreTask(&base, defaultTaskScoring, testNow) {
		t.Fatal("task started 2h ago (within decay window) should outscore no-start task")
	}
}

func TestScoreTask_StartTimePrecedesStartDate(t *testing.T) {
	// startTime imminent, startDate far away — startTime must win.
	c := baselineCandidate()
	c.startTime = timePtr(testNow.Add(1 * time.Hour))
	c.startDate = timePtr(testNow.Add(100 * time.Hour))

	dateOnly := baselineCandidate()
	dateOnly.startDate = timePtr(testNow.Add(100 * time.Hour))

	if scoreTask(&c, defaultTaskScoring, testNow) <= scoreTask(&dateOnly, defaultTaskScoring, testNow) {
		t.Fatal("startTime should take precedence over startDate")
	}
}

func TestScoreTask_DeadlineTomorrowBeatsNoDeadline(t *testing.T) {
	due := baselineCandidate()
	due.deadline = timePtr(testNow.Add(24 * time.Hour))

	base := baselineCandidate()

	if scoreTask(&due, defaultTaskScoring, testNow) <= scoreTask(&base, defaultTaskScoring, testNow) {
		t.Fatal("task due in 24h should outscore task with no deadline")
	}
}

func TestScoreTask_OverdueGraceThenZero(t *testing.T) {
	slightlyLate := baselineCandidate()
	slightlyLate.deadline = timePtr(testNow.Add(-12 * time.Hour))

	veryLate := baselineCandidate()
	veryLate.deadline = timePtr(testNow.Add(-72 * time.Hour))

	base := baselineCandidate()

	if scoreTask(&slightlyLate, defaultTaskScoring, testNow) <= scoreTask(&base, defaultTaskScoring, testNow) {
		t.Fatal("12h-overdue task should still get the grace boost")
	}
	if scoreTask(&veryLate, defaultTaskScoring, testNow) != scoreTask(&base, defaultTaskScoring, testNow) {
		t.Fatal("72h-overdue task should score same as no-deadline task")
	}
}

func TestScoreTask_WorkingNowDominatesPriority(t *testing.T) {
	working := baselineCandidate()
	working.workingOnSince = timePtr(testNow.Add(-10 * time.Minute))

	highPri := baselineCandidate()
	highPri.feedTask.Priority = 3

	if scoreTask(&working, defaultTaskScoring, testNow) <= scoreTask(&highPri, defaultTaskScoring, testNow) {
		t.Fatal("working-now (weight 2.5) should outscore high priority alone (weight 1.5)")
	}
}

func TestScoreTask_PriorityOrdering(t *testing.T) {
	low, med, high := baselineCandidate(), baselineCandidate(), baselineCandidate()
	low.feedTask.Priority = 1
	med.feedTask.Priority = 2
	high.feedTask.Priority = 3

	sLow := scoreTask(&low, defaultTaskScoring, testNow)
	sMed := scoreTask(&med, defaultTaskScoring, testNow)
	sHigh := scoreTask(&high, defaultTaskScoring, testNow)
	if !(sHigh > sMed && sMed > sLow) {
		t.Fatalf("priority ordering broken: high=%v med=%v low=%v", sHigh, sMed, sLow)
	}
}

func TestScoreTask_RecencyDecays(t *testing.T) {
	fresh := baselineCandidate()

	old := baselineCandidate()
	old.createdAt = testNow.Add(-30 * 24 * time.Hour)

	if scoreTask(&fresh, defaultTaskScoring, testNow) <= scoreTask(&old, defaultTaskScoring, testNow) {
		t.Fatal("freshly created task should outscore 30-day-old task")
	}
}

func TestScoreTask_ValueContributes(t *testing.T) {
	valuable := baselineCandidate()
	valuable.feedTask.Value = 10

	base := baselineCandidate()

	if scoreTask(&valuable, defaultTaskScoring, testNow) <= scoreTask(&base, defaultTaskScoring, testNow) {
		t.Fatal("value-10 task should outscore value-0 task")
	}
}
