package testing

import (
	"context"
	"testing"

	"github.com/abhikaboy/Kindred/xutils"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// NewObjectID creates a new ObjectID for testing
func NewObjectID() primitive.ObjectID {
	return primitive.NewObjectID()
}

// TestHelper provides utility functions for tests
type TestHelper struct {
	t   *testing.T
	ctx context.Context
	db  *mongo.Database
}

// NewTestHelper creates a new test helper
func NewTestHelper(t *testing.T, db *mongo.Database) *TestHelper {
	return &TestHelper{
		t:   t,
		ctx: context.Background(),
		db:  db,
	}
}

// InsertDocument inserts a document and returns its ID
func (h *TestHelper) InsertDocument(collection string, doc interface{}) primitive.ObjectID {
	result, err := h.db.Collection(collection).InsertOne(h.ctx, doc)
	require.NoError(h.t, err, "Failed to insert document")
	return result.InsertedID.(primitive.ObjectID)
}

// FindDocument finds a single document
func (h *TestHelper) FindDocument(collection string, filter bson.M, result interface{}) {
	err := h.db.Collection(collection).FindOne(h.ctx, filter).Decode(result)
	require.NoError(h.t, err, "Failed to find document")
}

// FindDocuments finds multiple documents
func (h *TestHelper) FindDocuments(collection string, filter bson.M) []bson.M {
	cursor, err := h.db.Collection(collection).Find(h.ctx, filter)
	require.NoError(h.t, err, "Failed to find documents")
	defer cursor.Close(h.ctx)

	var results []bson.M
	err = cursor.All(h.ctx, &results)
	require.NoError(h.t, err, "Failed to decode documents")
	
	return results
}

// CountDocuments counts documents matching filter
func (h *TestHelper) CountDocuments(collection string, filter bson.M) int64 {
	count, err := h.db.Collection(collection).CountDocuments(h.ctx, filter)
	require.NoError(h.t, err, "Failed to count documents")
	return count
}

// UpdateDocument updates a document
func (h *TestHelper) UpdateDocument(collection string, filter bson.M, update bson.M) {
	_, err := h.db.Collection(collection).UpdateOne(h.ctx, filter, update)
	require.NoError(h.t, err, "Failed to update document")
}

// DeleteDocument deletes a document
func (h *TestHelper) DeleteDocument(collection string, filter bson.M) {
	_, err := h.db.Collection(collection).DeleteOne(h.ctx, filter)
	require.NoError(h.t, err, "Failed to delete document")
}

// AssertDocumentExists asserts that a document exists
func (h *TestHelper) AssertDocumentExists(collection string, filter bson.M) {
	count := h.CountDocuments(collection, filter)
	require.Greater(h.t, count, int64(0), "Document should exist")
}

// AssertDocumentNotExists asserts that a document does not exist
func (h *TestHelper) AssertDocumentNotExists(collection string, filter bson.M) {
	count := h.CountDocuments(collection, filter)
	require.Equal(h.t, int64(0), count, "Document should not exist")
}

// AssertDocumentCount asserts the number of documents
func (h *TestHelper) AssertDocumentCount(collection string, filter bson.M, expected int64) {
	count := h.CountDocuments(collection, filter)
	require.Equal(h.t, expected, count, "Document count mismatch")
}

// GenerateObjectID generates a new ObjectID for testing
func GenerateObjectID() primitive.ObjectID {
	return primitive.NewObjectID()
}

// MustObjectIDFromHex converts a hex string to ObjectID, panics on error
func MustObjectIDFromHex(hex string) primitive.ObjectID {
	id, err := primitive.ObjectIDFromHex(hex)
	if err != nil {
		panic(err)
	}
	return id
}

// StringPtr returns a pointer to a string
func StringPtr(s string) *string {
	return &s
}

// IntPtr returns a pointer to an int
func IntPtr(i int) *int {
	return &i
}

// BoolPtr returns a pointer to a bool
func BoolPtr(b bool) *bool {
	return &b
}

// PushNotificationHelper provides utilities for testing push notifications
type PushNotificationHelper struct {
	t              *testing.T
	mockPushSender *xutils.MockPushNotificationSender
}

// NewPushNotificationHelper creates a new push notification helper
func NewPushNotificationHelper(t *testing.T, mockPushSender *xutils.MockPushNotificationSender) *PushNotificationHelper {
	return &PushNotificationHelper{
		t:              t,
		mockPushSender: mockPushSender,
	}
}

// AssertNotificationSent asserts that a notification was sent to a specific token
func (h *PushNotificationHelper) AssertNotificationSent(token string) {
	require.True(h.t, h.mockPushSender.AssertNotificationSent(token), "Expected notification to be sent to token %s", token)
}

// AssertNotificationNotSent asserts that no notification was sent to a specific token
func (h *PushNotificationHelper) AssertNotificationNotSent(token string) {
	require.False(h.t, h.mockPushSender.AssertNotificationSent(token), "Expected no notification to be sent to token %s", token)
}

// AssertNotificationCount asserts the total number of notifications sent
func (h *PushNotificationHelper) AssertNotificationCount(expected int) {
	require.Equal(h.t, expected, len(h.mockPushSender.SentNotifications), "Expected %d notifications, got %d", expected, len(h.mockPushSender.SentNotifications))
}

// AssertNotificationWithType asserts that a notification of a specific type was sent
func (h *PushNotificationHelper) AssertNotificationWithType(notificationType string) {
	notifications := h.mockPushSender.GetSentNotificationsByType(notificationType)
	require.Greater(h.t, len(notifications), 0, "Expected at least one notification of type %s", notificationType)
}

// AssertNotificationWithTitle asserts that a notification with a specific title was sent
func (h *PushNotificationHelper) AssertNotificationWithTitle(title string) {
	for _, n := range h.mockPushSender.SentNotifications {
		if n.Title == title {
			return
		}
	}
	require.Fail(h.t, "Expected notification with title %s", title)
}

// AssertNotificationWithMessage asserts that a notification with a specific message was sent
func (h *PushNotificationHelper) AssertNotificationWithMessage(message string) {
	for _, n := range h.mockPushSender.SentNotifications {
		if n.Message == message {
			return
		}
	}
	require.Fail(h.t, "Expected notification with message %s", message)
}

// GetNotificationsForToken returns all notifications sent to a specific token
func (h *PushNotificationHelper) GetNotificationsForToken(token string) []xutils.Notification {
	return h.mockPushSender.GetSentNotificationsForToken(token)
}

// GetNotificationsByType returns all notifications of a specific type
func (h *PushNotificationHelper) GetNotificationsByType(notificationType string) []xutils.Notification {
	return h.mockPushSender.GetSentNotificationsByType(notificationType)
}

// Reset clears all sent notifications
func (h *PushNotificationHelper) Reset() {
	h.mockPushSender.Reset()
}
