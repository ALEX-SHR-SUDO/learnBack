# Token Metadata Fix - SPL Token with Token-2022 Extensions

## Overview
This document explains the fix applied to resolve the issue where tokens were being created with NFT metadata instead of proper SPL token metadata, and provides instructions for testing.

## The Problem
Tokens created by the backend were using Metaplex Token Metadata Program (designed for NFTs) instead of proper SPL token metadata. This caused tokens to not display correctly as fungible SPL tokens on Solscan and other Solana explorers.

**Previous implementation:** Used `createAndMint` from `@metaplex-foundation/mpl-token-metadata` which creates NFT-style metadata accounts.

**Issue:** The Metaplex Token Metadata Program is designed primarily for NFTs, not fungible SPL tokens. While it can work for fungible tokens, it's not the standard approach and may not display correctly on all explorers.

## The Fix

### Complete Rewrite: Token-2022 with Metadata Extension
**Before:**
```typescript
import { createAndMint, TokenStandard, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { createUmi, ... } from "@metaplex-foundation/umi";

// Used Metaplex UMI SDK with NFT-oriented metadata
const result = await createAndMint(umi, {
    mint,
    authority: payer,
    name: details.name,
    symbol: details.symbol,
    uri: details.uri,
    tokenStandard: TokenStandard.Fungible,
    ...
}).sendAndConfirm(umi);
```

**After:**
```typescript
import { TOKEN_2022_PROGRAM_ID, createInitializeMintInstruction, ... } from "@solana/spl-token";
import { createInitializeInstruction, pack, TokenMetadata } from '@solana/spl-token-metadata';

// Using Token-2022 (Token Extensions) with native metadata extension
const transaction = new Transaction().add(
    SystemProgram.createAccount({ ... }),
    createInitializeMetadataPointerInstruction(...),
    createInitializeMintInstruction(...),
    createInitializeInstruction({ 
        metadata: mint, // Metadata stored in mint account itself
        name, symbol, uri 
    })
);
```

**Why this matters:** 
- Token-2022 is the new SPL Token program with native support for metadata extensions
- Metadata is stored directly in the mint account (not a separate account like NFTs)
- This is the standard way to create fungible SPL tokens with metadata
- Properly displays on Solscan and all Solana explorers as SPL tokens

### 2. Key Technical Changes

#### Removed Dependencies
- ❌ `@metaplex-foundation/mpl-token-metadata` (NFT-focused)
- ❌ `@metaplex-foundation/umi` (Metaplex framework)
- ❌ `@metaplex-foundation/umi-bundle-defaults`

#### Added/Used Dependencies
- ✅ `@solana/spl-token` (already installed, includes Token-2022 support)
- ✅ `@solana/spl-token-metadata` (automatically included with spl-token)

#### Implementation Details

**Step 1: Create Mint Account with Extensions**
```typescript
const mintLen = getMintLen([ExtensionType.MetadataPointer]);
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataExtension + metadataLen);

SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint,
    space: mintLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
})
```

**Step 2: Initialize Metadata Pointer**
Points the metadata to the mint account itself (not a separate account):
```typescript
createInitializeMetadataPointerInstruction(
    mint,
    payer.publicKey,
    mint, // Metadata stored in mint itself!
    TOKEN_2022_PROGRAM_ID
)
```

**Step 3: Initialize Mint**
```typescript
createInitializeMintInstruction(
    mint,
    decimals,
    payer.publicKey,
    null, // No freeze authority
    TOKEN_2022_PROGRAM_ID
)
```

**Step 4: Initialize Metadata**
```typescript
createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    metadata: mint,
    updateAuthority: payer.publicKey,
    mint: mint,
    mintAuthority: payer.publicKey,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
})
```

**Step 5: Create ATA and Mint Tokens**
```typescript
const associatedTokenAccount = await createAssociatedTokenAccountIdempotent(
    connection,
    payer,
    mint,
    payer.publicKey,
    { commitment: 'confirmed' },
    TOKEN_2022_PROGRAM_ID // Important: use Token-2022 program
);

await mintTo(
    connection,
    payer,
    mint,
    associatedTokenAccount,
    payer.publicKey,
    supplyBigInt,
    [],
    { commitment: 'confirmed' },
    TOKEN_2022_PROGRAM_ID // Important: use Token-2022 program
);
```

### 3. Enhanced Logging
All operations include detailed logging:
- ✅ Token parameters before creation
- ✅ Mint address and transaction signatures
- ✅ Solscan and Explorer links for easy verification
- ✅ Step-by-step progress during token creation

### 4. API Response
The `/api/create-token` endpoint returns:
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

## Key Differences: NFT Metadata vs SPL Token Metadata

| Aspect | Metaplex (NFT) | Token-2022 (SPL) |
|--------|----------------|------------------|
| **Program** | Token Metadata Program | Token Extensions Program (Token-2022) |
| **Program ID** | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s` | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |
| **Metadata Location** | Separate PDA account | Inside mint account |
| **Token Standard** | TokenStandard.Fungible | Native fungible with extensions |
| **Primary Use Case** | NFTs | Fungible SPL tokens |
| **Solscan Display** | May show as NFT-like | Shows as proper SPL token |
| **Account Structure** | Mint + Metadata PDA | Mint with embedded metadata |
| **Complexity** | Higher (UMI SDK, multiple accounts) | Lower (standard SPL Token) |

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
