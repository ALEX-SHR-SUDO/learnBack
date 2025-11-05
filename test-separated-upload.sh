#!/bin/bash
# Test script for separated metadata upload endpoints

set -e

BASE_URL="http://localhost:3001"
TEST_IMAGE="/tmp/test_decoded.png"

echo "=== Testing Separated Metadata Upload Flow ==="
echo ""

# Check if test image exists
if [ ! -f "$TEST_IMAGE" ]; then
    echo "Creating test image..."
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$TEST_IMAGE"
fi

echo "1. Testing health endpoint..."
curl -s "$BASE_URL/" | jq '.'
echo ""

echo "2. Testing Step 1: Upload logo only..."
LOGO_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload-logo-only" \
  -F "file=@$TEST_IMAGE")

echo "$LOGO_RESPONSE" | jq '.'
echo ""

# Extract imageUri and sessionId
IMAGE_URI=$(echo "$LOGO_RESPONSE" | jq -r '.imageUri')
SESSION_ID=$(echo "$LOGO_RESPONSE" | jq -r '.sessionId')

if [ "$IMAGE_URI" == "null" ] || [ -z "$IMAGE_URI" ]; then
    echo "ERROR: Failed to upload logo"
    echo "Response: $LOGO_RESPONSE"
    exit 1
fi

echo "✅ Logo uploaded successfully!"
echo "   Image URI: $IMAGE_URI"
echo "   Session ID: $SESSION_ID"
echo ""

echo "3. Testing Step 2: Generate metadata only..."
METADATA_RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-metadata-only" \
  -H "Content-Type: application/json" \
  -d "{
    \"imageUri\": \"$IMAGE_URI\",
    \"name\": \"Test Token\",
    \"symbol\": \"TEST\",
    \"description\": \"A test token for separated upload flow\",
    \"sessionId\": \"$SESSION_ID\",
    \"imageMimeType\": \"image/png\"
  }")

echo "$METADATA_RESPONSE" | jq '.'
echo ""

# Extract metadataUri
METADATA_URI=$(echo "$METADATA_RESPONSE" | jq -r '.metadataUri')

if [ "$METADATA_URI" == "null" ] || [ -z "$METADATA_URI" ]; then
    echo "ERROR: Failed to generate metadata"
    echo "Response: $METADATA_RESPONSE"
    exit 1
fi

echo "✅ Metadata generated successfully!"
echo "   Metadata URI: $METADATA_URI"
echo ""

echo "4. Verifying metadata JSON..."
curl -s "$METADATA_URI" | jq '.'
echo ""

echo "=== Test Complete ==="
echo ""
echo "Summary:"
echo "  - Logo URI: $IMAGE_URI"
echo "  - Metadata URI: $METADATA_URI"
echo ""
echo "You can now use the metadata URI to create a token:"
echo "  curl -X POST $BASE_URL/api/create-token \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{"
echo "      \"name\": \"Test Token\","
echo "      \"symbol\": \"TEST\","
echo "      \"uri\": \"$METADATA_URI\","
echo "      \"supply\": \"1000000\","
echo "      \"decimals\": \"9\""
echo "    }'"
