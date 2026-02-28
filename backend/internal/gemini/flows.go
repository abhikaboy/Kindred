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
	QueryTasksFlow                   *core.Flow[QueryTasksFlowInput, TaskQueryFiltersOutput, struct{}]
	EditTasksFlow                    *core.Flow[EditTasksFlowInput, EditTasksFlowOutput, struct{}]
	IntentRouterFlow                 *core.Flow[IntentRouterInput, IntentRouterOutput, struct{}]
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

2. CALL fetchUnsplashImage tool with a relevant search query based on the blueprint theme to get a beautiful banner image. For example:
   - For a "Morning Routine" blueprint, use query "morning sunrise coffee"
   - For a "Workout Plan" blueprint, use query "fitness gym workout"
   - For a "Meal Prep" blueprint, use query "healthy food meal prep"
   Choose a descriptive query that matches the blueprint's theme. Use the returned URL for the banner field.

3. Create a complete blueprint with the following structure:
   - name: A clear, concise name for the blueprint (e.g., "Morning Productivity Routine", "Weekly Meal Prep Plan")
   - description: A detailed description explaining the purpose and benefits of this blueprint
   - banner: Use the image URL returned from fetchUnsplashImage tool
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

4. BLUEPRINT DESIGN GUIDELINES:
   - Create 2-5 categories that logically organize the tasks
   - Each category should have 3-8 tasks
   - Tasks should be specific, actionable, and ordered logically
   - Set appropriate priorities based on task importance
   - Include time-based fields (startDate, startTime, deadline) where relevant
   - For recurring tasks, consider daily/weekly patterns
   - Add helpful notes for tasks that need clarification

5. QUALITY STANDARDS:
   - Ensure tasks are complete and actionable
   - Order tasks in a logical sequence
   - Balance task priorities across the blueprint
   - Make the blueprint immediately useful and practical
   - Consider the user's existing workspace patterns from getUserCategories
   - Use high-quality, relevant banner images from Unsplash

Generate a high-quality, comprehensive blueprint that the user can immediately subscribe to and start using.`, input.UserID, input.Description, currentTime, input.UserID)

			// Generate structured blueprint data with user context and Unsplash tool
			resp, _, err := genkit.GenerateData[GenerateBlueprintOutput](ctx, g,
				ai.WithPrompt(prompt),
				ai.WithTools(tools.GetUserCategories, tools.FetchUnsplashImage),
			)
			if err != nil {
				return GenerateBlueprintOutput{}, err
			}

			return *resp, nil
		})

	// NL-to-query flow: converts natural language into structured task filter parameters
	queryTasksFlow := genkit.DefineFlow(g, "queryTasksFlow",
		func(ctx context.Context, input QueryTasksFlowInput) (TaskQueryFiltersOutput, error) {
			currentTime := time.Now().UTC().Format(time.RFC3339)

			prompt := fmt.Sprintf(`You are a task search assistant. Convert the user's natural language query into structured filter parameters for searching their tasks.

IMPORTANT: Call the getUserCategories tool with userId "%s" to see what categories/workspaces exist. Use the returned category IDs when the user refers to a specific category or workspace by name.

Current time: %s
User's timezone: %s

User query: "%s"

Return a TaskQueryFiltersOutput with the appropriate filters:
- categoryIds: IDs of relevant categories (match by name from getUserCategories results). Leave empty if no specific category is mentioned.
- priorities: relevant priority values (1=low, 2=medium, 3=high). E.g. [3] for "high priority", [1,2] for "low and medium priority".
- deadlineFrom/deadlineTo: ISO8601 datetime range for deadline filter. E.g. for "due this week", set deadlineFrom to start of current week and deadlineTo to end of current week in the user's timezone.
- startTimeFrom/startTimeTo: ISO8601 datetime range for start date filter.
- hasDeadline: set to true if user says "with deadline" or "due", false if "without deadline".
- hasStartTime: set to true if user says "scheduled" or "with start date", false if "unscheduled".
- sortBy: appropriate sorting field (timestamp, priority, value, deadline). Default to "timestamp".
- sortDir: -1 for "newest/latest/most recent", 1 for "oldest". Default to -1.

Be precise with date ranges based on the user's timezone. Only set filters that are clearly implied by the query.`,
				input.UserID, currentTime, input.Timezone, input.Text)

			resp, _, err := genkit.GenerateData[TaskQueryFiltersOutput](ctx, g,
				ai.WithPrompt(prompt),
				ai.WithTools(tools.GetUserCategories),
			)
			if err != nil {
				return TaskQueryFiltersOutput{}, err
			}
			return *resp, nil
		})

	// Edit tasks via natural language
	editTasksFlow := genkit.DefineFlow(g, "editTasksFlow",
		func(ctx context.Context, input EditTasksFlowInput) (EditTasksFlowOutput, error) {
			now := time.Now().UTC().Format(time.RFC3339)

			prompt := fmt.Sprintf(`You are a task editing assistant. The user wants to edit one or more of their tasks or recurring templates.

STEP 1: Call getUserActiveTasks with userId "%s" to see all their current tasks and recurring templates.
         The result contains two arrays: "tasks" (regular one-off tasks) and "templates" (recurring task templates).
STEP 2: Identify which item(s) the user is referring to by matching their description to content/notes.
         If the user mentions something recurring or a "template", look in templates first.
STEP 3: Construct edit instructions for each matched item.

Current time: %s
User's timezone: %s
User instruction: "%s"

Return an EditTasksFlowOutput with two arrays:
- instructions: edits for regular tasks. Each entry must have:
    - taskId: exact hex ID from the "tasks" array
    - categoryId: exact hex categoryId from the "tasks" array
    - updates: only include fields that should change
- templateInstructions: edits for recurring templates. Each entry must have:
    - taskId: exact hex ID from the "templates" array
    - categoryId: exact hex categoryId from the "templates" array
    - updates: only include fields that should change

For time fields in updates:
    - Omit entirely to leave unchanged
    - ISO8601 string to set a new value (interpret relative times like "next Friday" using current time + timezone)
    - Empty string "" to explicitly clear/remove the field

If the user's instruction doesn't match anything, return empty arrays for both.`,
				input.UserID, now, input.Timezone, input.Text)

			resp, _, err := genkit.GenerateData[EditTasksFlowOutput](ctx, g,
				ai.WithPrompt(prompt),
				ai.WithTools(tools.GetUserActiveTasks),
			)
			if err != nil {
				return EditTasksFlowOutput{}, err
			}
			return *resp, nil
		})

	// Unified intent router flow — decomposes a natural language utterance into an ordered
	// list of create/edit/delete operations. Edits are returned first (non-destructive),
	// then deletes (destructive, needs user confirmation), then creates (additive, needs preview).
	intentRouterFlow := genkit.DefineFlow(g, "intentRouterFlow",
		func(ctx context.Context, input IntentRouterInput) (IntentRouterOutput, error) {
			now := time.Now().UTC().Format(time.RFC3339)

			prompt := fmt.Sprintf(`You are a task management assistant. The user has given you a natural language instruction that may contain one or more operations: creating new tasks, editing existing tasks, or deleting existing tasks.

STEP 1: Call getUserActiveTasks with userId "%s" to see all their current tasks and templates (needed for edit and delete operations).
STEP 2: Call getUserCategories with userId "%s" to see their existing categories and workspaces (needed for create operations).
STEP 3: Decompose the user's instruction into one or more typed operations.

Current time: %s
User's timezone: %s
User instruction: "%s"

Return an IntentRouterOutput with an "ops" array. Each element must have:
- "type": one of "create", "edit", or "delete"
- Exactly one payload field matching the type:
  - For "create": populate "createPayload" with the same structure as multiTaskFromTextFlowWithContext output:
      { "categories": [...new categories with tasks...], "tasks": [...tasks for existing categories...] }
      Use the categoryIds from getUserCategories when assigning tasks to existing categories.
  - For "edit": populate "editPayload" with the same structure as editTasksFlow output:
      { "instructions": [...], "templateInstructions": [...] }
      Use exact hex IDs from getUserActiveTasks results.
  - For "delete": populate "deletePayload" with query filters to match the tasks the user wants to delete.
      ONLY these fields are allowed — do NOT include any other fields:
        - "categoryIds": string array of category IDs (from getUserCategories)
        - "priorities": integer array of priority values (1=low, 2=medium, 3=high)
        - "deadlineFrom": ISO8601 datetime string (start of deadline range, optional)
        - "deadlineTo": ISO8601 datetime string (end of deadline range, optional)
        - "startTimeFrom": ISO8601 datetime string (start of start-time range, optional)
        - "startTimeTo": ISO8601 datetime string (end of start-time range, optional)
        - "hasDeadline": boolean (true = only tasks with a deadline, optional)
        - "hasStartTime": boolean (true = only scheduled tasks, optional)
        - "sortBy": one of "timestamp", "priority", "value", "deadline" (optional)
        - "sortDir": -1 (newest first) or 1 (oldest first) (optional)
      IMPORTANT: Do NOT include "taskIds", "ids", "taskId", or any direct task identifiers.
      Use only the filter fields above to describe which tasks to delete.

ORDERING RULES (important):
1. Edit operations first (non-destructive, applied immediately server-side)
2. Delete operations second (destructive, user will confirm in UI)
3. Create operations last (additive, user will preview in UI)

If the instruction contains only one type of operation, return a single-element "ops" array.
If no matching tasks are found for an edit or delete, return an empty "ops" array rather than guessing.
Only include operations that are clearly implied by the user's instruction.`,
				input.UserID, input.UserID, now, input.Timezone, input.Text)

			resp, _, err := genkit.GenerateData[IntentRouterOutput](ctx, g,
				ai.WithPrompt(prompt),
				ai.WithTools(tools.GetUserActiveTasks, tools.GetUserCategories),
			)
			if err != nil {
				return IntentRouterOutput{}, err
			}
			if resp == nil {
				return IntentRouterOutput{Ops: []IntentOp{}}, nil
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
		QueryTasksFlow:                   queryTasksFlow,
		EditTasksFlow:                    editTasksFlow,
		IntentRouterFlow:                 intentRouterFlow,
	}
}
