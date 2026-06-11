package task

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
)

type LogServiceTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

func (s *LogServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
}

func TestLogService(t *testing.T) {
	suite.Run(t, new(LogServiceTestSuite))
}

func (s *LogServiceTestSuite) TestLogTasks_CreatesLoggedCategoryAndCompletesTasks() {
	user := s.GetUser(0)

	result, err := s.service.LogTasks(user.ID, "Personal", []string{"gym", "called mom"})
	s.NoError(err)
	s.Equal(2, result.TasksLogged)
	s.Empty(result.FailedIndices)

	// A "Logged" category exists in the workspace, with no open tasks left in it
	var category types.CategoryDocument
	err = s.Collections["categories"].FindOne(s.Ctx, bson.M{
		"user":          user.ID,
		"workspaceName": "Personal",
		"name":          "Logged",
	}).Decode(&category)
	s.NoError(err)
	s.Empty(category.Tasks, "logged tasks must not remain open in the category")

	// Both tasks landed in completed-tasks with a completion timestamp
	count, err := s.Collections["completed-tasks"].CountDocuments(s.Ctx, bson.M{
		"user":       user.ID,
		"categoryID": category.ID,
	})
	s.NoError(err)
	s.Equal(int64(2), count)

	var completed struct {
		Content       string `bson:"content"`
		Active        bool   `bson:"active"`
		TimeCompleted any    `bson:"timeCompleted"`
	}
	err = s.Collections["completed-tasks"].FindOne(s.Ctx, bson.M{
		"user": user.ID, "content": "gym",
	}).Decode(&completed)
	s.NoError(err)
	s.False(completed.Active)
	s.NotNil(completed.TimeCompleted)

	// User's lifetime completion count moved by 2
	userAfter, err := s.service.Users.GetUserByID(s.Ctx, user.ID)
	s.NoError(err)
	s.Equal(user.TasksComplete+2, userAfter.TasksComplete)
}

func (s *LogServiceTestSuite) TestLogTasks_ReusesExistingLoggedCategory() {
	user := s.GetUser(0)

	_, err := s.service.LogTasks(user.ID, "Personal", []string{"first"})
	s.NoError(err)
	_, err = s.service.LogTasks(user.ID, "Personal", []string{"second"})
	s.NoError(err)

	count, err := s.Collections["categories"].CountDocuments(s.Ctx, bson.M{
		"user":          user.ID,
		"workspaceName": "Personal",
		"name":          "Logged",
	})
	s.NoError(err)
	s.Equal(int64(1), count, "second call must reuse the Logged category")
}

func (s *LogServiceTestSuite) TestLogTasks_SeparateCategoriesPerWorkspace() {
	user := s.GetUser(0)

	_, err := s.service.LogTasks(user.ID, "Personal", []string{"a"})
	s.NoError(err)
	_, err = s.service.LogTasks(user.ID, "Work", []string{"b"})
	s.NoError(err)

	count, err := s.Collections["categories"].CountDocuments(s.Ctx, bson.M{
		"user": user.ID,
		"name": "Logged",
	})
	s.NoError(err)
	s.Equal(int64(2), count)
}
