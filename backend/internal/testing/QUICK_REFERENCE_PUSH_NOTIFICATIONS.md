# Push Notification Testing - Quick Reference

## Basic Setup

Your test suite automatically has access to the mock:

```go
type MyServiceTestSuite struct {
    testpkg.BaseSuite
    service *MyService.Service
}
// s.MockPushSender is automatically available!
```

## Common Assertions

### Check if notification was sent
```go
s.AssertPushNotificationSent(user.PushToken)
```

### Check notification count
```go
s.AssertPushNotificationCount(1)
```

### Check NO notification was sent
```go
s.AssertPushNotificationNotSent(user.PushToken)
// or
s.AssertPushNotificationCount(0)
```

## Verify Notification Content

```go
// Get notifications for a specific user
notifications := s.GetSentPushNotificationsForToken(user.PushToken)
s.Require().Len(notifications, 1)

notification := notifications[0]
s.Equal("Expected Title", notification.Title)
s.Contains(notification.Message, "expected text")
s.Equal("expected_type", notification.Data["type"])
```

## Filter Notifications

### By Token
```go
notifications := s.GetSentPushNotificationsForToken(user.PushToken)
```

### By Type
```go
friendRequests := s.GetSentPushNotificationsByType("friend_request")
```

### All Notifications
```go
allNotifications := s.GetSentPushNotifications()
```

## Reset Mock Between Steps

```go
// Step 1: Do something
s.service.CreateRequest(user1.ID, user2.ID)
s.AssertPushNotificationCount(1)

// Reset to clear previous notifications
s.MockPushSender.Reset()

// Step 2: Do something else
s.service.AcceptRequest(user1.ID, user2.ID)
s.AssertPushNotificationCount(1) // Only counts from step 2
```

## Test No Push Token

```go
// Remove user's push token
s.Collections["users"].UpdateOne(s.Ctx, bson.M{"_id": user.ID}, bson.M{
    "$set": bson.M{"push_token": ""},
})

// Perform action
s.service.DoSomething(user.ID)

// Verify no notification sent
s.AssertPushNotificationCount(0)
```

## Notification Structure

```go
type Notification struct {
    Token    string            // Push token of recipient
    Title    string            // Notification title
    Message  string            // Notification body
    Data     map[string]string // Custom data payload
    ImageURL string            // Optional image URL
}
```

## Common Patterns

### Pattern 1: Basic Test
```go
func (s *MyServiceTestSuite) TestBasic() {
    user := s.GetUser(0)
    
    s.service.DoSomething(user.ID)
    
    s.AssertPushNotificationCount(1)
    s.AssertPushNotificationSent(user.PushToken)
}
```

### Pattern 2: Verify Content
```go
func (s *MyServiceTestSuite) TestContent() {
    user := s.GetUser(0)
    
    s.service.DoSomething(user.ID)
    
    notifications := s.GetSentPushNotificationsForToken(user.PushToken)
    s.Require().Len(notifications, 1)
    
    s.Equal("Title", notifications[0].Title)
    s.Contains(notifications[0].Message, "text")
}
```

### Pattern 3: Multiple Notifications
```go
func (s *MyServiceTestSuite) TestMultiple() {
    users := []*types.User{s.GetUser(0), s.GetUser(1), s.GetUser(2)}
    
    s.service.NotifyAll(users)
    
    s.AssertPushNotificationCount(len(users))
    for _, user := range users {
        s.AssertPushNotificationSent(user.PushToken)
    }
}
```

### Pattern 4: Filter by Type
```go
func (s *MyServiceTestSuite) TestTypes() {
    // Trigger various actions
    s.service.SendFriendRequest(user1.ID, user2.ID)
    s.service.SendEncouragement(user1.ID, user2.ID)
    
    friendRequests := s.GetSentPushNotificationsByType("friend_request")
    encouragements := s.GetSentPushNotificationsByType("encouragement")
    
    s.Len(friendRequests, 1)
    s.Len(encouragements, 1)
}
```

## Tips

1. **Always use `Require()` before accessing array elements** to avoid panics
2. **Reset the mock** between test steps if you need to verify specific actions
3. **Check count first** before accessing specific notifications
4. **Test both success and failure cases** - verify notifications are sent AND not sent appropriately

## See Also

- `PUSH_NOTIFICATIONS.md` - Comprehensive guide with detailed examples
- `push_notification_example_test.go` - Working code examples
