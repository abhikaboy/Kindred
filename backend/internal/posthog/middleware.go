package posthog

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/gofiber/fiber/v2"
)

func FiberMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !IsEnabled() {
			return c.Next()
		}

		startTime := time.Now()
		err := c.Next()

		go func() {
			duration := time.Since(startTime)

			userID := "anonymous"
			if id, ok := auth.GetUserIDFromFiberContext(c); ok && id != "" {
				userID = id
			}

			timezone := ""
			if tz, ok := auth.GetTimezoneFromFiberContext(c); ok {
				timezone = tz
			}

			props := EventProperties{
				Method:     c.Method(),
				Path:       c.Path(),
				StatusCode: c.Response().StatusCode(),
				Duration:   duration,
				UserAgent:  c.Get("User-Agent"),
				IP:         c.IP(),
				Timezone:   timezone,
			}

			if props.StatusCode >= 400 {
				props.ErrorMessage = string(c.Response().Body())
				if len(props.ErrorMessage) > 500 {
					props.ErrorMessage = props.ErrorMessage[:500] + "..."
				}
			}

			client := GetClient()
			if client != nil {
				if err := client.TrackRequest(context.Background(), userID, props); err != nil {
					slog.Warn("PostHog tracking failed",
						"path", props.Path,
						"error", err)
				}
			}
		}()

		return err
	}
}

func HumaMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !IsEnabled() {
				next.ServeHTTP(w, r)
				return
			}

			startTime := time.Now()

			wrapped := &responseWriter{
				ResponseWriter: w,
				statusCode:     200,
			}

			next.ServeHTTP(wrapped, r)

			go func() {
				duration := time.Since(startTime)

				userID := "anonymous"
				if id, ok := auth.GetUserIDFromContext(r.Context()); ok && id != "" {
					userID = id
				}

				timezone := ""
				if tz, ok := auth.GetTimezoneFromContext(r.Context()); ok {
					timezone = tz
				}

				props := EventProperties{
					Method:     r.Method,
					Path:       r.URL.Path,
					StatusCode: wrapped.statusCode,
					Duration:   duration,
					UserAgent:  r.Header.Get("User-Agent"),
					IP:         getIP(r),
					Timezone:   timezone,
				}

				client := GetClient()
				if client != nil {
					if err := client.TrackRequest(context.Background(), userID, props); err != nil {
						slog.Warn("PostHog tracking failed",
							"path", props.Path,
							"error", err)
					}
				}
			}()
		})
	}
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func getIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}

	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	return r.RemoteAddr
}
