package oauth

import (
	"log/slog"

	"github.com/danielgtaylor/huma/v2"
	"github.com/gofiber/fiber/v2"
)

// Routes mounts the OAuth endpoints. The app-facing Huma API is always registered so the
// OpenAPI spec is stable; the public Fiber routes exist only when an issuer is configured.
func Routes(app *fiber.App, api huma.API, s *Service) {
	registerAppOperations(api, s)
	if !s.Enabled() {
		slog.Info("mcp oauth disabled: set MCP_OAUTH_ISSUER to enable")
		return
	}

	prm := []string{"/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/v1/mcp"}
	asm := []string{"/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"}
	if s.issuerPath != "" {
		prm = append(prm, "/.well-known/oauth-protected-resource"+s.issuerPath+"/v1/mcp")
		asm = append(asm, "/.well-known/oauth-authorization-server"+s.issuerPath, "/.well-known/openid-configuration"+s.issuerPath)
	}
	for _, p := range prm {
		app.Get(p, s.handleResourceMetadata)
	}
	for _, p := range asm {
		app.Get(p, s.handleAuthServerMetadata)
	}

	app.Get("/oauth/authorize", s.handleAuthorize)
	app.Get("/oauth/authorize/status", s.handleAuthorizeStatus)
	app.Get("/oauth/authorize/complete", s.handleAuthorizeComplete)
	app.Get("/oauth/authorize/cancel", s.handleAuthorizeCancel)
	app.Post("/oauth/token", s.handleToken)
	app.Post("/oauth/revoke", s.handleRevoke)
	if s.allowDCR {
		app.Post("/oauth/register", s.handleRegister)
	}
}
