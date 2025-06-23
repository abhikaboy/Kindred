package auth

import (
	"log"
	"net/http"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Routes(api huma.API, collections map[string]*mongo.Collection) {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}
	service := newService(collections, cfg)
	authHandler := Handler{service, cfg}

	RegisterAuthOperations(api, &authHandler)
}

/*
NewServiceForServer creates an auth service for the server
*/
func NewServiceForServer(collections map[string]*mongo.Collection) *Service {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}
	return newService(collections, cfg)
}

/*
AuthMiddlewareForServer creates auth middleware for the server
*/
func AuthMiddlewareForServer(collections map[string]*mongo.Collection) func(http.Handler) http.Handler {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}
	return AuthMiddleware(collections, cfg)
}

// RegisterAuthOperations registers all auth operations with Huma
func RegisterAuthOperations(api huma.API, handler *Handler) {
	RegisterLoginOperation(api, handler)
	RegisterRegisterOperation(api, handler)
	RegisterLogoutOperation(api, handler)
	RegisterLoginWithAppleOperation(api, handler)
	RegisterRegisterWithAppleOperation(api, handler)
	RegisterTestOperation(api, handler)
	RegisterLoginWithTokenOperation(api, handler)
	RegisterUpdatePushTokenOperation(api, handler)
}
