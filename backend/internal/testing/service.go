package testing

import (
	"context"
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/mongo"
)

// ServiceTestContext provides context for testing services
type ServiceTestContext struct {
	t           *testing.T
	db          *mongo.Database
	ctx         context.Context
	fixtures    *TestFixtures
	collections map[string]*mongo.Collection
}

// NewServiceTestContext creates a new service test context
func NewServiceTestContext(t *testing.T, testDB *TestDatabase, fixtures *TestFixtures) *ServiceTestContext {
	return &ServiceTestContext{
		t:           t,
		db:          testDB.DB,
		ctx:         context.Background(),
		fixtures:    fixtures,
		collections: testDB.GetCollections(),
	}
}

// DB returns the database
func (s *ServiceTestContext) DB() *mongo.Database {
	return s.db
}

// Context returns the context
func (s *ServiceTestContext) Context() context.Context {
	return s.ctx
}

// Collection returns a collection by name
func (s *ServiceTestContext) Collection(name string) *mongo.Collection {
	coll := s.collections[name]
	require.NotNil(s.t, coll, "Collection %s not found", name)
	return coll
}

// GetUser returns a fixture user
func (s *ServiceTestContext) GetUser(index int) *types.User {
	return s.fixtures.GetTestUser(index)
}

// GetPost returns a fixture post
func (s *ServiceTestContext) GetPost(index int) *types.PostDocument {
	return s.fixtures.GetTestPost(index)
}

// AssertNoError asserts no error occurred
func (s *ServiceTestContext) AssertNoError(err error, msgAndArgs ...interface{}) {
	require.NoError(s.t, err, msgAndArgs...)
}

// AssertError asserts an error occurred
func (s *ServiceTestContext) AssertError(err error, msgAndArgs ...interface{}) {
	require.Error(s.t, err, msgAndArgs...)
}

// AssertEqual asserts two values are equal
func (s *ServiceTestContext) AssertEqual(expected, actual interface{}, msgAndArgs ...interface{}) {
	require.Equal(s.t, expected, actual, msgAndArgs...)
}

// AssertNotNil asserts a value is not nil
func (s *ServiceTestContext) AssertNotNil(value interface{}, msgAndArgs ...interface{}) {
	require.NotNil(s.t, value, msgAndArgs...)
}

// AssertNil asserts a value is nil
func (s *ServiceTestContext) AssertNil(value interface{}, msgAndArgs ...interface{}) {
	require.Nil(s.t, value, msgAndArgs...)
}
