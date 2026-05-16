# Genkit SSE Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Server-Sent Events streaming to the four main Genkit NLP flows so the frontend gets real-time progress events instead of waiting for the full LLM response.

**Architecture:** New raw Fiber SSE handlers sit alongside the existing Huma endpoints. They share the same auth middleware and reuse the existing Genkit `GenerateData[T]()` calls, but emit SSE events between stages. The frontend gets a new `useSSEStream` hook that reads the event stream and feeds progress into the existing UI components.

**Tech Stack:** Go (Fiber SSE via `c.Context().SetBodyStreamWriter`), Genkit Go v1.0.2, React Native (Expo 55 fetch ReadableStream), TypeScript

---

## File Structure

### Backend (new files)
| File | Responsibility |
|------|---------------|
| `backend/internal/handlers/task/sse_writer.go` | `SSEWriter` struct: formats and flushes SSE frames to a Fiber response |
| `backend/internal/handlers/task/stream_handlers.go` | Raw Fiber SSE handlers for intent/create/query/edit streaming |
| `backend/internal/gemini/prompts.go` | Extracted prompt-building functions (shared by flows and stream handlers) |

### Backend (modified files)
| File | Change |
|------|--------|
| `backend/internal/gemini/flows.go` | Call extracted prompt helpers instead of inline strings |
| `backend/internal/server/server.go` | Register raw Fiber SSE routes |

### Frontend (new files)
| File | Responsibility |
|------|---------------|
| `frontend/hooks/useSSEStream.ts` | Generic SSE fetch + parse hook returning `{ stage, message, result, error, isStreaming }` |
| `frontend/api/stream.ts` | Streaming API functions that use fetch with ReadableStream |

### Frontend (modified files)
| File | Change |
|------|--------|
| `frontend/hooks/useIntentRouterFlow.ts` | Use streaming endpoint, expose `stage`/`message` state |
| `frontend/components/TaskGenerationLoading.tsx` | Accept and display streaming `message` updates |
| `frontend/components/ui/fab/VoiceInputOverlay.tsx` | Pass streaming state to loading component |
| `frontend/app/(logged-in)/(tabs)/(task)/text-dump.tsx` | Switch to streaming API |

---

## Task 1: SSEWriter utility

**Files:**
- Create: `backend/internal/handlers/task/sse_writer.go`

- [ ] **Step 1: Write the SSEWriter struct and Send method**

```go
package task

import (
	"bufio"
	"encoding/json"
	"fmt"
)

// SSEWriter writes Server-Sent Events to a buffered writer with flushing.
type SSEWriter struct {
	w *bufio.Writer
}

// NewSSEWriter wraps a bufio.Writer for SSE output.
func NewSSEWriter(w *bufio.Writer) *SSEWriter {
	return &SSEWriter{w: w}
}

// Send writes a single SSE event (event + JSON-encoded data) and flushes.
func (s *SSEWriter) Send(event string, data interface{}) error {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("sse marshal: %w", err)
	}
	// Write SSE frame: "event: <type>\ndata: <json>\n\n"
	if _, err := fmt.Fprintf(s.w, "event: %s\ndata: %s\n\n", event, jsonBytes); err != nil {
		return err
	}
	return s.w.Flush()
}

// SendError writes an error event and flushes.
func (s *SSEWriter) SendError(message string) error {
	return s.Send("error", map[string]string{"message": message})
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./...`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/task/sse_writer.go
git commit -m "feat(sse): add SSEWriter utility for streaming events"
```

---

## Task 2: Extract prompt-building functions from flows

**Files:**
- Create: `backend/internal/gemini/prompts.go`
- Modify: `backend/internal/gemini/flows.go`

- [ ] **Step 1: Create prompts.go with extracted prompt builders**

Extract the four prompt-building sections from `flows.go` into standalone functions. Each function takes the flow's input type and returns the prompt string.

```go
package gemini

import (
	"fmt"
	"time"
)

// BuildMultiTaskWithContextPrompt builds the prompt for the multiTaskFromTextFlowWithContext flow.
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

// BuildQueryTasksPrompt builds the prompt for the queryTasksFlow.
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

// BuildEditTasksPrompt builds the prompt for the editTasksFlow.
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

// BuildIntentRouterPrompt builds the prompt for the intentRouterFlow.
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
```

- [ ] **Step 2: Update flows.go to use extracted prompt builders**

Replace the inline prompt strings in each flow with calls to the new functions. For example, in the `multiTaskFromTextFlowWithContext` flow (line 84-95 of flows.go), replace the `prompt := fmt.Sprintf(...)` block with:

```go
prompt := BuildMultiTaskWithContextPrompt(input.UserID, input.Text, input.Timezone)
```

Do the same for:
- `queryTasksFlow` (line 262-282) → `BuildQueryTasksPrompt(input.UserID, input.Text, input.Timezone)`
- `editTasksFlow` (line 303-330) → `BuildEditTasksPrompt(input.UserID, input.Text, input.Timezone)`
- `intentRouterFlow` (line 354-395) → `BuildIntentRouterPrompt(input.UserID, input.Text, input.Timezone)`

- [ ] **Step 3: Verify it compiles and existing flows still work**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./...`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/internal/gemini/prompts.go backend/internal/gemini/flows.go
git commit -m "refactor(gemini): extract prompt builders for reuse by stream handlers"
```

---

## Task 3: Backend streaming handlers

**Files:**
- Create: `backend/internal/handlers/task/stream_handlers.go`
- Modify: `backend/internal/server/server.go`

This is the core backend task. The streaming handlers bypass Huma (which doesn't support SSE) and use raw Fiber handlers. Auth is already applied at the `/v1/user` prefix via Fiber middleware, so the handlers get `userID` from `c.Locals`.

- [ ] **Step 1: Create stream_handlers.go with the intent streaming handler**

Start with the intent router (slowest, most impactful). The pattern will be reused for the other three.

```go
package task

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"reflect"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// StreamIntentNaturalLanguage handles POST /v1/user/tasks/natural-language/intent/stream
// It streams SSE events during the intent router flow.
func (h *Handler) StreamIntentNaturalLanguage(c *fiber.Ctx) error {
	// Parse request body
	var body struct {
		Text     string `json:"text"`
		Timezone string `json:"timezone"`
	}
	if err := c.BodyParser(&body); err != nil || body.Text == "" {
		return c.Status(400).JSON(fiber.Map{"error": "text field is required"})
	}

	// Get authenticated user from Fiber locals (set by auth middleware)
	userID, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Please log in to continue"})
	}
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	// Consume credit
	err = h.service.Users.ConsumeCredit(c.UserContext(), userObjID, types.CreditTypeNaturalLanguage)
	if err != nil {
		if err == types.ErrInsufficientCredits {
			return c.Status(403).JSON(fiber.Map{"error": "Insufficient credits"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Unable to process your credit"})
	}

	timezone := body.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	slog.LogAttrs(c.UserContext(), slog.LevelInfo, "Starting streaming intent routing",
		slog.String("userID", userID),
		slog.String("inputText", body.Text))

	// Set SSE headers
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	// Capture values for the closure
	text := body.Text
	geminiService := h.geminiService
	handler := h

	c.Context().SetBodyStreamWriter(func(w *fasthttp.RequestCtx) {
		bw := bufio.NewWriter(w)
		sse := NewSSEWriter(bw)

		// Run the intent flow with SSE events
		result, err := handler.runIntentFlowWithSSE(context.Background(), sse, geminiService, userID, text, timezone)
		if err != nil {
			slog.Error("Streaming intent flow failed", "userID", userID, "error", err)
			sse.SendError(err.Error())

			// Refund credit on failure
			refundErr := handler.service.Users.AddCredits(context.Background(), userObjID, types.CreditTypeNaturalLanguage, 1)
			if refundErr != nil {
				slog.Error("Failed to refund credit", "userID", userID, "error", refundErr)
			}
			return
		}

		// Process the ops (apply edits, resolve deletes) same as non-streaming handler
		responseOps := handler.processIntentOps(context.Background(), userObjID, userID, result)
		sse.Send("result", map[string]interface{}{"ops": responseOps})
	})

	return nil
}

// runIntentFlowWithSSE runs the intent router Genkit flow, emitting SSE events at each stage.
func (h *Handler) runIntentFlowWithSSE(ctx context.Context, sse *SSEWriter, geminiService any, userID, text, timezone string) (*IntentRouterOutputLocal, error) {
	sse.Send("status", map[string]string{
		"stage":   "starting",
		"message": "Processing your request...",
	})

	// Call the Gemini intent flow (same reflection approach as callGeminiIntentFlow)
	result, err := h.callGeminiIntentFlow(ctx, userID, text, timezone)
	if err != nil {
		// Retry once
		sse.Send("status", map[string]string{
			"stage":   "retrying",
			"message": "Retrying...",
		})
		result, err = h.callGeminiIntentFlow(ctx, userID, text, timezone)
		if err != nil {
			return nil, err
		}
	}

	sse.Send("status", map[string]string{
		"stage":   "processing_results",
		"message": "Preparing your results...",
	})

	return result, nil
}

// processIntentOps processes the raw Genkit intent output into response ops.
// This is the same logic as IntentTaskNaturalLanguage but extracted for reuse.
func (h *Handler) processIntentOps(ctx context.Context, userObjID primitive.ObjectID, userID string, intentOutput *IntentRouterOutputLocal) []IntentOpResponse {
	var responseOps []IntentOpResponse

	for _, op := range intentOutput.Ops {
		switch op.Type {
		case "edit":
			if op.EditPayload == nil {
				continue
			}
			editedTasks, editedTemplates, totalEdited := h.applyEditInstructions(ctx, userObjID, userID, op.EditPayload)
			responseOps = append(responseOps, IntentOpResponse{
				Type: "edit",
				EditResult: &EditResultResponse{
					Tasks:       editedTasks,
					Templates:   editedTemplates,
					EditedCount: totalEdited,
				},
			})

		case "delete":
			if op.DeletePayload == nil {
				continue
			}
			filters, err := convertQueryOutput(op.DeletePayload)
			if err != nil {
				slog.Warn("Failed to convert delete query output", "error", err)
				continue
			}
			tasks, err := h.service.QueryTasksByUser(userObjID, filters)
			if err != nil {
				slog.Warn("Failed to query tasks for delete op", "error", err)
				continue
			}
			responseOps = append(responseOps, IntentOpResponse{
				Type:        "delete",
				DeleteTasks: tasks,
			})

		case "create":
			if op.CreatePayload == nil {
				continue
			}
			responseOps = append(responseOps, IntentOpResponse{
				Type:          "create",
				CreatePreview: op.CreatePayload,
			})
		}
	}

	if responseOps == nil {
		responseOps = []IntentOpResponse{}
	}
	return responseOps
}

// StreamCreateNaturalLanguage handles POST /v1/user/tasks/natural-language/stream
func (h *Handler) StreamCreateNaturalLanguage(c *fiber.Ctx) error {
	var body struct {
		Text     string `json:"text"`
		Timezone string `json:"timezone"`
	}
	if err := c.BodyParser(&body); err != nil || body.Text == "" {
		return c.Status(400).JSON(fiber.Map{"error": "text field is required"})
	}

	userID, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Please log in to continue"})
	}
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	err = h.service.Users.ConsumeCredit(c.UserContext(), userObjID, types.CreditTypeNaturalLanguage)
	if err != nil {
		if err == types.ErrInsufficientCredits {
			return c.Status(403).JSON(fiber.Map{"error": "Insufficient credits"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Unable to process your credit"})
	}

	timezone := body.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	text := body.Text
	handler := h

	c.Context().SetBodyStreamWriter(func(w *fasthttp.RequestCtx) {
		bw := bufio.NewWriter(w)
		sse := NewSSEWriter(bw)

		sse.Send("status", map[string]string{
			"stage":   "starting",
			"message": "Processing your request...",
		})

		result, err := handler.callGeminiFlow(context.Background(), userID, text, timezone)
		if err != nil {
			sse.Send("status", map[string]string{"stage": "retrying", "message": "Retrying..."})
			result, err = handler.callGeminiFlow(context.Background(), userID, text, timezone)
			if err != nil {
				handler.service.Users.AddCredits(context.Background(), userObjID, types.CreditTypeNaturalLanguage, 1)
				sse.SendError("Failed to process with AI after retry. Your credit has been refunded.")
				return
			}
		}

		sse.Send("status", map[string]string{"stage": "processing_results", "message": "Preparing your results..."})

		// Process and create tasks (same as CreateTaskNaturalLanguage)
		newCategoryTasks, newCategoryMetadata, categoriesCreated, newCategoryTaskCount, err := handler.processNewCategories(context.Background(), result.Categories, userObjID)
		if err != nil {
			sse.SendError(err.Error())
			return
		}
		existingCategoryTasks, existingCategoryTaskCount, err := handler.processExistingCategoryTasks(context.Background(), result.Tasks, userObjID)
		if err != nil {
			sse.SendError(err.Error())
			return
		}

		allTasks := append(newCategoryTasks, existingCategoryTasks...)
		totalTasks := newCategoryTaskCount + existingCategoryTaskCount

		var message string
		if totalTasks == 0 {
			message = "No valid tasks could be created from the provided text"
		} else if categoriesCreated > 0 {
			message = fmt.Sprintf("Successfully created %d tasks in %d new categories", totalTasks, categoriesCreated)
		} else {
			message = fmt.Sprintf("Successfully created %d tasks in existing categories", totalTasks)
		}

		sse.Send("result", map[string]interface{}{
			"categoriesCreated": categoriesCreated,
			"newCategories":     newCategoryMetadata,
			"tasksCreated":      totalTasks,
			"tasks":             allTasks,
			"message":           message,
		})
	})

	return nil
}

// StreamQueryNaturalLanguage handles POST /v1/user/tasks/natural-language/query/stream
func (h *Handler) StreamQueryNaturalLanguage(c *fiber.Ctx) error {
	var body struct {
		Text     string `json:"text"`
		Timezone string `json:"timezone"`
	}
	if err := c.BodyParser(&body); err != nil || body.Text == "" {
		return c.Status(400).JSON(fiber.Map{"error": "text field is required"})
	}

	userID, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Please log in to continue"})
	}
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	err = h.service.Users.ConsumeCredit(c.UserContext(), userObjID, types.CreditTypeNaturalLanguage)
	if err != nil {
		if err == types.ErrInsufficientCredits {
			return c.Status(403).JSON(fiber.Map{"error": "Insufficient credits"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Unable to process your credit"})
	}

	timezone := body.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	text := body.Text
	handler := h

	c.Context().SetBodyStreamWriter(func(w *fasthttp.RequestCtx) {
		bw := bufio.NewWriter(w)
		sse := NewSSEWriter(bw)

		sse.Send("status", map[string]string{"stage": "starting", "message": "Processing your query..."})

		queryOutput, err := handler.callGeminiQueryFlow(context.Background(), userID, text, timezone)
		if err != nil {
			sse.Send("status", map[string]string{"stage": "retrying", "message": "Retrying..."})
			queryOutput, err = handler.callGeminiQueryFlow(context.Background(), userID, text, timezone)
			if err != nil {
				handler.service.Users.AddCredits(context.Background(), userObjID, types.CreditTypeNaturalLanguage, 1)
				sse.SendError("Failed to process query after retry. Your credit has been refunded.")
				return
			}
		}

		sse.Send("status", map[string]string{"stage": "querying_tasks", "message": "Finding matching tasks..."})

		filters, err := convertQueryOutput(queryOutput)
		if err != nil {
			sse.SendError("The AI response could not be interpreted. Please try rephrasing your query.")
			return
		}

		tasks, err := handler.service.QueryTasksByUser(userObjID, filters)
		if err != nil {
			sse.SendError("Unable to query tasks due to a server error.")
			return
		}

		sse.Send("result", map[string]interface{}{
			"tasks": tasks,
			"query": filters,
		})
	})

	return nil
}

// StreamEditNaturalLanguage handles POST /v1/user/tasks/natural-language/edit/stream
func (h *Handler) StreamEditNaturalLanguage(c *fiber.Ctx) error {
	var body struct {
		Text     string `json:"text"`
		Timezone string `json:"timezone"`
	}
	if err := c.BodyParser(&body); err != nil || body.Text == "" {
		return c.Status(400).JSON(fiber.Map{"error": "text field is required"})
	}

	userID, err := auth.RequireAuthFiber(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Please log in to continue"})
	}
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	err = h.service.Users.ConsumeCredit(c.UserContext(), userObjID, types.CreditTypeNaturalLanguage)
	if err != nil {
		if err == types.ErrInsufficientCredits {
			return c.Status(403).JSON(fiber.Map{"error": "Insufficient credits"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Unable to process your credit"})
	}

	timezone := body.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	text := body.Text
	handler := h

	c.Context().SetBodyStreamWriter(func(w *fasthttp.RequestCtx) {
		bw := bufio.NewWriter(w)
		sse := NewSSEWriter(bw)

		sse.Send("status", map[string]string{"stage": "starting", "message": "Processing your edit..."})

		editOutput, err := handler.callGeminiEditFlow(context.Background(), userID, text, timezone)
		if err != nil {
			sse.Send("status", map[string]string{"stage": "retrying", "message": "Retrying..."})
			editOutput, err = handler.callGeminiEditFlow(context.Background(), userID, text, timezone)
			if err != nil {
				handler.service.Users.AddCredits(context.Background(), userObjID, types.CreditTypeNaturalLanguage, 1)
				sse.SendError("Failed to process edit after retry. Your credit has been refunded.")
				return
			}
		}

		sse.Send("status", map[string]string{"stage": "applying_edits", "message": "Applying changes..."})

		if len(editOutput.Instructions) == 0 && len(editOutput.TemplateInstructions) == 0 {
			sse.Send("result", map[string]interface{}{
				"tasks":       []TaskDocument{},
				"templates":   []TemplateTaskDocument{},
				"editedCount": 0,
				"message":     "No matching tasks found",
			})
			return
		}

		editedTasks, editedTemplates, totalEdited := handler.applyEditInstructions(
			context.Background(), userObjID, userID, editOutput,
		)

		var message string
		switch totalEdited {
		case 0:
			message = "No matching tasks found"
		case 1:
			message = "Successfully edited 1 task"
		default:
			message = fmt.Sprintf("Successfully edited %d tasks", totalEdited)
		}

		sse.Send("result", map[string]interface{}{
			"tasks":       editedTasks,
			"templates":   editedTemplates,
			"editedCount": totalEdited,
			"message":     message,
		})
	})

	return nil
}
```

Note: The `reflect` and `json` imports may already be used — remove any unused imports after writing the file.

- [ ] **Step 2: Fix the SetBodyStreamWriter signature**

The `fasthttp.RequestCtx.SetBodyStreamWriter` callback signature is `func(w *bufio.Writer)`. Update accordingly:

```go
c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
    sse := NewSSEWriter(w)
    // ... rest of handler
})
```

Remove the `bufio.NewWriter(w)` wrapping since `w` is already a `*bufio.Writer`.

- [ ] **Step 3: Register the streaming routes in server.go**

Add raw Fiber routes after the Huma API registration. These go after `task.Routes(api, collections, geminiService)` in `server.go`:

```go
// Register raw Fiber SSE streaming routes for NLP flows
// These bypass Huma since SSE requires raw streaming responses.
// Auth is already applied by the /v1/user middleware above.
taskHandler := task.NewStreamHandler(collections, geminiService)
app.Post("/api/v1/user/tasks/natural-language/intent/stream", taskHandler.StreamIntentNaturalLanguage)
app.Post("/api/v1/user/tasks/natural-language/stream", taskHandler.StreamCreateNaturalLanguage)
app.Post("/api/v1/user/tasks/natural-language/query/stream", taskHandler.StreamQueryNaturalLanguage)
app.Post("/api/v1/user/tasks/natural-language/edit/stream", taskHandler.StreamEditNaturalLanguage)
```

Note: The `/api` prefix is needed because Huma's base URL includes `/api`, but raw Fiber routes are registered directly on the app. Check the actual path by looking at how `baseClient` in the frontend constructs URLs: `baseUrl: (process.env.EXPO_PUBLIC_URL ?? "") + "/api"` — so the Fiber routes need the `/api` prefix to match.

Also add a constructor for the stream handler in `stream_handlers.go`:

```go
// NewStreamHandler creates a Handler for SSE streaming routes.
func NewStreamHandler(collections map[string]*mongo.Collection, geminiService any) *Handler {
    service := newService(collections)
    return &Handler{
        service:       service,
        geminiService: geminiService,
    }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./...`
Expected: PASS

Fix any compilation errors (unused imports, signature mismatches, etc.)

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handlers/task/stream_handlers.go backend/internal/server/server.go
git commit -m "feat(sse): add streaming SSE handlers for NLP flows"
```

---

## Task 4: Frontend SSE stream hook and API functions

**Files:**
- Create: `frontend/api/stream.ts`
- Create: `frontend/hooks/useSSEStream.ts`

- [ ] **Step 1: Create the SSE API utility in stream.ts**

```typescript
import * as SecureStore from "expo-secure-store";

const BASE_URL = (process.env.EXPO_PUBLIC_URL ?? "") + "/api";

export type SSEEventType = "status" | "tool_call" | "generating" | "result" | "error";

export interface SSEStatusData {
    stage: string;
    message: string;
}

export interface SSEErrorData {
    message: string;
}

export interface SSEEvent<T = unknown> {
    type: SSEEventType;
    data: T;
}

/**
 * POST to an SSE endpoint and call onEvent for each parsed SSE frame.
 * Returns a promise that resolves when the stream closes.
 */
export async function fetchSSEStream<TResult>(
    path: string,
    body: Record<string, unknown>,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal,
): Promise<void> {
    // Get auth token
    const authData = await SecureStore.getItemAsync("auth_data");
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (authData) {
        const { access_token, refresh_token } = JSON.parse(authData);
        if (access_token) headers["Authorization"] = `Bearer ${access_token}`;
        if (refresh_token) headers["refresh_token"] = refresh_token;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE frames: split on double newlines
        const frames = buffer.split("\n\n");
        // Last element is either empty or an incomplete frame
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
            if (!frame.trim()) continue;

            let eventType = "message";
            let data = "";

            for (const line of frame.split("\n")) {
                if (line.startsWith("event: ")) {
                    eventType = line.slice(7).trim();
                } else if (line.startsWith("data: ")) {
                    data = line.slice(6);
                }
            }

            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    onEvent({ type: eventType as SSEEventType, data: parsed });
                } catch {
                    // Skip malformed frames
                }
            }
        }
    }
}
```

- [ ] **Step 2: Create the useSSEStream hook**

```typescript
import { useCallback, useRef, useState } from "react";
import { fetchSSEStream, type SSEEvent, type SSEStatusData, type SSEErrorData } from "@/api/stream";

export interface SSEStreamState<TResult> {
    stage: string | null;
    message: string | null;
    result: TResult | null;
    error: string | null;
    isStreaming: boolean;
}

/**
 * Generic hook for consuming an SSE streaming endpoint.
 * Returns state that updates as events arrive, and a `start` function.
 */
export function useSSEStream<TResult>() {
    const [stage, setStage] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [result, setResult] = useState<TResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const start = useCallback(
        async (path: string, body: Record<string, unknown>): Promise<TResult | null> => {
            // Cancel any in-progress stream
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setStage(null);
            setMessage(null);
            setResult(null);
            setError(null);
            setIsStreaming(true);

            let finalResult: TResult | null = null;

            try {
                await fetchSSEStream(
                    path,
                    body,
                    (event: SSEEvent) => {
                        switch (event.type) {
                            case "status":
                            case "tool_call":
                            case "generating": {
                                const d = event.data as SSEStatusData;
                                setStage(d.stage);
                                setMessage(d.message);
                                break;
                            }
                            case "result":
                                finalResult = event.data as TResult;
                                setResult(finalResult);
                                break;
                            case "error": {
                                const d = event.data as SSEErrorData;
                                setError(d.message);
                                break;
                            }
                        }
                    },
                    controller.signal,
                );
            } catch (err: unknown) {
                if (err instanceof Error && err.name !== "AbortError") {
                    setError(err.message);
                }
            } finally {
                setIsStreaming(false);
                abortRef.current = null;
            }

            return finalResult;
        },
        [],
    );

    const cancel = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setStage(null);
        setMessage(null);
        setResult(null);
        setError(null);
        setIsStreaming(false);
    }, []);

    return { stage, message, result, error, isStreaming, start, cancel, reset };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors (existing errors unrelated to this work are OK)

- [ ] **Step 4: Commit**

```bash
git add frontend/api/stream.ts frontend/hooks/useSSEStream.ts
git commit -m "feat(frontend): add SSE stream hook and API utilities"
```

---

## Task 5: Integrate streaming into useIntentRouterFlow

**Files:**
- Modify: `frontend/hooks/useIntentRouterFlow.ts`

- [ ] **Step 1: Add streaming state and use the SSE hook**

Update `useIntentRouterFlow` to use the streaming endpoint and expose `stage`/`message`:

Replace the current `processText` implementation. The hook should:
1. Import and use `useSSEStream`
2. In `processText`, call `sseStream.start("/v1/user/tasks/natural-language/intent/stream", { text, timezone })`
3. When the `result` arrives via the stream, process it the same way as the current `intentTaskNaturalLanguageAPI` response
4. Expose `streamStage` and `streamMessage` from the SSE hook state
5. Keep the existing fallback: if the stream fails, try the non-streaming endpoint

Add to the return type:
```typescript
streamStage: string | null;
streamMessage: string | null;
```

The key change is in `processText`:
```typescript
const processText = useCallback(
    async (text: string, timezone?: string) => {
        if (!text.trim()) return;
        clearError();
        setIsPreviewing(true);
        try {
            const resolvedTimezone =
                timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

            // Try streaming endpoint first
            const streamResult = await sseStream.start(
                "/v1/user/tasks/natural-language/intent/stream",
                { text: text.trim(), timezone: resolvedTimezone },
            );

            if (sseStream.error) {
                throw new Error(sseStream.error);
            }

            const ops = (streamResult as any)?.ops ?? [];
            if (ops.length === 0) {
                setError("Nothing to do", [
                    "No matching tasks or instructions found. Try rephrasing.",
                ]);
                setIsPreviewing(false);
                return;
            }
            setPendingOps(ops);
            currentOpIndexRef.current = 0;
            advanceToNextOp(ops, 0);
        } catch (error) {
            // Fallback to non-streaming endpoint
            try {
                const result = await intentTaskNaturalLanguageAPI(text.trim(), timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
                const ops = result.ops ?? [];
                if (ops.length === 0) {
                    setError("Nothing to do", ["No matching tasks or instructions found. Try rephrasing."]);
                    setIsPreviewing(false);
                    return;
                }
                setPendingOps(ops);
                currentOpIndexRef.current = 0;
                advanceToNextOp(ops, 0);
            } catch (fallbackError) {
                setErrorFromModel(fallbackError, "Couldn't Process Request", "Please try again.");
            }
        } finally {
            setIsPreviewing(false);
            sseStream.reset();
        }
    },
    [advanceToNextOp, clearError, setError, setErrorFromModel, sseStream],
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/useIntentRouterFlow.ts
git commit -m "feat(frontend): integrate SSE streaming into intent router hook"
```

---

## Task 6: Update TaskGenerationLoading to show streaming messages

**Files:**
- Modify: `frontend/components/TaskGenerationLoading.tsx`

- [ ] **Step 1: Make the component react to changing messages**

The component already accepts `message` and `submessage` props (lines 8-10). No structural changes needed — the parent just needs to pass the streaming `message` as the `submessage` prop. The `message` prop stays as "Processing with AI..." and `submessage` shows the real-time status.

If the streaming message is available, pass it as `submessage`:

```tsx
<TaskGenerationLoading
    submessage={streamMessage ?? "This may take a few moments"}
/>
```

This change happens in the parent components (VoiceInputOverlay, text-dump), not in TaskGenerationLoading itself. No change needed to this file unless the animation should change based on stage — which we're deferring.

Mark this as done — the component already supports dynamic messages via props.

- [ ] **Step 2: Commit (if any changes were made)**

No commit needed for this task — the component already accepts the props.

---

## Task 7: Wire streaming into VoiceInputOverlay and TextDump

**Files:**
- Modify: `frontend/components/ui/fab/VoiceInputOverlay.tsx`
- Modify: `frontend/app/(logged-in)/(tabs)/(task)/text-dump.tsx`

- [ ] **Step 1: Update VoiceInputOverlay to pass streaming state**

The VoiceInputOverlay uses `useIntentRouterFlow` (line 98-122 in VoiceInputOverlay.tsx). After Task 5, the hook exposes `streamStage` and `streamMessage`. Find where the loading/reading animation is shown during `isPreviewing` and pass the `streamMessage` to the UI.

In the section where the reading animation plays (around lines 387-412), add the streaming message display. If `streamMessage` is non-null, show it below the word-by-word animation as a status line.

- [ ] **Step 2: Update text-dump.tsx to use streaming**

The text-dump component currently uses `createTasksFromNaturalLanguageAPI` directly (line 55). Update it to use the streaming intent flow instead. Import `useIntentRouterFlow` (or `useSSEStream` directly) and pass `streamMessage` to `TaskGenerationLoading`.

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/fab/VoiceInputOverlay.tsx frontend/app/(logged-in)/(tabs)/(task)/text-dump.tsx
git commit -m "feat(frontend): wire streaming status messages into voice and text-dump UIs"
```

---

## Future Enhancement: Tool Call Interception

The spec describes emitting `tool_call` events when Genkit invokes tools (e.g., `getUserCategories`). The current plan emits coarse `status` events around the opaque `flow.Run()` call because intercepting individual tool calls would require replacing `flow.Run()` with inline `genkit.GenerateData[T]()` calls and tool wrappers — a larger refactor. This can be added in a follow-up by:
1. Calling `genkit.GenerateData` directly in the streaming handler (using extracted prompts from `prompts.go`)
2. Wrapping each tool with an SSE-emitting decorator before passing to `ai.WithTools()`

This would give granular events like `tool_call:getUserCategories` but is not needed for the v1 UX improvement.

---

## Task 8: End-to-end verification

- [ ] **Step 1: Verify backend compiles and starts**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./...`
Expected: PASS

- [ ] **Step 2: Verify frontend compiles**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

- [ ] **Step 3: Verify no existing tests break**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./... 2>&1 | tail -20`
Expected: All existing tests still pass

- [ ] **Step 4: Final commit with all files**

Verify `git status` shows only the expected new/modified files. Create a final cleanup commit if needed.
