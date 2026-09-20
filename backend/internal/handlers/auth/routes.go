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
// Routes wires up the auth endpoints. contactNotifier runs the "someone you
// know joined Kindred" fan-out once a phone number is attached to an account;
// it is passed in rather than constructed here because the contacts package
// transitively imports this one. Pass nil to disable the fan-out.
func Routes(api huma.API, collections map[string]*mongo.Collection, contactNotifier ContactNotifier) {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}
	service := NewServiceWithConfig(collections, cfg)
	service.SetContactNotifier(contactNotifier)
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
	return NewServiceWithConfig(collections, cfg)
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
	RegisterLoginWithPhoneOperation(api, handler)
	RegisterRegisterOperation(api, handler)
	RegisterLogoutOperation(api, handler)
	RegisterLoginWithAppleOperation(api, handler)
	RegisterRegisterWithAppleOperation(api, handler)
	RegisterLoginWithGoogleOperation(api, handler)
	RegisterRegisterWithGoogleOperation(api, handler)
	RegisterRefreshTokenOperation(api, handler)
	RegisterTestOperation(api, handler)
	RegisterLoginWithTokenOperation(api, handler)
	RegisterUpdatePushTokenOperation(api, handler)
	RegisterSendOTPOperation(api, handler)
	RegisterVerifyOTPOperation(api, handler)
	RegisterLoginWithOTPOperation(api, handler)
	RegisterLinkPhoneOperation(api, handler)
	RegisterDeleteAccountOperation(api, handler)
	RegisterAcceptTermsOperation(api, handler)
}
