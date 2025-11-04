# learnBack

Solana Token Backend API for creating and managing SPL tokens on Solana blockchain.

## ⚠️ Important: Solscan Metadata Display

**If your tokens are not showing name/logo on Solscan**, make sure you are using the **`/api/generate-metadata`** endpoint to create your metadata. Do NOT manually create metadata.json files, as they may not follow the complete Metaplex Token Metadata Standard required by Solscan.

**Recent Fix (Nov 2024):** We fixed an issue where fungible tokens included NFT-specific fields (`creators`, `collection`, `uses`) in their on-chain metadata, which prevented Solscan from properly displaying token information. This has been resolved - new tokens will display correctly on Solscan. See [CREATORS_FIELD_FIX.md](./CREATORS_FIELD_FIX.md) for technical details.

**Correct workflow:**
1. ✅ Call `/api/generate-metadata` with your logo → Get metadataUri
2. ✅ Call `/api/create-token` with the metadataUri
3. ✅ Token displays correctly on Solscan!

**Incorrect workflow:**
1. ❌ Manually upload logo to `/api/upload-logo`
2. ❌ Manually create metadata.json 
3. ❌ Upload metadata.json to `/api/upload-logo`
4. ❌ Create token → Metadata may NOT display on Solscan!

See [SOLSCAN_FIX.md](./SOLSCAN_FIX.md) and [CREATORS_FIELD_FIX.md](./CREATORS_FIELD_FIX.md) for detailed documentation.

## Features

- Create SPL tokens with metadata
- **NEW:** Auto-generate Metaplex-compliant metadata for proper Solscan display
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
- `POST /api/generate-metadata` - **NEW!** Generate proper Metaplex metadata for Solscan
  ```bash
  # Upload logo and generate metadata in one step
  curl -X POST /api/generate-metadata \
    -F "file=@logo.png" \
    -F "name=Token Name" \
    -F "symbol=SYMBOL" \
    -F "description=Token description"
  ```
  This endpoint ensures your token metadata is properly formatted for display on Solscan and other explorers.

- `POST /api/create-token` - Create new SPL token with metadata
  ```json
  {
    "name": "Token Name",
    "symbol": "SYMBOL",
    "uri": "https://gateway.pinata.cloud/ipfs/...",
    "supply": "1000000",
    "decimals": "9"
  }
  ```
  **Tip:** Use the `metadataUri` from `/api/generate-metadata` for the `uri` field to ensure proper Solscan display.

- `POST /api/upload-logo` - Upload token logo to Pinata (legacy endpoint)

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

## License

MIT