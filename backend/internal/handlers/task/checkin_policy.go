package task

import (
	"hash/fnv"
	"sort"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// The decision half of the daily check-in, kept free of Mongo and clocks so it
// can be tested exhaustively. HandleCheckin gathers the state; every judgement
// about whether a check-in may go out is made here.
//
// The check-in is the one push Kindred sends that the user never asked for task
// by task, so it has to earn its place. It used to fire at 17:01 for everyone
// with a count of what was left, which trains people to mute it. Now:
//
//   - It names one task the user deliberately put on today. With nothing like
//     that there is nothing worth saying, and it stays quiet.
//   - It lands just before the hours the user usually gets things done, not
//     at a fixed time for everyone.
//   - It stays away on a day the user is already moving.
//   - When two in a row go unanswered it goes quiet until the user is back.
//     Coming back after a gap is the Welcome back sheet's job, not a push's.

const (
	// CheckinDefaultHour is used until we know someone's rhythm: early enough
	// that a task due today is still very doable.
	CheckinDefaultHour = 10
	// CheckinEarliestHour and CheckinLatestHour bound when a check-in may
	// buzz, in the user's own time. Kindred has no quiet-hours setting yet.
	CheckinEarliestHour = 9
	CheckinLatestHour   = 20
	// CheckinPeakLeadHours is how far ahead of the user's peak window the
	// check-in lands, so it arrives as they're settling in rather than midway.
	CheckinPeakLeadHours = 1
	// CheckinIgnoredLimit is how many unanswered check-ins in a row it takes to
	// go quiet. Answering means doing anything in the app afterwards.
	CheckinIgnoredLimit = 2
)

// CheckinSkip names why a check-in was not sent. Empty means send.
type CheckinSkip string

const (
	CheckinSend          CheckinSkip = ""
	CheckinSkipOff       CheckinSkip = "off"
	CheckinSkipTooSoon   CheckinSkip = "too_soon"
	CheckinSkipIgnored   CheckinSkip = "ignored"
	CheckinSkipActive    CheckinSkip = "active_today"
	CheckinSkipNoFocus   CheckinSkip = "nothing_planned"
	CheckinSkipNoToken   CheckinSkip = "no_push_token"
	CheckinSkipQuietTime CheckinSkip = "quiet_time"
)

// CheckinState is everything the decision needs about one user.
type CheckinState struct {
	// Frequency is the user's setting: none, occasionally, regularly or
	// frequently. Anything else is treated as regularly, the default.
	Frequency string
	// ReduceFrequency comes from the `nudge-receptivity` fact: this person
	// tends to ignore or dismiss nudges, so space them out further.
	ReduceFrequency bool
	// LastSentAt and IgnoredInARow are the check-in's own ledger.
	LastSentAt    *time.Time
	IgnoredInARow int
	// LastActiveAt is the latest thing the user did: a completion, a logged
	// session, or a task created or edited. Nil when we have never seen any.
	LastActiveAt *time.Time
}

// CheckinHour is the local hour the check-in goes out for someone whose peak
// window opens at *peakStart, or the default when we don't know their rhythm.
func CheckinHour(peakStart *int) int {
	if peakStart == nil {
		return CheckinDefaultHour
	}
	h := *peakStart - CheckinPeakLeadHours
	if h < CheckinEarliestHour {
		return CheckinEarliestHour
	}
	if h > CheckinLatestHour {
		return CheckinLatestHour
	}
	return h
}

// CheckinMinute spreads users across the hour so a whole timezone isn't sent
// in the same minute. Stable per user, so their check-in time doesn't wander.
func CheckinMinute(userID primitive.ObjectID) int {
	h := fnv.New32a()
	_, _ = h.Write(userID[:])
	return int(h.Sum32() % 60)
}

// CheckinMinDays is the fewest local days between two check-ins.
func CheckinMinDays(frequency string, reduce bool) int {
	days := 2
	switch frequency {
	case "frequently":
		days = 1
	case "occasionally":
		days = 3
	}
	if reduce {
		days *= 2
	}
	return days
}

// activeSince reports whether the user did anything at or after t.
func (s CheckinState) activeSince(t time.Time) bool {
	return s.LastActiveAt != nil && !s.LastActiveAt.Before(t)
}

// lastWasIgnored reports whether the previous check-in got no response.
func (s CheckinState) lastWasIgnored() bool {
	return s.LastSentAt != nil && !s.activeSince(*s.LastSentAt)
}

// NextIgnoredInARow is the ledger value to store when sending a check-in now.
func (s CheckinState) NextIgnoredInARow() int {
	if s.lastWasIgnored() {
		return s.IgnoredInARow + 1
	}
	return 0
}

// EvaluateCheckin decides whether the user may get a check-in today, given
// that it is already their check-in slot. It doesn't pick the task; a user who
// passes still gets nothing if PickCheckinFocus finds nothing to name.
func EvaluateCheckin(s CheckinState, now time.Time, loc *time.Location) CheckinSkip {
	if s.Frequency == "none" {
		return CheckinSkipOff
	}
	if loc == nil {
		loc = time.UTC
	}
	local := now.In(loc)
	today := localMidnight(local)

	if s.LastSentAt != nil {
		sentDay := localMidnight(s.LastSentAt.In(loc))
		// Counted in calendar days, not hours, so a slot that drifts a few
		// minutes (or across DST) can't push a check-in out by a whole day.
		daysSince := int(today.Sub(sentDay).Hours()/24 + 0.5)
		if daysSince < CheckinMinDays(s.Frequency, s.ReduceFrequency) {
			return CheckinSkipTooSoon
		}
		if s.lastWasIgnored() && s.IgnoredInARow+1 >= CheckinIgnoredLimit {
			return CheckinSkipIgnored
		}
	}
	if s.activeSince(today) {
		return CheckinSkipActive
	}
	return CheckinSend
}

func localMidnight(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// CheckinFocusKind is why a task was chosen.
type CheckinFocusKind string

const (
	CheckinFocusDueToday CheckinFocusKind = "due_today"
	CheckinFocusPlanned  CheckinFocusKind = "planned_today"
)

// CheckinFocus is the one task a check-in names.
type CheckinFocus struct {
	TaskID     primitive.ObjectID
	CategoryID primitive.ObjectID
	Content    string
	Kind       CheckinFocusKind
}

// CheckinCandidate is an open task with the category it lives in.
type CheckinCandidate struct {
	Task       types.TaskDocument
	CategoryID primitive.ObjectID
}

// PickCheckinFocus chooses the task a check-in should name, or nil.
//
// Only tasks the user put on today themselves qualify: a deadline today, or a
// start date of today. Tasks that already have their own nudge are left out
// so nothing is said twice — a reminder still to fire today, a plan step
// (which carries its own reminder), or a start time (which starts a Live
// Activity). Someday, parked and released tasks are never named.
func PickCheckinFocus(candidates []CheckinCandidate, now time.Time, loc *time.Location) *CheckinFocus {
	if loc == nil {
		loc = time.UTC
	}
	today := localMidnight(now.In(loc))
	tomorrow := today.AddDate(0, 0, 1)
	isToday := func(t *time.Time) bool {
		return t != nil && !t.Before(today) && t.Before(tomorrow)
	}

	type ranked struct {
		focus    CheckinFocus
		rank     int
		priority int
		created  time.Time
	}
	var picks []ranked
	for _, c := range candidates {
		t := c.Task
		if t.ReleasedAt != nil || t.SomedayAt != nil || t.ParkedAt != nil || t.Plan != nil {
			continue
		}
		if hasReminderLeftToday(t.Reminders, now, tomorrow) {
			continue
		}
		var kind CheckinFocusKind
		rank := 0
		switch {
		case isToday(t.Deadline):
			kind, rank = CheckinFocusDueToday, 0
		case t.StartTime == nil && isToday(t.StartDate) && t.Timestamp.Before(today):
			// Created on an earlier day and moved onto today on purpose. A task
			// only dated today because that's the default for new tasks was
			// created today, and the user is active today anyway.
			kind, rank = CheckinFocusPlanned, 1
		default:
			continue
		}
		picks = append(picks, ranked{
			focus:    CheckinFocus{TaskID: t.ID, CategoryID: c.CategoryID, Content: t.Content, Kind: kind},
			rank:     rank,
			priority: t.Priority,
			created:  t.Timestamp,
		})
	}
	if len(picks) == 0 {
		return nil
	}
	sort.SliceStable(picks, func(i, j int) bool {
		if picks[i].rank != picks[j].rank {
			return picks[i].rank < picks[j].rank
		}
		if picks[i].priority != picks[j].priority {
			return picks[i].priority > picks[j].priority
		}
		return picks[i].created.Before(picks[j].created)
	})
	f := picks[0].focus
	return &f
}

func hasReminderLeftToday(reminders []*types.Reminder, now, tomorrow time.Time) bool {
	for _, r := range reminders {
		// A follow-up fires after the task is due to ask how it went; it isn't
		// a nudge to start, and nearly every dated task gets one.
		if r == nil || r.Type == FollowUpReminderType {
			continue
		}
		if !r.Sent && !r.TriggerTime.Before(now) && r.TriggerTime.Before(tomorrow) {
			return true
		}
	}
	return false
}

// CheckinMessage is the copy for a check-in about f. The task is the title so
// the notification says what it's about at a glance; the body is one light
// line with no counts and nothing about what's left undone.
func CheckinMessage(f CheckinFocus) (title, body string) {
	title = f.Content
	switch f.Kind {
	case CheckinFocusDueToday:
		body = "Due today. A few minutes on it is a good start."
	default:
		body = "You put this on today. Want to start it?"
	}
	return title, body
}
