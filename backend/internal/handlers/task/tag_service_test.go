package task

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type TagServiceTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

func (s *TagServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
}

func TestTagService(t *testing.T) {
	suite.Run(t, new(TagServiceTestSuite))
}

func (s *TagServiceTestSuite) TestBuildTaggedUsers_DenormalizesUserInfo() {
	friend := s.GetUser(1)

	tagged, err := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})

	s.NoError(err)
	s.Len(tagged, 1)
	s.Equal(friend.ID, tagged[0].ID)
	s.Equal(friend.Handle, tagged[0].Handle)
	s.Equal(friend.DisplayName, tagged[0].DisplayName)
	s.Equal(types.TagStatusPending, tagged[0].Status)
}

func (s *TagServiceTestSuite) TestBuildTaggedUsers_SkipsInvalidAndUnknownIDs() {
	tagged, err := s.service.BuildTaggedUsers([]string{"not-an-objectid", primitive.NewObjectID().Hex()})

	s.NoError(err)
	s.Len(tagged, 0)
}

func (s *TagServiceTestSuite) TestBuildTaggedUsers_DeduplicatesRepeatedIDs() {
	friend := s.GetUser(1)

	tagged, err := s.service.BuildTaggedUsers([]string{friend.ID.Hex(), friend.ID.Hex()})

	s.NoError(err)
	s.Len(tagged, 1)
	s.Equal(friend.ID, tagged[0].ID)
}

func (s *TagServiceTestSuite) TestNotifyTaggedUsers_CreatesNotificationRecordAndSendsPush() {
	owner := s.GetUser(0)
	friend := s.GetUser(1)

	// Create a category for the owner
	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          owner.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	tagged, err := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})
	s.NoError(err)

	task := TaskDocument{
		ID:          primitive.NewObjectID(),
		Content:     "Read 30 mins",
		Priority:    1,
		Value:       2,
		UserID:      owner.ID,
		CategoryID:  category.ID,
		Active:      true,
		TaggedUsers: tagged,
	}

	s.service.NotifyTaggedUsers(&task, owner.ID)

	// Assert a TASK_TAGGED notification record exists for friend (receiver)
	count := s.CountDocuments("notifications", bson.M{
		"receiver":         friend.ID,
		"notificationType": "TASK_TAGGED",
		"reference_id":     task.ID,
	})
	s.Equal(int64(1), count, "expected one TASK_TAGGED notification record for the tagged friend")

	// Assert a push was sent to friend's push token
	s.AssertPushNotificationSent(friend.PushToken, "expected push notification sent to tagged friend")
}

func (s *TagServiceTestSuite) TestNotifyTaggedUsers_SkipsNonPendingUsers() {
	owner := s.GetUser(0)
	friend := s.GetUser(1)

	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          owner.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	// Build tagged user but set status to watching — should be skipped
	tagged := []types.TaggedTaskUser{
		{
			ID:          friend.ID,
			Handle:      friend.Handle,
			DisplayName: friend.DisplayName,
			Status:      types.TagStatusWatching,
		},
	}

	task := TaskDocument{
		ID:          primitive.NewObjectID(),
		Content:     "Read 30 mins",
		UserID:      owner.ID,
		CategoryID:  category.ID,
		TaggedUsers: tagged,
	}

	s.service.NotifyTaggedUsers(&task, owner.ID)

	// No notification record should exist
	count := s.CountDocuments("notifications", bson.M{
		"receiver":         friend.ID,
		"notificationType": "TASK_TAGGED",
	})
	s.Equal(int64(0), count, "non-pending tagged users should not receive notifications")

	// No push should have been sent
	s.AssertPushNotificationNotSent(friend.PushToken, "non-pending tagged users should not receive push")
}

func (s *TagServiceTestSuite) TestCreateTask_PersistsTaggedUsers() {
	owner := s.GetUser(0)
	friend := s.GetUser(1)

	// Create a category for the owner (mirrors the pattern in service_test.go)
	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          owner.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	tagged, err := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})
	s.NoError(err)

	task := TaskDocument{
		ID:          primitive.NewObjectID(),
		Content:     "Read 30 mins",
		Priority:    1,
		Value:       2,
		UserID:      owner.ID,
		CategoryID:  category.ID,
		Active:      true,
		TaggedUsers: tagged,
	}
	created, err := s.service.CreateTask(category.ID, &task)
	s.NoError(err)

	fetched, err := s.service.GetTaskByID(created.ID, owner.ID)
	s.NoError(err)
	s.Len(fetched.TaggedUsers, 1)
	s.Equal(types.TagStatusPending, fetched.TaggedUsers[0].Status)
}

func (s *TagServiceTestSuite) TestUpdateTaskTags_AddsAndRemovesPendingOnly() {
	owner := s.GetUser(0)
	friendA := s.GetUser(1)
	friendB := s.GetUser(2)

	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          owner.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	// Seed: task tagged with A (already watching) — responded entries must survive removal
	tagged, _ := s.service.BuildTaggedUsers([]string{friendA.ID.Hex()})
	tagged[0].Status = types.TagStatusWatching
	task := TaskDocument{
		ID:          primitive.NewObjectID(),
		Content:     "x",
		Priority:    1,
		Value:       1,
		UserID:      owner.ID,
		CategoryID:  category.ID,
		Active:      true,
		TaggedUsers: tagged,
	}
	created, err := s.service.CreateTask(category.ID, &task)
	s.NoError(err)

	// Update to only B: A is watching so must remain; B added as pending
	added, err := s.service.UpdateTaskTags(owner.ID, category.ID, created.ID, []string{friendB.ID.Hex()})
	s.NoError(err)
	s.Len(added, 1)
	s.Equal(friendB.ID, added[0].ID)

	fetched, err := s.service.GetTaskByID(created.ID, owner.ID)
	s.NoError(err)
	s.Len(fetched.TaggedUsers, 2)

	byID := map[primitive.ObjectID]types.TagStatus{}
	for _, tu := range fetched.TaggedUsers {
		byID[tu.ID] = tu.Status
	}
	s.Equal(types.TagStatusWatching, byID[friendA.ID])
	s.Equal(types.TagStatusPending, byID[friendB.ID])
}

func (s *TagServiceTestSuite) TestUpdateTaskTags_RemovesPendingEntry() {
	owner := s.GetUser(0)
	friendA := s.GetUser(1)

	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          owner.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	tagged, _ := s.service.BuildTaggedUsers([]string{friendA.ID.Hex()})
	task := TaskDocument{
		ID:          primitive.NewObjectID(),
		Content:     "x",
		Priority:    1,
		Value:       1,
		UserID:      owner.ID,
		CategoryID:  category.ID,
		Active:      true,
		TaggedUsers: tagged,
	}
	created, err := s.service.CreateTask(category.ID, &task)
	s.NoError(err)

	_, err = s.service.UpdateTaskTags(owner.ID, category.ID, created.ID, []string{})
	s.NoError(err)

	fetched, err := s.service.GetTaskByID(created.ID, owner.ID)
	s.NoError(err)
	s.Len(fetched.TaggedUsers, 0)
}

func (s *TagServiceTestSuite) TestUpdateTaskTags_RespondedUserResuppliedKeepsStatus() {
	owner := s.GetUser(0)
	friendA := s.GetUser(1)

	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          owner.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	// Seed: A already responded (watching)
	tagged, _ := s.service.BuildTaggedUsers([]string{friendA.ID.Hex()})
	tagged[0].Status = types.TagStatusWatching
	task := TaskDocument{
		ID:          primitive.NewObjectID(),
		Content:     "x",
		Priority:    1,
		Value:       1,
		UserID:      owner.ID,
		CategoryID:  category.ID,
		Active:      true,
		TaggedUsers: tagged,
	}
	created, err := s.service.CreateTask(category.ID, &task)
	s.NoError(err)

	// Re-supplying A must not duplicate the entry or reset it to pending
	added, err := s.service.UpdateTaskTags(owner.ID, category.ID, created.ID, []string{friendA.ID.Hex()})
	s.NoError(err)
	s.Len(added, 0)

	fetched, err := s.service.GetTaskByID(created.ID, owner.ID)
	s.NoError(err)
	s.Len(fetched.TaggedUsers, 1)
	s.Equal(friendA.ID, fetched.TaggedUsers[0].ID)
	s.Equal(types.TagStatusWatching, fetched.TaggedUsers[0].Status)
}

func (s *TagServiceTestSuite) TestUpdateTaskTags_MirrorsToTemplate() {
	owner := s.GetUser(0)
	friendA := s.GetUser(1)

	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          owner.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	templateID := primitive.NewObjectID()
	template := &types.TemplateTaskDocument{
		ID:         templateID,
		UserID:     owner.ID,
		CategoryID: category.ID,
		Content:    "x",
		Priority:   1,
		Value:      1,
		RecurType:  "Occurrence",
	}
	_, err = s.Collections["template-tasks"].InsertOne(s.Ctx, template)
	s.NoError(err)

	task := TaskDocument{
		ID:         primitive.NewObjectID(),
		Content:    "x",
		Priority:   1,
		Value:      1,
		UserID:     owner.ID,
		CategoryID: category.ID,
		Active:     true,
		Recurring:  true,
		TemplateID: &templateID,
	}
	created, err := s.service.CreateTask(category.ID, &task)
	s.NoError(err)

	_, err = s.service.UpdateTaskTags(owner.ID, category.ID, created.ID, []string{friendA.ID.Hex()})
	s.NoError(err)

	var tmpl types.TemplateTaskDocument
	err = s.Collections["template-tasks"].FindOne(s.Ctx, bson.M{"_id": templateID}).Decode(&tmpl)
	s.NoError(err)
	s.Len(tmpl.TaggedUsers, 1)
	s.Equal(friendA.ID, tmpl.TaggedUsers[0].ID)
	s.Equal(types.TagStatusPending, tmpl.TaggedUsers[0].Status)
}
