package config

import "strings"

type DO struct {
	SpacesURL       string `env:"SPACES_URL"`
	SpacesAccessKey string `env:"SPACES_ACCESS_KEY"`
	SpacesSecretKey string `env:"SPACES_SECRET_KEY"`
	SpacesBucket    string `env:"SPACES_BUCKET" envDefault:"kindred"`
	SpacesRegion    string `env:"SPACES_REGION" envDefault:"nyc3"`
}

// GetCDNURL automatically generates the CDN URL from the SpacesURL
func (d *DO) GetCDNURL() string {
	if d.SpacesURL == "" {
		return ""
	}

	// If it's already a CDN URL, return as-is
	if strings.Contains(d.SpacesURL, ".cdn.") {
		return d.SpacesURL
	}

	// Convert digitaloceanspaces.com to cdn.digitaloceanspaces.com
	if strings.Contains(d.SpacesURL, ".digitaloceanspaces.com") {
		return strings.Replace(d.SpacesURL, ".digitaloceanspaces.com", ".cdn.digitaloceanspaces.com", 1)
	}

	// If it's a custom domain (like cdn.kindredtodo.com), return as-is
	return d.SpacesURL
}
