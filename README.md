# learnBack

Solana Token Backend API for creating and managing SPL tokens on Solana blockchain.

## Features

- Create SPL tokens with metadata
- Upload token logos to Pinata (IPFS)
- Check wallet balance and SPL tokens
- Revoke freeze authority
- Revoke mint authority

## API Endpoints

### Health Check
- `GET /api/ping` - Check Solana connection status

### Wallet Balance
- `GET /api/balance` - Get service wallet balance and SPL tokens
- `GET /api/wallet-balance` - Alternative endpoint for wallet balance

### Token Management
- `POST /api/create-token` - Create new SPL token with metadata
  ```json
  {
    "name": "Token Name",
    "symbol": "SYMBOL",
    "uri": "https://ipfs.io/...",
    "supply": "1000000",
    "decimals": "9"
  }
  ```

- `POST /api/upload-logo` - Upload token logo to Pinata

### Authority Management

#### Revoke Freeze Authority
- `POST /api/revoke-freeze-authority` - Revoke freeze authority for a token mint
  ```json
  {
    "mintAddress": "TokenMintPublicKey"
  }
  ```
  After revoking, no one will be able to freeze token accounts for this mint.

#### Revoke Mint Authority
- `POST /api/revoke-mint-authority` - Revoke mint authority for a token mint
  ```json
  {
    "mintAddress": "TokenMintPublicKey"
  }
  ```
  After revoking, no one will be able to mint new tokens. This makes the token supply fixed and immutable.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file with:
   ```
   SERVICE_SECRET_KEY=your_base58_private_key
   SOLANA_CLUSTER_URL=https://api.devnet.solana.com
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

## Tech Stack

- TypeScript
- Express.js
- Solana Web3.js
- @solana/spl-token
- Metaplex UMI SDK
- Pinata (IPFS)