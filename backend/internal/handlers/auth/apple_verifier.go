package auth

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const appleJWKSURL = "https://appleid.apple.com/auth/keys"

// AppleTokenClaims holds the verified claims from an Apple identity token.
type AppleTokenClaims struct {
	Sub   string // Apple user ID
	Email string
	Aud   string // Must match our bundle ID
	Iss   string // Must be "https://appleid.apple.com"
}

// appleJWKSCache caches Apple's public keys to avoid fetching on every request.
var (
	appleJWKSCache     map[string]*rsa.PublicKey
	appleJWKSCacheMu   sync.RWMutex
	appleJWKSCacheTime time.Time
	appleJWKSCacheTTL  = 24 * time.Hour
)

// AppleJWK represents a single key in Apple's JWKS response.
type AppleJWK struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
}

// AppleJWKS represents Apple's JWKS response.
type AppleJWKS struct {
	Keys []AppleJWK `json:"keys"`
}

func fetchAppleJWKS() (map[string]*rsa.PublicKey, error) {
	appleJWKSCacheMu.RLock()
	if appleJWKSCache != nil && time.Since(appleJWKSCacheTime) < appleJWKSCacheTTL {
		cached := appleJWKSCache
		appleJWKSCacheMu.RUnlock()
		return cached, nil
	}
	appleJWKSCacheMu.RUnlock()

	appleJWKSCacheMu.Lock()
	defer appleJWKSCacheMu.Unlock()

	// Double-check after acquiring write lock
	if appleJWKSCache != nil && time.Since(appleJWKSCacheTime) < appleJWKSCacheTTL {
		return appleJWKSCache, nil
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(appleJWKSURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Apple JWKS: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read Apple JWKS response: %w", err)
	}

	var jwks AppleJWKS
	if err := json.Unmarshal(body, &jwks); err != nil {
		return nil, fmt.Errorf("failed to parse Apple JWKS: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey)
	for _, k := range jwks.Keys {
		if k.Kty != "RSA" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		n := new(big.Int).SetBytes(nBytes)
		e := int(new(big.Int).SetBytes(eBytes).Int64())
		keys[k.Kid] = &rsa.PublicKey{N: n, E: e}
	}

	appleJWKSCache = keys
	appleJWKSCacheTime = time.Now()
	return keys, nil
}

// VerifyAppleIDToken verifies an Apple identity token and returns the claims.
// allowedAudiences are the accepted `aud` values — native bundle ID and/or the
// web/desktop Services ID. Empty entries are ignored; if none are set, the audience
// check is skipped.
func VerifyAppleIDToken(idToken string, allowedAudiences ...string) (*AppleTokenClaims, error) {
	if idToken == "" {
		return nil, fmt.Errorf("id_token is required for Apple authentication")
	}

	keys, err := fetchAppleJWKS()
	if err != nil {
		return nil, err
	}

	token, err := jwt.Parse(idToken, func(token *jwt.Token) (interface{}, error) {
		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("Apple token missing kid header")
		}
		key, ok := keys[kid]
		if !ok {
			return nil, fmt.Errorf("Apple token kid %q not found in JWKS", kid)
		}
		return key, nil
	})
	if err != nil {
		return nil, fmt.Errorf("Apple token verification failed: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("Apple token claims invalid")
	}

	iss, _ := claims["iss"].(string)
	if iss != "https://appleid.apple.com" {
		return nil, fmt.Errorf("invalid Apple token issuer: %s", iss)
	}

	aud, _ := claims["aud"].(string)
	if !isAllowedAudience(aud, allowedAudiences) {
		return nil, fmt.Errorf("Apple token audience %q does not match any allowed audience %v", aud, allowedAudiences)
	}

	sub, _ := claims["sub"].(string)
	if sub == "" {
		return nil, fmt.Errorf("Apple token missing sub claim")
	}

	email, _ := claims["email"].(string)

	return &AppleTokenClaims{
		Sub:   sub,
		Email: email,
		Aud:   aud,
		Iss:   iss,
	}, nil
}

// isAllowedAudience reports whether aud matches one of the configured audiences.
// Empty entries are ignored; if no audiences are configured the check is skipped (true).
func isAllowedAudience(aud string, allowed []string) bool {
	configured := false
	for _, a := range allowed {
		if a == "" {
			continue
		}
		configured = true
		if aud == a {
			return true
		}
	}
	return !configured
}
