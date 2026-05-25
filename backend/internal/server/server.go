package server

import (
	"context"
	"fmt"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/gemini"
	activity "github.com/abhikaboy/Kindred/internal/handlers/activity"
	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	Blueprint "github.com/abhikaboy/Kindred/internal/handlers/blueprint"
	"github.com/abhikaboy/Kindred/internal/handlers/calendar"
	category "github.com/abhikaboy/Kindred/internal/handlers/category"
	congratulation "github.com/abhikaboy/Kindred/internal/handlers/congratulation"
	connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	encouragement "github.com/abhikaboy/Kindred/internal/handlers/encouragement"
	group "github.com/abhikaboy/Kindred/internal/handlers/group"
	"github.com/abhikaboy/Kindred/internal/handlers/health"
	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	post "github.com/abhikaboy/Kindred/internal/handlers/post"
	profile "github.com/abhikaboy/Kindred/internal/handlers/profile"
	referral "github.com/abhikaboy/Kindred/internal/handlers/referral"
	report "github.com/abhikaboy/Kindred/internal/handlers/report"
	"github.com/abhikaboy/Kindred/internal/handlers/rewards"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/abhikaboy/Kindred/internal/handlers/settings"
	spaces "github.com/abhikaboy/Kindred/internal/handlers/spaces"
	"github.com/abhikaboy/Kindred/internal/handlers/subscription"
	task "github.com/abhikaboy/Kindred/internal/handlers/task"
	Waitlist "github.com/abhikaboy/Kindred/internal/handlers/waitlist"
	"github.com/abhikaboy/Kindred/internal/jobs"
	"github.com/abhikaboy/Kindred/internal/posthog"
	"github.com/abhikaboy/Kindred/internal/xlog"
	"github.com/abhikaboy/Kindred/internal/xsentry"

	"log/slog"
	"runtime/debug"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humafiber"
	"github.com/getsentry/sentry-go"
	"github.com/gofiber/contrib/otelfiber/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"go.mongodb.org/mongo-driver/mongo"
)

func New(collections map[string]*mongo.Collection, stream *mongo.ChangeStream, geminiService *gemini.GeminiService, cfg config.Config) (huma.API, *fiber.App) {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			slog.Error("FIBER ERROR", "error", err.Error(), "method", c.Method(), "path", c.Path())

			// Use request-scoped hub from xsentry middleware (already has context)
			hub := xsentry.GetHub(c)
			hub.CaptureException(fmt.Errorf("fiber error on %s %s: %w", c.Method(), c.Path(), err))

			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		},
	})

	// OTel tracing middleware — must be first to capture full request lifecycle
	app.Use(otelfiber.Middleware())

	// Add Fiber middleware (logs method, path, status, latency)
	app.Use(logger.New())
	app.Use(recover.New(recover.Config{
		EnableStackTrace: true,
		StackTraceHandler: func(c *fiber.Ctx, e interface{}) {
			stack := string(debug.Stack())
			slog.Error("PANIC RECOVERED",
				"panic", fmt.Sprintf("%v", e),
				"method", c.Method(),
				"path", c.Path(),
				"stack", stack,
			)

			// Use request-scoped hub — it already has request context
			hub := xsentry.GetHub(c)
			hub.WithScope(func(scope *sentry.Scope) {
				scope.SetContext("panic", map[string]interface{}{"stack": stack})
				scope.SetLevel(sentry.LevelFatal)
				hub.RecoverWithContext(c.Context(), e)
			})
		},
	}))

	// Add Sentry request context middleware (after recovery, before auth)
	app.Use(xsentry.FiberMiddleware())

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

	// Add PostHog analytics middleware (after auth, so we can capture user IDs)
	app.Use(posthog.FiberMiddleware())

	// Create Huma API with Fiber adapter
	config := huma.DefaultConfig("Kindred API", "1.0.0")
	config.Info.Description = "Kindred API built with Huma v2 and Fiber"
	api := humafiber.New(app, config)

	xlog.ServerLog("Huma API created with Fiber adapter, registering routes...")

	// Register welcome route
	RegisterWelcomeRoute(api)

	// Create presigner and S3 client
	presigner, s3Client := spaces.NewPresigner()

	// Create ring service (shared across handlers for fire-and-forget increments)
	ringService := rings.NewRingServiceFromCollections(collections)

	// Register converted routes
	health.Routes(api, collections)
	auth.Routes(api, collections)
	category.Routes(api, collections)
	activity.Routes(api, collections)
	profile.Routes(api, collections, ringService)
	task.Routes(api, collections, geminiService, ringService)

	// SSE streaming routes for NLP flows (raw Fiber, bypass Huma)
	taskStreamHandler := task.NewStreamHandler(collections, geminiService, ringService)
	app.Post("/api/v1/user/tasks/natural-language/intent/stream", taskStreamHandler.StreamIntentNaturalLanguage)
	app.Post("/api/v1/user/tasks/natural-language/stream", taskStreamHandler.StreamCreateNaturalLanguage)
	app.Post("/api/v1/user/tasks/natural-language/query/stream", taskStreamHandler.StreamQueryNaturalLanguage)
	app.Post("/api/v1/user/tasks/natural-language/edit/stream", taskStreamHandler.StreamEditNaturalLanguage)

	connection.Routes(api, collections)
	group.RegisterRoutes(api, collections)
	post.Routes(api, collections, ringService)
	spaces.Routes(api, presigner, s3Client, collections)

	// Register waitlist and blueprint routes
	Waitlist.Routes(api, collections)
	Blueprint.Routes(api, collections, geminiService)

	// Register encouragement and congratulation routes
	encouragement.Routes(api, collections, ringService)
	congratulation.Routes(api, collections, ringService)

	// Register ring routes
	rings.Routes(api, collections, ringService)

	// Register notification routes
	notifications.Routes(api, collections)

	// Register referral routes
	referral.Routes(api, collections)

	// Register rewards routes
	rewards.Routes(api, collections)

	// Register settings routes
	settings.Router(api, collections)

	// Register report routes
	report.Routes(api, collections)

	// Register calendar routes
	calendar.Routes(api, collections, cfg)

	// Register subscription webhook routes
	subscription.Routes(api, collections, cfg)

	// TODO: Convert remaining routes to Huma
	// socket.Routes(api, collections, stream)

	cronScheduler := task.Cron(collections)

	// Wire up calendar cron jobs
	if calendarConns := collections["calendar_connections"]; calendarConns != nil {
		// Watch channel renewal (every 6h)
		renewalJob := jobs.NewCalendarWatchRenewalJob(calendarConns, collections["categories"], cfg)
		renewalJob.StartCron(cronScheduler)

		// Connection heartbeat (every 1h)
		heartbeatJob := jobs.NewCalendarHeartbeatJob(calendarConns, collections["categories"], cfg)
		heartbeatJob.StartCron(cronScheduler)
	} else {
		slog.Warn("Calendar jobs disabled: calendar_connections collection not available")
	}

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
