package posthog

import (
	"context"
	"log/slog"
	"time"

	"github.com/posthog/posthog-go"
)

func (s *PosthogService) Track(ctx context.Context, event Event) error {
	if s == nil || s.client == nil {
		return nil
	}

	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	props := posthog.NewProperties()

	if event.Category != "" {
		props.Set("category", event.Category)
	}

	for key, value := range event.Properties {
		props.Set(key, value)
	}
	err := (*s.client).Enqueue(posthog.Capture{
		DistinctId: event.UserID,
		Event:      event.EventName,
		Properties: props,
		Timestamp:  event.Timestamp,
	})

	if err != nil {
		slog.Warn("Failed to enqueue PostHog event",
			"event", event.EventName,
			"user_id", event.UserID,
			"error", err)
		return err
	}

	return nil
}

func (s *PosthogService) TrackRequest(ctx context.Context, userID string, props EventProperties) error {
	if s == nil || s.client == nil {
		return nil
	}

	category, eventName := CategorizeEndpoint(props.Method, props.Path)

	properties := map[string]interface{}{
		"method":      props.Method,
		"path":        props.Path,
		"status_code": props.StatusCode,
		"duration_ms": props.Duration.Milliseconds(),
	}

	if props.UserAgent != "" {
		properties["user_agent"] = props.UserAgent
	}
	if props.IP != "" {
		properties["ip"] = props.IP
	}
	if props.ErrorMessage != "" {
		properties["error_message"] = props.ErrorMessage
	}
	if props.Timezone != "" {
		properties["timezone"] = props.Timezone
	}

	event := Event{
		UserID:     userID,
		EventName:  eventName,
		Category:   category,
		Properties: properties,
		Timestamp:  time.Now(),
	}

	return s.Track(ctx, event)
}

func (s *PosthogService) Identify(ctx context.Context, userID string, properties map[string]interface{}) error {
	if s == nil || s.client == nil {
		return nil
	}

	props := posthog.NewProperties()
	for key, value := range properties {
		props.Set(key, value)
	}

	err := (*s.client).Enqueue(posthog.Identify{
		DistinctId: userID,
		Properties: props,
	})

	if err != nil {
		slog.Warn("Failed to identify user in PostHog",
			"user_id", userID,
			"error", err)
		return err
	}

	return nil
}

func (s *PosthogService) Enqueue(ctx context.Context, userID string) error {
	return s.Track(ctx, Event{
		UserID:    userID,
		EventName: "button_clicked",
		Properties: map[string]interface{}{
			"button_name": "signup",
		},
	})
}
