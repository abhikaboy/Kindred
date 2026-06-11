package task

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// BuildTaggedUsers resolves raw user IDs to denormalized pending tag entries.
// Invalid or unknown IDs are skipped rather than failing the whole create.
func (s *Service) BuildTaggedUsers(userIDs []string) ([]types.TaggedTaskUser, error) {
	ctx := context.Background()
	tagged := make([]types.TaggedTaskUser, 0, len(userIDs))
	seen := make(map[primitive.ObjectID]bool)

	for _, raw := range userIDs {
		id, err := primitive.ObjectIDFromHex(raw)
		if err != nil {
			slog.Warn("Skipping invalid tagged user ID", "id", raw)
			continue
		}
		if seen[id] {
			continue
		}
		user, err := s.Users.GetUserByID(ctx, id)
		if err != nil || user == nil {
			slog.Warn("Skipping unknown tagged user", "id", raw)
			continue
		}
		seen[id] = true
		tagged = append(tagged, types.TaggedTaskUser{
			ID:             user.ID,
			Handle:         user.Handle,
			DisplayName:    user.DisplayName,
			ProfilePicture: user.ProfilePicture,
			Status:         types.TagStatusPending,
		})
	}
	return tagged, nil
}
