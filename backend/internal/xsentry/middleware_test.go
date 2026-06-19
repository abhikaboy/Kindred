package xsentry

import (
	"context"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/gofiber/fiber/v2"
)

// mockTransport records every event the Sentry client would have sent.
type mockTransport struct {
	mu     sync.Mutex
	events []*sentry.Event
}

func (t *mockTransport) Configure(sentry.ClientOptions) {}
func (t *mockTransport) SendEvent(e *sentry.Event) {
	t.mu.Lock()
	t.events = append(t.events, e)
	t.mu.Unlock()
}
func (t *mockTransport) Flush(time.Duration) bool              { return true }
func (t *mockTransport) FlushWithContext(context.Context) bool { return true }
func (t *mockTransport) Close()                                {}
func (t *mockTransport) captured() []*sentry.Event             { t.mu.Lock(); defer t.mu.Unlock(); return t.events }

// bindMockTransport wires a mock client onto the current hub for the duration of
// the test and returns the recorder. The middleware clones CurrentHub, so this
// is the seam the captured events flow through.
func bindMockTransport(t *testing.T) *mockTransport {
	t.Helper()
	transport := &mockTransport{}
	client, err := sentry.NewClient(sentry.ClientOptions{
		Dsn:        "https://test@test.ingest.sentry.io/1",
		Transport:  transport,
		SampleRate: 1.0,
	})
	if err != nil {
		t.Fatalf("new sentry client: %v", err)
	}
	prev := sentry.CurrentHub().Client()
	sentry.CurrentHub().BindClient(client)
	t.Cleanup(func() { sentry.CurrentHub().BindClient(prev) })
	return transport
}

func TestFiberMiddleware_CapturesByStatus(t *testing.T) {
	cases := []struct {
		name      string
		path      string
		status    int
		wantEvent bool
		wantLevel sentry.Level
	}{
		{"success is quiet", "/ok", fiber.StatusOK, false, ""},
		{"not found is quiet", "/missing", fiber.StatusNotFound, false, ""},
		{"unauthorized is quiet", "/unauth", fiber.StatusUnauthorized, false, ""},
		{"bad request warns", "/bad", fiber.StatusBadRequest, true, sentry.LevelWarning},
		{"validation warns", "/invalid", fiber.StatusUnprocessableEntity, true, sentry.LevelWarning},
		{"internal error reports", "/boom", fiber.StatusInternalServerError, true, sentry.LevelError},
		{"bad gateway reports", "/gateway", fiber.StatusBadGateway, true, sentry.LevelError},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			transport := bindMockTransport(t)

			app := fiber.New()
			app.Use(FiberMiddleware())
			status := tc.status
			app.Get(tc.path, func(c *fiber.Ctx) error { return c.SendStatus(status) })

			resp, err := app.Test(httptest.NewRequest("GET", tc.path, nil))
			if err != nil {
				t.Fatalf("request: %v", err)
			}
			if resp.StatusCode != tc.status {
				t.Fatalf("status = %d, want %d", resp.StatusCode, tc.status)
			}

			events := transport.captured()
			if !tc.wantEvent {
				if len(events) != 0 {
					t.Fatalf("expected no event for %d, got %d", tc.status, len(events))
				}
				return
			}
			if len(events) != 1 {
				t.Fatalf("expected exactly 1 event for %d, got %d", tc.status, len(events))
			}
			if got := events[0].Level; got != tc.wantLevel {
				t.Errorf("level = %q, want %q", got, tc.wantLevel)
			}
		})
	}
}
