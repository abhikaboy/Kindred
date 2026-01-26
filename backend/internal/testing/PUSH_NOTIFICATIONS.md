# Testing Push Notifications

This guide explains how to test push notifications in your service tests using the mock push notification sender.

## Overview

The testing framework provides a mock push notification sender that captures all push notifications sent during tests. This allows you to verify that notifications are sent correctly without actually sending them to real devices.

## Architecture

### Interface-Based Design

The push notification system uses an interface (`PushNotificationSender`) that allows for easy mocking:

```go
type PushNotificationSender interface {
    SendNotification(notification Notification) error
    SendBatchNotification(notifications []Notification) error
}
```

### Implementations

1. **ExpoPushNotificationSender** - Real implementation using Expo SDK (used in production)
2. **MockPushNotificationSender** - Mock implementation for testing (captures notifications)

## Using Mock Push Notifications in Tests

### 1. Test Suite Setup

The `BaseSuite` automatically sets up the mock push notification sender:

```go
type MyServiceTestSuite struct {
    testpkg.BaseSuite
    service *MyService.Service
}

func (s *MyServiceTestSuite) SetupTest() {
    s.BaseSuite.SetupTest()
    s.service = MyService.NewService(s.Collections)
    // s.MockPushSender is automatically available
}
```

### 2. Writing Tests

#### Basic Assertion - Check if Notification Was Sent

```go
func (s *MyServiceTestSuite) TestSendFriendRequest() {
    requester := s.GetUser(0)
    receiver := s.GetUser(1)
    
    err := s.service.SendFriendRequest(requester.ID, receiver.ID)
    s.NoError(err)
    
    // Assert that exactly one notification was sent
    s.AssertPushNotificationCount(1)
    
    // Assert that notification was sent to receiver's token
    s.AssertPushNotificationSent(receiver.PushToken)
}
```

#### Verify Notification Content

```go
func (s *MyServiceTestSuite) TestFriendRequestNotificationContent() {
    requester := s.GetUser(0)
    receiver := s.GetUser(1)
    
    err := s.service.SendFriendRequest(requester.ID, receiver.ID)
    s.NoError(err)
    
    // Get notifications sent to receiver
    notifications := s.GetSentPushNotificationsForToken(receiver.PushToken)
    s.Require().Len(notifications, 1)
    
    notification := notifications[0]
    s.Equal("New Friend Request!", notification.Title)
    s.Contains(notification.Message, requester.DisplayName)
    s.Equal("friend_request", notification.Data["type"])
    s.Equal(requester.ID.Hex(), notification.Data["requester_id"])
}
```

#### Test Multiple Notifications

```go
func (s *MyServiceTestSuite) TestMultipleNotifications() {
    user1 := s.GetUser(0)
    user2 := s.GetUser(1)
    user3 := s.GetUser(2)
    
    // Send multiple friend requests
    s.service.SendFriendRequest(user1.ID, user2.ID)
    s.service.SendFriendRequest(user1.ID, user3.ID)
    
    // Assert total count
    s.AssertPushNotificationCount(2)
    
    // Verify each recipient got their notification
    s.AssertPushNotificationSent(user2.PushToken)
    s.AssertPushNotificationSent(user3.PushToken)
}
```

#### Filter Notifications by Type

```go
func (s *MyServiceTestSuite) TestNotificationTypes() {
    user := s.GetUser(0)
    
    // Trigger various actions that send different notification types
    s.service.SendFriendRequest(user.ID, s.GetUser(1).ID)
    s.service.SendEncouragement(user.ID, s.GetUser(1).ID)
    
    // Get notifications by type
    friendRequests := s.GetSentPushNotificationsByType("friend_request")
    encouragements := s.GetSentPushNotificationsByType("encouragement")
    
    s.Len(friendRequests, 1)
    s.Len(encouragements, 1)
}
```

#### Test No Notification Sent (User Has No Push Token)

```go
func (s *MyServiceTestSuite) TestNoPushTokenNoNotification() {
    requester := s.GetUser(0)
    receiver := s.GetUser(1)
    
    // Remove receiver's push token
    s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": receiver.ID}, bson.M{
        "$set": bson.M{"push_token": ""},
    })
    
    err := s.service.SendFriendRequest(requester.ID, receiver.ID)
    s.NoError(err)
    
    // No notification should be sent
    s.AssertPushNotificationCount(0)
}
```

#### Reset Mock Between Test Steps

```go
func (s *MyServiceTestSuite) TestMultipleSteps() {
    user1 := s.GetUser(0)
    user2 := s.GetUser(1)
    
    // Step 1: Send friend request
    s.service.SendFriendRequest(user1.ID, user2.ID)
    s.AssertPushNotificationCount(1)
    
    // Reset mock to clear previous notifications
    s.MockPushSender.Reset()
    
    // Step 2: Accept friend request
    s.service.AcceptFriendRequest(user1.ID, user2.ID)
    s.AssertPushNotificationCount(1) // Only count from this step
}
```

## Available Assertion Methods

### BaseSuite Methods

These methods are available on any test suite that embeds `BaseSuite`:

- `AssertPushNotificationSent(token string)` - Assert notification was sent to token
- `AssertPushNotificationNotSent(token string)` - Assert no notification was sent to token
- `AssertPushNotificationCount(expected int)` - Assert total number of notifications sent
- `GetSentPushNotifications()` - Get all sent notifications
- `GetSentPushNotificationsForToken(token string)` - Get notifications for specific token
- `GetSentPushNotificationsByType(notificationType string)` - Get notifications by type

### MockPushNotificationSender Methods

You can also access the mock directly via `s.MockPushSender`:

- `Reset()` - Clear all sent notifications
- `GetSentNotifications()` - Get all sent notifications
- `GetSentNotificationsForToken(token string)` - Get notifications for token
- `GetSentNotificationsByType(notificationType string)` - Get notifications by type
- `AssertNotificationSent(token string) bool` - Check if notification was sent
- `AssertNotificationCount(expected int) bool` - Check notification count

## Notification Structure

Each captured notification has the following structure:

```go
type Notification struct {
    Token    string            // Push token of recipient
    Message  string            // Notification body
    Data     map[string]string // Custom data payload
    Title    string            // Notification title
    ImageURL string            // Optional image URL
}
```

## Common Patterns

### Pattern 1: Test Notification Sent with Correct Data

```go
func (s *MyServiceTestSuite) TestNotificationData() {
    // Perform action
    result, err := s.service.DoSomething(params)
    s.NoError(err)
    
    // Get and verify notification
    notifications := s.GetSentPushNotificationsForToken(user.PushToken)
    s.Require().Len(notifications, 1)
    
    notification := notifications[0]
    s.Equal("Expected Title", notification.Title)
    s.Contains(notification.Message, "expected text")
    s.Equal("expected_type", notification.Data["type"])
    s.Equal(result.ID.Hex(), notification.Data["result_id"])
}
```

### Pattern 2: Test Batch Notifications

```go
func (s *MyServiceTestSuite) TestBatchNotifications() {
    users := []*types.User{s.GetUser(0), s.GetUser(1), s.GetUser(2)}
    
    err := s.service.NotifyAllUsers(users, "message")
    s.NoError(err)
    
    // Verify each user got a notification
    for _, user := range users {
        s.AssertPushNotificationSent(user.PushToken)
    }
    
    s.AssertPushNotificationCount(len(users))
}
```

### Pattern 3: Test Error Handling

```go
func (s *MyServiceTestSuite) TestNotificationErrorHandling() {
    // Configure mock to return error
    s.MockPushSender.SendNotificationError = errors.New("push service unavailable")
    
    // Service should handle error gracefully
    err := s.service.SendFriendRequest(user1.ID, user2.ID)
    
    // The main operation should still succeed
    s.NoError(err)
    
    // But we can verify the notification was attempted
    s.Equal(1, len(s.MockPushSender.SentNotifications))
}
```

## Testing Tips

1. **Always reset the mock** between test steps if you need to verify notifications from a specific action
2. **Check notification count first** before accessing specific notifications to avoid index out of bounds
3. **Use `Require()` for critical assertions** that subsequent code depends on
4. **Test both success and failure cases** - verify notifications are sent when expected AND not sent when not expected
5. **Verify notification data** - don't just check that a notification was sent, verify it contains the correct information

## Integration with Existing Code

The mock is automatically configured in `BaseSuite.SetupTest()` and cleaned up in `BaseSuite.TearDownTest()`. You don't need to do any manual setup or teardown.

The global `xutils.DefaultPushSender` is replaced with the mock during tests and restored after tests complete, ensuring tests don't interfere with each other or with production code.
