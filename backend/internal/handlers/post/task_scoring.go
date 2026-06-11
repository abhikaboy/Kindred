package Post

import (
	"math"
	"time"
)

// taskScoringConfig holds every tunable knob for feed task selection.
// Tune weights/windows here — nowhere else.
type taskScoringConfig struct {
	WorkingNowWeight    float64 // boost when a friend is actively working on the task
	StartWeight         float64 // weight of start-time proximity
	StartRampHours      float64 // ramp-up window before start
	StartDecayHours     float64 // decay window after start
	DeadlineWeight      float64 // weight of deadline urgency
	DeadlineRampHours   float64 // ramp-up window before deadline
	OverdueScore        float64 // flat component score while slightly overdue
	OverdueGraceHours   float64 // how long the overdue grace lasts
	PriorityWeight      float64 // weight of user-set priority (1=Low..3=High)
	RecencyWeight       float64 // weight of creation recency
	RecencyHalfLifeDays float64 // half-life of the recency decay
	ValueWeight         float64 // weight of user-set value (0..10)
	SamplingEpsilon     float64 // floor so zero-score tasks stay sampleable
	SamplingExponent    float64 // sharpens sampling toward high scorers
}

var defaultTaskScoring = taskScoringConfig{
	WorkingNowWeight:    2.5,
	StartWeight:         3.0,
	StartRampHours:      24,
	StartDecayHours:     6,
	DeadlineWeight:      3.0,
	DeadlineRampHours:   48,
	OverdueScore:        0.3,
	OverdueGraceHours:   24,
	PriorityWeight:      1.5,
	RecencyWeight:       1.0,
	RecencyHalfLifeDays: 3,
	ValueWeight:         0.5,
	SamplingEpsilon:     0.15,
	SamplingExponent:    2,
}

// taskCandidate is a friend's task parsed from the aggregation pipeline,
// carrying the time fields needed for scoring alongside the wire format.
type taskCandidate struct {
	feedTask       FeedTaskData
	createdAt      time.Time
	deadline       *time.Time
	startTime      *time.Time
	startDate      *time.Time
	workingOnSince *time.Time
}

// effectiveStart prefers the precise startTime over the date-only startDate.
func (c *taskCandidate) effectiveStart() *time.Time {
	if c.startTime != nil {
		return c.startTime
	}
	return c.startDate
}

// scoreTask answers "how encourageable is this task right now?" as a
// weighted sum of normalized (0..1) components.
func scoreTask(c *taskCandidate, cfg taskScoringConfig, now time.Time) float64 {
	score := 0.0
	if c.workingOnSince != nil {
		score += cfg.WorkingNowWeight
	}
	score += cfg.StartWeight * startProximity(c.effectiveStart(), cfg, now)
	score += cfg.DeadlineWeight * deadlineUrgency(c.deadline, cfg, now)
	score += cfg.PriorityWeight * clamp01(float64(c.feedTask.Priority-1)/2)
	score += cfg.RecencyWeight * recencyScore(c.createdAt, cfg, now)
	score += cfg.ValueWeight * clamp01(c.feedTask.Value/10)
	return score
}

// startProximity peaks at the start moment: linear ramp 0→1 over the
// StartRampHours before start, linear decay 1→0 over StartDecayHours after.
func startProximity(start *time.Time, cfg taskScoringConfig, now time.Time) float64 {
	if start == nil {
		return 0
	}
	hoursUntil := start.Sub(now).Hours()
	switch {
	case hoursUntil >= 0 && hoursUntil <= cfg.StartRampHours:
		return 1 - hoursUntil/cfg.StartRampHours
	case hoursUntil < 0 && -hoursUntil <= cfg.StartDecayHours:
		return 1 + hoursUntil/cfg.StartDecayHours
	default:
		return 0
	}
}

// deadlineUrgency ramps 0→1 over DeadlineRampHours before the deadline,
// holds a small flat grace while recently overdue, then drops to zero.
func deadlineUrgency(deadline *time.Time, cfg taskScoringConfig, now time.Time) float64 {
	if deadline == nil {
		return 0
	}
	hoursUntil := deadline.Sub(now).Hours()
	switch {
	case hoursUntil >= 0 && hoursUntil <= cfg.DeadlineRampHours:
		return 1 - hoursUntil/cfg.DeadlineRampHours
	case hoursUntil < 0 && -hoursUntil <= cfg.OverdueGraceHours:
		return cfg.OverdueScore
	default:
		return 0
	}
}

// recencyScore decays exponentially with task age (creation time).
func recencyScore(createdAt time.Time, cfg taskScoringConfig, now time.Time) float64 {
	ageDays := now.Sub(createdAt).Hours() / 24
	if ageDays < 0 {
		ageDays = 0
	}
	return math.Pow(0.5, ageDays/cfg.RecencyHalfLifeDays)
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}
