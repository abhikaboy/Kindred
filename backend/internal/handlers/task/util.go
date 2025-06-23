package task

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/xutils"
	"github.com/gofiber/fiber/v2"
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
func applyTimeToDate(targetDate time.Time, sourceTime *time.Time) time.Time {
	if sourceTime == nil {
		return targetDate
	}

	return time.Date(
		targetDate.Year(),
		targetDate.Month(),
		targetDate.Day(),
		sourceTime.Hour(),
		sourceTime.Minute(),
		sourceTime.Second(),
		0,
		targetDate.Location(),
	)
}

// calculateNextRecurrence calculates the next recurrence date based on frequency
func (s *Service) calculateNextRecurrence(template *TemplateTaskDocument, baseTime time.Time) (time.Time, error) {
	var nextTime time.Time
	switch template.RecurFrequency {
	case "daily":
		nextTime = baseTime.AddDate(0, 0, template.RecurDetails.Every)

	case "weekly":
		nextTime = baseTime.AddDate(0, 0, 1)
		found := false
		for i := 0; i < 7; i++ {
			dayOfWeek := int(nextTime.Weekday())
			if template.RecurDetails.DaysOfWeek[dayOfWeek] == 1 {
				if nextTime.After(baseTime) {
					found = true
					break
				}
			}
			nextTime = nextTime.AddDate(0, 0, 1)
		}

		if !found {
			nextTime = baseTime.AddDate(0, 0, 7*template.RecurDetails.Every)
			return s.calculateNextRecurrence(&TemplateTaskDocument{
				RecurType:      template.RecurType,
				RecurFrequency: template.RecurFrequency,
				RecurDetails:   template.RecurDetails,
				LastGenerated:  &nextTime,
			}, nextTime)
		}

	case "monthly":
		// Start with the current month
		nextTime = baseTime
		found := false

		// First try to find a valid day in the current month
		for _, day := range template.RecurDetails.DaysOfMonth {
			lastDayOfMonth := time.Date(nextTime.Year(), nextTime.Month()+1, 0, 0, 0, 0, 0, nextTime.Location()).Day()
			targetDay := day
			if targetDay > lastDayOfMonth {
				targetDay = lastDayOfMonth
			}

			candidateTime := time.Date(nextTime.Year(), nextTime.Month(), targetDay, 0, 0, 0, 0, nextTime.Location())
			if candidateTime.After(baseTime) {
				nextTime = candidateTime
				found = true
				break
			}
		}

		// If no valid day found in current month, move to next month
		if !found {
			nextTime = time.Date(baseTime.Year(), baseTime.Month()+time.Month(template.RecurDetails.Every), 1, 0, 0, 0, 0, baseTime.Location())
			return s.calculateNextRecurrence(&TemplateTaskDocument{
				RecurType:      template.RecurType,
				RecurFrequency: template.RecurFrequency,
				RecurDetails:   template.RecurDetails,
				LastGenerated:  &nextTime,
			}, nextTime)
		}

	case "yearly":
		nextTime = baseTime.AddDate(template.RecurDetails.Every, 0, 0)

	default:
		return time.Time{}, fmt.Errorf("invalid recurrence frequency: %s", template.RecurFrequency)
	}

	return nextTime, nil
}

// ComputeNextOccurrence calculates the next occurrence time for a recurring task
func (s *Service) ComputeNextOccurrence(template *TemplateTaskDocument) (time.Time, error) {
	if template.RecurType != "OCCURRENCE" {
		return time.Time{}, fmt.Errorf("invalid recurrence type: %s", template.RecurType)
	}

	baseTime := getBaseTime(template)
	nextTime, err := s.calculateNextRecurrence(template, baseTime)
	if err != nil {
		return time.Time{}, err
	}

	return applyTimeToDate(nextTime, template.StartTime), nil
}

// ComputeNextDeadline calculates the next deadline time for a recurring task
func (s *Service) ComputeNextDeadline(template *TemplateTaskDocument) (time.Time, error) {
	if template.RecurType != "DEADLINE" {
		return time.Time{}, fmt.Errorf("invalid recurrence type: %s", template.RecurType)
	}
	c := context.Background()

	baseTime := getBaseTime(template)
	slog.LogAttrs(c, slog.LevelInfo, "Base time", slog.Time("baseTime", baseTime))
	nextTime, err := s.calculateNextRecurrence(template, baseTime)
	slog.LogAttrs(c, slog.LevelInfo, "Next time", slog.Time("nextTime", nextTime))
	if err != nil {
		return time.Time{}, err
	}

	return applyTimeToDate(nextTime, template.Deadline), nil
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

		var next_occurence time.Time
		if recurType == "OCCURRENCE" {
			next_occurence, err = h.service.ComputeNextOccurrence(&template_doc)
			if err != nil {
				slog.LogAttrs(c.Context(), slog.LevelError, "Error creating OCCURENCE template task", slog.String("error", err.Error()))
				return c.Status(fiber.StatusInternalServerError).JSON(err)
			}
		} else if recurType == "DEADLINE" {
			next_occurence, err = h.service.ComputeNextDeadline(&template_doc)
			if err != nil {
				slog.LogAttrs(c.Context(), slog.LevelError, "Error creating DEADLINE template task", slog.String("error", err.Error()))
				return c.Status(fiber.StatusInternalServerError).JSON(err)
			}
		} else if recurType == "WINDOW" {
			next_occurence, err = h.service.ComputeNextOccurrence(&template_doc)
			if err != nil {
				slog.LogAttrs(c.Context(), slog.LevelError, "Error creating WINDOW template task", slog.String("error", err.Error()))
				return c.Status(fiber.StatusInternalServerError).JSON(err)
			}
		}

		template_doc.NextGenerated = &next_occurence

		_, err = h.service.CreateTemplateTask(categoryId, &template_doc)
		if err != nil {
			slog.LogAttrs(c.Context(), slog.LevelError, "Error creating template task", slog.String("error", err.Error()))
			return c.Status(fiber.StatusInternalServerError).JSON(err)
		}

		doc.TemplateID = &template_id
	}

	return nil
}
