package foryou

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Section IDs and titles are returned verbatim to the client.
const (
	sectionCatchUp   = "catch_up"
	sectionSuggested = "suggested"
)

// Service assembles the For You feed from existing data sources and tracks
// per-(user, card_type) exposure so that the educational layer can be dropped
// once the user has interacted with a feature a few times.
type Service struct {
	Encouragements *mongo.Collection
	Posts          *mongo.Collection
	Users          *mongo.Collection
	Notifications  *mongo.Collection
	Connections    *mongo.Collection
	RingStates     *mongo.Collection
	Exposures      *mongo.Collection
	RingService    *rings.RingService
}

func newService(collections map[string]*mongo.Collection, ringService *rings.RingService) *Service {
	if collections["for_you_exposures"] == nil {
		slog.Warn("for_you_exposures collection missing; exposure tracking disabled")
	}
	return &Service{
		Encouragements: collections["encouragements"],
		Posts:          collections["posts"],
		Users:          collections["users"],
		Notifications:  collections["notifications"],
		Connections:    collections["friend-requests"],
		RingStates:     collections["ring_states"],
		Exposures:      collections["for_you_exposures"],
		RingService:    ringService,
	}
}

// GetForYou returns the assembled feed for a user. Cards within each section
// are sorted by Priority descending; the client never re-sorts.
func (s *Service) GetForYou(ctx context.Context, userID primitive.ObjectID, timezone string) (*ForYouFeed, error) {
	if timezone == "" {
		timezone = "UTC"
	}

	exposures, err := s.loadExposures(ctx, userID)
	if err != nil {
		slog.Warn("failed to load For You exposures; falling back to full mode", "userId", userID.Hex(), "error", err)
		exposures = map[string]ExposureDoc{}
	}

	// Initialize as empty slices (not nil) so JSON marshaling produces `[]`
	// rather than `null`. The frontend contract expects an array, and a null
	// `cards` field crashes the renderer.
	catchUp := []ForYouCard{}
	suggested := []ForYouCard{}

	if cards := s.buildKudosReceivedCards(ctx, userID, exposures); len(cards) > 0 {
		catchUp = append(catchUp, cards...)
	}
	if cards := s.buildCommentReplyCards(ctx, userID, exposures); len(cards) > 0 {
		catchUp = append(catchUp, cards...)
	}
	if card := s.buildFriendRequestsCountCard(ctx, userID, exposures); card != nil {
		catchUp = append(catchUp, *card)
	}
	if card := s.buildWeeklyRecapCard(ctx, userID, exposures); card != nil {
		// Always last in Catch up; gives a path into Activity even when nothing
		// actionable is happening.
		catchUp = append(catchUp, *card)
	}
	if card := s.buildRingProgressCard(ctx, userID, timezone, exposures); card != nil {
		suggested = append(suggested, *card)
	}
	if card := s.buildPostPromptCard(ctx, userID, exposures); card != nil {
		suggested = append(suggested, *card)
	}

	sortByPriority(catchUp)
	sortByPriority(suggested)

	s.recordViews(ctx, userID, allCardTypes(catchUp, suggested))

	return &ForYouFeed{
		Sections: []ForYouSection{
			{ID: sectionCatchUp, Title: "Catch up", Cards: catchUp},
			{ID: sectionSuggested, Title: "Suggested for you", Cards: suggested},
		},
		UnreadCount: len(catchUp),
	}, nil
}

// RecordInteraction is called by the client when the user taps a CTA. It
// counts toward the threshold that flips a card type to compact mode.
func (s *Service) RecordInteraction(ctx context.Context, userID primitive.ObjectID, cardType string) error {
	if s.Exposures == nil {
		return nil
	}
	_, err := s.Exposures.UpdateOne(
		ctx,
		bson.M{"user_id": userID, "card_type": cardType},
		bson.M{
			"$inc": bson.M{"interactions": 1},
			"$set": bson.M{"last_interacted_at": time.Now()},
			"$setOnInsert": bson.M{
				"user_id":   userID,
				"card_type": cardType,
			},
		},
		options.Update().SetUpsert(true),
	)
	return err
}

// ---------- Card builders ----------

func (s *Service) buildKudosReceivedCards(ctx context.Context, userID primitive.ObjectID, exposures map[string]ExposureDoc) []ForYouCard {
	if s.Encouragements == nil {
		return nil
	}

	cutoff := time.Now().Add(-7 * 24 * time.Hour)
	filter := bson.M{
		"receiver":  userID,
		"timestamp": bson.M{"$gte": cutoff},
	}
	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: -1}}).SetLimit(3)

	cursor, err := s.Encouragements.Find(ctx, filter, opts)
	if err != nil {
		slog.Warn("failed to fetch kudos for For You", "userId", userID.Hex(), "error", err)
		return nil
	}
	defer cursor.Close(ctx)

	type minimalEncouragement struct {
		ID     primitive.ObjectID `bson:"_id"`
		Sender struct {
			Name    string             `bson:"name"`
			Picture string             `bson:"picture"`
			ID      primitive.ObjectID `bson:"id"`
		} `bson:"sender"`
		Timestamp time.Time `bson:"timestamp"`
		Read      bool      `bson:"read"`
	}

	var docs []minimalEncouragement
	if err := cursor.All(ctx, &docs); err != nil {
		slog.Warn("failed to decode kudos", "userId", userID.Hex(), "error", err)
		return nil
	}

	mode := displayModeFor(exposures, CardKudosReceived)
	cards := make([]ForYouCard, 0, len(docs))
	for i, d := range docs {
		card := ForYouCard{
			ID:          fmt.Sprintf("kudos-%s", d.ID.Hex()),
			Type:        CardKudosReceived,
			DisplayMode: mode,
			IconKind:    IconKudos,
			Title:       fmt.Sprintf("%s sent you a kudos!", senderFirstName(d.Sender.Name)),
			Subject: &ForYouSubject{
				UserID:      d.Sender.ID.Hex(),
				DisplayName: d.Sender.Name,
				AvatarURL:   d.Sender.Picture,
			},
			DeepLink: "/(logged-in)/(tabs)/(task)/kudos",
			Priority: 100 - i, // newest first within the type
		}
		if mode == DisplayModeFull {
			card.Body = "Kudos are a quick way to celebrate friends' wins."
			card.Ctas = []ForYouCta{
				{
					Label: "Send one back",
					Kind:  "primary",
					Action: ForYouCtaAction{
						Type:         "send_kudos",
						TargetUserID: d.Sender.ID.Hex(),
					},
				},
				{
					Label: "Reply",
					Kind:  "secondary",
					Action: ForYouCtaAction{
						Type: "navigate",
						Href: "/(logged-in)/(tabs)/(task)/kudos",
					},
				},
			}
		} else {
			card.Ctas = []ForYouCta{
				{
					Label: "Send back",
					Kind:  "primary",
					Action: ForYouCtaAction{
						Type:         "send_kudos",
						TargetUserID: d.Sender.ID.Hex(),
					},
				},
			}
		}
		cards = append(cards, card)
	}
	return cards
}

func (s *Service) buildRingProgressCard(ctx context.Context, userID primitive.ObjectID, timezone string, exposures map[string]ExposureDoc) *ForYouCard {
	if s.RingService == nil {
		return nil
	}
	state, err := s.RingService.GetOrCreateToday(ctx, userID, timezone)
	if err != nil {
		slog.Warn("failed to fetch ring state for For You", "userId", userID.Hex(), "error", err)
		return nil
	}
	if state == nil || state.AllClosed {
		return nil
	}

	openCount := 0
	if !state.Plan.Closed {
		openCount += state.Plan.Target - state.Plan.Current
	}
	if !state.Do.Closed {
		openCount += state.Do.Target - state.Do.Current
	}
	if !state.Share.Closed {
		openCount += state.Share.Target - state.Share.Current
	}
	if openCount < 0 {
		openCount = 0
	}

	mode := displayModeFor(exposures, CardRingProgress)
	card := ForYouCard{
		ID:          fmt.Sprintf("ring-%s", state.Date.Format("2006-01-02")),
		Type:        CardRingProgress,
		DisplayMode: mode,
		IconKind:    IconRing,
		Title:       ringTitle(openCount),
		DeepLink:    "/(logged-in)/(tabs)/(task)/daily",
		Priority:    90,
		Ctas: []ForYouCta{
			{
				Label:  ringCtaLabel(mode),
				Kind:   "primary",
				Action: ForYouCtaAction{Type: "navigate", Href: "/(logged-in)/(tabs)/(task)/daily"},
			},
		},
	}
	if mode == DisplayModeFull {
		card.Body = "Rings track how much of your day you've completed."
	}
	return &card
}

func (s *Service) buildCommentReplyCards(ctx context.Context, userID primitive.ObjectID, exposures map[string]ExposureDoc) []ForYouCard {
	if s.Notifications == nil {
		return nil
	}

	cutoff := time.Now().Add(-7 * 24 * time.Hour)
	filter := bson.M{
		"receiver":         userID,
		"notificationType": "COMMENT",
		"read":             false,
		"time":             bson.M{"$gte": cutoff},
	}
	opts := options.Find().SetSort(bson.D{{Key: "time", Value: -1}}).SetLimit(2)

	cursor, err := s.Notifications.Find(ctx, filter, opts)
	if err != nil {
		slog.Warn("failed to fetch comment notifications for For You", "userId", userID.Hex(), "error", err)
		return nil
	}
	defer cursor.Close(ctx)

	type minimalNotification struct {
		ID   primitive.ObjectID `bson:"_id"`
		User struct {
			ID             primitive.ObjectID `bson:"_id"`
			DisplayName    string             `bson:"display_name"`
			ProfilePicture string             `bson:"profile_picture"`
		} `bson:"user"`
		ReferenceID primitive.ObjectID `bson:"reference_id"`
		Content     string             `bson:"content"`
	}

	var docs []minimalNotification
	if err := cursor.All(ctx, &docs); err != nil {
		slog.Warn("failed to decode comment notifications", "userId", userID.Hex(), "error", err)
		return nil
	}

	mode := displayModeFor(exposures, CardCommentReply)
	cards := make([]ForYouCard, 0, len(docs))
	for i, d := range docs {
		postRoute := fmt.Sprintf("/(logged-in)/posting/%s", d.ReferenceID.Hex())
		card := ForYouCard{
			ID:          fmt.Sprintf("comment-%s", d.ID.Hex()),
			Type:        CardCommentReply,
			DisplayMode: mode,
			IconKind:    IconComment,
			Title:       fmt.Sprintf("%s commented on your post", senderFirstName(d.User.DisplayName)),
			Subject: &ForYouSubject{
				UserID:      d.User.ID.Hex(),
				DisplayName: d.User.DisplayName,
				AvatarURL:   d.User.ProfilePicture,
			},
			DeepLink: postRoute,
			Priority: 95 - i,
			Ctas: []ForYouCta{
				{
					Label:  "Open discussion",
					Kind:   "primary",
					Action: ForYouCtaAction{Type: "navigate", Href: postRoute},
				},
			},
		}
		if mode == DisplayModeFull {
			card.Body = "Tap to read and reply in context."
		}
		cards = append(cards, card)
	}
	return cards
}

func (s *Service) buildFriendRequestsCountCard(ctx context.Context, userID primitive.ObjectID, exposures map[string]ExposureDoc) *ForYouCard {
	if s.Connections == nil {
		return nil
	}
	count, err := s.Connections.CountDocuments(ctx, bson.M{
		"receiver_id": userID,
		"status":      "pending",
	})
	if err != nil {
		slog.Warn("failed to count friend requests for For You", "userId", userID.Hex(), "error", err)
		return nil
	}
	if count == 0 {
		return nil
	}

	mode := displayModeFor(exposures, CardFriendRequestsCount)
	noun := "friend request"
	if count != 1 {
		noun = "friend requests"
	}
	card := ForYouCard{
		ID:          "friend-requests-count",
		Type:        CardFriendRequestsCount,
		DisplayMode: mode,
		IconKind:    IconUsers,
		Title:       fmt.Sprintf("%d %s", count, noun),
		DeepLink:    "/(logged-in)/(tabs)/(feed)/FollowRequests",
		Priority:    85,
		Ctas: []ForYouCta{
			{
				Label:  "Review",
				Kind:   "primary",
				Action: ForYouCtaAction{Type: "navigate", Href: "/(logged-in)/(tabs)/(feed)/FollowRequests"},
			},
		},
	}
	if mode == DisplayModeFull {
		card.Body = "People waiting to connect with you."
	}
	return &card
}

func (s *Service) buildWeeklyRecapCard(ctx context.Context, userID primitive.ObjectID, exposures map[string]ExposureDoc) *ForYouCard {
	since := time.Now().Add(-7 * 24 * time.Hour)

	kudosReceived := s.safeCount(ctx, s.Encouragements, bson.M{
		"receiver":  userID,
		"timestamp": bson.M{"$gte": since},
	})
	kudosSent := s.safeCount(ctx, s.Encouragements, bson.M{
		"sender.id": userID,
		"timestamp": bson.M{"$gte": since},
	})
	comments := s.safeCount(ctx, s.Notifications, bson.M{
		"receiver":         userID,
		"notificationType": "COMMENT",
		"time":             bson.M{"$gte": since},
	})
	ringClosures := s.safeCount(ctx, s.RingStates, bson.M{
		"user_id":    userID,
		"all_closed": true,
		"date":       bson.M{"$gte": since},
	})

	// Don't surface a recap card if literally nothing happened this week —
	// then the empty state ("All caught up") actually means something.
	if kudosReceived+kudosSent+comments+ringClosures == 0 {
		return nil
	}

	mode := displayModeFor(exposures, CardWeeklyRecap)
	card := ForYouCard{
		ID:          fmt.Sprintf("recap-%s", since.Format("2006-01-02")),
		Type:        CardWeeklyRecap,
		DisplayMode: mode,
		IconKind:    IconRecap,
		Title:       "This week at a glance",
		Body:        weeklyRecapBody(kudosReceived, kudosSent, comments, ringClosures),
		Metrics: []ForYouMetric{
			{Label: "Kudos received", Value: int(kudosReceived)},
			{Label: "Kudos sent", Value: int(kudosSent)},
			{Label: "Comments", Value: int(comments)},
			{Label: "Rings closed", Value: int(ringClosures)},
		},
		DeepLink: "/(logged-in)/(tabs)/(feed)/Notifications",
		Priority: 10, // intentionally last in Catch up
		Ctas: []ForYouCta{
			{
				Label:  "See activity",
				Kind:   "primary",
				Action: ForYouCtaAction{Type: "navigate", Href: "/(logged-in)/(tabs)/(feed)/Notifications"},
			},
		},
	}
	return &card
}

func (s *Service) safeCount(ctx context.Context, coll *mongo.Collection, filter bson.M) int64 {
	if coll == nil {
		return 0
	}
	count, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		slog.Warn("failed to count documents for weekly recap", "error", err)
		return 0
	}
	return count
}

func weeklyRecapBody(kudosReceived, kudosSent, comments, ringClosures int64) string {
	parts := make([]string, 0, 4)
	if kudosReceived > 0 {
		parts = append(parts, fmt.Sprintf("%d kudos received", kudosReceived))
	}
	if kudosSent > 0 {
		parts = append(parts, fmt.Sprintf("%d sent", kudosSent))
	}
	if comments > 0 {
		parts = append(parts, fmt.Sprintf("%d comments", comments))
	}
	if ringClosures > 0 {
		parts = append(parts, fmt.Sprintf("%d ring closures", ringClosures))
	}
	if len(parts) == 0 {
		return "A quiet week."
	}
	return joinWithMiddot(parts)
}

func joinWithMiddot(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += " · "
		}
		out += p
	}
	return out
}

func (s *Service) buildPostPromptCard(ctx context.Context, userID primitive.ObjectID, exposures map[string]ExposureDoc) *ForYouCard {
	if s.Posts == nil {
		return nil
	}

	since := time.Now().Add(-24 * time.Hour)
	filter := bson.M{
		"user._id":           userID,
		"metadata.isDeleted": false,
		"metadata.createdAt": bson.M{"$gte": since},
	}
	count, err := s.Posts.CountDocuments(ctx, filter)
	if err != nil {
		slog.Warn("failed to count user posts for For You", "userId", userID.Hex(), "error", err)
		return nil
	}
	if count > 0 {
		return nil
	}

	mode := displayModeFor(exposures, CardPostPrompt)
	card := ForYouCard{
		ID:          "post-prompt-today",
		Type:        CardPostPrompt,
		DisplayMode: mode,
		IconKind:    IconPost,
		Title:       "Share something with your circle",
		DeepLink:    "/(logged-in)/(tabs)/(feed)/feed",
		Priority:    70,
		Ctas: []ForYouCta{
			{
				Label:  "Share a post",
				Kind:   "primary",
				Action: ForYouCtaAction{Type: "navigate", Href: "/(logged-in)/(tabs)/(feed)/feed"},
			},
		},
	}
	if mode == DisplayModeFull {
		card.Body = "Posts let your friends cheer you on."
	}
	return &card
}

// ---------- Exposure tracking ----------

func (s *Service) loadExposures(ctx context.Context, userID primitive.ObjectID) (map[string]ExposureDoc, error) {
	out := map[string]ExposureDoc{}
	if s.Exposures == nil {
		return out, nil
	}
	cursor, err := s.Exposures.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []ExposureDoc
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	for _, d := range docs {
		out[d.CardType] = d
	}
	return out, nil
}

func (s *Service) recordViews(ctx context.Context, userID primitive.ObjectID, cardTypes []string) {
	if s.Exposures == nil || len(cardTypes) == 0 {
		return
	}
	now := time.Now()
	for _, ct := range cardTypes {
		_, err := s.Exposures.UpdateOne(
			ctx,
			bson.M{"user_id": userID, "card_type": ct},
			bson.M{
				"$inc": bson.M{"views": 1},
				"$set": bson.M{"last_seen_at": now},
				"$setOnInsert": bson.M{
					"user_id":   userID,
					"card_type": ct,
				},
			},
			options.Update().SetUpsert(true),
		)
		if err != nil {
			slog.Warn("failed to record For You view", "userId", userID.Hex(), "cardType", ct, "error", err)
		}
	}
}

// ---------- Helpers ----------

func displayModeFor(exposures map[string]ExposureDoc, cardType ForYouCardType) DisplayMode {
	e, ok := exposures[string(cardType)]
	if !ok {
		return DisplayModeFull
	}
	if e.Interactions >= CompactInteractionThreshold || e.Views >= CompactViewThreshold {
		return DisplayModeCompact
	}
	return DisplayModeFull
}

func sortByPriority(cards []ForYouCard) {
	sort.SliceStable(cards, func(i, j int) bool {
		return cards[i].Priority > cards[j].Priority
	})
}

func allCardTypes(sections ...[]ForYouCard) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, s := range sections {
		for _, c := range s {
			if _, ok := seen[string(c.Type)]; ok {
				continue
			}
			seen[string(c.Type)] = struct{}{}
			out = append(out, string(c.Type))
		}
	}
	return out
}

func senderFirstName(displayName string) string {
	for i, r := range displayName {
		if r == ' ' {
			return displayName[:i]
		}
	}
	if displayName == "" {
		return "Someone"
	}
	return displayName
}

func ringTitle(openCount int) string {
	switch {
	case openCount <= 1:
		return "One task away from closing today's ring"
	case openCount <= 3:
		return fmt.Sprintf("%d tasks until you close today's ring", openCount)
	default:
		return "Keep going — your rings are still open"
	}
}

func ringCtaLabel(mode DisplayMode) string {
	if mode == DisplayModeCompact {
		return "Open tasks"
	}
	return "Go to today's tasks"
}
