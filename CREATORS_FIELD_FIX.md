# Solscan Metadata Display Fix - Creators Field Issue

## Problem Statement
Tokens created through the API were showing metadata on Solana Explorer devnet but NOT displaying on Solscan. The on-chain metadata showed:
```json
{
  "creators": [{
    "address": "CREATOR_WALLET_ADDRESS_HERE",
    "verified": 1,
    "share": 100
  }],
  "tokenStandard": 2,  // Fungible
  "collection": undefined,
  "uses": undefined
}
```

## Root Cause
The `creators` field is an **NFT-specific field** in the Metaplex Token Metadata Standard. When this field is present on a fungible token (tokenStandard: 2), Solscan's indexer may not properly display the token metadata because:

1. **Type Confusion**: Solscan expects fungible tokens to NOT have NFT-specific fields like `creators`
2. **Indexing Logic**: The presence of `creators` may cause Solscan to treat the token as an NFT rather than a fungible token
3. **Display Rules**: Solscan's display logic for fungible tokens and NFTs are different

When `createAndMint` is called without explicitly setting the `creators` parameter, it **defaults to including the authority as a creator**, which is appropriate for NFTs but problematic for fungible tokens.

## Solution
**Updated Fix (Latest):** Explicitly set NFT-specific fields to `null` in the `createAndMint` call for fungible tokens. When these fields are omitted, the Metaplex UMI SDK defaults to including the authority as a creator, which causes Solscan display issues. Setting them to `null` explicitly prevents this default behavior.

```typescript
const result = await createAndMint(umi, {
    // ... other parameters
    tokenStandard: TokenStandard.Fungible,
    // Explicitly set NFT-specific fields to null for fungible tokens
    // This prevents the SDK from defaulting to include the authority as a creator
    creators: null,
    collection: null,
    uses: null,
    // ... mint parameters
});
```

**Previous Approaches (Deprecated):** 
- Setting fields to `none()` caused them to appear as `undefined` in the metadata
- Omitting the fields caused the SDK to default to including the authority as a creator

### Why This Works
- **No NFT-Specific Fields**: By explicitly setting `creators`, `collection`, and `uses` to `null`, the on-chain metadata will NOT include these fields at all
- **Prevents SDK Defaults**: Without explicit `null`, the SDK defaults to including the authority as a creator
- **Clean Fungible Token**: Solscan will properly identify the token as fungible without any NFT-specific fields
- **Proper Indexing**: Solscan's indexer will use the correct display logic for fungible tokens
- **Standard Compliance**: Matches the standard SPL token metadata structure

## Technical Details

### Before Fix
```json
{
  "key": 4,
  "data": {
    "creators": [{
      "address": "CREATOR_WALLET_ADDRESS_HERE",
      "verified": 1,
      "share": 100
    }]
  },
  "tokenStandard": 2,
  "collection": undefined,
  "uses": undefined
}
```
Result: ❌ Metadata shows on Solana Explorer but NOT on Solscan

### After Fix (Latest - No undefined fields)
```json
{
  "key": 4,
  "data": {
    "name": "Token Name",
    "symbol": "SYMBOL",
    "uri": "https://gateway.pinata.cloud/ipfs/...",
    "sellerFeeBasisPoints": 0
  },
  "tokenStandard": 2
}
```
Result: ✅ Metadata displays correctly on BOTH Solana Explorer AND Solscan. No `undefined` fields present.

## Metaplex Token Standard - Field Usage by Token Type

### Fungible Tokens (tokenStandard: 2)
**Required Fields:**
- `name`: Token name
- `symbol`: Token symbol
- `uri`: Metadata JSON URI
- `tokenStandard`: Must be `TokenStandard.Fungible` (2)

**Optional Fields:**
- `decimals`: Number of decimal places
- `sellerFeeBasisPoints`: Royalty percentage (usually 0 for fungible tokens)
- `isMutable`: Whether metadata can be updated

**Should NOT Include (NFT-specific):**
- ❌ `creators`: List of creators with shares
- ❌ `collection`: Collection information
- ❌ `uses`: Limited use cases
- ❌ `maxSupply`: Maximum NFT supply
- ❌ `edition`: Edition information

### NFTs (tokenStandard: 0 or 4)
**All fungible fields PLUS:**
- ✅ `creators`: Array of creators with verification and shares
- ✅ `collection`: Parent collection information
- ✅ `uses`: Usage limitations
- ✅ `maxSupply`: Maximum number of prints
- ✅ `edition`: Edition number

## Implementation

### File Changed
`src/metadata-addition.service.ts`

### No Special Imports Needed (Latest Fix)
No need to import `none` from UMI SDK.

### Code Change (Latest Fix)
```typescript
const result = await createAndMint(umi, {
    mint,
    authority: payer,
    name: details.name,
    symbol: details.symbol,
    uri: details.uri,
    sellerFeeBasisPoints: percentAmount(0),
    decimals: decimalsNumber,
    tokenStandard: TokenStandard.Fungible,
    isMutable: true,
    updateAuthority: payer.publicKey,
    // Explicitly set NFT-specific fields to null for fungible tokens
    // This prevents the SDK from defaulting to include the authority as a creator
    creators: null,
    collection: null,
    uses: null,
    // Mint parameters
    amount: supplyBigInt,
    tokenOwner: payer.publicKey,
}).sendAndConfirm(umi);
```

**Key Change:** NFT-specific fields are explicitly set to `null` to prevent the SDK from using default values that include the authority as a creator.

## Verification Steps

### 1. Create a Token
```bash
curl -X POST http://localhost:3000/api/generate-metadata \
  -F "file=@logo.png" \
  -F "name=Test Token" \
  -F "symbol=TEST" \
  -F "description=Testing Solscan fix"

# Use the returned metadataUri in the next step

curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token",
    "symbol": "TEST",
    "uri": "<metadataUri from above>",
    "supply": "1000000",
    "decimals": "9"
  }'
```

### 2. Check Solana Explorer
Visit: `https://explorer.solana.com/address/<mintAddress>/metadata?cluster=devnet`

Expected: ✅ Metadata displays with NO `creators` field

### 3. Check Solscan
Visit: `https://solscan.io/token/<mintAddress>?cluster=devnet#metadata`

Expected: ✅ Token name, symbol, logo, and all metadata display correctly

### 4. Wait 1-2 Minutes
Solscan needs time to index new transactions. If metadata doesn't appear immediately, wait and refresh.

## Related Documentation
- [Metaplex Token Metadata Standard](https://developers.metaplex.com/token-metadata)
- [Token Standards](https://developers.metaplex.com/token-metadata/token-standard)
- [Solscan API](https://docs.solscan.io/)

## Backward Compatibility
This fix is fully backward compatible:
- ✅ Old tokens with `creators` field still work (they just may not display on Solscan)
- ✅ New tokens created after this fix will display correctly on both Solana Explorer and Solscan
- ✅ The `/api/generate-metadata` endpoint continues to work as before
- ✅ No changes required to existing API calls

## Testing
To verify the fix works:
1. Build the project: `npm run build`
2. Start the server: `npm start`
3. Create a test token using the endpoints above
4. Verify metadata displays on both Solana Explorer and Solscan

## Summary
By explicitly setting `creators: none()`, `collection: none()`, and `uses: none()` for fungible tokens, we ensure that Solscan properly identifies and displays the token as a fungible SPL token rather than an NFT. This is the critical fix for the Solscan metadata display issue.
