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
	Name        string                  `json:"name" jsonschema_description:"Name of the blueprint (e.g., 'Morning Routine', 'Meal Prep Blueprint')"`
	Description string                  `json:"description" jsonschema_description:"Detailed description of the blueprint and its purpose"`
	Banner      string                  `json:"banner" jsonschema_description:"Banner image URL or color scheme suggestion"`
	Tags        []string                `json:"tags" jsonschema_description:"Tags for categorizing the blueprint (e.g., 'productivity', 'health', 'morning')"`
	Duration    string                  `json:"duration" jsonschema_description:"Expected duration to complete all tasks in the blueprint (e.g., '1h', '30m')"`
	Category    string                  `json:"category" jsonschema_description:"Primary category of the blueprint (e.g., 'productivity', 'health', 'learning')"`
	Categories  []BlueprintCategory     `json:"categories" jsonschema_description:"Categories containing organized tasks for this blueprint"`
}

// BlueprintCategory represents a category within a blueprint with its tasks
type BlueprintCategory struct {
	Name          string                  `json:"name" jsonschema_description:"Name of the category within the blueprint"`
	WorkspaceName string                  `json:"workspaceName" jsonschema_description:"Workspace name (should match the blueprint name)"`
	Tasks         []task.CreateTaskParams `json:"tasks" jsonschema_description:"Tasks belonging to this category"`
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
