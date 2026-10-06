package Profile

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	Connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/sync/errgroup"
)

const (
	maxFriendActivityIDs   = 200
	friendOpenTasksCap     = 4
	friendCompletedTaskCap = 3
	// Wide enough to cover "today" in any timezone; the client narrows it to its local day
	friendCompletedWindow = 36 * time.Hour
	friendRingConcurrency = 8
)

// FriendActivity is the slice of a friend's profile the friends page renders.
type FriendActivity struct {
	UserID         string               `json:"user_id"`
	Tasks          []types.TaskDocument `json:"tasks"`
	CompletedTasks []types.TaskDocument `json:"completed_tasks"`
	RingState      *rings.RingState     `json:"ring_state,omitempty"`
}

type GetFriendsActivityInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	Body          struct {
		UserIDs []string `json:"user_ids" doc:"Friend user IDs to load activity for" maxItems:"200"`
	}
}

type GetFriendsActivityOutput struct {
	Body struct {
		Friends []FriendActivity `json:"friends"`
	}
}

func RegisterGetFriendsActivityOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-friends-activity",
		Method:      http.MethodPost,
		Path:        "/v1/user/friends/activity",
		Summary:     "Get friends activity",
		Description: "Returns open tasks, today's completions and ring state for the given friends in one response. Non-friends are omitted.",
		Tags:        []string{"profiles"},
	}, handler.GetFriendsActivity)
}

func (h *Handler) GetFriendsActivity(ctx context.Context, input *GetFriendsActivityInput) (*GetFriendsActivityOutput, error) {
	authUserID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}
	userID, err := primitive.ObjectIDFromHex(authUserID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}
	ids, err := parseUserIDs(input.Body.UserIDs, maxFriendActivityIDs)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user IDs", err)
	}

	friends, err := h.service.FilterFriends(ctx, userID, ids)
	if err != nil {
		slog.Error("Failed to filter friends", "error", err)
		return nil, huma.Error500InternalServerError("Unable to load friends. Please try again.", err)
	}

	out := &GetFriendsActivityOutput{}
	out.Body.Friends = []FriendActivity{}
	if len(friends) == 0 {
		return out, nil
	}

	var (
		open      map[primitive.ObjectID][]types.TaskDocument
		completed map[primitive.ObjectID][]types.TaskDocument
	)
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() (err error) {
		open, err = h.service.GetFriendsOpenTasks(gctx, friends, friendOpenTasksCap)
		return err
	})
	g.Go(func() (err error) {
		completed, err = h.service.GetFriendsRecentCompletedTasks(gctx, friends, time.Now().Add(-friendCompletedWindow), friendCompletedTaskCap)
		return err
	})
	// Ring state is best-effort, same as the single-profile endpoint
	timezone := auth.GetTimezoneOrDefault(ctx)
	ringStates := make([]*rings.RingState, len(friends))
	sem := make(chan struct{}, friendRingConcurrency)
	for i, id := range friends {
		g.Go(func() error {
			sem <- struct{}{}
			defer func() { <-sem }()
			state, err := h.ringService.GetOrCreateToday(gctx, id, timezone)
			if err != nil {
				slog.Error("Failed to get ring state for friend", "friendId", id.Hex(), "error", err)
				return nil
			}
			ringStates[i] = state
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		slog.Error("Failed to load friends activity", "count", len(friends), "error", err)
		return nil, huma.Error500InternalServerError("Unable to load friends activity. Please try again.", err)
	}

	for i, id := range friends {
		out.Body.Friends = append(out.Body.Friends, FriendActivity{
			UserID:         id.Hex(),
			Tasks:          nonNilTasks(open[id]),
			CompletedTasks: nonNilTasks(completed[id]),
			RingState:      ringStates[i],
		})
	}
	return out, nil
}

func nonNilTasks(tasks []types.TaskDocument) []types.TaskDocument {
	if tasks == nil {
		return []types.TaskDocument{}
	}
	return tasks
}

// FilterFriends keeps only the IDs the user has an accepted friendship with, in one query.
func (s *Service) FilterFriends(ctx context.Context, userID primitive.ObjectID, ids []primitive.ObjectID) ([]primitive.ObjectID, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	cursor, err := s.Connections.Find(ctx, bson.M{
		"users":  bson.M{"$all": bson.A{userID}, "$in": ids},
		"status": Connection.StatusFriends,
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var conns []Connection.ConnectionDocumentInternal
	if err := cursor.All(ctx, &conns); err != nil {
		return nil, err
	}
	isFriend := make(map[primitive.ObjectID]bool, len(conns))
	for _, c := range conns {
		for _, u := range c.Users {
			if u != userID {
				isFriend[u] = true
			}
		}
	}
	friends := make([]primitive.ObjectID, 0, len(conns))
	for _, id := range ids {
		if isFriend[id] {
			friends = append(friends, id)
		}
	}
	return friends, nil
}

type userTasks struct {
	User  primitive.ObjectID   `bson:"_id"`
	Tasks []types.TaskDocument `bson:"tasks"`
}

func aggregateTasksByUser(ctx context.Context, coll *mongo.Collection, pipeline bson.A) (map[primitive.ObjectID][]types.TaskDocument, error) {
	cursor, err := coll.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var groups []userTasks
	if err := cursor.All(ctx, &groups); err != nil {
		return nil, err
	}
	out := make(map[primitive.ObjectID][]types.TaskDocument, len(groups))
	for _, g := range groups {
		out[g.User] = g.Tasks
	}
	return out, nil
}

// GetFriendsOpenTasks returns each user's public open tasks, in-progress ones first, capped per user.
func (s *Service) GetFriendsOpenTasks(ctx context.Context, users []primitive.ObjectID, perUser int) (map[primitive.ObjectID][]types.TaskDocument, error) {
	pipeline := bson.A{
		bson.M{"$match": bson.M{"user": bson.M{"$in": users}}},
		bson.M{"$unwind": "$tasks"},
		bson.M{"$match": bson.M{"tasks.public": true, "tasks.releasedAt": nil}},
		bson.M{"$addFields": bson.M{"_working": bson.M{"$cond": bson.A{
			bson.M{"$or": bson.A{
				bson.M{"$ifNull": bson.A{"$tasks.workingOnSince", false}},
				bson.M{"$eq": bson.A{"$tasks.active", true}},
			}}, 0, 1,
		}}}},
		bson.M{"$sort": bson.D{{Key: "_working", Value: 1}, {Key: "tasks.timestamp", Value: -1}}},
		bson.M{"$group": bson.M{"_id": "$user", "tasks": bson.M{"$push": "$tasks"}}},
		bson.M{"$project": bson.M{"tasks": bson.M{"$slice": bson.A{"$tasks", perUser}}}},
	}
	return aggregateTasksByUser(ctx, s.Tasks, pipeline)
}

// GetFriendsRecentCompletedTasks returns each user's newest public completions since `since`, capped per user.
func (s *Service) GetFriendsRecentCompletedTasks(ctx context.Context, users []primitive.ObjectID, since time.Time, perUser int) (map[primitive.ObjectID][]types.TaskDocument, error) {
	pipeline := bson.A{
		bson.M{"$match": bson.M{"user": bson.M{"$in": users}, "public": true, "timeCompleted": bson.M{"$gte": since}}},
		bson.M{"$sort": bson.D{{Key: "timeCompleted", Value: -1}}},
		bson.M{"$group": bson.M{"_id": "$user", "tasks": bson.M{"$push": "$$ROOT"}}},
		bson.M{"$project": bson.M{"tasks": bson.M{"$slice": bson.A{"$tasks", perUser}}}},
	}
	return aggregateTasksByUser(ctx, s.CompletedTasks, pipeline)
}
