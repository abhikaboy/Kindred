package auth

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/golang-jwt/jwt/v5"
)

// BenchmarkTokenGeneration benchmarks the JWT token generation
func BenchmarkTokenGeneration(b *testing.B) {
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key-for-benchmarking",
		},
	}

	service := &Service{
		config: cfg,
	}

	userID := "user123"
	count := float64(0)
	exp := time.Now().Add(time.Hour).Unix()

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := service.GenerateToken(userID, exp, count)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkTokenValidation benchmarks JWT token validation
func BenchmarkTokenValidation(b *testing.B) {
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key-for-benchmarking",
		},
	}

	service := &Service{
		config: cfg,
	}

	// Generate a token to validate
	userID := "user123"
	count := float64(0)
	exp := time.Now().Add(time.Hour).Unix()

	token, err := service.GenerateToken(userID, exp, count)
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.Auth.Secret), nil
		})
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkAccessTokenGeneration benchmarks access token generation specifically
func BenchmarkAccessTokenGeneration(b *testing.B) {
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key-for-benchmarking",
		},
	}

	service := &Service{
		config: cfg,
	}

	userID := "user123"
	count := float64(0)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := service.GenerateAccessToken(userID, count)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkRefreshTokenGeneration benchmarks refresh token generation specifically
func BenchmarkRefreshTokenGeneration(b *testing.B) {
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key-for-benchmarking",
		},
	}

	service := &Service{
		config: cfg,
	}

	userID := "user123"
	count := float64(0)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := service.GenerateRefreshToken(userID, count)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBothTokensGeneration benchmarks generating both access and refresh tokens
func BenchmarkBothTokensGeneration(b *testing.B) {
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key-for-benchmarking",
		},
	}

	service := &Service{
		config: cfg,
	}

	userID := "user123"
	count := float64(0)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _, err := service.GenerateTokens(userID, count)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkHeaderStructureCreation benchmarks creating output structures with headers
func BenchmarkHeaderStructureCreation(b *testing.B) {
	userID := "user123"

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		output := &LoginOutput{
			AccessToken:  "access-token-" + userID,
			RefreshToken: "refresh-token-" + userID,
			Body: SafeUser{
				DisplayName: "Test User",
				Handle:      "@testuser",
			},
		}
		// Use the tokens to prevent optimization
		_ = output.AccessToken + output.RefreshToken
	}
}
