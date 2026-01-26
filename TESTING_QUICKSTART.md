# Testing Quick Start Guide

Get up and running with tests in 5 minutes.

## Step 1: Install MongoDB

### macOS (Recommended)

```bash
brew install mongodb-community
brew services start mongodb-community
```

### Docker (Alternative)

```bash
docker run -d --name mongodb-test -p 27017:27017 mongo:latest
```

## Step 2: Verify Setup

```bash
make check-mongodb
```

You should see:
```
✅ MongoDB is ready for testing!
```

## Step 3: Run Tests

```bash
make test-backend
```

That's it! 🎉

## What Just Happened?

1. **MongoDB Started** - Running on `localhost:27017`
2. **Tests Run** - Each test gets a fresh database
3. **Auto Cleanup** - Test databases are automatically dropped

## Example Test

```go
func TestMyFeature(t *testing.T) {
    // Setup: Creates fresh database with fixtures
    testDB, fixtures, err := testing.SetupTestEnvironment()
    if err != nil {
        t.Fatalf("Setup failed: %v", err)
    }
    defer testing.TeardownTestEnvironment(testDB) // Auto cleanup
    
    // Get test data
    user := fixtures.GetTestUser(0)
    
    // Your test logic here
    // ...
    
    // Database drops automatically when test completes
}
```

## Troubleshooting

### "Connection refused"

MongoDB isn't running. Start it:

```bash
# macOS
brew services start mongodb-community

# Docker
docker start mongodb-test
```

### "mongosh: command not found"

Install mongosh:

```bash
brew install mongosh
```

### Tests are slow

Use local MongoDB (not Atlas) for faster tests:

```bash
export TEST_MONGO_URI="mongodb://localhost:27017"
```

## Next Steps

- **[Full Testing Guide](TESTING_SETUP.md)** - Complete documentation
- **[MongoDB Setup](backend/internal/testing/MONGODB_SETUP.md)** - Detailed installation
- **[Architecture](backend/internal/testing/ARCHITECTURE.md)** - How it works

## Common Commands

```bash
# Check MongoDB status
make check-mongodb

# Run all tests
make test-backend

# Run specific test
cd backend && go test ./internal/handlers/post -v

# Create test database to inspect
make create-test-db

# Clean up leftover test databases
mongosh --eval 'db.adminCommand("listDatabases").databases.filter(d => d.name.startsWith("test_")).forEach(d => db.getSiblingDB(d.name).dropDatabase())'
```

## Key Features

✅ **Isolated** - Each test gets its own database  
✅ **Fast** - Local MongoDB is quick  
✅ **Parallel** - Tests can run concurrently  
✅ **Clean** - Automatic cleanup  
✅ **Realistic** - Pre-seeded fixtures for all collections
