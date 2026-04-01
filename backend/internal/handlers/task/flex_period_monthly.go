package task

import "time"

type MonthlyFlexPeriod struct{}

func (m MonthlyFlexPeriod) String() string { return "monthly" }

func (m MonthlyFlexPeriod) ComputeCooldown(now time.Time, loc *time.Location) time.Time {
	local := now.In(loc)
	tomorrow := time.Date(local.Year(), local.Month(), local.Day()+1, 0, 0, 0, 0, loc)
	return tomorrow.In(time.UTC)
}

func (m MonthlyFlexPeriod) PeriodStart(now time.Time, loc *time.Location) time.Time {
	local := now.In(loc)
	return time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, loc).In(time.UTC)
}

func (m MonthlyFlexPeriod) NextPeriodStart(current time.Time, loc *time.Location) time.Time {
	local := current.In(loc)
	firstOfNextMonth := time.Date(local.Year(), local.Month()+1, 1, 0, 0, 0, 0, loc)
	return firstOfNextMonth.In(time.UTC)
}
