package gemini

import (
	Category "github.com/abhikaboy/Kindred/internal/handlers/category"
	"github.com/abhikaboy/Kindred/internal/handlers/task"
)

type GenerateTaskParams struct {
	Description string `json:"description"`
}

type GenerateTaskFromImageParams struct {
	Image string `json:"image"`
}

type GenerateTaskFromImageOutput struct {
	Categories []Category.CreateCategoryParams `json:"categories"`
	Tasks      []task.CreateTaskParams         `json:"tasks"`
}

type MultiTaskFromTextInput struct {
	Text string `json:"text"`
}

type CategoryTaskPair struct {
	CategoryID   string                `json:"categoryId" jsonschema_description:"The ObjectID of the existing category as a hex string (24 characters)"`
	CategoryName string                `json:"categoryName,omitempty" jsonschema_description:"The name of the existing category (optional, for logging)"`
	Task         task.CreateTaskParams `json:"task"`
}

// NewCategoryWithTasks represents a new category to be created with its tasks
type NewCategoryWithTasks struct {
	Name          string                  `json:"name" jsonschema_description:"The name of the new category"`
	WorkspaceName string                  `json:"workspaceName" jsonschema_description:"The workspace name (e.g., 'Personal', 'Work', 'General')"`
	Tasks         []task.CreateTaskParams `json:"tasks" jsonschema_description:"Tasks to create in this new category"`
}

type MultiTaskFromTextOutput struct {
	Categories []NewCategoryWithTasks `json:"categories"`
	Tasks      []CategoryTaskPair     `json:"tasks"`
}

// Input for getUserCategories tool
type GetUserCategoriesInput struct {
	UserID string `json:"userId" jsonschema_description:"The user's ObjectID as a hex string (e.g., '507f1f77bcf86cd799439011')"`
}

// Output containing user's categories grouped by workspace
type GetUserCategoriesOutput struct {
	UserID     string          `json:"userId"`
	Workspaces []WorkspaceInfo `json:"workspaces"`
}

type WorkspaceInfo struct {
	Name       string         `json:"name"`
	Categories []CategoryInfo `json:"categories"`
}

type CategoryInfo struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	WorkspaceName string `json:"workspaceName"`
	TaskCount     int    `json:"taskCount"`
}

// Enhanced input that includes user ID for context
type MultiTaskFromTextInputWithUser struct {
	UserID   string `json:"userId"`
	Text     string `json:"text"`
	Timezone string `json:"timezone" jsonschema_description:"User's timezone in IANA format (e.g., 'America/New_York', 'Europe/London'). Use this to interpret relative time references like 'tomorrow at 3pm' correctly."`
}

// Input for getCompletedTasks tool
type GetCompletedTasksInput struct {
	UserID string `json:"userId" jsonschema_description:"The user's ObjectID as a hex string (e.g., '507f1f77bcf86cd799439011')"`
	Limit  int    `json:"limit,omitempty" jsonschema_description:"Number of tasks to retrieve (default: 20, max: 100)"`
}

// Output containing user's completed tasks
type GetCompletedTasksOutput struct {
	UserID string              `json:"userId"`
	Tasks  []CompletedTaskInfo `json:"tasks"`
	Total  int64               `json:"total"`
}

type CompletedTaskInfo struct {
	ID            string  `json:"id"`
	Content       string  `json:"content"`
	Priority      int     `json:"priority"`
	Value         float64 `json:"value"`
	TimeCompleted string  `json:"timeCompleted"`
	TimeTaken     string  `json:"timeTaken,omitempty"`
	CategoryID    string  `json:"categoryId,omitempty"`
}

// Input for analytics report flow
type AnalyticsReportInput struct {
	UserID string `json:"userId" jsonschema_description:"The user's ObjectID as a hex string"`
	Limit  int    `json:"limit,omitempty" jsonschema_description:"Number of completed tasks to analyze (default: 50)"`
}

// Output containing the analytics report broken into structured sections
type AnalyticsReportOutput struct {
	ProductivitySummary ProductivitySummary `json:"productivitySummary" jsonschema_description:"Overview of overall productivity metrics"`
	PriorityAnalysis    PriorityAnalysis    `json:"priorityAnalysis" jsonschema_description:"Analysis of task priorities and value delivered"`
	WorkspaceInsights   WorkspaceInsights   `json:"workspaceInsights" jsonschema_description:"Insights about workspace and category usage"`
	TimeManagement      TimeManagement      `json:"timeManagement" jsonschema_description:"Time tracking and efficiency metrics"`
	Recommendations     []string            `json:"recommendations" jsonschema_description:"Actionable suggestions for improvement"`
	Alerts              []string            `json:"alerts" jsonschema_description:"Important patterns or issues that need attention"`
}

type ProductivitySummary struct {
	TotalTasksCompleted int      `json:"totalTasksCompleted" jsonschema_description:"Total number of tasks completed in the analyzed period"`
	CompletionRate      string   `json:"completionRate" jsonschema_description:"Description of completion rate and patterns"`
	ProductivePeriods   []string `json:"productivePeriods" jsonschema_description:"Most productive time periods identified from the data"`
	OverallInsight      string   `json:"overallInsight" jsonschema_description:"High-level summary of productivity trends"`
}

type PriorityAnalysis struct {
	HighPriorityCount   int      `json:"highPriorityCount" jsonschema_description:"Number of high priority (3) tasks completed"`
	MediumPriorityCount int      `json:"mediumPriorityCount" jsonschema_description:"Number of medium priority (2) tasks completed"`
	LowPriorityCount    int      `json:"lowPriorityCount" jsonschema_description:"Number of low priority (1) tasks completed"`
	TotalValueDelivered float64  `json:"totalValueDelivered" jsonschema_description:"Sum of all task values completed"`
	HighImpactTasks     []string `json:"highImpactTasks" jsonschema_description:"Notable high-value or high-priority tasks completed"`
	PriorityBalance     string   `json:"priorityBalance" jsonschema_description:"Analysis of priority distribution and balance"`
}

type WorkspaceInsights struct {
	MostActiveWorkspaces []WorkspaceActivity `json:"mostActiveWorkspaces" jsonschema_description:"Workspaces with the most recent activity"`
	StaleWorkspaces      []StaleWorkspace    `json:"staleWorkspaces" jsonschema_description:"Workspaces or categories without recent completions"`
	CategoryPatterns     string              `json:"categoryPatterns" jsonschema_description:"Analysis of how categories are being used"`
}

type WorkspaceActivity struct {
	WorkspaceName string `json:"workspaceName" jsonschema_description:"Name of the workspace"`
	CategoryName  string `json:"categoryName,omitempty" jsonschema_description:"Name of the category (if applicable)"`
	TaskCount     int    `json:"taskCount" jsonschema_description:"Number of tasks completed"`
	Insight       string `json:"insight" jsonschema_description:"Brief insight about this workspace's activity"`
}

type StaleWorkspace struct {
	WorkspaceName string `json:"workspaceName" jsonschema_description:"Name of the workspace"`
	CategoryName  string `json:"categoryName,omitempty" jsonschema_description:"Name of the category (if applicable)"`
	Suggestion    string `json:"suggestion" jsonschema_description:"Suggestion for handling this stale workspace (e.g., archive, review, reorganize)"`
}

type TimeManagement struct {
	TasksWithTimeTracking int      `json:"tasksWithTimeTracking" jsonschema_description:"Number of tasks that have time tracking data"`
	AverageTimePerTask    string   `json:"averageTimePerTask" jsonschema_description:"Average time spent per task (if data available)"`
	QuickWins             []string `json:"quickWins" jsonschema_description:"Tasks that were completed quickly (less time intensive)"`
	TimeIntensiveTasks    []string `json:"timeIntensiveTasks" jsonschema_description:"Tasks that took significant time to complete"`
	TimeManagementInsight string   `json:"timeManagementInsight" jsonschema_description:"Overall analysis of time management patterns"`
}

// Input for blueprint generation flow
type GenerateBlueprintInput struct {
	UserID      string `json:"userId" jsonschema_description:"The user's ObjectID as a hex string"`
	Description string `json:"description" jsonschema_description:"Description of what the blueprint should contain (e.g., 'Morning routine for productivity', 'Weekly meal prep plan')"`
}

// Output for blueprint generation flow
type GenerateBlueprintOutput struct {
	Blueprint BlueprintData `json:"blueprint" jsonschema_description:"The generated blueprint with all its details"`
}

// BlueprintData represents the structure of a generated blueprint
type BlueprintData struct {
	Name        string              `json:"name" jsonschema_description:"Name of the blueprint (e.g., 'Morning Routine', 'Meal Prep Blueprint')"`
	Description string              `json:"description" jsonschema_description:"Detailed description of the blueprint and its purpose"`
	Banner      string              `json:"banner" jsonschema_description:"Banner image URL or color scheme suggestion"`
	Tags        []string            `json:"tags" jsonschema_description:"Tags for categorizing the blueprint (e.g., 'productivity', 'health', 'morning')"`
	Duration    string              `json:"duration" jsonschema_description:"Expected duration to complete all tasks in the blueprint (e.g., '1h', '30m')"`
	Category    string              `json:"category" jsonschema_description:"Primary category of the blueprint (e.g., 'productivity', 'health', 'learning')"`
	Categories  []BlueprintCategory `json:"categories" jsonschema_description:"Categories containing organized tasks for this blueprint"`
}

// BlueprintCategory represents a category within a blueprint with its tasks
type BlueprintCategory struct {
	Name          string                  `json:"name" jsonschema_description:"Name of the category within the blueprint"`
	WorkspaceName string                  `json:"workspaceName" jsonschema_description:"Workspace name (should match the blueprint name)"`
	Tasks         []task.CreateTaskParams `json:"tasks" jsonschema_description:"Tasks belonging to this category"`
}

// Input for the NL query flow
type QueryTasksFlowInput struct {
	UserID   string `json:"userId"`
	Text     string `json:"text"`
	Timezone string `json:"timezone" jsonschema_description:"User's timezone in IANA format (e.g., 'America/New_York'). Use this to interpret relative time references like 'this week' correctly."`
}

// What Gemini returns: structured query parameters extracted from natural language
type TaskQueryFiltersOutput struct {
	CategoryIds   []string `json:"categoryIds,omitempty" jsonschema_description:"IDs of relevant categories (matched by name from getUserCategories results)"`
	Priorities    []int    `json:"priorities,omitempty" jsonschema_description:"Relevant priority values: 1=low, 2=medium, 3=high"`
	DeadlineFrom  string   `json:"deadlineFrom,omitempty" jsonschema_description:"ISO8601 datetime for the start of the deadline range"`
	DeadlineTo    string   `json:"deadlineTo,omitempty" jsonschema_description:"ISO8601 datetime for the end of the deadline range"`
	StartTimeFrom string   `json:"startTimeFrom,omitempty" jsonschema_description:"ISO8601 datetime for the start of the start-date range"`
	StartTimeTo   string   `json:"startTimeTo,omitempty" jsonschema_description:"ISO8601 datetime for the end of the start-date range"`
	HasDeadline   *bool    `json:"hasDeadline,omitempty" jsonschema_description:"Set to true if user wants tasks with a deadline, false for tasks without"`
	HasStartTime  *bool    `json:"hasStartTime,omitempty" jsonschema_description:"Set to true if user wants tasks with a start date, false for tasks without"`
	SortBy        string   `json:"sortBy,omitempty" jsonschema_description:"Sort field: timestamp, priority, value, or deadline"`
	SortDir       int      `json:"sortDir,omitempty" jsonschema_description:"Sort direction: 1 (ascending) or -1 (descending)"`
}

// --- getUserActiveTasks types ---

type GetUserActiveTasksInput struct {
	UserID string `json:"userId" jsonschema_description:"The user's ObjectID as a hex string"`
}

type GetUserActiveTasksOutput struct {
	UserID    string               `json:"userId"`
	Tasks     []ActiveTaskInfo     `json:"tasks"     jsonschema_description:"Regular (non-recurring) active tasks"`
	Templates []ActiveTemplateInfo `json:"templates" jsonschema_description:"Recurring template tasks"`
	Total     int                  `json:"total"`
}

// ActiveTaskInfo is a Genkit-safe representation of a task with string IDs.
// We cannot embed task.TaskDocument directly because primitive.ObjectID is [12]byte,
// which Genkit's JSON schema generator maps to "array" instead of "string".
type ActiveTaskInfo struct {
	ID             string  `json:"id"                       jsonschema_description:"Hex ObjectID of the task"`
	CategoryID     string  `json:"categoryId"               jsonschema_description:"Hex ObjectID of the containing category"`
	CategoryName   string  `json:"categoryName,omitempty"   jsonschema_description:"Human-readable category name"`
	Content        string  `json:"content"                  jsonschema_description:"Task title / description"`
	Priority       int     `json:"priority"                 jsonschema_description:"1=low, 2=medium, 3=high"`
	Value          float64 `json:"value"                    jsonschema_description:"Importance score 0-10"`
	Recurring      bool    `json:"recurring"                jsonschema_description:"Whether the task recurs"`
	RecurFrequency string  `json:"recurFrequency,omitempty" jsonschema_description:"Recurrence frequency (e.g. daily, weekly)"`
	Active         bool    `json:"active"                   jsonschema_description:"Whether the task is active"`
	Deadline       string  `json:"deadline,omitempty"       jsonschema_description:"ISO8601 deadline, absent if none"`
	StartDate      string  `json:"startDate,omitempty"      jsonschema_description:"ISO8601 start date, absent if none"`
	StartTime      string  `json:"startTime,omitempty"      jsonschema_description:"ISO8601 start time, absent if none"`
	Notes          string  `json:"notes,omitempty"          jsonschema_description:"Task notes (truncated to 200 chars)"`
	TemplateID     string  `json:"templateId,omitempty"     jsonschema_description:"Hex ObjectID of the template, if any"`
}

// ActiveTemplateInfo is a Genkit-safe representation of a recurring template task.
// Uses string IDs to avoid schema validation errors (primitive.ObjectID is [12]byte → array).
type ActiveTemplateInfo struct {
	ID             string  `json:"id"                       jsonschema_description:"Hex ObjectID of the template task"`
	CategoryID     string  `json:"categoryId"               jsonschema_description:"Hex ObjectID of the containing category"`
	CategoryName   string  `json:"categoryName,omitempty"   jsonschema_description:"Human-readable category name"`
	Content        string  `json:"content"                  jsonschema_description:"Template task title / description"`
	Priority       int     `json:"priority"                 jsonschema_description:"1=low, 2=medium, 3=high"`
	Value          float64 `json:"value"                    jsonschema_description:"Importance score 0-10"`
	Public         bool    `json:"public"                   jsonschema_description:"Whether the template is public"`
	RecurFrequency string  `json:"recurFrequency,omitempty" jsonschema_description:"Recurrence frequency (e.g. daily, weekly, monthly)"`
	RecurType      string  `json:"recurType,omitempty"      jsonschema_description:"Recurrence type (e.g. Occurrence, Deadline, Window)"`
	Deadline       string  `json:"deadline,omitempty"       jsonschema_description:"ISO8601 deadline, absent if none"`
	StartDate      string  `json:"startDate,omitempty"      jsonschema_description:"ISO8601 start date, absent if none"`
	StartTime      string  `json:"startTime,omitempty"      jsonschema_description:"ISO8601 start time, absent if none"`
	Notes          string  `json:"notes,omitempty"          jsonschema_description:"Template notes (truncated to 200 chars)"`
}

// --- Edit tasks flow types ---

type EditTasksFlowInput struct {
	UserID   string `json:"userId"`
	Text     string `json:"text"`
	Timezone string `json:"timezone"`
}

// EditTaskUpdatesOutput: pointer fields nil = don't change; time fields "" = clear, ISO8601 = set.
type EditTaskUpdatesOutput struct {
	Content        *string  `json:"content,omitempty"        jsonschema_description:"New task name/description"`
	Priority       *int     `json:"priority,omitempty"       jsonschema_description:"New priority: 1=low, 2=medium, 3=high"`
	Value          *float64 `json:"value,omitempty"          jsonschema_description:"New value score (0-10)"`
	Deadline       *string  `json:"deadline,omitempty"       jsonschema_description:"ISO8601 to set, empty string to clear, omit to leave unchanged"`
	StartDate      *string  `json:"startDate,omitempty"      jsonschema_description:"ISO8601 to set, empty string to clear, omit to leave unchanged"`
	StartTime      *string  `json:"startTime,omitempty"      jsonschema_description:"ISO8601 to set, empty string to clear, omit to leave unchanged"`
	Notes          *string  `json:"notes,omitempty"          jsonschema_description:"New notes content"`
	Active         *bool    `json:"active,omitempty"         jsonschema_description:"Active status (regular tasks only)"`
	RecurFrequency *string  `json:"recurFrequency,omitempty" jsonschema_description:"New recurrence frequency (templates only, e.g. daily, weekly, monthly)"`
	RecurType      *string  `json:"recurType,omitempty"      jsonschema_description:"New recurrence type (templates only, e.g. Occurrence, Deadline, Window)"`
}

// EditTaskInstructionOutput is one edit instruction for one task or template.
type EditTaskInstructionOutput struct {
	TaskID      string                `json:"taskId"       jsonschema_description:"Hex ID of the task or template to edit"`
	CategoryID  string                `json:"categoryId"   jsonschema_description:"Hex ID of the task's or template's category"`
	MatchedName string                `json:"matchedName"  jsonschema_description:"Human-readable name of the item matched (for display/confirmation to the user)"`
	Updates     EditTaskUpdatesOutput `json:"updates"`
}

// EditTasksFlowOutput is the top-level flow output.
type EditTasksFlowOutput struct {
	Instructions         []EditTaskInstructionOutput `json:"instructions"         jsonschema_description:"Edit instructions for regular (non-recurring) tasks"`
	TemplateInstructions []EditTaskInstructionOutput `json:"templateInstructions" jsonschema_description:"Edit instructions for recurring template tasks"`
}

// --- Intent router flow types ---

// IntentRouterInput is the input for the unified intent router flow.
type IntentRouterInput struct {
	UserID   string `json:"userId"`
	Text     string `json:"text"`
	Timezone string `json:"timezone" jsonschema_description:"User's timezone in IANA format (e.g., 'America/New_York'). Use this to interpret relative time references correctly."`
}

// IntentOp represents a single decomposed operation from the user's utterance.
// Exactly one of CreatePayload, EditPayload, or DeletePayload will be populated
// based on the Type field.
type IntentOp struct {
	Type          string                   `json:"type" jsonschema_description:"The operation type: 'create', 'edit', or 'delete'"`
	CreatePayload *MultiTaskFromTextOutput `json:"createPayload,omitempty" jsonschema_description:"Populated when type is 'create'. Contains categories and tasks to create."`
	EditPayload   *EditTasksFlowOutput     `json:"editPayload,omitempty" jsonschema_description:"Populated when type is 'edit'. Contains instructions for editing existing tasks."`
	DeletePayload *TaskQueryFiltersOutput  `json:"deletePayload,omitempty" jsonschema_description:"Populated when type is 'delete'. Contains query filters to find tasks for deletion."`
}

// IntentRouterOutput is the top-level output of the intent router flow.
// It contains an ordered list of operations decomposed from the user's utterance.
// Operations are ordered: edits first, then deletes, then creates.
type IntentRouterOutput struct {
	Ops []IntentOp `json:"ops" jsonschema_description:"Ordered list of operations decomposed from the user's utterance. Edits come first, then deletes, then creates."`
}

// Input for fetchUnsplashImage tool
type FetchUnsplashImageInput struct {
	Query string `json:"query" jsonschema_description:"Search query to find relevant banner images (e.g., 'productivity', 'morning sunrise', 'healthy food', 'workspace')"`
}

// Output from fetchUnsplashImage tool
type FetchUnsplashImageOutput struct {
	URL                  string `json:"url" jsonschema_description:"Regular sized image URL suitable for banners"`
	ThumbnailURL         string `json:"thumbnailUrl" jsonschema_description:"Thumbnail sized image URL"`
	Description          string `json:"description,omitempty" jsonschema_description:"Image description if available"`
	AltDescription       string `json:"altDescription,omitempty" jsonschema_description:"Alternative description of the image"`
	Color                string `json:"color" jsonschema_description:"Dominant color of the image as hex code"`
	Photographer         string `json:"photographer" jsonschema_description:"Name of the photographer"`
	PhotographerUsername string `json:"photographerUsername" jsonschema_description:"Unsplash username of the photographer"`
	Width                int    `json:"width" jsonschema_description:"Image width in pixels"`
	Height               int    `json:"height" jsonschema_description:"Image height in pixels"`
}
