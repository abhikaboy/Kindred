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

func Init(ctx context.Context, apiKey string) error {
	var initErr error

	once.Do(func() {
		if apiKey == "" {
			slog.Info("PostHog analytics disabled - no API key provided")
			enabled = false
			return
		}

		enabled = true

		client, err := posthog.NewWithConfig(apiKey, posthog.Config{
			Endpoint: "https://us.i.posthog.com",
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

		slog.Info("PostHog analytics initialized successfully")
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
