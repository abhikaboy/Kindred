# Testing, CI/CD, and Git Hooks

This document explains how to set up and use automated testing with GitHub Actions and pre-commit hooks.

## Table of Contents
- [Quick Start](#quick-start)
- [Pre-commit Hooks](#pre-commit-hooks)
- [GitHub Actions](#github-actions)
- [Running Tests Locally](#running-tests-locally)
- [CI/CD Pipeline](#cicd-pipeline)

## Quick Start

### Install Pre-commit Hooks
```bash
# Simple shell-based hooks (recommended)
make install-hooks

# Or use the pre-commit framework (requires Python)
make install-pre-commit-framework
```

### Run Tests Locally
```bash
# Run all tests
make test-backend

# Run only unit tests (fast, no MongoDB)
make ci-test-short

# Run full CI tests (with MongoDB)
make ci-test

# Generate coverage report
make ci-coverage
```

## Pre-commit Hooks

Pre-commit hooks automatically run checks before each commit to catch issues early.

### What Gets Checked

The pre-commit hook runs:
1. **Go formatting** - Ensures code is properly formatted
2. **go vet** - Static analysis for common Go issues
3. **Unit tests** - Runs fast unit tests (with `-short` flag)
4. **Code quality checks** - Detects TODO/FIXME comments and debug statements

### Installation

**Option 1: Simple Shell Script (Recommended)**
```bash
make install-hooks
```

This creates a symlink from `.git/hooks/pre-commit` to `scripts/pre-commit-hook.sh`.

**Option 2: Pre-commit Framework**
```bash
make install-pre-commit-framework
```

This uses the Python-based [pre-commit](https://pre-commit.com/) framework with the configuration in `.pre-commit-config.yaml`.

### Usage

Once installed, the hooks run automatically on every commit:
```bash
git commit -m "Your commit message"
# Hooks run automatically
```

To skip hooks (not recommended):
```bash
git commit --no-verify -m "Skip hooks"
```

To test hooks without committing:
```bash
make test-hook
```

### Uninstall Hooks
```bash
make uninstall-hooks
```

## GitHub Actions

The project has two GitHub Actions workflows:

### 1. Test Workflow (`.github/workflows/test.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**
- **Backend Tests**
  - Starts MongoDB service
  - Runs unit tests with `-short` flag
  - Runs integration tests (connection, post, blueprint, etc.)
  - Generates coverage report
  - Uploads coverage as artifact

- **Lint**
  - Runs `golangci-lint` on backend code

- **Frontend Tests**
  - Installs Bun dependencies
  - Runs type checking

**MongoDB Service:**
The workflow automatically starts a MongoDB container for tests:
```yaml
services:
  mongodb:
    image: mongo:latest
    ports:
      - 27017:27017
```

### 2. Docker Build & Deploy (`.github/workflows/docker-build-deploy.yml`)

Builds and deploys the Docker image on pushes to `main`.

## Running Tests Locally

### Prerequisites

1. **MongoDB** (for integration tests):
   ```bash
   # Start MongoDB in Docker
   make mongodb-start

   # Check if MongoDB is ready
   make check-mongodb

   # Stop MongoDB when done
   make mongodb-stop
   ```

2. **Go 1.23+** installed

### Test Commands

```bash
# Run all tests (verbose)
make test-backend VERBOSE=1

# Run all tests (quiet - summary only)
make test-backend QUIET=1

# Run only unit tests (no MongoDB needed)
cd backend && go test -short ./...

# Run specific package tests
cd backend && go test ./internal/handlers/connection -v

# Run tests with race detection
cd backend && go test -race ./...

# Run tests with coverage
cd backend && go test -coverprofile=coverage.out ./...
cd backend && go tool cover -html=coverage.out

# Run integration tests (requires MongoDB)
cd backend && go test ./internal/handlers/connection ./internal/handlers/post
```

### Test Modes

**Short Mode (`-short`):**
- Runs only unit tests
- Skips integration tests
- No external dependencies needed
- Fast (< 5 seconds)

**Full Mode:**
- Runs all tests including integration tests
- Requires MongoDB
- Creates ephemeral test databases
- Slower but comprehensive

**Integration Test Example:**
```bash
# Skip integration tests
go test -short ./...

# Run only integration tests
go test -run Integration ./...
```

## CI/CD Pipeline

### Test Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Push/Pull Request                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   GitHub Actions Triggered                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
    ┌───────┐    ┌───────┐    ┌─────────┐
    │Backend│    │ Lint  │    │Frontend │
    │ Tests │    │       │    │  Tests  │
    └───┬───┘    └───────┘    └─────────┘
        │
        ├─ Start MongoDB
        ├─ Run unit tests (-short)
        ├─ Run integration tests
        ├─ Generate coverage
        └─ Upload artifacts
```

### Environment Variables

Tests use these environment variables:

```bash
# MongoDB connection
MONGO_URI=mongodb://localhost:27017
TEST_MONGO_URI=mongodb://localhost:27017

# Set in GitHub Actions automatically
```

### Secrets Required

For the full CI/CD pipeline, these secrets must be set in GitHub:

**For Tests:**
- None required (uses local MongoDB service)

**For Docker Build & Deploy:**
- `ATLAS_USER`, `ATLAS_PASS`, `ATLAS_CLUSTER`, `ATLAS_ENVIRONMENT`
- `DO_SPACES_ACCESS_KEY`, `DO_SPACES_SECRET_KEY`
- `TWILLIO_SG_TOKEN`
- `GEMINI_API_KEY`
- `AUTH_SECRET`
- `SINCH_APPLICATION_KEY`, `SINCH_APPLICATION_SECRET`
- `DO_HOST`, `DO_USERNAME`, `DO_SSH_KEY`
- `GITHUB_TOKEN` (automatically provided)

## Test Coverage

### View Coverage Locally
```bash
make ci-coverage
# Opens coverage.html in browser
```

### Coverage in CI
Coverage reports are automatically:
1. Generated during test runs
2. Uploaded as GitHub Actions artifacts
3. Available for download from the Actions tab

### Coverage Thresholds
You can enforce minimum coverage by uncommenting in `.github/workflows/test.yml`:
```yaml
if (( $(echo "$COVERAGE < 50" | bc -l) )); then
  echo "Coverage is below 50%"
  exit 1
fi
```

## Troubleshooting

### Pre-commit Hook Issues

**Hook not running:**
```bash
# Check if hook is installed
ls -la .git/hooks/pre-commit

# Reinstall
make uninstall-hooks
make install-hooks
```

**Tests failing in hook:**
```bash
# Run hook manually to see full output
./scripts/pre-commit-hook.sh

# Skip hook temporarily
git commit --no-verify
```

### MongoDB Issues

**Connection refused:**
```bash
# Check if MongoDB is running
make check-mongodb

# Start MongoDB
make mongodb-start

# Check Docker logs
docker logs kindred-mongodb-test
```

**Port already in use:**
```bash
# Stop existing MongoDB
make mongodb-stop

# Or kill process on port 27017
lsof -ti:27017 | xargs kill -9
```

### GitHub Actions Issues

**Tests failing in CI but passing locally:**
1. Check MongoDB service is running in workflow
2. Verify environment variables are set
3. Check Go version matches (1.23)
4. Look at full logs in Actions tab

**Secrets not working:**
1. Verify secrets are set in repository settings
2. Check secret names match exactly
3. Ensure workflow has permission to access secrets

## Best Practices

### Writing Tests

1. **Use the testing framework:**
   ```go
   type MyServiceTestSuite struct {
       testpkg.BaseSuite
       service *MyService
   }
   ```

2. **Mark integration tests:**
   ```go
   func TestIntegration(t *testing.T) {
       if testing.Short() {
           t.Skip("Skipping integration test")
       }
       // test code
   }
   ```

3. **Use descriptive test names:**
   ```go
   func (s *MyTestSuite) TestCreateUser_WithValidData_Success() {
       // test code
   }
   ```

### Commit Workflow

1. Write code
2. Run tests locally: `make test-backend`
3. Commit (hooks run automatically)
4. Push (CI runs automatically)
5. Create PR (CI runs on PR)

### Debugging Failed Tests

```bash
# Run specific test with verbose output
cd backend && go test -v -run TestSpecificTest ./path/to/package

# Run with race detector
cd backend && go test -race -run TestSpecificTest ./path/to/package

# Get detailed failure info
cd backend && go test -v ./... 2>&1 | grep -A 10 FAIL
```

## Additional Resources

- [Go Testing Documentation](https://golang.org/pkg/testing/)
- [Testify Documentation](https://github.com/stretchr/testify)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Pre-commit Framework](https://pre-commit.com/)
