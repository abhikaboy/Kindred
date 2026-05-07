package task

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/xutils"
	"github.com/getsentry/sentry-go"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// createFlexTemplateForTask creates a FLEX-type template for a recurring flex task.
func (s *Service) createFlexTemplateForTask(
	userID primitive.ObjectID,
	categoryID primitive.ObjectID,
	templateID primitive.ObjectID,
	content string,
	priority int,
	value float64,
	public bool,
	recurDetails *RecurDetails,
	notes string,
	checklist []ChecklistItem,
) error {
	flex := recurDetails.Flex

	strategy, err := FlexPeriodFor(flex.Period)
	if err != nil {
		return fmt.Errorf("invalid flex period %q: %w", flex.Period, err)
	}

	ctx := context.Background()
	loc, _ := s.getUserLocation(ctx, userID)
	now := xutils.NowUTC()
	periodStart := strategy.PeriodStart(now, loc)

	templateDoc := TemplateTaskDocument{
		ID:             templateID,
		UserID:         userID,
		CategoryID:     categoryID,
		Content:        content,
		Priority:       priority,
		Value:          value,
		Public:         public,
		RecurType:      "FLEX",
		RecurFrequency: flex.Period,
		RecurDetails:   recurDetails,
		LastGenerated:  &now,
		NextGenerated:  &now,
		Notes:          notes,
		Checklist:      checklist,
		FlexState: &FlexTemplateState{
			Target:            flex.Target,
			Period:            flex.Period,
			CompletedInPeriod: 0,
			PeriodStart:       &periodStart,
		},
		TimesGenerated:  0,
		TimesCompleted:  0,
		TimesMissed:     0,
		Streak:          0,
		HighestStreak:   0,
		CompletionDates: []time.Time{},
	}

	_, err = s.CreateTemplateTask(categoryID, &templateDoc)
	if err != nil {
		return fmt.Errorf("error creating flex template task: %w", err)
	}

	return nil
}

func (s *Service) createFlexTaskFromTemplate(ctx context.Context, templateDoc *TemplateTaskDocument, task TaskDocument) (*TaskDocument, error) {
	if templateDoc.FlexState == nil {
		err := fmt.Errorf("FlexState is nil for FLEX template %s", templateDoc.ID.Hex())
		sentry.CaptureException(err)
		return nil, err
	}

	strategy, err := FlexPeriodFor(templateDoc.FlexState.Period)
	if err != nil {
		sentry.CaptureException(fmt.Errorf("invalid flex period for template %s: %w", templateDoc.ID.Hex(), err))
		return nil, err
	}

	loc, err := s.getUserLocation(ctx, templateDoc.UserID)
	if err != nil {
		sentry.CaptureMessage(fmt.Sprintf("Failed to load timezone for user %s on template %s: %v", templateDoc.UserID.Hex(), templateDoc.ID.Hex(), err))
	}
	now := xutils.NowUTC()
	currentPeriodStart := strategy.PeriodStart(now, loc)

	// Detect period rollover
	periodRolled := templateDoc.FlexState.PeriodStart == nil ||
		currentPeriodStart.After(*templateDoc.FlexState.PeriodStart)

	if periodRolled {
		// Track missed instances from the previous period
		if templateDoc.FlexState.PeriodStart != nil {
			missed := templateDoc.FlexState.Target - templateDoc.FlexState.CompletedInPeriod
			if missed > 0 {
				_, err := s.TemplateTasks.UpdateOne(ctx, bson.M{"_id": templateDoc.ID}, bson.M{
					"$inc": bson.M{"timesMissed": missed},
					"$set": bson.M{
						"streak":         0,
						"previousStreak": templateDoc.Streak,
						"lastMissedAt":   &now,
					},
				})
				if err != nil {
					slog.Error("Failed to update missed flex stats", "error", err)
					sentry.CaptureException(fmt.Errorf("failed to update missed flex stats for template %s: %w", templateDoc.ID.Hex(), err))
				}
			}
		}
		templateDoc.FlexState.CompletedInPeriod = 0
		templateDoc.FlexState.PeriodStart = &currentPeriodStart
	}

	// Delete any existing active flex instance for this template
	_, _ = s.DeleteTaskFromTemplateID(*templateDoc)

	// Set FlexInfo on the task instance
	task.FlexInfo = &FlexInstanceInfo{
		InstanceNumber: templateDoc.FlexState.CompletedInPeriod + 1,
		Target:         templateDoc.FlexState.Target,
		Period:         templateDoc.FlexState.Period,
	}

	nextPeriod := strategy.NextPeriodStart(now, loc)

	update := bson.M{
		"$set": bson.M{
			"lastGenerated":               &now,
			"nextGenerated":               &nextPeriod,
			"flexState.completedInPeriod": templateDoc.FlexState.CompletedInPeriod,
			"flexState.periodStart":       templateDoc.FlexState.PeriodStart,
			"flexState.cooldownUntil":     nil,
		},
		"$inc": bson.M{
			"timesGenerated": 1,
		},
	}

	_, err = s.TemplateTasks.UpdateOne(ctx, bson.M{"_id": templateDoc.ID}, update)
	if err != nil {
		sentry.CaptureException(fmt.Errorf("failed to update flex template %s: %w", templateDoc.ID.Hex(), err))
		return nil, err
	}

	// Push the task into the user's category
	_, err = s.Tasks.UpdateOne(ctx,
		bson.M{"_id": templateDoc.CategoryID},
		bson.M{"$push": bson.M{"tasks": task}},
	)
	if err != nil {
		sentry.CaptureException(fmt.Errorf("failed to push flex task into category %s: %w", templateDoc.CategoryID.Hex(), err))
		return nil, err
	}

	return &task, nil
}

func (s *Service) handleFlexCompletion(ctx context.Context, template *TemplateTaskDocument) (*NextFlexTaskInfo, error) {
	if template.FlexState == nil {
		err := fmt.Errorf("FlexState is nil for FLEX template %s during completion", template.ID.Hex())
		sentry.CaptureException(err)
		return nil, err
	}

	strategy, err := FlexPeriodFor(template.FlexState.Period)
	if err != nil {
		sentry.CaptureException(fmt.Errorf("invalid flex period for template %s: %w", template.ID.Hex(), err))
		return nil, err
	}

	loc, err := s.getUserLocation(ctx, template.UserID)
	if err != nil {
		sentry.CaptureMessage(fmt.Sprintf("Failed to load timezone for user %s on template %s: %v", template.UserID.Hex(), template.ID.Hex(), err))
	}
	now := xutils.NowUTC()
	newCompleted := template.FlexState.CompletedInPeriod + 1

	if newCompleted >= template.FlexState.Target {
		// All instances completed for this period — schedule next period
		nextPeriod := strategy.NextPeriodStart(now, loc)
		update := bson.M{
			"flexState.completedInPeriod": newCompleted,
			"nextGenerated":               nextPeriod,
			"flexState.cooldownUntil":     nil,
		}
		_, err = s.TemplateTasks.UpdateOne(ctx, bson.M{"_id": template.ID}, bson.M{"$set": update})
		if err != nil {
			sentry.CaptureException(fmt.Errorf("failed to update flex completion for template %s: %w", template.ID.Hex(), err))
		}
		return nil, err
	}

	// Target not yet reached — update completedInPeriod then spawn next instance inline
	_, err = s.TemplateTasks.UpdateOne(ctx, bson.M{"_id": template.ID}, bson.M{
		"$set": bson.M{
			"flexState.completedInPeriod": newCompleted,
		},
	})
	if err != nil {
		sentry.CaptureException(fmt.Errorf("failed to update flex completedInPeriod for template %s: %w", template.ID.Hex(), err))
		return nil, err
	}

	// Re-fetch the template to get updated state for createFlexTaskFromTemplate
	updatedTemplate, err := s.GetTemplateByID(template.ID)
	if err != nil {
		sentry.CaptureException(fmt.Errorf("failed to re-fetch template %s after flex completion: %w", template.ID.Hex(), err))
		return nil, err
	}

	newTask, err := s.CreateTaskFromTemplate(updatedTemplate.ID)
	if err != nil {
		slog.Error("Failed to inline-spawn next flex instance, cron will pick it up",
			"error", err, "templateID", template.ID.Hex())
		// Fall back to cooldown — cron will handle it
		cooldown := strategy.ComputeCooldown(now, loc)
		s.TemplateTasks.UpdateOne(ctx, bson.M{"_id": template.ID}, bson.M{
			"$set": bson.M{
				"nextGenerated":           cooldown,
				"flexState.cooldownUntil": cooldown,
			},
		})
		return nil, nil // Don't fail the completion
	}

	return &NextFlexTaskInfo{
		Task:       *newTask,
		CategoryID: updatedTemplate.CategoryID.Hex(),
	}, nil
}
