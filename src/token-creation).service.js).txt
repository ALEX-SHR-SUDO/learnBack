// src/token-creation.service.js

import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'; 
import * as splToken from '@solana/spl-token';
import { getServiceKeypair, getConnection } from "./solana.service.js";

/**
 * Создает Mint-аккаунт, ATA и минтит начальное предложение.
 * @returns {Promise<web3.PublicKey>} Адрес нового Mint-аккаунта.
 */
export async function createTokenAndMint({ decimals, supply }) { 
    const serviceKeypair = getServiceKeypair();
    const connection = getConnection();
    const payer = serviceKeypair;

    const parsedDecimals = Number(decimals);
    const parsedSupply = Number(supply);
    
    if (isNaN(parsedDecimals) || isNaN(parsedSupply) || parsedSupply <= 0) {
        throw new Error("Invalid decimals or supply provided.");
    }

    const initialSupply = BigInt(parsedSupply) * BigInt(10 ** parsedDecimals);

    console.log(`[ШАГ 1] Попытка создать Mint-аккаунт.`);

    try {
        // --- 1. Создание Mint-аккаунта ---
        const mintAddress = await splToken.createMint(
            connection,
            payer,
            payer.publicKey, // Mint Authority
            payer.publicKey, // Freeze Authority
            parsedDecimals,
            undefined,
            splToken.TOKEN_PROGRAM_ID
        );

        console.log(`✅ [ШАГ 1] Mint-аккаунт создан: ${mintAddress.toBase58()}`);

        // --- 2. Создание Associated Token Account (ATA) ---
        const tokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mintAddress,
            payer.publicKey 
        );

        console.log(`[ШАГ 2] Associated Token Account (ATA) создан.`);
        
        // --- 3. Минтинг начального предложения ---
        await splToken.mintTo(
            connection,
            payer,
            mintAddress,
            tokenAccount.address,
            payer, // Mint Authority
            initialSupply,
            []
        );

        console.log(`✅ [ШАГ 3] Начальное предложение отчеканено.`);
        
        return mintAddress;

    } catch (error) {
        console.error("❌ Ошибка в createTokenAndMint:", error);
        throw new Error(`Не удалось создать Mint-аккаунт: ${error.message}`);
    }
}
