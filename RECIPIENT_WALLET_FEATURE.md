# Recipient Wallet Feature for Token Creation

## Overview

The `/api/create-token` endpoint now supports an optional `recipientWallet` parameter that allows tokens to be minted directly to a client's wallet while the service wallet pays for the transaction.

## Problem Solved

Previously, when using `/api/create-token`:
- ❌ Service wallet paid fees
- ❌ Service wallet received tokens
- ❌ Client wallet received nothing

Now, with the `recipientWallet` parameter:
- ✅ Service wallet pays fees
- ✅ Client wallet receives tokens
- ✅ Client doesn't need to sign transactions

## Usage

### Basic Request (Original Behavior)

Without `recipientWallet`, tokens are minted to the service wallet (backward compatible):

```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Token",
    "symbol": "MTK",
    "uri": "https://gateway.pinata.cloud/ipfs/QmXXX...",
    "supply": "1000000",
    "decimals": "9",
    "revokeFreezeAuthority": true,
    "revokeMintAuthority": true
  }'
```

### New Request (With Recipient Wallet)

With `recipientWallet`, tokens are minted to the specified client wallet:

```bash
curl -X POST http://localhost:3000/api/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Token",
    "symbol": "MTK",
    "uri": "https://gateway.pinata.cloud/ipfs/QmXXX...",
    "supply": "1000000",
    "decimals": "9",
    "recipientWallet": "CLIENT_WALLET_PUBLIC_KEY_HERE",
    "revokeFreezeAuthority": true,
    "revokeMintAuthority": true
  }'
```

### Response

The API response now includes which wallet received the tokens:

```json
{
  "message": "Token and metadata successfully created.",
  "mintAddress": "TokenMintAddress...",
  "transactionSignature": "TransactionSignature...",
  "explorerLinkCreate": "https://explorer.solana.com/tx/...",
  "solscanTokenLink": "https://solscan.io/token/...",
  "solscanTxLink": "https://solscan.io/tx/...",
  "ataAddress": "AssociatedTokenAccountAddress...",
  "recipientWallet": "CLIENT_WALLET_PUBLIC_KEY_HERE"
}
```

If `recipientWallet` was not provided:

```json
{
  ...
  "recipientWallet": "service wallet"
}
```

## Frontend Integration Example

### JavaScript/TypeScript

```javascript
async function createTokenForClient(clientWalletAddress) {
  const response = await fetch('https://your-api.com/api/create-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Client Token',
      symbol: 'CTK',
      uri: 'https://gateway.pinata.cloud/ipfs/QmXXX...',
      supply: '1000000',
      decimals: '9',
      recipientWallet: clientWalletAddress, // Client's Solana wallet address
      revokeFreezeAuthority: true,
      revokeMintAuthority: true
    })
  });

  const result = await response.json();
  
  if (response.ok) {
    console.log('Token created!');
    console.log('Mint address:', result.mintAddress);
    console.log('Tokens sent to:', result.recipientWallet);
    console.log('View on Solscan:', result.solscanTokenLink);
  } else {
    console.error('Error:', result.error);
  }
}
```

### React Component Example

```jsx
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';

function CreateTokenForMeButton() {
  const { publicKey } = useWallet();

  const createToken = async () => {
    if (!publicKey) {
      alert('Please connect your wallet first!');
      return;
    }

    try {
      const response = await axios.post('https://your-api.com/api/create-token', {
        name: 'My Token',
        symbol: 'MTK',
        uri: 'https://gateway.pinata.cloud/ipfs/QmXXX...',
        supply: '1000000',
        decimals: '9',
        recipientWallet: publicKey.toBase58(), // Send tokens to connected wallet
        revokeFreezeAuthority: true,
        revokeMintAuthority: true
      });

      alert(`Token created! Mint: ${response.data.mintAddress}`);
      console.log('Solscan:', response.data.solscanTokenLink);
    } catch (error) {
      console.error('Error creating token:', error);
      alert('Failed to create token. Check console for details.');
    }
  };

  return (
    <button onClick={createToken} disabled={!publicKey}>
      Create Token to My Wallet
    </button>
  );
}
```

## Validation

The API validates the `recipientWallet` parameter:

- ✅ Must be a valid Solana public key (base58 encoded)
- ✅ If invalid, returns 400 error with message: "Invalid recipientWallet address"
- ✅ If omitted, uses service wallet (backward compatible)

## Use Cases

### When to Use `recipientWallet`

1. **User-owned tokens**: When building a service where users should own their tokens
2. **Token airdrops**: Distributing tokens to users without requiring them to pay fees
3. **Simplified UX**: Users get tokens without signing transactions
4. **Gasless creation**: Service pays for token creation on behalf of users

### When to Use Service Wallet (No `recipientWallet`)

1. **Platform tokens**: Creating tokens owned by the platform
2. **Testing**: Quick token creation for testing purposes
3. **Token pools**: Creating tokens for liquidity pools or staking

## Comparison: Service vs User Wallet Endpoints

| Feature | `/api/create-token` (with recipientWallet) | `/api/create-unsigned-token` |
|---------|-------------------------------------------|------------------------------|
| **Who signs?** | Backend (service wallet) | User (frontend) |
| **Who pays fees?** | Service | User |
| **Who receives tokens?** | Specified recipient | User |
| **User interaction** | None (just provide address) | Must sign transaction |
| **Decentralization** | ⭐ Semi-centralized | ⭐⭐⭐ Fully decentralized |
| **Setup complexity** | ⭐ Very simple | ⭐⭐ Moderate |
| **Use case** | Gasless token distribution | Full user control |

## Security Considerations

⚠️ **Important:**

1. **Service wallet security**: The service wallet pays for all transactions. Ensure it has sufficient SOL and is properly secured.

2. **Recipient validation**: Always validate that the `recipientWallet` address is correct before creating tokens. Once minted, tokens cannot be easily recalled.

3. **Rate limiting**: Consider implementing rate limiting to prevent abuse of the gasless token creation feature.

4. **Authority control**: The service wallet remains the mint and update authority unless explicitly revoked. Consider revoking authorities if users should have full control.

## Error Handling

### Common Errors

**"Invalid recipientWallet address"**
- The provided wallet address is not a valid Solana public key
- Solution: Verify the address format (base58 encoded, exactly 44 characters)

**"Недостаточно SOL на кошельке" (Insufficient SOL)**
- The service wallet doesn't have enough SOL to pay for the transaction
- Solution: Fund the service wallet with at least 0.01 SOL

**"Missing required fields"**
- Required fields (name, symbol, uri, supply, decimals) are missing
- Solution: Ensure all required fields are provided

## Support

For issues or questions about the recipient wallet feature:
1. Check that the recipient address is a valid Solana public key
2. Ensure the service wallet has sufficient SOL balance
3. Verify all required fields are provided
4. Check the API logs for detailed error messages

## Related Documentation

- [USER_WALLET_GUIDE.md](./USER_WALLET_GUIDE.md) - Full guide for user wallet-based token creation
- [README.md](./README.md) - General API documentation
