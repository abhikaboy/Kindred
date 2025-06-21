# Testing Framework Documentation

This document describes the comprehensive testing framework for the Kindred backend, which includes both unit tests and end-to-end tests with MongoDB Atlas integration.

## Overview

The testing framework consists of:

1. **Test Utilities** (`internal/testutils/`) - Database connection and fixture management
2. **Unit Tests** - Fast tests without database dependencies
3. **Integration Tests** - Tests that use a real MongoDB Atlas test database
4. **E2E Tests** - End-to-end tests in the `test/e2e/` directory

## Project Structure

```
backend/
├── internal/
│   ├── testutils/           # Test utilities and helpers
│   │   ├── database.go      # Database connection and management
│   │   └── fixtures.go      # Test data fixtures
│   └── handlers/
│       └── auth/
│           ├── auth_service_test.go        # Unit tests
│           └── integration_test.go         # Existing integration tests
└── test/
    └── e2e/
        └── auth_test.go     # End-to-end tests
```

## Setup

### 1. Environment Configuration

A `.env.test` file has been created in the backend directory. **You need to edit it** with your actual MongoDB Atlas credentials:

```bash
# Edit the test environment file
nano .env.test
# or
code .env.test
```

Replace the placeholder values with your actual credentials:

```env
# Atlas MongoDB Configuration for Testing
ATLAS_USER=your-actual-atlas-username
ATLAS_PASS=your-actual-atlas-password
ATLAS_CLUSTER=your-actual-cluster-name
ATLAS_ENVIRONMENT=test

# Auth Configuration for Testing (make this long and secure)
AUTH_SECRET=your-long-secure-jwt-secret-key-here

# App Configuration for Testing
APP_PORT=8081
APP_DEBUG=true
```

**Load the environment before running tests:**

```bash
# Load test environment variables
export $(cat .env.test | xargs)

# Then run your tests
go test ./test/e2e -v
```

### 2. Test Database Setup

The testing framework will:

-   Automatically create a test database with a unique name
-   Set up the same collections and indexes as production
-   Clean up test data between tests
-   Completely remove the test database after tests

## Test Types

### Unit Tests

Located in `internal/handlers/auth/auth_service_test.go`, these tests:

-   Test business logic without database dependencies
-   Are fast and can run without external services
-   Focus on token generation, validation, and other pure functions

Example:

```go
func TestAuthService_GenerateToken(t *testing.T) {
    cfg := config.Config{
        Auth: config.Auth{Secret: "test-secret-key"},
    }
    service := &Service{config: cfg}

    token, err := service.GenerateToken(userID, exp, 1.0)
    assert.NoError(t, err)
    assert.NotEmpty(t, token)
}
```

### Integration Tests

Located in `test/e2e/auth_test.go`, these tests:

-   Use a real MongoDB Atlas test database
-   Test complete user workflows
-   Verify database operations end-to-end

Example:

```go
func TestAuthService_E2E_UserLifecycle(t *testing.T) {
    // Setup test database
    testDB, err := testutils.NewTestDB(ctx, testConfig)
    // ... test user creation, login, token operations
}
```

## Test Utilities

### TestDB

The `TestDB` struct provides utilities for database testing:

```go
// Create a test database
testDB, err := testutils.NewTestDB(ctx, testConfig)

// Clean collections
err = testDB.ClearCollection(ctx, "users")

// Count documents
count, err := testDB.CountDocuments(ctx, "users", bson.D{})

// Seed with fixtures
err = testDB.SeedData(ctx, fixtures.AsMap())

// Cleanup
err = testDB.TearDown(ctx)
```

### Test Fixtures

Pre-defined test data for consistent testing:

```go
// Create fixtures
fixtures := testutils.NewTestFixtures()

// Get test users
testUser := fixtures.GetTestUser(0)

// Seed database
err = testDB.SeedData(ctx, fixtures.AsMap())
```

## Running Tests

### Unit Tests Only

```bash
# Run all unit tests (no database required)
go test ./internal/handlers/auth -run TestAuthService_Generate

# Run specific unit test
go test ./internal/handlers/auth -run TestAuthService_GenerateToken
```

### Integration Tests

```bash
# Run E2E tests (requires test database)
go test ./test/e2e -v

# Run specific E2E test
go test ./test/e2e -run TestAuthService_E2E_UserLifecycle -v
```

### All Tests

```bash
# Run all tests in the project
go test ./...

# Run with verbose output
go test -v ./...

# Run with coverage
go test -cover ./...
```

### Benchmarks

```bash
# Run benchmarks
go test -bench=. ./internal/handlers/auth

# Run specific benchmark
go test -bench=BenchmarkAuthService_GenerateToken ./internal/handlers/auth
```

## CI/CD Integration

The tests automatically skip database tests in CI environments by checking for CI environment variables:

```go
if testutils.IsCI() {
    t.Skip("Skipping database tests in CI environment")
}
```

To run database tests in CI, set up your CI environment with test database credentials.

## Best Practices

### 1. Test Data Isolation

-   Each test cleans up its own data
-   Use unique identifiers for test data
-   Don't rely on data from other tests

### 2. Error Testing

-   Test both success and failure scenarios
-   Verify specific error types and messages
-   Test edge cases and boundary conditions

### 3. Performance Testing

-   Include benchmark tests for critical paths
-   Test with realistic data volumes
-   Monitor test execution time

### 4. Database Testing

-   Always clean up test data
-   Use transactions when possible
-   Test with realistic data structures

## Adding New Tests

### For Unit Tests

1. Create test functions in the same package as the code being tested
2. Use the `TestFunctionName_TestCase` naming convention
3. Focus on testing business logic without external dependencies

### For Integration Tests

1. Add tests to the `test/e2e` package
2. Use the test database utilities
3. Test complete workflows and scenarios
4. Clean up test data properly

### For New Services

1. Create fixtures in `testutils/fixtures.go`
2. Add database utility functions if needed
3. Follow the same patterns as auth tests

## Troubleshooting

### Database Connection Issues

-   Verify your `.env.test` file has correct credentials
-   Check that your MongoDB Atlas cluster allows connections from your IP
-   Ensure the test database name doesn't conflict with production

### Test Failures

-   Check that test database is clean before running tests
-   Verify that fixtures are loading correctly
-   Ensure proper error handling in test setup/teardown

### Performance Issues

-   Use `t.Parallel()` for tests that can run in parallel
-   Limit the amount of test data created
-   Clean up test data promptly

## Examples

See the existing tests in:

-   `internal/handlers/auth/auth_service_test.go` for unit test examples
-   `test/e2e/auth_test.go` for integration test examples
-   `internal/testutils/` for utility function examples
