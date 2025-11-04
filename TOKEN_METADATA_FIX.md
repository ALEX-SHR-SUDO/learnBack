# Token Metadata Fix - Testing Guide

## Overview
This document explains the fix applied to resolve the issue of missing metadata on created tokens, and provides instructions for testing.

## The Problem
Tokens created by the backend were not showing metadata on Solscan and other Solana explorers. This was due to improper imports from the `@metaplex-foundation/mpl-token-metadata` package.

## The Fix

### 1. Fixed Imports (src/metadata-addition.service.ts)
**Before:**
```typescript
import mplTokenMetadataExports from "@metaplex-foundation/mpl-token-metadata";
const createAndMint = (mplTokenMetadataExports as any).createAndMint;
const TokenStandard = (mplTokenMetadataExports as any).TokenStandard;
const mplTokenMetadata = (mplTokenMetadataExports as any).mplTokenMetadata;
```

**After:**
```typescript
import { 
    createAndMint,
    TokenStandard,
    mplTokenMetadata
} from "@metaplex-foundation/mpl-token-metadata";
```

**Why this matters:** Using `as any` type assertions bypasses TypeScript's type checking and can lead to runtime errors. Proper named imports ensure the functions are correctly referenced and work as expected.

### 2. Enhanced Logging
Added detailed logging to help verify token creation:
- Logs all token parameters before creation
- Logs Solscan and Explorer links after successful creation
- Makes it easy to immediately verify metadata on Solscan

### 3. Enhanced API Response
The `/api/create-token` endpoint now returns:
```json
{
  "message": "Token and metadata successfully created.",
  "mintAddress": "...",
  "transactionSignature": "...",
  "explorerLinkCreate": "https://explorer.solana.com/tx/...?cluster=devnet",
  "solscanTokenLink": "https://solscan.io/token/...?cluster=devnet",
  "solscanTxLink": "https://solscan.io/tx/...?cluster=devnet",
  "ataAddress": "..."
}
```

## How to Test

### Prerequisites
1. Ensure the service wallet has sufficient SOL balance (at least 0.01 SOL on devnet)
2. You can check the balance using: `GET /api/balance`
3. If needed, airdrop devnet SOL to the service wallet address shown in the console

### Testing Steps

#### Step 1: Prepare Metadata
First, upload an image logo to IPFS:
```bash
curl -X POST http://localhost:3000/api/upload-logo \
  -F "file=@/path/to/your/logo.png"
```

This returns:
```json
{
  "ipfsUrl": "https://gateway.pinata.cloud/ipfs/Qm..."
}
```

Then create metadata JSON and upload it:
```bash
# Create metadata.json
cat > metadata.json << EOF
{
  "name": "Test Token",
  "symbol": "TEST",
  "image": "https://gateway.pinata.cloud/ipfs/Qm...",
  "description": "Test token to verify metadata fix",
  "attributes": []
}
EOF

# Upload metadata
curl -X POST http://localhost:3000/api/upload-logo \
  -F "file=@metadata.json"
```

This returns the metadata URI you'll use in the next step.

#### Step 2: Create Token with Metadata
```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token",
    "symbol": "TEST",
    "uri": "https://gateway.pinata.cloud/ipfs/Qm...",
    "supply": "1000",
    "decimals": "9"
  }'
```

#### Step 3: Verify Metadata on Solscan
1. Check the server logs for the Solscan link
2. Open the `solscanTokenLink` from the response
3. Verify that:
   - Token name and symbol are visible
   - Token logo is displayed
   - Metadata shows correctly
   - Supply and decimals are correct

### Expected Result
✅ Token should appear on Solscan with:
- Correct name and symbol
- Token logo image
- All metadata fields populated
- Proper supply and decimal values

## Service Wallet Usage
All transactions use the service wallet configured in `.env`:
- The wallet is loaded from `SERVICE_SECRET_KEY` environment variable
- The wallet address is logged on server startup
- All token creation fees are paid from this wallet
- Minted tokens are sent to this wallet's associated token account

## Troubleshooting

### "Insufficient balance" error
- Check wallet balance: `GET /api/balance`
- Airdrop SOL: Visit https://faucet.solana.com/ or use Solana CLI
- Service wallet address is shown in server logs on startup

### Metadata not showing on Solscan
- Wait 1-2 minutes for Solscan to index the transaction
- Verify the metadata URI is publicly accessible
- Check that the metadata JSON is valid
- Ensure the image URL in metadata JSON is accessible

### "Failed to create token" error
- Check server logs for detailed error messages
- Verify Solana devnet is operational
- Ensure all required fields are provided in the request
- Check that the service wallet has sufficient balance

## Additional Notes

### Why createAndMint?
The `createAndMint` function from Metaplex is specifically designed for fungible SPL tokens. It:
1. Creates the token mint account
2. Creates the metadata account (visible on Solscan)
3. Mints the initial supply
4. All in a single atomic transaction

This ensures metadata is always created along with the token, making it visible on all Solana explorers including Solscan.

### Network Configuration
Currently configured for Solana devnet:
- RPC: `https://api.devnet.solana.com`
- To change network, update `SOLANA_CLUSTER_URL` in `.env`
- Remember to update the service wallet balance on the new network

## Resources
- [Metaplex Token Metadata Documentation](https://developers.metaplex.com/token-metadata)
- [Solscan](https://solscan.io/)
- [Solana Explorer](https://explorer.solana.com/)
- [Solana Devnet Faucet](https://faucet.solana.com/)
