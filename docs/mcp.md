# Kindred MCP server

The backend exposes a remote MCP server at `/v1/mcp` (Streamable HTTP, stateless), so assistants like Claude and Grok can work with a user's Kindred data. Code lives in `backend/internal/handlers/mcpserver/`.

## What it can do

| Tool | Purpose |
|---|---|
| `list_workspaces` | Workspaces and their categories |
| `list_categories` | Categories, optionally within one workspace |
| `list_tasks` | Tasks, filterable by workspace, category, due window, completion |
| `create_workspace` | New workspace (optional hex color) |
| `create_category` | New category inside an existing workspace |
| `create_task` | New task in a category (priority, difficulty, dates, notes, someday) |
| `complete_task` | Complete a task exactly as the app does (streak, points, rings) |

Nothing else is exposed: no edits, deletes, social, or settings.

## Auth: personal access tokens

MCP clients authenticate with a long-lived token (`kdr_...`) rather than the app's JWT, since app refresh tokens are single-use per user. Only a SHA-256 hash is stored, in the `mcp_tokens` collection. Tokens are managed with the app JWT:

```sh
# Mint (the raw token is returned once)
curl -X POST https://<api-host>/v1/user/mcp-tokens \
  -H "Authorization: Bearer <app access token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Claude"}'

# List / revoke
curl https://<api-host>/v1/user/mcp-tokens -H "Authorization: Bearer <app access token>"
curl -X DELETE https://<api-host>/v1/user/mcp-tokens/<id> -H "Authorization: Bearer <app access token>"
```

Up to 10 tokens per user.

## Connecting

Claude Code:

```sh
claude mcp add --transport http kindred https://<api-host>/v1/mcp \
  --header "Authorization: Bearer kdr_..."
```

Grok (xAI API): add a remote MCP tool pointing at `https://<api-host>/v1/mcp` with the `Authorization: Bearer kdr_...` credential.

Any other client that supports remote MCP servers with a bearer header works the same way.

## Known gaps

- Tasks created or completed over MCP are not pushed to Google Calendar (the task handler used here is built without the calendar push service).
- Completing a task does not create a post.
- Recurring tasks, reminders, checklists and tags are not exposed.
- Deploying requires applying indexes (`cmd/db/apply_indexes`) for `mcp_tokens`.
