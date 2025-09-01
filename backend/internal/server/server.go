package server

import (
	"context"
	"fmt"

	activity "github.com/abhikaboy/Kindred/internal/handlers/activity"
	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	Blueprint "github.com/abhikaboy/Kindred/internal/handlers/blueprint"
	category "github.com/abhikaboy/Kindred/internal/handlers/category"
	congratulation "github.com/abhikaboy/Kindred/internal/handlers/congratulation"
	connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	encouragement "github.com/abhikaboy/Kindred/internal/handlers/encouragement"
	group "github.com/abhikaboy/Kindred/internal/handlers/group"
	"github.com/abhikaboy/Kindred/internal/handlers/health"
	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	post "github.com/abhikaboy/Kindred/internal/handlers/post"
	profile "github.com/abhikaboy/Kindred/internal/handlers/profile"
	spaces "github.com/abhikaboy/Kindred/internal/handlers/spaces"
	task "github.com/abhikaboy/Kindred/internal/handlers/task"
	Waitlist "github.com/abhikaboy/Kindred/internal/handlers/waitlist"
	"github.com/abhikaboy/Kindred/internal/xlog"

	"log/slog"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humafiber"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"go.mongodb.org/mongo-driver/mongo"
)

func New(collections map[string]*mongo.Collection, stream *mongo.ChangeStream) (huma.API, *fiber.App) {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			slog.Error("🚨 FIBER ERROR:", "error", err.Error(), "path", c.Path())
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		},
	})

	// Add global request logging middleware FIRST
	app.Use(func(c *fiber.Ctx) error {
		xlog.RequestLog(c.Method(), c.Path())
		return c.Next()
	})

	// Add Fiber middleware
	app.Use(logger.New())
	app.Use(recover.New())
	app.Use(compress.New())

	// Add CORS middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000", // Specific origins for development
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type,Authorization,refresh_token,X-Requested-With,Accept,Origin,Cache-Control,X-File-Name",
		ExposeHeaders:    "Authorization,refresh_token,access_token",
		AllowCredentials: true,
		MaxAge:           86400, // 24 hours
	}))

	// Create auth middleware for protected routes
	authMW := auth.FiberAuthMiddlewareForServer(collections)

	xlog.ServerLog("Creating Fiber auth middleware and applying to /v1/user routes")

	// Apply auth middleware only to protected routes (user-specific endpoints)
	app.Use("/v1/user", func(c *fiber.Ctx) error {
		xlog.AuthLog(fmt.Sprintf("Request in protected /v1/user route: %s %s",
			c.Method(), c.Path()))

		// Apply the Fiber auth middleware
		return authMW(c)
	})

	// Create Huma API with Fiber adapter
	config := huma.DefaultConfig("Kindred API", "1.0.0")
	config.Info.Description = "Kindred API built with Huma v2 and Fiber"
	api := humafiber.New(app, config)

	xlog.ServerLog("Huma API created with Fiber adapter, registering routes...")

	// Register welcome route
	RegisterWelcomeRoute(api)

	// Create presigner
	presigner := spaces.NewPresigner()

	// Register converted routes
	health.Routes(api, collections)
	auth.Routes(api, collections)
	category.Routes(api, collections)
	activity.Routes(api, collections)
	profile.Routes(api, collections)
	task.Routes(api, collections)
	connection.Routes(api, collections)
	group.RegisterRoutes(api, collections)
	post.Routes(api, collections)
	spaces.Routes(api, presigner, collections)

	// Register waitlist and blueprint routes
	Waitlist.Routes(api, collections)
	Blueprint.Routes(api, collections)

	// Register encouragement and congratulation routes
	encouragement.Routes(api, collections)
	congratulation.Routes(api, collections)

	// Register notification routes
	notifications.Routes(api, collections)

	// TODO: Convert remaining routes to Huma
	// socket.Routes(api, collections, stream)

	task.Cron(collections)

	xlog.ServerLog("All routes registered, Fiber app ready")

	return api, app
}

// WelcomeInput represents the input for the welcome endpoint
type WelcomeInput struct{}

// WelcomeOutput represents the output for the welcome endpoint
type WelcomeOutput struct {
	Body struct {
		Message string `json:"message" example:"Welcome to Kindred!"`
	}
}

// RegisterWelcomeRoute registers the welcome route
func RegisterWelcomeRoute(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-welcome",
		Method:      "GET",
		Path:        "/welcome",
		Summary:     "Welcome endpoint",
		Description: "Returns a welcome message",
		Tags:        []string{"general"},
	}, func(ctx context.Context, input *WelcomeInput) (*WelcomeOutput, error) {
		resp := &WelcomeOutput{}
		resp.Body.Message = "Welcome to [NAME]!"
		return resp, nil
	})
}
