#!/bin/bash
# Script to create a test token with metadata on Solana Devnet
# This demonstrates the fixed implementation

set -e

echo "================================================"
echo "Token Creation Test - Metaplex Metadata Fix"
echo "================================================"
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
SERVICE_WALLET="${SERVICE_WALLET:-ESnpcCfEzTu27zimt7buatKXU3ogihyqVozfWJKgv2Jx}"

echo "Configuration:"
echo "  API URL: $API_URL"
echo "  Service Wallet: $SERVICE_WALLET"
echo ""

# Step 0: Check if server is running
echo "Step 0: Checking if server is running..."
if ! curl -sf "$API_URL/" > /dev/null; then
    echo "❌ Server is not running at $API_URL"
    echo "   Please start the server first:"
    echo "   npm run build && npm start"
    exit 1
fi
echo "✅ Server is running"
echo ""

# Step 1: Check service wallet balance
echo "Step 1: Checking service wallet balance..."
BALANCE_RESPONSE=$(curl -sf "$API_URL/api/balance")
BALANCE=$(echo "$BALANCE_RESPONSE" | grep -o '"sol":[0-9.]*' | cut -d':' -f2)
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.01" | bc -l 2>/dev/null || echo "1") )); then
    echo "⚠️  Low balance! Please airdrop SOL:"
    echo "   solana airdrop 1 $SERVICE_WALLET --url devnet"
    echo "   Or visit: https://faucet.solana.com/"
    echo ""
    read -p "Press Enter after funding the wallet, or Ctrl+C to exit..."
fi
echo ""

# Step 2: Create logo SVG
echo "Step 2: Creating token logo..."
cat > /tmp/token-logo.svg << 'EOF'
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#grad)" rx="20"/>
  <text x="100" y="120" font-size="80" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">TM</text>
</svg>
EOF
echo "✅ Logo created: /tmp/token-logo.svg"
echo ""

# Step 3: Upload logo to IPFS
echo "Step 3: Uploading logo to IPFS..."
LOGO_RESPONSE=$(curl -sf "$API_URL/api/upload-logo" -F "file=@/tmp/token-logo.svg")
LOGO_URL=$(echo "$LOGO_RESPONSE" | grep -o '"ipfsUrl":"[^"]*"' | cut -d'"' -f4)

if [ -z "$LOGO_URL" ]; then
    echo "❌ Failed to upload logo to IPFS"
    echo "Response: $LOGO_RESPONSE"
    exit 1
fi

echo "✅ Logo uploaded to IPFS: $LOGO_URL"
echo ""

# Step 4: Create metadata JSON
echo "Step 4: Creating metadata JSON..."
cat > /tmp/token-metadata.json << EOF
{
  "name": "Test Metadata Token",
  "symbol": "TMT",
  "description": "A test token created to verify metadata display on Solscan after implementing the Metaplex fix",
  "image": "$LOGO_URL",
  "attributes": [
    {
      "trait_type": "Purpose",
      "value": "Testing"
    },
    {
      "trait_type": "Network",
      "value": "Devnet"
    }
  ],
  "properties": {
    "files": [
      {
        "uri": "$LOGO_URL",
        "type": "image/svg+xml"
      }
    ],
    "category": "image",
    "creators": []
  }
}
EOF
echo "✅ Metadata JSON created"
echo ""

# Step 5: Upload metadata to IPFS
echo "Step 5: Uploading metadata to IPFS..."
METADATA_RESPONSE=$(curl -sf "$API_URL/api/upload-logo" -F "file=@/tmp/token-metadata.json")
METADATA_URL=$(echo "$METADATA_RESPONSE" | grep -o '"ipfsUrl":"[^"]*"' | cut -d'"' -f4)

if [ -z "$METADATA_URL" ]; then
    echo "❌ Failed to upload metadata to IPFS"
    echo "Response: $METADATA_RESPONSE"
    exit 1
fi

echo "✅ Metadata uploaded to IPFS: $METADATA_URL"
echo ""

# Step 6: Create token with metadata
echo "Step 6: Creating token with metadata on Solana..."
echo "This may take 30-60 seconds..."

TOKEN_RESPONSE=$(curl -sf "$API_URL/api/create-token" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Metadata Token\",
    \"symbol\": \"TMT\",
    \"uri\": \"$METADATA_URL\",
    \"supply\": \"1000000\",
    \"decimals\": \"9\"
  }")

if [ $? -ne 0 ]; then
    echo "❌ Failed to create token"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

# Extract token information
MINT_ADDRESS=$(echo "$TOKEN_RESPONSE" | grep -o '"mintAddress":"[^"]*"' | cut -d'"' -f4)
TX_SIGNATURE=$(echo "$TOKEN_RESPONSE" | grep -o '"transactionSignature":"[^"]*"' | cut -d'"' -f4)
SOLSCAN_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"solscanTokenLink":"[^"]*"' | cut -d'"' -f4)
SOLSCAN_TX=$(echo "$TOKEN_RESPONSE" | grep -o '"solscanTxLink":"[^"]*"' | cut -d'"' -f4)

if [ -z "$MINT_ADDRESS" ]; then
    echo "❌ Token creation failed"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo ""
echo "================================================"
echo "✅ TOKEN CREATED SUCCESSFULLY!"
echo "================================================"
echo ""
echo "Token Details:"
echo "  Name: Test Metadata Token"
echo "  Symbol: TMT"
echo "  Decimals: 9"
echo "  Supply: 1,000,000 TMT"
echo ""
echo "Addresses:"
echo "  Mint Address: $MINT_ADDRESS"
echo "  Service Wallet: $SERVICE_WALLET"
echo ""
echo "Transaction:"
echo "  Signature: $TX_SIGNATURE"
echo ""
echo "View on Explorers:"
echo "  🔍 Solscan (Token): $SOLSCAN_TOKEN"
echo "  🔍 Solscan (TX): $SOLSCAN_TX"
echo ""
echo "Metadata:"
echo "  Logo: $LOGO_URL"
echo "  Metadata JSON: $METADATA_URL"
echo ""
echo "================================================"
echo "Verification Steps:"
echo "================================================"
echo "1. Wait 1-2 minutes for Solscan to index the transaction"
echo "2. Open the Solscan token link above"
echo "3. Verify the following are displayed:"
echo "   ✓ Token name: Test Metadata Token"
echo "   ✓ Token symbol: TMT"
echo "   ✓ Token logo (purple gradient with 'TM')"
echo "   ✓ Description and attributes"
echo "   ✓ Supply: 1,000,000"
echo "   ✓ Decimals: 9"
echo ""
echo "If all metadata is visible, the fix is successful! 🎉"
echo "================================================"
echo ""

# Save results to file
cat > /tmp/token-creation-results.txt << EOF
Token Creation Results
======================
Created: $(date)
Mint Address: $MINT_ADDRESS
Transaction: $TX_SIGNATURE
Solscan Token: $SOLSCAN_TOKEN
Solscan TX: $SOLSCAN_TX
Logo URL: $LOGO_URL
Metadata URL: $METADATA_URL

Full Response:
$TOKEN_RESPONSE
EOF

echo "Results saved to: /tmp/token-creation-results.txt"
