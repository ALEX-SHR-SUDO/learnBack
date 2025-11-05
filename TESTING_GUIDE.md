# Manual Testing Guide for Recipient Wallet Feature

## Overview
This guide helps you manually test the new `recipientWallet` parameter for the `/api/create-token` endpoint.

## Prerequisites

1. **Service Wallet**: Ensure the service wallet has sufficient SOL (at least 0.02 SOL on devnet)
2. **Client Wallet**: Have a Solana devnet wallet address ready (you can use Phantom or any Solana wallet)
3. **Metadata**: Have a metadata URI ready (or use the `/api/generate-metadata` endpoint first)

## Test Cases

### Test Case 1: Token Creation Without Recipient Wallet (Backward Compatibility)

**Purpose**: Verify that the endpoint still works without the `recipientWallet` parameter (tokens go to service wallet)

**Request**:
```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token 1",
    "symbol": "TST1",
    "uri": "https://gateway.pinata.cloud/ipfs/YOUR_METADATA_HASH",
    "supply": "1000",
    "decimals": "9",
    "revokeFreezeAuthority": true,
    "revokeMintAuthority": true
  }'
```

**Expected Response**:
```json
{
  "message": "Token and metadata successfully created.",
  "mintAddress": "...",
  "transactionSignature": "...",
  "explorerLinkCreate": "...",
  "solscanTokenLink": "...",
  "solscanTxLink": "...",
  "ataAddress": "...",
  "recipientWallet": "service wallet"
}
```

**Verification**:
1. ✅ Response includes `"recipientWallet": "service wallet"`
2. ✅ Transaction succeeds
3. ✅ Check service wallet balance on Solscan - should have 1000 TST1 tokens
4. ✅ Mint and freeze authorities should be revoked

---

### Test Case 2: Token Creation With Valid Recipient Wallet

**Purpose**: Verify that tokens are minted to the specified recipient wallet

**Request**:
```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token 2",
    "symbol": "TST2",
    "uri": "https://gateway.pinata.cloud/ipfs/YOUR_METADATA_HASH",
    "supply": "2000",
    "decimals": "9",
    "recipientWallet": "YOUR_CLIENT_WALLET_ADDRESS",
    "revokeFreezeAuthority": true,
    "revokeMintAuthority": true
  }'
```

**Expected Response**:
```json
{
  "message": "Token and metadata successfully created.",
  "mintAddress": "...",
  "transactionSignature": "...",
  "explorerLinkCreate": "...",
  "solscanTokenLink": "...",
  "solscanTxLink": "...",
  "ataAddress": "...",
  "recipientWallet": "YOUR_CLIENT_WALLET_ADDRESS"
}
```

**Verification**:
1. ✅ Response includes `"recipientWallet": "YOUR_CLIENT_WALLET_ADDRESS"`
2. ✅ Transaction succeeds
3. ✅ Check **CLIENT** wallet on Solscan - should have 2000 TST2 tokens
4. ✅ Check **SERVICE** wallet on Solscan - should NOT have TST2 tokens
5. ✅ Service wallet SOL balance decreased (paid transaction fees)
6. ✅ Mint and freeze authorities should be revoked

---

### Test Case 3: Invalid Recipient Wallet Address

**Purpose**: Verify that invalid wallet addresses are rejected

**Request**:
```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token 3",
    "symbol": "TST3",
    "uri": "https://gateway.pinata.cloud/ipfs/YOUR_METADATA_HASH",
    "supply": "3000",
    "decimals": "9",
    "recipientWallet": "invalid_wallet_address",
    "revokeFreezeAuthority": true,
    "revokeMintAuthority": true
  }'
```

**Expected Response**:
```json
{
  "error": "Invalid recipientWallet address. Please provide a valid Solana public key."
}
```

**Expected Status Code**: 400 (Bad Request)

**Verification**:
1. ✅ Request is rejected
2. ✅ Error message is clear and helpful
3. ✅ No transaction is created
4. ✅ No SOL is spent

---

### Test Case 4: Empty String Recipient Wallet

**Purpose**: Verify handling of empty string (should default to service wallet)

**Request**:
```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token 4",
    "symbol": "TST4",
    "uri": "https://gateway.pinata.cloud/ipfs/YOUR_METADATA_HASH",
    "supply": "4000",
    "decimals": "9",
    "recipientWallet": "",
    "revokeFreezeAuthority": true,
    "revokeMintAuthority": true
  }'
```

**Expected Behavior**: Should be rejected as invalid

**Verification**:
1. ✅ Request is rejected with validation error
2. ✅ No transaction is created

---

### Test Case 5: Token Creation With Large Supply

**Purpose**: Verify that large token supplies work with recipient wallet

**Request**:
```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token 5",
    "symbol": "TST5",
    "uri": "https://gateway.pinata.cloud/ipfs/YOUR_METADATA_HASH",
    "supply": "1000000000",
    "decimals": "9",
    "recipientWallet": "YOUR_CLIENT_WALLET_ADDRESS",
    "revokeFreezeAuthority": false,
    "revokeMintAuthority": false
  }'
```

**Expected Response**: Success with large supply

**Verification**:
1. ✅ Transaction succeeds
2. ✅ Client wallet receives 1,000,000,000 tokens (1 billion)
3. ✅ Authorities are NOT revoked (as requested)
4. ✅ Check on Solscan that supply is correct

---

## Integration Test: End-to-End Token Creation Flow

### Complete Flow with Recipient Wallet

**Step 1**: Generate Metadata
```bash
curl -X POST http://localhost:3000/api/generate-metadata \
  -F "file=@test-logo.png" \
  -F "name=End to End Token" \
  -F "symbol=E2E" \
  -F "description=Testing end-to-end token creation with recipient wallet"
```

**Step 2**: Create Token with Recipient Wallet
Use the `metadataUri` from Step 1:
```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "End to End Token",
    "symbol": "E2E",
    "uri": "<METADATA_URI_FROM_STEP_1>",
    "supply": "10000",
    "decimals": "9",
    "recipientWallet": "YOUR_CLIENT_WALLET_ADDRESS",
    "revokeFreezeAuthority": true,
    "revokeMintAuthority": true
  }'
```

**Step 3**: Verify on Solscan
1. Visit the `solscanTokenLink` from the response
2. Verify token name, symbol, and logo display correctly
3. Verify supply is 10,000
4. Verify mint and freeze authorities are null (revoked)
5. Verify holder is the client wallet with 10,000 tokens

---

## Performance Testing

### Stress Test: Multiple Tokens to Different Recipients

Create 5 tokens to 5 different wallets:

```bash
# Token 1
curl -X POST http://localhost:3000/api/create-token -H "Content-Type: application/json" -d '{"name":"Token1","symbol":"TK1","uri":"METADATA_URI","supply":"1000","decimals":"9","recipientWallet":"WALLET1"}'

# Token 2
curl -X POST http://localhost:3000/api/create-token -H "Content-Type: application/json" -d '{"name":"Token2","symbol":"TK2","uri":"METADATA_URI","supply":"1000","decimals":"9","recipientWallet":"WALLET2"}'

# ... repeat for WALLET3, WALLET4, WALLET5
```

**Expected**: All tokens should be created successfully and each wallet should receive their respective tokens.

---

## Monitoring and Logging

### Check Server Logs

When testing, monitor the server logs for these messages:

**With recipientWallet**:
```
📬 Tokens will be minted to recipient wallet: <ADDRESS>
🔨 Creating SPL token with mint address: <MINT>
📊 Token parameters: { tokenOwner: <RECIPIENT>, payer: <SERVICE_WALLET> }
✅ Token mint, metadata created and tokens minted: <MINT>
```

**Without recipientWallet**:
```
📬 Tokens will be minted to service wallet (default behavior)
🔨 Creating SPL token with mint address: <MINT>
📊 Token parameters: { tokenOwner: <SERVICE_WALLET>, payer: <SERVICE_WALLET> }
✅ Token mint, metadata created and tokens minted: <MINT>
```

---

## Troubleshooting Common Issues

### Issue: "Недостаточно SOL на кошельке" (Insufficient SOL)
**Solution**: Fund the service wallet with at least 0.02 SOL on devnet

### Issue: "Invalid recipientWallet address"
**Solution**: Ensure the wallet address is a valid base58-encoded Solana public key (44 characters)

### Issue: Tokens not showing in client wallet
**Solution**: 
1. Wait 30-60 seconds for blockchain confirmation
2. Check the Solscan link from the response
3. Verify the `ataAddress` in the response matches the expected ATA for the client wallet
4. Ensure you're checking the correct network (devnet vs mainnet)

### Issue: Transaction fails with "Account does not exist"
**Solution**: This shouldn't happen as the `createAndMint` function creates the ATA automatically. If it does, check that the client wallet address is valid and accessible.

---

## Success Criteria

✅ **All tests pass**:
1. Backward compatibility (no recipientWallet) works
2. Valid recipient wallet receives tokens
3. Invalid wallet addresses are rejected
4. Service wallet pays fees in all cases
5. Logs show correct token owner
6. Solscan displays tokens correctly
7. Response includes correct `recipientWallet` field

---

## Test Report Template

```
Test Date: _______________
Tester: _______________
Environment: [ ] Local [ ] Devnet [ ] Mainnet

Test Case 1 (Backward Compatibility): [ ] Pass [ ] Fail
Test Case 2 (Valid Recipient): [ ] Pass [ ] Fail
Test Case 3 (Invalid Address): [ ] Pass [ ] Fail
Test Case 4 (Empty String): [ ] Pass [ ] Fail
Test Case 5 (Large Supply): [ ] Pass [ ] Fail
Integration Test: [ ] Pass [ ] Fail

Notes:
_______________________________________________
_______________________________________________
_______________________________________________
```
