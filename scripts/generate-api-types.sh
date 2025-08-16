#!/bin/bash

# Generate API Types Script
# This script generates the OpenAPI spec from the backend and updates frontend types

set -e  # Exit on any error

echo "🚀 Generating OpenAPI spec and frontend types..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}==> $1${NC}"
}

# Check if we're in a Nix development environment
if [[ -n "$DEVENV_ROOT" ]]; then
    print_step "Detected Nix development environment, using optimized Nix script..."
    generate-api-types
    exit $?
fi

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Change to project root (script should be run from project root)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

print_step "Step 1: Building backend..."
cd backend
if ! go build -o /tmp/kindred-openapi ./cmd/server; then
    print_error "Failed to build backend"
    exit 1
fi
print_success "Backend built successfully"

print_step "Step 2: Generating OpenAPI spec..."
if ! /tmp/kindred-openapi --generate-openapi --openapi-output="../frontend/api/api-spec.yaml"; then
    print_error "Failed to generate OpenAPI spec"
    exit 1
fi
print_success "OpenAPI spec generated: frontend/api/api-spec.yaml"

print_step "Step 3: Generating TypeScript types..."
cd ../frontend
if ! bun run generate-types; then
    print_warning "bun run generate-types failed, trying alternative..."
    if command -v openapi-typescript >/dev/null 2>&1; then
        print_step "Using openapi-typescript directly with bun..."
        bunx openapi-typescript api/api-spec.yaml -o api/generated/types.ts
        print_success "Types generated using openapi-typescript"
    else
        print_error "Could not generate TypeScript types. Please install openapi-typescript or check your bun scripts."
        exit 1
    fi
else
    print_success "TypeScript types generated successfully"
fi

print_step "Step 4: Cleaning up..."
rm -f /tmp/kindred-openapi
print_success "Cleanup completed"

echo ""
print_success "🎉 API types generation completed successfully!"
echo ""
print_step "Generated files:"
echo "  • frontend/api/api-spec.yaml (OpenAPI specification)"
echo "  • frontend/api/generated/types.ts (TypeScript types)"
echo ""
print_step "Usage:"
echo "  Run this script whenever you update backend API endpoints"
echo "  Example: ./scripts/generate-api-types.sh"
