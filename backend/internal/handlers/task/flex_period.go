package task

import (
	"fmt"
	"time"
)

// FlexPeriodStrategy encapsulates all period-specific behavior for flex tasks.
// Each period type (daily, weekly, monthly) implements this interface with its
// own cooldown, period boundary, and next-period logic.
type FlexPeriodStrategy interface {
	String() string
	ComputeCooldown(now time.Time, loc *time.Location) time.Time
	PeriodStart(now time.Time, loc *time.Location) time.Time
	NextPeriodStart(current time.Time, loc *time.Location) time.Time
}

// FlexPeriodFor resolves a stored period string to the corresponding strategy.
// This is the only switch on period values in the codebase.
func FlexPeriodFor(period string) (FlexPeriodStrategy, error) {
	switch period {
	case "daily":
		return DailyFlexPeriod{}, nil
	case "weekly":
		return WeeklyFlexPeriod{}, nil
	case "monthly":
		return MonthlyFlexPeriod{}, nil
	default:
		return nil, fmt.Errorf("unknown flex period: %s", period)
	}
}
