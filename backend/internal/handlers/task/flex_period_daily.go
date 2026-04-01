package task

import "time"

type DailyFlexPeriod struct{}

func (d DailyFlexPeriod) String() string { return "daily" }

func (d DailyFlexPeriod) ComputeCooldown(now time.Time, loc *time.Location) time.Time {
	return now.Add(1 * time.Hour).In(time.UTC)
}

func (d DailyFlexPeriod) PeriodStart(now time.Time, loc *time.Location) time.Time {
	local := now.In(loc)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc).In(time.UTC)
}

func (d DailyFlexPeriod) NextPeriodStart(current time.Time, loc *time.Location) time.Time {
	local := current.In(loc)
	tomorrow := time.Date(local.Year(), local.Month(), local.Day()+1, 0, 0, 0, 0, loc)
	return tomorrow.In(time.UTC)
}
