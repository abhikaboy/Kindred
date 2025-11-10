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

	return &FlowSet{
		TaskFlow:                         generateTaskFlow,
		TaskFromImageFlow:                generateTaskFromImageFlow,
		MultiTaskFromTextFlow:            multiTaskFromTextFlow,
		MultiTaskFromTextFlowWithContext: multiTaskFromTextFlowWithContext,
		AnalyticsReportFlow:              analyticsReportFlow,
	}
}
