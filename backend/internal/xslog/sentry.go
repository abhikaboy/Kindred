package xslog

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/getsentry/sentry-go"
)

// SentryHandler wraps another slog.Handler and forwards ERROR-level (and above)
// log records to Sentry as events. This means every slog.Error(...) call in the
// codebase automatically becomes a Sentry event without requiring explicit
// sentry.CaptureException calls at each call-site.
type SentryHandler struct {
	inner slog.Handler
	attrs []slog.Attr
	group string
}

// NewSentryHandler creates a handler that delegates to inner for all output
// and additionally reports ERROR+ records to Sentry.
func NewSentryHandler(inner slog.Handler) *SentryHandler {
	return &SentryHandler{inner: inner}
}

func (h *SentryHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.inner.Enabled(ctx, level)
}

func (h *SentryHandler) Handle(ctx context.Context, r slog.Record) error {
	// Always delegate to the inner handler first (console output).
	err := h.inner.Handle(ctx, r)

	// Only forward ERROR and above to Sentry.
	if r.Level >= slog.LevelError {
		h.reportToSentry(r)
	}

	return err
}

func (h *SentryHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &SentryHandler{
		inner: h.inner.WithAttrs(attrs),
		attrs: append(h.attrs, attrs...),
		group: h.group,
	}
}

func (h *SentryHandler) WithGroup(name string) slog.Handler {
	return &SentryHandler{
		inner: h.inner.WithGroup(name),
		attrs: h.attrs,
		group: name,
	}
}

func (h *SentryHandler) reportToSentry(r slog.Record) {
	hub := sentry.CurrentHub()
	if hub.Client() == nil {
		return
	}

	var sentryErr error
	extra := make(map[string]interface{})

	// Collect attributes; extract the first "error" value as the Sentry exception.
	collectAttrs := func(a slog.Attr) bool {
		if a.Key == "error" {
			if sentryErr == nil {
				sentryErr = fmt.Errorf("%s", a.Value.String())
			}
		}
		extra[a.Key] = a.Value.Any()
		return true
	}

	for _, a := range h.attrs {
		collectAttrs(a)
	}
	r.Attrs(collectAttrs)

	if sentryErr == nil {
		sentryErr = fmt.Errorf("%s", r.Message)
	}

	hub.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(sentryLevelFromSlog(r.Level))
		scope.SetTag("logger", "slog")
		if h.group != "" {
			scope.SetTag("slog.group", h.group)
		}
		for k, v := range extra {
			scope.SetExtra(k, v)
		}
		hub.CaptureException(sentryErr)
	})
}

func sentryLevelFromSlog(l slog.Level) sentry.Level {
	switch {
	case l >= slog.LevelError:
		return sentry.LevelError
	case l >= slog.LevelWarn:
		return sentry.LevelWarning
	default:
		return sentry.LevelInfo
	}
}
