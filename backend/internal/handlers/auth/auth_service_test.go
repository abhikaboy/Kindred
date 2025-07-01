package auth

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestAuthService_GenerateToken(t *testing.T) {
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key",
		},
	}

	service := &Service{
		config: cfg,
	}

	userID := primitive.NewObjectID().Hex()
	exp := time.Now().Add(time.Hour).Unix()

	token, err := service.GenerateToken(userID, exp, 1.0)
	assert.NoError(t, err)
	assert.NotEmpty(t, token)
}

func TestAuthService_GenerateAccessToken(t *testing.T) {
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key",
		},
	}

	service := &Service{
		config: cfg,
	}

	userID := primitive.NewObjectID().Hex()

	token, err := service.GenerateAccessToken(userID, 1.0)
	assert.NoError(t, err)
	assert.NotEmpty(t, token)
}

func TestAuthService_GenerateRefreshToken(t *testing.T) {
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key",
		},
	}

	service := &Service{
		config: cfg,
	}

	userID := primitive.NewObjectID().Hex()

	token, err := service.GenerateRefreshToken(userID, 1.0)
	assert.NoError(t, err)
	assert.NotEmpty(t, token)
}

func TestAuthService_GenerateTokens(t *testing.T) {
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "test-secret-key",
		},
	}

	service := &Service{
		config: cfg,
	}

	userID := primitive.NewObjectID().Hex()

	accessToken, refreshToken, err := service.GenerateTokens(userID, 1.0)
	assert.NoError(t, err)
	assert.NotEmpty(t, accessToken)
	assert.NotEmpty(t, refreshToken)
}

// BenchmarkAuthService_GenerateToken benchmarks token generation
func BenchmarkAuthService_GenerateToken(b *testing.B) {
	cfg := config.Config{
		Auth: config.Auth{
			Secret: "benchmark-secret-key",
		},
	}

	service := &Service{
		config: cfg,
	}

	userID := primitive.NewObjectID().Hex()
	exp := time.Now().Add(time.Hour).Unix()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := service.GenerateToken(userID, exp, 1.0)
		if err != nil {
			b.Fatal(err)
		}
	}
}
