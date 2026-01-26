# Backend Testing Guide

## 🎯 Quick Start

```bash
# Default mode - balanced output with color coding
make test-backend

# Quiet mode - minimal output, only pass/fail summary
make test-backend-quiet

# Verbose mode - all debug information visible
make test-backend-verbose
```

---

## 📊 Test Verbosity Levels

### 1. **Quiet Mode** (`QUIET=1`)
**Best for:** CI/CD, quick checks, production environments

Shows only:
- ✅ Pass/fail status per package
- ❌ Error messages for failures
- 📦 Package summary

**Usage:**
```bash
make test-backend-quiet
# or
make test-backend QUIET=1
```

**Example Output:**
```
✓ 	github.com/.../notifications	2.115s
✓ 	github.com/.../post	2.489s
✗ 	github.com/.../connection	3.565s
○ 	github.com/.../profile	[no test files]
```

---

### 2. **Normal Mode** (Default)
**Best for:** Daily development, debugging specific tests

Shows:
- ✅ All test names and results
- 🎨 Color-coded output with two gray levels
- ⏱️ Test durations
- 📝 Top-level test structure
- ⚠️ Warnings and info logs
- ❌ Detailed error messages

**Usage:**
```bash
make test-backend
# or
cd backend && go test ./... -v
```

**Color Scheme:**
- 🟢 **Bright Green** - PASS status and ✓
- 🟢 **Green** - Individual passing tests
- 🔴 **Bright Red** - FAIL status and ✗
- 🔴 **Red** - Individual failing tests
- 🟡 **Yellow** - WARN logs
- 🔵 **Cyan** - Test execution (=== RUN), INFO logs, timestamps
- ⚪ **Light Gray** - File locations, structural elements
- ⚫ **Dark Gray** - Infrastructure noise (suite.go, database creation)

**Example Output:**
```
=== RUN   TestWaitlistService
=== RUN   TestWaitlistService/TestCreateWaitlist_Success
    suite.go:35: Test database created: test_1769448207096596000
2026/01/26 12:23:27 INFO Waitlist inserted id=6977a30f81a9687c62c18950
--- PASS: TestWaitlistService (0.73s)
    --- PASS: TestCreateWaitlist_Success (0.17s)
PASS
✓ 	github.com/.../waitlist	1.767s
```

---

### 3. **Verbose Mode** (`VERBOSE=1`)
**Best for:** Deep debugging, investigating test failures, development

Shows everything from Normal mode, plus:
- 🔍 All file references highlighted in magenta
- 🔍 Database creation logs in magenta
- 🔍 Suite framework logs in magenta
- 🔍 All internal test framework details

**Usage:**
```bash
make test-backend-verbose
# or
make test-backend VERBOSE=1
```

**Additional Colors in Verbose Mode:**
- 🟣 **Magenta** - All debug/infrastructure logs (suite.go, database IDs, file refs)
- 🟡 **Yellow** - SKIP messages (more visible)

**Example Output:**
```
=== RUN   TestWaitlistService/TestCreateWaitlist_Success
    suite.go:35: Test database created: test_1769448207096596000  ← Magenta
2026/01/26 12:23:27 INFO Waitlist inserted id=6977a30f81a9687c62c18950
    --- PASS: TestCreateWaitlist_Success (0.17s)
```

---

## 🎨 Complete Color Reference

### Normal Mode Colors:
| Element | Color | ANSI Code | When to Use |
|---------|-------|-----------|-------------|
| PASS (top) | Bright Green | `1;92` | Package passed |
| ✓ | Bright Green | `1;92` | Package passed |
| --- PASS: | Green | `1;32` | Test passed |
| Sub-test pass | Green | `0;32` | Sub-test passed |
| FAIL (top) | Bright Red | `1;91` | Package failed |
| ✗ | Bright Red | `1;91` | Package failed |
| --- FAIL: | Red | `1;31` | Test failed |
| Sub-test fail | Red | `0;31` | Sub-test failed |
| Error: | Bright Red | `1;91` | Error messages |
| Failed to | Bright Red | `1;31` | Error context |
| WARN | Yellow | `0;33` | Warning logs |
| === RUN | Cyan | `0;36` | Test execution |
| INFO | Cyan | `0;36` | Info logs |
| [cached] | Cyan | `0;36` | Cached results |
| (0.73s) | Cyan | `0;36` | Durations |
| --- SKIP: | Light Gray | `2;37` | Skipped tests |
| ○ | Light Gray | `2;37` | No test files |
| [no test files] | Light Gray | `2;37` | No tests |
| File locations | Light Gray | `2;37` | spaces_test.go:68 |
| suite.go:35 | Dark Gray | `2;90` | Framework refs |
| Test database | Dark Gray | `2;90` | DB creation |

### Verbose Mode Additional Colors:
| Element | Color | ANSI Code | When to Use |
|---------|-------|-----------|-------------|
| suite.go:35 | Magenta | `0;35` | Framework refs |
| Test database | Magenta | `0;35` | DB creation |
| File locations | Magenta | `0;35` | All file refs |
| --- SKIP: | Yellow | `0;33` | Skipped (more visible) |

---

## 🚀 Usage Examples

### Development Workflow

```bash
# Quick check during development
make test-backend

# Focus on specific handler
cd backend && go test ./internal/handlers/post -v

# Debug a failing test with all info
make test-backend-verbose

# CI/CD pipeline
make test-backend-quiet
```

### With Nix Environment

```bash
# Normal mode
nix develop --impure --command make test-backend

# Quiet mode
nix develop --impure --command make test-backend-quiet

# Verbose mode
nix develop --impure --command make test-backend-verbose
```

### Direct Go Commands

```bash
# Normal mode
cd backend && go test ./... -v

# Without verbose flag (similar to quiet)
cd backend && go test ./...

# Specific package
cd backend && go test ./internal/handlers/post -v

# With coverage
cd backend && go test ./... -cover

# Run specific test
cd backend && go test ./internal/handlers/post -v -run TestCreatePost
```

---

## 📝 Test Output Interpretation

### Reading Normal Mode Output

```
=== RUN   TestWaitlistService                          ← Cyan: Test suite starting
=== RUN   TestWaitlistService/TestCreateWaitlist       ← Cyan: Sub-test starting
    suite.go:35: Test database created: test_xxx       ← Dark Gray: Infrastructure
2026/01/26 12:23:27 INFO Waitlist inserted id=xxx      ← Cyan: Application log
--- PASS: TestWaitlistService (0.73s)                  ← Green: Suite passed
    --- PASS: TestCreateWaitlist_Success (0.17s)       ← Green: Sub-test passed
PASS                                                    ← Bright Green: Final status
✓ 	github.com/.../waitlist	[cached]                   ← Bright Green: Summary
```

### Reading Quiet Mode Output

```
✓ 	github.com/.../notifications	2.115s             ← All passing
✓ 	github.com/.../post	2.489s
✗ 	github.com/.../connection	3.565s                 ← One failing
    Error: failed to add friend...                     ← Error details
○ 	github.com/.../profile	[no test files]            ← No tests
```

### Reading Verbose Mode Output

```
=== RUN   TestWaitlistService                          ← Cyan: Test suite
    suite.go:35: Test database created: test_xxx       ← Magenta: All infrastructure
    spaces_test.go:68: Failed to parse JSON...         ← Magenta: File references
2026/01/26 12:23:27 INFO Waitlist inserted...          ← Cyan: Application logs
--- PASS: TestWaitlistService (0.73s)                  ← Green: Results
```

---

## 🎯 When to Use Each Mode

### Use **Quiet Mode** when:
- ✅ Running in CI/CD pipelines
- ✅ Quick sanity checks
- ✅ You only care about pass/fail
- ✅ Reviewing test results in logs
- ✅ Running tests frequently

### Use **Normal Mode** when:
- ✅ Daily development
- ✅ Debugging specific test failures
- ✅ Understanding test flow
- ✅ Reviewing test coverage
- ✅ Most development scenarios

### Use **Verbose Mode** when:
- ✅ Deep debugging test infrastructure
- ✅ Investigating database issues
- ✅ Understanding test framework behavior
- ✅ Tracking down intermittent failures
- ✅ Contributing to test framework

---

## 🔧 Customization

### Environment Variables

```bash
# Quiet mode
QUIET=1 make test-backend

# Verbose mode
VERBOSE=1 make test-backend

# Combine with other flags
VERBOSE=1 make test-backend 2>&1 | tee test-output.log
```

### Custom Filtering

```bash
# Show only failures
make test-backend 2>&1 | grep -E "(FAIL|Error)"

# Show only passing tests
make test-backend 2>&1 | grep -E "(PASS|✓)"

# Count test results
make test-backend 2>&1 | grep -E "^(✓|✗)" | wc -l
```

---

## 📊 Test Statistics

### Current Test Coverage

| Handler | Tests | Status | Pass Rate |
|---------|-------|--------|-----------|
| Post | 10 | ✅ | 100% |
| Settings | 5 | ✅ | 100% |
| Notifications | 7 | ✅ | 88% |
| Report | 6 | ✅ | 86% |
| Waitlist | 5 | ✅ | 100% |
| Connection | 19/26 | ⚠️ | 73% |
| Auth | - | ❌ | 0% |
| Spaces | 1 | ❌ | 0% |

**Overall:** 45/52 tests passing (87%)

---

## 🐛 Troubleshooting

### Tests Running Slowly?
```bash
# Use quiet mode for faster feedback
make test-backend-quiet

# Run specific package
cd backend && go test ./internal/handlers/post
```

### Can't See Error Details?
```bash
# Use verbose mode
make test-backend-verbose

# Or pipe to less for scrolling
make test-backend | less -R
```

### Colors Not Showing?
```bash
# Colors should work in most terminals
# If not, check TERM environment variable
echo $TERM

# Force color output
make test-backend 2>&1 | cat -v
```

### Need to Save Output?
```bash
# Save with colors (for viewing later)
make test-backend 2>&1 | tee test-results.log

# Save without colors (for parsing)
make test-backend 2>&1 | sed 's/\x1b\[[0-9;]*m//g' > test-results.txt
```

---

## 📚 Additional Resources

- **Test Implementation Summary**: See `TESTING_IMPLEMENTATION_SUMMARY.md`
- **Writing New Tests**: See test files in `backend/internal/handlers/*/service_test.go`
- **Test Framework**: See `backend/internal/testing/`

---

*Last Updated: January 26, 2026*
