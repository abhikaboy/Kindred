package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const googleTokenInfoURL = "https://oauth2.googleapis.com/tokeninfo"

// GoogleTokenClaims holds the verified claims from a Google ID token.
type GoogleTokenClaims struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Aud           string `json:"aud"`
	Iss           string `json:"iss"`
	Exp           string `json:"exp"`
}

// VerifyGoogleIDToken verifies a Google ID token using Google's tokeninfo endpoint
// and returns the claims. allowedClientIDs is a comma-separated list of valid client IDs.
func VerifyGoogleIDToken(idToken string, allowedClientIDs string) (*GoogleTokenClaims, error) {
	if idToken == "" {
		return nil, fmt.Errorf("id_token is required for Google authentication")
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(fmt.Sprintf("%s?id_token=%s", googleTokenInfoURL, idToken))
	if err != nil {
		return nil, fmt.Errorf("failed to verify Google ID token: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read Google response: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Google token verification failed: %s", string(body))
	}

	var claims GoogleTokenClaims
	if err := json.Unmarshal(body, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse Google token claims: %w", err)
	}

	// Validate issuer
	if claims.Iss != "accounts.google.com" && claims.Iss != "https://accounts.google.com" {
		return nil, fmt.Errorf("invalid Google token issuer: %s", claims.Iss)
	}

	// Validate audience (client ID)
	if allowedClientIDs != "" {
		allowed := false
		for _, clientID := range strings.Split(allowedClientIDs, ",") {
			if strings.TrimSpace(clientID) == claims.Aud {
				allowed = true
				break
			}
		}
		if !allowed {
			return nil, fmt.Errorf("Google token audience %q not in allowed list", claims.Aud)
		}
	}

	if claims.Sub == "" {
		return nil, fmt.Errorf("Google token missing sub claim")
	}

	return &claims, nil
}
