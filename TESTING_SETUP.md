# Test Environment Setup

## Overview

A comprehensive **ephemeral test database** system has been created. Each test gets a fresh, isolated database that's automatically created and destroyed. This ensures true test isolation and allows parallel test execution.

## What Was Created

### 1. Test Fixtures (`backend/internal/testing/fixtures.go`)

Comprehensive fixtures for all 16 collections:

- **users** - 3 test users with different configurations
- **connections** - Friend relationships between users
- **activity** - User activity tracking data
- **blueprints** - Task blueprint templates
- **categories** - Task categories (Work, Personal)
- **chats** - Chat conversations
- **completed-tasks** - Historical completed tasks
- **congratulations** - Congratulation messages
- **encouragements** - Encouragement messages
- **friend-requests** - Pending friend requests
- **groups** - User groups with members
- **notifications** - User notifications
- **posts** - Social posts with comments and reactions
- **referrals** - User referral tracking
- **template-tasks** - Reusable task templates
- **waitlist** - Waitlist entries

### 2. Database Utilities (`backend/internal/testing/database.go`)

Helper functions for ephemeral test database management:

- `NewEphemeralTestDatabase()` - Create a unique test database
- `SetupTestEnvironment()` - All-in-one setup (create + seed)
- `TeardownTestEnvironment()` - Drop database and cleanup
- `GetCollections()` - Get map of all collections
- `getTestMongoURI()` - Get MongoDB URI from environment (TEST_MONGO_URI, MONGO_URI, or localhost)

### 3. CLI Tool (`backend/cmd/seed-test-db/main.go`)

Command-line tool for creating a test database for manual inspection:

```bash
# Create an ephemeral test database
go run ./cmd/seed-test-db

# Or use make
make create-test-db
```

This creates a database you can inspect manually. The database name will be printed (e.g., `test_1706234567890123456`).

### 4. Example Tests (`backend/internal/testing/example_test.go`)

Sample test files showing:
- How to use ephemeral databases with `SetupTestEnvironment()`
- How to run tests in parallel safely
- How to access fixtures and collections
- Proper cleanup with defer
- Adding custom test data

### 5. Documentation (`backend/internal/testing/README.md`)

Complete guide including:
- Configuration (environment variables)
- Quick start examples
- Parallel testing patterns
- Test data structure
- Best practices
- Troubleshooting

## Test Data Structure

### Users
1. **Test User 1** (`testuser1`)
   - Email: test1@example.com
   - Token not used
   - Has push token

2. **Test User 2** (`testuser2`)
   - Email: test2@example.com
   - Token not used
   - Has push token

3. **Test User 3** (`testuser3`)
   - Email: test3@example.com
   - Token already used
   - Has push token

### Relationships
- User 1 ↔ User 2: Friends
- User 2 ↔ User 3: Friends

### Posts
- User 1 has a test post with image

### Notifications
- User 2 has a notification from User 1

### Groups
- "Test Group" with User 1 and User 2

## Prerequisites

### MongoDB Setup

You need MongoDB running locally or an Atlas connection. See **[MongoDB Setup Guide](backend/internal/testing/MONGODB_SETUP.md)** for detailed instructions.

**Quick Start (macOS)**:
```bash
# Install and start MongoDB
brew install mongodb-community
brew services start mongodb-community
```

**Quick Start (Docker)**:
```bash
docker run -d --name mongodb-test -p 27017:27017 mongo:latest
```

## Configuration

Set MongoDB URI via environment variables:

```bash
# Option 1: Specific test URI (recommended)
export TEST_MONGO_URI="mongodb://localhost:27017"

# Option 2: Use Atlas (falls back to MONGO_URI)
export MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/"

# If neither set, defaults to localhost:27017
```

## Usage Examples

### In Tests

```go
func TestMyFeature(t *testing.T) {
    // Setup ephemeral database (creates unique DB)
    testDB, fixtures, err := testing.SetupTestEnvironment()
    if err != nil {
        t.Fatalf("Setup failed: %v", err)
    }
    defer testing.TeardownTestEnvironment(testDB) // Drops DB automatically

    t.Logf("Using database: %s", testDB.DatabaseName)

    // Access test data
    user1 := fixtures.GetTestUser(0)
    user2 := fixtures.GetTestUser(1)
    
    // Get collections
    collections := testDB.GetCollections()
    
    // Run your tests...
    // Database will be dropped when test completes
}
```

### Parallel Tests

```go
func TestParallelFeatures(t *testing.T) {
    t.Run("Feature1", func(t *testing.T) {
        t.Parallel() // Safe - each gets own database
        testDB, fixtures, _ := testing.SetupTestEnvironment()
        defer testing.TeardownTestEnvironment(testDB)
        // Test Feature1
    })

    t.Run("Feature2", func(t *testing.T) {
        t.Parallel() // Safe - each gets own database
        testDB, fixtures, _ := testing.SetupTestEnvironment()
        defer testing.TeardownTestEnvironment(testDB)
        // Test Feature2
    })
}
```

### Manual Inspection

```bash
# Create a database you can inspect
make create-test-db

# Output shows database name:
# Ephemeral test environment setup complete (database: test_1706234567890123456)
# To inspect: mongosh test_1706234567890123456
```

## Benefits

1. **True Isolation** - Each test gets its own database
2. **Parallel Execution** - Tests can run concurrently without conflicts
3. **Automatic Cleanup** - Databases are dropped automatically
4. **Reproducible** - Every test starts with identical fixtures
5. **No Manual Cleanup** - No leftover test data to manage
6. **Comprehensive** - All 16 collections covered
7. **Type-Safe** - Strongly typed fixtures using actual types
8. **Realistic Data** - Fixtures represent real-world scenarios
9. **Works Anywhere** - Local MongoDB or Atlas

## Next Steps

1. **Set environment variable** (if using Atlas):
   ```bash
   export TEST_MONGO_URI="your-mongodb-uri"
   ```

2. **Write your tests** using `SetupTestEnvironment()`:
   ```go
   testDB, fixtures, _ := testing.SetupTestEnvironment()
   defer testing.TeardownTestEnvironment(testDB)
   ```

3. **Run tests**:
   ```bash
   make test-backend
   ```

4. **Inspect a test database** (optional):
   ```bash
   make create-test-db
   ```

## Adding More Fixtures

To add more test data:

1. Edit the generator functions in `fixtures.go`
2. Add more users, posts, connections, etc.
3. Re-run `make seed-test-db`

Example:

```go
func generateTestUsers() []interface{} {
    return []interface{}{
        // Add more users here
        types.User{
            ID: primitive.NewObjectID(),
            DisplayName: "New Test User",
            // ... other fields
        },
    }
}
```

## Troubleshooting

### MongoDB Not Running

```bash
# Start MongoDB
brew services start mongodb-community

# Check status
brew services list
```

### Connection Issues

Verify MongoDB is accessible:
```bash
mongosh mongodb://localhost:27017/test
```

### Seeding Failures

Check the error message - it will tell you which collection failed and why. Common issues:
- Missing required fields
- Invalid ObjectID references
- Schema validation failures
