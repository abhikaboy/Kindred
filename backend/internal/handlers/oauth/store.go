package oauth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	statusPending  = "pending"
	statusApproved = "approved"
	statusDenied   = "denied"
	statusExpired  = "expired"

	kindAccess  = "access"
	kindRefresh = "refresh"
)

var (
	errNotFound   = errors.New("not found")
	errNotPending = errors.New("request is no longer pending")
)

type requestDoc struct {
	ID               string              `bson:"_id"`
	UserCode         string              `bson:"user_code"`
	Status           string              `bson:"status"`
	Client           Client              `bson:"client"`
	ClientHost       string              `bson:"client_host"`
	RedirectURI      string              `bson:"redirect_uri"`
	State            string              `bson:"state"`
	CodeChallenge    string              `bson:"code_challenge"`
	Scopes           []string            `bson:"scopes"`
	Resource         string              `bson:"resource"`
	BindingHash      string              `bson:"binding_hash"`
	BrowserUserAgent string              `bson:"browser_user_agent"`
	BrowserIP        string              `bson:"browser_ip"`
	CreatedAt        time.Time           `bson:"created_at"`
	ExpiresAt        time.Time           `bson:"expires_at"`
	UserID           *primitive.ObjectID `bson:"user_id,omitempty"`
	ApprovedScopes   []string            `bson:"approved_scopes,omitempty"`
	GrantID          *primitive.ObjectID `bson:"grant_id,omitempty"`
	DecidedAt        *time.Time          `bson:"decided_at,omitempty"`
	CompletedAt      *time.Time          `bson:"completed_at,omitempty"`
}

// effectiveStatus folds expiry into the stored status.
func (r *requestDoc) effectiveStatus(now time.Time) string {
	if r.Status == statusPending && !now.Before(r.ExpiresAt) {
		return statusExpired
	}
	return r.Status
}

type grantDoc struct {
	ID         primitive.ObjectID `bson:"_id"`
	UserID     primitive.ObjectID `bson:"user_id"`
	ClientID   string             `bson:"client_id"`
	Client     Client             `bson:"client"`
	ClientHost string             `bson:"client_host"`
	Scopes     []string           `bson:"scopes"`
	CreatedAt  time.Time          `bson:"created_at"`
	UpdatedAt  time.Time          `bson:"updated_at"`
	LastUsedAt *time.Time         `bson:"last_used_at"`
	RevokedAt  *time.Time         `bson:"revoked_at"`
}

type codeDoc struct {
	ID            primitive.ObjectID `bson:"_id"`
	Hash          string             `bson:"code_hash"`
	RequestID     string             `bson:"request_id"`
	GrantID       primitive.ObjectID `bson:"grant_id"`
	UserID        primitive.ObjectID `bson:"user_id"`
	ClientID      string             `bson:"client_id"`
	RedirectURI   string             `bson:"redirect_uri"`
	CodeChallenge string             `bson:"code_challenge"`
	Resource      string             `bson:"resource"`
	Scopes        []string           `bson:"scopes"`
	CreatedAt     time.Time          `bson:"created_at"`
	ExpiresAt     time.Time          `bson:"expires_at"`
	UsedAt        *time.Time         `bson:"used_at"`
}

type tokenDoc struct {
	ID        primitive.ObjectID `bson:"_id"`
	Hash      string             `bson:"token_hash"`
	Kind      string             `bson:"kind"`
	GrantID   primitive.ObjectID `bson:"grant_id"`
	FamilyID  primitive.ObjectID `bson:"family_id"`
	UserID    primitive.ObjectID `bson:"user_id"`
	ClientID  string             `bson:"client_id"`
	Audience  string             `bson:"audience"`
	Scopes    []string           `bson:"scopes"`
	CreatedAt time.Time          `bson:"created_at"`
	ExpiresAt time.Time          `bson:"expires_at"`
	RotatedAt *time.Time         `bson:"rotated_at"`
}

func (s *Service) findRequest(ctx context.Context, id string) (*requestDoc, error) {
	if !requestIDWellFormed(id) {
		return nil, errNotFound
	}
	var doc requestDoc
	err := s.requests.FindOne(ctx, bson.M{"_id": id}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, errNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find request: %w", err)
	}
	return &doc, nil
}

func (s *Service) findPendingByCode(ctx context.Context, code string) (*requestDoc, error) {
	var doc requestDoc
	err := s.requests.FindOne(ctx, bson.M{
		"user_code": code,
		"status":    statusPending,
	}, options.FindOne().SetSort(bson.D{{Key: "expires_at", Value: -1}})).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, errNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find request by code: %w", err)
	}
	return &doc, nil
}

// insertRequest retries on a user code collision with another pending request.
func (s *Service) insertRequest(ctx context.Context, doc *requestDoc) error {
	for attempt := 0; ; attempt++ {
		code, err := newUserCode()
		if err != nil {
			return err
		}
		doc.UserCode = code
		_, err = s.requests.InsertOne(ctx, doc)
		if err == nil {
			return nil
		}
		if !mongo.IsDuplicateKeyError(err) || attempt >= 4 {
			return fmt.Errorf("insert request: %w", err)
		}
	}
}

// approveRequest binds a pending request to the user and upserts their grant for the client.
func (s *Service) approveRequest(ctx context.Context, req *requestDoc, userID primitive.ObjectID, scopes []string) error {
	now := s.now()
	res, err := s.requests.UpdateOne(ctx,
		bson.M{"_id": req.ID, "status": statusPending, "expires_at": bson.M{"$gt": now}},
		bson.M{"$set": bson.M{"status": statusApproved, "user_id": userID, "approved_scopes": scopes, "decided_at": now}},
	)
	if err != nil {
		return fmt.Errorf("approve request: %w", err)
	}
	if res.MatchedCount == 0 {
		return errNotPending
	}
	grant, err := s.upsertGrant(ctx, userID, &req.Client, req.ClientHost, scopes)
	if err != nil {
		return err
	}
	if _, err := s.requests.UpdateOne(ctx, bson.M{"_id": req.ID}, bson.M{"$set": bson.M{"grant_id": grant.ID}}); err != nil {
		return fmt.Errorf("link grant: %w", err)
	}
	return nil
}

func (s *Service) denyRequest(ctx context.Context, id string, userID *primitive.ObjectID) error {
	set := bson.M{"status": statusDenied, "decided_at": s.now()}
	if userID != nil {
		set["user_id"] = *userID
	}
	res, err := s.requests.UpdateOne(ctx, bson.M{"_id": id, "status": statusPending}, bson.M{"$set": set})
	if err != nil {
		return fmt.Errorf("deny request: %w", err)
	}
	if res.MatchedCount == 0 {
		return errNotPending
	}
	return nil
}

// upsertGrant keeps one grant per user and client; the latest approval sets its scopes.
func (s *Service) upsertGrant(ctx context.Context, userID primitive.ObjectID, client *Client, host string, scopes []string) (*grantDoc, error) {
	now := s.now()
	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)
	update := bson.M{
		"$set": bson.M{
			"client":      client,
			"client_host": host,
			"scopes":      scopes,
			"updated_at":  now,
			"revoked_at":  nil,
		},
		"$unset":       bson.M{"revoked_reason": ""},
		"$setOnInsert": bson.M{"_id": primitive.NewObjectID(), "created_at": now, "last_used_at": nil},
	}
	filter := bson.M{"user_id": userID, "client_id": client.ID}
	var grant grantDoc
	err := s.grants.FindOneAndUpdate(ctx, filter, update, opts).Decode(&grant)
	if mongo.IsDuplicateKeyError(err) {
		err = s.grants.FindOneAndUpdate(ctx, filter, update, opts).Decode(&grant)
	}
	if err != nil {
		return nil, fmt.Errorf("upsert grant: %w", err)
	}
	return &grant, nil
}

func (s *Service) activeGrant(ctx context.Context, id primitive.ObjectID) (*grantDoc, error) {
	var grant grantDoc
	err := s.grants.FindOne(ctx, bson.M{"_id": id, "revoked_at": nil}).Decode(&grant)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, errNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find grant: %w", err)
	}
	return &grant, nil
}

func (s *Service) listGrants(ctx context.Context, userID primitive.ObjectID) ([]grantDoc, error) {
	cursor, err := s.grants.Find(ctx, bson.M{"user_id": userID, "revoked_at": nil},
		options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}))
	if err != nil {
		return nil, fmt.Errorf("find grants: %w", err)
	}
	grants := []grantDoc{}
	if err := cursor.All(ctx, &grants); err != nil {
		return nil, fmt.Errorf("decode grants: %w", err)
	}
	return grants, nil
}

// revokeGrant marks the grant revoked and deletes every token and code issued under it.
func (s *Service) revokeGrant(ctx context.Context, filter bson.M, reason string) error {
	var grant grantDoc
	err := s.grants.FindOneAndUpdate(ctx, filter,
		bson.M{"$set": bson.M{"revoked_at": s.now(), "revoked_reason": reason}},
		options.FindOneAndUpdate().SetProjection(bson.M{"_id": 1}),
	).Decode(&grant)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return errNotFound
	}
	if err != nil {
		return fmt.Errorf("revoke grant: %w", err)
	}
	return s.deleteGrantTokens(ctx, grant.ID)
}

func (s *Service) deleteGrantTokens(ctx context.Context, grantID primitive.ObjectID) error {
	if _, err := s.tokens.DeleteMany(ctx, bson.M{"grant_id": grantID}); err != nil {
		return fmt.Errorf("delete grant tokens: %w", err)
	}
	if _, err := s.codes.DeleteMany(ctx, bson.M{"grant_id": grantID}); err != nil {
		return fmt.Errorf("delete grant codes: %w", err)
	}
	return nil
}

// RevokeAllForUser revokes every grant the user holds; intended for account deletion.
func (s *Service) RevokeAllForUser(ctx context.Context, userID primitive.ObjectID) error {
	if !s.Enabled() {
		return nil
	}
	grants, err := s.listGrants(ctx, userID)
	if err != nil {
		return err
	}
	for _, g := range grants {
		if err := s.revokeGrant(ctx, bson.M{"_id": g.ID}, "account_deleted"); err != nil && !errors.Is(err, errNotFound) {
			return err
		}
	}
	return nil
}

// issueCode mints a single-use authorization code for an approved request.
func (s *Service) issueCode(ctx context.Context, req *requestDoc) (string, error) {
	if req.GrantID == nil || req.UserID == nil {
		return "", errors.New("approved request has no grant")
	}
	raw, err := newSecret(codePrefix)
	if err != nil {
		return "", err
	}
	now := s.now()
	doc := codeDoc{
		ID:            primitive.NewObjectID(),
		Hash:          hashSecret(raw),
		RequestID:     req.ID,
		GrantID:       *req.GrantID,
		UserID:        *req.UserID,
		ClientID:      req.Client.ID,
		RedirectURI:   req.RedirectURI,
		CodeChallenge: req.CodeChallenge,
		Resource:      req.Resource,
		Scopes:        req.ApprovedScopes,
		CreatedAt:     now,
		ExpiresAt:     now.Add(codeTTL),
	}
	if _, err := s.codes.InsertOne(ctx, doc); err != nil {
		return "", fmt.Errorf("insert code: %w", err)
	}
	return raw, nil
}

type issuedTokens struct {
	Access    string
	Refresh   string
	ExpiresIn int
	Scopes    []string
}

func (s *Service) issueTokens(ctx context.Context, grantID, userID, familyID primitive.ObjectID, clientID, audience string, scopes []string) (*issuedTokens, error) {
	access, err := newSecret(accessTokenPrefix)
	if err != nil {
		return nil, err
	}
	refresh, err := newSecret(refreshTokenPrefix)
	if err != nil {
		return nil, err
	}
	now := s.now()
	base := tokenDoc{GrantID: grantID, FamilyID: familyID, UserID: userID, ClientID: clientID, Audience: audience, Scopes: scopes, CreatedAt: now}
	at, rt := base, base
	at.ID, at.Hash, at.Kind, at.ExpiresAt = primitive.NewObjectID(), hashSecret(access), kindAccess, now.Add(accessTokenTTL)
	rt.ID, rt.Hash, rt.Kind, rt.ExpiresAt = primitive.NewObjectID(), hashSecret(refresh), kindRefresh, now.Add(refreshTokenIdleTTL)
	if _, err := s.tokens.InsertMany(ctx, []any{at, rt}); err != nil {
		return nil, fmt.Errorf("insert tokens: %w", err)
	}
	return &issuedTokens{Access: access, Refresh: refresh, ExpiresIn: int(accessTokenTTL / time.Second), Scopes: scopes}, nil
}

// VerifyAccessToken resolves a kdr_at_ token to the connection it belongs to.
func (s *Service) VerifyAccessToken(ctx context.Context, raw string) (*Principal, error) {
	if !s.Enabled() || !secretWellFormed(raw, accessTokenPrefix) {
		return nil, ErrInvalidToken
	}
	var tok tokenDoc
	err := s.tokens.FindOne(ctx, bson.M{"token_hash": hashSecret(raw), "kind": kindAccess}).Decode(&tok)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrInvalidToken
	}
	if err != nil {
		return nil, fmt.Errorf("lookup access token: %w", err)
	}
	now := s.now()
	if !now.Before(tok.ExpiresAt) || !constantTimeEqual(tok.Audience, s.ResourceURL()) {
		return nil, ErrInvalidToken
	}
	grant, err := s.activeGrant(ctx, tok.GrantID)
	if errors.Is(err, errNotFound) {
		return nil, ErrInvalidToken
	}
	if err != nil {
		return nil, err
	}
	scopes := intersectScopes(tok.Scopes, grant.Scopes)
	if len(scopes) == 0 {
		return nil, ErrInvalidToken
	}
	s.touchGrant(ctx, grant.ID, now)
	return &Principal{
		UserID:       grant.UserID,
		ConnectionID: grant.ID,
		Kind:         "oauth",
		ClientID:     grant.ClientID,
		ClientName:   grant.Client.Name,
		Scopes:       scopes,
		ExpiresAt:    tok.ExpiresAt,
	}, nil
}

// touchGrant updates last_used_at at most once a minute per grant per process.
func (s *Service) touchGrant(ctx context.Context, grantID primitive.ObjectID, now time.Time) {
	s.touchMu.Lock()
	last, ok := s.touched[grantID]
	if ok && now.Sub(last) < lastUsedThrottle {
		s.touchMu.Unlock()
		return
	}
	if len(s.touched) >= rateLimiterPruneSize {
		s.touched = map[primitive.ObjectID]time.Time{}
	}
	s.touched[grantID] = now
	s.touchMu.Unlock()

	go func() {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if _, err := s.grants.UpdateOne(ctx, bson.M{"_id": grantID}, bson.M{"$set": bson.M{"last_used_at": now}}); err != nil {
			slog.Warn("mcp oauth: unable to touch grant", "grantId", grantID.Hex(), "error", err)
		}
	}()
}
