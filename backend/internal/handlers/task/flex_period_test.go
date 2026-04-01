package task

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ========================================
// Factory Tests
// ========================================

func TestFlexPeriodFor_Daily(t *testing.T) {
	s, err := FlexPeriodFor("daily")
	require.NoError(t, err)
	assert.Equal(t, "daily", s.String())
	assert.IsType(t, DailyFlexPeriod{}, s)
}

func TestFlexPeriodFor_Weekly(t *testing.T) {
	s, err := FlexPeriodFor("weekly")
	require.NoError(t, err)
	assert.Equal(t, "weekly", s.String())
	assert.IsType(t, WeeklyFlexPeriod{}, s)
}

func TestFlexPeriodFor_Monthly(t *testing.T) {
	s, err := FlexPeriodFor("monthly")
	require.NoError(t, err)
	assert.Equal(t, "monthly", s.String())
	assert.IsType(t, MonthlyFlexPeriod{}, s)
}

func TestFlexPeriodFor_Invalid(t *testing.T) {
	_, err := FlexPeriodFor("yearly")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unknown flex period")
}

// ========================================
// DailyFlexPeriod Tests
// ========================================

func TestDailyFlexPeriod_ComputeCooldown(t *testing.T) {
	d := DailyFlexPeriod{}
	now := time.Date(2026, 3, 15, 14, 30, 0, 0, time.UTC)
	cooldown := d.ComputeCooldown(now, time.UTC)
	expected := time.Date(2026, 3, 15, 15, 30, 0, 0, time.UTC)
	assert.Equal(t, expected, cooldown)
}

func TestDailyFlexPeriod_PeriodStart(t *testing.T) {
	d := DailyFlexPeriod{}
	// Tuesday March 15, 2026 at 3pm UTC
	now := time.Date(2026, 3, 15, 15, 0, 0, 0, time.UTC)
	start := d.PeriodStart(now, time.UTC)
	expected := time.Date(2026, 3, 15, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, start)
}

func TestDailyFlexPeriod_NextPeriodStart(t *testing.T) {
	d := DailyFlexPeriod{}
	now := time.Date(2026, 3, 15, 15, 0, 0, 0, time.UTC)
	next := d.NextPeriodStart(now, time.UTC)
	expected := time.Date(2026, 3, 16, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, next)
}

func TestDailyFlexPeriod_RespectsTimezone(t *testing.T) {
	d := DailyFlexPeriod{}
	ny, _ := time.LoadLocation("America/New_York")
	// March 15 2026 at 11pm ET = March 16 3am UTC
	now := time.Date(2026, 3, 15, 23, 0, 0, 0, ny).In(time.UTC)

	start := d.PeriodStart(now, ny)
	// Period start should be March 15 midnight ET = March 15 4am UTC (EDT)
	expectedLocal := time.Date(2026, 3, 15, 0, 0, 0, 0, ny)
	assert.Equal(t, expectedLocal.In(time.UTC), start)

	next := d.NextPeriodStart(now, ny)
	expectedNextLocal := time.Date(2026, 3, 16, 0, 0, 0, 0, ny)
	assert.Equal(t, expectedNextLocal.In(time.UTC), next)
}

// ========================================
// WeeklyFlexPeriod Tests
// ========================================

func TestWeeklyFlexPeriod_ComputeCooldown(t *testing.T) {
	w := WeeklyFlexPeriod{}
	// Wednesday at 3pm
	now := time.Date(2026, 3, 18, 15, 0, 0, 0, time.UTC)
	cooldown := w.ComputeCooldown(now, time.UTC)
	// Should be Thursday midnight
	expected := time.Date(2026, 3, 19, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, cooldown)
}

func TestWeeklyFlexPeriod_PeriodStart_Wednesday(t *testing.T) {
	w := WeeklyFlexPeriod{}
	// Wednesday March 18, 2026
	now := time.Date(2026, 3, 18, 15, 0, 0, 0, time.UTC)
	start := w.PeriodStart(now, time.UTC)
	// Monday March 16, 2026
	expected := time.Date(2026, 3, 16, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, start)
}

func TestWeeklyFlexPeriod_PeriodStart_Monday(t *testing.T) {
	w := WeeklyFlexPeriod{}
	// Monday March 16, 2026
	now := time.Date(2026, 3, 16, 10, 0, 0, 0, time.UTC)
	start := w.PeriodStart(now, time.UTC)
	expected := time.Date(2026, 3, 16, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, start)
}

func TestWeeklyFlexPeriod_PeriodStart_Sunday(t *testing.T) {
	w := WeeklyFlexPeriod{}
	// Sunday March 22, 2026
	now := time.Date(2026, 3, 22, 10, 0, 0, 0, time.UTC)
	start := w.PeriodStart(now, time.UTC)
	// Previous Monday: March 16, 2026
	expected := time.Date(2026, 3, 16, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, start)
}

func TestWeeklyFlexPeriod_NextPeriodStart(t *testing.T) {
	w := WeeklyFlexPeriod{}
	// Wednesday March 18, 2026
	now := time.Date(2026, 3, 18, 15, 0, 0, 0, time.UTC)
	next := w.NextPeriodStart(now, time.UTC)
	// Next Monday: March 23, 2026
	expected := time.Date(2026, 3, 23, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, next)
}

// ========================================
// MonthlyFlexPeriod Tests
// ========================================

func TestMonthlyFlexPeriod_ComputeCooldown(t *testing.T) {
	m := MonthlyFlexPeriod{}
	now := time.Date(2026, 3, 15, 14, 0, 0, 0, time.UTC)
	cooldown := m.ComputeCooldown(now, time.UTC)
	expected := time.Date(2026, 3, 16, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, cooldown)
}

func TestMonthlyFlexPeriod_PeriodStart(t *testing.T) {
	m := MonthlyFlexPeriod{}
	now := time.Date(2026, 3, 15, 14, 0, 0, 0, time.UTC)
	start := m.PeriodStart(now, time.UTC)
	expected := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, start)
}

func TestMonthlyFlexPeriod_NextPeriodStart(t *testing.T) {
	m := MonthlyFlexPeriod{}
	now := time.Date(2026, 3, 15, 14, 0, 0, 0, time.UTC)
	next := m.NextPeriodStart(now, time.UTC)
	expected := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, next)
}

func TestMonthlyFlexPeriod_NextPeriodStart_December(t *testing.T) {
	m := MonthlyFlexPeriod{}
	now := time.Date(2026, 12, 15, 14, 0, 0, 0, time.UTC)
	next := m.NextPeriodStart(now, time.UTC)
	expected := time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, expected, next)
}
