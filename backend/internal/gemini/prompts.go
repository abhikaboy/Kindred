package gemini

import (
	"fmt"
	"time"
)

// BuildMultiTaskWithContextPrompt builds the prompt for multiTaskFromTextFlowWithContext.
func BuildMultiTaskWithContextPrompt(userID, text, timezone string) string {
	currentTime := time.Now().UTC().Format(time.RFC3339)
	return fmt.Sprintf(`You are a task organization assistant. Generate a set of categories and tasks based on the user's input text.

IMPORTANT: Before creating categories, call the getUserCategories tool with userId "%s" to see what categories the user already has. Try to assign tasks to existing categories when appropriate, or create new categories only when needed.

Current time: %s
User input: %s

Your response should include:
1. categories: An array of category objects with "name" and "workspaceName" fields. New categories should include tasks in the tasks array.
2. tasks: An array of categoryTaskPair objects, each with appropriate fields. The categoryId should be the ID of the existing category in the user's database. These are exlusively for tasks that belong to existing categories.

When choosing category names, prefer existing categories from the user's database when the task fits. Only create new categories when the task doesn't match any existing category.`, userID, currentTime, text)
}

// BuildQueryTasksPrompt builds the prompt for queryTasksFlow.
func BuildQueryTasksPrompt(userID, text, timezone string) string {
	currentTime := time.Now().UTC().Format(time.RFC3339)
	return fmt.Sprintf(`You are a task search assistant. Convert the user's natural language query into structured filter parameters for searching their tasks.

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
		userID, currentTime, timezone, text)
}

// BuildEditTasksPrompt builds the prompt for editTasksFlow.
func BuildEditTasksPrompt(userID, text, timezone string) string {
	now := time.Now().UTC().Format(time.RFC3339)
	return fmt.Sprintf(`You are a task editing assistant. The user wants to edit one or more of their tasks or recurring templates.

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
		userID, now, timezone, text)
}

// BuildIntentRouterPrompt builds the prompt for intentRouterFlow.
func BuildIntentRouterPrompt(userID, text, timezone string) string {
	now := time.Now().UTC().Format(time.RFC3339)
	return fmt.Sprintf(`You are a task management assistant. The user has given you a natural language instruction that may contain one or more operations: creating new tasks, editing existing tasks, or deleting existing tasks.

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
		userID, userID, now, timezone, text)
}
