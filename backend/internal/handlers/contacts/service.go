package contacts

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	Connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// NewService picks the collections this service needs out of the shared map.
func NewService(collections map[string]*mongo.Collection) *Service {
	links := collections["contact_links"]
	if links == nil {
		// setupCollections only maps collections that already exist, so a
		// missing entry means cmd/db/create_collections has not been run
		// against this database yet.
		slog.Error("contact_links collection not found in database; contact matching is disabled")
	}

	return &Service{
		Links:         links,
		Users:         collections["users"],
		Connections:   collections["friend-requests"],
		Notifications: collections["notifications"],
	}
}

// SyncContacts records the owner's hashed address-book numbers and returns the
// users those hashes match. Upserts are idempotent on (owner_id, phone_hash),
// so repeated syncs neither duplicate links nor reset their created_at.
func (s *Service) SyncContacts(ctx context.Context, ownerID primitive.ObjectID, phoneHashes []string) ([]UserMatch, error) {
	hashes := dedupeHashes(phoneHashes)
	if len(hashes) == 0 {
		return []UserMatch{}, nil
	}
	if len(hashes) > MaxLinksPerSync {
		hashes = hashes[:MaxLinksPerSync]
	}

	if err := s.storeLinks(ctx, ownerID, hashes); err != nil {
		// A failure here costs us future "they joined" pushes but should not
		// break contact search, which is what the user is waiting on.
		slog.LogAttrs(ctx, slog.LevelError, "Failed to store contact links",
			slog.String("ownerId", ownerID.Hex()), xslog.Error(err))
	}

	return s.findUsersByPhoneHashes(ctx, hashes, ownerID)
}

// storeLinks upserts one document per (owner, hash).
func (s *Service) storeLinks(ctx context.Context, ownerID primitive.ObjectID, hashes []string) error {
	if s.Links == nil {
		return fmt.Errorf("contact_links collection not available")
	}

	now := primitive.NewDateTimeFromTime(time.Now())
	writes := make([]mongo.WriteModel, 0, len(hashes))
	for _, hash := range hashes {
		writes = append(writes, mongo.NewUpdateOneModel().
			SetFilter(bson.M{"owner_id": ownerID, "phone_hash": hash}).
			SetUpdate(bson.M{"$setOnInsert": bson.M{
				"_id":        primitive.NewObjectID(),
				"owner_id":   ownerID,
				"phone_hash": hash,
				"created_at": now,
			}}).
			SetUpsert(true))
	}

	// Unordered so one conflicting write does not abandon the rest.
	_, err := s.Links.BulkWrite(ctx, writes, options.BulkWrite().SetOrdered(false))
	return err
}

// findUsersByPhoneHashes resolves hashes to users in a single indexed query,
// excluding the caller.
func (s *Service) findUsersByPhoneHashes(ctx context.Context, hashes []string, excludeUserID primitive.ObjectID) ([]UserMatch, error) {
	filter := bson.M{
		"phone_hash": bson.M{"$in": hashes},
		"_id":        bson.M{"$ne": excludeUserID},
	}
	projection := bson.M{
		"_id":             1,
		"display_name":    1,
		"handle":          1,
		"profile_picture": 1,
		"phone_hash":      1,
	}

	cursor, err := s.Users.Find(ctx, filter, options.Find().SetProjection(projection))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var internal []userMatchInternal
	if err := cursor.All(ctx, &internal); err != nil {
		return nil, err
	}

	results := make([]UserMatch, len(internal))
	for i := range internal {
		results[i] = internal[i].toAPI()
	}
	return results, nil
}

// NotifyContactsOfNewUser tells everyone who already had this user's number in
// their address book that they have joined.
//
// Matching is deliberately one-way: we notify anyone who saved the joiner's
// number, whether or not the joiner has them saved back. Recipients are
// filtered down to people who can actually receive the push, are not already
// connected to the joiner, and have not opted out; the remainder is capped at
// MaxNotifiedPerJoin and each link is stamped so it can only ever fire once.
//
// Errors are logged rather than returned to the caller's critical path — this
// runs off the back of signup and must never be able to fail a registration.
func (s *Service) NotifyContactsOfNewUser(ctx context.Context, userID primitive.ObjectID) {
	if s.Links == nil {
		return
	}

	var joiner types.User
	if err := s.Users.FindOne(ctx, bson.M{"_id": userID}).Decode(&joiner); err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Contact-join fanout: failed to load joiner",
			slog.String("userId", userID.Hex()), xslog.Error(err))
		return
	}

	hash := joiner.PhoneHash
	if hash == "" {
		// No usable number, so nobody can have them in their contacts.
		return
	}

	links, err := s.pendingLinksForHash(ctx, hash, userID)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Contact-join fanout: failed to load links",
			slog.String("userId", userID.Hex()), xslog.Error(err))
		return
	}
	if len(links) == 0 {
		return
	}

	ownerIDs := make([]primitive.ObjectID, 0, len(links))
	for _, link := range links {
		ownerIDs = append(ownerIDs, link.OwnerID)
	}

	connected, err := s.connectedUserIDs(ctx, userID, ownerIDs)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Contact-join fanout: failed to check connections",
			slog.String("userId", userID.Hex()), xslog.Error(err))
		return
	}

	recipients, err := s.notifiableRecipients(ctx, ownerIDs, connected)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Contact-join fanout: failed to load recipients",
			slog.String("userId", userID.Hex()), xslog.Error(err))
		return
	}

	// Anything over the cap stays pending so a later fan-out can pick it up;
	// everything else gets stamped, including owners we filtered out. Someone
	// who already knows the joiner should not become eligible later just
	// because their situation changed.
	deferred := make(map[primitive.ObjectID]bool)
	if len(recipients) > MaxNotifiedPerJoin {
		for _, user := range recipients[MaxNotifiedPerJoin:] {
			deferred[user.ID] = true
		}
		recipients = recipients[:MaxNotifiedPerJoin]
	}

	settled := make([]ContactLinkDocument, 0, len(links))
	for _, link := range links {
		if !deferred[link.OwnerID] {
			settled = append(settled, link)
		}
	}
	defer s.markLinksNotified(ctx, settled)

	if len(recipients) == 0 {
		return
	}

	s.sendJoinNotifications(ctx, joiner, recipients)
}

// pendingLinksForHash returns links pointing at this hash that have never been
// notified, oldest first, excluding any the joiner owns themselves.
func (s *Service) pendingLinksForHash(ctx context.Context, hash string, joinerID primitive.ObjectID) ([]ContactLinkDocument, error) {
	filter := bson.M{
		"phone_hash":  hash,
		"notified_at": bson.M{"$exists": false},
		"owner_id":    bson.M{"$ne": joinerID},
	}
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: 1}}).
		// Read more than the notify cap so filtering out ineligible owners
		// does not leave us short of a full batch.
		SetLimit(int64(MaxNotifiedPerJoin) * 10)

	cursor, err := s.Links.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var links []ContactLinkDocument
	if err := cursor.All(ctx, &links); err != nil {
		return nil, err
	}
	return links, nil
}

// connectedUserIDs returns the subset of candidates that already have any
// relationship with the joiner — friends, a pending request, or a block. None
// of them need to be told the joiner exists.
func (s *Service) connectedUserIDs(ctx context.Context, joinerID primitive.ObjectID, candidates []primitive.ObjectID) (map[primitive.ObjectID]bool, error) {
	connected := make(map[primitive.ObjectID]bool)
	if s.Connections == nil || len(candidates) == 0 {
		return connected, nil
	}

	// Both clauses target the same array field, so they have to be $and-ed
	// rather than merged into one map. Restricting to the candidate set keeps
	// this cheap for established accounts linking a number late.
	filter := bson.M{
		"$and": []bson.M{
			{"users": joinerID},
			{"users": bson.M{"$in": candidates}},
		},
		"status": bson.M{"$in": bson.A{
			Connection.StatusFriends,
			Connection.StatusPending,
			Connection.StatusBlocked,
		}},
	}

	cursor, err := s.Connections.Find(ctx, filter, options.Find().SetProjection(bson.M{"users": 1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var docs []struct {
		Users []primitive.ObjectID `bson:"users"`
	}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}

	for _, doc := range docs {
		for _, id := range doc.Users {
			if id != joinerID {
				connected[id] = true
			}
		}
	}
	return connected, nil
}

// notifiableRecipients loads the candidate owners and keeps only those with a
// push token, the contact-joins preference on, and no existing relationship
// with the joiner.
func (s *Service) notifiableRecipients(ctx context.Context, ownerIDs []primitive.ObjectID, connected map[primitive.ObjectID]bool) ([]types.User, error) {
	filter := bson.M{
		"_id":        bson.M{"$in": ownerIDs},
		"push_token": bson.M{"$gt": ""},
	}
	// Only what the filter and the push itself need — this runs over hundreds
	// of users and there is no reason to pull password/refresh_token along.
	projection := bson.M{
		"_id":        1,
		"push_token": 1,
		"settings":   1,
	}

	cursor, err := s.Users.Find(ctx, filter, options.Find().SetProjection(projection))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var users []types.User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, err
	}

	eligible := make(map[primitive.ObjectID]types.User, len(users))
	for _, user := range users {
		if connected[user.ID] {
			continue
		}
		if !user.Settings.Notifications.ContactJoins {
			continue
		}
		eligible[user.ID] = user
	}

	// Rebuild in ownerIDs order so the caller's cap keeps the oldest links
	// rather than whatever order Mongo returned.
	recipients := make([]types.User, 0, len(eligible))
	for _, id := range ownerIDs {
		if user, ok := eligible[id]; ok {
			recipients = append(recipients, user)
			delete(eligible, id)
		}
	}
	return recipients, nil
}

// sendJoinNotifications writes the in-app notifications and fires one batched
// push.
func (s *Service) sendJoinNotifications(ctx context.Context, joiner types.User, recipients []types.User) {
	title := "Someone you know joined Kindred"
	message := fmt.Sprintf("%s (@%s) is on Kindred", joiner.DisplayName, joiner.Handle)

	notificationService := notifications.NewNotificationService(map[string]*mongo.Collection{
		"notifications": s.Notifications,
		"users":         s.Users,
	})

	pushes := make([]xutils.Notification, 0, len(recipients))
	for _, recipient := range recipients {
		if err := notificationService.CreateNotification(
			joiner.ID,
			recipient.ID,
			message,
			notifications.NotificationTypeContactJoined,
			joiner.ID,
			joiner.ProfilePicture,
		); err != nil {
			slog.LogAttrs(ctx, slog.LevelError, "Contact-join fanout: failed to create in-app notification",
				slog.String("receiverId", recipient.ID.Hex()), xslog.Error(err))
		}

		pushes = append(pushes, xutils.Notification{
			Token:    recipient.PushToken,
			Title:    title,
			Message:  message,
			ImageURL: joiner.ProfilePicture,
			Data: map[string]string{
				"type":    "contact_joined",
				"user_id": joiner.ID.Hex(),
			},
		})
	}

	if err := xutils.SendBatchNotification(pushes); err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Contact-join fanout: failed to send pushes",
			slog.String("userId", joiner.ID.Hex()), slog.Int("count", len(pushes)), xslog.Error(err))
		return
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Contact-join fanout sent",
		slog.String("userId", joiner.ID.Hex()), slog.Int("recipients", len(pushes)))
}

// markLinksNotified stamps links so this fan-out can never repeat for them.
func (s *Service) markLinksNotified(ctx context.Context, links []ContactLinkDocument) {
	ids := make([]primitive.ObjectID, 0, len(links))
	for _, link := range links {
		ids = append(ids, link.ID)
	}
	if len(ids) == 0 {
		return
	}

	_, err := s.Links.UpdateMany(ctx,
		bson.M{"_id": bson.M{"$in": ids}},
		bson.M{"$set": bson.M{"notified_at": primitive.NewDateTimeFromTime(time.Now())}},
	)
	if err != nil {
		slog.LogAttrs(ctx, slog.LevelError, "Contact-join fanout: failed to mark links notified",
			slog.Int("count", len(ids)), xslog.Error(err))
	}
}

func dedupeHashes(hashes []string) []string {
	seen := make(map[string]bool, len(hashes))
	out := make([]string, 0, len(hashes))
	for _, hash := range hashes {
		if hash == "" || seen[hash] {
			continue
		}
		seen[hash] = true
		out = append(out, hash)
	}
	return out
}
