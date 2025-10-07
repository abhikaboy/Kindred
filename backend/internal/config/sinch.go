package config

type Sinch struct {
	ApplicationKey    string `env:"APPLICATION_KEY" envDefault:""`
	ApplicationSecret string `env:"APPLICATION_SECRET" envDefault:""`
}
