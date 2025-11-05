# Metadata Flow Tracking - Usage Guide

## Overview

The metadata flow tracking system provides detailed logging and debugging capabilities to help diagnose issues where metadata appears on Solana Explorer but not on Solscan.

## Features

- **Automatic Flow Tracking**: Tracks every step from metadata generation to on-chain token creation
- **Session-based Tracking**: Links metadata generation with token creation using session IDs
- **Detailed Logging**: Provides timestamps, status, and detailed information for each step
- **Troubleshooting Reports**: Generates comprehensive reports with recommendations
- **Validation Checks**: Automatically validates metadata structure and URI accessibility

## How It Works

### Complete Flow with Tracking

```
1. Client calls /api/generate-metadata
   ↓
   Backend starts tracking session (auto-generated session ID)
   ↓
   Tracks: Image upload → JSON creation → IPFS upload
   ↓
   Returns: metadataUri, imageUri, sessionId

2. Client calls /api/create-token with sessionId (optional)
   ↓
   Backend continues or starts new tracking session
   ↓
   Tracks: URI validation → On-chain creation → Metadata account
   ↓
   Returns: mintAddress, transaction links, flow summary
```

## API Changes

### POST /api/generate-metadata

**New Response Field:**
```json
{
  "success": true,
  "metadataUri": "https://gateway.pinata.cloud/ipfs/Qm...",
  "imageUri": "https://gateway.pinata.cloud/ipfs/Qm...",
  "sessionId": "metadata-flow-1699876543210-abc123",  // ← NEW
  "note": "Use the metadataUri when creating your token..."
}
```

### POST /api/create-token

**New Request Field (Optional):**
```json
{
  "name": "Test Token",
  "symbol": "TEST",
  "uri": "https://gateway.pinata.cloud/ipfs/Qm...",
  "supply": "1000000",
  "decimals": "9",
  "sessionId": "metadata-flow-1699876543210-abc123"  // ← NEW (optional)
}
```

**New Response Fields:**
```json
{
  "message": "Token and metadata successfully created.",
  "mintAddress": "E6BSP6vd...",
  "transactionSignature": "5J8...",
  "solscanTokenLink": "https://solscan.io/token/...",
  "sessionId": "metadata-flow-1699876543210-abc123",  // ← NEW
  "metadataFlowSummary": "... detailed report ..."     // ← NEW
}
```

## Usage Examples

### Example 1: Complete Flow with Tracking

```bash
# Step 1: Generate metadata (with tracking)
RESPONSE=$(curl -s -X POST http://localhost:3000/api/generate-metadata \
  -F "file=@logo.png" \
  -F "name=Tracked Token" \
  -F "symbol=TRACK" \
  -F "description=Token with full tracking")

echo "$RESPONSE" | jq .

# Extract both metadataUri and sessionId
METADATA_URI=$(echo "$RESPONSE" | jq -r '.metadataUri')
SESSION_ID=$(echo "$RESPONSE" | jq -r '.sessionId')

echo "Session ID: $SESSION_ID"
echo "Metadata URI: $METADATA_URI"

# Step 2: Create token with same session ID
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Tracked Token\",
    \"symbol\": \"TRACK\",
    \"uri\": \"$METADATA_URI\",
    \"supply\": \"1000000\",
    \"decimals\": \"9\",
    \"sessionId\": \"$SESSION_ID\"
  }" | jq .
```

### Example 2: JavaScript/TypeScript

```typescript
// Step 1: Generate metadata with tracking
const formData = new FormData();
formData.append('file', logoFile);
formData.append('name', 'Tracked Token');
formData.append('symbol', 'TRACK');
formData.append('description', 'Token with full tracking');

const metadataResponse = await fetch('http://localhost:3000/api/generate-metadata', {
  method: 'POST',
  body: formData
});

const metadataData = await metadataResponse.json();
console.log('Metadata generated:', metadataData);

// Extract session ID for linking
const { metadataUri, sessionId } = metadataData;

// Step 2: Create token with session ID
const createResponse = await fetch('http://localhost:3000/api/create-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Tracked Token',
    symbol: 'TRACK',
    uri: metadataUri,
    supply: '1000000',
    decimals: '9',
    sessionId: sessionId  // Link to metadata generation
  })
});

const tokenData = await createResponse.json();
console.log('Token created:', tokenData);

// View the flow summary
console.log('Flow Summary:\n', tokenData.metadataFlowSummary);
```

### Example 3: Without Session ID (Still Tracked)

If you don't provide a session ID, the system will create a new one automatically:

```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token",
    "symbol": "TEST",
    "uri": "https://gateway.pinata.cloud/ipfs/Qm...",
    "supply": "1000000",
    "decimals": "9"
  }'
```

The response will still include tracking information:
```json
{
  "mintAddress": "...",
  "sessionId": "metadata-flow-auto-generated",
  "metadataFlowSummary": "... tracking details ..."
}
```

## Console Output

### During Metadata Generation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 METADATA FLOW TRACKING STARTED
Session ID: metadata-flow-1699876543210-abc123
Start Time: 2024-11-05T15:30:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ [+0ms] Metadata Generation Request Received
   Details: {
     "fileName": "logo.png",
     "fileSize": "15234 bytes",
     "mimeType": "image/png",
     "tokenName": "Test Token",
     "tokenSymbol": "TEST"
   }

✅ [+523ms] Image Uploaded to IPFS
   Details: {
     "ipfsHash": "QmXXX...",
     "imageUri": "https://gateway.pinata.cloud/ipfs/QmXXX...",
     "gateway": "gateway.pinata.cloud"
   }

✅ [+645ms] Metadata JSON Created
   Details: {
     "structure": {
       "name": "Test Token",
       "symbol": "TEST",
       "hasImage": true,
       "hasProperties": true,
       "category": "fungible",
       "filesCount": 1
     }
   }

✅ [+1234ms] Metadata JSON Uploaded to IPFS
   Details: {
     "ipfsHash": "QmYYY...",
     "metadataUri": "https://gateway.pinata.cloud/ipfs/QmYYY..."
   }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 METADATA FLOW TRACKING COMPLETED
Session ID: metadata-flow-1699876543210-abc123
Duration: 1234ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary:
  Total Steps: 4
  ✅ Success: 4
  ⚠️  Warnings: 0
  ❌ Errors: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### During Token Creation

```
✅ [+0ms] Token Creation Request Received
   Details: {
     "name": "Test Token",
     "symbol": "TEST",
     "uri": "https://gateway.pinata.cloud/ipfs/QmYYY...",
     "supply": "1000000",
     "decimals": "9"
   }

✅ [+150ms] Validating Metadata URI
✅ [+890ms] Metadata URI Accessible
✅ [+920ms] Metadata Structure Valid
✅ [+1100ms] Image URI Accessible

✅ [+1250ms] Starting On-Chain Token Creation
   Details: {
     "mintAddress": "E6BSP6vd...",
     "tokenOwner": "3BhAs81...",
     "payer": "3BhAs81..."
   }

✅ [+5678ms] On-Chain Token Created
   Details: {
     "mintAddress": "E6BSP6vd...",
     "transactionSignature": "5J8..."
   }

✅ [+5690ms] Metadata Account Created On-Chain
   Details: {
     "updateAuthority": "3BhAs81...",
     "tokenStandard": "Fungible",
     "isMutable": true
   }
```

## Troubleshooting Report Format

At the end of token creation, a detailed troubleshooting report is generated:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 METADATA FLOW TROUBLESHOOTING REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Session ID: metadata-flow-1699876543210-abc123
Duration: 6789ms

Summary:
  Total Steps: 12
  ✅ Success: 11
  ⚠️  Warnings: 1
  ❌ Errors: 0

⚠️  WARNINGS:
  - Image URI Not Accessible
    Details: {
      "imageUri": "https://gateway.pinata.cloud/ipfs/QmXXX...",
      "error": "Timeout: 5000ms exceeded",
      "impact": "Token logo will not display on Solscan"
    }

RECOMMENDATIONS:
  1. Address warnings to ensure Solscan compatibility
  2. Check IPFS gateway status
  3. Verify image URI is accessible from different locations
  4. Wait 2-5 minutes for Solscan indexing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Common Scenarios

### Scenario 1: Everything Works

```
Summary:
  Total Steps: 10
  ✅ Success: 10
  ⚠️  Warnings: 0
  ❌ Errors: 0

RECOMMENDATIONS:
  ✅ All checks passed!
  ✅ Metadata should be visible on Solscan within 2-5 minutes
```

### Scenario 2: Metadata URI Not Accessible

```
❌ ERRORS DETECTED:
  - Metadata URI Not Accessible
    Details: {
      "uri": "https://gateway.pinata.cloud/ipfs/QmXXX...",
      "error": "Request failed with status code 404",
      "impact": "Token will not display properly on Solscan"
    }

RECOMMENDATIONS:
  1. Fix all errors before proceeding
  2. Verify metadata URI is accessible
  3. Use /api/generate-metadata endpoint for guaranteed format
```

### Scenario 3: Wrong Category

```
⚠️  WARNINGS:
  - Metadata Validation Warnings
    Details: {
      "warnings": [
        "properties.category is \"image\" - should be \"fungible\" for tokens"
      ]
    }

RECOMMENDATIONS:
  1. Use /api/generate-metadata endpoint for guaranteed format
  2. Verify metadata JSON structure matches Metaplex standard
```

## Benefits

1. **Instant Feedback**: Know immediately if there are issues with metadata structure or accessibility
2. **Linked Tracking**: Connect metadata generation with token creation using session IDs
3. **Detailed Diagnostics**: See exactly which step failed and why
4. **Proactive Warnings**: Get warnings about potential issues before they cause problems on Solscan
5. **Better Support**: Share the flow summary when requesting help

## Best Practices

1. **Always save the session ID** from metadata generation to use in token creation
2. **Check the flow summary** after token creation to verify everything is correct
3. **Address warnings immediately** before the token is deployed
4. **Test metadata URI accessibility** by visiting it in a browser before creating the token
5. **Wait 2-5 minutes** after token creation before checking Solscan (indexing delay)

## Integration Tips

### Frontend Integration

```typescript
class TokenCreationService {
  async createTokenWithTracking(
    logoFile: File,
    name: string,
    symbol: string,
    description: string,
    supply: string,
    decimals: string
  ) {
    // Step 1: Generate metadata
    const metadataResult = await this.generateMetadata(
      logoFile, name, symbol, description
    );
    
    // Save session ID for tracking
    const sessionId = metadataResult.sessionId;
    console.log('Metadata generated with session:', sessionId);
    
    // Step 2: Create token with session ID
    const tokenResult = await this.createToken({
      name,
      symbol,
      uri: metadataResult.metadataUri,
      supply,
      decimals,
      sessionId  // Link to metadata generation
    });
    
    // Step 3: Check flow summary for issues
    if (tokenResult.metadataFlowSummary) {
      console.log('Flow Summary:', tokenResult.metadataFlowSummary);
      
      // Parse and display any warnings
      if (tokenResult.warnings) {
        this.displayWarnings(tokenResult.warnings);
      }
    }
    
    return tokenResult;
  }
}
```

### Error Handling

```typescript
try {
  const result = await tokenService.createTokenWithTracking(...);
  
  // Check for warnings in flow summary
  if (result.warnings && result.warnings.length > 0) {
    console.warn('Token created with warnings:', result.warnings);
    // Display to user but don't block
  }
  
  // Success
  console.log('Token created:', result.mintAddress);
  
} catch (error) {
  // Check if error includes flow information
  if (error.response?.data?.metadataFlowSummary) {
    console.error('Flow failed:', error.response.data.metadataFlowSummary);
    // Parse and display specific error steps
  } else {
    console.error('Token creation failed:', error);
  }
}
```

## Debugging

If you see issues on Solscan after token creation:

1. **Check the flow summary** in the API response
2. **Look for warnings** about URI accessibility or metadata structure
3. **Verify the metadata URI** by visiting it in a browser
4. **Check the image URI** by visiting it in a browser
5. **Wait 2-5 minutes** for Solscan to index
6. **Review the console logs** on the backend for detailed step information

## API Response Size

Note: The `metadataFlowSummary` field can be large (1-3 KB). If this is a concern:

1. **During development**: Keep it for debugging
2. **In production**: Consider removing it or making it optional with a query parameter
3. **Alternative**: Provide a separate endpoint to fetch flow details by session ID

## Future Enhancements

Potential improvements to the tracking system:

- [ ] Store flow sessions in database for later retrieval
- [ ] Add API endpoint to query flow status by session ID
- [ ] WebSocket support for real-time flow updates
- [ ] Export flow data as JSON for external analysis
- [ ] Integration with monitoring tools (Datadog, New Relic, etc.)
