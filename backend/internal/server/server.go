package server

import (
	"time"

	activity "github.com/abhikaboy/Kindred/internal/handlers/activity"
	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	category "github.com/abhikaboy/Kindred/internal/handlers/category"
	chat "github.com/abhikaboy/Kindred/internal/handlers/chat"
	connections "github.com/abhikaboy/Kindred/internal/handlers/connection"
	"github.com/abhikaboy/Kindred/internal/handlers/health"
	post "github.com/abhikaboy/Kindred/internal/handlers/post"
	profile "github.com/abhikaboy/Kindred/internal/handlers/profile"
	"github.com/abhikaboy/Kindred/internal/handlers/socket"
	"github.com/abhikaboy/Kindred/internal/handlers/task"
	waitlist "github.com/abhikaboy/Kindred/internal/handlers/waitlist"
	"github.com/abhikaboy/Kindred/internal/sockets"

	"github.com/abhikaboy/Kindred/internal/xerr"
	gojson "github.com/goccy/go-json"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/favicon"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"go.mongodb.org/mongo-driver/mongo"
)

func New(collections map[string]*mongo.Collection, stream *mongo.ChangeStream) *fiber.App {

	app := setupApp()
	sockets.New()

	health.Routes(app, collections)
	auth.Routes(app, collections)

	task.Routes(app, collections)
	chat.Routes(app, collections)
	category.Routes(app, collections)
	post.Routes(app, collections)
	activity.Routes(app, collections)
	connections.Routes(app, collections)
	profile.Routes(app, collections)
	waitlist.Routes(app, collections)
	socket.Routes(app, collections, stream)

	return app
}

func setupApp() *fiber.App {
	app := fiber.New(fiber.Config{
		JSONEncoder:  gojson.Marshal,
		JSONDecoder:  gojson.Unmarshal,
		ErrorHandler: xerr.ErrorHandler,
	})
	app.Use(recover.New())
	app.Use(requestid.New())
	app.Use(favicon.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,PATCH,DELETE",
	}))
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${ip}:${port} ${pid} ${locals:requestid} ${status} - ${latency} ${method} ${path}\n",
	}))
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed,
	}))
	app.Get("/", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).SendString("Welcome to [NAME]!")
	})

	app.Use(limiter.New(limiter.Config{
		Max:        10,
		Expiration: 1 * time.Second,
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).SendString("Too many requests")
		},
		LimiterMiddleware: limiter.SlidingWindow{},
	}))

	return app
}
