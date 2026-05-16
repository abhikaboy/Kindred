# Genkit SSE Streaming Design

## Problem

All Genkit LLM flows (task creation, editing, querying, intent routing) are synchronous HTTP POST endpoints. The frontend waits for the full response before showing anything. The intent router flow is the worst offender — it makes multiple tool calls (getUserActiveTasks, getUserCategories) before generating structured output, causing multi-second waits with no feedback.

## Solution

Add Server-Sent Events (SSE) streaming endpoints that emit progress events during LLM processing, then deliver the final structured result. The existing synchronous endpoints remain untouched.

## SSE Event Protocol

Each event is a standard SSE frame (`event:` + `data:` fields). The stream sends events in this order:

| Event Type | When Emitted | Payload Shape |
|---|---|---|
| `status` | Flow reaches a named stage | `{"stage": "<stage_name>", "message": "<human-readable>"}` |
| `tool_call` | Genkit invokes a tool | `{"tool": "<tool_name>", "message": "<human-readable>"}` |
| `generating` | LLM generation begins (post-tool-calls) | `{"message": "Generating..."}` |
| `result` | Final structured JSON is ready | Same shape as current endpoint response body |
| `error` | Flow fails at any point | `{"message": "<error description>"}` |

### Stage Names by Flow

**IntentRouterFlow:**
`looking_up_tasks` -> `tool_call:getUserActiveTasks` -> `looking_up_categories` -> `tool_call:getUserCategories` -> `generating` -> `result`

**MultiTaskFromTextFlowWithContext:**
`looking_up_categories` -> `tool_call:getUserCategories` -> `generating` -> `result`

**QueryTasksFlow:**
`looking_up_categories` -> `tool_call:getUserCategories` -> `generating` -> `result`

**EditTasksFlow:**
`looking_up_tasks` -> `tool_call:getUserActiveTasks` -> `generating` -> `result`

### Human-Readable Messages

| Stage / Tool | Message |
|---|---|
| `looking_up_tasks` | "Looking up your tasks..." |
| `looking_up_categories` | "Checking your categories..." |
| `tool_call:getUserActiveTasks` | "Reading your active tasks..." |
| `tool_call:getUserCategories` | "Reading your categories..." |
| `generating` | "Generating..." |

## Backend Architecture

### New Streaming Endpoints

New endpoints alongside existing ones (no changes to current endpoints):

| Method | Path | Streams | Replaces (non-streaming) |
|---|---|---|---|
| POST | `/v1/user/tasks/natural-language/intent/stream` | IntentRouterFlow | `/v1/user/tasks/natural-language/intent` |
| POST | `/v1/user/tasks/natural-language/stream` | MultiTaskFromTextFlowWithContext | `/v1/user/tasks/natural-language` |
| POST | `/v1/user/tasks/natural-language/query/stream` | QueryTasksFlow | `/v1/user/tasks/natural-language/query` |
| POST | `/v1/user/tasks/natural-language/edit/stream` | EditTasksFlow | `/v1/user/tasks/natural-language/edit` |

All endpoints accept the same request body as their non-streaming counterparts.

### SSE Response Headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### Event Emitter Pattern

A lightweight `SSEWriter` struct wraps Fiber's response writer:

```go
type SSEEvent struct {
    Type string      // "status", "tool_call", "generating", "result", "error"
    Data interface{} // JSON-serializable payload
}

type SSEWriter struct {
    ctx *fiber.Ctx
}

func (w *SSEWriter) Send(event SSEEvent) error {
    // Marshal data to JSON, write "event: <type>\ndata: <json>\n\n", flush
}
```

### Streaming Handler Structure

Instead of calling `flow.Run()` (which is opaque), the streaming handlers inline the flow logic to emit events between stages:

```
1. Parse request, authenticate user
2. Set SSE headers
3. Emit status("looking_up_categories")
4. Build prompt with tool context
5. Call genkit.GenerateData[T]() with tool wrappers that emit tool_call events
6. Emit generating() just before the LLM call
7. On success: emit result(structured_output)
8. On failure: emit error(message)
9. Close connection
```

### Tool Call Interception

Wrap each Genkit tool to emit SSE events when invoked. The wrapper delegates to the real tool implementation after emitting the event:

```go
func wrapToolWithSSE(realTool *ai.Tool, writer *SSEWriter, message string) {
    // Before tool executes: writer.Send(SSEEvent{Type: "tool_call", ...})
    // Then call real tool
}
```

This avoids modifying the actual tool implementations in `tools.go`.

### Concurrency Model

The handler runs synchronously on Fiber's goroutine — no separate worker goroutine or channel needed. The flow stages execute sequentially, and we write SSE events to the response between stages. Fiber's `ctx.SendStream()` or direct response writing handles flushing.

This is simpler than a channel-based approach because:
- The flow is inherently sequential (tool calls -> generation -> result)
- There's no need for concurrent event production
- Fiber can flush after each write

### File Organization

New files:
- `backend/internal/handlers/task/sse_writer.go` — SSEWriter struct and Send method
- `backend/internal/handlers/task/stream_handlers.go` — streaming endpoint handlers

Modified files:
- `backend/internal/handlers/task/routes.go` — register new `/stream` routes
- `backend/internal/gemini/flows.go` — extract prompt-building into reusable helpers (the prompts are currently inline in flow definitions; streaming handlers need to build the same prompts without going through `DefineFlow`)

### Prompt Extraction

Currently, each flow's prompt is built inline inside `genkit.DefineFlow()`. The streaming handlers need the same prompts but outside the flow wrapper. Extract prompt-building into standalone functions:

```go
// In flows.go or a new prompts.go
func BuildIntentRouterPrompt(input IntentRouterInput) string { ... }
func BuildMultiTaskPrompt(input MultiTaskFromTextInputWithUser) string { ... }
func BuildQueryTasksPrompt(input QueryTasksFlowInput) string { ... }
func BuildEditTasksPrompt(input EditTasksFlowInput) string { ... }
```

The existing flows call these same functions, keeping behavior identical.

## Frontend Architecture

### SSE Client Hook

New hook: `frontend/hooks/useSSEStream.ts`

A generic SSE consumption hook using `fetch()` with `ReadableStream`:

```typescript
type SSEState<T> = {
    stage: string | null;
    message: string | null;
    result: T | null;
    error: string | null;
    isStreaming: boolean;
};

function useSSEStream<T>(url: string, body: object): SSEState<T>;
```

Implementation reads the fetch response body as a stream, parses SSE frames, and updates React state for each event.

React Native compatibility: Expo 55 (this project's version) supports `ReadableStream` in fetch natively. No polyfill needed. The hook reads the response body stream directly.

### Updated Intent Router Hook

Modify `frontend/hooks/useIntentRouterFlow.ts` to use the streaming endpoint:

Current flow:
```
isPreviewing=true -> await intentTaskNaturalLanguageAPI() -> process result -> isPreviewing=false
```

New flow:
```
isStreaming=true -> POST to /stream endpoint -> receive status events (update stage/message) -> receive result event -> process result -> isStreaming=false
```

The hook exposes `stage` and `message` in addition to existing state, so the UI can show progress.

### Updated API Functions

New streaming API functions in `frontend/api/task.ts`:

```typescript
export function streamIntentNaturalLanguage(text: string, timezone: string, onEvent: (event: SSEEvent) => void): Promise<void>;
export function streamCreateTasksNaturalLanguage(text: string, onEvent: (event: SSEEvent) => void): Promise<void>;
export function streamQueryTasksNaturalLanguage(text: string, timezone: string, onEvent: (event: SSEEvent) => void): Promise<void>;
export function streamEditTasksNaturalLanguage(text: string, timezone: string, onEvent: (event: SSEEvent) => void): Promise<void>;
```

These use `fetch` directly (not the openapi-fetch client) since openapi-fetch doesn't support streaming responses.

### UI Changes

**VoiceInputOverlay** (`frontend/components/ui/fab/VoiceInputOverlay.tsx`):
- During `isPreviewing` phase, show `message` from SSE events below the reading animation
- The word-highlight animation still plays, but now has real status text underneath
- When `result` event arrives, transition to preview/confirm as today

**TaskGenerationLoading** (`frontend/components/TaskGenerationLoading.tsx`):
- Accept an optional `message` prop
- Display the message below the icon carousel animation
- Falls back to current behavior (no message) for non-streaming callers

**TextDump** (`frontend/app/(logged-in)/(tabs)/(task)/text-dump.tsx`):
- Pass streaming `message` state to `TaskGenerationLoading`
- Switch from `createTasksFromNaturalLanguageAPI` to streaming variant

No new components or screens needed.

## Error Handling

- If the SSE stream disconnects mid-flow, the frontend shows a generic error and the user can retry
- If the LLM call fails, the backend emits an `error` event before closing the stream
- Network timeouts: the frontend sets a reasonable timeout (60s) on the fetch call
- If the `/stream` endpoint is unavailable (e.g., older backend), the frontend falls back to the existing synchronous endpoint

## Testing Strategy

**Backend:**
- Unit test `SSEWriter` — verify correct SSE frame format
- Unit test prompt extraction functions — verify prompts match current flow prompts
- Integration test streaming endpoints — verify event sequence and final result shape matches non-streaming endpoint

**Frontend:**
- Unit test `useSSEStream` hook — mock fetch with streaming response, verify state transitions
- Verify existing preview/confirm flow works unchanged when receiving `result` event

## Scope Boundaries

**In scope:**
- SSE streaming for IntentRouterFlow, MultiTaskFromTextFlowWithContext, QueryTasksFlow, EditTasksFlow
- Status/progress events during flow execution
- Frontend UI updates to show progress messages
- Backward-compatible (existing endpoints unchanged)

**Out of scope:**
- Token-by-token text streaming (structured JSON output makes this impractical)
- Analytics/blueprint flow streaming (infrequent use)
- Chat interface (this is status display, not conversation)
- WebSocket/Socket.IO transport
- Streaming for the preview/confirm endpoints (these are fast, no need)
