# Nix Development Environment - Testing Setup

The Nix development environment automatically sets up everything you need for testing, including pre-commit hooks.

## What's Included

When you enter the Nix dev shell, you automatically get:

- ✅ **Go 1.23+** - For running backend tests
- ✅ **pre-commit** - For git hooks
- ✅ **golangci-lint** - For code linting
- ✅ **Python 3** - For additional tooling
- ✅ **Bun** - For frontend development
- ✅ **Git hooks** - Automatically installed on first shell entry

## Automatic Setup

When you enter the Nix shell for the first time:

```bash
# Enter the Nix development environment
direnv allow  # or: nix develop
```

The environment will automatically:
1. Install all required packages
2. Set up pre-commit hooks (if not already installed)
3. Display available commands via `env-help`

## Available Test Commands

Once in the Nix shell, you have access to these commands:

### Testing Commands

```bash
# Run fast unit tests (no MongoDB)
test-unit

# Run all backend tests
backend-test

# Run tests with coverage report
test-with-coverage

# Test pre-commit hooks without committing
test-hooks
```

### Hook Management

```bash
# Install/reinstall pre-commit hooks
install-hooks

# The hooks are automatically installed on shell entry
# But you can reinstall manually if needed
```

### Backend Commands

```bash
# Run backend server
backend-run

# Lint backend code
backend-lint

# Run backend tests
backend-test
```

### Frontend Commands

```bash
# Run frontend
frontend-run

# Lint frontend
frontend-lint

# Test frontend
frontend-test
```

## Pre-commit Hook Behavior

### Automatic Installation

The pre-commit hook is automatically installed when you:
1. Enter the Nix shell for the first time
2. Have a `.git` directory
3. Don't already have a pre-commit hook

### What the Hook Does

On every commit, it automatically:
1. Checks Go code formatting
2. Runs `go vet`
3. Runs unit tests (fast)
4. Warns about TODO/FIXME comments
5. Warns about debug print statements

### Manual Control

```bash
# Test hooks without committing
test-hooks

# Reinstall hooks
install-hooks

# Skip hooks on a specific commit
git commit --no-verify -m "Skip hooks"
```

## MongoDB for Integration Tests

Integration tests require MongoDB. You have two options:

### Option 1: Docker (Recommended)

```bash
# Start MongoDB
make mongodb-start

# Check if ready
make check-mongodb

# Stop when done
make mongodb-stop
```

### Option 2: Local MongoDB

Install MongoDB locally and ensure it's running on `localhost:27017`.

## Environment Variables

The Nix shell automatically sets:

```bash
GOTOOLCHAIN=auto  # Allows Go to auto-download toolchain versions
```

For tests, you may need to set:

```bash
export MONGO_URI=mongodb://localhost:27017
export TEST_MONGO_URI=mongodb://localhost:27017
```

## Workflow Example

```bash
# 1. Enter Nix shell (hooks auto-install)
direnv allow

# 2. Start MongoDB for integration tests
make mongodb-start

# 3. Run unit tests (fast)
test-unit

# 4. Run full test suite
backend-test

# 5. Make changes and commit (hooks run automatically)
git add .
git commit -m "Add feature"

# 6. If hooks pass, push
git push
```

## Troubleshooting

### Hooks Not Installing Automatically

If hooks don't install on shell entry:

```bash
# Manually install
install-hooks

# Or use make
make install-hooks
```

### Pre-commit Framework Not Working

The Nix shell includes both:
1. **Simple shell hooks** (default) - in `scripts/pre-commit-hook.sh`
2. **Pre-commit framework** (optional) - configured in `.pre-commit-config.yaml`

To use the framework:

```bash
pre-commit install
pre-commit run --all-files
```

### Tests Failing

```bash
# Check MongoDB is running
make check-mongodb

# Run only unit tests (no MongoDB needed)
test-unit

# Run with verbose output
cd backend && go test -v ./...
```

### Nix Shell Not Loading

```bash
# Reload direnv
direnv reload

# Or manually enter
nix develop

# Check for errors
nix flake check
```

## Updating the Environment

When `devenv.nix` changes:

```bash
# Reload the environment
direnv reload

# Or exit and re-enter the shell
exit
direnv allow
```

## CI/CD Integration

The Nix environment is for local development. CI/CD uses GitHub Actions with:
- Ubuntu runners
- Docker MongoDB service
- Go 1.23 from GitHub Actions
- Same test commands

See [TESTING_CI_CD.md](./TESTING_CI_CD.md) for CI/CD details.

## Benefits of Nix Integration

✅ **Reproducible** - Everyone gets the same environment
✅ **Automatic** - Hooks install without manual steps
✅ **Isolated** - Doesn't affect your system packages
✅ **Fast** - Nix caches everything
✅ **Declarative** - Environment defined in code

## Custom Scripts

All scripts are defined in `nix_modules/devenv.nix` under the `scripts` section. You can:

1. View all available scripts: `env-help`
2. Add new scripts by editing `devenv.nix`
3. Scripts are automatically available in the shell

## Additional Resources

- [Nix Development Environment](https://devenv.sh/)
- [Pre-commit Framework](https://pre-commit.com/)
- [Testing Guide](./TESTING_CI_CD.md)
- [Quick Start](./TESTING_QUICKSTART.md)
