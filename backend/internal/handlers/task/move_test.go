package task

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type MoveTaskTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

func (s *MoveTaskTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)

	// MoveTask performs a multi-document transaction, which MongoDB only allows
	// on a replica set or mongos. Local and CI test databases are frequently
	// standalone mongod instances, so skip these cases there rather than failing.
	if !s.supportsTransactions() {
		s.T().Skip("MoveTask requires a replica set for transactions; skipping on standalone mongod")
	}
}

// supportsTransactions reports whether the connected MongoDB deployment can run
// multi-document transactions (replica set or sharded cluster).
func (s *MoveTaskTestSuite) supportsTransactions() bool {
	var res bson.M
	err := s.Collections["categories"].Database().
		RunCommand(s.Ctx, bson.D{{Key: "hello", Value: 1}}).Decode(&res)
	if err != nil {
		return false
	}
	if _, ok := res["setName"]; ok { // replica set member
		return true
	}
	if msg, ok := res["msg"]; ok && msg == "isdbgrid" { // mongos (sharded cluster)
		return true
	}
	return false
}

func TestMoveTaskService(t *testing.T) {
	suite.Run(t, new(MoveTaskTestSuite))
}

func (s *MoveTaskTestSuite) insertCategory(userID primitive.ObjectID, name string, tasks []TaskDocument) primitive.ObjectID {
	cat := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          name,
		User:          userID,
		WorkspaceName: "Test Workspace",
		Tasks:         tasks,
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, cat)
	s.NoError(err)
	return cat.ID
}

func (s *MoveTaskTestSuite) loadTasks(categoryID primitive.ObjectID) []TaskDocument {
	var cat types.CategoryDocument
	err := s.Collections["categories"].FindOne(s.Ctx, bson.M{"_id": categoryID}).Decode(&cat)
	s.NoError(err)
	return cat.Tasks
}

func (s *MoveTaskTestSuite) TestMoveTask_MovesToTopOfTarget() {
	user := s.GetUser(0)
	taskID := primitive.NewObjectID()
	movingTask := TaskDocument{ID: taskID, UserID: user.ID, Content: "Move me", Priority: 1, Active: true, Timestamp: xutils.NowUTC()}
	existingTarget := TaskDocument{ID: primitive.NewObjectID(), UserID: user.ID, Content: "Already here", Priority: 1, Active: true, Timestamp: xutils.NowUTC()}

	sourceID := s.insertCategory(user.ID, "Source", []TaskDocument{movingTask})
	movingTask.CategoryID = sourceID
	targetID := s.insertCategory(user.ID, "Target", []TaskDocument{existingTarget})

	moved, err := s.service.MoveTask(user.ID, sourceID, taskID, targetID)
	s.NoError(err)
	s.NotNil(moved)
	s.Equal(targetID, moved.CategoryID)

	s.Len(s.loadTasks(sourceID), 0)

	targetTasks := s.loadTasks(targetID)
	s.Len(targetTasks, 2)
	s.Equal(taskID, targetTasks[0].ID)
	s.Equal(targetID, targetTasks[0].CategoryID)
}

func (s *MoveTaskTestSuite) TestMoveTask_RepointsTemplate() {
	user := s.GetUser(0)
	templateID := primitive.NewObjectID()
	taskID := primitive.NewObjectID()
	movingTask := TaskDocument{ID: taskID, UserID: user.ID, Content: "Recurring", Priority: 1, Active: true, Timestamp: xutils.NowUTC(), TemplateID: &templateID}

	sourceID := s.insertCategory(user.ID, "Source", []TaskDocument{movingTask})
	targetID := s.insertCategory(user.ID, "Target", []TaskDocument{})

	template := &TemplateTaskDocument{
		ID: templateID, UserID: user.ID, CategoryID: sourceID,
		Content: "Recurring", Priority: 1, Value: 5,
		RecurFrequency: "daily", RecurType: "OCCURRENCE",
		RecurDetails: &RecurDetails{Every: 1}, LastEdited: xutils.NowUTC(),
	}
	_, err := s.Collections["template-tasks"].InsertOne(s.Ctx, template)
	s.NoError(err)

	_, err = s.service.MoveTask(user.ID, sourceID, taskID, targetID)
	s.NoError(err)

	var updated TemplateTaskDocument
	err = s.Collections["template-tasks"].FindOne(s.Ctx, bson.M{"_id": templateID}).Decode(&updated)
	s.NoError(err)
	s.Equal(targetID, updated.CategoryID, "template should re-point to the target category")
}

func (s *MoveTaskTestSuite) TestMoveTask_SameCategoryIsNoop() {
	user := s.GetUser(0)
	taskID := primitive.NewObjectID()
	task := TaskDocument{ID: taskID, UserID: user.ID, Content: "Stay", Priority: 1, Active: true, Timestamp: xutils.NowUTC()}
	catID := s.insertCategory(user.ID, "Cat", []TaskDocument{task})

	moved, err := s.service.MoveTask(user.ID, catID, taskID, catID)
	s.NoError(err)
	s.NotNil(moved)
	s.Equal(taskID, moved.ID)
	s.Len(s.loadTasks(catID), 1)
}

func (s *MoveTaskTestSuite) TestMoveTask_TargetOwnedByOtherUserRejected() {
	user := s.GetUser(0)
	other := s.GetUser(1)
	taskID := primitive.NewObjectID()
	task := TaskDocument{ID: taskID, UserID: user.ID, Content: "Move me", Priority: 1, Active: true, Timestamp: xutils.NowUTC()}
	sourceID := s.insertCategory(user.ID, "Source", []TaskDocument{task})
	foreignTargetID := s.insertCategory(other.ID, "Foreign", []TaskDocument{})

	_, err := s.service.MoveTask(user.ID, sourceID, taskID, foreignTargetID)
	s.ErrorIs(err, ErrNotCategoryOwner)

	s.Len(s.loadTasks(sourceID), 1)
}

func (s *MoveTaskTestSuite) TestMoveTask_TaskNotFound() {
	user := s.GetUser(0)
	sourceID := s.insertCategory(user.ID, "Source", []TaskDocument{})
	targetID := s.insertCategory(user.ID, "Target", []TaskDocument{})

	_, err := s.service.MoveTask(user.ID, sourceID, primitive.NewObjectID(), targetID)
	s.ErrorIs(err, ErrTaskNotFound)
}

var _ = time.Second
