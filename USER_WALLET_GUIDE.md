# User Wallet Token Creation Guide

## Overview

This guide explains how to create Solana SPL tokens using your own wallet (user wallet) instead of the service wallet. With this approach:

- 🔐 **User signs transactions** - You maintain full control
- 💰 **User pays fees** - Transaction costs come from your wallet
- 🎯 **User is authority** - You are the mint and update authority
- ⛓️ **Fully onchain** - Metadata is created onchain properly

## When to Use User Wallet vs Service Wallet

### Use User Wallet When:
- ✅ Building a decentralized application
- ✅ Users need to own and control their tokens
- ✅ You want users to pay their own transaction fees
- ✅ You need maximum decentralization

### Use Service Wallet When:
- ✅ Building a centralized service
- ✅ You want to abstract blockchain complexity from users
- ✅ You want to pay fees on behalf of users
- ✅ You need faster integration (no frontend signing needed)

## API Workflow

### Step 1: Generate Metadata
First, create proper Metaplex-compliant metadata:

```bash
curl -X POST http://localhost:3000/api/generate-metadata \
  -F "file=@logo.png" \
  -F "name=My Token" \
  -F "symbol=MTK" \
  -F "description=My awesome token"
```

Response:
```json
{
  "metadataUri": "https://gateway.pinata.cloud/ipfs/QmXXX...",
  "imageUrl": "https://gateway.pinata.cloud/ipfs/QmYYY..."
}
```

### Step 2: Create Unsigned Transaction

**IMPORTANT:** Before calling this endpoint, you must generate a mint keypair on the client side. This is more secure than having the backend generate it.

```javascript
// Frontend: Generate mint keypair
import { Keypair } from '@solana/web3.js';

const mintKeypair = Keypair.generate();
const mintPublicKey = mintKeypair.publicKey.toBase58();
```

Then create an unsigned transaction for token creation:

```bash
curl -X POST http://localhost:3000/api/create-unsigned-token \
  -H "Content-Type: application/json" \
  -d '{
    "userPublicKey": "YourWalletPublicKeyHere",
    "mintPublicKey": "GeneratedMintPublicKeyHere",
    "name": "My Token",
    "symbol": "MTK",
    "uri": "https://gateway.pinata.cloud/ipfs/QmXXX...",
    "supply": "1000000",
    "decimals": "9"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Transaction created successfully. Sign with your wallet and submit.",
  "transaction": "base64EncodedUnsignedTransaction",
  "mintAddress": "MintPublicKeyYouProvided",
  "instructions": [
    "1. The mint keypair was generated on your client and must be used to sign this transaction",
    "2. Sign the transaction with both the mint keypair and your user wallet",
    "3. Submit the signed transaction to /api/submit-signed-transaction",
    "4. The token will be created and minted to your wallet"
  ],
  "network": "devnet",
  "solscanTokenLink": "https://solscan.io/token/..."
}
```

### Step 3: Sign Transaction (Frontend)
In your frontend application, sign the transaction:

```javascript
import { Transaction, Connection, Keypair } from '@solana/web3.js';

// Get the unsigned transaction from the API response
const transactionBuffer = Buffer.from(response.transaction, 'base64');
const transaction = Transaction.from(transactionBuffer);

// Use the mint keypair you generated in Step 2
// (mintKeypair was already created before calling the API)

// Sign with mint keypair
transaction.partialSign(mintKeypair);

// Sign with user's wallet (example using Phantom wallet)
if (window.solana && window.solana.isPhantom) {
  const signedTransaction = await window.solana.signTransaction(transaction);
  
  // Serialize the signed transaction
  const signedTxBase64 = signedTransaction.serialize().toString('base64');
  
  // Continue to Step 4...
}
```

### Step 4: Submit Signed Transaction
Submit the signed transaction to the blockchain:

```bash
curl -X POST http://localhost:3000/api/submit-signed-transaction \
  -H "Content-Type: application/json" \
  -d '{
    "signedTransaction": "base64EncodedSignedTransaction",
    "mintAddress": "TokenMintAddressFromStep2"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Transaction confirmed successfully",
  "transactionSignature": "TransactionSignatureHere",
  "explorerLink": "https://explorer.solana.com/tx/...",
  "solscanTxLink": "https://solscan.io/tx/...",
  "mintAddress": "TokenMintAddress",
  "solscanTokenLink": "https://solscan.io/token/..."
}
```

## Frontend Integration Example

### React + Solana Wallet Adapter

```jsx
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, Keypair } from '@solana/web3.js';
import axios from 'axios';

function CreateTokenButton() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const createToken = async () => {
    if (!publicKey || !signTransaction) {
      alert('Please connect your wallet first!');
      return;
    }

    try {
      // Step 0: Generate mint keypair on client
      const mintKeypair = Keypair.generate();
      const mintPublicKey = mintKeypair.publicKey.toBase58();

      // Step 1: Generate metadata (upload logo)
      const formData = new FormData();
      formData.append('file', logoFile);
      formData.append('name', 'My Token');
      formData.append('symbol', 'MTK');
      formData.append('description', 'My awesome token');

      const metadataRes = await axios.post(
        'http://localhost:3000/api/generate-metadata',
        formData
      );
      const metadataUri = metadataRes.data.metadataUri;

      // Step 2: Create unsigned transaction
      const unsignedTxRes = await axios.post(
        'http://localhost:3000/api/create-unsigned-token',
        {
          userPublicKey: publicKey.toBase58(),
          mintPublicKey: mintPublicKey,
          name: 'My Token',
          symbol: 'MTK',
          uri: metadataUri,
          supply: '1000000',
          decimals: '9'
        }
      );

      // Step 3: Sign transaction
      const txBuffer = Buffer.from(unsignedTxRes.data.transaction, 'base64');
      const transaction = Transaction.from(txBuffer);

      // Sign with mint keypair (generated on client)
      transaction.partialSign(mintKeypair);

      // Sign with user wallet
      const signedTx = await signTransaction(transaction);
      const signedTxBase64 = signedTx.serialize().toString('base64');

      // Step 4: Submit signed transaction
      const submitRes = await axios.post(
        'http://localhost:3000/api/submit-signed-transaction',
        {
          signedTransaction: signedTxBase64,
          mintAddress: unsignedTxRes.data.mintAddress
        }
      );

      alert(`Token created! Mint: ${submitRes.data.mintAddress}`);
      console.log('Solscan:', submitRes.data.solscanTokenLink);
    } catch (error) {
      console.error('Error creating token:', error);
      alert('Failed to create token. Check console for details.');
    }
  };

  return <button onClick={createToken}>Create Token with My Wallet</button>;
}
```

## Requirements

### User Wallet Requirements
- Wallet must have sufficient SOL for transaction fees (approximately 0.01-0.02 SOL)
- Wallet must be connected and able to sign transactions
- Wallet must support Solana devnet (or mainnet for production)

### Frontend Requirements
- Solana wallet adapter or equivalent wallet connection library
- Ability to sign transactions client-side
- `@solana/web3.js` library
- `bs58` library (for base58 encoding/decoding)

## Security Notes

⚠️ **Important Security Considerations:**

1. **Mint Keypair Generation**: ✅ **SECURE APPROACH**
   - The mint keypair is generated on the client side (your frontend)
   - The private key never leaves your browser
   - Only the public key is sent to the backend
   - This is the most secure approach for decentralized applications

2. **Transaction Signing**: The transaction must be signed by both:
   - The mint keypair (for mint account creation)
   - The user's wallet (as payer and authority)

3. **Authority Control**: After creation, the user is the:
   - Mint authority (can mint more tokens)
   - Update authority (can update metadata)
   - Initial token owner (receives the minted supply)

4. **HTTPS in Production**: Always use HTTPS in production to:
   - Encrypt API communications
   - Protect transaction data in transit
   - Prevent man-in-the-middle attacks
   - Mint authority (can mint more tokens)
   - Update authority (can update metadata)
   - Initial token owner (receives the minted supply)

## Troubleshooting

### Common Issues

**"User rejected the transaction"**
- User declined to sign in their wallet. Ask them to approve.

**"Insufficient funds"**
- User's wallet doesn't have enough SOL. They need at least ~0.02 SOL for devnet.

**"Transaction simulation failed"**
- Check that all required fields are provided
- Ensure metadata URI is accessible
- Verify the user's public key is valid

**"Blockhash not found"**
- The transaction expired before signing. Create a new transaction and sign it quickly.

## Comparison: Service Wallet vs User Wallet

| Feature | Service Wallet | User Wallet |
|---------|---------------|-------------|
| **Who signs?** | Backend | User (frontend) |
| **Who pays fees?** | Service | User |
| **Who owns token?** | Service | User |
| **Decentralization** | ❌ Centralized | ✅ Decentralized |
| **Setup complexity** | ⭐ Simple | ⭐⭐ Moderate |
| **User experience** | Fast, no wallet needed | Requires wallet connection |
| **Use case** | Centralized services | Decentralized apps |

## Support

For issues or questions:
- Check the console logs for detailed error messages
- Ensure your wallet has sufficient SOL
- Verify metadata URI is accessible
- Test on devnet before using mainnet

## Next Steps

After creating your token:
1. ✅ View on Solscan: Token should display name, symbol, and logo
2. ✅ Transfer tokens: Use standard SPL token transfer methods
3. ✅ Revoke authorities: Call `/api/revoke-mint-authority` or `/api/revoke-freeze-authority` if needed
4. ✅ List on DEX: Your token can be traded on decentralized exchanges
