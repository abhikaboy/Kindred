package config

type RevenueCat struct {
	WebhookSecret string `env:"WEBHOOK_SECRET" envDefault:""`
}
