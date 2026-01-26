#!/bin/bash

# MongoDB Connection Check Script
# Verifies MongoDB is running and accessible for tests

set -e

echo "🔍 Checking MongoDB Setup for Tests..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get MongoDB URI
MONGO_URI="${TEST_MONGO_URI:-${MONGO_URI:-mongodb://localhost:27017}}"

echo "📍 Using MongoDB URI: $MONGO_URI"
echo ""

# Check if mongosh is installed
echo "1️⃣  Checking mongosh installation..."
if command -v mongosh &> /dev/null; then
    echo -e "${GREEN}✓${NC} mongosh is installed"
    MONGOSH_VERSION=$(mongosh --version | head -n 1)
    echo "   Version: $MONGOSH_VERSION"
else
    echo -e "${RED}✗${NC} mongosh is not installed"
    echo "   Install: brew install mongosh"
    exit 1
fi
echo ""

# Check if MongoDB is running
echo "2️⃣  Checking MongoDB connection..."
if mongosh "$MONGO_URI" --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} MongoDB is running and accessible"
else
    echo -e "${RED}✗${NC} Cannot connect to MongoDB"
    echo ""
    echo "   Troubleshooting:"
    echo "   • Start MongoDB: brew services start mongodb-community"
    echo "   • Or use Docker: docker run -d --name mongodb-test -p 27017:27017 mongo:latest"
    echo "   • Check if port 27017 is in use: lsof -i :27017"
    exit 1
fi
echo ""

# Check MongoDB version
echo "3️⃣  Checking MongoDB version..."
MONGO_VERSION=$(mongosh "$MONGO_URI" --eval "db.version()" --quiet 2>/dev/null || echo "unknown")
echo "   MongoDB version: $MONGO_VERSION"
echo ""

# Test database operations
echo "4️⃣  Testing database operations..."
TEST_DB="test_check_$(date +%s)"

# Create test database
if mongosh "$MONGO_URI" --eval "use $TEST_DB; db.test.insertOne({test: true})" --quiet > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Can create databases"
else
    echo -e "${RED}✗${NC} Cannot create databases"
    exit 1
fi

# Drop test database
if mongosh "$MONGO_URI" --eval "use $TEST_DB; db.dropDatabase()" --quiet > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Can drop databases"
else
    echo -e "${RED}✗${NC} Cannot drop databases"
    exit 1
fi
echo ""

# Check for existing test databases
echo "5️⃣  Checking for leftover test databases..."
TEST_DBS=$(mongosh "$MONGO_URI" --eval "db.adminCommand('listDatabases').databases.filter(d => d.name.startsWith('test_')).map(d => d.name)" --quiet 2>/dev/null | grep -v "^$" || echo "[]")

if [ "$TEST_DBS" = "[]" ] || [ -z "$TEST_DBS" ]; then
    echo -e "${GREEN}✓${NC} No leftover test databases"
else
    echo -e "${YELLOW}⚠${NC}  Found leftover test databases:"
    echo "$TEST_DBS" | sed 's/^/   /'
    echo ""
    echo "   Clean up with:"
    echo "   mongosh \"$MONGO_URI\" --eval 'db.adminCommand(\"listDatabases\").databases.filter(d => d.name.startsWith(\"test_\")).forEach(d => db.getSiblingDB(d.name).dropDatabase())'"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ MongoDB is ready for testing!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Run tests with:"
echo "  cd backend && go test ./..."
echo ""
echo "Or use make:"
echo "  make test-backend"
echo ""
