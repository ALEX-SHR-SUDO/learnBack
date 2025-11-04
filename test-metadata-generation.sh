#!/bin/bash

# Test script for the new /api/generate-metadata endpoint
# This script demonstrates how to use the endpoint to create properly formatted metadata

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
TEST_IMAGE="${TEST_IMAGE:-test-logo.png}"

echo "=============================================="
echo "Testing Metadata Generation Endpoint"
echo "=============================================="
echo ""
echo "API URL: $API_URL"
echo "Test Image: $TEST_IMAGE"
echo ""

# Check if test image exists
if [ ! -f "$TEST_IMAGE" ]; then
    echo "⚠️  Test image not found: $TEST_IMAGE"
    echo "Creating a simple test image..."
    
    # Create a simple test image using ImageMagick (if available)
    if command -v convert &> /dev/null; then
        convert -size 200x200 xc:blue -fill white -gravity center \
                -pointsize 40 -annotate +0+0 'TEST' "$TEST_IMAGE"
        echo "✅ Test image created: $TEST_IMAGE"
    else
        echo "❌ ImageMagick not available. Please provide a test image as: $TEST_IMAGE"
        echo "   Or set TEST_IMAGE environment variable to point to an existing image."
        exit 1
    fi
fi

echo ""
echo "Step 1: Generating metadata..."
echo "-------------------------------------------"

# Call the generate-metadata endpoint
RESPONSE=$(curl -s -X POST "$API_URL/api/generate-metadata" \
  -F "file=@$TEST_IMAGE" \
  -F "name=Test Token" \
  -F "symbol=TEST" \
  -F "description=This is a test token created to verify the metadata generation endpoint")

echo "$RESPONSE" | jq .

# Extract metadata URI
METADATA_URI=$(echo "$RESPONSE" | jq -r '.metadataUri')
IMAGE_URI=$(echo "$RESPONSE" | jq -r '.imageUri')

if [ "$METADATA_URI" = "null" ] || [ -z "$METADATA_URI" ]; then
    echo "❌ Failed to generate metadata. Response:"
    echo "$RESPONSE"
    exit 1
fi

echo ""
echo "✅ Metadata generated successfully!"
echo "   Metadata URI: $METADATA_URI"
echo "   Image URI: $IMAGE_URI"

echo ""
echo "Step 2: Verifying metadata format..."
echo "-------------------------------------------"

# Fetch and display the metadata JSON
METADATA_JSON=$(curl -s "$METADATA_URI")
echo "$METADATA_JSON" | jq .

# Validate required fields
NAME=$(echo "$METADATA_JSON" | jq -r '.name')
SYMBOL=$(echo "$METADATA_JSON" | jq -r '.symbol')
IMAGE=$(echo "$METADATA_JSON" | jq -r '.image')
PROPERTIES=$(echo "$METADATA_JSON" | jq -r '.properties')

echo ""
echo "Validation:"
if [ "$NAME" != "null" ] && [ "$NAME" != "" ]; then
    echo "✅ name: $NAME"
else
    echo "❌ name is missing"
fi

if [ "$SYMBOL" != "null" ] && [ "$SYMBOL" != "" ]; then
    echo "✅ symbol: $SYMBOL"
else
    echo "❌ symbol is missing"
fi

if [ "$IMAGE" != "null" ] && [ "$IMAGE" != "" ]; then
    echo "✅ image: $IMAGE"
else
    echo "❌ image is missing"
fi

if [ "$PROPERTIES" != "null" ] && [ "$PROPERTIES" != "" ]; then
    echo "✅ properties: present"
    FILES_COUNT=$(echo "$METADATA_JSON" | jq -r '.properties.files | length')
    echo "   - files array length: $FILES_COUNT"
    CATEGORY=$(echo "$METADATA_JSON" | jq -r '.properties.category')
    echo "   - category: $CATEGORY"
else
    echo "❌ properties is missing"
fi

echo ""
echo "Step 3: Next steps for token creation"
echo "-------------------------------------------"
echo "Use this metadata URI to create your token:"
echo ""
echo "curl -X POST $API_URL/api/create-token \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"name\": \"Test Token\","
echo "    \"symbol\": \"TEST\","
echo "    \"uri\": \"$METADATA_URI\","
echo "    \"supply\": \"1000000\","
echo "    \"decimals\": \"9\""
echo "  }'"
echo ""
echo "=============================================="
echo "✅ Test completed successfully!"
echo "=============================================="
