package config

import "github.com/caarlos0/env/v11"

type Config struct {
	App            `envPrefix:"APP_"`
	Atlas          `envPrefix:"ATLAS_"`
	Auth           `envPrefix:"AUTH_"`
	DO             `envPrefix:"DO_"`
	Twillio        `envPrefix:"TWILLIO_"`
	Sinch          `envPrefix:"SINCH_"`
	Unsplash       `envPrefix:"UNSPLASH_"`
	Posthog        `envPrefix:"POSTHOG_"`
	Sentry         `envPrefix:"SENTRY_"`
	GoogleCalendar `envPrefix:"GOOGLE_CALENDAR_"`
	RevenueCat     `envPrefix:"REVENUECAT_"`
}

func Load() (Config, error) {
	return env.ParseAs[Config]()
}
