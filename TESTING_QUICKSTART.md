# Testing Quick Start Guide

## 🚀 Setup (One Time)

```bash
# Install pre-commit hooks
make install-hooks

# Start MongoDB for tests
make mongodb-start
```

## 🧪 Running Tests

```bash
# Quick unit tests (no MongoDB needed)
make ci-test-short

# Full test suite (with MongoDB)
make test-backend

# Run with verbose output
make test-backend VERBOSE=1

# Generate coverage report
make ci-coverage
```

## 🪝 Git Workflow

```bash
# Make your changes
git add .

# Commit (hooks run automatically)
git commit -m "Your message"

# If hooks fail, fix issues and try again
# Or skip hooks (not recommended)
git commit --no-verify -m "Your message"
```

## 📊 Test the Hook Manually

```bash
# Test without committing
make test-hook
```

## 🔄 GitHub Actions

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request to `main` or `develop`

View results at: `https://github.com/YOUR_USERNAME/Kindred/actions`

## 🛠️ Common Commands

| Command | Description |
|---------|-------------|
| `make install-hooks` | Install pre-commit hooks |
| `make test-hook` | Test hooks without committing |
| `make ci-test-short` | Fast unit tests only |
| `make ci-test` | Full CI test suite |
| `make ci-coverage` | Generate coverage report |
| `make mongodb-start` | Start MongoDB for tests |
| `make mongodb-stop` | Stop MongoDB |
| `make uninstall-hooks` | Remove pre-commit hooks |

## ⚡ What the Pre-commit Hook Does

1. ✅ Checks Go code formatting
2. ✅ Runs `go vet` for static analysis
3. ✅ Runs unit tests (fast)
4. ⚠️ Warns about TODO/FIXME comments
5. ⚠️ Warns about debug print statements

## 📝 Writing Tests

```go
// Use the testing framework
type MyServiceTestSuite struct {
    testpkg.BaseSuite
    service *MyService
}

// Each test gets a fresh database
func (s *MyServiceTestSuite) TestMyFeature() {
    user := s.GetUser(0)  // Get test user
    // Your test code
}

// Mark integration tests
func TestIntegration(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping integration test")
    }
    // test code
}
```

## 🐛 Troubleshooting

**Hook not running?**
```bash
make uninstall-hooks
make install-hooks
```

**MongoDB not connecting?**
```bash
make mongodb-start
make check-mongodb
```

**Tests failing in CI but not locally?**
- Check MongoDB is running: `make mongodb-start`
- Run CI tests locally: `make ci-test`

## 📚 More Info

See [TESTING_CI_CD.md](./TESTING_CI_CD.md) for detailed documentation.
