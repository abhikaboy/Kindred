package weekrecap

import "time"

// HabitRun counts consecutive kept weeks back from the local Monday start (inclusive).
// repaired is true when a daily run held through a missed day.
func HabitRun(freq string, dates []time.Time, start time.Time, loc *time.Location, maxWeeks int) (run int, repaired bool) {
	for w := 0; w < maxWeeks; w++ {
		n := countDays(dates, start.AddDate(0, 0, -7*w), loc)
		if !weekKept(freq, n) {
			break
		}
		run++
		if freq == "daily" && n < 7 {
			repaired = true
		}
	}
	return run, repaired
}

// WeekOf returns the local Monday that starts t's week.
func WeekOf(t time.Time, loc *time.Location) time.Time { return weekOf(t, loc) }
