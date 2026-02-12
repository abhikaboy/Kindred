package posthog

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/posthog/posthog-go"
)

var (
	instance *PosthogService
	once     sync.Once
	mu       sync.RWMutex
	enabled  bool
)

func Init(ctx context.Context, apiKey string, endpoint string, isEnabled bool) error {
	var initErr error

	once.Do(func() {
		enabled = isEnabled

		if !enabled {
			slog.Info("PostHog analytics disabled")
			return
		}

		if apiKey == "" {
			initErr = fmt.Errorf("PostHog API key is required when enabled")
			slog.Warn("PostHog initialization skipped", "reason", "missing API key")
			enabled = false
			return
		}

		client, err := posthog.NewWithConfig(apiKey, posthog.Config{
			Endpoint: endpoint,
		})
		if err != nil {
			initErr = fmt.Errorf("failed to create PostHog client: %w", err)
			slog.Error("Failed to initialize PostHog", "error", err)
			enabled = false
			return
		}

		instance = &PosthogService{
			client: &client,
		}

		slog.Info("PostHog analytics initialized successfully",
			"endpoint", endpoint,
			"enabled", enabled)
	})

	return initErr
}

func GetClient() *PosthogService {
	mu.RLock()
	defer mu.RUnlock()
	return instance
}

func IsEnabled() bool {
	mu.RLock()
	defer mu.RUnlock()
	return enabled && instance != nil
}

func Close() error {
	mu.Lock()
	defer mu.Unlock()

	if instance == nil || !enabled {
		return nil
	}

	if instance.client != nil {
		if err := (*instance.client).Close(); err != nil {
			slog.Error("Failed to close PostHog client", "error", err)
			return fmt.Errorf("failed to close PostHog client: %w", err)
		}
		slog.Info("PostHog client closed successfully")
	}

	return nil
}
