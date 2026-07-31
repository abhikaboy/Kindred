// Package friendship tracks a per-pair friendship score. The score lives as a
// single `score` field on the existing friend-requests document (one doc per
// pair), so there is no new collection and no new index. $inc creates the field
// on legacy documents.
package friendship

import (
	"context"
	"log/slog"

	Connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Point values. Keep in sync with shared/friendship.ts.
const (
	PointsKudos    = 3
	PointsComment  = 2
	PointsReaction = 1
)

// levelFloors is the score at which each level starts. Keep in sync with shared/friendship.ts.
var levelFloors = []int{0, 25, 75, 150, 300}

// Delta is returned to clients so they can show brief confirmation feedback.
type Delta struct {
	Score     int  `json:"score" example:"28" doc:"Pair friendship score after the bump"`
	Delta     int  `json:"delta" example:"3" doc:"Points this action added"`
	LeveledUp bool `json:"leveledUp" example:"false" doc:"Whether this bump crossed into a new level"`
}

type Service struct {
	Connections *mongo.Collection
}

func New(collections map[string]*mongo.Collection) *Service {
	return &Service{Connections: collections["friend-requests"]}
}

// LevelFor returns the 1-based level for a score.
func LevelFor(score int) int {
	level := 1
	for i := 1; i < len(levelFloors); i++ {
		if score >= levelFloors[i] {
			level = i + 1
		}
	}
	return level
}

// Bump atomically increments the pair's score. Best-effort: returns nil (never an
// error) if the users aren't friends, the collection is missing, a == b, or the
// write fails. Callers must tolerate nil.
func (s *Service) Bump(ctx context.Context, a, b primitive.ObjectID, delta int) *Delta {
	if s == nil || s.Connections == nil || a == b {
		return nil
	}

	// ponytail: decode only the field we need instead of the whole connection doc.
	var updated struct {
		Score int `bson:"score"`
	}
	err := s.Connections.FindOneAndUpdate(
		ctx,
		bson.M{"users": Connection.SortUserIDs(a, b), "status": Connection.StatusFriends},
		bson.M{"$inc": bson.M{"score": delta}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&updated)
	if err != nil {
		// Not friends is normal, not an error worth logging.
		if err != mongo.ErrNoDocuments {
			slog.Error("Failed to bump friendship score", "error", err, "user_a", a.Hex(), "user_b", b.Hex())
		}
		return nil
	}

	return &Delta{
		Score:     updated.Score,
		Delta:     delta,
		LeveledUp: LevelFor(updated.Score) > LevelFor(updated.Score-delta),
	}
}
