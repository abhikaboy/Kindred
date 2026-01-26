# Test Infrastructure Architecture

## Design Philosophy

This testing infrastructure follows the **ephemeral database pattern** for true test isolation and parallel execution safety.

## Key Decisions

### 1. Ephemeral Over Persistent

**Decision**: Each test gets a unique, temporary database that's automatically dropped.

**Rationale**:
- ✅ True test isolation - no interference between tests
- ✅ Parallel execution safe - tests can run concurrently
- ✅ No manual cleanup needed - databases auto-drop
- ✅ Reproducible - every test starts fresh
- ✅ Industry standard pattern

**Alternative Rejected**: Persistent "test" database
- ❌ Tests can interfere with each other
- ❌ Requires manual cleanup between tests
- ❌ Cannot run tests in parallel safely
- ❌ Leftover data from failed tests

### 2. Unique Database Names

**Implementation**: `test_{timestamp_nanoseconds}`

**Example**: `test_1706234567890123456`

**Rationale**:
- Timestamp ensures uniqueness
- Nanosecond precision prevents collisions
- Prefix makes test databases easy to identify
- Simple to implement and debug

### 3. Environment-Based Configuration

**Priority Order**:
1. `TEST_MONGO_URI` - explicit test URI
2. `MONGO_URI` - fallback to main URI
3. `mongodb://localhost:27017` - default

**Rationale**:
- Works with local MongoDB or Atlas
- Flexible for different environments (CI, local, etc.)
- No hardcoded credentials
- Easy to override per environment

### 4. Automatic Cleanup via Defer

**Pattern**:
```go
testDB, fixtures, _ := testing.SetupTestEnvironment()
defer testing.TeardownTestEnvironment(testDB)
```

**Rationale**:
- Idiomatic Go pattern
- Cleanup happens even if test panics
- Simple and hard to forget
- Works with t.Cleanup() as well

## Architecture Components

### 1. Fixtures (`fixtures.go`)

**Purpose**: Generate realistic test data for all collections

**Key Functions**:
- `NewTestFixtures()` - Creates complete fixture set
- `generateTest*()` - Individual collection generators
- `GetTest*()` - Type-safe accessors

**Design**:
- Fixtures are generated fresh each time
- Relationships between entities are maintained (users → posts → comments)
- Uses actual production types for type safety
- Realistic data that represents real-world scenarios

### 2. Database Utilities (`database.go`)

**Purpose**: Manage ephemeral database lifecycle

**Key Functions**:
- `NewEphemeralTestDatabase()` - Create unique database
- `SetupTestEnvironment()` - One-call setup (create + seed)
- `TeardownTestEnvironment()` - Drop database and cleanup
- `GetCollections()` - Access to all collections

**Design**:
- Single responsibility - database lifecycle only
- No business logic - just infrastructure
- Timeout handling for all operations
- Proper error propagation

### 3. CLI Tool (`cmd/seed-test-db/main.go`)

**Purpose**: Create test database for manual inspection

**Use Case**: Developer wants to explore test data in MongoDB Compass or mongosh

**Design**:
- Creates ephemeral database but doesn't drop it
- Prints database name for easy access
- Shows summary of seeded data
- Useful for debugging test scenarios

## Data Flow

```
Test Start
    ↓
NewEphemeralTestDatabase()
    ↓
Generate unique DB name (test_1234567890)
    ↓
Connect to MongoDB
    ↓
NewTestFixtures()
    ↓
Generate all fixture data
    ↓
SeedFixtures()
    ↓
Insert into collections
    ↓
Test Runs (with isolated data)
    ↓
defer TeardownTestEnvironment()
    ↓
DropDatabase()
    ↓
Close connection
    ↓
Test Complete
```

## Parallel Test Safety

Each test gets its own database:

```
Test A: test_1706234567890123456
Test B: test_1706234567890987654
Test C: test_1706234567891234567
```

All can run simultaneously without conflicts.

## Performance Considerations

### Database Creation
- **Cost**: ~100-200ms per database creation
- **Mitigation**: Negligible for integration tests
- **Benefit**: True isolation worth the cost

### Seeding
- **Cost**: ~50-100ms for all fixtures
- **Mitigation**: Fixtures are minimal but realistic
- **Benefit**: Consistent test data

### Cleanup
- **Cost**: ~50ms to drop database
- **Mitigation**: Happens in defer, doesn't block
- **Benefit**: No accumulation of test data

### Total Overhead
- **Per Test**: ~200-400ms
- **Acceptable**: For integration tests, isolation > speed
- **Optimization**: Use subtests to share setup when appropriate

## Future Enhancements

### Potential Improvements

1. **In-Memory MongoDB**
   - Use `mongodb-memory-server` for even faster tests
   - Eliminates network latency
   - Requires additional setup

2. **Fixture Subsets**
   - Allow tests to request only needed collections
   - `SetupTestEnvironmentWithCollections([]string{"users", "posts"})`
   - Faster seeding for simple tests

3. **Fixture Customization**
   - Allow tests to customize fixture data
   - `SetupTestEnvironmentWithCustomUsers(customUsers)`
   - More flexibility for edge cases

4. **Shared Databases for Subtests**
   - Create one database for parent test
   - Share across subtests
   - Drop after all subtests complete
   - Faster for test suites

5. **Database Pooling**
   - Pre-create databases
   - Reuse instead of create
   - Clean between uses
   - Faster test execution

## Migration Guide

### From Persistent to Ephemeral

**Before**:
```go
// Manually clean database
testDB.CleanDatabase()
// Seed
testDB.SeedFixtures(fixtures)
// Test
// Manually clean again
testDB.CleanDatabase()
```

**After**:
```go
// One call - creates fresh database
testDB, fixtures, _ := testing.SetupTestEnvironment()
defer testing.TeardownTestEnvironment(testDB)
// Test
// Automatic cleanup
```

**Benefits**:
- Less boilerplate
- Guaranteed isolation
- Automatic cleanup
- Parallel safe

## Troubleshooting

### Many test_* Databases Accumulating

**Cause**: Tests panicked before defer or were interrupted

**Solution**:
```bash
# Clean up all test databases
mongosh --eval 'db.adminCommand("listDatabases").databases
  .filter(d => d.name.startsWith("test_"))
  .forEach(d => db.getSiblingDB(d.name).dropDatabase())'
```

### Tests Failing with Connection Errors

**Cause**: MongoDB not running or wrong URI

**Solution**:
```bash
# Check MongoDB is running
brew services list | grep mongodb

# Set correct URI
export TEST_MONGO_URI="mongodb://localhost:27017"
```

### Slow Test Execution

**Cause**: Creating many databases

**Solution**:
- Use subtests to share database when appropriate
- Consider in-memory MongoDB for unit tests
- Ensure MongoDB is running locally (not Atlas) for dev

## References

- [Go Testing Best Practices](https://go.dev/doc/tutorial/add-a-test)
- [MongoDB Go Driver](https://www.mongodb.com/docs/drivers/go/current/)
- [Test Fixtures Pattern](https://en.wikipedia.org/wiki/Test_fixture)
