#!/bin/bash

# Simple test script to check if the processing endpoint is working
# Usage: chmod +x test-simple.sh && ./test-simple.sh

BACKEND_URL="http://localhost:8080"
RESOURCE_TYPE="profile"
RESOURCE_ID="507f1f77bcf86cd799439011"
VARIANT="medium"

echo "🚀 Testing image processing endpoint..."
echo "📍 URL: ${BACKEND_URL}/v1/uploads/${RESOURCE_TYPE}/${RESOURCE_ID}/process?variant=${VARIANT}"

# Create a small test image data (1x1 red pixel PNG in base64)
TEST_IMAGE_BASE64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yAAAAABJRU5ErkJggg=="

# Test the endpoint
curl -X POST "${BACKEND_URL}/v1/uploads/${RESOURCE_TYPE}/${RESOURCE_ID}/process?variant=${VARIANT}" \
  -H "Content-Type: application/json" \
  -d "{
    \"image_data\": \"${TEST_IMAGE_BASE64}\",
    \"content_type\": \"image/png\"
  }" \
  --verbose \
  --max-time 30

echo -e "\n\n🔍 Testing legacy endpoint for comparison..."
curl -X GET "${BACKEND_URL}/v1/uploads/${RESOURCE_TYPE}/${RESOURCE_ID}/url?file_type=image/jpeg" \
  --verbose \
  --max-time 30
