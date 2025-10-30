package xcontext

import (
	"context"
	"time"
)

// DefaultTimeout is the default timeout for database operations
const DefaultTimeout = 30 * time.Second

// WithTimeout creates a context with a timeout for database operations
// This helps prevent long-running queries from hanging indefinitely
func WithTimeout(parent context.Context) (context.Context, context.CancelFunc) {
	if parent == nil {
		parent = context.Background()
	}
	return context.WithTimeout(parent, DefaultTimeout)
}

// WithCustomTimeout creates a context with a custom timeout
func WithCustomTimeout(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if parent == nil {
		parent = context.Background()
	}
	return context.WithTimeout(parent, timeout)
}
