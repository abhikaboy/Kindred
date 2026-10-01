package mcpserver

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	mcpauth "github.com/modelcontextprotocol/go-sdk/auth"
)

// limits caps what one agent connection can do. Daily caps are counted from mcp_audit, over a rolling 24h.
type limits struct {
	requestsPerMinute int
	dailyCreates      int
	dailyCompletes    int
}

var defaultLimits = limits{requestsPerMinute: 120, dailyCreates: 200, dailyCompletes: 100}

const limiterPruneSize = 10000

// requestLimiter is a fixed-window, in-memory counter keyed by connection. It is per process.
type requestLimiter struct {
	mu      sync.Mutex
	entries map[string]*requestWindow
	max     int
	window  time.Duration
	now     func() time.Time
}

type requestWindow struct {
	count int
	start time.Time
}

func newRequestLimiter(max int, window time.Duration) *requestLimiter {
	return &requestLimiter{entries: map[string]*requestWindow{}, max: max, window: window, now: time.Now}
}

// Allow records a request for key, returning false and the wait when over the limit.
func (rl *requestLimiter) Allow(key string) (bool, time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := rl.now()
	if len(rl.entries) >= limiterPruneSize {
		for k, e := range rl.entries {
			if now.Sub(e.start) > rl.window {
				delete(rl.entries, k)
			}
		}
	}
	e, ok := rl.entries[key]
	if !ok || now.Sub(e.start) > rl.window {
		if rl.max <= 0 {
			return false, rl.window
		}
		rl.entries[key] = &requestWindow{count: 1, start: now}
		return true, 0
	}
	if e.count >= rl.max {
		return false, e.start.Add(rl.window).Sub(now)
	}
	e.count++
	return true, 0
}

// withRateLimit rejects authenticated requests over the per-connection budget with 429.
func withRateLimit(rl *requestLimiter, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := principalFromInfo(mcpauth.TokenInfoFromContext(r.Context()))
		if p != nil {
			key := p.ConnectionID.Hex()
			if p.ConnectionID.IsZero() {
				key = "user:" + p.UserID.Hex()
			}
			if ok, wait := rl.Allow(key); !ok {
				w.Header().Set("Retry-After", strconv.Itoa(max(1, int(wait.Round(time.Second).Seconds()))))
				http.Error(w, "rate limit exceeded: too many requests from this connection, try again shortly", http.StatusTooManyRequests)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
