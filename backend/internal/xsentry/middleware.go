package xsentry

import (
	"fmt"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/gofiber/fiber/v2"
)

const (
	sentryHubContextKey = "sentry_hub"
	maxErrorBodyLen     = 500
)

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
			scope.SetContext("request", map[string]interface{}{
				"ip":         c.IP(),
				"user_agent": c.Get("User-Agent"),
				"url":        c.OriginalURL(),
				"method":     c.Method(),
				"route":      c.Route().Path,
			})
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
			}
			scope.SetContext("response", responseCtx)
		})

		return err
	}
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
