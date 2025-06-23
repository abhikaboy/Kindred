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
	"github.com/abhikaboy/Kindred/internal/server"
	"github.com/abhikaboy/Kindred/internal/storage/xmongo"
	"github.com/abhikaboy/Kindred/internal/twillio"
	"github.com/abhikaboy/Kindred/internal/xslog"
	"github.com/joho/godotenv"
)

func main() {
	run(os.Stderr, os.Args[1:])
}

func run(stderr io.Writer, args []string) {
	cmd := flag.NewFlagSet("", flag.ExitOnError)
	verboseFlag := cmd.Bool("v", false, "")
	logLevelFlag := cmd.String("log-level", slog.LevelDebug.String(), "")
	if err := cmd.Parse(args); err != nil {
		fmt.Fprint(stderr, err)
		os.Exit(1)
	}
	logger := newLogger(*logLevelFlag, *verboseFlag, stderr)

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

	// API Server Setup
	_, fiberApp := server.New(db.Collections, db.Stream)
	fmt.Printf("After New")

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
	}
	
	// Use simple text handler with ANSI codes like Fiber does
	return slog.New(slog.NewTextHandler(stderr, &slog.HandlerOptions{
		AddSource: logLevel == "debug",
		Level:     level,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if a.Key == slog.LevelKey {
				level := a.Value.Any().(slog.Level)
				switch level {
				case slog.LevelDebug:
					a.Value = slog.StringValue("\033[36mDEBUG\033[0m") // Cyan like Fiber
				case slog.LevelInfo:
					a.Value = slog.StringValue("\033[32mINFO\033[0m")  // Green like Fiber
				case slog.LevelWarn:
					a.Value = slog.StringValue("\033[33mWARN\033[0m")  // Yellow
				case slog.LevelError:
					a.Value = slog.StringValue("\033[31mERROR\033[0m") // Red
				}
			}
			
			// Color the messages like Fiber does  
			if a.Key == slog.MessageKey {
				msg := a.Value.String()
				if strings.HasPrefix(msg, "🔐") {
					a.Value = slog.StringValue("\033[35m" + msg + "\033[0m") // Magenta
				} else if strings.HasPrefix(msg, "🌐") {
					a.Value = slog.StringValue("\033[34m" + msg + "\033[0m") // Blue  
				} else if strings.HasPrefix(msg, "✅") {
					a.Value = slog.StringValue("\033[32m" + msg + "\033[0m") // Green
				} else if strings.HasPrefix(msg, "❌") {
					a.Value = slog.StringValue("\033[31m" + msg + "\033[0m") // Red
				} else if strings.HasPrefix(msg, "🔍") {
					a.Value = slog.StringValue("\033[36m" + msg + "\033[0m") // Cyan
				} else if strings.HasPrefix(msg, "🔄") {
					a.Value = slog.StringValue("\033[33m" + msg + "\033[0m") // Yellow
				} else if strings.HasPrefix(msg, "🎯") {
					a.Value = slog.StringValue("\033[35m" + msg + "\033[0m") // Magenta
				} else if strings.HasPrefix(msg, "🔧") {
					a.Value = slog.StringValue("\033[36m" + msg + "\033[0m") // Cyan
				}
			}
			
			return a
		},
	}))
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
		output, err = exec.Command("netstat", "-ano", "|", "findstr", ":"+strconv.Itoa(port)).Output()
		if err != nil {
			return fmt.Errorf("failed to find process: %w", err)
		}
		pid := strings.Fields(string(output))[4]
		cmd = exec.Command("taskkill", "/F", "/PID", pid)

	case "darwin", "linux":
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
