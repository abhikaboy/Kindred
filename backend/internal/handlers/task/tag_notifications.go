package task

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// NotifyTaggedUsers sends a push + creates a TASK_TAGGED notification record
// for every pending tagged user on the task. Best-effort: failures are logged,
// never returned, so they can't fail task creation.
func (s *Service) NotifyTaggedUsers(task *TaskDocument, taggerID primitive.ObjectID) {
	ctx := context.Background()

	tagger, err := s.Users.GetUserByID(ctx, taggerID)
	if err != nil || tagger == nil {
		slog.Error("NotifyTaggedUsers: failed to load tagger", "error", err)
		return
	}

	for _, tu := range task.TaggedUsers {
		if tu.Status != types.TagStatusPending {
			continue
		}

		// DB record (drives the activity tab)
		content := fmt.Sprintf("tagged you in \"%s\"", task.Content)
		if err := s.NotificationService.CreateNotification(
			taggerID, tu.ID, content, notifications.NotificationTypeTaskTagged, task.ID,
		); err != nil {
			slog.Error("Failed to create TASK_TAGGED record", "receiver", tu.ID, "error", err)
		}

		// Push
		receiver, err := s.Users.GetUserByID(ctx, tu.ID)
		if err != nil || receiver == nil || receiver.PushToken == "" {
			continue
		}
		notification := xutils.Notification{
			Token:   receiver.PushToken,
			Title:   "You've been tagged 👀",
			Message: fmt.Sprintf("%s tagged you in \"%s\"", tagger.DisplayName, task.Content),
			Data: map[string]string{
				"type":      "task_tagged",
				"task_id":   task.ID.Hex(),
				"user_id":   taggerID.Hex(),
				"task_name": task.Content,
			},
		}
		if err := xutils.SendNotification(notification); err != nil {
			slog.Error("Failed to send task_tagged push", "receiver", tu.ID, "error", err)
		}
	}
}

// notifyTaskCopied tells the task owner that a tagged friend copied the task.
// Push + TASK_COPIED record; best-effort.
func (s *Service) notifyTaskCopied(taskID, ownerID, copierID primitive.ObjectID, taskName string) {
	ctx := context.Background()

	copier, err := s.Users.GetUserByID(ctx, copierID)
	if err != nil || copier == nil {
		return
	}

	content := fmt.Sprintf("copied your task \"%s\" 💪", taskName)
	if err := s.NotificationService.CreateNotification(
		copierID, ownerID, content, notifications.NotificationTypeTaskCopied, taskID,
	); err != nil {
		slog.Error("Failed to create TASK_COPIED record", "owner", ownerID, "error", err)
	}

	owner, err := s.Users.GetUserByID(ctx, ownerID)
	if err != nil || owner == nil || owner.PushToken == "" {
		return
	}
	_ = xutils.SendNotification(xutils.Notification{
		Token:   owner.PushToken,
		Title:   "Your task caught on 💪",
		Message: fmt.Sprintf("%s copied your task \"%s\"", copier.DisplayName, taskName),
		Data: map[string]string{
			"type":    "task_copied",
			"task_id": taskID.Hex(),
			"user_id": copierID.Hex(),
		},
	})
}
