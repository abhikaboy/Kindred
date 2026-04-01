package xslog

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"
)

func TestSentryHandler_DelegatesToInner(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	handler := NewSentryHandler(inner)
	logger := slog.New(handler)

	logger.Info("hello")
	if !strings.Contains(buf.String(), "hello") {
		t.Errorf("inner handler should have received the log record, got: %s", buf.String())
	}
}

func TestSentryHandler_Enabled_DelegatesToInner(t *testing.T) {
	inner := slog.NewTextHandler(nil, &slog.HandlerOptions{Level: slog.LevelWarn})
	handler := NewSentryHandler(inner)

	if handler.Enabled(context.Background(), slog.LevelInfo) {
		t.Error("should not be enabled for INFO when inner threshold is WARN")
	}
	if !handler.Enabled(context.Background(), slog.LevelError) {
		t.Error("should be enabled for ERROR when inner threshold is WARN")
	}
}

func TestSentryHandler_WithAttrs_PreservesChain(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	handler := NewSentryHandler(inner)
	child := handler.WithAttrs([]slog.Attr{slog.String("service", "test")})

	logger := slog.New(child)
	logger.Info("with attrs")

	if !strings.Contains(buf.String(), "service=test") {
		t.Errorf("child handler should include attrs, got: %s", buf.String())
	}
}

func TestSentryHandler_WithGroup_PreservesChain(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	handler := NewSentryHandler(inner)
	child := handler.WithGroup("mygroup")

	logger := slog.New(child)
	logger.Info("grouped", "key", "val")

	if !strings.Contains(buf.String(), "mygroup.key=val") {
		t.Errorf("child handler should use group prefix, got: %s", buf.String())
	}
}

func TestSentryHandler_ErrorWithoutSentryClient_DoesNotPanic(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	handler := NewSentryHandler(inner)
	logger := slog.New(handler)

	// Sentry is not initialized in tests, so hub.Client() is nil.
	// This should not panic.
	logger.Error("something broke", "error", "bad thing")

	if !strings.Contains(buf.String(), "something broke") {
		t.Errorf("inner handler should still receive the record, got: %s", buf.String())
	}
}
