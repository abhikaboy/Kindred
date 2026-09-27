package auth

import (
	"sync"
	"time"
)

// guestRateLimiter is a fixed-window, in-memory counter keyed by client IP.
//
// It is per process, so running several replicas multiplies the effective
// limit. That is acceptable for its purpose: stopping a single script from
// minting guest accounts in a tight loop.
type guestRateLimiter struct {
	mu      sync.Mutex
	entries map[string]*guestRateEntry
	max     int
	window  time.Duration
	now     func() time.Time
}

type guestRateEntry struct {
	count       int
	windowStart time.Time
}

// guestLimiterPruneSize is how large the map may grow before expired entries
// are swept inline. Sweeping on write avoids a background goroutine per
// limiter, which matters because tests construct many handlers.
const guestLimiterPruneSize = 10000

func newGuestRateLimiter(max int, window time.Duration) *guestRateLimiter {
	return &guestRateLimiter{
		entries: make(map[string]*guestRateEntry),
		max:     max,
		window:  window,
		now:     time.Now,
	}
}

// Allow records an attempt for key and reports whether it is within the limit.
func (rl *guestRateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := rl.now()
	if len(rl.entries) >= guestLimiterPruneSize {
		for k, e := range rl.entries {
			if now.Sub(e.windowStart) > rl.window {
				delete(rl.entries, k)
			}
		}
	}

	entry, ok := rl.entries[key]
	if !ok || now.Sub(entry.windowStart) > rl.window {
		if rl.max <= 0 {
			return false
		}
		rl.entries[key] = &guestRateEntry{count: 1, windowStart: now}
		return true
	}

	if entry.count >= rl.max {
		return false
	}
	entry.count++
	return true
}
