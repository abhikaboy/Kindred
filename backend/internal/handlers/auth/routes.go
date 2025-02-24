package auth

import (
	"log"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/mongo"
)

/*
Router maps endpoints to handlers
*/
func Routes(app *fiber.App, collections map[string]*mongo.Collection) {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}
	service := newService(collections, cfg)
	AuthHandler := Handler{service, cfg}

	route := app.Group("/api/v1/auth")

	route.Post("/login", AuthHandler.Login)
	route.Post("/register", AuthHandler.Register)
	route.Post("/logout", AuthHandler.Logout)

	route.Post("/login/apple", AuthHandler.LoginWithApple)
	route.Post("/register/apple", AuthHandler.RegisterWithApple)

	api := app.Group("/api/v1/user")
	api.Use(AuthHandler.AuthenticateMiddleware)
	api.Get("/", AuthHandler.Test)
}
