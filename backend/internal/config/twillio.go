package config

type Twillio struct {
	AccountSid string `env:"TWILLIO_ACCOUNT_SID" envDefault:""`
	AuthToken  string `env:"TWILLIO_AUTH_TOKEN" envDefault:""`
	FromNumber string `env:"TWILLIO_FROM_NUMBER" envDefault:""`

	SG_Token string `env:"SG_TOKEN" envDefault:""`
}
