package foryou

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ForYouCardType enumerates the kinds of cards the For You feed can surface.
type ForYouCardType string

const (
	CardKudosReceived        ForYouCardType = "kudos_received"
	CardCommentReply         ForYouCardType = "comment_reply"
	CardFriendRequestsCount  ForYouCardType = "friend_requests_count"
	CardWeeklyRecap          ForYouCardType = "weekly_recap"
	CardReciprocityEncourage ForYouCardType = "reciprocity_encourage"
	CardReciprocityReact     ForYouCardType = "reciprocity_react"
	CardRingProgress         ForYouCardType = "ring_progress"
	CardPostPrompt           ForYouCardType = "post_prompt"
	CardBlueprintSuggestion  ForYouCardType = "blueprint_suggestion"
)

// ForYouIconKind controls the icon the client renders on a card.
type ForYouIconKind string

const (
	IconKudos     ForYouIconKind = "kudos"
	IconUsers     ForYouIconKind = "users"
	IconRing      ForYouIconKind = "ring"
	IconPost      ForYouIconKind = "post"
	IconComment   ForYouIconKind = "comment"
	IconBlueprint ForYouIconKind = "blueprint"
	IconRecap     ForYouIconKind = "recap"
)

// DisplayMode is the layout the client should use for a card.
type DisplayMode string

const (
	DisplayModeFull    DisplayMode = "full"
	DisplayModeCompact DisplayMode = "compact"
)

// Thresholds at which the server switches a user's card from full to compact.
// See docs/superpowers/specs/2026-05-31-for-you-tab-design.md.
const (
	CompactInteractionThreshold = 2
	CompactViewThreshold        = 5
)

// ForYouSubject is the human-visible "who" a card is about (when applicable).
type ForYouSubject struct {
	UserID      string `json:"userId" example:"507f1f77bcf86cd799439011"`
	DisplayName string `json:"displayName" example:"Sarah"`
	AvatarURL   string `json:"avatarUrl,omitempty" example:"https://example.com/avatar.jpg"`
}

// ForYouCtaAction is a tagged-union describing what a CTA does. Exactly one of
// the inner fields is non-zero for any given action.
type ForYouCtaAction struct {
	Type         string `json:"type" example:"navigate" doc:"navigate | send_kudos | send_encouragement | react"`
	Href         string `json:"href,omitempty" example:"/(logged-in)/(tabs)/(task)/kudos"`
	TargetUserID string `json:"targetUserId,omitempty"`
	ReferenceID  string `json:"referenceId,omitempty"`
	TaskID       string `json:"taskId,omitempty"`
	PostID       string `json:"postId,omitempty"`
	Reaction     string `json:"reaction,omitempty"`
}

// ForYouCta is a single button rendered on a card.
type ForYouCta struct {
	Label  string          `json:"label" example:"Send one back"`
	Kind   string          `json:"kind" example:"primary" doc:"primary | secondary"`
	Action ForYouCtaAction `json:"action"`
}

// ForYouCard is one row/card in the feed. The client never re-sorts; trust Priority.
type ForYouCard struct {
	ID          string         `json:"id"`
	Type        ForYouCardType `json:"type"`
	DisplayMode DisplayMode    `json:"displayMode"`
	IconKind    ForYouIconKind `json:"iconKind"`
	Title       string         `json:"title"`
	Body        string         `json:"body,omitempty" doc:"Present iff displayMode == full"`
	Subject     *ForYouSubject `json:"subject,omitempty"`
	Ctas        []ForYouCta    `json:"ctas"`
	DeepLink    string         `json:"deepLink" doc:"Tap-target for the entire card"`
	Priority    int            `json:"priority"`
}

// ForYouSection groups cards under a heading.
type ForYouSection struct {
	ID    string       `json:"id" example:"catch_up" doc:"catch_up | suggested"`
	Title string       `json:"title" example:"Catch up"`
	Cards []ForYouCard `json:"cards"`
}

// ForYouFeed is the top-level response payload.
type ForYouFeed struct {
	Sections    []ForYouSection `json:"sections"`
	UnreadCount int             `json:"unreadCount" doc:"Number of catch_up cards driving the tab dot"`
}

// ---------- Huma I/O types ----------

type GetForYouInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token"`
	RefreshToken  string `header:"refresh_token" required:"true" doc:"Refresh token"`
	Timezone      string `header:"X-Timezone" required:"false" doc:"IANA timezone, e.g. America/New_York"`
}

type GetForYouOutput struct {
	Body ForYouFeed `json:"body"`
}

type RecordInteractionInput struct {
	Authorization string                  `header:"Authorization" required:"true"`
	RefreshToken  string                  `header:"refresh_token" required:"true"`
	Body          RecordInteractionParams `json:"body"`
}

type RecordInteractionParams struct {
	CardType string `json:"cardType" validate:"required" example:"kudos_received" doc:"Card type the user interacted with"`
}

type RecordInteractionOutput struct {
	Body struct {
		Message string `json:"message" example:"Interaction recorded"`
	} `json:"body"`
}

// ---------- Internal storage types ----------

// ExposureDoc tracks how many times a user has seen and interacted with a card
// type. One document per (userID, cardType) — enforced by a unique compound
// index defined in storage/xmongo/indexes.go.
type ExposureDoc struct {
	ID               primitive.ObjectID `bson:"_id,omitempty"`
	UserID           primitive.ObjectID `bson:"user_id"`
	CardType         string             `bson:"card_type"`
	Views            int                `bson:"views"`
	Interactions     int                `bson:"interactions"`
	LastSeenAt       time.Time          `bson:"last_seen_at,omitempty"`
	LastInteractedAt time.Time          `bson:"last_interacted_at,omitempty"`
}
