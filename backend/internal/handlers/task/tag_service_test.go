package task

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
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

func (s *TagServiceTestSuite) TestGetPendingTaggedTasks_ReturnsTaskAndTagger() {
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

	tagged, _ := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})
	task := TaskDocument{ID: primitive.NewObjectID(), Content: "Read 30 mins", Priority: 1, Value: 2,
		UserID: owner.ID, CategoryID: category.ID, Active: true, TaggedUsers: tagged}
	_, err = s.service.CreateTask(category.ID, &task)
	s.NoError(err)

	pending, err := s.service.GetPendingTaggedTasks(friend.ID)
	s.NoError(err)
	s.Len(pending, 1)
	s.Equal("Read 30 mins", pending[0].Content)
	s.Equal(owner.ID, pending[0].Tagger.ID)
	s.Equal(owner.DisplayName, pending[0].Tagger.DisplayName)

	// Owner themselves has no pending tags
	none, err := s.service.GetPendingTaggedTasks(owner.ID)
	s.NoError(err)
	s.Len(none, 0)
}

func (s *TagServiceTestSuite) TestGetPendingTaggedTasks_ExcludesNonPendingStatus() {
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

	// Task where friend already responded (watching) — must NOT appear
	tagged := []types.TaggedTaskUser{
		{
			ID:          friend.ID,
			Handle:      friend.Handle,
			DisplayName: friend.DisplayName,
			Status:      types.TagStatusWatching,
		},
	}
	task := TaskDocument{ID: primitive.NewObjectID(), Content: "Watched task", Priority: 1, Value: 1,
		UserID: owner.ID, CategoryID: category.ID, Active: true, TaggedUsers: tagged}
	_, err = s.service.CreateTask(category.ID, &task)
	s.NoError(err)

	none, err := s.service.GetPendingTaggedTasks(friend.ID)
	s.NoError(err)
	s.Len(none, 0, "watching-status entry must not appear in pending results")
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

func (s *TagServiceTestSuite) TestRespondToTaskTag_UpdatesStatusAndTemplate() {
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

	tagged, _ := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})

	templateID := primitive.NewObjectID()
	tmplDoc := &types.TemplateTaskDocument{
		ID:          templateID,
		UserID:      owner.ID,
		CategoryID:  category.ID,
		Content:     "Read 30 mins",
		Priority:    1,
		Value:       2,
		RecurType:   "OCCURRENCE",
		TaggedUsers: tagged,
	}
	_, err = s.Collections["template-tasks"].InsertOne(s.Ctx, tmplDoc)
	s.NoError(err)

	task := TaskDocument{
		ID:          primitive.NewObjectID(),
		Content:     "Read 30 mins",
		Priority:    1,
		Value:       2,
		UserID:      owner.ID,
		CategoryID:  category.ID,
		Active:      true,
		Recurring:   true,
		TemplateID:  &templateID,
		TaggedUsers: tagged,
	}
	created, err := s.service.CreateTask(category.ID, &task)
	s.NoError(err)

	err = s.service.RespondToTaskTag(created.ID, friend.ID, types.TagStatusWatching)
	s.NoError(err)

	fetched, err := s.service.GetTaskByID(created.ID, owner.ID)
	s.NoError(err)
	s.Equal(types.TagStatusWatching, fetched.TaggedUsers[0].Status)

	tmpl, err := s.service.GetTemplateByID(templateID)
	s.NoError(err)
	s.Equal(types.TagStatusWatching, tmpl.TaggedUsers[0].Status)
}

func (s *TagServiceTestSuite) TestRespondToTaskTag_RejectsInvalidStatus() {
	err := s.service.RespondToTaskTag(primitive.NewObjectID(), primitive.NewObjectID(), "bogus")
	s.Error(err)
}

func (s *TagServiceTestSuite) TestRespondToTaskTag_UnknownTaskReturnsNotFound() {
	err := s.service.RespondToTaskTag(primitive.NewObjectID(), primitive.NewObjectID(), types.TagStatusWatching)
	s.ErrorIs(err, mongo.ErrNoDocuments)
}

func (s *TagServiceTestSuite) TestNotifyTaskCopied_CreatesRecordAndSendsPush() {
	owner := s.GetUser(0)
	copier := s.GetUser(1)

	taskID := primitive.NewObjectID()
	taskName := "Read 30 mins"

	s.service.notifyTaskCopied(taskID, owner.ID, copier.ID, taskName)

	// Assert a TASK_COPIED notification record exists for the owner (receiver)
	count := s.CountDocuments("notifications", bson.M{
		"receiver":         owner.ID,
		"notificationType": "TASK_COPIED",
		"reference_id":     taskID,
	})
	s.Equal(int64(1), count, "expected one TASK_COPIED notification record for the task owner")

	// Assert a push was sent to the owner's push token
	s.AssertPushNotificationSent(owner.PushToken, "expected push notification sent to task owner")
}

func (s *TagServiceTestSuite) TestRespondToTaskTag_NonTaggedResponderReturnsNotFound() {
	owner := s.GetUser(0)
	friend := s.GetUser(1)
	stranger := s.GetUser(2)

	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          owner.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	tagged, _ := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})
	task := TaskDocument{ID: primitive.NewObjectID(), Content: "Read 30 mins", Priority: 1, Value: 2,
		UserID: owner.ID, CategoryID: category.ID, Active: true, TaggedUsers: tagged}
	created, err := s.service.CreateTask(category.ID, &task)
	s.NoError(err)

	// Task exists, but the stranger isn't tagged on it — must be a 404, not a silent 200
	err = s.service.RespondToTaskTag(created.ID, stranger.ID, types.TagStatusWatching)
	s.ErrorIs(err, mongo.ErrNoDocuments)
}

func (s *TagServiceTestSuite) TestRespondToTaskTag_CopiedTwiceNotifiesOnce() {
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

	tagged, _ := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})
	task := TaskDocument{ID: primitive.NewObjectID(), Content: "Read 30 mins", Priority: 1, Value: 2,
		UserID: owner.ID, CategoryID: category.ID, Active: true, TaggedUsers: tagged}
	created, err := s.service.CreateTask(category.ID, &task)
	s.NoError(err)

	filter := bson.M{
		"receiver":         owner.ID,
		"notificationType": "TASK_COPIED",
		"reference_id":     created.ID,
	}

	err = s.service.RespondToTaskTag(created.ID, friend.ID, types.TagStatusCopied)
	s.NoError(err)

	// Notification fires in a goroutine; wait for the record to land
	s.Eventually(func() bool {
		return s.CountDocuments("notifications", filter) == 1
	}, 3*time.Second, 50*time.Millisecond, "expected TASK_COPIED record after first copied response")

	// Idempotent re-respond: returns nil, fires no goroutine, so no second record
	err = s.service.RespondToTaskTag(created.ID, friend.ID, types.TagStatusCopied)
	s.NoError(err)
	s.Equal(int64(1), s.CountDocuments("notifications", filter),
		"re-responding copied must not duplicate the TASK_COPIED notification")
}
