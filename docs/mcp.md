# Kindred MCP server

The backend exposes a remote MCP server at `/v1/mcp` (Streamable HTTP, stateless), so assistants like Claude and Grok can work with a user's Kindred data. Code lives in `backend/internal/handlers/mcpserver/`.

## What it can do

| Tool | Scope | Purpose |
|---|---|---|
| `list_workspaces` | `kindred:read` | Workspaces and their categories |
| `list_categories` | `kindred:read` | Categories, optionally within one workspace |
| `list_tasks` | `kindred:read` | Tasks, filterable by workspace, category, due window, completion |
| `create_workspace` | `kindred:write` | New workspace (optional hex color) |
| `create_category` | `kindred:write` | New category inside an existing workspace |
| `create_task` | `kindred:write` | New task in a category (priority, difficulty, dates, notes, someday). Private unless the user asks to share it |
| `complete_task` | `kindred:complete` | Complete a task exactly as the app does (streak, points, rings) |

Nothing else is exposed: no edits, deletes, social, or settings.

## Auth: personal access tokens

Besides OAuth access tokens (`kdr_at_...`), MCP clients can authenticate with a personal access token (`kdr_...`) rather than the app's JWT, since app refresh tokens are single-use per user. Only a SHA-256 hash is stored, in the `mcp_tokens` collection. Tokens are managed with the app JWT:

```sh
# Mint (the raw token is returned once)
curl -X POST https://<api-host>/v1/user/mcp-tokens \
  -H "Authorization: Bearer <app access token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Claude","scopes":["kindred:read","kindred:write"],"expires_in_days":90}'

# List / revoke
curl https://<api-host>/v1/user/mcp-tokens -H "Authorization: Bearer <app access token>"
curl -X DELETE https://<api-host>/v1/user/mcp-tokens/<id> -H "Authorization: Bearer <app access token>"
```

Up to 10 tokens per user. `scopes` is optional (default: all three) and `expires_in_days` is optional (1 to 365, default: never). Tokens minted before scopes existed have no stored scopes and keep full access. Expired tokens get a 401.

## Scopes

| Scope | Grants |
|---|---|
| `kindred:read` | `list_*` tools |
| `kindred:write` | `create_*` tools |
| `kindred:complete` | `complete_task` |

The server is built per request from the caller's scopes (one cached server per scope combination), so `tools/list` only shows tools the connection may call. Each tool handler checks its scope again before running.

A 401 carries `WWW-Authenticate: Bearer resource_metadata="<issuer>/.well-known/oauth-protected-resource/v1/mcp", scope="kindred:read kindred:write kindred:complete"`, plus `error="invalid_token"` when a token was sent. With OAuth disabled it falls back to `Bearer realm="kindred", error="invalid_token"`.

## Identity and audit

Every request resolves to a principal: kind (`oauth` or `pat`), connection id (OAuth grant id or PAT id), client id and client name.

- Tasks created over MCP get `origin: {kind: "mcp", connection_id, client_id, client_name, at}` on the task document. Completion copies the whole task into `completed-tasks`, so the origin is kept there too.
- Every `create_*` and `complete_task` call, successful or not, writes an `mcp_audit` entry: `user_id`, `connection_id`, `kind`, `client_id`, `client_name`, `tool`, `target_ids`, a short `summary` (for example `Created task "Buy milk" in Groceries`), `ok`, `error`, `created_at`. Reads are not audited.
- `GET /v1/user/mcp-activity?connection_id=<id>&limit=<n>` (app JWT) returns the caller's own entries, newest first, as `[{id, tool, summary, ok, target_id?, created_at}]`. `connection_id` is optional; `limit` defaults to 20, max 100.

## Limits

- 120 MCP requests per minute per connection; more get HTTP 429 with `Retry-After`. This counter is in memory and per instance, so N replicas allow up to N times that.
- Per connection, over a rolling 24 hours: 200 successful `create_*` calls and 100 successful `complete_task` calls. Past that the tool returns an error telling the assistant to send the user to the app. These caps are counted from `mcp_audit`, so they hold across instances.
- The server instructions tell the assistant to complete a task only when the user explicitly says it is done, and to keep new tasks private unless asked to share.

## OAuth

MCP clients that support the MCP authorization spec (2025-11-25) can connect without a pasted token. Kindred runs its own OAuth 2.1 authorization server in `backend/internal/handlers/oauth/`; the user approves the connection in the Kindred app, since most accounts have no password to type into a web page.

### Discovery

With `MCP_OAUTH_ISSUER=https://kindredtodo.com/api` the resource is `https://kindredtodo.com/api/v1/mcp`.

1. An unauthenticated request to `/v1/mcp` gets `401` with `WWW-Authenticate: Bearer resource_metadata="https://kindredtodo.com/api/.well-known/oauth-protected-resource/v1/mcp"`.
2. Protected resource metadata (RFC 9728) names the issuer as the authorization server. Served at `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/v1/mcp`, and `/.well-known/oauth-protected-resource/api/v1/mcp`.
3. Authorization server metadata (RFC 8414) is served at `/.well-known/oauth-authorization-server`, `/.well-known/oauth-authorization-server/api`, and the same JSON at `/.well-known/openid-configuration` (plus `/api` suffix). It advertises `client_id_metadata_document_supported`, S256 PKCE only, `token_endpoint_auth_methods_supported: ["none"]` and RFC 9207 `iss`. No OIDC features (no `id_token`, no `jwks_uri`).

Scopes: `kindred:read`, `kindred:write`, `kindred:complete`. An empty `scope` means all three; `offline_access` is ignored because refresh tokens are always issued.

### Client registration

- **Client ID Metadata Documents (primary).** The `client_id` is an https URL whose JSON document Kindred fetches. Fetches are https only, IP-literal hosts are refused, and the dialer blocks loopback, private, link-local, CGNAT and unspecified addresses after DNS resolution (so rebinding is covered). No redirects, 5s timeout, 16KB cap, `application/json` only. The document's `client_id` must equal the URL, `redirect_uris` must be https or http loopback, and `token_endpoint_auth_method` must be absent or `none`. Results are cached in memory for 5 minutes to 24 hours, following `Cache-Control: max-age`.
- **Verified apps.** A client is shown as Verified when its `client_id` host is, or is a subdomain of, a host in `MCP_OAUTH_VERIFIED_CLIENT_HOSTS`. Others are labelled "Unverified app".
- **Dynamic Client Registration (fallback).** `POST /oauth/register` (RFC 7591), public clients only, 20 per IP per hour. Issues `kdr_client_...` ids stored in `oauth_clients`; these are never Verified.
- Redirect URIs match exactly, except loopback redirects match on any port (RFC 8252).

### Approval flow

1. `GET /oauth/authorize` validates the client and `redirect_uri` first (failures show an error page and never redirect), then `response_type=code`, S256 PKCE, `resource` (RFC 8707, defaults to the MCP URL) and scopes. Other errors redirect back with `error`, `state` and `iss`.
2. Kindred stores a pending request (10 minutes) and renders a page with the client name and host, the permissions, a QR code for `kindred://oauth/approve?request=<id>`, an Open Kindred button on touch devices, and an 8-character code (`XXXX-XXXX`) to enter under Settings. An HttpOnly, SameSite=Lax cookie binds the request to that browser.
3. The app approves through the JWT API below. The page polls `/oauth/authorize/status` every 2 seconds, then navigates to `/oauth/authorize/complete`, which checks the cookie, is single use, and redirects with `code`, `state` and `iss`. Denied or expired requests redirect with `error=access_denied`. Cancel goes through `/oauth/authorize/cancel`.

App API (JWT, tag `oauth`):

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/user/oauth/requests/{id}` | 404 unknown, 410 expired |
| GET | `/v1/user/oauth/requests/by-code/{code}` | Case-insensitive, dash optional. 10 lookups per user per 10 minutes (429) |
| POST | `/v1/user/oauth/requests/{id}/approve` | Body `{scopes}`: non-empty subset of the requested scopes. 409 if already decided, 410 if expired |
| POST | `/v1/user/oauth/requests/{id}/deny` | Same status codes as approve |
| GET | `/v1/user/oauth/grants` | Connected apps |
| DELETE | `/v1/user/oauth/grants/{id}` | Revokes the grant and every token and code under it |

Approving creates or updates one grant per user and client; the latest approval sets its scopes, and existing tokens are limited to the grant's current scopes.

### Tokens

`POST /oauth/token` (form-encoded, public clients; `client_id` in the form or as Basic auth with an empty secret, 120 per IP per minute):

- Access tokens: `kdr_at_` plus 32 random bytes, stored only as SHA-256, 1 hour, bound to the resource (audience), grant, client and scopes.
- Refresh tokens: `kdr_rt_...`, rotated on every use, idle-expire after 30 days. Presenting a rotated refresh token revokes the whole grant. `scope` may only narrow.
- Authorization codes: 60 seconds, single use, bound to client, redirect URI, PKCE challenge, resource and scopes. Reusing a code revokes the grant's tokens.
- `POST /oauth/revoke` (RFC 7009) always returns 200. Revoking a refresh token also drops the access tokens issued from the same authorization.

Collections: `oauth_clients`, `oauth_requests`, `oauth_codes`, `oauth_tokens`, `oauth_grants` (TTL indexes clean up requests, codes and tokens). Run `cmd/db/create_collections` and `cmd/db/apply_indexes` before enabling.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `MCP_OAUTH_ISSUER` | `http://localhost:$APP_PORT` outside production; unset in production disables OAuth | Public base URL of the backend, e.g. `https://kindredtodo.com/api` |
| `MCP_OAUTH_VERIFIED_CLIENT_HOSTS` | `claude.ai,claude.com,anthropic.com,x.ai,grok.com,chatgpt.com,openai.com` | Hosts whose CIMD clients show as Verified |
| `MCP_OAUTH_ALLOW_DCR` | `true` | Enables `/oauth/register` |

Production is detected with `APP_ENV=production`. Malformed values fall back to defaults rather than failing startup.

### nginx

Clients look for metadata at the origin root with the issuer path appended (`https://kindredtodo.com/.well-known/oauth-authorization-server/api`). Those paths sit outside `/api`, so add these to the kindredtodo.com server block. They proxy without stripping, and the backend serves the `/api`-suffixed paths directly:

```nginx
location ^~ /.well-known/oauth-authorization-server/api {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location ^~ /.well-known/openid-configuration/api {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
}

location ^~ /.well-known/oauth-protected-resource/api/ {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
}
```

Without them, a client that gets the SPA's HTML at the root well-known path may fail discovery instead of falling back to `https://kindredtodo.com/api/.well-known/openid-configuration`.

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
- Deploying requires applying indexes (`cmd/db/apply_indexes`) for `mcp_tokens`, `mcp_audit` and the `oauth_*` collections.
