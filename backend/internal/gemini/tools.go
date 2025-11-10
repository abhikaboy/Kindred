package gemini

import (
	"fmt"

	Category "github.com/abhikaboy/Kindred/internal/handlers/category"
	Task "github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/firebase/genkit/go/ai"
	"github.com/firebase/genkit/go/genkit"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// ToolSet contains all Genkit tools
type ToolSet struct {
	GetUserCategories ai.Tool
	GetCompletedTasks ai.Tool
}

// InitTools initializes and registers all Genkit tools
func InitTools(g *genkit.Genkit, collections map[string]*mongo.Collection) *ToolSet {
	// Create services for database access
	categoryService := Category.NewService(collections)
	taskService := Task.NewService(collections)

	// Define tool to fetch user categories from database
	getUserCategoriesTool := genkit.DefineTool(
		g,
		"getUserCategories",
		"Fetches all categories for a specific user from the database, grouped by workspace. Use this to understand the user's existing organizational structure before creating new tasks or categories.",
		func(ctx *ai.ToolContext, input GetUserCategoriesInput) (GetUserCategoriesOutput, error) {
			// Convert user ID string to ObjectID
			userID, err := primitive.ObjectIDFromHex(input.UserID)
			if err != nil {
				return GetUserCategoriesOutput{}, fmt.Errorf("invalid user ID: %w", err)
			}

			// Fetch categories from database
			workspaces, err := categoryService.GetCategoriesByUser(userID)
			if err != nil {
				return GetUserCategoriesOutput{}, fmt.Errorf("failed to fetch categories: %w", err)
			}

			// Log for debugging
			fmt.Printf("🔍 getUserCategories called for user: %s\n", input.UserID)
			fmt.Printf("📊 Found %d workspaces\n", len(workspaces))

			// Convert to output format
			output := GetUserCategoriesOutput{
				UserID:     input.UserID,
				Workspaces: make([]WorkspaceInfo, 0, len(workspaces)),
			}

			for _, workspace := range workspaces {
				workspaceInfo := WorkspaceInfo{
					Name:       workspace.Name,
					Categories: make([]CategoryInfo, 0, len(workspace.Categories)),
				}

				for _, cat := range workspace.Categories {
					workspaceInfo.Categories = append(workspaceInfo.Categories, CategoryInfo{
						ID:            cat.ID.Hex(),
						Name:          cat.Name,
						WorkspaceName: cat.WorkspaceName,
						TaskCount:     len(cat.Tasks),
					})
				}

				output.Workspaces = append(output.Workspaces, workspaceInfo)
			}

			return output, nil
		},
	)

	// Define tool to fetch completed tasks from database
	getCompletedTasksTool := genkit.DefineTool(
		g,
		"getCompletedTasks",
		"Fetches the most recently completed tasks for a specific user from the database. Use this to understand what tasks the user has accomplished recently, which can help with context about their work patterns and history.",
		func(ctx *ai.ToolContext, input GetCompletedTasksInput) (GetCompletedTasksOutput, error) {
			// Convert user ID string to ObjectID
			userID, err := primitive.ObjectIDFromHex(input.UserID)
			if err != nil {
				return GetCompletedTasksOutput{}, fmt.Errorf("invalid user ID: %w", err)
			}

			// Default limit to 20 if not specified
			limit := input.Limit
			if limit <= 0 {
				limit = 20
			}
			if limit > 100 {
				limit = 100
			}

			// Fetch completed tasks from database (page 1)
			tasks, totalCount, err := taskService.GetCompletedTasks(userID, 1, limit)
			if err != nil {
				return GetCompletedTasksOutput{}, fmt.Errorf("failed to fetch completed tasks: %w", err)
			}

			// Log for debugging
			fmt.Printf("🔍 getCompletedTasks called for user: %s\n", input.UserID)
			fmt.Printf("📊 Found %d completed tasks (total: %d)\n", len(tasks), totalCount)

			// Convert to output format
			output := GetCompletedTasksOutput{
				UserID: input.UserID,
				Tasks:  make([]CompletedTaskInfo, 0, len(tasks)),
				Total:  totalCount,
			}

			for _, task := range tasks {
				taskInfo := CompletedTaskInfo{
					ID:       task.ID.Hex(),
					Content:  task.Content,
					Priority: task.Priority,
					Value:    task.Value,
				}

				// Add time completed if present
				if task.TimeCompleted != nil {
					taskInfo.TimeCompleted = task.TimeCompleted.Format("2006-01-02T15:04:05Z07:00")
				}

				// Add time taken if present
				if task.TimeTaken != nil {
					taskInfo.TimeTaken = *task.TimeTaken
				}

				// Add category ID if present
				if task.CategoryID != primitive.NilObjectID {
					taskInfo.CategoryID = task.CategoryID.Hex()
				}

				output.Tasks = append(output.Tasks, taskInfo)
			}

			return output, nil
		},
	)

	return &ToolSet{
		GetUserCategories: getUserCategoriesTool,
		GetCompletedTasks: getCompletedTasksTool,
	}
}
