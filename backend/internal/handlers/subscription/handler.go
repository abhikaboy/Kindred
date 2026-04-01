package subscription

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Handler struct {
	users  *mongo.Collection
	config config.Config
}

func NewHandler(users *mongo.Collection, cfg config.Config) *Handler {
	return &Handler{users: users, config: cfg}
}

const (
	EventInitialPurchase    = "INITIAL_PURCHASE"
	EventRenewal            = "RENEWAL"
	EventCancellation       = "CANCELLATION"
	EventUncancellation     = "UNCANCELLATION"
	EventExpiration         = "EXPIRATION"
	EventBillingIssue       = "BILLING_ISSUE_DETECTED"
	EventSubscriberAlias    = "SUBSCRIBER_ALIAS"
	EventProductChange      = "PRODUCT_CHANGE"
	EventTransferredEvent   = "TRANSFER"
	EventSubscriptionPaused = "SUBSCRIPTION_PAUSED"
)

// RevenueCatEvent represents a single event from the RevenueCat webhook payload.
type RevenueCatEvent struct {
	Type                     string   `json:"type"`
	ID                       string   `json:"id"`
	AppUserID                string   `json:"app_user_id"`
	OriginalAppUserID        string   `json:"original_app_user_id"`
	ProductID                string   `json:"product_id"`
	EntitlementIDs           []string `json:"entitlement_ids"`
	PeriodType               string   `json:"period_type"`
	PurchasedAtMs            int64    `json:"purchased_at_ms"`
	ExpirationAtMs           *int64   `json:"expiration_at_ms"`
	Store                    string   `json:"store"`
	Environment              string   `json:"environment"`
	IsFamilyShare            bool     `json:"is_family_share"`
	PriceInPurchasedCurrency float64  `json:"price_in_purchased_currency"`
	Currency                 string   `json:"currency"`
	OriginalTransactionID    string   `json:"original_transaction_id"`
}

type WebhookEvent struct {
	Body struct {
		APIVersion string          `json:"api_version"`
		Event      RevenueCatEvent `json:"event"`
	}
}

type SubscriptionWebhookOutput struct {
	Body struct {
		Status string `json:"status"`
	}
}

func webhookOK() *SubscriptionWebhookOutput {
	return &SubscriptionWebhookOutput{Body: struct {
		Status string `json:"status"`
	}{Status: "ok"}}
}

func (h *Handler) HandleWebhook(ctx context.Context, input *WebhookEvent) (*SubscriptionWebhookOutput, error) {
	event := input.Body.Event
	slog.Info("RevenueCat webhook received",
		"type", event.Type,
		"user_id", event.AppUserID,
		"product_id", event.ProductID,
		"store", event.Store,
		"environment", event.Environment,
	)

	userID, err := primitive.ObjectIDFromHex(event.AppUserID)
	if err != nil {
		userID, err = primitive.ObjectIDFromHex(event.OriginalAppUserID)
		if err != nil {
			slog.Error("Invalid user ID in webhook",
				"app_user_id", event.AppUserID,
				"original_app_user_id", event.OriginalAppUserID,
			)
			return webhookOK(), nil
		}
	}

	provider := mapStoreToProvider(event.Store)
	tier := mapProductToTier(event.ProductID)

	switch event.Type {
	case EventInitialPurchase, EventProductChange:
		err = h.handlePurchase(ctx, userID, tier, provider, event)
	case EventRenewal:
		err = h.handleRenewal(ctx, userID, event)
	case EventCancellation:
		err = h.handleCancellation(ctx, userID, event)
	case EventUncancellation:
		err = h.handleUncancellation(ctx, userID)
	case EventExpiration:
		err = h.handleExpiration(ctx, userID)
	case EventBillingIssue:
		slog.Warn("Billing issue detected", "user_id", userID.Hex())
	default:
		slog.Info("Unhandled webhook event type", "type", event.Type)
	}

	if err != nil {
		slog.Error("Error handling webhook event", "type", event.Type, "error", err)
		return nil, huma.Error500InternalServerError(fmt.Sprintf("Failed to handle event: %v", err))
	}

	return webhookOK(), nil
}

func (h *Handler) handlePurchase(
	ctx context.Context,
	userID primitive.ObjectID,
	tier types.SubscriptionTier,
	provider types.SubscriptionProvider,
	event RevenueCatEvent,
) error {
	sub := types.Subscription{
		Tier:           tier,
		Status:         types.StatusActive,
		StartDate:      time.UnixMilli(event.PurchasedAtMs),
		Provider:       provider,
		SubscriptionID: event.OriginalTransactionID,
	}

	if event.ExpirationAtMs != nil {
		exp := time.UnixMilli(*event.ExpirationAtMs)
		sub.EndDate = &exp
		sub.RenewalDate = &exp
	}

	if tier == types.TierLifetime {
		sub.RenewalDate = nil
		sub.EndDate = nil
	}

	if event.PeriodType == "TRIAL" {
		sub.Status = types.StatusTrial
	}

	slog.Info("Processing purchase",
		"user_id", userID.Hex(),
		"tier", tier,
		"provider", provider,
	)

	return types.UpdateSubscription(ctx, h.users, userID, sub)
}

func (h *Handler) handleRenewal(ctx context.Context, userID primitive.ObjectID, event RevenueCatEvent) error {
	update := bson.M{
		"subscription.status":     types.StatusActive,
		"subscription.canceledAt": nil,
	}

	if event.ExpirationAtMs != nil {
		exp := time.UnixMilli(*event.ExpirationAtMs)
		update["subscription.renewalDate"] = exp
		update["subscription.endDate"] = exp
	}

	_, err := h.users.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{"$set": update},
	)
	return err
}

func (h *Handler) handleCancellation(ctx context.Context, userID primitive.ObjectID, event RevenueCatEvent) error {
	now := time.Now()
	update := bson.M{
		"subscription.status":     types.StatusCanceled,
		"subscription.canceledAt": now,
	}

	if event.ExpirationAtMs != nil {
		exp := time.UnixMilli(*event.ExpirationAtMs)
		update["subscription.endDate"] = exp
	}

	_, err := h.users.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{"$set": update},
	)
	return err
}

func (h *Handler) handleUncancellation(ctx context.Context, userID primitive.ObjectID) error {
	_, err := h.users.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{
			"$set":   bson.M{"subscription.status": types.StatusActive},
			"$unset": bson.M{"subscription.canceledAt": ""},
		},
	)
	return err
}

func (h *Handler) handleExpiration(ctx context.Context, userID primitive.ObjectID) error {
	return types.ExpireSubscription(ctx, h.users, userID)
}

func mapStoreToProvider(store string) types.SubscriptionProvider {
	switch store {
	case "APP_STORE":
		return types.ProviderApple
	case "PLAY_STORE":
		return types.ProviderGoogle
	case "STRIPE":
		return types.ProviderStripe
	default:
		return types.ProviderApple
	}
}

func mapProductToTier(productID string) types.SubscriptionTier {
	switch productID {
	case "monthly", "yearly":
		return types.TierPremium
	case "lifetime":
		return types.TierLifetime
	default:
		return types.TierPremium
	}
}
