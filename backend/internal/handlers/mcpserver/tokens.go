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

	"github.com/abhikaboy/Kindred/internal/handlers/oauth"
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
	maxTokenDays     = 365
)

var (
	ErrInvalidToken   = errors.New("invalid token")
	ErrTokenLimit     = errors.New("token limit reached")
	ErrTokenNotFound  = errors.New("token not found")
	ErrInvalidScopes  = errors.New("invalid scopes")
	ErrInvalidExpiry  = errors.New("invalid expiry")
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
	// Scopes is nil on tokens minted before scopes existed; those grant every scope.
	Scopes    []string   `bson:"scopes,omitempty"`
	ExpiresAt *time.Time `bson:"expires_at,omitempty"`
}

// EffectiveScopes is the scope set the token grants.
func (d *TokenDocument) EffectiveScopes() []string {
	if len(d.Scopes) == 0 {
		return oauth.AllScopes()
	}
	return d.Scopes
}

// TokenOptions narrows a new token. Zero values mean every scope and no expiry.
type TokenOptions struct {
	Scopes        []string
	ExpiresInDays int
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

// normalizeScopes validates requested scopes, returning them deduplicated in canonical order.
func normalizeScopes(requested []string) ([]string, error) {
	if requested == nil {
		return oauth.AllScopes(), nil
	}
	want := make(map[string]bool, len(requested))
	for _, sc := range requested {
		want[strings.TrimSpace(sc)] = true
	}
	var out []string
	for _, sc := range oauth.AllScopes() {
		if want[sc] {
			out = append(out, sc)
			delete(want, sc)
		}
	}
	if len(out) == 0 || len(want) > 0 {
		return nil, ErrInvalidScopes
	}
	return out, nil
}

// Create mints a token for the user and returns the raw value alongside the stored metadata.
func (s *TokenService) Create(ctx context.Context, userID primitive.ObjectID, name string, opts TokenOptions) (string, *TokenDocument, error) {
	scopes, err := normalizeScopes(opts.Scopes)
	if err != nil {
		return "", nil, err
	}
	if opts.ExpiresInDays < 0 || opts.ExpiresInDays > maxTokenDays {
		return "", nil, ErrInvalidExpiry
	}
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
		Scopes:    scopes,
	}
	if opts.ExpiresInDays > 0 {
		exp := doc.CreatedAt.AddDate(0, 0, opts.ExpiresInDays)
		doc.ExpiresAt = &exp
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
	p, err := s.AuthenticatePrincipal(ctx, raw)
	if err != nil {
		return primitive.NilObjectID, err
	}
	return p.UserID, nil
}

// AuthenticatePrincipal resolves a live (unexpired, unrevoked) token to the principal it acts as.
func (s *TokenService) AuthenticatePrincipal(ctx context.Context, raw string) (*oauth.Principal, error) {
	raw = strings.TrimSpace(raw)
	if !tokenWellFormed(raw) {
		return nil, ErrInvalidToken
	}

	now := time.Now().UTC()
	var doc TokenDocument
	err := s.tokens.FindOneAndUpdate(ctx,
		bson.M{
			"token_hash": hashToken(raw),
			"$or":        bson.A{bson.M{"expires_at": nil}, bson.M{"expires_at": bson.M{"$gt": now}}},
		},
		bson.M{"$set": bson.M{"last_used_at": now}},
		options.FindOneAndUpdate().SetProjection(bson.M{"token_hash": 0}),
	).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrInvalidToken
	}
	if err != nil {
		return nil, fmt.Errorf("lookup token: %w", err)
	}
	p := &oauth.Principal{
		UserID:       doc.UserID,
		ConnectionID: doc.ID,
		Kind:         "pat",
		ClientName:   doc.Name,
		Scopes:       doc.EffectiveScopes(),
	}
	if doc.ExpiresAt != nil {
		p.ExpiresAt = *doc.ExpiresAt
	}
	return p, nil
}
