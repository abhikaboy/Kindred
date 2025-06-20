package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/server"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
)

func TestIndexRoute(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name          string
		desc          string
		route         string
		expectedError bool
		expectedCode  int
		expectedBody  string
	}{
		{
			name:          "index",
			desc:          "test index route",
			route:         "/",
			expectedError: false,
			expectedCode:  200,
			expectedBody:  `{"message":"Welcome to [NAME]!"}`,
		},
	}

	_, httpServer := setup(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			req, err := http.NewRequest(
				http.MethodGet,
				tt.route,
				nil,
			)
			assert.NoErrorf(t, err, tt.desc)

			// Create a response recorder to record the response
			rr := httptest.NewRecorder()
			httpServer.Handler.ServeHTTP(rr, req)

			if !tt.expectedError {
				assert.NoErrorf(t, err, tt.desc)
			}

			// As expected errors lead to broken responses, the next test case needs to be processed.
			if tt.expectedError {
				return
			}

			assert.Equalf(t, tt.expectedCode, rr.Code, tt.desc)

			body := rr.Body.String()
			assert.Equalf(t, tt.expectedBody, body, tt.desc)
		})
	}
}

func setup(t *testing.T) (*http.Server, *http.Server) {
	t.Helper()
	if err := godotenv.Load(filepath.Join("..", "..", ".env")); err != nil {
		t.Fatal("Failed to load .env")
	}
	cfg := config.Atlas{
		User:        "test",
		Pass:        "Kindred-test-pw",
		Cluster:     "Development",
		Environment: "Test",
	}
	db, err := xmongo.New(context.Background(), cfg)
	if err != nil {
		t.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	_, httpServer := server.New(db.Collections, db.Stream)
	return httpServer, httpServer
}
