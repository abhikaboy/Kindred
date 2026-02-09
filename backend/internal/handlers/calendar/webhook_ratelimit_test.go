package calendar

import (
	"testing"
	"time"
)

func TestWebhookRateLimiter_Allow(t *testing.T) {
	limiter := NewWebhookRateLimiter(5, 1) // 5 requests per second

	connectionID := "test-connection-123"

	// First 5 requests should be allowed
	for i := 0; i < 5; i++ {
		if !limiter.Allow(connectionID) {
			t.Errorf("Request %d should be allowed", i+1)
		}
	}

	// 6th request should be blocked
	if limiter.Allow(connectionID) {
		t.Error("6th request should be blocked")
	}

	// Wait for window to expire
	time.Sleep(1100 * time.Millisecond)

	// Should be allowed again after window reset
	if !limiter.Allow(connectionID) {
		t.Error("Request should be allowed after window reset")
	}
}

func TestWebhookRateLimiter_MultipleKeys(t *testing.T) {
	limiter := NewWebhookRateLimiter(3, 1) // 3 requests per second

	connection1 := "connection-1"
	connection2 := "connection-2"

	// Each connection should have its own limit
	for i := 0; i < 3; i++ {
		if !limiter.Allow(connection1) {
			t.Errorf("Connection 1 request %d should be allowed", i+1)
		}
		if !limiter.Allow(connection2) {
			t.Errorf("Connection 2 request %d should be allowed", i+1)
		}
	}

	// Both should be blocked now
	if limiter.Allow(connection1) {
		t.Error("Connection 1 should be blocked")
	}
	if limiter.Allow(connection2) {
		t.Error("Connection 2 should be blocked")
	}
}

func TestWebhookRateLimiter_GetStats(t *testing.T) {
	limiter := NewWebhookRateLimiter(10, 60)

	connectionID := "test-connection"

	// No stats initially
	count, _, exists := limiter.GetStats(connectionID)
	if exists {
		t.Error("Stats should not exist for new connection")
	}

	// Make some requests
	for i := 0; i < 3; i++ {
		limiter.Allow(connectionID)
	}

	// Check stats
	count, windowStart, exists := limiter.GetStats(connectionID)
	if !exists {
		t.Error("Stats should exist after requests")
	}
	if count != 3 {
		t.Errorf("Expected count 3, got %d", count)
	}
	if time.Since(windowStart) > time.Second {
		t.Error("Window start should be recent")
	}
}

func TestWebhookRateLimiter_WindowReset(t *testing.T) {
	limiter := NewWebhookRateLimiter(2, 1) // 2 requests per second

	connectionID := "test-connection"

	// Use up the limit
	limiter.Allow(connectionID)
	limiter.Allow(connectionID)

	// Should be blocked
	if limiter.Allow(connectionID) {
		t.Error("Should be blocked")
	}

	// Wait for window to reset
	time.Sleep(1100 * time.Millisecond)

	// Should be allowed again
	if !limiter.Allow(connectionID) {
		t.Error("Should be allowed after window reset")
	}

	// Check that counter was reset
	count, _, _ := limiter.GetStats(connectionID)
	if count != 1 {
		t.Errorf("Expected count 1 after reset, got %d", count)
	}
}

func TestWebhookRateLimiter_HighVolume(t *testing.T) {
	limiter := NewWebhookRateLimiter(100, 60) // 100 requests per minute

	connectionID := "high-volume-connection"

	// Should allow 100 requests
	allowed := 0
	for i := 0; i < 150; i++ {
		if limiter.Allow(connectionID) {
			allowed++
		}
	}

	if allowed != 100 {
		t.Errorf("Expected 100 allowed requests, got %d", allowed)
	}
}

func TestWebhookRateLimiter_ConcurrentAccess(t *testing.T) {
	limiter := NewWebhookRateLimiter(50, 1)

	connectionID := "concurrent-connection"

	// Simulate concurrent requests
	done := make(chan bool, 100)
	allowed := make(chan bool, 100)

	for i := 0; i < 100; i++ {
		go func() {
			if limiter.Allow(connectionID) {
				allowed <- true
			} else {
				allowed <- false
			}
			done <- true
		}()
	}

	// Wait for all goroutines to complete
	for i := 0; i < 100; i++ {
		<-done
	}
	close(allowed)

	// Count allowed requests
	allowedCount := 0
	for a := range allowed {
		if a {
			allowedCount++
		}
	}

	// Should allow exactly 50 requests
	if allowedCount != 50 {
		t.Errorf("Expected 50 allowed requests, got %d", allowedCount)
	}
}

func TestWebhookRateLimiter_ZeroLimit(t *testing.T) {
	limiter := NewWebhookRateLimiter(0, 1) // 0 requests allowed

	connectionID := "zero-limit-connection"

	// Should block all requests
	if limiter.Allow(connectionID) {
		t.Error("Should block all requests with zero limit")
	}
}

func TestWebhookRateLimiter_LargeWindow(t *testing.T) {
	limiter := NewWebhookRateLimiter(5, 3600) // 5 requests per hour

	connectionID := "large-window-connection"

	// Use up the limit
	for i := 0; i < 5; i++ {
		if !limiter.Allow(connectionID) {
			t.Errorf("Request %d should be allowed", i+1)
		}
	}

	// Should be blocked
	if limiter.Allow(connectionID) {
		t.Error("Should be blocked after limit reached")
	}

	// Even after a short wait, should still be blocked (window is 1 hour)
	time.Sleep(100 * time.Millisecond)
	if limiter.Allow(connectionID) {
		t.Error("Should still be blocked within the same window")
	}
}
