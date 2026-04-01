package task

import "time"

type WeeklyFlexPeriod struct{}

func (w WeeklyFlexPeriod) String() string { return "weekly" }

func (w WeeklyFlexPeriod) ComputeCooldown(now time.Time, loc *time.Location) time.Time {
	local := now.In(loc)
	tomorrow := time.Date(local.Year(), local.Month(), local.Day()+1, 0, 0, 0, 0, loc)
	return tomorrow.In(time.UTC)
}

func (w WeeklyFlexPeriod) PeriodStart(now time.Time, loc *time.Location) time.Time {
	local := now.In(loc)
	// Monday = 0 offset. Go's time.Weekday: Sunday=0 .. Saturday=6
	offset := (int(local.Weekday()) + 6) % 7
	monday := local.AddDate(0, 0, -offset)
	return time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, loc).In(time.UTC)
}

func (w WeeklyFlexPeriod) NextPeriodStart(current time.Time, loc *time.Location) time.Time {
	local := current.In(loc)
	offset := (int(local.Weekday()) + 6) % 7
	monday := local.AddDate(0, 0, -offset)
	nextMonday := monday.AddDate(0, 0, 7)
	return time.Date(nextMonday.Year(), nextMonday.Month(), nextMonday.Day(), 0, 0, 0, 0, loc).In(time.UTC)
}
