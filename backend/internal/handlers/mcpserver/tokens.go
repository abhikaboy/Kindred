package mcpserver

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	tokensCollection = "mcp_tokens"
	tokenPrefix      = "kdr_"
	tokenBytes       = 32
	displayPrefixLen = 12
	maxTokensPerUser = 10
	maxTokenNameLen  = 64
)

var (
	ErrInvalidToken   = errors.New("invalid token")
	ErrTokenLimit     = errors.New("token limit reached")
	ErrTokenNotFound  = errors.New("token not found")
	encodedTokenBytes = base64.RawURLEncoding.EncodedLen(tokenBytes)
)

// TokenDocument is a personal access token as stored; the raw token is never persisted.
type TokenDocument struct {
	ID         primitive.ObjectID `bson:"_id"`
	UserID     primitive.ObjectID `bson:"user_id"`
	Name       string             `bson:"name"`
	TokenHash  string             `bson:"token_hash"`
	Prefix     string             `bson:"prefix"`
	CreatedAt  time.Time          `bson:"created_at"`
	LastUsedAt *time.Time         `bson:"last_used_at"`
}

type TokenService struct {
	tokens *mongo.Collection
}

func NewTokenService(collections map[string]*mongo.Collection) *TokenService {
	coll := collections[tokensCollection]
	if coll == nil && collections["users"] != nil {
		coll = collections["users"].Database().Collection(tokensCollection)
	}
	return &TokenService{tokens: coll}
}

func generateToken() (string, error) {
	buf := make([]byte, tokenBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return tokenPrefix + base64.RawURLEncoding.EncodeToString(buf), nil
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func tokenWellFormed(raw string) bool {
	return strings.HasPrefix(raw, tokenPrefix) && len(raw) == len(tokenPrefix)+encodedTokenBytes
}

// Create mints a token for the user and returns the raw value alongside the stored metadata.
func (s *TokenService) Create(ctx context.Context, userID primitive.ObjectID, name string) (string, *TokenDocument, error) {
	count, err := s.tokens.CountDocuments(ctx, bson.M{"user_id": userID})
	if err != nil {
		return "", nil, fmt.Errorf("count tokens: %w", err)
	}
	if count >= maxTokensPerUser {
		return "", nil, ErrTokenLimit
	}

	raw, err := generateToken()
	if err != nil {
		return "", nil, err
	}
	doc := &TokenDocument{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		Name:      name,
		TokenHash: hashToken(raw),
		Prefix:    raw[:displayPrefixLen],
		CreatedAt: time.Now().UTC(),
	}
	if _, err := s.tokens.InsertOne(ctx, doc); err != nil {
		return "", nil, fmt.Errorf("insert token: %w", err)
	}
	return raw, doc, nil
}

func (s *TokenService) List(ctx context.Context, userID primitive.ObjectID) ([]TokenDocument, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetProjection(bson.M{"token_hash": 0})
	cursor, err := s.tokens.Find(ctx, bson.M{"user_id": userID}, opts)
	if err != nil {
		return nil, fmt.Errorf("find tokens: %w", err)
	}
	docs := []TokenDocument{}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decode tokens: %w", err)
	}
	return docs, nil
}

// Revoke deletes the token only if it belongs to userID.
func (s *TokenService) Revoke(ctx context.Context, userID, tokenID primitive.ObjectID) error {
	res, err := s.tokens.DeleteOne(ctx, bson.M{"_id": tokenID, "user_id": userID})
	if err != nil {
		return fmt.Errorf("delete token: %w", err)
	}
	if res.DeletedCount == 0 {
		return ErrTokenNotFound
	}
	return nil
}

// Authenticate resolves a raw bearer token to its owning user, updating last_used_at.
func (s *TokenService) Authenticate(ctx context.Context, raw string) (primitive.ObjectID, error) {
	raw = strings.TrimSpace(raw)
	if !tokenWellFormed(raw) {
		return primitive.NilObjectID, ErrInvalidToken
	}

	var doc TokenDocument
	err := s.tokens.FindOneAndUpdate(ctx,
		bson.M{"token_hash": hashToken(raw)},
		bson.M{"$set": bson.M{"last_used_at": time.Now().UTC()}},
		options.FindOneAndUpdate().SetProjection(bson.M{"user_id": 1}),
	).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return primitive.NilObjectID, ErrInvalidToken
	}
	if err != nil {
		return primitive.NilObjectID, fmt.Errorf("lookup token: %w", err)
	}
	return doc.UserID, nil
}
