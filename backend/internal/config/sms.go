package config

// SMSGuard bounds how many verification texts we will pay for. Every send costs
// money, so these limits fail closed: when unsure, we refuse to send.
type SMSGuard struct {
	// Country calling codes we will text, comma separated, without "+".
	AllowedCountryCodes []string `env:"ALLOWED_COUNTRY_CODES" envSeparator:"," envDefault:"1"`
	// Hard ceiling on texts sent across all users per UTC day.
	DailyCap int `env:"DAILY_CAP" envDefault:"300"`
	// Per phone number.
	PhoneCooldownSeconds int `env:"PHONE_COOLDOWN_SECONDS" envDefault:"30"`
	PhonePerHour         int `env:"PHONE_PER_HOUR" envDefault:"5"`
	PhonePerDay          int `env:"PHONE_PER_DAY" envDefault:"10"`
	// Per client IP.
	IPPerHour int `env:"IP_PER_HOUR" envDefault:"10"`
	IPPerDay  int `env:"IP_PER_DAY" envDefault:"30"`
	// Code guesses per phone number in a 15 minute window.
	VerifyAttemptsPerWindow int `env:"VERIFY_ATTEMPTS" envDefault:"10"`
}
