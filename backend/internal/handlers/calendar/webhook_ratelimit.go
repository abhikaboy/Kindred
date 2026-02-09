package calendar

import (
	"sync"
	"time"
)

// WebhookRateLimiter provides rate limiting for webhook endpoints
type WebhookRateLimiter struct {
	mu            sync.RWMutex
	requests      map[string]*rateLimitEntry
	maxRequests   int
	windowSeconds int
}

type rateLimitEntry struct {
	count       int
	windowStart time.Time
}

// NewWebhookRateLimiter creates a new rate limiter
// maxRequests: maximum number of requests allowed per window
// windowSeconds: time window in seconds
func NewWebhookRateLimiter(maxRequests int, windowSeconds int) *WebhookRateLimiter {
	limiter := &WebhookRateLimiter{
		requests:      make(map[string]*rateLimitEntry),
		maxRequests:   maxRequests,
		windowSeconds: windowSeconds,
	}

	// Start cleanup goroutine to remove old entries
	go limiter.cleanup()

	return limiter
}

// Allow checks if a request should be allowed for the given key (e.g., connection_id)
// Returns true if allowed, false if rate limit exceeded
func (rl *WebhookRateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	entry, exists := rl.requests[key]

	if !exists {
		// First request for this key
		// Check if max requests is 0 (no requests allowed)
		if rl.maxRequests <= 0 {
			return false
		}
		rl.requests[key] = &rateLimitEntry{
			count:       1,
			windowStart: now,
		}
		return true
	}

	// Check if we're still in the same window
	windowDuration := time.Duration(rl.windowSeconds) * time.Second
	if now.Sub(entry.windowStart) > windowDuration {
		// New window, reset counter
		entry.count = 1
		entry.windowStart = now
		return true
	}

	// Same window, check if we've exceeded the limit
	if entry.count >= rl.maxRequests {
		return false
	}

	// Increment counter
	entry.count++
	return true
}

// cleanup removes old entries to prevent memory leaks
func (rl *WebhookRateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		windowDuration := time.Duration(rl.windowSeconds) * time.Second

		for key, entry := range rl.requests {
			if now.Sub(entry.windowStart) > windowDuration*2 {
				delete(rl.requests, key)
			}
		}
		rl.mu.Unlock()
	}
}

// GetStats returns current rate limit statistics for a key
func (rl *WebhookRateLimiter) GetStats(key string) (count int, windowStart time.Time, exists bool) {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	entry, exists := rl.requests[key]
	if !exists {
		return 0, time.Time{}, false
	}

	return entry.count, entry.windowStart, true
}
