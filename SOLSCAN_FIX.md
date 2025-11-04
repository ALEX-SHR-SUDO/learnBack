# Solscan Metadata Display Fix

## Problem
Tokens created through the API were not displaying their name and logo on Solscan and other Solana explorers. This occurred because the metadata JSON uploaded to IPFS didn't follow the complete Metaplex Token Metadata Standard.

## Root Cause
The previous workflow required users to:
1. Manually upload a logo to IPFS
2. Manually create a metadata.json file with the image URL
3. Upload the metadata.json to IPFS
4. Use the metadata URI when creating the token

This manual process often resulted in incomplete or incorrectly formatted metadata that didn't meet Solscan's requirements.

## Solution
A new endpoint `/api/generate-metadata` has been added that automatically:
1. Uploads the logo to IPFS
2. Generates a properly formatted Metaplex-compliant metadata JSON
3. Uploads the metadata JSON to IPFS
4. Returns the metadata URI ready for token creation

### Metaplex Metadata Standard
The generated metadata follows the complete Metaplex standard required by Solscan for fungible SPL tokens:

```json
{
  "name": "Token Name",
  "symbol": "SYMBOL",
  "description": "Token description",
  "image": "https://gateway.pinata.cloud/ipfs/QmImageHash",
  "attributes": [],
  "properties": {
    "files": [
      {
        "uri": "https://gateway.pinata.cloud/ipfs/QmImageHash",
        "type": "image/jpeg"
      }
    ],
    "category": "fungible"
  }
}
```

Key fields that ensure proper display on Solscan:
- **name**: Token name (displayed as title)
- **symbol**: Token symbol
- **image**: Direct URL to the logo image
- **properties.files**: Array of file references with proper MIME types
- **properties.category**: Must be "fungible" for fungible SPL tokens (not "image", which would make it display as an NFT)

## New Workflow

### Step 1: Generate Metadata
Instead of manually creating metadata, use the new endpoint:

```bash
curl -X POST http://localhost:3000/api/generate-metadata \
  -F "file=@/path/to/logo.png" \
  -F "name=My Token" \
  -F "symbol=MTK" \
  -F "description=This is my awesome token"
```

**Response:**
```json
{
  "success": true,
  "message": "Metadata generated and uploaded successfully",
  "metadataUri": "https://gateway.pinata.cloud/ipfs/QmMetadataHash",
  "imageUri": "https://gateway.pinata.cloud/ipfs/QmImageHash",
  "note": "Use the metadataUri when creating your token to ensure proper display on Solscan"
}
```

### Step 2: Create Token with Generated Metadata
Use the `metadataUri` from Step 1:

```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Token",
    "symbol": "MTK",
    "uri": "https://gateway.pinata.cloud/ipfs/QmMetadataHash",
    "supply": "1000000",
    "decimals": "9"
  }'
```

**Important:** The `name` and `symbol` in the create-token request should match what you provided in generate-metadata.

### Step 3: Verify on Solscan
1. Check the response for `solscanTokenLink`
2. Open the link
3. Verify that:
   - ✅ Token name is displayed
   - ✅ Token symbol is displayed
   - ✅ Logo image is displayed
   - ✅ Description is visible
   - ✅ All metadata is correctly formatted

## API Reference

### POST /api/generate-metadata

Generates Metaplex-compliant metadata and uploads it to IPFS.

**Request (multipart/form-data):**
- `file` (required): Logo image file (JPEG, PNG, GIF, or WebP)
- `name` (required): Token name (string)
- `symbol` (required): Token symbol (string)
- `description` (optional): Token description (string, defaults to empty)

**Response:**
```json
{
  "success": true,
  "message": "Metadata generated and uploaded successfully",
  "metadataUri": "https://gateway.pinata.cloud/ipfs/QmMetadataHash",
  "imageUri": "https://gateway.pinata.cloud/ipfs/QmImageHash",
  "note": "Use the metadataUri when creating your token..."
}
```

**Errors:**
- 400: Missing required fields or invalid file type
- 500: IPFS upload failure or Pinata API error

### Supported Image Formats
- image/jpeg
- image/jpg
- image/png
- image/gif
- image/webp

## Complete Example

### Using cURL:
```bash
# Step 1: Generate metadata with logo
curl -X POST http://localhost:3000/api/generate-metadata \
  -F "file=@./my-token-logo.png" \
  -F "name=Awesome Token" \
  -F "symbol=AWE" \
  -F "description=An awesome token for the Solana ecosystem" \
  > metadata-response.json

# Extract metadata URI
METADATA_URI=$(cat metadata-response.json | grep -o '"metadataUri":"[^"]*' | cut -d'"' -f4)

# Step 2: Create token
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Awesome Token\",
    \"symbol\": \"AWE\",
    \"uri\": \"$METADATA_URI\",
    \"supply\": \"1000000\",
    \"decimals\": \"9\"
  }"
```

### Using JavaScript/TypeScript:
```typescript
// Step 1: Generate metadata
const formData = new FormData();
formData.append('file', logoFile);
formData.append('name', 'Awesome Token');
formData.append('symbol', 'AWE');
formData.append('description', 'An awesome token for the Solana ecosystem');

const metadataResponse = await fetch('http://localhost:3000/api/generate-metadata', {
  method: 'POST',
  body: formData
});

const { metadataUri } = await metadataResponse.json();

// Step 2: Create token
const createResponse = await fetch('http://localhost:3000/api/create-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Awesome Token',
    symbol: 'AWE',
    uri: metadataUri,
    supply: '1000000',
    decimals: '9'
  })
});

const tokenData = await createResponse.json();
console.log('Token created:', tokenData.mintAddress);
console.log('View on Solscan:', tokenData.solscanTokenLink);
```

## Migration from Old Workflow

### Old Workflow (Manual):
1. Upload logo → Get IPFS URL
2. Create metadata.json manually
3. Upload metadata.json → Get IPFS URL
4. Create token with metadata URL

### New Workflow (Automated):
1. Upload logo + metadata fields → Get metadata URL automatically
2. Create token with metadata URL

**Benefits:**
- ✅ Ensures correct metadata format every time
- ✅ Reduces manual errors
- ✅ Simpler for frontend integration
- ✅ Guaranteed Solscan compatibility
- ✅ One API call instead of multiple manual steps

## Troubleshooting

### Metadata still not showing on Solscan
1. **Wait 1-2 minutes** - Solscan needs time to index the transaction
2. **Check metadata URL** - Visit the metadataUri in your browser to verify the JSON is accessible
3. **Check image URL** - Visit the imageUri to verify the logo loads
4. **Verify format** - The metadata JSON should match the structure shown above

### "Pinata API keys not configured" error
- Ensure `PINATA_API_KEY` and `PINATA_SECRET_API_KEY` are set in your environment variables
- Check the Render dashboard or `.env` file

### "Invalid image type" error
- Only JPEG, PNG, GIF, and WebP images are supported
- Convert your image to a supported format

### Image not displaying
- Ensure the image file is valid and not corrupted
- Try accessing the imageUri directly in a browser
- Check that the file size is reasonable (< 10MB recommended)

## Technical Details

### Why This Fix Works
1. **Complete metadata structure** - Includes all fields required by Metaplex standard
2. **Proper MIME types** - Specifies correct content types for files
3. **Properties.files array** - Required for proper file handling
4. **Correct category** - Uses "fungible" to ensure tokens are displayed as fungible SPL tokens, not NFTs
5. **No NFT-specific fields** - Excludes "creators" and other NFT-only fields that would cause explorers to misidentify the token type
6. **Consistent naming** - Ensures name/symbol match across metadata and token

### Files Changed
- `src/metadata-generator.service.ts` - Core metadata generation logic
- `src/metadata-generator.route.ts` - API endpoint for metadata generation
- `server.ts` - Added new route to server

### Backward Compatibility
The old `/api/upload-logo` endpoint still works for those who want to manage metadata manually. However, using `/api/generate-metadata` is strongly recommended for guaranteed Solscan compatibility.

## Testing

### Verify the endpoint works:
```bash
# Test metadata generation
curl -X POST http://localhost:3000/api/generate-metadata \
  -F "file=@test-logo.png" \
  -F "name=Test Token" \
  -F "symbol=TEST" \
  -F "description=Test description"
```

Expected: Returns success with metadataUri and imageUri

### Verify token creation:
```bash
# Use the metadataUri from above
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token",
    "symbol": "TEST",
    "uri": "<metadataUri from previous step>",
    "supply": "1000",
    "decimals": "9"
  }'
```

Expected: Token created successfully with Solscan links

### Verify on Solscan:
1. Open the `solscanTokenLink` from the response
2. Check that name, symbol, and logo all display correctly
3. Verify the metadata section shows all fields

## Support

If you continue to experience issues with metadata display:
1. Check that you're using the new `/api/generate-metadata` endpoint
2. Verify your Pinata API keys are correctly configured
3. Ensure your logo file is in a supported format
4. Wait at least 2 minutes for Solscan to index
5. Check the server logs for any error messages
