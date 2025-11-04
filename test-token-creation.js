#!/usr/bin/env node

/**
 * Test script to create a token with metadata on Solana devnet
 * This demonstrates that the metadata fix is working correctly
 * 
 * Run this script in an environment with network access to Solana devnet:
 * node test-token-creation.js
 */

import { Connection, Keypair } from '@solana/web3.js';
import { createUmi, keypairIdentity, generateSigner, sol, percentAmount } from '@metaplex-foundation/umi';
import { defaultPlugins } from '@metaplex-foundation/umi-bundle-defaults';
import { createAndMint, TokenStandard, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Helper function to convert amount to bigint with decimals
function toBigInt(amount, decimals) {
    const multiplier = BigInt(10 ** decimals);
    const [whole, fraction = '0'] = amount.toString().split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').substring(0, decimals);
    return BigInt(whole) * multiplier + BigInt(paddedFraction);
}

async function main() {
    console.log('🚀 Starting token creation test with metadata...\n');

    // Load service wallet
    let serviceWallet;
    const walletPath = './service_wallet.json';
    
    try {
        // Validate the wallet file exists in the current directory
        if (!fs.existsSync(walletPath)) {
            throw new Error('service_wallet.json not found in current directory');
        }
        
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
        
        if (!Array.isArray(walletData) || walletData.length !== 64) {
            throw new Error('Invalid wallet file format. Expected array of 64 bytes.');
        }
        
        serviceWallet = Keypair.fromSecretKey(Uint8Array.from(walletData));
        console.log(`✅ Service wallet loaded: ${serviceWallet.publicKey.toBase58()}\n`);
    } catch (e) {
        console.error('❌ Failed to load service wallet:', e.message);
        console.error('   Make sure service_wallet.json exists in the current directory');
        process.exit(1);
    }

    // Initialize connection
    const rpcUrl = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    try {
        const version = await connection.getVersion();
        console.log('✅ Connected to Solana cluster:', version);
    } catch (e) {
        console.error('❌ Failed to connect to Solana:', e.message);
        process.exit(1);
    }

    // Check balance
    try {
        const balance = await connection.getBalance(serviceWallet.publicKey);
        const balanceSOL = balance / 1e9;
        console.log(`💰 Wallet balance: ${balanceSOL} SOL`);
        
        if (balanceSOL < 0.01) {
            console.error(`\n❌ Insufficient balance. Need at least 0.01 SOL.`);
            console.error(`   Airdrop SOL to: ${serviceWallet.publicKey.toBase58()}`);
            console.error(`   Visit: https://faucet.solana.com/`);
            process.exit(1);
        }
        console.log('');
    } catch (e) {
        console.error('❌ Failed to get balance:', e.message);
        process.exit(1);
    }

    // Initialize Umi
    const umi = createUmi(rpcUrl);
    umi.use(defaultPlugins());
    umi.use(mplTokenMetadata());

    // Convert web3.js keypair to Umi keypair
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(serviceWallet.secretKey);
    umi.use(keypairIdentity(umiKeypair));

    // Token parameters - using a simple metadata URI for testing
    // Note: In production, upload your metadata to IPFS or other permanent storage
    const tokenName = 'Test Token Metadata Fix';
    const tokenSymbol = 'TESTFIX';
    // Using a stable Solana logo as test image
    // Replace with your own metadata URI that includes name, symbol, image, description
    const tokenUri = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';
    const decimals = 9;
    const supply = '1000000'; // 1 million tokens
    
    console.log('📊 Token parameters:');
    console.log(`   Name: ${tokenName}`);
    console.log(`   Symbol: ${tokenSymbol}`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Supply: ${supply}`);
    console.log(`   URI: ${tokenUri}`);
    console.log('');

    // Generate mint keypair
    const mint = generateSigner(umi);
    console.log(`🔑 Generated mint address: ${mint.publicKey}\n`);

    // Create token with metadata
    console.log('⏳ Creating token and metadata...');
    try {
        const supplyBigInt = toBigInt(supply, decimals);
        
        const result = await createAndMint(umi, {
            mint,
            authority: umiKeypair,
            name: tokenName,
            symbol: tokenSymbol,
            uri: tokenUri,
            sellerFeeBasisPoints: percentAmount(0),
            decimals: decimals,
            tokenStandard: TokenStandard.Fungible,
            isMutable: true,
            updateAuthority: umiKeypair.publicKey,
            amount: supplyBigInt,
            tokenOwner: umiKeypair.publicKey,
        }).sendAndConfirm(umi);

        console.log('✅ Token created successfully!\n');
        console.log('📝 Transaction Details:');
        console.log(`   Signature: ${result.signature}`);
        console.log(`   Mint Address: ${mint.publicKey}\n`);
        
        console.log('🔗 View on explorers:');
        console.log(`   Solscan Token: https://solscan.io/token/${mint.publicKey}?cluster=devnet`);
        console.log(`   Solscan TX: https://solscan.io/tx/${result.signature}?cluster=devnet`);
        console.log(`   Solana Explorer: https://explorer.solana.com/tx/${result.signature}?cluster=devnet\n`);
        
        console.log('✅ SUCCESS! Token metadata should be visible on Solscan.');
        console.log('   Wait 1-2 minutes for indexing, then check the Solscan link above.\n');

    } catch (e) {
        console.error('\n❌ Failed to create token:', e.message);
        if (e.logs) {
            console.error('Transaction logs:', e.logs);
        }
        process.exit(1);
    }
}

main().catch(console.error);
