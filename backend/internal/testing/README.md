# Test Fixtures and Database

This package provides test fixtures and utilities for setting up **ephemeral test databases** that are automatically created and destroyed for each test.

## Overview

The testing package includes:
- **Fixtures**: Pre-defined test data for all collections
- **Ephemeral databases**: Each test gets a fresh, isolated database with a unique name
- **Automatic cleanup**: Databases are automatically dropped after tests complete
- **Test helpers**: Functions to easily access test data in your tests
- **Mock push notifications**: Capture and verify push notifications without sending real ones

## Why Ephemeral?

✅ **True isolation** - Tests never interfere with each other  
✅ **Parallel execution** - Run tests concurrently safely  
✅ **No cleanup needed** - Database is dropped automatically  
✅ **Reproducible** - Every test starts with identical state  
✅ **Works with Atlas or local** - Configurable via environment variables

## Collections with Fixtures

All collections from the Development database have corresponding fixtures:

- `users` - Test users with various configurations
- `connections` - Friend relationships between users
- `activity` - User activity tracking data
- `blueprints` - Task blueprint templates
- `categories` - Task categories
- `chats` - Chat conversations
- `completed-tasks` - Historical completed tasks
- `congratulations` - Congratulation messages
- `encouragements` - Encouragement messages
- `friend-requests` - Pending friend requests
- `groups` - User groups
- `notifications` - User notifications
- `posts` - Social posts with comments and reactions
- `referrals` - User referral tracking
- `template-tasks` - Reusable task templates
- `waitlist` - Waitlist entries

## Key Features

### 🔔 Push Notification Testing

The testing framework includes a comprehensive mock push notification system. See:
- **[PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md)** - Complete guide with examples
- **[QUICK_REFERENCE_PUSH_NOTIFICATIONS.md](./QUICK_REFERENCE_PUSH_NOTIFICATIONS.md)** - Quick reference
- **[push_notification_example_test.go](./push_notification_example_test.go)** - Working examples

```go
// Push notifications are automatically mocked in tests
func (s *MyServiceTestSuite) TestNotification() {
    user := s.GetUser(0)
    s.service.SendFriendRequest(user.ID, otherUser.ID)
    
    // Verify notification was sent
    s.AssertPushNotificationSent(otherUser.PushToken)
    s.AssertPushNotificationCount(1)
}
```

## Prerequisites

### Install MongoDB Locally

See **[MONGODB_SETUP.md](./MONGODB_SETUP.md)** for complete installation instructions.

**Quick Start**:
```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Docker
docker run -d --name mongodb-test -p 27017:27017 mongo:latest
```

## Configuration

Set the MongoDB URI for tests using environment variables:

```bash
# Option 1: Use a specific test URI
export TEST_MONGO_URI="mongodb://localhost:27017"

# Option 2: Use your Atlas URI (falls back to MONGO_URI)
export MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/"

# If neither is set, defaults to: mongodb://localhost:27017
```

## Quick Start

### Using in Tests

```go
package mypackage_test

import (
    "testing"
    "github.com/abhikaboy/Kindred/internal/testing"
)

func TestMyFeature(t *testing.T) {
    // Setup ephemeral test environment (creates unique database)
    testDB, fixtures, err := testing.SetupTestEnvironment()
    if err != nil {
        t.Fatalf("Failed to setup test environment: %v", err)
    }
    defer testing.TeardownTestEnvironment(testDB) // Drops database automatically

    t.Logf("Using ephemeral database: %s", testDB.DatabaseName)

    // Access test data
    user1 := fixtures.GetTestUser(0)
    user2 := fixtures.GetTestUser(1)
    
    // Get collections
    collections := testDB.GetCollections()
    usersCollection := collections["users"]
    
    // Run your tests...
    // Database will be dropped when test completes
}
```

### Parallel Tests

Tests can run in parallel safely since each gets its own database:

```go
func TestParallelFeatures(t *testing.T) {
    t.Run("Feature1", func(t *testing.T) {
        t.Parallel()
        testDB, fixtures, err := testing.SetupTestEnvironment()
        if err != nil {
            t.Fatalf("Failed to setup: %v", err)
        }
        defer testing.TeardownTestEnvironment(testDB)
        
        // Test Feature1 in isolation
    })

    t.Run("Feature2", func(t *testing.T) {
        t.Parallel()
        testDB, fixtures, err := testing.SetupTestEnvironment()
        if err != nil {
            t.Fatalf("Failed to setup: %v", err)
        }
        defer testing.TeardownTestEnvironment(testDB)
        
        // Test Feature2 in isolation
    })
}
```

### Create Test Database for Manual Inspection

```bash
# Create an ephemeral database you can inspect manually
make create-test-db

# This will output the database name, e.g.:
# Ephemeral test environment setup complete (database: test_1706234567890123456)
# To inspect: mongosh test_1706234567890123456
```

## Test Data Structure

### Users
- **User 1**: `testuser1` - Regular user, token not used
- **User 2**: `testuser2` - Regular user, token not used
- **User 3**: `testuser3` - User who has used their referral token

### Connections
- User 1 ↔ User 2: Friends
- User 2 ↔ User 3: Friends

### Posts
- User 1 has a test post with images

### Notifications
- User 2 has a notification from User 1

### Groups
- Test group with User 1 and User 2 as members

## How It Works

1. **Unique Database Names**: Each call to `SetupTestEnvironment()` creates a database with a unique name like `test_1706234567890123456`
2. **Automatic Seeding**: The database is populated with all fixtures automatically
3. **Automatic Cleanup**: `TeardownTestEnvironment()` drops the entire database
4. **No Interference**: Tests can run in parallel without conflicts

## Adding New Fixtures

To add fixtures for a new collection:

1. Add the field to `TestFixtures` struct in `fixtures.go`
2. Create a generator function (e.g., `generateTestMyCollection`)
3. Call it in `NewTestFixtures()`
4. Add it to `AsMap()` method
5. Add the collection to `GetCollections()` in `database.go`

Example:

```go
// In TestFixtures struct
MyCollection []interface{}

// Generator function
func generateTestMyCollection(users []interface{}) []interface{} {
    user := users[0].(types.User)
    return []interface{}{
        MyType{
            ID:     primitive.NewObjectID(),
            UserID: user.ID,
            // ... other fields
        },
    }
}

// In NewTestFixtures()
MyCollection: generateTestMyCollection(users),

// In AsMap()
"my-collection": tf.MyCollection,
```

## Best Practices

1. **Always use defer**: Always defer `TeardownTestEnvironment()` to ensure cleanup
2. **Enable parallel tests**: Use `t.Parallel()` to run tests concurrently
3. **Don't modify fixtures**: Create copies if you need to modify test data
4. **Use meaningful test data**: Fixtures should represent realistic scenarios
5. **Log database names**: Use `t.Logf("Using database: %s", testDB.DatabaseName)` for debugging

## Running Tests

```bash
# Run all tests
make test-backend

# Run specific test
cd backend
go test ./internal/handlers/post -v

# Run with test database
cd backend
go test ./... -v
```

## Troubleshooting

### Connection Issues

If you can't connect to MongoDB:
- Ensure MongoDB is running: `brew services start mongodb-community`
- Check the URI is correct
- Verify port 27017 is not blocked

### Seeding Failures

If seeding fails:
- Check that all required fields are present in fixtures
- Verify MongoDB schema validations
- Look at the error message for which collection failed
- Ensure TEST_MONGO_URI or MONGO_URI is set correctly

### Database Not Cleaning Up

If you see many `test_*` databases accumulating:
- Check that you're using `defer testing.TeardownTestEnvironment(testDB)`
- Tests that panic or fail before defer may leave databases
- You can manually clean up: `mongosh --eval 'db.adminCommand("listDatabases").databases.filter(d => d.name.startsWith("test_")).forEach(d => db.getSiblingDB(d.name).dropDatabase())'`
