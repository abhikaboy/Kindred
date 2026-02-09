package config

type GoogleCalendar struct {
	ClientID     string `env:"CLIENT_ID,required"`
	ClientSecret string `env:"CLIENT_SECRET,required"`
	RedirectURL  string `env:"REDIRECT_URL" envDefault:"http://localhost:8080/v1/calendar/oauth2/callback"`
}
