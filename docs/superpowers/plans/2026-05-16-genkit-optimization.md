# Genkit Model Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Genkit flows faster and smarter by injecting category context directly into prompts, adding keyword-filtered task search, and normalizing voice input.

**Architecture:** Replace tool-call-based category fetching with a direct service call that injects a text summary into prompts. Upgrade `getUserActiveTasks` tool to support optional keyword search (returning full detail) with a slim fallback for broad queries. Add text normalization rules to task-creation prompts.

**Tech Stack:** Go, Genkit (Firebase), MongoDB, Gemini 2.5 Flash

---

### Task 1: Add `GetCategoryNamesSummary` to Category Service

**Files:**
- Modify: `backend/internal/handlers/category/service.go` (add method at end)
- Modify: `backend/internal/handlers/category/service_test.go` (add tests at end)

- [ ] **Step 1: Write the failing test for `GetCategoryNamesSummary`**

Add to the end of `backend/internal/handlers/category/service_test.go`:

```go
// ========================================
// GetCategoryNamesSummary Tests
// ========================================

func (s *CategoryServiceTestSuite) TestGetCategoryNamesSummary_WithCategories() {
	user := s.GetUser(0)

	// Create categories in different workspaces
	cat1 := &CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Errands",
		User:          user.ID,
		WorkspaceName: "Personal",
		Tasks:         []types.TaskDocument{},
	}
	cat2 := &CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Meetings",
		User:          user.ID,
		WorkspaceName: "Work",
		Tasks:         []types.TaskDocument{},
	}

	_, err := s.service.CreateCategory(cat1)
	s.NoError(err)
	_, err = s.service.CreateCategory(cat2)
	s.NoError(err)

	summary, err := s.service.GetCategoryNamesSummary(user.ID)

	s.NoError(err)
	s.Contains(summary, "Personal")
	s.Contains(summary, "Errands")
	s.Contains(summary, cat1.ID.Hex())
	s.Contains(summary, "Work")
	s.Contains(summary, "Meetings")
	s.Contains(summary, cat2.ID.Hex())
}

func (s *CategoryServiceTestSuite) TestGetCategoryNamesSummary_NoCategories() {
	newUserID := primitive.NewObjectID()

	summary, err := s.service.GetCategoryNamesSummary(newUserID)

	s.NoError(err)
	s.Equal("No workspaces or categories found.", summary)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && go test ./internal/handlers/category/ -run "TestCategoryService/TestGetCategoryNamesSummary" -v`
Expected: FAIL — `GetCategoryNamesSummary` not defined

- [ ] **Step 3: Implement `GetCategoryNamesSummary`**

Add to the end of `backend/internal/handlers/category/service.go`:

```go
// GetCategoryNamesSummary returns a lightweight text summary of a user's
// workspace and category structure, suitable for direct injection into an
// LLM prompt. Each category includes its hex ObjectID so the model can
// reference it in structured output.
func (s *Service) GetCategoryNamesSummary(userID primitive.ObjectID) (string, error) {
	workspaces, err := s.GetCategoriesByUser(userID)
	if err != nil {
		return "", fmt.Errorf("failed to fetch categories: %w", err)
	}

	if len(workspaces) == 0 {
		return "No workspaces or categories found.", nil
	}

	var b strings.Builder
	for i, ws := range workspaces {
		if i > 0 {
			b.WriteByte('\n')
		}
		fmt.Fprintf(&b, "Workspace %q:\n", ws.Name)
		for _, cat := range ws.Categories {
			fmt.Fprintf(&b, "  - %s (id: %s)\n", cat.Name, cat.ID.Hex())
		}
	}
	return b.String(), nil
}
```

Add `"strings"` to the import block at the top of `service.go` (alongside `"fmt"`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && go test ./internal/handlers/category/ -run "TestCategoryService/TestGetCategoryNamesSummary" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handlers/category/service.go backend/internal/handlers/category/service_test.go
git commit -m "feat(category): add GetCategoryNamesSummary for prompt injection"
```

---

### Task 2: Add Slim Types and Query Param to `GetUserActiveTasksInput`

**Files:**
- Modify: `backend/internal/gemini/types.go` (add slim types, update input/output structs)

- [ ] **Step 1: Add `SlimTaskInfo` and `SlimTemplateInfo` types**

Add after the `ActiveTemplateInfo` struct (after line 254) in `backend/internal/gemini/types.go`:

```go
// SlimTaskInfo is a minimal representation of a task for broad/unfocused queries.
// Contains just enough for the model to identify tasks without consuming excessive tokens.
type SlimTaskInfo struct {
	ID         string `json:"id"                    jsonschema_description:"Hex ObjectID of the task"`
	CategoryID string `json:"categoryId"            jsonschema_description:"Hex ObjectID of the containing category"`
	Content    string `json:"content"               jsonschema_description:"Task title / description"`
	Priority   int    `json:"priority"              jsonschema_description:"1=low, 2=medium, 3=high"`
	Deadline   string `json:"deadline,omitempty"    jsonschema_description:"ISO8601 deadline, absent if none"`
}

// SlimTemplateInfo is a minimal representation of a recurring template for broad queries.
type SlimTemplateInfo struct {
	ID         string `json:"id"                    jsonschema_description:"Hex ObjectID of the template"`
	CategoryID string `json:"categoryId"            jsonschema_description:"Hex ObjectID of the containing category"`
	Content    string `json:"content"               jsonschema_description:"Template title / description"`
	Priority   int    `json:"priority"              jsonschema_description:"1=low, 2=medium, 3=high"`
	Deadline   string `json:"deadline,omitempty"    jsonschema_description:"ISO8601 deadline, absent if none"`
}
```

- [ ] **Step 2: Add `Query` field to `GetUserActiveTasksInput`**

Update the `GetUserActiveTasksInput` struct in `types.go` (around line 207) from:

```go
type GetUserActiveTasksInput struct {
	UserID string `json:"userId" jsonschema_description:"The user's ObjectID as a hex string"`
}
```

To:

```go
type GetUserActiveTasksInput struct {
	UserID string `json:"userId"          jsonschema_description:"The user's ObjectID as a hex string"`
	Query  string `json:"query,omitempty" jsonschema_description:"Optional keyword search. If provided, returns only tasks whose content or notes match (case-insensitive, max 20 results with full detail). If omitted, returns all tasks in slim format."`
}
```

- [ ] **Step 3: Add slim fields to `GetUserActiveTasksOutput`**

Update the `GetUserActiveTasksOutput` struct in `types.go` (around line 211) from:

```go
type GetUserActiveTasksOutput struct {
	UserID    string               `json:"userId"`
	Tasks     []ActiveTaskInfo     `json:"tasks"     jsonschema_description:"Regular (non-recurring) active tasks"`
	Templates []ActiveTemplateInfo `json:"templates" jsonschema_description:"Recurring template tasks"`
	Total     int                  `json:"total"`
}
```

To:

```go
type GetUserActiveTasksOutput struct {
	UserID        string               `json:"userId"`
	Tasks         []ActiveTaskInfo     `json:"tasks,omitempty"         jsonschema_description:"Full-detail tasks (populated when query is provided)"`
	Templates     []ActiveTemplateInfo `json:"templates,omitempty"     jsonschema_description:"Full-detail templates (populated when query is provided)"`
	SlimTasks     []SlimTaskInfo       `json:"slimTasks,omitempty"     jsonschema_description:"Slim tasks with minimal fields (populated when no query)"`
	SlimTemplates []SlimTemplateInfo   `json:"slimTemplates,omitempty" jsonschema_description:"Slim templates with minimal fields (populated when no query)"`
	Total         int                  `json:"total"`
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: Compiles successfully (output struct fields changed from required to omitempty, but all existing code populates them so no breakage)

- [ ] **Step 5: Commit**

```bash
git add backend/internal/gemini/types.go
git commit -m "feat(gemini): add slim task types and query param to active tasks input"
```

---

### Task 3: Implement Query Filtering in `getUserActiveTasks` Tool

**Files:**
- Modify: `backend/internal/gemini/tools.go` (update `getUserActiveTasks` tool implementation, lines 195-305)

- [ ] **Step 1: Add `strings` import**

Add `"strings"` to the import block at the top of `tools.go` if not already present.

- [ ] **Step 2: Rewrite the `getUserActiveTasks` tool function body**

Replace the tool function body (the anonymous function inside `genkit.DefineTool` for `getUserActiveTasks`, lines ~199-304) with:

```go
func(ctx *ai.ToolContext, input GetUserActiveTasksInput) (GetUserActiveTasksOutput, error) {
	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return GetUserActiveTasksOutput{}, fmt.Errorf("invalid user ID: %w", err)
	}

	workspaces, err := categoryService.GetCategoriesByUser(userID)
	if err != nil {
		return GetUserActiveTasksOutput{}, fmt.Errorf("failed to fetch categories: %w", err)
	}

	hasQuery := strings.TrimSpace(input.Query) != ""
	queryLower := strings.ToLower(strings.TrimSpace(input.Query))

	output := GetUserActiveTasksOutput{UserID: input.UserID}

	if hasQuery {
		// Targeted search: return full-detail matches, capped at 20
		output.Tasks = make([]ActiveTaskInfo, 0)
		for _, workspace := range workspaces {
			for _, cat := range workspace.Categories {
				for _, t := range cat.Tasks {
					if len(output.Tasks) >= 20 {
						break
					}
					contentLower := strings.ToLower(t.Content)
					notesLower := strings.ToLower(t.Notes)
					if !strings.Contains(contentLower, queryLower) && !strings.Contains(notesLower, queryLower) {
						continue
					}
					notes := t.Notes
					if len(notes) > 200 {
						notes = notes[:200]
					}
					info := ActiveTaskInfo{
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
	} else {
		// Broad fallback: return slim format for all tasks, capped at 200
		output.SlimTasks = make([]SlimTaskInfo, 0)
		for _, workspace := range workspaces {
			for _, cat := range workspace.Categories {
				for _, t := range cat.Tasks {
					if len(output.SlimTasks) >= 200 {
						break
					}
					slim := SlimTaskInfo{
						ID:         t.ID.Hex(),
						CategoryID: cat.ID.Hex(),
						Content:    t.Content,
						Priority:   t.Priority,
					}
					if t.Deadline != nil {
						slim.Deadline = t.Deadline.Format(time.RFC3339)
					}
					output.SlimTasks = append(output.SlimTasks, slim)
				}
			}
		}
	}

	// Fetch recurring templates
	templates, err := taskService.GetTemplatesByUserWithCategory(userID)
	if err != nil {
		fmt.Printf("⚠️  getUserActiveTasks: failed to fetch templates: %v\n", err)
	} else if hasQuery {
		output.Templates = make([]ActiveTemplateInfo, 0)
		for _, tmpl := range templates {
			if len(output.Templates) >= 20 {
				break
			}
			contentLower := strings.ToLower(tmpl.Content)
			notesLower := strings.ToLower(tmpl.Notes)
			if !strings.Contains(contentLower, queryLower) && !strings.Contains(notesLower, queryLower) {
				continue
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
	} else {
		output.SlimTemplates = make([]SlimTemplateInfo, 0)
		for i, tmpl := range templates {
			if i >= 200 {
				break
			}
			slim := SlimTemplateInfo{
				ID:         tmpl.ID.Hex(),
				CategoryID: tmpl.CategoryID.Hex(),
				Content:    tmpl.Content,
				Priority:   tmpl.Priority,
			}
			if tmpl.Deadline != nil {
				slim.Deadline = tmpl.Deadline.Format(time.RFC3339)
			}
			output.SlimTemplates = append(output.SlimTemplates, slim)
		}
	}

	totalTasks := len(output.Tasks) + len(output.SlimTasks)
	totalTemplates := len(output.Templates) + len(output.SlimTemplates)
	output.Total = totalTasks + totalTemplates
	fmt.Printf("🔍 getUserActiveTasks called for user: %s (query=%q), found %d tasks + %d templates\n",
		input.UserID, input.Query, totalTasks, totalTemplates)
	return output, nil
},
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add backend/internal/gemini/tools.go
git commit -m "feat(gemini): add keyword search and slim fallback to getUserActiveTasks tool"
```

---

### Task 4: Wire Category Service into `InitFlows` and `InitGenkit`

**Files:**
- Modify: `backend/internal/gemini/flows.go` (update `InitFlows` signature, line 30)
- Modify: `backend/internal/gemini/genkit.go` (pass category service through)

- [ ] **Step 1: Update `InitFlows` signature**

In `backend/internal/gemini/flows.go`, change line 30 from:

```go
func InitFlows(g *genkit.Genkit, tools *ToolSet) *FlowSet {
```

To:

```go
func InitFlows(g *genkit.Genkit, tools *ToolSet, categoryService *Category.Service) *FlowSet {
```

Add to imports at the top of `flows.go`:

```go
Category "github.com/abhikaboy/Kindred/internal/handlers/category"
```

- [ ] **Step 2: Update `InitGenkit` to create and pass category service**

In `backend/internal/gemini/genkit.go`, update the function to:

```go
package gemini

import (
	"context"

	Category "github.com/abhikaboy/Kindred/internal/handlers/category"
	"github.com/abhikaboy/Kindred/internal/unsplash"
	"github.com/firebase/genkit/go/genkit"
	"github.com/firebase/genkit/go/plugins/googlegenai"
	"go.mongodb.org/mongo-driver/mongo"
)

// InitGenkit initializes the Genkit service with all tools and flows
func InitGenkit(collections map[string]*mongo.Collection, unsplashClient *unsplash.Client) *GeminiService {
	// Initialize Genkit with the Google AI plugin
	g := genkit.Init(context.Background(),
		genkit.WithPlugins(&googlegenai.GoogleAI{}),
		genkit.WithDefaultModel("googleai/gemini-2.5-flash"),
	)

	// Initialize tools
	tools := InitTools(g, collections, unsplashClient)

	// Initialize category service for prompt injection
	categoryService := Category.NewService(collections)

	// Initialize flows with tools and category service
	flows := InitFlows(g, tools, categoryService)

	return &GeminiService{
		Genkit:                           g,
		TaskFlow:                         flows.TaskFlow,
		TaskFromImageFlow:                flows.TaskFromImageFlow,
		MultiTaskFromTextFlow:            flows.MultiTaskFromTextFlow,
		MultiTaskFromTextFlowWithContext: flows.MultiTaskFromTextFlowWithContext,
		AnalyticsReportFlow:              flows.AnalyticsReportFlow,
		GenerateBlueprintFlow:            flows.GenerateBlueprintFlow,
		QueryTasksFlow:                   flows.QueryTasksFlow,
		EditTasksFlow:                    flows.EditTasksFlow,
		IntentRouterFlow:                 flows.IntentRouterFlow,
		Tools:                            tools,
	}
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: Compiles (flows.go now receives `categoryService` but doesn't use it yet — that's Task 5)

- [ ] **Step 4: Commit**

```bash
git add backend/internal/gemini/flows.go backend/internal/gemini/genkit.go
git commit -m "feat(gemini): wire category service into InitFlows for prompt injection"
```

---

### Task 5: Update Flow Prompts — Inject Categories, Add Normalization, Remove Tool

This is the core task. Each flow gets its prompt rewritten to:
1. Inject the category summary directly
2. Use the smarter `getUserActiveTasks` tool (query-based)
3. Remove `getUserCategories` from `ai.WithTools(...)` where applicable
4. Add text normalization rules to create flows

**Files:**
- Modify: `backend/internal/gemini/flows.go` (rewrite prompt strings + tool lists in 5 flows)

- [ ] **Step 1: Update `multiTaskFromTextFlowWithContext` (lines 79-109)**

Replace the flow function body (inside `genkit.DefineFlow`) with:

```go
func(ctx context.Context, input MultiTaskFromTextInputWithUser) (MultiTaskFromTextOutput, error) {
	currentTime := time.Now().UTC().Format(time.RFC3339)

	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return MultiTaskFromTextOutput{}, fmt.Errorf("invalid user ID: %w", err)
	}

	categorySummary, err := categoryService.GetCategoryNamesSummary(userID)
	if err != nil {
		return MultiTaskFromTextOutput{}, fmt.Errorf("failed to get category summary: %w", err)
	}

	prompt := fmt.Sprintf(`You are a task organization assistant. Generate a set of categories and tasks based on the user's input text.

The user's existing workspaces and categories:
%s

Current time: %s
User input: %s

TEXT NORMALIZATION (apply to all task content you generate):
- Fix capitalization: sentence case for task names ("buy groceries" -> "Buy groceries")
- Remove filler words from voice input (um, uh, like, you know, so basically, i guess)
- Keep the user's phrasing — do NOT significantly rewrite or paraphrase their words
- Split compound sentences into separate tasks when they describe distinct actions
  Example: "call mom and also buy groceries" -> two tasks: "Call mom", "Buy groceries"
- Infer deadlines from context: "finish the report by friday" -> set deadline to this Friday
- Infer priorities from urgency cues: "urgently fix the bug" -> priority 3, "maybe clean my desk" -> priority 1
- When no priority cue exists, default to priority 2
- When no deadline is mentioned, omit it — do not guess

Your response should include:
1. categories: An array of category objects with "name" and "workspaceName" fields. New categories should include tasks in the tasks array.
2. tasks: An array of categoryTaskPair objects, each with appropriate fields. The categoryId should be the ID of the existing category from the list above. These are exclusively for tasks that belong to existing categories.

When choosing category names, prefer existing categories from the list above when the task fits. Only create new categories when the task doesn't match any existing category.`, categorySummary, currentTime, input.Text)

	ctx, span := otel.Tracer("kindred").Start(ctx, "gemini.MultiTaskFromTextWithContext")
	defer span.End()
	resp, _, err := genkit.GenerateData[MultiTaskFromTextOutput](ctx, g,
		ai.WithPrompt(prompt),
	)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return MultiTaskFromTextOutput{}, err
	}
	return *resp, nil
},
```

Note: `ai.WithTools(tools.GetUserCategories)` is **removed** — no tool call needed.

Add `"go.mongodb.org/mongo-driver/bson/primitive"` to the imports in `flows.go`.

- [ ] **Step 2: Update `queryTasksFlow` (lines 258-296)**

Replace the flow function body with:

```go
func(ctx context.Context, input QueryTasksFlowInput) (TaskQueryFiltersOutput, error) {
	currentTime := time.Now().UTC().Format(time.RFC3339)

	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return TaskQueryFiltersOutput{}, fmt.Errorf("invalid user ID: %w", err)
	}

	categorySummary, err := categoryService.GetCategoryNamesSummary(userID)
	if err != nil {
		return TaskQueryFiltersOutput{}, fmt.Errorf("failed to get category summary: %w", err)
	}

	prompt := fmt.Sprintf(`You are a task search assistant. Convert the user's natural language query into structured filter parameters for searching their tasks.

The user's existing workspaces and categories:
%s

Current time: %s
User's timezone: %s

User query: "%s"

Return a TaskQueryFiltersOutput with the appropriate filters:
- categoryIds: IDs of relevant categories (match by name from the list above). Leave empty if no specific category is mentioned.
- priorities: relevant priority values (1=low, 2=medium, 3=high). E.g. [3] for "high priority", [1,2] for "low and medium priority".
- deadlineFrom/deadlineTo: ISO8601 datetime range for deadline filter. E.g. for "due this week", set deadlineFrom to start of current week and deadlineTo to end of current week in the user's timezone.
- startTimeFrom/startTimeTo: ISO8601 datetime range for start date filter.
- hasDeadline: set to true if user says "with deadline" or "due", false if "without deadline".
- hasStartTime: set to true if user says "scheduled" or "with start date", false if "unscheduled".
- sortBy: appropriate sorting field (timestamp, priority, value, deadline). Default to "timestamp".
- sortDir: -1 for "newest/latest/most recent", 1 for "oldest". Default to -1.

Be precise with date ranges based on the user's timezone. Only set filters that are clearly implied by the query.`,
		categorySummary, currentTime, input.Timezone, input.Text)

	ctx, span := otel.Tracer("kindred").Start(ctx, "gemini.QueryTasks")
	defer span.End()
	resp, _, err := genkit.GenerateData[TaskQueryFiltersOutput](ctx, g,
		ai.WithPrompt(prompt),
	)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return TaskQueryFiltersOutput{}, err
	}
	return *resp, nil
},
```

Note: `ai.WithTools(tools.GetUserCategories)` is **removed**.

- [ ] **Step 3: Update `editTasksFlow` (lines 299-345)**

Replace the flow function body with:

```go
func(ctx context.Context, input EditTasksFlowInput) (EditTasksFlowOutput, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return EditTasksFlowOutput{}, fmt.Errorf("invalid user ID: %w", err)
	}

	categorySummary, err := categoryService.GetCategoryNamesSummary(userID)
	if err != nil {
		return EditTasksFlowOutput{}, fmt.Errorf("failed to get category summary: %w", err)
	}

	prompt := fmt.Sprintf(`You are a task editing assistant. The user wants to edit one or more of their tasks or recurring templates.

The user's existing workspaces and categories:
%s

STEP 1: Call getUserActiveTasks with userId "%s" and a query keyword extracted from the user's instruction to find the relevant tasks. If the instruction is broad (e.g., "change all my tasks"), call it without a query to get a slim overview of all tasks.
STEP 2: Identify which item(s) the user is referring to by matching their description to content/notes.
         If the user mentions something recurring or a "template", look in templates first.
STEP 3: Construct edit instructions for each matched item.

Current time: %s
User's timezone: %s
User instruction: "%s"

Return an EditTasksFlowOutput with two arrays:
- instructions: edits for regular tasks. Each entry must have:
    - taskId: exact hex ID from the results
    - categoryId: exact hex categoryId from the results
    - updates: only include fields that should change
- templateInstructions: edits for recurring templates. Each entry must have:
    - taskId: exact hex ID from the results
    - categoryId: exact hex categoryId from the results
    - updates: only include fields that should change

For time fields in updates:
    - Omit entirely to leave unchanged
    - ISO8601 string to set a new value (interpret relative times like "next Friday" using current time + timezone)
    - Empty string "" to explicitly clear/remove the field

If the user's instruction doesn't match anything, return empty arrays for both.`,
		categorySummary, input.UserID, now, input.Timezone, input.Text)

	ctx, span := otel.Tracer("kindred").Start(ctx, "gemini.EditTasks")
	defer span.End()
	resp, _, err := genkit.GenerateData[EditTasksFlowOutput](ctx, g,
		ai.WithPrompt(prompt),
		ai.WithTools(tools.GetUserActiveTasks),
	)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return EditTasksFlowOutput{}, err
	}
	return *resp, nil
},
```

- [ ] **Step 4: Update `intentRouterFlow` (lines 350-413)**

Replace the flow function body with:

```go
func(ctx context.Context, input IntentRouterInput) (IntentRouterOutput, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return IntentRouterOutput{}, fmt.Errorf("invalid user ID: %w", err)
	}

	categorySummary, err := categoryService.GetCategoryNamesSummary(userID)
	if err != nil {
		return IntentRouterOutput{}, fmt.Errorf("failed to get category summary: %w", err)
	}

	prompt := fmt.Sprintf(`You are a task management assistant. The user has given you a natural language instruction that may contain one or more operations: creating new tasks, editing existing tasks, or deleting existing tasks.

The user's existing workspaces and categories:
%s

STEP 1: If the instruction involves editing or deleting specific tasks, call getUserActiveTasks with userId "%s" and a query keyword to find the relevant tasks. If the instruction is broad, call it without a query for a slim overview.
STEP 2: Decompose the user's instruction into one or more typed operations.

Current time: %s
User's timezone: %s
User instruction: "%s"

TEXT NORMALIZATION (apply to all task content you create):
- Fix capitalization: sentence case for task names ("buy groceries" -> "Buy groceries")
- Remove filler words from voice input (um, uh, like, you know, so basically, i guess)
- Keep the user's phrasing — do NOT significantly rewrite or paraphrase their words
- Split compound sentences into separate tasks when they describe distinct actions
  Example: "call mom and also buy groceries" -> two tasks: "Call mom", "Buy groceries"
- Infer deadlines from context: "finish the report by friday" -> set deadline to this Friday
- Infer priorities from urgency cues: "urgently fix the bug" -> priority 3, "maybe clean my desk" -> priority 1
- When no priority cue exists, default to priority 2
- When no deadline is mentioned, omit it — do not guess

Return an IntentRouterOutput with an "ops" array. Each element must have:
- "type": one of "create", "edit", or "delete"
- Exactly one payload field matching the type:
  - For "create": populate "createPayload" with:
      { "categories": [...new categories with tasks...], "tasks": [...tasks for existing categories...] }
      Use the categoryIds from the list above when assigning tasks to existing categories.
  - For "edit": populate "editPayload" with:
      { "instructions": [...], "templateInstructions": [...] }
      Use exact hex IDs from getUserActiveTasks results.
  - For "delete": populate "deletePayload" with query filters to match the tasks the user wants to delete.
      ONLY these fields are allowed — do NOT include any other fields:
        - "categoryIds": string array of category IDs (from the list above)
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

ORDERING RULES (important):
1. Edit operations first (non-destructive, applied immediately server-side)
2. Delete operations second (destructive, user will confirm in UI)
3. Create operations last (additive, user will preview in UI)

If the instruction contains only one type of operation, return a single-element "ops" array.
If no matching tasks are found for an edit or delete, return an empty "ops" array rather than guessing.
Only include operations that are clearly implied by the user's instruction.`,
		categorySummary, input.UserID, now, input.Timezone, input.Text)

	ctx, span := otel.Tracer("kindred").Start(ctx, "gemini.IntentRouter")
	defer span.End()
	resp, _, err := genkit.GenerateData[IntentRouterOutput](ctx, g,
		ai.WithPrompt(prompt),
		ai.WithTools(tools.GetUserActiveTasks),
	)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return IntentRouterOutput{}, err
	}
	if resp == nil {
		return IntentRouterOutput{Ops: []IntentOp{}}, nil
	}
	return *resp, nil
},
```

Note: `tools.GetUserCategories` removed from `ai.WithTools`. Only `tools.GetUserActiveTasks` remains.

- [ ] **Step 5: Update `generateBlueprintFlow` (lines 178-255)**

Replace the flow function body with:

```go
func(ctx context.Context, input GenerateBlueprintInput) (GenerateBlueprintOutput, error) {
	currentTime := time.Now().UTC().Format(time.RFC3339)

	userID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		return GenerateBlueprintOutput{}, fmt.Errorf("invalid user ID: %w", err)
	}

	categorySummary, err := categoryService.GetCategoryNamesSummary(userID)
	if err != nil {
		return GenerateBlueprintOutput{}, fmt.Errorf("failed to get category summary: %w", err)
	}

	prompt := fmt.Sprintf(`You are a blueprint creation assistant. Generate a comprehensive, well-structured blueprint based on the user's description.

Description: %s
Current time: %s

The user's existing workspaces and categories:
%s

IMPORTANT INSTRUCTIONS:

1. CALL fetchUnsplashImage tool with a relevant search query based on the blueprint theme to get a beautiful banner image. For example:
   - For a "Morning Routine" blueprint, use query "morning sunrise coffee"
   - For a "Workout Plan" blueprint, use query "fitness gym workout"
   - For a "Meal Prep" blueprint, use query "healthy food meal prep"
   Choose a descriptive query that matches the blueprint's theme. Use the returned URL for the banner field.

2. Create a complete blueprint with the following structure:
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
   - Consider the user's existing workspace patterns from the category list above
   - Use high-quality, relevant banner images from Unsplash

Generate a high-quality, comprehensive blueprint that the user can immediately subscribe to and start using.`, input.Description, currentTime, categorySummary)

	ctx, span := otel.Tracer("kindred").Start(ctx, "gemini.GenerateBlueprint")
	defer span.End()
	resp, _, err := genkit.GenerateData[GenerateBlueprintOutput](ctx, g,
		ai.WithPrompt(prompt),
		ai.WithTools(tools.FetchUnsplashImage),
	)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return GenerateBlueprintOutput{}, err
	}

	return *resp, nil
},
```

Note: `tools.GetUserCategories` removed from `ai.WithTools`. Only `tools.FetchUnsplashImage` remains.

- [ ] **Step 6: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: Compiles successfully

- [ ] **Step 7: Run existing tests to verify nothing is broken**

Run: `cd backend && go test ./internal/handlers/category/ -v`
Expected: All existing tests pass

- [ ] **Step 8: Commit**

```bash
git add backend/internal/gemini/flows.go
git commit -m "feat(gemini): inject category context into prompts, add text normalization, use query-based task search"
```

---

### Task 6: Verify End-to-End Compilation and Tests

**Files:** None (verification only)

- [ ] **Step 1: Full build**

Run: `cd backend && go build ./...`
Expected: Clean compile, no errors

- [ ] **Step 2: Run all tests**

Run: `cd backend && go test ./... -v -count=1`
Expected: All tests pass

- [ ] **Step 3: Run vet and check for issues**

Run: `cd backend && go vet ./...`
Expected: No issues
