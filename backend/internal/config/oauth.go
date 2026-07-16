package config

type OAuth struct {
	GoogleClientIDs string `env:"GOOGLE_CLIENT_IDS" envDefault:""` // Comma-separated list of allowed Google client IDs
	AppleBundleID   string `env:"APPLE_BUNDLE_ID" envDefault:""`   // Native app audience (iOS bundle ID)
	AppleServiceID  string `env:"APPLE_SERVICE_ID" envDefault:""`  // Web/desktop audience (Sign in with Apple Services ID)
}
