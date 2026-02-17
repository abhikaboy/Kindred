package Category

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CategoryServiceTestSuite is the test suite for category service
type CategoryServiceTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

// SetupTest runs before each test
func (s *CategoryServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
}

// TestCategoryService runs the test suite
func TestCategoryService(t *testing.T) {
	suite.Run(t, new(CategoryServiceTestSuite))
}

// ========================================
// GetAllCategories Tests
// ========================================

func (s *CategoryServiceTestSuite) TestGetAllCategories_Success() {
	categories, err := s.service.GetAllCategories()

	s.NoError(err)
	s.NotNil(categories)
	s.GreaterOrEqual(len(categories), 0)
}

// ========================================
// GetCategoriesByUser Tests
// ========================================

func (s *CategoryServiceTestSuite) TestGetCategoriesByUser_Success() {
	user := s.GetUser(0)

	categories, err := s.service.GetCategoriesByUser(user.ID)

	s.NoError(err)
	s.NotNil(categories)
	s.GreaterOrEqual(len(categories), 0)
}

func (s *CategoryServiceTestSuite) TestGetCategoriesByUser_NoCategories() {
	newUserID := primitive.NewObjectID()

	categories, err := s.service.GetCategoriesByUser(newUserID)

	s.NoError(err)
	s.NotNil(categories)
	s.Equal(0, len(categories))
}

// ========================================
// GetCategoryByID Tests
// ========================================

func (s *CategoryServiceTestSuite) TestGetCategoryByID_Success() {
	user := s.GetUser(0)

	// Create a category
	category := &CategoryDocument{
		ID:    primitive.NewObjectID(),
		Name:  "Test Category",
		User:  user.ID,
		Tasks: []types.TaskDocument{},
	}

	created, err := s.service.CreateCategory(category)
	s.NoError(err)

	// Get the category by ID
	result, err := s.service.GetCategoryByID(created.ID)

	s.NoError(err)
	s.NotNil(result)
	s.Equal(created.ID, result.ID)
	s.Equal("Test Category", result.Name)
}

func (s *CategoryServiceTestSuite) TestGetCategoryByID_NotFound() {
	invalidID := primitive.NewObjectID()

	category, err := s.service.GetCategoryByID(invalidID)

	s.Error(err)
	s.Nil(category)
}

// ========================================
// CreateCategory Tests
// ========================================

func (s *CategoryServiceTestSuite) TestCreateCategory_Success() {
	user := s.GetUser(0)

	category := &CategoryDocument{
		ID:    primitive.NewObjectID(),
		Name:  "New Category",
		User:  user.ID,
		Tasks: []types.TaskDocument{},
	}

	result, err := s.service.CreateCategory(category)

	s.NoError(err)
	s.NotNil(result)
	s.Equal("New Category", result.Name)
	s.Equal(user.ID, result.User)
	s.NotEqual(primitive.NilObjectID, result.ID)
}

// ========================================
// UpdatePartialCategory Tests
// ========================================

func (s *CategoryServiceTestSuite) TestUpdatePartialCategory_Success() {
	user := s.GetUser(0)

	// Create a category
	category := &CategoryDocument{
		ID:    primitive.NewObjectID(),
		Name:  "Original Name",
		User:  user.ID,
		Tasks: []types.TaskDocument{},
	}

	created, err := s.service.CreateCategory(category)
	s.NoError(err)

	// Update the category
	newName := "Updated Name"
	update := UpdateCategoryDocument{
		Name: newName,
	}

	result, err := s.service.UpdatePartialCategory(created.ID, update, user.ID)

	s.NoError(err)
	s.NotNil(result)
	s.Equal(newName, result.Name)
}

func (s *CategoryServiceTestSuite) TestUpdatePartialCategory_NotFound() {
	user := s.GetUser(0)
	invalidID := primitive.NewObjectID()

	newName := "Updated Name"
	update := UpdateCategoryDocument{
		Name: newName,
	}

	result, err := s.service.UpdatePartialCategory(invalidID, update, user.ID)

	s.Error(err)
	s.Nil(result)
}

func (s *CategoryServiceTestSuite) TestUpdatePartialCategory_WrongUser() {
	user1 := s.GetUser(0)
	user2 := s.GetUser(1)

	// Create a category as user1
	category := &CategoryDocument{
		ID:    primitive.NewObjectID(),
		Name:  "User1 Category",
		User:  user1.ID,
		Tasks: []types.TaskDocument{},
	}

	created, err := s.service.CreateCategory(category)
	s.NoError(err)

	// Try to update as user2
	newName := "Hacked Name"
	update := UpdateCategoryDocument{
		Name: newName,
	}

	result, err := s.service.UpdatePartialCategory(created.ID, update, user2.ID)

	s.Error(err)
	s.Nil(result)
}

// ========================================
// DeleteCategory Tests
// ========================================

func (s *CategoryServiceTestSuite) TestDeleteCategory_Success() {
	user := s.GetUser(0)

	// Create a category
	category := &CategoryDocument{
		ID:    primitive.NewObjectID(),
		Name:  "Category to Delete",
		User:  user.ID,
		Tasks: []types.TaskDocument{},
	}

	created, err := s.service.CreateCategory(category)
	s.NoError(err)

	// Delete the category
	err = s.service.DeleteCategory(user.ID, created.ID)

	s.NoError(err)

	// Verify it's deleted
	result, err := s.service.GetCategoryByID(created.ID)
	s.Error(err)
	s.Nil(result)
}

func (s *CategoryServiceTestSuite) TestDeleteCategory_NotFound() {
	user := s.GetUser(0)
	invalidID := primitive.NewObjectID()

	err := s.service.DeleteCategory(user.ID, invalidID)

	// Should not error on non-existent category (idempotent)
	s.NoError(err)
}

func (s *CategoryServiceTestSuite) TestDeleteCategory_WithRecurringTasks() {
	user := s.GetUser(0)

	// Create a category
	category := &CategoryDocument{
		ID:    primitive.NewObjectID(),
		Name:  "Category with Recurring Tasks",
		User:  user.ID,
		Tasks: []types.TaskDocument{},
	}

	created, err := s.service.CreateCategory(category)
	s.NoError(err)

	// Create a template task for this category
	templateTask := &types.TemplateTaskDocument{
		ID:             primitive.NewObjectID(),
		UserID:         user.ID,
		CategoryID:     created.ID,
		Content:        "Recurring Task",
		Priority:       1,
		Value:          10.0,
		RecurFrequency: "daily",
		RecurType:      "OCCURRENCE",
	}

	_, err = s.Collections["template-tasks"].InsertOne(s.Ctx, templateTask)
	s.NoError(err)

	// Delete the category
	err = s.service.DeleteCategory(user.ID, created.ID)
	s.NoError(err)

	// Verify category is deleted
	result, err := s.service.GetCategoryByID(created.ID)
	s.Error(err)
	s.Nil(result)

	// Verify template task is also deleted
	var foundTemplate types.TemplateTaskDocument
	err = s.Collections["template-tasks"].FindOne(s.Ctx, primitive.M{"_id": templateTask.ID}).Decode(&foundTemplate)
	s.Error(err, "Template task should be deleted")
}

// ========================================
// GetWorkspaces Tests
// ========================================

func (s *CategoryServiceTestSuite) TestGetWorkspaces_Success() {
	user := s.GetUser(0)

	// Create categories with different workspace names
	category1 := &CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Category 1",
		User:          user.ID,
		WorkspaceName: "Work",
		Tasks:         []types.TaskDocument{},
	}
	category2 := &CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Category 2",
		User:          user.ID,
		WorkspaceName: "Personal",
		Tasks:         []types.TaskDocument{},
	}

	_, err := s.service.CreateCategory(category1)
	s.NoError(err)
	_, err = s.service.CreateCategory(category2)
	s.NoError(err)

	workspaces, err := s.service.GetWorkspaces(user.ID)

	s.NoError(err)
	s.NotNil(workspaces)
	s.GreaterOrEqual(len(workspaces), 2)
}

func (s *CategoryServiceTestSuite) TestGetWorkspaces_NoWorkspaces() {
	newUserID := primitive.NewObjectID()

	workspaces, err := s.service.GetWorkspaces(newUserID)

	s.NoError(err)
	s.NotNil(workspaces)
	s.Equal(0, len(workspaces))
}

// ========================================
// DeleteWorkspace Tests
// ========================================

func (s *CategoryServiceTestSuite) TestDeleteWorkspace_Success() {
	user := s.GetUser(0)

	// Create a category with a workspace
	category := &CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          user.ID,
		WorkspaceName: "TestWorkspace",
		Tasks:         []types.TaskDocument{},
	}

	_, err := s.service.CreateCategory(category)
	s.NoError(err)

	// Delete the workspace
	err = s.service.DeleteWorkspace("TestWorkspace", user.ID)

	s.NoError(err)

	// Verify categories in that workspace are deleted
	workspaces, err := s.service.GetWorkspaces(user.ID)
	s.NoError(err)

	for _, ws := range workspaces {
		s.NotEqual("TestWorkspace", ws.Name)
	}
}

func (s *CategoryServiceTestSuite) TestDeleteWorkspace_WithRecurringTasks() {
	user := s.GetUser(0)

	// Create a category with a workspace
	category := &CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          user.ID,
		WorkspaceName: "TestWorkspaceWithRecurring",
		Tasks:         []types.TaskDocument{},
	}

	created, err := s.service.CreateCategory(category)
	s.NoError(err)

	// Create a template task for this category
	templateTask := &types.TemplateTaskDocument{
		ID:             primitive.NewObjectID(),
		UserID:         user.ID,
		CategoryID:     created.ID,
		Content:        "Recurring Task",
		Priority:       1,
		Value:          10.0,
		RecurFrequency: "daily",
		RecurType:      "OCCURRENCE",
	}

	_, err = s.Collections["template-tasks"].InsertOne(s.Ctx, templateTask)
	s.NoError(err)

	// Delete the workspace
	err = s.service.DeleteWorkspace("TestWorkspaceWithRecurring", user.ID)
	s.NoError(err)

	// Verify categories in that workspace are deleted
	workspaces, err := s.service.GetWorkspaces(user.ID)
	s.NoError(err)

	for _, ws := range workspaces {
		s.NotEqual("TestWorkspaceWithRecurring", ws.Name)
	}

	// Verify template task is also deleted
	var foundTemplate types.TemplateTaskDocument
	err = s.Collections["template-tasks"].FindOne(s.Ctx, primitive.M{"_id": templateTask.ID}).Decode(&foundTemplate)
	s.Error(err, "Template task should be deleted")
}

// ========================================
// RenameWorkspace Tests
// ========================================

func (s *CategoryServiceTestSuite) TestRenameWorkspace_Success() {
	user := s.GetUser(0)

	// Create a category with a workspace
	category := &CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          user.ID,
		WorkspaceName: "OldWorkspace",
		Tasks:         []types.TaskDocument{},
	}

	created, err := s.service.CreateCategory(category)
	s.NoError(err)

	// Rename the workspace
	err = s.service.RenameWorkspace("OldWorkspace", "NewWorkspace", user.ID)

	s.NoError(err)

	// Verify the workspace was renamed
	result, err := s.service.GetCategoryByID(created.ID)
	s.NoError(err)
	s.Equal("NewWorkspace", result.WorkspaceName)
}
