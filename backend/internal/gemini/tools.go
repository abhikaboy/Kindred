package gemini

import (
	"fmt"

	Category "github.com/abhikaboy/Kindred/internal/handlers/category"
	"github.com/firebase/genkit/go/ai"
	"github.com/firebase/genkit/go/genkit"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// InitTools initializes and registers all Genkit tools
func InitTools(g *genkit.Genkit, collections map[string]*mongo.Collection) ai.Tool {
	// Create category service for database access
	categoryService := Category.NewService(collections)

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

	return getUserCategoriesTool
}
