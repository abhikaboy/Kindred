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
			Title:   "You've been tagged",
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
