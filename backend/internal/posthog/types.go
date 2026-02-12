package posthog

import (
	"time"

	"github.com/posthog/posthog-go"
)

type PosthogService struct {
	client *posthog.Client
}

type Event struct {
	UserID     string
	EventName  string
	Category   string
	Properties map[string]interface{}
	Timestamp  time.Time
}

type EventProperties struct {
	Method       string
	Path         string
	StatusCode   int
	Duration     time.Duration
	UserAgent    string
	IP           string
	ErrorMessage string
	Timezone     string
}
