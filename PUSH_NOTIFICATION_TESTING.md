# Push Notification Testing Implementation

## Summary

Implemented a comprehensive mock push notification system for testing that allows tests to verify push notifications are sent correctly without actually sending them to real devices.

## What Was Implemented

### 1. Interface-Based Architecture (`backend/xutils/push_notification.go`)

Created a `PushNotificationSender` interface with two implementations:

- **ExpoPushNotificationSender**: Real implementation using Expo SDK (production)
- **MockPushNotificationSender**: Mock implementation that captures notifications (testing)

### 2. Backward Compatible API (`backend/xutils/notifications.go`)

Updated the existing notification functions to use the new interface while maintaining backward compatibility:

- `SendNotification()` - Uses the global `DefaultPushSender`
- `SendBatchNotification()` - Uses the global `DefaultPushSender`
- `SetPushNotificationSender()` - Allows replacing the sender (for testing)

### 3. Testing Framework Integration

#### BaseSuite Enhancement (`backend/internal/testing/suite.go`)

Added automatic mock setup to `BaseSuite`:

- `MockPushSender` field automatically initialized
- Mock is set up in `SetupTest()` and reset in `TearDownTest()`
- Helper methods for common assertions:
  - `AssertPushNotificationSent(token)`
  - `AssertPushNotificationNotSent(token)`
  - `AssertPushNotificationCount(expected)`
  - `GetSentPushNotifications()`
  - `GetSentPushNotificationsForToken(token)`
  - `GetSentPushNotificationsByType(type)`

#### Helper Utilities (`backend/internal/testing/helpers.go`)

Added `PushNotificationHelper` with methods for:

- Asserting notifications were sent
- Asserting notification content
- Filtering notifications by type or token
- Resetting the mock

### 4. Updated Existing Tests

Updated `backend/internal/handlers/connection/service_test.go` to demonstrate usage:

- `TestCreateConnectionRequest_Success` - Verifies notification sent to receiver
- `TestAcceptConnection_Success` - Verifies notification sent to requester
- `TestCreateConnectionRequest_ReceiverNoPushToken` - Verifies no notification when user has no token

### 5. Documentation

Created comprehensive documentation:

- **PUSH_NOTIFICATIONS.md** - Detailed guide with examples and patterns
- **push_notification_example_test.go** - Working examples demonstrating all features

## Key Features

### Mock Capabilities

The mock push notification sender provides:

1. **Capture notifications** - All sent notifications are stored
2. **Filter by token** - Get notifications sent to specific users
3. **Filter by type** - Get notifications of specific types (e.g., "friend_request")
4. **Count assertions** - Verify the correct number of notifications were sent
5. **Content verification** - Inspect notification title, message, and data
6. **Error simulation** - Can be configured to return errors for testing error handling
7. **Reset functionality** - Clear captured notifications between test steps

### Automatic Integration

Tests automatically use the mock with zero configuration:

```go
type MyServiceTestSuite struct {
    testpkg.BaseSuite
    service *MyService.Service
}

// That's it! s.MockPushSender is automatically available
```

### No Code Changes Required

Existing service code continues to work without modification:

```go
// This code works in both production and tests
err := xutils.SendNotification(xutils.Notification{
    Token:   user.PushToken,
    Title:   "Hello",
    Message: "World",
})
```

## Usage Examples

### Basic Test

```go
func (s *MyServiceTestSuite) TestSendNotification() {
    user := s.GetUser(0)
    
    err := s.service.DoSomething(user.ID)
    s.NoError(err)
    
    // Assert notification was sent
    s.AssertPushNotificationCount(1)
    s.AssertPushNotificationSent(user.PushToken)
}
```

### Verify Content

```go
func (s *MyServiceTestSuite) TestNotificationContent() {
    user := s.GetUser(0)
    
    err := s.service.SendFriendRequest(user.ID, otherUser.ID)
    s.NoError(err)
    
    notifications := s.GetSentPushNotificationsForToken(otherUser.PushToken)
    s.Require().Len(notifications, 1)
    
    notification := notifications[0]
    s.Equal("New Friend Request!", notification.Title)
    s.Contains(notification.Message, user.DisplayName)
    s.Equal("friend_request", notification.Data["type"])
}
```

### Test Multiple Steps

```go
func (s *MyServiceTestSuite) TestMultipleSteps() {
    // Step 1
    s.service.CreateRequest(user1.ID, user2.ID)
    s.AssertPushNotificationCount(1)
    
    // Reset for next step
    s.MockPushSender.Reset()
    
    // Step 2
    s.service.AcceptRequest(user1.ID, user2.ID)
    s.AssertPushNotificationCount(1) // Only from this step
}
```

## Benefits

1. **No Real Notifications** - Tests don't send actual push notifications
2. **Fast Tests** - No network calls or external dependencies
3. **Deterministic** - Tests are reliable and repeatable
4. **Easy to Use** - Simple API with helpful assertion methods
5. **Comprehensive** - Can verify all aspects of notifications (content, recipients, timing)
6. **Backward Compatible** - Existing code works without changes
7. **Production Safe** - Mock is only used in tests, production uses real sender

## Files Modified/Created

### Created
- `backend/xutils/push_notification.go` - Interface and implementations
- `backend/internal/testing/PUSH_NOTIFICATIONS.md` - Documentation
- `backend/internal/testing/push_notification_example_test.go` - Examples

### Modified
- `backend/xutils/notifications.go` - Updated to use interface
- `backend/internal/testing/suite.go` - Added mock integration
- `backend/internal/testing/helpers.go` - Added helper utilities
- `backend/internal/handlers/connection/service_test.go` - Updated with assertions

## Testing

All tests pass successfully:

```bash
# Connection service tests (including new push notification assertions)
go test ./internal/handlers/connection -v
# PASS (27 tests)

# Example tests demonstrating mock usage
go test ./internal/testing -run TestPushNotificationExample -v
# PASS (6 examples)

# Post service tests (using mock automatically)
go test ./internal/handlers/post -run TestAddComment -v
# PASS
```

## Next Steps

To use the mock in your tests:

1. Your test suite should embed `testpkg.BaseSuite`
2. Use `s.MockPushSender` to access the mock
3. Use assertion methods like `s.AssertPushNotificationSent(token)`
4. See `PUSH_NOTIFICATIONS.md` for detailed examples and patterns

The mock is automatically configured and requires no additional setup!
