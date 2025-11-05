#!/bin/bash

# Test script for metadata flow tracking system
# Demonstrates how to use session IDs to track metadata through the entire flow

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
TEST_IMAGE="${TEST_IMAGE:-test-logo.png}"

echo "=============================================="
echo "Metadata Flow Tracking Test"
echo "=============================================="
echo ""
echo "API URL: $API_URL"
echo "Test Image: $TEST_IMAGE"
echo ""

# Check if test image exists
if [ ! -f "$TEST_IMAGE" ]; then
    echo "⚠️  Test image not found: $TEST_IMAGE"
    echo "Creating a simple test image..."
    
    if command -v convert &> /dev/null; then
        convert -size 200x200 xc:blue -fill white -gravity center \
                -pointsize 40 -annotate +0+0 'FLOW' "$TEST_IMAGE"
        echo "✅ Test image created: $TEST_IMAGE"
    else
        echo "❌ ImageMagick not available. Please provide a test image."
        exit 1
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Generate Metadata with Tracking"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

METADATA_RESPONSE=$(curl -s -X POST "$API_URL/api/generate-metadata" \
  -F "file=@$TEST_IMAGE" \
  -F "name=Flow Tracked Token" \
  -F "symbol=FLOW" \
  -F "description=Token with full metadata flow tracking")

echo "Response:"
echo "$METADATA_RESPONSE" | jq .

# Extract values
METADATA_URI=$(echo "$METADATA_RESPONSE" | jq -r '.metadataUri')
IMAGE_URI=$(echo "$METADATA_RESPONSE" | jq -r '.imageUri')
SESSION_ID=$(echo "$METADATA_RESPONSE" | jq -r '.sessionId')

if [ "$METADATA_URI" = "null" ] || [ -z "$METADATA_URI" ]; then
    echo "❌ Failed to generate metadata"
    exit 1
fi

echo ""
echo "✅ Metadata generated successfully!"
echo "   Metadata URI: $METADATA_URI"
echo "   Image URI: $IMAGE_URI"
echo "   📊 Session ID: $SESSION_ID"
echo ""

# Verify metadata accessibility
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Verify Metadata Accessibility"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

METADATA_JSON=$(curl -s "$METADATA_URI")
echo "Metadata JSON:"
echo "$METADATA_JSON" | jq .

# Validate structure
NAME=$(echo "$METADATA_JSON" | jq -r '.name')
SYMBOL=$(echo "$METADATA_JSON" | jq -r '.symbol')
IMAGE=$(echo "$METADATA_JSON" | jq -r '.image')
CATEGORY=$(echo "$METADATA_JSON" | jq -r '.properties.category')

echo ""
echo "Validation:"
echo "  ✅ name: $NAME"
echo "  ✅ symbol: $SYMBOL"
echo "  ✅ image: $IMAGE"
echo "  ✅ category: $CATEGORY"

if [ "$CATEGORY" != "fungible" ]; then
    echo "  ⚠️  WARNING: category should be 'fungible' for tokens"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Create Token with Session ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Using session ID: $SESSION_ID"
echo "This links the token creation to the metadata generation"
echo ""

TOKEN_RESPONSE=$(curl -s -X POST "$API_URL/api/create-token" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Flow Tracked Token\",
    \"symbol\": \"FLOW\",
    \"uri\": \"$METADATA_URI\",
    \"supply\": \"1000000\",
    \"decimals\": \"9\",
    \"sessionId\": \"$SESSION_ID\"
  }")

echo "Response:"
echo "$TOKEN_RESPONSE" | jq .

# Extract token details
MINT_ADDRESS=$(echo "$TOKEN_RESPONSE" | jq -r '.mintAddress')
TX_SIGNATURE=$(echo "$TOKEN_RESPONSE" | jq -r '.transactionSignature')
SOLSCAN_TOKEN_LINK=$(echo "$TOKEN_RESPONSE" | jq -r '.solscanTokenLink')
SOLSCAN_TX_LINK=$(echo "$TOKEN_RESPONSE" | jq -r '.solscanTxLink')

if [ "$MINT_ADDRESS" = "null" ] || [ -z "$MINT_ADDRESS" ]; then
    echo "❌ Failed to create token"
    echo "Response was:"
    echo "$TOKEN_RESPONSE" | jq .
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: Flow Tracking Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Extract and display flow summary
FLOW_SUMMARY=$(echo "$TOKEN_RESPONSE" | jq -r '.metadataFlowSummary')

if [ "$FLOW_SUMMARY" != "null" ] && [ -n "$FLOW_SUMMARY" ]; then
    echo "$FLOW_SUMMARY"
else
    echo "⚠️  No flow summary available"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TEST COMPLETED SUCCESSFULLY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Token Details:"
echo "  Mint Address: $MINT_ADDRESS"
echo "  Transaction: $TX_SIGNATURE"
echo "  Session ID: $SESSION_ID"
echo ""
echo "View on Solscan:"
echo "  Token: $SOLSCAN_TOKEN_LINK"
echo "  Transaction: $SOLSCAN_TX_LINK"
echo ""
echo "Next Steps:"
echo "  1. Wait 2-5 minutes for Solscan to index the transaction"
echo "  2. Open the Solscan link above"
echo "  3. Verify that name, symbol, and logo are displayed"
echo "  4. Check the flow summary above for any warnings"
echo ""
echo "=============================================="
