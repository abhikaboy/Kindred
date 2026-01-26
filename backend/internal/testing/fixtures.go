package testing

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TestFixtures holds all test data fixtures
type TestFixtures struct {
	Users           []interface{}
	Connections     []interface{}
	Activity        []interface{}
	Blueprints      []interface{}
	Categories      []interface{}
	Chats           []interface{}
	CompletedTasks  []interface{}
	Congratulations []interface{}
	Encouragements  []interface{}
	FriendRequests  []interface{}
	Groups          []interface{}
	Notifications   []interface{}
	Posts           []interface{}
	Referrals       []interface{}
	TemplateTasks   []interface{}
	Waitlist        []interface{}
}

// NewTestFixtures creates a new set of test fixtures
func NewTestFixtures() *TestFixtures {
	// Generate users first as they're referenced by other collections
	users := generateTestUsers()

	return &TestFixtures{
		Users:           users,
		Connections:     generateTestConnections(users),
		Activity:        generateTestActivity(users),
		Blueprints:      generateTestBlueprints(users),
		Categories:      generateTestCategories(users),
		Chats:           generateTestChats(users),
		CompletedTasks:  generateTestCompletedTasks(users),
		Congratulations: generateTestCongratulations(users),
		Encouragements:  generateTestEncouragements(users),
		FriendRequests:  []interface{}{}, // Deprecated: using Connections instead
		Groups:          generateTestGroups(users),
		Notifications:   generateTestNotifications(users),
		Posts:           generateTestPosts(users),
		Referrals:       generateTestReferrals(users),
		TemplateTasks:   generateTestTemplateTasks(users),
		Waitlist:        generateTestWaitlist(),
	}
}

// AsMap returns fixtures as a map for seeding
func (tf *TestFixtures) AsMap() map[string][]interface{} {
	return map[string][]interface{}{
		"users":           tf.Users,
		"friend-requests": tf.Connections, // Connections are stored in friend-requests collection
		"activity":        tf.Activity,
		"blueprints":      tf.Blueprints,
		"categories":      tf.Categories,
		"chats":           tf.Chats,
		"completed-tasks": tf.CompletedTasks,
		"congratulations": tf.Congratulations,
		"encouragements":  tf.Encouragements,
		"groups":          tf.Groups,
		"notifications":   tf.Notifications,
		"posts":           tf.Posts,
		"referrals":       tf.Referrals,
		"template-tasks":  tf.TemplateTasks,
		"waitlist":        tf.Waitlist,
	}
}

// generateTestUsers creates test user data
func generateTestUsers() []interface{} {
	users := []interface{}{
		types.User{
			ID:              primitive.NewObjectID(),
			AppleID:         "test_apple_1",
			Email:           "test1@example.com",
			Password:        "password123",
			DisplayName:     "Test User 1",
			Handle:          "testuser1",
			Count:           1.0,
			TokenUsed:       false,
			PushToken:       "test_push_token_1",
			Encouragements:  2,
			Congratulations: 2,
			ProfilePicture:  "https://example.com/pic1.jpg",
			Friends:         []primitive.ObjectID{},
			Settings:        types.DefaultUserSettings(),
		},
		types.User{
			ID:              primitive.NewObjectID(),
			AppleID:         "test_apple_2",
			Email:           "test2@example.com",
			Password:        "password123",
			DisplayName:     "Test User 2",
			Handle:          "testuser2",
			Count:           1.0,
			TokenUsed:       false,
			PushToken:       "test_push_token_2",
			Encouragements:  2,
			Congratulations: 2,
			ProfilePicture:  "https://example.com/pic2.jpg",
			Friends:         []primitive.ObjectID{},
			Settings:        types.DefaultUserSettings(),
		},
		types.User{
			ID:              primitive.NewObjectID(),
			AppleID:         "test_apple_3",
			Email:           "test3@example.com",
			Password:        "password123",
			DisplayName:     "Test User 3",
			Handle:          "testuser3",
			Count:           1.0,
			TokenUsed:       true, // This user has used their token
			PushToken:       "test_push_token_3",
			Encouragements:  2,
			Congratulations: 2,
			ProfilePicture:  "https://example.com/pic3.jpg",
			Friends:         []primitive.ObjectID{},
			Settings:        types.DefaultUserSettings(),
		},
	}
	return users
}

// ConnectionDocumentInternal is a local copy to avoid import cycles
type ConnectionDocumentInternal struct {
	ID         primitive.ObjectID     `bson:"_id,omitempty"`
	Users      []primitive.ObjectID   `bson:"users"`
	Status     string                 `bson:"status"`
	Requester  ConnectionUserInternal `bson:"requester"`
	ReceiverID primitive.ObjectID     `bson:"receiver_id"`
	CreatedAt  time.Time              `bson:"created_at"`
	AcceptedAt *time.Time             `bson:"accepted_at,omitempty"`
	BlockerID  *primitive.ObjectID    `bson:"blocker_id,omitempty"`
	UpdatedAt  *time.Time             `bson:"updated_at,omitempty"`
}

type ConnectionUserInternal struct {
	ID      primitive.ObjectID `bson:"_id"`
	Picture *string            `bson:"picture"`
	Name    string             `bson:"name"`
	Handle  string             `bson:"handle"`
}

// generateTestConnections creates test connection data
func generateTestConnections(users []interface{}) []interface{} {
	if len(users) < 3 {
		return []interface{}{}
	}

	user1 := users[0].(types.User)
	user2 := users[1].(types.User)
	user3 := users[2].(types.User)
	now := time.Now()

	// Create sorted user ID arrays for connections
	user1And2 := []primitive.ObjectID{user1.ID, user2.ID}
	user2And3 := []primitive.ObjectID{user2.ID, user3.ID}

	connections := []interface{}{
		// User 1 and User 2 are friends
		ConnectionDocumentInternal{
			ID:     primitive.NewObjectID(),
			Users:  user1And2,
			Status: "friends",
			Requester: ConnectionUserInternal{
				ID:      user1.ID,
				Picture: &user1.ProfilePicture,
				Name:    user1.DisplayName,
				Handle:  user1.Handle,
			},
			ReceiverID: user2.ID,
			CreatedAt:  now,
			AcceptedAt: &now,
		},
		// User 2 and User 3 are friends
		ConnectionDocumentInternal{
			ID:     primitive.NewObjectID(),
			Users:  user2And3,
			Status: "friends",
			Requester: ConnectionUserInternal{
				ID:      user2.ID,
				Picture: &user2.ProfilePicture,
				Name:    user2.DisplayName,
				Handle:  user2.Handle,
			},
			ReceiverID: user3.ID,
			CreatedAt:  now,
			AcceptedAt: &now,
		},
	}
	return connections
}

// Helper function to create string pointers
func stringPtr(s string) *string {
	return &s
}

// GetTestUser returns a test user by index
func (tf *TestFixtures) GetTestUser(index int) *types.User {
	if index >= len(tf.Users) {
		return nil
	}
	user := tf.Users[index].(types.User)
	return &user
}

// GetTestConnection returns a test connection by index
func (tf *TestFixtures) GetTestConnection(index int) *ConnectionDocumentInternal {
	if index >= len(tf.Connections) {
		return nil
	}
	connection := tf.Connections[index].(ConnectionDocumentInternal)
	return &connection
}

// GetTestPost returns a test post by index
func (tf *TestFixtures) GetTestPost(index int) *types.PostDocument {
	if index >= len(tf.Posts) {
		return nil
	}
	post := tf.Posts[index].(types.PostDocument)
	return &post
}

// GetTestNotification returns a test notification by index
func (tf *TestFixtures) GetTestNotification(index int) *NotificationDocument {
	if index >= len(tf.Notifications) {
		return nil
	}
	notification := tf.Notifications[index].(NotificationDocument)
	return &notification
}

// GetTestGroup returns a test group by index
func (tf *TestFixtures) GetTestGroup(index int) *types.GroupDocument {
	if index >= len(tf.Groups) {
		return nil
	}
	group := tf.Groups[index].(types.GroupDocument)
	return &group
}

// generateTestActivity creates test activity data
func generateTestActivity(users []interface{}) []interface{} {
	// Simplified - just return empty for now
	return []interface{}{}
}

// generateTestBlueprints creates test blueprint data
func generateTestBlueprints(users []interface{}) []interface{} {
	if len(users) == 0 {
		return []interface{}{}
	}

	user := users[0].(types.User)

	return []interface{}{
		map[string]interface{}{
			"_id":         primitive.NewObjectID(),
			"user_id":     user.ID,
			"name":        "Morning Routine",
			"description": "Daily morning tasks",
			"tasks":       []string{"Wake up", "Exercise", "Breakfast"},
			"created_at":  time.Now(),
		},
	}
}

// generateTestCategories creates test category data
func generateTestCategories(users []interface{}) []interface{} {
	// Simplified - just return empty for now
	return []interface{}{}
}

// generateTestChats creates test chat data
func generateTestChats(users []interface{}) []interface{} {
	if len(users) < 2 {
		return []interface{}{}
	}

	user1 := users[0].(types.User)
	user2 := users[1].(types.User)

	return []interface{}{
		map[string]interface{}{
			"_id":          primitive.NewObjectID(),
			"participants": []primitive.ObjectID{user1.ID, user2.ID},
			"last_message": "Hey, how are you?",
			"timestamp":    time.Now(),
		},
	}
}

// generateTestCompletedTasks creates test completed task data
func generateTestCompletedTasks(users []interface{}) []interface{} {
	if len(users) == 0 {
		return []interface{}{}
	}

	user := users[0].(types.User)
	now := time.Now()

	return []interface{}{
		map[string]interface{}{
			"_id":          primitive.NewObjectID(),
			"user_id":      user.ID,
			"title":        "Complete project proposal",
			"completed_at": now,
			"category":     "Work",
		},
	}
}

// generateTestCongratulations creates test congratulation data
func generateTestCongratulations(users []interface{}) []interface{} {
	if len(users) < 2 {
		return []interface{}{}
	}

	user1 := users[0].(types.User)
	user2 := users[1].(types.User)

	return []interface{}{
		map[string]interface{}{
			"_id":       primitive.NewObjectID(),
			"from_user": user1.ID,
			"to_user":   user2.ID,
			"message":   "Great job on completing your tasks!",
			"timestamp": time.Now(),
		},
	}
}

// generateTestEncouragements creates test encouragement data
func generateTestEncouragements(users []interface{}) []interface{} {
	if len(users) < 2 {
		return []interface{}{}
	}

	user1 := users[0].(types.User)
	user2 := users[1].(types.User)

	return []interface{}{
		map[string]interface{}{
			"_id":       primitive.NewObjectID(),
			"from_user": user1.ID,
			"to_user":   user2.ID,
			"message":   "Keep up the good work!",
			"timestamp": time.Now(),
		},
	}
}

// generateTestFriendRequests creates test friend request data
func generateTestFriendRequests(users []interface{}) []interface{} {
	if len(users) < 2 {
		return []interface{}{}
	}

	user1 := users[0].(types.User)
	user2 := users[1].(types.User)

	return []interface{}{
		map[string]interface{}{
			"_id":       primitive.NewObjectID(),
			"requester": user1.ID,
			"receiver":  user2.ID,
			"status":    "pending",
			"timestamp": time.Now(),
		},
	}
}

// generateTestGroups creates test group data
func generateTestGroups(users []interface{}) []interface{} {
	// Simplified - just return empty for now
	return []interface{}{}
}

// NotificationDocument is a local copy to avoid import cycles
type NotificationDocument struct {
	ID               primitive.ObjectID `bson:"_id"`
	Content          string             `bson:"content"`
	Receiver         primitive.ObjectID `bson:"receiver"`
	User             UserReference      `bson:"user"`
	Time             time.Time          `bson:"time"`
	NotificationType string             `bson:"notificationType"`
	ReferenceID      primitive.ObjectID `bson:"reference_id"`
	Read             bool               `bson:"read"`
	Thumbnail        string             `bson:"thumbnail,omitempty"`
}

type UserReference struct {
	ID             primitive.ObjectID `bson:"_id"`
	DisplayName    string             `bson:"display_name"`
	Handle         string             `bson:"handle"`
	ProfilePicture string             `bson:"profile_picture"`
}

// generateTestNotifications creates test notification data
func generateTestNotifications(users []interface{}) []interface{} {
	if len(users) < 2 {
		return []interface{}{}
	}

	user1 := users[0].(types.User)
	user2 := users[1].(types.User)

	return []interface{}{
		NotificationDocument{
			ID:       primitive.NewObjectID(),
			Content:  "Test User 1 commented on your post",
			Receiver: user2.ID,
			User: UserReference{
				ID:             user1.ID,
				DisplayName:    user1.DisplayName,
				Handle:         user1.Handle,
				ProfilePicture: user1.ProfilePicture,
			},
			Time:             time.Now(),
			NotificationType: "COMMENT",
			ReferenceID:      primitive.NewObjectID(),
			Read:             false,
		},
	}
}

// generateTestPosts creates test post data
func generateTestPosts(users []interface{}) []interface{} {
	if len(users) == 0 {
		return []interface{}{}
	}

	user := users[0].(types.User)
	now := time.Now()

	return []interface{}{
		types.PostDocument{
			ID:      primitive.NewObjectID(),
			Caption: "Test post caption",
			User: types.UserExtendedReferenceInternal{
				ID:             user.ID,
				DisplayName:    user.DisplayName,
				Handle:         user.Handle,
				ProfilePicture: user.ProfilePicture,
			},
			Images: []string{"https://example.com/image1.jpg"},
			Metadata: types.PostMetadata{
				CreatedAt: now,
				IsDeleted: false,
			},
			Reactions: map[string][]primitive.ObjectID{},
			Comments:  []types.CommentDocument{},
		},
	}
}

// generateTestReferrals creates test referral data
func generateTestReferrals(users []interface{}) []interface{} {
	if len(users) < 2 {
		return []interface{}{}
	}

	user1 := users[0].(types.User)
	user2 := users[1].(types.User)

	return []interface{}{
		map[string]interface{}{
			"_id":         primitive.NewObjectID(),
			"referrer_id": user1.ID,
			"referred_id": user2.ID,
			"code":        "TEST123",
			"status":      "completed",
			"created_at":  time.Now(),
		},
	}
}

// generateTestTemplateTasks creates test template task data
func generateTestTemplateTasks(users []interface{}) []interface{} {
	// Simplified - just return empty for now
	return []interface{}{}
}

// generateTestWaitlist creates test waitlist data
func generateTestWaitlist() []interface{} {
	return []interface{}{
		map[string]interface{}{
			"_id":        primitive.NewObjectID(),
			"email":      "waitlist1@example.com",
			"name":       "Waitlist User 1",
			"created_at": time.Now(),
			"status":     "pending",
		},
		map[string]interface{}{
			"_id":        primitive.NewObjectID(),
			"email":      "waitlist2@example.com",
			"name":       "Waitlist User 2",
			"created_at": time.Now(),
			"status":     "invited",
		},
	}
}
