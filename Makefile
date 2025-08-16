# Kindred Project Makefile

.PHONY: help generate-api build-backend test-backend dev-frontend generate-types clean

# Default target
help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

generate-api: ## Generate OpenAPI spec and TypeScript types (auto-detects Nix env)
	@echo "🚀 Generating API types..."
	@./scripts/generate-api-types.sh

build-backend: ## Build the backend server
	@echo "🔨 Building backend..."
	@cd backend && go build -o bin/server ./cmd/server

test-backend: ## Run backend tests
	@echo "🧪 Running backend tests..."
	@cd backend && go test ./...

dev-backend: ## Run backend in development mode
	@echo "🚀 Starting backend development server..."
	@cd backend && go run ./cmd/server

dev-frontend: ## Run frontend in development mode
	@echo "🚀 Starting frontend development server..."
	@cd frontend && bun run dev

generate-types: generate-api ## Alias for generate-api

clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf backend/bin/
	@rm -f /tmp/kindred-openapi
	@echo "✅ Clean completed"

install-backend: ## Install backend dependencies
	@echo "📦 Installing backend dependencies..."
	@cd backend && go mod download && go mod tidy

install-frontend: ## Install frontend dependencies
	@echo "📦 Installing frontend dependencies..."
	@cd frontend && bun install

install: install-backend install-frontend ## Install all dependencies

quick-openapi: ## Quick OpenAPI generation (build + generate)
	@echo "⚡ Quick OpenAPI generation..."
	@cd backend && go run ./cmd/server --generate-openapi --openapi-output="../frontend/api/api-spec.yaml"
	@echo "✅ OpenAPI spec generated: frontend/api/api-spec.yaml"
