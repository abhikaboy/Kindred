package task

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
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
