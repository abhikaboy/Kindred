package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/abhikaboy/Kindred/internal/gemini"
	"github.com/abhikaboy/Kindred/internal/server"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/abhikaboy/Kindred/internal/twillio"
	"github.com/abhikaboy/Kindred/internal/unsplash"
	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/danielgtaylor/huma/v2"
	"github.com/joho/godotenv"
	"github.com/lmittmann/tint"
	"gopkg.in/yaml.v3"
)

func main() {
	run(os.Stderr, os.Args[1:])
}

func run(stderr io.Writer, args []string) {
	cmd := flag.NewFlagSet("", flag.ExitOnError)
	verboseFlag := cmd.Bool("v", false, "")
	logLevelFlag := cmd.String("log-level", slog.LevelDebug.String(), "")
	generateOpenAPIFlag := cmd.Bool("generate-openapi", false, "Generate OpenAPI spec and exit")
	openAPIOutputFlag := cmd.String("openapi-output", "api-spec.yaml", "Output file for OpenAPI spec")
	if err := cmd.Parse(args); err != nil {
		fmt.Fprint(stderr, err)
		os.Exit(1)
	}
	logger := newLogger(*logLevelFlag, *verboseFlag, os.Stderr)

	slog.SetDefault(logger)

	ctx := context.Background()

	if err := godotenv.Load(); err != nil {
		fatal(ctx, "Failed to load .env", err)
	}

	config, err := config.Load()
	if err != nil {
		fatal(ctx, "Failed to load config", err)
	}

	port, err := strconv.Atoi(config.App.Port)
	if err != nil {
		fatal(ctx, "Failed to convert port to int", err)
	}
	if err := killProcessOnPort(port); err != nil {
		// slog.LogAttrs(ctx, slog.LevelError, "Failed to kill process on port", slog.Int("port", port), slog.String("error", err.Error()))
	} else {
		slog.LogAttrs(ctx, slog.LevelInfo, "Process on port killed successfully", slog.Int("port", port))
	}

	// MongoDB Setup
	db, err := xmongo.New(ctx, config.Atlas)
	fmt.Printf("After New Mongo\n")

	if err != nil {
		fatal(ctx, "Failed to connect to MongoDB", err)
	}

	// SendGrid Setup
	twillio.InitSendGrid(config.Twillio.SG_Token)

	// Unsplash Setup
	var unsplashClient *unsplash.Client
	if config.Unsplash.AccessKey != "" {
		unsplashClient = unsplash.NewClient(config.Unsplash.AccessKey)
		fmt.Printf("Unsplash client initialized\n")
	} else {
		fmt.Printf("⚠️  Unsplash API key not configured - banner generation will be disabled\n")
	}

	// Gemini Setup (before server setup so it can be passed to routes)
	geminiService := gemini.InitGenkit(db.Collections, unsplashClient)
	fmt.Printf("Gemini service initialized\n")

	// API Server Setup
	api, fiberApp := server.New(db.Collections, db.Stream, geminiService)
	fmt.Printf("Server initialized\n")

	// Handle OpenAPI generation if flag is set
	if *generateOpenAPIFlag {
		if err := generateOpenAPISpec(api, *openAPIOutputFlag); err != nil {
			fatal(ctx, "Failed to generate OpenAPI spec", err)
		}
		fmt.Printf("OpenAPI spec generated successfully: %s\n", *openAPIOutputFlag)
		os.Exit(0)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Hour)
	go func() {
		slog.LogAttrs(ctx, slog.LevelInfo, "Starting Fiber server on port", slog.String("port", config.App.Port))
		if err := fiberApp.Listen(":" + config.App.Port); err != nil {
			fatal(ctx, "Failed to start Fiber server", err)
		}
	}()

	defer cancel()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	<-quit
	slog.LogAttrs(
		ctx,
		slog.LevelInfo,
		"Stopping Fiber server",
	)

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := fiberApp.ShutdownWithContext(shutdownCtx); err != nil {
		fatal(ctx, "Failed to shutdown Fiber server", err)
	}

	slog.LogAttrs(
		ctx,
		slog.LevelInfo,
		"Server shutdown",
	)
}

func newLogger(logLevel string, verbose bool, stderr io.Writer) *slog.Logger {
	if verbose {
		logLevel = "debug"
	}
	level := slog.LevelInfo.Level()
	switch logLevel {
	case "debug":
		level = slog.LevelDebug.Level()
	case "warn":
		level = slog.LevelWarn.Level()
	case "error":
		level = slog.LevelError.Level()
	case "info":
		level = slog.LevelInfo.Level()
	}

	handler := tint.NewHandler(stderr, &tint.Options{
		Level:     level,
		AddSource: logLevel == "debug",
	})
	return slog.New(handler)
}

func fatal(ctx context.Context, msg string, err error) {
	slog.LogAttrs(
		ctx,
		slog.LevelError,
		msg,
		xslog.Error(err),
	)
	os.Exit(1)
}

func killProcessOnPort(port int) error {
	var cmd *exec.Cmd
	var output []byte
	var err error

	switch runtime.GOOS {
	case "windows":
		// #nosec G204 - port is validated as integer, not user input
		output, err = exec.Command("netstat", "-ano", "|", "findstr", ":"+strconv.Itoa(port)).Output()
		if err != nil {
			return fmt.Errorf("failed to find process: %w", err)
		}
		pid := strings.Fields(string(output))[4]
		cmd = exec.Command("taskkill", "/F", "/PID", pid)

	case "darwin", "linux":
		// #nosec G204 - port is validated as integer, not user input
		output, err = exec.Command("lsof", "-i", ":"+strconv.Itoa(port)).Output()
		if err != nil {
			return fmt.Errorf("failed to find process: %w", err)
		}
		lines := strings.Split(string(output), "\n")
		if len(lines) < 2 {
			return fmt.Errorf("no process found listening on port %d", port)
		}
		pid := strings.Fields(lines[1])[1]
		cmd = exec.Command("kill", "-9", pid)

	default:
		return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}

	err = cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to kill process: %w", err)
	}

	return nil
}

// generateOpenAPISpec generates the OpenAPI specification and saves it to a file
func generateOpenAPISpec(api huma.API, outputPath string) error {
	// Get the OpenAPI spec from Huma
	spec := api.OpenAPI()

	// Marshal to YAML
	yamlData, err := yaml.Marshal(spec)
	if err != nil {
		return fmt.Errorf("failed to marshal OpenAPI spec to YAML: %w", err)
	}

	// Write to file with secure permissions
	// #nosec G306 - OpenAPI spec is public documentation, 0644 is appropriate
	if err := os.WriteFile(outputPath, yamlData, 0644); err != nil {
		return fmt.Errorf("failed to write OpenAPI spec to file: %w", err)
	}

	return nil
}
