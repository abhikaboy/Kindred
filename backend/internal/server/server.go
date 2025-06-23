package server

import (
	"context"
	"net/http"
	"time"

	activity "github.com/abhikaboy/Kindred/internal/handlers/activity"
	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	category "github.com/abhikaboy/Kindred/internal/handlers/category"
	connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	"github.com/abhikaboy/Kindred/internal/handlers/health"
	post "github.com/abhikaboy/Kindred/internal/handlers/post"
	profile "github.com/abhikaboy/Kindred/internal/handlers/profile"
	task "github.com/abhikaboy/Kindred/internal/handlers/task"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"go.mongodb.org/mongo-driver/mongo"
)

func New(collections map[string]*mongo.Collection, stream *mongo.ChangeStream) (huma.API, *http.Server) {
	router := chi.NewRouter()
	
	// Add Chi middleware (equivalent to Fiber middleware)
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Logger)
	router.Use(middleware.Recoverer)
	router.Use(middleware.Compress(5)) // equivalent to Fiber's compress level
	router.Use(middleware.Heartbeat("/"))
	
	// Add CORS middleware
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Set CORS headers
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization,refresh_token,X-Requested-With,Accept,Origin,Cache-Control,X-File-Name")
			w.Header().Set("Access-Control-Expose-Headers", "Authorization,refresh_token,access_token")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Max-Age", "86400") // 24 hours
			
			// Handle preflight OPTIONS request
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			
			next.ServeHTTP(w, r)
		})
	})

	// Rate limiting middleware (equivalent to Fiber's limiter)
	router.Use(middleware.Throttle(10)) // 10 requests per window

	// Create auth middleware for protected routes
	authMW := auth.AuthMiddlewareForServer(collections)
	
	// Apply auth middleware only to protected routes (user-specific endpoints)
	router.Route("/v1/user", func(r chi.Router) {
		r.Use(authMW)
	})

	// Create Huma API
	config := huma.DefaultConfig("Kindred API", "1.0.0")
	config.Info.Description = "Kindred API built with Huma v2"
	api := humachi.New(router, config)

	// TODO: Initialize sockets
	// sockets.New()

	// Register welcome route
	RegisterWelcomeRoute(api)

	// Register converted routes
	health.Routes(api, collections)
	auth.Routes(api, collections)
	category.Routes(api, collections)
	activity.Routes(api, collections)
	profile.Routes(api, collections)
	task.Routes(api, collections)
	connection.Routes(api, collections)
	post.Routes(api, collections)
	
	// TODO: Convert remaining routes to Huma
	// waitlist.Routes(api, collections)
	// socket.Routes(api, collections, stream)
	// blueprint.Routes(api, collections)

	// TODO: Start cron jobs
	// task.Cron(collections)

	// Create HTTP server
	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	return api, server
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
		Method:      http.MethodGet,
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
