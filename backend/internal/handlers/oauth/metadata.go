package oauth

import (
	"github.com/gofiber/fiber/v2"
	"github.com/modelcontextprotocol/go-sdk/oauthex"
)

// authServerMetadata is RFC 8414 metadata. Hand-rolled so no OIDC fields (jwks_uri) are emitted.
type authServerMetadata struct {
	Issuer                                     string   `json:"issuer"`
	AuthorizationEndpoint                      string   `json:"authorization_endpoint"`
	TokenEndpoint                              string   `json:"token_endpoint"`
	RevocationEndpoint                         string   `json:"revocation_endpoint"`
	RegistrationEndpoint                       string   `json:"registration_endpoint,omitempty"`
	ScopesSupported                            []string `json:"scopes_supported"`
	ResponseTypesSupported                     []string `json:"response_types_supported"`
	ResponseModesSupported                     []string `json:"response_modes_supported"`
	GrantTypesSupported                        []string `json:"grant_types_supported"`
	CodeChallengeMethodsSupported              []string `json:"code_challenge_methods_supported"`
	TokenEndpointAuthMethodsSupported          []string `json:"token_endpoint_auth_methods_supported"`
	RevocationEndpointAuthMethodsSupported     []string `json:"revocation_endpoint_auth_methods_supported"`
	ClientIDMetadataDocumentSupported          bool     `json:"client_id_metadata_document_supported"`
	AuthorizationResponseIssParameterSupported bool     `json:"authorization_response_iss_parameter_supported"`
}

func (s *Service) authServerMetadata() authServerMetadata {
	m := authServerMetadata{
		Issuer:                                     s.issuer,
		AuthorizationEndpoint:                      s.endpoint("/oauth/authorize"),
		TokenEndpoint:                              s.endpoint("/oauth/token"),
		RevocationEndpoint:                         s.endpoint("/oauth/revoke"),
		ScopesSupported:                            AllScopes(),
		ResponseTypesSupported:                     []string{"code"},
		ResponseModesSupported:                     []string{"query"},
		GrantTypesSupported:                        []string{"authorization_code", "refresh_token"},
		CodeChallengeMethodsSupported:              []string{"S256"},
		TokenEndpointAuthMethodsSupported:          []string{"none"},
		RevocationEndpointAuthMethodsSupported:     []string{"none"},
		ClientIDMetadataDocumentSupported:          true,
		AuthorizationResponseIssParameterSupported: true,
	}
	if s.allowDCR {
		m.RegistrationEndpoint = s.endpoint("/oauth/register")
	}
	return m
}

func (s *Service) protectedResourceMetadata() oauthex.ProtectedResourceMetadata {
	return oauthex.ProtectedResourceMetadata{
		Resource:               s.ResourceURL(),
		AuthorizationServers:   []string{s.issuer},
		ScopesSupported:        AllScopes(),
		BearerMethodsSupported: []string{"header"},
		ResourceName:           "Kindred",
	}
}

func metadataHeaders(c *fiber.Ctx) {
	c.Set("Cache-Control", "public, max-age=300")
	c.Set("Access-Control-Allow-Origin", "*")
}

func (s *Service) handleAuthServerMetadata(c *fiber.Ctx) error {
	metadataHeaders(c)
	return c.JSON(s.authServerMetadata())
}

func (s *Service) handleResourceMetadata(c *fiber.Ctx) error {
	metadataHeaders(c)
	return c.JSON(s.protectedResourceMetadata())
}
