# Genkit Model Optimization: Smarter Context & Voice Normalization

**Date:** 2026-05-16
**Status:** Draft

## Problem

Two issues with the current Genkit AI flows:

1. **All tasks sent at once.** `getUserActiveTasks` dumps up to 200 tasks + 200 templates (with full detail) into model context for edit/delete operations. Most are irrelevant to the request. This is slow and token-expensive.

2. **Voice input taken verbatim.** Prompts don't instruct the model to clean up voice-transcribed input. Tasks end up with bad capitalization, filler words, and compound sentences that should be split. The model also doesn't infer deadlines or priorities from conversational cues.

## Design

### 1. New Service Method: `GetCategoryNamesSummary`

A new method on `categoryService` that returns a pre-formatted string for prompt injection:

```go
func (s *Service) GetCategoryNamesSummary(userID primitive.ObjectID) (string, error)
```

**Returns** a human-readable summary:

```
Workspace "Personal":
  - Errands (id: 507f1f77bcf86cd799439011)
  - Health (id: 507f1f77bcf86cd799439012)
Workspace "Work":
  - Meetings (id: 507f1f77bcf86cd799439013)
  - Projects (id: 507f1f77bcf86cd799439014)
```

**Called by:** Flow functions in `flows.go`, before `genkit.GenerateData`. The result is injected directly into the prompt string. No tool call needed.

**Affected flows:**
- `multiTaskFromTextFlowWithContext` — removes `getUserCategories` tool, injects summary into prompt
- `intentRouterFlow` — removes `getUserCategories` tool, injects summary into prompt
- `editTasksFlow` — injects summary into prompt (didn't use categories tool before, but benefits from context)
- `queryTasksFlow` — removes `getUserCategories` tool, injects summary into prompt
- `generateBlueprintFlow` — removes `getUserCategories` tool, injects summary into prompt

**Flow input changes:** All affected flows already receive `UserID`. The flow function calls `GetCategoryNamesSummary(userID)` internally — no input struct changes needed. The `categoryService` needs to be accessible from the flow functions, so `InitFlows` will accept a `categoryService` parameter (or the service is added to a context struct).

### 2. Smarter `getUserActiveTasks` Tool

The existing tool gains an optional `query` parameter and a slim fallback mode.

#### Input change

```go
type GetUserActiveTasksInput struct {
    UserID string `json:"userId"    jsonschema_description:"The user's ObjectID as a hex string"`
    Query  string `json:"query,omitempty" jsonschema_description:"Optional keyword search. If provided, only returns tasks whose content or notes contain the keyword (case-insensitive). If omitted, returns all tasks in slim format."`
}
```

#### Behavior

**When `query` is provided (targeted search):**
- Case-insensitive substring match on `content` and `notes` fields
- Returns up to 20 matching tasks in full `ActiveTaskInfo` format (all current fields)
- Returns up to 20 matching templates in full `ActiveTemplateInfo` format
- This is the fast path for targeted edits/deletes

**When `query` is omitted (broad fallback):**
- Returns all tasks (up to 200 cap) in a new slim format
- Returns all templates (up to 200 cap) in slim format

#### New slim types

```go
type SlimTaskInfo struct {
    ID         string `json:"id"         jsonschema_description:"Hex ObjectID of the task"`
    CategoryID string `json:"categoryId" jsonschema_description:"Hex ObjectID of the containing category"`
    Content    string `json:"content"    jsonschema_description:"Task title / description"`
    Priority   int    `json:"priority"   jsonschema_description:"1=low, 2=medium, 3=high"`
    Deadline   string `json:"deadline,omitempty" jsonschema_description:"ISO8601 deadline, absent if none"`
}

type SlimTemplateInfo struct {
    ID             string `json:"id"             jsonschema_description:"Hex ObjectID of the template"`
    CategoryID     string `json:"categoryId"     jsonschema_description:"Hex ObjectID of the containing category"`
    Content        string `json:"content"        jsonschema_description:"Template title / description"`
    Priority       int    `json:"priority"       jsonschema_description:"1=low, 2=medium, 3=high"`
    Deadline       string `json:"deadline,omitempty" jsonschema_description:"ISO8601 deadline, absent if none"`
}
```

#### Output change

The output type becomes a union — either full or slim results are populated:

```go
type GetUserActiveTasksOutput struct {
    UserID        string               `json:"userId"`
    Tasks         []ActiveTaskInfo     `json:"tasks,omitempty"     jsonschema_description:"Full-detail tasks (when query is provided)"`
    Templates     []ActiveTemplateInfo `json:"templates,omitempty" jsonschema_description:"Full-detail templates (when query is provided)"`
    SlimTasks     []SlimTaskInfo       `json:"slimTasks,omitempty"     jsonschema_description:"Slim tasks (when no query, broad fallback)"`
    SlimTemplates []SlimTemplateInfo   `json:"slimTemplates,omitempty" jsonschema_description:"Slim templates (when no query, broad fallback)"`
    Total         int                  `json:"total"`
}
```

### 3. Prompt Changes

#### Category context injection

All affected flow prompts replace tool-call instructions with inline context. Example for `intentRouterFlow`:

**Before:**
```
STEP 1: Call getUserActiveTasks with userId "..." to see all their current tasks and templates
STEP 2: Call getUserCategories with userId "..." to see their existing categories and workspaces
STEP 3: Decompose the user's instruction...
```

**After:**
```
The user's workspaces and categories:
{injected summary from GetCategoryNamesSummary}

STEP 1: If you need to find specific tasks, call getUserActiveTasks with userId "..." and a query keyword to search. If the instruction is broad and you need all tasks, call getUserActiveTasks without a query to get a slim overview.
STEP 2: Decompose the user's instruction...
```

#### Text normalization rules

Added to `multiTaskFromTextFlowWithContext` and `intentRouterFlow` prompts (the two flows that handle user voice/text input for task creation):

```
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
```

### 4. `getUserCategories` Tool Disposition

- **Removed from:** `multiTaskFromTextFlowWithContext`, `intentRouterFlow`, `queryTasksFlow`, `generateBlueprintFlow`
- **Kept for:** `analyticsReportFlow` (needs task-count data per category for stale workspace detection)
- The tool definition stays in `tools.go` — it's just wired to fewer flows

### 5. Flow Function Signature Changes

`InitFlows` needs access to the category service to call `GetCategoryNamesSummary`:

```go
func InitFlows(g *genkit.Genkit, tools *ToolSet, categoryService *Category.Service) *FlowSet
```

Each affected flow function calls `categoryService.GetCategoryNamesSummary(userID)` at the top, before constructing the prompt.

## Files Changed

| File | Change |
|------|--------|
| `internal/handlers/category/service.go` | Add `GetCategoryNamesSummary` method |
| `internal/gemini/types.go` | Add `SlimTaskInfo`, `SlimTemplateInfo`; update `GetUserActiveTasksInput` with `Query` field; update `GetUserActiveTasksOutput` with slim fields |
| `internal/gemini/tools.go` | Update `getUserActiveTasks` implementation for query filtering and slim fallback |
| `internal/gemini/flows.go` | Update `InitFlows` signature; inject category summary into prompts; update prompt text with normalization rules and new tool instructions; remove `getUserCategories` tool from most flows |
| `internal/gemini/genkit.go` | Pass `categoryService` through to `InitFlows` |
| Wherever `InitFlows` is called | Pass the category service |

## What This Does NOT Change

- `generateTaskFlow` (single task, no context needed)
- `multiTaskFromTextFlow` (basic, no user context)
- `generateTaskFromImageFlow` (image-based, separate concern)
- `analyticsReportFlow` (still uses `getUserCategories` + `getCompletedTasks` tools as-is)
- Database schemas / MongoDB collections
- HTTP endpoints / API contract
- Frontend code
