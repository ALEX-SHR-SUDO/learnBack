// src/metadata-addition.service.ts

import { 
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    PublicKey,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL
} from "@solana/web3.js";

import {
    TOKEN_2022_PROGRAM_ID,
    createInitializeMintInstruction,
    createAssociatedTokenAccountIdempotent,
    mintTo,
    getAssociatedTokenAddressSync,
    getMintLen,
    ExtensionType,
    createInitializeMetadataPointerInstruction,
    TYPE_SIZE,
    LENGTH_SIZE,
} from "@solana/spl-token";

import { 
    createInitializeInstruction,
    createUpdateFieldInstruction,
    pack,
    TokenMetadata,
} from '@solana/spl-token-metadata';

import { getServiceWallet, getConnection } from './solana.service.js'; 
import { toBigInt } from './utils.js';

interface TokenDetails {
    name: string;
    symbol: string;
    uri: string;
    supply: string;
    decimals: string;
}

// --- Create SPL Token-2022 with native metadata extension for proper Solscan visibility ---
export async function createTokenAndMetadata(details: TokenDetails): Promise<{ mintAddress: string, ata: string, mintTx: string }> {
    const connection = getConnection();
    const payer = getServiceWallet();
    
    try {
        const supplyBigInt = toBigInt(details.supply, parseInt(details.decimals, 10));
        const decimalsNumber = parseInt(details.decimals, 10);

        // Check balance
        const balance = await connection.getBalance(payer.publicKey);
        const requiredBalance = 0.01 * LAMPORTS_PER_SOL; 
        if (balance < requiredBalance) { 
            throw new Error(`Недостаточно SOL на кошельке ${payer.publicKey.toBase58()}. Требуется минимум 0.01 SOL.`);
        }
        
        // Generate a new keypair for the mint account
        const mintKeypair = Keypair.generate();
        const mint = mintKeypair.publicKey;

        console.log(`🔨 Creating SPL Token-2022 with metadata extension`);
        console.log(`📍 Mint address: ${mint.toBase58()}`);
        console.log(`📊 Token parameters:`, {
            name: details.name,
            symbol: details.symbol,
            uri: details.uri,
            decimals: decimalsNumber,
            supply: supplyBigInt.toString(),
            tokenStandard: 'Fungible (Token-2022 with metadata extension)'
        });

        // Define the metadata for the token
        const metadata: TokenMetadata = {
            mint: mint,
            name: details.name,
            symbol: details.symbol,
            uri: details.uri,
            additionalMetadata: [],
        };

        // Calculate the space required for the mint account with metadata extension
        const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
        const metadataLen = pack(metadata).length;
        const mintLen = getMintLen([ExtensionType.MetadataPointer]);
        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataExtension + metadataLen);

        // Create transaction to:
        // 1. Create mint account with metadata pointer extension
        // 2. Initialize metadata pointer to point to the mint itself
        // 3. Initialize mint
        // 4. Initialize metadata
        const transaction = new Transaction().add(
            // Create account for the mint
            SystemProgram.createAccount({
                fromPubkey: payer.publicKey,
                newAccountPubkey: mint,
                space: mintLen,
                lamports,
                programId: TOKEN_2022_PROGRAM_ID,
            }),
            // Initialize the metadata pointer (points to the mint itself)
            createInitializeMetadataPointerInstruction(
                mint,
                payer.publicKey,
                mint, // Metadata account - pointing to the mint itself
                TOKEN_2022_PROGRAM_ID
            ),
            // Initialize the mint
            createInitializeMintInstruction(
                mint,
                decimalsNumber,
                payer.publicKey,
                null, // No freeze authority
                TOKEN_2022_PROGRAM_ID
            ),
            // Initialize the metadata inside the mint account
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
        );

        // Send and confirm the transaction
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [payer, mintKeypair],
            { commitment: 'confirmed' }
        );

        console.log(`✅ Token-2022 mint created with metadata extension`);
        console.log(`📝 Transaction signature: ${signature}`);

        // Create associated token account and mint tokens
        const associatedTokenAccount = await createAssociatedTokenAccountIdempotent(
            connection,
            payer,
            mint,
            payer.publicKey,
            { commitment: 'confirmed' },
            TOKEN_2022_PROGRAM_ID
        );

        console.log(`💰 Associated token account created: ${associatedTokenAccount.toBase58()}`);

        // Mint tokens to the associated token account
        const mintSignature = await mintTo(
            connection,
            payer,
            mint,
            associatedTokenAccount,
            payer.publicKey,
            supplyBigInt,
            [],
            { commitment: 'confirmed' },
            TOKEN_2022_PROGRAM_ID
        );

        console.log(`✨ Tokens minted successfully`);
        console.log(`📝 Mint transaction signature: ${mintSignature}`);
        console.log(`🔍 View token on Solscan: https://solscan.io/token/${mint.toBase58()}?cluster=devnet`);
        console.log(`🔍 View creation transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        console.log(`🔍 View mint transaction: https://explorer.solana.com/tx/${mintSignature}?cluster=devnet`);

        return {
            mintAddress: mint.toBase58(),
            ata: associatedTokenAccount.toBase58(),
            mintTx: signature
        };

    } catch (error: any) {
        console.error("❌ Token-2022 createTokenAndMetadata Error:", error);
        throw new Error(`Failed to create token and metadata: ${error.message || error}`);
    }
}
