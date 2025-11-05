# Separated Metadata Upload Flow

## Overview

This document explains the new two-step process for uploading logos and generating metadata. This allows more flexibility in the workflow, enabling you to upload logos and generate metadata as separate operations.

## Why Separate Operations?

Previously, the `/api/generate-metadata` endpoint combined two operations:
1. Upload logo to IPFS
2. Generate and upload metadata JSON

The new separated approach provides:
- **More control**: Upload logos separately, reuse them for multiple tokens
- **Better error handling**: Handle upload failures independently
- **Flexibility**: Generate metadata later using pre-uploaded logos
- **Caching**: Upload logos once, reference them multiple times

## API Endpoints

### Two-Step Process (New)

#### Step 1: Upload Logo Only
**Endpoint:** `POST /api/upload-logo-only`

Upload a logo image to IPFS without generating metadata.

**Request (multipart/form-data):**
```bash
curl -X POST http://localhost:3000/api/upload-logo-only \
  -F "file=@logo.png"
```

**Response:**
```json
{
  "success": true,
  "message": "Logo uploaded to IPFS successfully",
  "imageUri": "https://gateway.pinata.cloud/ipfs/QmXXXXXXXXXXXXXXXXXXXX",
  "ipfsHash": "QmXXXXXXXXXXXXXXXXXXXX",
  "sessionId": "sess_1699999999999_abc123",
  "note": "Use this imageUri and sessionId when calling /api/generate-metadata-only to create the metadata JSON"
}
```

#### Step 2: Generate Metadata Only
**Endpoint:** `POST /api/generate-metadata-only`

Generate metadata JSON using a pre-uploaded logo URI.

**Request (application/json):**
```bash
curl -X POST http://localhost:3000/api/generate-metadata-only \
  -H "Content-Type: application/json" \
  -d '{
    "imageUri": "https://gateway.pinata.cloud/ipfs/QmXXXXXXXXXXXXXXXXXXXX",
    "name": "My Token",
    "symbol": "MTK",
    "description": "A great token",
    "sessionId": "sess_1699999999999_abc123",
    "imageMimeType": "image/png"
  }'
```

**Request Parameters:**
- `imageUri` (required): IPFS URI of the pre-uploaded logo
- `name` (required): Token name
- `symbol` (required): Token symbol
- `description` (optional): Token description (defaults to empty string)
- `sessionId` (optional): Session ID from logo upload (for flow tracking)
- `imageMimeType` (optional): MIME type of the image (defaults to 'image/png')

**Response:**
```json
{
  "success": true,
  "message": "Metadata JSON generated and uploaded successfully",
  "metadataUri": "https://gateway.pinata.cloud/ipfs/QmYYYYYYYYYYYYYYYYYYYY",
  "metadataHash": "QmYYYYYYYYYYYYYYYYYYYY",
  "sessionId": "sess_1699999999999_abc123",
  "note": "Use the metadataUri when creating your token to ensure proper display on Solscan"
}
```

### Combined Process (Existing)

**Endpoint:** `POST /api/generate-metadata`

Upload logo and generate metadata in one step (original behavior).

**Request (multipart/form-data):**
```bash
curl -X POST http://localhost:3000/api/generate-metadata \
  -F "file=@logo.png" \
  -F "name=My Token" \
  -F "symbol=MTK" \
  -F "description=A great token"
```

**Response:**
```json
{
  "success": true,
  "message": "Metadata generated and uploaded successfully",
  "metadataUri": "https://gateway.pinata.cloud/ipfs/QmYYYYYYYYYYYYYYYYYYYY",
  "imageUri": "https://gateway.pinata.cloud/ipfs/QmXXXXXXXXXXXXXXXXXXXX",
  "sessionId": "sess_1699999999999_abc123",
  "note": "Use the metadataUri when creating your token to ensure proper display on Solscan"
}
```

## Complete Workflows

### Workflow 1: Separated Upload (New)

```bash
# Step 1: Upload logo
curl -X POST http://localhost:3000/api/upload-logo-only \
  -F "file=@logo.png" \
  > logo-response.json

# Extract imageUri from response
IMAGE_URI=$(jq -r '.imageUri' logo-response.json)
SESSION_ID=$(jq -r '.sessionId' logo-response.json)

# Step 2: Generate metadata
curl -X POST http://localhost:3000/api/generate-metadata-only \
  -H "Content-Type: application/json" \
  -d "{
    \"imageUri\": \"$IMAGE_URI\",
    \"name\": \"My Token\",
    \"symbol\": \"MTK\",
    \"description\": \"A great token\",
    \"sessionId\": \"$SESSION_ID\"
  }" \
  > metadata-response.json

# Extract metadataUri for token creation
METADATA_URI=$(jq -r '.metadataUri' metadata-response.json)

# Step 3: Create token
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"My Token\",
    \"symbol\": \"MTK\",
    \"uri\": \"$METADATA_URI\",
    \"supply\": \"1000000\",
    \"decimals\": \"9\"
  }"
```

### Workflow 2: Combined Upload (Existing)

```bash
# Step 1: Generate metadata (uploads logo + metadata)
curl -X POST http://localhost:3000/api/generate-metadata \
  -F "file=@logo.png" \
  -F "name=My Token" \
  -F "symbol=MTK" \
  -F "description=A great token" \
  > metadata-response.json

# Extract metadataUri
METADATA_URI=$(jq -r '.metadataUri' metadata-response.json)

# Step 2: Create token
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"My Token\",
    \"symbol\": \"MTK\",
    \"uri\": \"$METADATA_URI\",
    \"supply\": \"1000000\",
    \"decimals\": \"9\"
  }"
```

## Frontend Integration Examples

### React Example (Separated Upload)

```javascript
// Step 1: Upload logo
async function uploadLogo(logoFile) {
  const formData = new FormData();
  formData.append('file', logoFile);

  const response = await fetch('http://localhost:3000/api/upload-logo-only', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  return data; // { imageUri, ipfsHash, sessionId }
}

// Step 2: Generate metadata
async function generateMetadata(imageUri, name, symbol, description, sessionId) {
  const response = await fetch('http://localhost:3000/api/generate-metadata-only', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageUri,
      name,
      symbol,
      description,
      sessionId,
    }),
  });

  const data = await response.json();
  return data; // { metadataUri, metadataHash, sessionId }
}

// Step 3: Create token
async function createToken(metadataUri, name, symbol, supply, decimals) {
  const response = await fetch('http://localhost:3000/api/create-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      symbol,
      uri: metadataUri,
      supply,
      decimals,
    }),
  });

  const data = await response.json();
  return data;
}

// Usage
async function createTokenWithSeparatedUpload() {
  try {
    // Step 1: Upload logo
    const logoUploadResult = await uploadLogo(selectedFile);
    console.log('Logo uploaded:', logoUploadResult.imageUri);

    // Step 2: Generate metadata
    const metadataResult = await generateMetadata(
      logoUploadResult.imageUri,
      'My Token',
      'MTK',
      'A great token',
      logoUploadResult.sessionId
    );
    console.log('Metadata created:', metadataResult.metadataUri);

    // Step 3: Create token
    const tokenResult = await createToken(
      metadataResult.metadataUri,
      'My Token',
      'MTK',
      '1000000',
      '9'
    );
    console.log('Token created:', tokenResult.mintAddress);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### React Example (Combined Upload)

```javascript
async function createTokenWithCombinedUpload(logoFile) {
  try {
    // Step 1: Generate metadata (uploads logo + metadata in one step)
    const formData = new FormData();
    formData.append('file', logoFile);
    formData.append('name', 'My Token');
    formData.append('symbol', 'MTK');
    formData.append('description', 'A great token');

    const metadataResponse = await fetch('http://localhost:3000/api/generate-metadata', {
      method: 'POST',
      body: formData,
    });
    const metadataResult = await metadataResponse.json();
    console.log('Metadata created:', metadataResult.metadataUri);

    // Step 2: Create token
    const tokenResponse = await fetch('http://localhost:3000/api/create-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'My Token',
        symbol: 'MTK',
        uri: metadataResult.metadataUri,
        supply: '1000000',
        decimals: '9',
      }),
    });
    const tokenResult = await tokenResponse.json();
    console.log('Token created:', tokenResult.mintAddress);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Use Cases

### When to Use Separated Upload

1. **Logo Reuse**: Upload a logo once, create multiple tokens with different metadata
2. **Pre-upload Assets**: Upload logos in advance, generate metadata later
3. **Better UX**: Show progress for each step separately
4. **Error Recovery**: If metadata generation fails, retry without re-uploading the logo
5. **Testing**: Test logo upload and metadata generation independently

### When to Use Combined Upload

1. **Simplicity**: One-step process for quick token creation
2. **Atomic Operations**: Ensure logo and metadata are created together
3. **Backward Compatibility**: Existing integrations continue to work

## File Size and Type Limits

- **Maximum file size**: 10MB
- **Supported image types**: JPEG, PNG, GIF, WebP
- **MIME types**: 
  - `image/jpeg`
  - `image/jpg`
  - `image/png`
  - `image/gif`
  - `image/webp`

## Error Handling

### Logo Upload Errors

```json
{
  "error": "No logo file provided. Please upload an image file."
}
```

```json
{
  "error": "Invalid image type: image/bmp. Allowed types: image/jpeg, image/jpg, image/png, image/gif, image/webp"
}
```

```json
{
  "error": "Failed to upload to IPFS. Please check your file and try again."
}
```

### Metadata Generation Errors

```json
{
  "error": "imageUri is required and must be a non-empty string."
}
```

```json
{
  "error": "Token name is required and must be a non-empty string."
}
```

```json
{
  "error": "Failed to upload metadata to IPFS. Please try again."
}
```

## Session Tracking

Both endpoints support session tracking using the `sessionId` parameter. This allows you to:
- Track the complete flow from logo upload to token creation
- Debug issues with specific uploads
- Monitor the metadata generation pipeline

The `sessionId` is automatically generated during logo upload and can be passed to subsequent operations for tracking continuity.

## Migration Guide

If you're currently using `/api/generate-metadata`, you don't need to change anything. The endpoint continues to work as before.

To migrate to the separated approach:

1. Replace your single `/api/generate-metadata` call with two calls:
   - First: `/api/upload-logo-only` with the file
   - Second: `/api/generate-metadata-only` with the returned imageUri

2. Update your state management to handle two steps instead of one

3. Add progress indicators for each step for better UX

## Benefits of Separated Approach

1. **Flexibility**: Decouple logo upload from metadata generation
2. **Reusability**: Upload a logo once, use it for multiple tokens
3. **Error Recovery**: Retry operations independently
4. **Better UX**: Show progress for each step
5. **Testing**: Test each operation separately
6. **Caching**: Potentially cache uploaded logos for reuse

## Backward Compatibility

All existing endpoints remain functional:
- `/api/generate-metadata` - Combined upload (unchanged)
- `/api/upload-logo` - Legacy logo upload (unchanged)
- `/api/create-token` - Token creation (unchanged)

The new endpoints are additions, not replacements.
