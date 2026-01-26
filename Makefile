# Kindred Project Makefile

.PHONY: help generate-api build-backend test-backend dev-frontend generate-types clean install-hooks uninstall-hooks test-hook ci-test ci-test-short ci-coverage install-pre-commit-framework run-pre-commit

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

test-backend: ## Run backend tests (use VERBOSE=1 for detailed output, QUIET=1 for minimal output)
	@echo "\033[1;36m🧪 Running backend tests...\033[0m"
	@TEMP_FILE=$$(mktemp); \
	if [ "$(QUIET)" = "1" ]; then \
		cd backend && go test ./... 2>&1 | tee $$TEMP_FILE | sed \
			-e 's/^PASS$$/\x1b[1;92mPASS\x1b[0m/' \
			-e 's/^FAIL$$/\x1b[1;91mFAIL\x1b[0m/' \
			-e 's/^ok  /\x1b[1;92m✓ \x1b[0m/' \
			-e 's/^FAIL\t/\x1b[1;91m✗ \x1b[0m/' \
			-e 's/^\?   /\x1b[2;37m○ \x1b[0m/' \
			-e 's/\[no test files\]/\x1b[2;37m[no test files]\x1b[0m/' \
			-e 's/\[cached\]/\x1b[0;36m[cached]\x1b[0m/' \
			-e 's/\[build failed\]/\x1b[1;91m[build failed]\x1b[0m/' \
			-e 's/Error:/\x1b[1;91mError:\x1b[0m/g'; \
	elif [ "$(VERBOSE)" = "1" ]; then \
		cd backend && go test ./... -v 2>&1 | tee $$TEMP_FILE | sed \
			-e 's/^PASS$$/\x1b[1;92mPASS\x1b[0m/' \
			-e 's/^FAIL$$/\x1b[1;91mFAIL\x1b[0m/' \
			-e 's/^--- PASS:/\x1b[1;32m--- PASS:\x1b[0m/' \
			-e 's/^--- FAIL:/\x1b[1;31m--- FAIL:\x1b[0m/' \
			-e 's/^--- SKIP:/\x1b[0;33m--- SKIP:\x1b[0m/' \
			-e 's/^ok  /\x1b[1;92m✓ \x1b[0m/' \
			-e 's/^FAIL\t/\x1b[1;91m✗ \x1b[0m/' \
			-e 's/^\?   /\x1b[2;37m○ \x1b[0m/' \
			-e 's/\[no test files\]/\x1b[2;37m[no test files]\x1b[0m/' \
			-e 's/\[cached\]/\x1b[0;36m[cached]\x1b[0m/' \
			-e 's/\[build failed\]/\x1b[1;91m[build failed]\x1b[0m/' \
			-e 's/^=== RUN/\x1b[0;36m=== RUN\x1b[0m/' \
			-e 's/^    [a-z_]*\.go:[0-9]*/\x1b[0;35m&\x1b[0m/' \
			-e 's/^    --- PASS:/\x1b[0;32m    --- PASS:\x1b[0m/' \
			-e 's/^    --- FAIL:/\x1b[0;31m    --- FAIL:\x1b[0m/' \
			-e 's/^    --- SKIP:/\x1b[0;33m    --- SKIP:\x1b[0m/' \
			-e 's/suite\.go:[0-9]*/\x1b[0;35m&\x1b[0m/' \
			-e 's/^2026\/[0-9\/]* [0-9:]* INFO/\x1b[0;36m&\x1b[0m/' \
			-e 's/^2026\/[0-9\/]* [0-9:]* WARN/\x1b[0;33m&\x1b[0m/' \
			-e 's/([0-9.]*s)/\x1b[0;36m&\x1b[0m/g' \
			-e 's/Test database created/\x1b[0;35m&\x1b[0m/' \
			-e 's/Error:/\x1b[1;91mError:\x1b[0m/g' \
			-e 's/error:/\x1b[0;31merror:\x1b[0m/g' \
			-e 's/Failed to/\x1b[1;31m&\x1b[0m/g'; \
	else \
		cd backend && go test ./... -v 2>&1 | tee $$TEMP_FILE | sed \
			-e 's/^PASS$$/\x1b[1;92mPASS\x1b[0m/' \
			-e 's/^FAIL$$/\x1b[1;91mFAIL\x1b[0m/' \
			-e 's/^--- PASS:/\x1b[1;32m--- PASS:\x1b[0m/' \
			-e 's/^--- FAIL:/\x1b[1;31m--- FAIL:\x1b[0m/' \
			-e 's/^--- SKIP:/\x1b[2;37m--- SKIP:\x1b[0m/' \
			-e 's/^ok  /\x1b[1;92m✓ \x1b[0m/' \
			-e 's/^FAIL\t/\x1b[1;91m✗ \x1b[0m/' \
			-e 's/^\?   /\x1b[2;37m○ \x1b[0m/' \
			-e 's/\[no test files\]/\x1b[2;37m[no test files]\x1b[0m/' \
			-e 's/\[cached\]/\x1b[0;36m[cached]\x1b[0m/' \
			-e 's/\[build failed\]/\x1b[1;91m[build failed]\x1b[0m/' \
			-e 's/^=== RUN/\x1b[0;36m=== RUN\x1b[0m/' \
			-e 's/^    [a-z_]*\.go:[0-9]*/\x1b[2;37m&\x1b[0m/' \
			-e 's/^    --- PASS:/\x1b[0;32m    --- PASS:\x1b[0m/' \
			-e 's/^    --- FAIL:/\x1b[0;31m    --- FAIL:\x1b[0m/' \
			-e 's/^    --- SKIP:/\x1b[2;90m    --- SKIP:\x1b[0m/' \
			-e 's/suite\.go:[0-9]*/\x1b[2;90m&\x1b[0m/' \
			-e 's/^2026\/[0-9\/]* [0-9:]* INFO/\x1b[0;36m&\x1b[0m/' \
			-e 's/^2026\/[0-9\/]* [0-9:]* WARN/\x1b[0;33m&\x1b[0m/' \
			-e 's/([0-9.]*s)/\x1b[0;36m&\x1b[0m/g' \
			-e 's/Test database created/\x1b[2;90m&\x1b[0m/' \
			-e 's/Error:/\x1b[1;91mError:\x1b[0m/g' \
			-e 's/error:/\x1b[0;31merror:\x1b[0m/g' \
			-e 's/Failed to/\x1b[1;31m&\x1b[0m/g'; \
	fi; \
	EXIT_CODE=$$?; \
	printf "\n"; \
	printf "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n"; \
	printf "\033[1;36m                              TEST SUMMARY\033[0m\n"; \
	printf "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n"; \
	printf "\n"; \
	PASSED_PKG=$$(grep -E "^ok  " $$TEMP_FILE 2>/dev/null | wc -l | tr -d ' '); \
	FAILED_PKG=$$(grep -E "^FAIL	" $$TEMP_FILE 2>/dev/null | wc -l | tr -d ' '); \
	NOTEST=$$(grep -E "^\?   " $$TEMP_FILE 2>/dev/null | wc -l | tr -d ' '); \
	TOTAL_PKG=$$((PASSED_PKG + FAILED_PKG)); \
	TOTAL_TESTS_PASSED=$$(grep -E "^    --- PASS:" $$TEMP_FILE 2>/dev/null | wc -l | tr -d ' '); \
	TOTAL_TESTS_FAILED=$$(grep -E "^    --- FAIL:" $$TEMP_FILE 2>/dev/null | wc -l | tr -d ' '); \
	TOTAL_TESTS=$$((TOTAL_TESTS_PASSED + TOTAL_TESTS_FAILED)); \
	if [ $$PASSED_PKG -gt 0 ]; then \
		printf "\033[1;92m✓ PASSED PACKAGES:\033[0m $$PASSED_PKG\n"; \
		grep -E "^ok  " $$TEMP_FILE 2>/dev/null | awk 'BEGIN{tests=0} {pkg=$$2; time=""; for(i=3;i<=NF;i++){if($$i ~ /^[0-9.]+s$$/){time=$$i}} printf "  \033[0;32m●\033[0m %-60s \033[0;36m%s\033[0m\n", pkg, time}'; \
		printf "\n"; \
	fi; \
	if [ $$FAILED_PKG -gt 0 ]; then \
		printf "\033[1;91m✗ FAILED PACKAGES:\033[0m $$FAILED_PKG\n"; \
		grep -E "^FAIL	" $$TEMP_FILE 2>/dev/null | awk '{pkg=$$2; time=$$3; printf "  \033[0;31m●\033[0m %-60s \033[0;36m%s\033[0m\n", pkg, time}'; \
		printf "\n"; \
		printf "\033[1;91m  Failed Tests:\033[0m\n"; \
		grep -E "^    --- FAIL:" $$TEMP_FILE 2>/dev/null | awk '{test=$$3; for(i=4;i<=NF;i++){if($$i ~ /^\(/){break} test=test" "$$i} printf "    \033[0;31m✗\033[0m %s\n", test}'; \
		printf "\n"; \
	fi; \
	if [ $$NOTEST -gt 0 ]; then \
		printf "\033[2;37m○ NO TESTS:\033[0m $$NOTEST package(s)\n"; \
		printf "\n"; \
	fi; \
	printf "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n"; \
	if [ $$TOTAL_TESTS -gt 0 ]; then \
		TEST_PERCENT=$$((TOTAL_TESTS_PASSED * 100 / TOTAL_TESTS)); \
		printf "\033[1;36m                    TOTAL TESTS:\033[0m $$TOTAL_TESTS  "; \
		printf "\033[1;92m✓ $$TOTAL_TESTS_PASSED passed\033[0m  "; \
		if [ $$TOTAL_TESTS_FAILED -gt 0 ]; then \
			printf "\033[1;91m✗ $$TOTAL_TESTS_FAILED failed\033[0m\n"; \
		else \
			printf "\n"; \
		fi; \
		if [ $$TOTAL_TESTS_FAILED -eq 0 ]; then \
			printf "\033[1;92m                    ✓ ALL TESTS PASSED (100%%)\033[0m\n"; \
		else \
			printf "\033[1;33m                    PASS RATE: $$TEST_PERCENT%%\033[0m\n"; \
		fi; \
	else \
		printf "\033[2;37m                         NO TESTS RAN\033[0m\n"; \
	fi; \
	printf "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n"; \
	printf "\n"; \
	rm -f $$TEMP_FILE; \
	exit $$EXIT_CODE

test-backend-quiet: ## Run backend tests with minimal output (only pass/fail summary)
	@$(MAKE) test-backend QUIET=1

test-backend-verbose: ## Run backend tests with all debug information
	@$(MAKE) test-backend VERBOSE=1

test-backend-coverage: ## Run backend tests with coverage report
	@echo "\033[1;36m🧪 Running backend tests with coverage...\033[0m"
	@TEMP_FILE=$$(mktemp); \
	(cd backend && go test ./... -coverprofile=coverage.out -covermode=atomic 2>&1) | tee $$TEMP_FILE | grep -E "(ok|FAIL|coverage:)" || true; \
	echo ""; \
	if [ -f backend/coverage.out ]; then \
		printf "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n"; \
		printf "\033[1;36m                           COVERAGE SUMMARY\033[0m\n"; \
		printf "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n"; \
		printf "\n"; \
		(cd backend && go tool cover -func=coverage.out | grep "^total:" | awk '{cov=$$3; num=$$3; gsub(/%/, "", num); if (num >= 80) printf "\033[1;36mTotal Coverage:\033[0m \033[1;92m%s\033[0m of statements\n", cov; else if (num >= 50) printf "\033[1;36mTotal Coverage:\033[0m \033[1;33m%s\033[0m of statements\n", cov; else printf "\033[1;36mTotal Coverage:\033[0m \033[1;31m%s\033[0m of statements\n", cov}'); \
		printf "\n"; \
		printf "\033[1;36m📊 Coverage by package:\033[0m\n"; \
		grep -E "coverage:" $$TEMP_FILE | grep "internal/handlers" | awk '{pkg=$$2; match($$0, /[0-9]+\.[0-9]+%/); cov=substr($$0, RSTART, RLENGTH); num=cov; gsub(/%/, "", num); if (num >= 80) printf "  \033[0;32m●\033[0m %-60s \033[0;32m%s\033[0m\n", pkg, cov; else if (num >= 50) printf "  \033[0;33m●\033[0m %-60s \033[0;33m%s\033[0m\n", pkg, cov; else if (num > 0) printf "  \033[0;31m●\033[0m %-60s \033[0;31m%s\033[0m\n", pkg, cov}' | sort -t'.' -k1 -rn; \
		printf "\n"; \
		printf "\033[2;37m💡 View detailed HTML report: make test-backend-coverage-html\033[0m\n"; \
		printf "\033[2;37m💡 Or manually: cd backend && go tool cover -html=coverage.out\033[0m\n"; \
		printf "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n"; \
		printf "\n"; \
	else \
		printf "\033[1;31m✗ Coverage file not generated\033[0m\n"; \
	fi; \
	rm -f $$TEMP_FILE

test-backend-coverage-html: ## Open coverage report in browser
	@echo "\033[1;36m🌐 Opening coverage report in browser...\033[0m"
	@cd backend && go test ./... -coverprofile=coverage.out -covermode=atomic > /dev/null 2>&1
	@cd backend && go tool cover -html=coverage.out

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

mongodb-start: ## Start MongoDB in Docker for tests
	@echo "🚀 Starting MongoDB..."
	@docker run -d --name kindred-mongodb-test -p 27017:27017 mongo:latest 2>/dev/null || docker start kindred-mongodb-test
	@echo "✅ MongoDB running on localhost:27017"

mongodb-stop: ## Stop MongoDB Docker container
	@echo "🛑 Stopping MongoDB..."
	@docker stop kindred-mongodb-test
	@echo "✅ MongoDB stopped"

mongodb-remove: ## Remove MongoDB Docker container
	@echo "🗑️  Removing MongoDB container..."
	@docker rm -f kindred-mongodb-test
	@echo "✅ MongoDB container removed"

check-mongodb: ## Check if MongoDB is running and ready for tests
	@backend/scripts/check-mongodb.sh

create-test-db: ## Create an ephemeral test database with fixtures (for inspection)
	@echo "🌱 Creating ephemeral test database..."
	@cd backend && go run ./cmd/seed-test-db
	@echo "✅ Ephemeral test database created"

# Git Hooks
install-hooks: ## Install pre-commit hooks
	@echo "🪝 Installing pre-commit hooks..."
	@if [ -f .git/hooks/pre-commit ]; then \
		echo "⚠️  Pre-commit hook already exists. Backing up to .git/hooks/pre-commit.backup"; \
		mv .git/hooks/pre-commit .git/hooks/pre-commit.backup; \
	fi
	@ln -s ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "✅ Pre-commit hooks installed"
	@echo "💡 To skip hooks on commit, use: git commit --no-verify"

uninstall-hooks: ## Uninstall pre-commit hooks
	@echo "🗑️  Uninstalling pre-commit hooks..."
	@rm -f .git/hooks/pre-commit
	@if [ -f .git/hooks/pre-commit.backup ]; then \
		echo "📦 Restoring backup..."; \
		mv .git/hooks/pre-commit.backup .git/hooks/pre-commit; \
	fi
	@echo "✅ Pre-commit hooks uninstalled"

test-hook: ## Test the pre-commit hook without committing
	@echo "🧪 Testing pre-commit hook..."
	@./scripts/pre-commit-hook.sh

# CI/CD
ci-test: ## Run tests as they would run in CI (with MongoDB)
	@echo "🔄 Running CI tests..."
	@$(MAKE) mongodb-start
	@sleep 2
	@echo "🧪 Running tests with MongoDB..."
	@cd backend && MONGO_URI=mongodb://localhost:27017 TEST_MONGO_URI=mongodb://localhost:27017 go test -v -race ./...
	@$(MAKE) mongodb-stop

ci-test-short: ## Run only unit tests (fast, no MongoDB required)
	@echo "⚡ Running unit tests..."
	@cd backend && go test -short -v ./...

ci-coverage: ## Generate test coverage report
	@echo "📊 Generating coverage report..."
	@cd backend && go test -short -coverprofile=coverage.out ./...
	@cd backend && go tool cover -html=coverage.out -o coverage.html
	@echo "✅ Coverage report generated: backend/coverage.html"
	@cd backend && go tool cover -func=coverage.out | grep total

# Pre-commit framework (optional)
install-pre-commit-framework: ## Install pre-commit framework (requires Python)
	@echo "📦 Installing pre-commit framework..."
	@if command -v pre-commit >/dev/null 2>&1; then \
		echo "✅ pre-commit already installed"; \
	else \
		echo "Installing pre-commit..."; \
		pip install pre-commit || pip3 install pre-commit; \
	fi
	@pre-commit install
	@echo "✅ Pre-commit framework installed"

run-pre-commit: ## Run pre-commit on all files
	@echo "🔍 Running pre-commit on all files..."
	@pre-commit run --all-files
