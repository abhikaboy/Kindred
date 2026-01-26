#!/bin/bash
# Pre-commit hook for running tests before commit
# Install: make install-hooks

set -e

echo "🔍 Running pre-commit checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=0

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: Must be run from project root${NC}"
    exit 1
fi

# 1. Check Go formatting
echo -e "\n${YELLOW}📝 Checking Go formatting...${NC}"
cd backend
UNFORMATTED=$(gofmt -l . 2>&1 | grep -v "vendor/" || true)
if [ -n "$UNFORMATTED" ]; then
    echo -e "${RED}❌ The following files need formatting:${NC}"
    echo "$UNFORMATTED"
    echo -e "${YELLOW}Run: cd backend && gofmt -w .${NC}"
    FAILED=1
else
    echo -e "${GREEN}✅ Go formatting check passed${NC}"
fi

# 2. Run go vet
echo -e "\n${YELLOW}🔍 Running go vet...${NC}"
if go vet ./... 2>&1 | grep -v "vendor/"; then
    echo -e "${RED}❌ go vet found issues${NC}"
    FAILED=1
else
    echo -e "${GREEN}✅ go vet passed${NC}"
fi

# 3. Run unit tests (short mode - fast tests only)
echo -e "\n${YELLOW}🧪 Running unit tests...${NC}"
if go test -short -timeout 30s ./... > /tmp/test-output.txt 2>&1; then
    echo -e "${GREEN}✅ Unit tests passed${NC}"
    # Show summary
    grep -E "^(ok|PASS|FAIL)" /tmp/test-output.txt || true
else
    echo -e "${RED}❌ Unit tests failed${NC}"
    cat /tmp/test-output.txt
    FAILED=1
fi

# 4. Check for common issues
echo -e "\n${YELLOW}🔍 Checking for common issues...${NC}"

# Check for TODO/FIXME comments in staged files
cd ..
STAGED_GO_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep "\.go$" || true)
if [ -n "$STAGED_GO_FILES" ]; then
    TODOS=$(echo "$STAGED_GO_FILES" | xargs grep -n "TODO\|FIXME" || true)
    if [ -n "$TODOS" ]; then
        echo -e "${YELLOW}⚠️  Found TODO/FIXME comments:${NC}"
        echo "$TODOS"
    fi
fi

# Check for debug statements
DEBUG_STATEMENTS=$(echo "$STAGED_GO_FILES" | xargs grep -n "fmt.Println\|log.Println" || true)
if [ -n "$DEBUG_STATEMENTS" ]; then
    echo -e "${YELLOW}⚠️  Found debug print statements:${NC}"
    echo "$DEBUG_STATEMENTS"
    echo -e "${YELLOW}Consider using structured logging instead${NC}"
fi

# 5. Final result
echo ""
if [ $FAILED -eq 1 ]; then
    echo -e "${RED}❌ Pre-commit checks failed. Please fix the issues above.${NC}"
    echo -e "${YELLOW}To skip these checks (not recommended), use: git commit --no-verify${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
    exit 0
fi
