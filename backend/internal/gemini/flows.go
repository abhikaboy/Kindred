package gemini

import (
	"context"
	"fmt"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/task"
	"github.com/firebase/genkit/go/ai"
	"github.com/firebase/genkit/go/core"
	"github.com/firebase/genkit/go/genkit"
)

// FlowSet contains all the Genkit flows
type FlowSet struct {
	TaskFlow                         *core.Flow[GenerateTaskParams, *task.CreateTaskParams, struct{}]
	TaskFromImageFlow                *core.Flow[GenerateTaskFromImageParams, GenerateTaskFromImageOutput, struct{}]
	MultiTaskFromTextFlow            *core.Flow[MultiTaskFromTextInput, MultiTaskFromTextOutput, struct{}]
	MultiTaskFromTextFlowWithContext *core.Flow[MultiTaskFromTextInputWithUser, MultiTaskFromTextOutput, struct{}]
	AnalyticsReportFlow              *core.Flow[AnalyticsReportInput, AnalyticsReportOutput, struct{}]
	GenerateBlueprintFlow            *core.Flow[GenerateBlueprintInput, GenerateBlueprintOutput, struct{}]
}

// InitFlows initializes and registers all Genkit flows
func InitFlows(g *genkit.Genkit, tools *ToolSet) *FlowSet {
	// Generate single task from description
	generateTaskFlow := genkit.DefineFlow(g, "generateTaskFlow",
		func(ctx context.Context, input GenerateTaskParams) (*task.CreateTaskParams, error) {
			currentTime := time.Now().UTC().Format(time.RFC3339)
			prompt := fmt.Sprintf(`Generate a task based on the following description: %s. The current time is %s.`, input.Description, currentTime)
			resp, _, err := genkit.GenerateData[task.CreateTaskParams](ctx, g, ai.WithPrompt(prompt))
			if err != nil {
				return nil, err
			}

			return resp, nil
		})

	// Generate tasks from image
	generateTaskFromImageFlow := genkit.DefineFlow(g, "generateTaskFromImageFlow",
		func(ctx context.Context, input GenerateTaskFromImageParams) (GenerateTaskFromImageOutput, error) {
			prompt := fmt.Sprintf(`Generate a set of categories and tasks based on the following image- Each task should belong to a category. The current time is %s.`, time.Now().UTC().Format(time.RFC3339))
			resp, _, err := genkit.GenerateData[GenerateTaskFromImageOutput](ctx, g, ai.WithPrompt(prompt), ai.WithMessages(ai.NewUserMessage(ai.NewMediaPart("image/jpeg", input.Image), ai.NewTextPart(prompt))))
			if err != nil {
				return GenerateTaskFromImageOutput{}, err
			}
			return *resp, nil
		})

	// Generate multiple tasks from text (basic)
	multiTaskFromTextFlow := genkit.DefineFlow(g, "multiTaskFromTextFlow",
		func(ctx context.Context, input MultiTaskFromTextInput) (MultiTaskFromTextOutput, error) {
			prompt := fmt.Sprintf(`Generate a set of categories and tasks based on the following text- Each task should belong to a category. The current time is %s.`, time.Now().UTC().Format(time.RFC3339))
			resp, _, err := genkit.GenerateData[MultiTaskFromTextOutput](ctx, g, ai.WithPrompt(prompt), ai.WithMessages(ai.NewUserMessage(ai.NewTextPart(input.Text))))
			if err != nil {
				return MultiTaskFromTextOutput{}, err
			}
			return *resp, nil
		})

	// Enhanced flow with category context and tool calling
	multiTaskFromTextFlowWithContext := genkit.DefineFlow(g, "multiTaskFromTextFlowWithContext",
		func(ctx context.Context, input MultiTaskFromTextInputWithUser) (MultiTaskFromTextOutput, error) {
			currentTime := time.Now().UTC().Format(time.RFC3339)

			// Enhanced prompt that instructs the AI to use the tool
			prompt := fmt.Sprintf(`You are a task organization assistant. Generate a set of categories and tasks based on the user's input text.

IMPORTANT: Before creating categories, call the getUserCategories tool with userId "%s" to see what categories the user already has. Try to assign tasks to existing categories when appropriate, or create new categories only when needed.

Current time: %s
User input: %s

Your response should include:
1. categories: An array of category objects with "name" and "workspaceName" fields. New categories should include tasks in the tasks array.
2. tasks: An array of categoryTaskPair objects, each with appropriate fields. The categoryId should be the ID of the existing category in the user's database. These are exlusively for tasks that belong to existing categories.

When choosing category names, prefer existing categories from the user's database when the task fits. Only create new categories when the task doesn't match any existing category.`, input.UserID, currentTime, input.Text)

			resp, _, err := genkit.GenerateData[MultiTaskFromTextOutput](ctx, g,
				ai.WithPrompt(prompt),
				ai.WithTools(tools.GetUserCategories),
			)
			if err != nil {
				return MultiTaskFromTextOutput{}, err
			}
			return *resp, nil
		})

	// Analytics report flow - generates insights from completed tasks
	analyticsReportFlow := genkit.DefineFlow(g, "analyticsReportFlow",
		func(ctx context.Context, input AnalyticsReportInput) (AnalyticsReportOutput, error) {
			currentTime := time.Now().UTC().Format(time.RFC3339)

			prompt := fmt.Sprintf(`You are a productivity analytics assistant. Analyze the user's completed tasks and generate a comprehensive, structured analytics report.

IMPORTANT: 
1. Call the getCompletedTasks tool with userId "%s" and limit %d to fetch the user's recently completed tasks
2. Call getUserCategories tool with userId "%s" to understand their workspace organization

Current time: %s

Analyze the data and provide structured insights:

PRODUCTIVITY SUMMARY:
- Calculate total tasks completed
- Describe completion patterns (e.g., "steady pace", "burst of activity", "declining trend")
- Identify productive time periods from timeCompleted timestamps
- Provide an encouraging overall insight

PRIORITY ANALYSIS:
- Count tasks by priority (1=low, 2=medium, 3=high)
- Sum all task values for total value delivered
- List 3-5 notable high-value or high-priority tasks (by content)
- Analyze priority balance (e.g., "good balance", "too many urgent tasks", "focus on important work")

WORKSPACE INSIGHTS:
- Identify the 3-5 most active workspaces/categories (by comparing completed task categoryIds with user's categories)
- **CRITICAL**: Identify STALE WORKSPACES - any workspace/category from getUserCategories that has NO matching tasks in completed tasks
- For each stale workspace, suggest: "Archive", "Review and reorganize", "Delete if no longer needed", etc.
- Describe category usage patterns

TIME MANAGEMENT:
- Count how many tasks have timeTaken data
- Calculate average time per task if data exists (parse timeTaken strings)
- List quick wins (tasks with short timeTaken)
- List time-intensive tasks (tasks with long timeTaken)
- Provide time management insight

RECOMMENDATIONS:
- Provide 3-5 actionable, specific suggestions based on the data
- Keep them encouraging and practical

ALERTS:
- Flag any concerning patterns (e.g., "Many stale workspaces need attention", "All recent tasks are high-priority - consider task prioritization")
- Highlight issues needing immediate attention

Be specific with numbers, encouraging in tone, and actionable in recommendations.`, input.UserID, input.Limit, input.UserID, currentTime)

			// Generate structured data with both tools available
			resp, _, err := genkit.GenerateData[AnalyticsReportOutput](ctx, g,
				ai.WithPrompt(prompt),
				ai.WithTools(tools.GetCompletedTasks, tools.GetUserCategories),
			)
			if err != nil {
				return AnalyticsReportOutput{}, err
			}

			return *resp, nil
		})

	// Generate blueprint flow - creates a complete blueprint based on user description
	generateBlueprintFlow := genkit.DefineFlow(g, "generateBlueprintFlow",
		func(ctx context.Context, input GenerateBlueprintInput) (GenerateBlueprintOutput, error) {
			currentTime := time.Now().UTC().Format(time.RFC3339)

			prompt := fmt.Sprintf(`You are a blueprint creation assistant. Generate a comprehensive, well-structured blueprint based on the user's description.

User ID: %s
Description: %s
Current time: %s

IMPORTANT INSTRUCTIONS:

1. CALL getUserCategories tool with userId "%s" to understand the user's existing categories and workspaces. This will help you create relevant and contextually appropriate blueprints.

2. Create a complete blueprint with the following structure:
   - name: A clear, concise name for the blueprint (e.g., "Morning Productivity Routine", "Weekly Meal Prep Plan")
   - description: A detailed description explaining the purpose and benefits of this blueprint
   - banner: Suggest a color scheme or placeholder image URL (e.g., "#4A90E2" or "https://placeholder.com/600x200")
   - tags: An array of 3-5 relevant tags for categorization (e.g., ["productivity", "morning", "health"])
   - duration: Estimated total time to complete all tasks (e.g., "45m", "1h 30m", "2h")
   - category: Primary category type (e.g., "productivity", "health", "learning", "lifestyle")
   - categories: An array of category objects, each containing:
     * name: Category name within the blueprint
     * workspaceName: Should match the blueprint name
     * tasks: Array of task objects with these fields:
       - content: Clear, actionable task description
       - priority: 1 (low), 2 (medium), or 3 (high)
       - value: Numeric value representing task importance (1.0-3.0)
       - recurring: Boolean indicating if task repeats
       - public: Boolean (default false for blueprint tasks)
       - active: Boolean (default false for blueprint tasks)
       - startDate: ISO timestamp for when task should start (optional)
       - startTime: ISO timestamp for specific time (optional)
       - deadline: ISO timestamp for due date (optional)
       - notes: Additional task details (optional)
       - checklist: Array of checklist items (optional)
       - reminders: Array of reminder objects (optional)

3. BLUEPRINT DESIGN GUIDELINES:
   - Create 2-5 categories that logically organize the tasks
   - Each category should have 3-8 tasks
   - Tasks should be specific, actionable, and ordered logically
   - Set appropriate priorities based on task importance
   - Include time-based fields (startDate, startTime, deadline) where relevant
   - For recurring tasks, consider daily/weekly patterns
   - Add helpful notes for tasks that need clarification

4. QUALITY STANDARDS:
   - Ensure tasks are complete and actionable
   - Order tasks in a logical sequence
   - Balance task priorities across the blueprint
   - Make the blueprint immediately useful and practical
   - Consider the user's existing workspace patterns from getUserCategories

Generate a high-quality, comprehensive blueprint that the user can immediately subscribe to and start using.`, input.UserID, input.Description, currentTime, input.UserID)

			// Generate structured blueprint data with user context
			resp, _, err := genkit.GenerateData[GenerateBlueprintOutput](ctx, g,
				ai.WithPrompt(prompt),
				ai.WithTools(tools.GetUserCategories),
			)
			if err != nil {
				return GenerateBlueprintOutput{}, err
			}

			return *resp, nil
		})

	return &FlowSet{
		TaskFlow:                         generateTaskFlow,
		TaskFromImageFlow:                generateTaskFromImageFlow,
		MultiTaskFromTextFlow:            multiTaskFromTextFlow,
		MultiTaskFromTextFlowWithContext: multiTaskFromTextFlowWithContext,
		AnalyticsReportFlow:              analyticsReportFlow,
		GenerateBlueprintFlow:            generateBlueprintFlow,
	}
}
