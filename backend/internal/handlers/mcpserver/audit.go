package mcpserver

import (
	"context"
	"fmt"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/oauth"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	auditCollection = "mcp_audit"
	maxSummaryLen   = 200
	maxAuditError   = 300
)

// AuditEntry is one create or complete tool call made by a connected agent.
type AuditEntry struct {
	ID           primitive.ObjectID   `bson:"_id"`
	UserID       primitive.ObjectID   `bson:"user_id"`
	ConnectionID primitive.ObjectID   `bson:"connection_id"`
	Kind         string               `bson:"kind"`
	ClientID     string               `bson:"client_id,omitempty"`
	ClientName   string               `bson:"client_name,omitempty"`
	Tool         string               `bson:"tool"`
	TargetIDs    []primitive.ObjectID `bson:"target_ids,omitempty"`
	Summary      string               `bson:"summary"`
	OK           bool                 `bson:"ok"`
	Error        string               `bson:"error,omitempty"`
	CreatedAt    time.Time            `bson:"created_at"`
}

// AuditLog stores agent write activity and answers the daily-cap counts from it.
type AuditLog struct {
	coll *mongo.Collection
}

func NewAuditLog(collections map[string]*mongo.Collection) *AuditLog {
	coll := collections[auditCollection]
	if coll == nil && collections["users"] != nil {
		coll = collections["users"].Database().Collection(auditCollection)
	}
	return &AuditLog{coll: coll}
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-3]) + "..."
}

func (a *AuditLog) Record(ctx context.Context, p *oauth.Principal, tool string, targets []primitive.ObjectID, summary string, callErr error) error {
	if a == nil || a.coll == nil {
		return nil
	}
	e := AuditEntry{
		ID:           primitive.NewObjectID(),
		UserID:       p.UserID,
		ConnectionID: p.ConnectionID,
		Kind:         p.Kind,
		ClientID:     p.ClientID,
		ClientName:   p.ClientName,
		Tool:         tool,
		TargetIDs:    targets,
		Summary:      truncate(summary, maxSummaryLen),
		OK:           callErr == nil,
		CreatedAt:    time.Now().UTC(),
	}
	if callErr != nil {
		e.Error = truncate(callErr.Error(), maxAuditError)
	}
	if _, err := a.coll.InsertOne(ctx, e); err != nil {
		return fmt.Errorf("insert audit entry: %w", err)
	}
	return nil
}

// CountSince counts successful calls of the given tools on a connection since t.
func (a *AuditLog) CountSince(ctx context.Context, connectionID primitive.ObjectID, tools []string, t time.Time) (int64, error) {
	if a == nil || a.coll == nil {
		return 0, nil
	}
	return a.coll.CountDocuments(ctx, bson.M{
		"connection_id": connectionID,
		"tool":          bson.M{"$in": tools},
		"ok":            true,
		"created_at":    bson.M{"$gte": t},
	})
}

// Recent lists the user's newest entries, optionally for one connection.
func (a *AuditLog) Recent(ctx context.Context, userID primitive.ObjectID, connectionID *primitive.ObjectID, limit int) ([]AuditEntry, error) {
	filter := bson.M{"user_id": userID}
	if connectionID != nil {
		filter["connection_id"] = *connectionID
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}, {Key: "_id", Value: -1}}).SetLimit(int64(limit))
	cursor, err := a.coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("find audit entries: %w", err)
	}
	out := []AuditEntry{}
	if err := cursor.All(ctx, &out); err != nil {
		return nil, fmt.Errorf("decode audit entries: %w", err)
	}
	return out, nil
}
