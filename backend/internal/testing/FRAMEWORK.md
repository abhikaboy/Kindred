# Testing Framework Guide

Production-grade testing framework for Kindred backend.

## Overview

This framework provides:
- **BaseSuite** - Automatic database setup/teardown per test
- **HTTPTestClient** - Test HTTP endpoints with fluent API
- **ServiceTestContext** - Test business logic/services
- **Builders** - Fluent API for creating test data
- **Helpers** - Utility functions for common operations
- **Fixtures** - Pre-seeded realistic test data

## Philosophy

✅ **Test through APIs** - Test endpoints and services, not database directly  
✅ **Integration tests** - Test real behavior, not mocked  
✅ **Isolated** - Each test gets fresh database  
✅ **Fast** - Ephemeral databases, no cleanup needed  
✅ **Readable** - Fluent APIs, clear assertions

## Quick Start

### HTTP Endpoint Testing

```go
package mypackage_test

import (
	"testing"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/gofiber/fiber/v2"
)

type MyTestSuite struct {
	testpkg.BaseSuite
}

func (s *MyTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	
	// Setup your Fiber app
	app := fiber.New()
	// Register routes...
	
	// Create HTTP client
	s.HTTP = testpkg.NewHTTPTestClient(s.T(), app)
	user := s.GetUser(0)
	s.HTTP.WithAuth("token", user.ID.Hex())
}

func TestMySuite(t *testing.T) {
	testpkg.RunSuite(t, new(MyTestSuite))
}

func (s *MyTestSuite) TestCreatePost() {
	body := map[string]interface{}{
		"caption": "Test post",
	}
	
	var response PostResponse
	s.HTTP.POST("/api/v1/posts", body).
		AssertCreated().
		JSON(&response)
	
	s.Equal("Test post", response.Caption)
}
```

### Service Testing

```go
func (s *MyTestSuite) TestService() {
	ctx := testpkg.NewServiceTestContext(s.T(), s.TestDB, s.Fixtures)
	service := NewMyService(s.TestDB.DB)
	
	result, err := service.DoSomething(ctx.Context(), userID)
	
	ctx.AssertNoError(err)
	ctx.AssertNotNil(result)
}
```

## Components

### 1. HTTPTestClient

Test HTTP endpoints with a fluent API.

**Methods**:
- `GET(path)` - Perform GET request
- `POST(path, body)` - Perform POST with JSON body
- `PUT(path, body)` - Perform PUT with JSON body
- `PATCH(path, body)` - Perform PATCH with JSON body
- `DELETE(path)` - Perform DELETE request
- `WithAuth(token, userID)` - Set authentication

**Response Assertions**:
- `AssertStatus(code)` - Assert specific status
- `AssertOK()` - Assert 200
- `AssertCreated()` - Assert 201
- `AssertBadRequest()` - Assert 400
- `AssertUnauthorized()` - Assert 401
- `AssertNotFound()` - Assert 404
- `JSON(&result)` - Decode JSON response
- `AssertJSON(expected)` - Assert JSON matches
- `AssertContains(string)` - Assert body contains string
- `Print()` - Print response for debugging

**Example**:
```go
// Test creating a post
body := map[string]interface{}{
	"caption": "Test post",
	"visibility": "public",
}

var response PostResponse
s.HTTP.POST("/api/v1/posts", body).
	AssertCreated().
	AssertHeader("Content-Type", "application/json").
	JSON(&response)

s.Equal("Test post", response.Caption)
s.NotEmpty(response.ID)

// Test getting a post
s.HTTP.GET("/api/v1/posts/" + response.ID).
	AssertOK().
	AssertJSON(response)

// Test error cases
s.HTTP.POST("/api/v1/posts", map[string]interface{}{}).
	AssertBadRequest().
	AssertContains("validation failed")
```

### 2. ServiceTestContext

Test business logic and services.

**Methods**:
- `DB()` - Get database
- `Context()` - Get context
- `Collection(name)` - Get collection
- `GetUser(index)` - Get fixture user
- `GetPost(index)` - Get fixture post
- `AssertNoError(err)` - Assert no error
- `AssertError(err)` - Assert error exists
- `AssertEqual(expected, actual)` - Assert equality
- `AssertNotNil(value)` - Assert not nil
- `AssertNil(value)` - Assert nil

**Example**:
```go
func (s *MyTestSuite) TestPostService() {
	ctx := testpkg.NewServiceTestContext(s.T(), s.TestDB, s.Fixtures)
	service := post.NewService(s.TestDB.DB)
	
	user := ctx.GetUser(0)
	
	// Test service method
	result, err := service.CreatePost(ctx.Context(), user.ID, postData)
	
	ctx.AssertNoError(err)
	ctx.AssertNotNil(result)
	ctx.AssertEqual("Test", result.Caption)
}
```

### 3. BaseSuite

Extends `testify/suite` with automatic database management.

**Features**:
- Fresh ephemeral database per test
- Auto-seeded fixtures
- Automatic cleanup
- Context and collections ready to use

**Usage**:
```go
type MyTestSuite struct {
	testpkg.BaseSuite
}

func (s *MyTestSuite) TestExample() {
	// s.TestDB - database connection
	// s.Fixtures - pre-seeded data
	// s.Collections - map of all collections
	// s.Ctx - context.Background()
	
	user := s.GetUser(0)
	post := s.GetPost(0)
	
	s.InsertOne("posts", myPost)
	s.FindOne("posts", filter, &result)
	count := s.CountDocuments("posts", filter)
}
```

### 2. Builders

Fluent API for creating test data with sensible defaults.

**UserBuilder**:
```go
user := testpkg.NewUserBuilder().
	WithEmail("john@example.com").
	WithHandle("johndoe").
	WithDisplayName("John Doe").
	WithTokenUsed(true).
	Build()
```

**PostBuilder**:
```go
post := testpkg.NewPostBuilder(user).
	WithCaption("My awesome post").
	WithImages([]string{"url1.jpg", "url2.jpg"}).
	WithVisibility("public").
	WithTask(taskID, "Task Title").
	Build()
```

**CommentBuilder**:
```go
comment := testpkg.NewCommentBuilder(user).
	WithContent("Great post!").
	WithParentID(parentCommentID).
	WithMentions([]types.MentionReference{{ID: userID, Handle: "user"}}).
	Build()
```

### 3. TestHelper

Utility functions for database operations.

```go
helper := testpkg.NewTestHelper(t, db)

// Insert
id := helper.InsertDocument("posts", post)

// Find
helper.FindDocument("posts", bson.M{"_id": id}, &result)
docs := helper.FindDocuments("posts", bson.M{"user": userID})

// Count
count := helper.CountDocuments("posts", bson.M{"visibility": "public"})

// Update
helper.UpdateDocument("posts", filter, update)

// Delete
helper.DeleteDocument("posts", filter)

// Assertions
helper.AssertDocumentExists("posts", bson.M{"_id": id})
helper.AssertDocumentNotExists("posts", bson.M{"_id": deletedID})
helper.AssertDocumentCount("posts", filter, 5)
```

### 4. Utility Functions

```go
// Generate IDs
id := testpkg.GenerateObjectID()
id := testpkg.MustObjectIDFromHex("507f1f77bcf86cd799439011")

// Pointers
s := testpkg.StringPtr("hello")
i := testpkg.IntPtr(42)
b := testpkg.BoolPtr(true)
```

## Best Practices

### 1. Use BaseSuite for Integration Tests

```go
type PostServiceTestSuite struct {
	testpkg.BaseSuite
}

func TestPostService(t *testing.T) {
	testpkg.RunSuite(t, new(PostServiceTestSuite))
}

func (s *PostServiceTestSuite) TestCreatePost() {
	// Each test gets fresh database
	user := s.GetUser(0)
	post := testpkg.NewPostBuilder(*user).Build()
	s.InsertOne("posts", post)
	
	// Assertions
	s.Assert().NotNil(post.ID)
}
```

### 2. Use Builders for Test Data

```go
// Good: Clear, maintainable
user := testpkg.NewUserBuilder().
	WithEmail("test@example.com").
	WithHandle("testuser").
	Build()

// Bad: Verbose, error-prone
user := types.User{
	ID: primitive.NewObjectID(),
	Email: "test@example.com",
	// ... 20 more fields
}
```

### 3. Use Fixtures for Common Data

```go
// Get pre-seeded users
user1 := s.GetUser(0)  // testuser1
user2 := s.GetUser(1)  // testuser2
user3 := s.GetUser(2)  // testuser3

// Get pre-seeded posts
post := s.GetPost(0)

// All relationships are set up
// user1 ↔ user2 are friends
// user2 ↔ user3 are friends
```

### 4. Group Related Tests

```go
type PostServiceTestSuite struct {
	testpkg.BaseSuite
}

func (s *PostServiceTestSuite) TestCreatePost() { /* ... */ }
func (s *PostServiceTestSuite) TestUpdatePost() { /* ... */ }
func (s *PostServiceTestSuite) TestDeletePost() { /* ... */ }
func (s *PostServiceTestSuite) TestGetPost() { /* ... */ }
```

### 5. Use Subtests for Variations

```go
func (s *PostServiceTestSuite) TestPostVisibility() {
	testCases := []struct{
		name string
		visibility string
		expectedCount int
	}{
		{"public posts", "public", 5},
		{"friends only", "friends", 3},
		{"private posts", "private", 1},
	}
	
	for _, tc := range testCases {
		s.Run(tc.name, func() {
			count := s.CountDocuments("posts", 
				bson.M{"visibility": tc.visibility})
			s.Equal(tc.expectedCount, count)
		})
	}
}
```

## Example: Complete Test Suite

```go
package post_test

import (
	"testing"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"go.mongodb.org/mongo-driver/bson"
)

type PostServiceTestSuite struct {
	testpkg.BaseSuite
}

func TestPostService(t *testing.T) {
	testpkg.RunSuite(t, new(PostServiceTestSuite))
}

func (s *PostServiceTestSuite) TestCreatePost() {
	user := s.GetUser(0)
	
	post := testpkg.NewPostBuilder(*user).
		WithCaption("Test post").
		Build()
	
	s.InsertOne("posts", post)
	
	var found types.PostDocument
	s.FindOne("posts", bson.M{"_id": post.ID}, &found)
	
	s.Equal("Test post", found.Caption)
	s.Equal(user.ID, found.User.ID)
}

func (s *PostServiceTestSuite) TestAddComment() {
	user := s.GetUser(0)
	post := s.GetPost(0)
	
	comment := testpkg.NewCommentBuilder(*user).
		WithContent("Great!").
		Build()
	
	post.Comments = append(post.Comments, comment)
	
	helper := testpkg.NewTestHelper(s.T(), s.TestDB.DB)
	helper.UpdateDocument("posts",
		bson.M{"_id": post.ID},
		bson.M{"$set": bson.M{"comments": post.Comments}},
	)
	
	var updated types.PostDocument
	s.FindOne("posts", bson.M{"_id": post.ID}, &updated)
	
	s.Len(updated.Comments, 1)
	s.Equal("Great!", updated.Comments[0].Content)
}
```

## Running Tests

```bash
# Run all tests
make test-backend

# Run specific package
cd backend && go test ./internal/handlers/post -v

# Run specific test
cd backend && go test ./internal/handlers/post -v -run TestPostService

# Run with coverage
cd backend && go test ./... -cover

# Run with race detection
cd backend && go test ./... -race
```

## Tips

1. **One assertion per test** - Makes failures clearer
2. **Use descriptive test names** - `TestCreatePostWithTask` not `TestPost1`
3. **Test edge cases** - Empty strings, nil values, boundary conditions
4. **Don't test implementation** - Test behavior, not internals
5. **Keep tests fast** - Use fixtures, avoid sleep()
6. **Clean test data** - Use builders, not copy-paste
7. **Test failures too** - Verify error handling

## Common Patterns

### Testing Service Methods

```go
func (s *MyTestSuite) TestMyService() {
	// Setup
	user := s.GetUser(0)
	service := NewMyService(s.TestDB.DB)
	
	// Execute
	result, err := service.DoSomething(user.ID)
	
	// Assert
	s.NoError(err)
	s.NotNil(result)
}
```

### Testing with Multiple Users

```go
func (s *MyTestSuite) TestUserInteraction() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// user1 creates post
	post := testpkg.NewPostBuilder(*user1).Build()
	s.InsertOne("posts", post)
	
	// user2 comments
	comment := testpkg.NewCommentBuilder(*user2).Build()
	// ... add comment logic
}
```

### Testing Relationships

```go
func (s *MyTestSuite) TestFriendship() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)
	
	// They're already friends from fixtures
	count := s.CountDocuments("connections", bson.M{
		"users": bson.M{"$all": []primitive.ObjectID{user1.ID, user2.ID}},
		"status": "friends",
	})
	
	s.Equal(int64(1), count)
}
```

## Troubleshooting

### Tests are slow
- Use fixtures instead of creating data
- Run MongoDB locally, not Atlas
- Use `t.Parallel()` for independent tests

### Database not cleaning up
- Ensure `defer TeardownTestEnvironment()` is called
- Check that tests don't panic before cleanup
- Use `make mongodb-start` to ensure MongoDB is running

### Fixtures not loading
- Check MongoDB connection
- Verify fixture data matches actual schema
- Look for compilation errors in fixtures.go

### Import cycle errors
- Use separate `_test` package: `package mypackage_test`
- Import your package: `import "github.com/abhikaboy/Kindred/internal/handlers/mypackage"`
