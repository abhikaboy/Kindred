package gemini

import (
	"context"
	"fmt"
	"time"

	Category "github.com/abhikaboy/Kindred/internal/handlers/category"
	Task "github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/abhikaboy/Kindred/internal/unsplash"
	"github.com/firebase/genkit/go/ai"
	"github.com/firebase/genkit/go/genkit"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// ToolSet contains all Genkit tools
type ToolSet struct {
	GetUserCategories  ai.Tool
	GetCompletedTasks  ai.Tool
	FetchUnsplashImage ai.Tool
	GetUserActiveTasks ai.Tool
}

// InitTools initializes and registers all Genkit tools
func InitTools(g *genkit.Genkit, collections map[string]*mongo.Collection, unsplashClient *unsplash.Client) *ToolSet {
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

	// Define tool to fetch Unsplash banner images
	fetchUnsplashImageTool := genkit.DefineTool(
		g,
		"fetchUnsplashImage",
		"Fetches a random high-quality banner image from Unsplash based on a search query. Use this to get beautiful, professional banner images for blueprints. Returns the image URL and metadata.",
		func(ctx *ai.ToolContext, input FetchUnsplashImageInput) (FetchUnsplashImageOutput, error) {
			if unsplashClient == nil {
				return FetchUnsplashImageOutput{}, fmt.Errorf("unsplash client not initialized")
			}

			// Use a context with timeout
			searchCtx, cancel := context.WithTimeout(context.Background(), 10)
			defer cancel()

			// Fetch a random photo matching the query
			photo, err := unsplashClient.GetRandomPhoto(searchCtx, input.Query)
			if err != nil {
				return FetchUnsplashImageOutput{}, fmt.Errorf("failed to fetch unsplash image: %w", err)
			}

			// Log for debugging
			fmt.Printf("🖼️  fetchUnsplashImage called with query: %s\n", input.Query)
			fmt.Printf("📸 Found image: %s by %s\n", photo.ID, photo.User.Name)

			// Trigger download tracking (Unsplash API requirement)
			if photo.Links.DownloadLocation != "" {
				go func() {
					_ = unsplashClient.TriggerDownload(context.Background(), photo.Links.DownloadLocation)
				}()
			}

			return FetchUnsplashImageOutput{
				URL:                  photo.URLs.Regular,
				ThumbnailURL:         photo.URLs.Small,
				Description:          photo.Description,
				AltDescription:       photo.AltDescription,
				Color:                photo.Color,
				Photographer:         photo.User.Name,
				PhotographerUsername: photo.User.Username,
				Width:                photo.Width,
				Height:               photo.Height,
			}, nil
		},
	)

	// Define tool to fetch all active tasks for a user
	getUserActiveTasksTool := genkit.DefineTool(
		g,
		"getUserActiveTasks",
		"Fetches all active (non-completed) tasks for a specific user from the database. Use this to identify which tasks to edit when the user refers to them by name or description.",
		func(ctx *ai.ToolContext, input GetUserActiveTasksInput) (GetUserActiveTasksOutput, error) {
			userID, err := primitive.ObjectIDFromHex(input.UserID)
			if err != nil {
				return GetUserActiveTasksOutput{}, fmt.Errorf("invalid user ID: %w", err)
			}

			// Fetch categories — each category document embeds its tasks, so we get the
			// correct categoryID from the parent document (avoids NilObjectID on older tasks
			// that lack a stored categoryID field in the subdocument).
			workspaces, err := categoryService.GetCategoriesByUser(userID)
			if err != nil {
				return GetUserActiveTasksOutput{}, fmt.Errorf("failed to fetch categories: %w", err)
			}

			output := GetUserActiveTasksOutput{
				UserID: input.UserID,
				Tasks:  make([]ActiveTaskInfo, 0),
			}

			for _, workspace := range workspaces {
				for _, cat := range workspace.Categories {
					for _, t := range cat.Tasks {
						if len(output.Tasks) >= 200 {
							break
						}

						notes := t.Notes
						if len(notes) > 200 {
							notes = notes[:200]
						}

						info := ActiveTaskInfo{
							// CategoryID comes from the parent document — always correct.
							ID:             t.ID.Hex(),
							CategoryID:     cat.ID.Hex(),
							CategoryName:   cat.Name,
							Content:        t.Content,
							Priority:       t.Priority,
							Value:          t.Value,
							Recurring:      t.Recurring,
							RecurFrequency: t.RecurFrequency,
							Active:         t.Active,
							Notes:          notes,
						}
						if t.Deadline != nil {
							info.Deadline = t.Deadline.Format(time.RFC3339)
						}
						if t.StartDate != nil {
							info.StartDate = t.StartDate.Format(time.RFC3339)
						}
						if t.StartTime != nil {
							info.StartTime = t.StartTime.Format(time.RFC3339)
						}
						if t.TemplateID != nil {
							info.TemplateID = t.TemplateID.Hex()
						}

						output.Tasks = append(output.Tasks, info)
					}
				}
			}

			// Fetch recurring template tasks
			templates, err := taskService.GetTemplatesByUserWithCategory(userID)
			if err != nil {
				// Non-fatal: log and continue without templates
				fmt.Printf("⚠️  getUserActiveTasks: failed to fetch templates: %v\n", err)
			} else {
				output.Templates = make([]ActiveTemplateInfo, 0, len(templates))
				for i, tmpl := range templates {
					if i >= 200 {
						break
					}
					notes := tmpl.Notes
					if len(notes) > 200 {
						notes = notes[:200]
					}
					info := ActiveTemplateInfo{
						ID:             tmpl.ID.Hex(),
						CategoryID:     tmpl.CategoryID.Hex(),
						CategoryName:   tmpl.CategoryName,
						Content:        tmpl.Content,
						Priority:       tmpl.Priority,
						Value:          tmpl.Value,
						Public:         tmpl.Public,
						RecurFrequency: tmpl.RecurFrequency,
						RecurType:      tmpl.RecurType,
						Notes:          notes,
					}
					if tmpl.Deadline != nil {
						info.Deadline = tmpl.Deadline.Format(time.RFC3339)
					}
					if tmpl.StartDate != nil {
						info.StartDate = tmpl.StartDate.Format(time.RFC3339)
					}
					if tmpl.StartTime != nil {
						info.StartTime = tmpl.StartTime.Format(time.RFC3339)
					}
					output.Templates = append(output.Templates, info)
				}
			}

			output.Total = len(output.Tasks) + len(output.Templates)
			fmt.Printf("🔍 getUserActiveTasks called for user: %s, found %d tasks + %d templates\n", input.UserID, len(output.Tasks), len(output.Templates))
			return output, nil
		},
	)

	return &ToolSet{
		GetUserCategories:  getUserCategoriesTool,
		GetCompletedTasks:  getCompletedTasksTool,
		FetchUnsplashImage: fetchUnsplashImageTool,
		GetUserActiveTasks: getUserActiveTasksTool,
	}
}
