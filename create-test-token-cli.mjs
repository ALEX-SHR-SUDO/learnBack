#!/usr/bin/env node
/**
 * Token Creation Test Script
 * Demonstrates the fixed Metaplex metadata implementation
 * 
 * Usage: node create-test-token-cli.mjs [--api-url http://localhost:3000]
 */

import { readFileSync } from 'fs';
import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createAndMint, TokenStandard, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { keypairIdentity, generateSigner, percentAmount } from '@metaplex-foundation/umi';
import axios from 'axios';
import FormData from 'form-data';

// Configuration
const CLUSTER_URL = 'https://api.devnet.solana.com';
const PINATA_API_KEY = process.env.PINATA_API_KEY || 'fd68b61b17f1bb064a1d';
const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY || 'edfabbe03a0af57541a45097b48fa24b9e948090f12df3e2b11b06179c02e4b9';

console.log('================================================');
console.log('Token Creation Test - Metaplex Metadata Fix');
console.log('================================================\n');

// Load service wallet
let serviceKeypair;
try {
  const secretKeyArray = JSON.parse(readFileSync('./service_wallet.json', 'utf-8'));
  serviceKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
  console.log('🔑 Service Wallet:', serviceKeypair.publicKey.toBase58());
} catch (error) {
  console.error('❌ Failed to load service wallet:', error.message);
  console.error('   Make sure service_wallet.json exists in the current directory');
  process.exit(1);
}

// Check balance
const connection = new Connection(CLUSTER_URL, 'confirmed');
let balance;
try {
  balance = await connection.getBalance(serviceKeypair.publicKey);
  console.log('💰 Current Balance:', (balance / LAMPORTS_PER_SOL).toFixed(4), 'SOL\n');
  
  if (balance < 10000000) { // 0.01 SOL
    console.log('⚠️  Warning: Low balance!');
    console.log('   Minimum recommended: 0.01 SOL');
    console.log('   Airdrop command:');
    console.log(`   solana airdrop 1 ${serviceKeypair.publicKey.toBase58()} --url devnet`);
    console.log('   Or visit: https://faucet.solana.com/\n');
    
    // Exit if balance too low
    if (balance < 5000000) {
      console.error('❌ Balance too low to proceed. Please fund the wallet first.');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Failed to check balance:', error.message);
  console.error('   This might be due to network connectivity issues');
  console.error('   Please ensure you have internet access and Solana devnet is operational\n');
  process.exit(1);
}

// Step 1: Create logo
console.log('Step 1: Creating token logo...');
const logoContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#grad)" rx="20"/>
  <text x="100" y="120" font-size="80" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">TM</text>
</svg>`;
console.log('✅ Logo created\n');

// Step 2: Upload logo to IPFS
console.log('Step 2: Uploading logo to IPFS...');
let logoIpfsUrl;
try {
  const formData = new FormData();
  formData.append('file', Buffer.from(logoContent), { filename: 'token-logo.svg' });
  
  const response = await axios.post(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    formData,
    {
      maxBodyLength: Infinity,
      headers: {
        ...formData.getHeaders(),
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET,
      },
    }
  );
  
  logoIpfsUrl = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
  console.log('✅ Logo uploaded:', logoIpfsUrl, '\n');
} catch (error) {
  console.error('❌ Failed to upload logo:', error.response?.data || error.message);
  process.exit(1);
}

// Step 3: Create and upload metadata
console.log('Step 3: Creating and uploading metadata to IPFS...');
const metadata = {
  name: 'Test Metadata Token',
  symbol: 'TMT',
  description: 'A test token created to verify metadata display on Solscan after implementing the Metaplex fix',
  image: logoIpfsUrl,
  attributes: [
    { trait_type: 'Purpose', value: 'Testing' },
    { trait_type: 'Network', value: 'Devnet' },
    { trait_type: 'Created', value: new Date().toISOString() }
  ],
  properties: {
    files: [{ uri: logoIpfsUrl, type: 'image/svg+xml' }],
    category: 'image',
    creators: []
  }
};

let metadataUri;
try {
  const formData = new FormData();
  formData.append('file', Buffer.from(JSON.stringify(metadata, null, 2)), { filename: 'metadata.json' });
  
  const response = await axios.post(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    formData,
    {
      maxBodyLength: Infinity,
      headers: {
        ...formData.getHeaders(),
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET,
      },
    }
  );
  
  metadataUri = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
  console.log('✅ Metadata uploaded:', metadataUri, '\n');
} catch (error) {
  console.error('❌ Failed to upload metadata:', error.response?.data || error.message);
  process.exit(1);
}

// Step 4: Create token with metadata
console.log('Step 4: Creating token with metadata on Solana...');
console.log('This may take 30-60 seconds...\n');

try {
  // Initialize Umi - Using the fixed implementation from metadata-addition.service.ts
  const umi = createUmi(CLUSTER_URL);
  umi.use(mplTokenMetadata());
  
  // Convert web3.js keypair to Umi keypair
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(serviceKeypair.secretKey);
  umi.use(keypairIdentity(umiKeypair));
  
  // Generate mint signer
  const mint = generateSigner(umi);
  
  console.log('📊 Token Parameters:');
  console.log('   Name: Test Metadata Token');
  console.log('   Symbol: TMT');
  console.log('   Decimals: 9');
  console.log('   Supply: 1,000,000 TMT');
  console.log('   Mint Address:', mint.publicKey);
  console.log('   Metadata URI:', metadataUri);
  console.log('');
  
  // Create token with metadata - Using createAndMint as per Metaplex guide
  const result = await createAndMint(umi, {
    mint,
    authority: umiKeypair,
    name: 'Test Metadata Token',
    symbol: 'TMT',
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    decimals: 9,
    tokenStandard: TokenStandard.Fungible,
    isMutable: true,
    updateAuthority: umiKeypair.publicKey,
    amount: BigInt(1000000000000000), // 1,000,000 tokens with 9 decimals
    tokenOwner: umiKeypair.publicKey,
  }).sendAndConfirm(umi);
  
  console.log('================================================');
  console.log('✅ TOKEN CREATED SUCCESSFULLY!');
  console.log('================================================\n');
  
  console.log('Token Details:');
  console.log('  Name: Test Metadata Token');
  console.log('  Symbol: TMT');
  console.log('  Decimals: 9');
  console.log('  Supply: 1,000,000 TMT\n');
  
  console.log('Addresses:');
  console.log('  Mint:', mint.publicKey);
  console.log('  Owner:', serviceKeypair.publicKey.toBase58(), '\n');
  
  console.log('Transaction:');
  console.log('  Signature:', result.signature, '\n');
  
  console.log('🔗 View on Explorers:');
  console.log('  Solscan (Token):', `https://solscan.io/token/${mint.publicKey}?cluster=devnet`);
  console.log('  Solscan (TX):', `https://solscan.io/tx/${result.signature}?cluster=devnet`);
  console.log('  Solana Explorer:', `https://explorer.solana.com/tx/${result.signature}?cluster=devnet\n`);
  
  console.log('Metadata:');
  console.log('  Logo:', logoIpfsUrl);
  console.log('  Metadata:', metadataUri, '\n');
  
  console.log('================================================');
  console.log('Verification Steps:');
  console.log('================================================');
  console.log('1. Wait 1-2 minutes for Solscan to index');
  console.log('2. Open the Solscan token link above');
  console.log('3. Verify these are displayed:');
  console.log('   ✓ Token name: Test Metadata Token');
  console.log('   ✓ Token symbol: TMT');
  console.log('   ✓ Token logo (purple gradient)');
  console.log('   ✓ Description and attributes');
  console.log('   ✓ Supply: 1,000,000');
  console.log('   ✓ Decimals: 9\n');
  console.log('If all metadata is visible, the fix works! 🎉');
  console.log('================================================\n');
  
} catch (error) {
  console.error('\n❌ Failed to create token:', error.message);
  if (error.logs) {
    console.error('\nTransaction logs:', error.logs);
  }
  console.error('\nThis might be due to:');
  console.error('  - Insufficient balance');
  console.error('  - Network connectivity issues');
  console.error('  - Solana devnet being unavailable');
  process.exit(1);
}
