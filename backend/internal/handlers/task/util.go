package task

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// getBaseTime returns the appropriate base time for recurrence calculations
func getBaseTime(template *TemplateTaskDocument) time.Time {
	// baseTime := template.LastGenerated
	baseTime := xutils.NowUTC()
	if baseTime.IsZero() {
		if template.StartDate != nil {
			baseTime = xutils.ToUTC(*template.StartDate)
		} else if template.Deadline != nil {
			baseTime = xutils.ToUTC(*template.Deadline)
		} else {
			baseTime = xutils.NowUTC()
		}
	}
	return baseTime
}

// applyTimeToDate applies the time components from a source time to a target date
func applyTimeToDate(targetDate time.Time, sourceTime *time.Time, loc *time.Location) time.Time {
	if sourceTime == nil {
		return targetDate
	}

	if loc == nil {
		loc = time.UTC
	}

	// Convert targetDate to the target location
	targetInLoc := targetDate.In(loc)
	sourceInLoc := sourceTime.In(loc)

	return time.Date(
		targetInLoc.Year(),
		targetInLoc.Month(),
		targetInLoc.Day(),
		sourceInLoc.Hour(),
		sourceInLoc.Minute(),
		sourceInLoc.Second(),
		0,
		loc,
	).In(time.UTC)
}

// calculateNextRecurrence calculates the next recurrence date based on frequency
func (s *Service) calculateNextRecurrence(template *TemplateTaskDocument, baseTime time.Time, loc *time.Location) (time.Time, error) {
	if loc == nil {
		loc = time.UTC
	}

	// Convert baseTime to the user's timezone for calculation
	localBaseTime := baseTime.In(loc)
	var nextTime time.Time

	switch template.RecurFrequency {
	case "daily":
		nextTime = localBaseTime.AddDate(0, 0, template.RecurDetails.Every)

	case "weekly":
		nextTime = localBaseTime.AddDate(0, 0, 1)
		found := false
		for i := 0; i < 7; i++ {
			dayOfWeek := int(nextTime.Weekday())
			if template.RecurDetails.DaysOfWeek[dayOfWeek] == 1 {
				if nextTime.After(localBaseTime) {
					found = true
					break
				}
			}
			nextTime = nextTime.AddDate(0, 0, 1)
		}

		if !found {
			nextTime = localBaseTime.AddDate(0, 0, 7*template.RecurDetails.Every)
			// We need to find the correct day in the new week
			// Reset nextTime to start of that week and find the first valid day
			// For simplicity, we can just recurse (be careful with infinite recursion if logic is wrong, but here we advanced by 7 days)
			return s.calculateNextRecurrence(&TemplateTaskDocument{
				RecurType:      template.RecurType,
				RecurFrequency: template.RecurFrequency,
				RecurDetails:   template.RecurDetails,
				LastGenerated:  &nextTime, // This is just a placeholder passed back in, logic uses baseTime arg mostly but recursive call uses Updated struct? No wait.
			}, nextTime.In(time.UTC), loc) // Recursive call with updated baseTime in UTC
		}

	case "monthly":
		// Start with the current month
		nextTime = localBaseTime
		found := false

		// First try to find a valid day in the current month
		for _, day := range template.RecurDetails.DaysOfMonth {
			// Calculate last day of the month relative to nextTime
			lastDayOfMonth := time.Date(nextTime.Year(), nextTime.Month()+1, 0, 0, 0, 0, 0, loc).Day()
			targetDay := day
			if targetDay > lastDayOfMonth {
				targetDay = lastDayOfMonth
			}

			candidateTime := time.Date(nextTime.Year(), nextTime.Month(), targetDay, 0, 0, 0, 0, loc)
			// Need to make sure candidateTime preserves the time components if that's desired?
			// Usually recurrence just sets the date. Time is handled by applyTimeToDate later.
			// But wait, AddDate preserves time.
			// Here we are constructing a new Date at 00:00:00. Let's preserve the time from baseTime?
			candidateTime = time.Date(candidateTime.Year(), candidateTime.Month(), candidateTime.Day(),
				localBaseTime.Hour(), localBaseTime.Minute(), localBaseTime.Second(), localBaseTime.Nanosecond(), loc)

			if candidateTime.After(localBaseTime) {
				nextTime = candidateTime
				found = true
				break
			}
		}

		// If no valid day found in current month, move to next month
		if !found {
			// Move to next month (respecting 'Every')
			nextTime = localBaseTime.AddDate(0, template.RecurDetails.Every, 0)
			// Find the first valid day in that month
			// We can reuse the logic by calling recursively with the start of that month - 1 day?
			// Or just find the first valid day directly.
			foundInNext := false
			for _, day := range template.RecurDetails.DaysOfMonth {
				lastDayOfMonth := time.Date(nextTime.Year(), nextTime.Month()+1, 0, 0, 0, 0, 0, loc).Day()
				targetDay := day
				if targetDay > lastDayOfMonth {
					targetDay = lastDayOfMonth
				}
				candidateTime := time.Date(nextTime.Year(), nextTime.Month(), targetDay,
					localBaseTime.Hour(), localBaseTime.Minute(), localBaseTime.Second(), localBaseTime.Nanosecond(), loc)

				if candidateTime.After(localBaseTime) {
					nextTime = candidateTime
					foundInNext = true
					break
				}
			}
			if !foundInNext {
				// This shouldn't happen if DaysOfMonth has at least one valid day.
				// But if it does, we might need to advance another month.
				// For safety, let's just return error or fall back.
				// Simplest fallback: just add one month and try again (recursive)
				nextAttemptTime := localBaseTime.AddDate(0, 1, 0)
				return s.calculateNextRecurrence(template, nextAttemptTime.In(time.UTC), loc)
			}
		}

	case "yearly":
		nextTime = localBaseTime.AddDate(template.RecurDetails.Every, 0, 0)

	default:
		return time.Time{}, fmt.Errorf("invalid recurrence frequency: %s", template.RecurFrequency)
	}

	// Convert result back to UTC
	return nextTime.In(time.UTC), nil
}

func (s *Service) getUserLocation(ctx context.Context, userID primitive.ObjectID) (*time.Location, error) {
	var user types.User
	// We need to use FindOne here.
	err := s.Users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		slog.Error("Failed to fetch user for timezone", "userID", userID, "error", err)
		return time.UTC, nil // Default to UTC on error
	}

	if user.Timezone == "" {
		return time.UTC, nil
	}

	loc, err := time.LoadLocation(user.Timezone)
	if err != nil {
		slog.Error("Failed to load user location", "timezone", user.Timezone, "error", err)
		return time.UTC, nil
	}
	return loc, nil
}

// ComputeNextOccurrence calculates the next occurrence time for a recurring task
func (s *Service) ComputeNextOccurrence(template *TemplateTaskDocument) (time.Time, error) {
	if template.RecurType != "OCCURRENCE" {
		return time.Time{}, fmt.Errorf("invalid recurrence type: %s", template.RecurType)
	}

	ctx := context.Background()
	loc, _ := s.getUserLocation(ctx, template.UserID)

	baseTime := getBaseTime(template)
	nextTime, err := s.calculateNextRecurrence(template, baseTime, loc)
	if err != nil {
		return time.Time{}, err
	}

	return applyTimeToDate(nextTime, template.StartTime, loc), nil
}

// ComputeNextDeadline calculates the next deadline time for a recurring task
func (s *Service) ComputeNextDeadline(template *TemplateTaskDocument) (time.Time, error) {
	if template.RecurType != "DEADLINE" {
		return time.Time{}, fmt.Errorf("invalid recurrence type: %s", template.RecurType)
	}
	c := context.Background()
	loc, _ := s.getUserLocation(c, template.UserID)

	baseTime := getBaseTime(template)
	slog.LogAttrs(c, slog.LevelInfo, "Base time", slog.Time("baseTime", baseTime))
	nextTime, err := s.calculateNextRecurrence(template, baseTime, loc)
	slog.LogAttrs(c, slog.LevelInfo, "Next time", slog.Time("nextTime", nextTime))
	if err != nil {
		return time.Time{}, err
	}

	return applyTimeToDate(nextTime, template.Deadline, loc), nil
}

// PrintNextRecurrences prints the next 7 recurrences for a given template
func (s *Service) PrintNextRecurrences(template *TemplateTaskDocument) {
	c := context.Background()
	slog.LogAttrs(c, slog.LevelInfo, "Printing next 7 recurrences for template",
		slog.String("recurType", template.RecurType),
		slog.String("recurFrequency", template.RecurFrequency),
	)

	var nextTime time.Time
	var err error

	for i := 0; i < 7; i++ {
		if template.RecurType == "OCCURRENCE" {
			nextTime, err = s.ComputeNextOccurrence(template)
		} else if template.RecurType == "DEADLINE" {
			nextTime, err = s.ComputeNextDeadline(template)
		}

		if err != nil {
			slog.LogAttrs(c, slog.LevelError, "Error computing next recurrence",
				slog.String("error", err.Error()),
				slog.Int("attempt", i+1),
			)
			return
		}

		slog.LogAttrs(c, slog.LevelInfo, "Next recurrence",
			slog.Int("number", i+1),
			slog.Time("time", nextTime),
		)

		// Update the template's LastGenerated for the next iteration
		template.LastGenerated = &nextTime
	}
}

func constructTaskFromTemplate(templateDoc *TemplateTaskDocument) TaskDocument {
	return TaskDocument{
		ID:             primitive.NewObjectID(),
		UserID:         templateDoc.UserID,
		CategoryID:     templateDoc.CategoryID,
		Content:        templateDoc.Content,
		Value:          templateDoc.Value,
		Recurring:      true,
		RecurFrequency: templateDoc.RecurFrequency,
		Deadline:       templateDoc.Deadline,
		StartTime:      templateDoc.StartTime,
		StartDate:      templateDoc.StartDate,
		Priority:       templateDoc.Priority,
		Public:         templateDoc.Public,
		Active:         true,
		Timestamp:      xutils.NowUTC(),
		LastEdited:     xutils.NowUTC(),
		TemplateID:     &templateDoc.ID,
	}
}

func (h *Handler) HandleRecurringTaskCreation(c *fiber.Ctx, doc TaskDocument, params CreateTaskParams, categoryId primitive.ObjectID, deadline *time.Time, startTime *time.Time, startDate *time.Time, reminders []*Reminder) error {
	var template_id primitive.ObjectID = primitive.NewObjectID()
	if doc.Recurring {
		if params.RecurFrequency == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid recurring frequency",
			})
		}
		if params.RecurDetails == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Recurring details are required",
			})
		}

		recurType := "OCCURRENCE"

		// if we have a deadline with no start information
		if params.Deadline != nil {
			recurType = "DEADLINE"
			if params.StartTime != nil || params.StartDate != nil {
				recurType = "WINDOW"
			}
		}

		baseTime := xutils.NowUTC()
		if params.Deadline != nil {
			baseTime = *params.Deadline
		} else if params.StartTime != nil {
			baseTime = *params.StartTime
		}

		// filter out non relative reminders
		relativeReminders := make([]*Reminder, 0)
		for _, reminder := range reminders {
			if reminder.Type == "RELATIVE" {
				relativeReminders = append(relativeReminders, reminder)
			}
		}

		// Create a template for the recurring task
		template_doc := TemplateTaskDocument{
			UserID:         doc.UserID,
			CategoryID:     categoryId,
			ID:             template_id,
			Content:        params.Content,
			Priority:       params.Priority,
			Value:          params.Value,
			Public:         params.Public,
			RecurType:      recurType,
			RecurFrequency: params.RecurFrequency,
			RecurDetails:   params.RecurDetails,

			Deadline:      deadline,
			StartTime:     startTime,
			StartDate:     startDate,
			LastGenerated: &baseTime,
			Reminders:     relativeReminders,
		}
		var err error

		var nextOccurrence time.Time
		if recurType == "OCCURRENCE" {
			nextOccurrence, err = h.service.ComputeNextOccurrence(&template_doc)
			if err != nil {
				slog.LogAttrs(c.Context(), slog.LevelError, "Error creating OCCURRENCE template task", slog.String("error", err.Error()))
				return c.Status(fiber.StatusInternalServerError).JSON(err)
			}
		} else if recurType == "DEADLINE" {
			nextOccurrence, err = h.service.ComputeNextDeadline(&template_doc)
			if err != nil {
				slog.LogAttrs(c.Context(), slog.LevelError, "Error creating DEADLINE template task", slog.String("error", err.Error()))
				return c.Status(fiber.StatusInternalServerError).JSON(err)
			}
		} else if recurType == "WINDOW" {
			nextOccurrence, err = h.service.ComputeNextOccurrence(&template_doc)
			if err != nil {
				slog.LogAttrs(c.Context(), slog.LevelError, "Error creating WINDOW template task", slog.String("error", err.Error()))
				return c.Status(fiber.StatusInternalServerError).JSON(err)
			}
		}

		template_doc.NextGenerated = &nextOccurrence

		_, err = h.service.CreateTemplateTask(categoryId, &template_doc)
		if err != nil {
			slog.LogAttrs(c.Context(), slog.LevelError, "Error creating template task", slog.String("error", err.Error()))
			return c.Status(fiber.StatusInternalServerError).JSON(err)
		}

		doc.TemplateID = &template_id
	}

	return nil
}
