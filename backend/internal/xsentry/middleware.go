package xsentry

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/gofiber/fiber/v2"
)

const (
	sentryHubContextKey = "sentry_hub"
	maxErrorBodyLen     = 500
)

// sensitiveKeys: a request-body field whose (lowercased) name contains any of
// these is masked before reaching Sentry. "token" covers idToken / id_token /
// refresh_token / access_token / push_token.
var sensitiveKeys = []string{"password", "token", "secret"}

// FiberMiddleware returns Fiber middleware that creates a request-scoped
// Sentry hub with rich context. Place it after panic recovery, before auth.
//
// Every slog.Error(ctx, ...) or sentry.GetHubFromContext(ctx).CaptureException()
// during the request will automatically include the endpoint, user, and
// request metadata set here.
func FiberMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		hub := sentry.CurrentHub().Clone()
		if hub.Client() == nil {
			return c.Next()
		}

		startTime := time.Now()

		// Set request context on the scope immediately (before handler runs)
		hub.ConfigureScope(func(scope *sentry.Scope) {
			scope.SetTag("http.method", c.Method())
			scope.SetTag("http.route", c.Route().Path)
			scope.SetContext("request", requestContext(c))
		})

		// Store hub in Go context so SentryHandler and handlers can use it
		ctx := sentry.SetHubOnContext(c.UserContext(), hub)
		c.SetUserContext(ctx)

		// Also store in Fiber locals for the error handler / panic recovery
		c.Locals(sentryHubContextKey, hub)

		// Run the rest of the middleware chain + handler
		err := c.Next()

		// --- Post-handler enrichment ---
		duration := time.Since(startTime)
		statusCode := c.Response().StatusCode()

		hub.ConfigureScope(func(scope *sentry.Scope) {
			scope.SetTag("http.status_code", fmt.Sprintf("%d", statusCode))

			// Enrich with user info if auth middleware set it
			if userID, ok := c.Locals("user_id").(string); ok && userID != "" {
				scope.SetUser(sentry.User{ID: userID})
			}
			if timezone, ok := c.Locals("timezone").(string); ok && timezone != "" {
				scope.SetTag("user.timezone", timezone)
			}

			// Response context with duration and error body
			responseCtx := map[string]interface{}{
				"status_code": statusCode,
				"duration_ms": duration.Milliseconds(),
			}
			if statusCode >= 400 {
				body := string(c.Response().Body())
				if len(body) > maxErrorBodyLen {
					body = body[:maxErrorBodyLen] + "..."
				}
				responseCtx["body"] = body

				// Attach the request body (redacted) so we can see exactly what
				// the client sent — the other half of a failed request.
				reqCtx := requestContext(c)
				if rb := redactBody(c.Body()); rb != "" {
					reqCtx["body"] = rb
				}
				scope.SetContext("request", reqCtx)
			}
			scope.SetContext("response", responseCtx)
		})

		// Huma writes 5xx, validation failures (422), and handler 400s straight to
		// the response — they never reach Fiber's ErrorHandler, and only reach
		// Sentry if the handler also happened to slog.Error. Capturing here
		// guarantees every internal error is recorded with full request context
		// (route, user, body). The message groups per status+endpoint, so 5xx that a
		// handler also logged stay low-cardinality rather than flooding.
		switch {
		case shouldReportServerError(statusCode):
			hub.WithScope(func(scope *sentry.Scope) {
				scope.SetLevel(sentry.LevelError)
				hub.CaptureMessage(fmt.Sprintf("HTTP %d: %s %s", statusCode, c.Method(), c.Route().Path))
			})
		case shouldReportClientError(statusCode):
			hub.WithScope(func(scope *sentry.Scope) {
				scope.SetLevel(sentry.LevelWarning)
				hub.CaptureMessage(fmt.Sprintf("HTTP %d: %s %s", statusCode, c.Method(), c.Route().Path))
			})
		}

		return err
	}
}

// shouldReportServerError reports every 5xx — these are always unexpected and
// worth a Sentry event regardless of whether the handler logged the error.
func shouldReportServerError(status int) bool {
	return status >= fiber.StatusInternalServerError
}

// shouldReportClientError picks the client errors that signal a frontend/backend
// contract mismatch worth investigating — bad request and validation failures.
// Auth (401), forbidden (403), not-found (404) and friends are expected client
// conditions and stay quiet to keep the signal high.
func shouldReportClientError(status int) bool {
	return status == fiber.StatusBadRequest || status == fiber.StatusUnprocessableEntity
}

// requestContext is the request metadata attached to every event's "request" card.
func requestContext(c *fiber.Ctx) map[string]interface{} {
	return map[string]interface{}{
		"ip":         c.IP(),
		"user_agent": c.Get("User-Agent"),
		"url":        c.OriginalURL(),
		"method":     c.Method(),
		"route":      c.Route().Path,
	}
}

// redactBody parses a JSON object, masks sensitive fields, and re-marshals.
// Non-JSON / non-object bodies return "" so raw credentials or file uploads
// never reach Sentry. Redaction is shallow — deepen if nested secrets appear.
func redactBody(raw []byte) string {
	var m map[string]any
	if json.Unmarshal(raw, &m) != nil {
		return ""
	}
	for k := range m {
		lk := strings.ToLower(k)
		for _, s := range sensitiveKeys {
			if strings.Contains(lk, s) {
				m[k] = "[redacted]"
				break
			}
		}
	}
	out, err := json.Marshal(m)
	if err != nil {
		return ""
	}
	body := string(out)
	if len(body) > maxErrorBodyLen {
		body = body[:maxErrorBodyLen] + "..."
	}
	return body
}

// GetHub retrieves the request-scoped Sentry hub from Fiber locals.
// Use this in Fiber error handlers or panic recovery where you have
// the Fiber context but not the Go context.
func GetHub(c *fiber.Ctx) *sentry.Hub {
	if hub, ok := c.Locals(sentryHubContextKey).(*sentry.Hub); ok {
		return hub
	}
	return sentry.CurrentHub()
}
