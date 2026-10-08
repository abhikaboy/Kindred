package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// The send-otp endpoint is public and every call costs real money, which makes it
// a target for SMS pumping fraud (bots texting premium-rate numbers). smsGuard
// sits in front of Sinch and refuses anything outside tight, durable limits.

const verifyWindow = 15 * time.Minute

// NANP area codes that are not the US or Canada. They share +1 but bill as
// international and are the most common pumping destinations.
var blockedNANPAreaCodes = map[string]bool{
	"242": true, "246": true, "264": true, "268": true, "284": true, "345": true,
	"441": true, "473": true, "649": true, "658": true, "664": true, "721": true,
	"758": true, "767": true, "784": true, "809": true, "829": true, "849": true,
	"868": true, "869": true, "876": true,
}

var (
	errSMSUnsupportedNumber = errors.New("unsupported phone number")
	errSMSRateLimited       = errors.New("rate limited")
	errSMSDailyCap          = errors.New("daily sms cap reached")
)

// counterStore increments a fixed-window counter and returns the new count.
type counterStore interface {
	Incr(ctx context.Context, key string, window time.Duration) (int, error)
}

type smsGuard struct {
	store counterStore
	cfg   config.SMSGuard
	now   func() time.Time
}

func newSMSGuard(store counterStore, cfg config.SMSGuard) *smsGuard {
	return &smsGuard{store: store, cfg: cfg, now: time.Now}
}

// smsPhonePolicy normalizes phone to E.164 and rejects numbers we won't text.
func smsPhonePolicy(phone string, allowed []string) (string, error) {
	e164 := xutils.NormalizeE164(phone)
	if e164 == "" {
		return "", errSMSUnsupportedNumber
	}
	digits := strings.TrimPrefix(e164, "+")

	allowedCode := ""
	for _, code := range allowed {
		code = strings.TrimPrefix(strings.TrimSpace(code), "+")
		if code != "" && strings.HasPrefix(digits, code) {
			allowedCode = code
			break
		}
	}
	if allowedCode == "" {
		return "", errSMSUnsupportedNumber
	}

	if allowedCode == "1" {
		// NANP: 1 + area code [2-9]XX + exchange [2-9]XX + 4 digits.
		national := digits[1:]
		if len(national) != 10 || national[0] < '2' || national[3] < '2' {
			return "", errSMSUnsupportedNumber
		}
		if blockedNANPAreaCodes[national[:3]] {
			return "", errSMSUnsupportedNumber
		}
	}
	return e164, nil
}

type limit struct {
	key    string
	max    int
	window time.Duration
}

// check increments every limit and fails on the first one exceeded. Store errors
// fail closed, since letting a send through blind is what costs money.
func (g *smsGuard) check(ctx context.Context, limits []limit) error {
	for _, l := range limits {
		if l.max <= 0 {
			continue
		}
		count, err := g.store.Incr(ctx, l.key, l.window)
		if err != nil {
			return fmt.Errorf("sms guard store: %w", err)
		}
		if count > l.max {
			return fmt.Errorf("%w: %s", errSMSRateLimited, l.key)
		}
	}
	return nil
}

// AllowSend validates the number and charges every send limit. It returns the
// normalized number to send to.
func (g *smsGuard) AllowSend(ctx context.Context, phone, ip string) (string, error) {
	e164, err := smsPhonePolicy(phone, g.cfg.AllowedCountryCodes)
	if err != nil {
		return "", err
	}

	limits := []limit{
		{"send:phone:cooldown:" + e164, 1, time.Duration(g.cfg.PhoneCooldownSeconds) * time.Second},
		{"send:phone:hour:" + e164, g.cfg.PhonePerHour, time.Hour},
		{"send:phone:day:" + e164, g.cfg.PhonePerDay, 24 * time.Hour},
	}
	if ip != "" {
		limits = append(limits,
			limit{"send:ip:hour:" + ip, g.cfg.IPPerHour, time.Hour},
			limit{"send:ip:day:" + ip, g.cfg.IPPerDay, 24 * time.Hour},
		)
	}
	if err := g.check(ctx, limits); err != nil {
		return "", err
	}

	// Global cap last, so requests rejected above don't eat the shared budget.
	if err := g.check(ctx, []limit{{"send:global:day", g.cfg.DailyCap, 24 * time.Hour}}); err != nil {
		if errors.Is(err, errSMSRateLimited) {
			return "", errSMSDailyCap
		}
		return "", err
	}
	return e164, nil
}

// AllowVerify bounds code guesses per number so 4-digit codes can't be brute forced.
func (g *smsGuard) AllowVerify(ctx context.Context, phone string) error {
	key := xutils.NormalizeE164(phone)
	if key == "" {
		key = phone
	}
	return g.check(ctx, []limit{{"verify:phone:" + key, g.cfg.VerifyAttemptsPerWindow, verifyWindow}})
}

// smsGuardError maps guard failures to responses the clients show as-is.
func smsGuardError(ctx context.Context, err error, phone, ip string) error {
	switch {
	case errors.Is(err, errSMSUnsupportedNumber):
		slog.WarnContext(ctx, "SMS refused: unsupported number", "phone", phone, "ip", ip)
		return huma.Error400BadRequest("We can only text US and Canadian numbers right now.")
	case errors.Is(err, errSMSDailyCap):
		slog.ErrorContext(ctx, "SMS daily cap reached; refusing sends", "phone", phone, "ip", ip)
		return huma.Error503ServiceUnavailable("Text verification is paused for today. Try signing in with Google or Apple.")
	case errors.Is(err, errSMSRateLimited):
		slog.WarnContext(ctx, "SMS rate limit hit", "phone", phone, "ip", ip, "limit", err.Error())
		return huma.Error429TooManyRequests("Too many attempts. Wait a bit before trying again.")
	default:
		slog.ErrorContext(ctx, "SMS guard unavailable; refusing", "error", err)
		return huma.Error503ServiceUnavailable("Text verification is temporarily unavailable. Please try again shortly.")
	}
}

// mongoCounterStore keeps fixed-window counters in sms_limits; a TTL index on
// expires_at cleans up old windows.
type mongoCounterStore struct {
	coll *mongo.Collection
	now  func() time.Time
}

func newMongoCounterStore(coll *mongo.Collection) *mongoCounterStore {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := coll.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "expires_at", Value: 1}},
		Options: options.Index().SetName("expires_at_ttl").SetExpireAfterSeconds(0),
	})
	if err != nil {
		slog.Error("Failed to ensure sms_limits TTL index", "error", err)
	}
	return &mongoCounterStore{coll: coll, now: time.Now}
}

func (m *mongoCounterStore) Incr(ctx context.Context, key string, window time.Duration) (int, error) {
	now := m.now()
	start := now.Truncate(window)
	id := fmt.Sprintf("%s:%d", key, start.Unix())

	var doc struct {
		Count int `bson:"count"`
	}
	err := m.coll.FindOneAndUpdate(ctx,
		bson.M{"_id": id},
		bson.M{
			"$inc":         bson.M{"count": 1},
			"$setOnInsert": bson.M{"expires_at": start.Add(window)},
		},
		options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After),
	).Decode(&doc)
	if err != nil {
		return 0, err
	}
	return doc.Count, nil
}
