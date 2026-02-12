package config

type Posthog struct {
	APIKey   string `env:"API_KEY"`
	Enabled  bool   `env:"ENABLED" envDefault:"true"`
	Endpoint string `env:"ENDPOINT" envDefault:"https://us.i.posthog.com"`
}
