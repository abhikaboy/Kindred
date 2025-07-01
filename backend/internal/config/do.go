package config

type DO struct {
	SpacesURL       string `env:"SPACES_URL"`
	SpacesAccessKey string `env:"SPACES_ACCESS_KEY"`
	SpacesSecretKey string `env:"SPACES_SECRET_KEY"`
	SpacesBucket    string `env:"SPACES_BUCKET" envDefault:"kindred"`
	SpacesRegion    string `env:"SPACES_REGION" envDefault:"nyc3"`
}
