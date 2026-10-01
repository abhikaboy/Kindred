package config

import (
	"strconv"
	"strings"
)

const defaultVerifiedClientHosts = "claude.ai,claude.com,anthropic.com,x.ai,grok.com,chatgpt.com,openai.com"

// MCPOAuth configures the OAuth authorization server in front of /v1/mcp.
// Every field is optional; malformed values fall back to defaults instead of failing startup.
type MCPOAuth struct {
	Issuer              string `env:"MCP_OAUTH_ISSUER" envDefault:""`
	VerifiedClientHosts string `env:"MCP_OAUTH_VERIFIED_CLIENT_HOSTS" envDefault:""`
	AllowDCR            string `env:"MCP_OAUTH_ALLOW_DCR" envDefault:"true"`
	AppEnv              string `env:"APP_ENV" envDefault:""`
}

// ResolvedIssuer returns the configured issuer, or a localhost default outside production.
func (m MCPOAuth) ResolvedIssuer(port string) string {
	issuer := strings.TrimRight(strings.TrimSpace(m.Issuer), "/")
	if issuer != "" {
		return issuer
	}
	if strings.EqualFold(strings.TrimSpace(m.AppEnv), "production") {
		return ""
	}
	if port == "" {
		port = "8080"
	}
	return "http://localhost:" + port
}

func (m MCPOAuth) VerifiedHosts() []string {
	raw := m.VerifiedClientHosts
	if strings.TrimSpace(raw) == "" {
		raw = defaultVerifiedClientHosts
	}
	var hosts []string
	for _, h := range strings.Split(raw, ",") {
		if h = strings.ToLower(strings.TrimSpace(h)); h != "" {
			hosts = append(hosts, h)
		}
	}
	return hosts
}

func (m MCPOAuth) DCRAllowed() bool {
	v, err := strconv.ParseBool(strings.TrimSpace(m.AllowDCR))
	if err != nil {
		return true
	}
	return v
}
