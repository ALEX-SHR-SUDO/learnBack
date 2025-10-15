// src/token-creation.service.js

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'; 
import pkg from '@metaplex-foundation/mpl-token-metadata'; 
import * as Umi from '@metaplex-foundation/umi'; 
const { mplTokenMetadata, updateMetadata } = pkg; // <--- НОВЫЙ СИНТАКСИС


let umi;

function initializeUmi(walletKeypair) {
    if (!walletKeypair) {
        throw new Error("Wallet Keypair required for Umi initialization.");
    }
    
    umi = createUmi('https://api.devnet.solana.com'); 
    umi.use(mplTokenMetadata()); 
    umi.use(Umi.keypairIdentity(walletKeypair)); 
    
    console.log(`Umi initialized. Payer: ${umi.identity.publicKey.toString()}`);
    return umi.identity; 
}

/**
 * Создает Mint-аккаунт и выполняет первоначальный минтинг.
 * Возвращает адрес нового Mint-аккаунта.
 */
async function createToken({ decimals, supply }) {
   
    // --- Расчет Supply ---
    const parsedDecimals = parseInt(decimals) || 9;
    const parsedSupply = parseFloat(supply || 0);
    
    const amountFloat = parsedSupply * Math.pow(10, parsedDecimals);
    // Umi принимает BigInt для низкоуровневых функций
    const totalAmount = isNaN(amountFloat) 
        ? BigInt(0) 
        : BigInt(Math.round(amountFloat));
    
    const mintKeypair = umi.eddsa.generateKeypair();
    const mintAddress = mintKeypair.publicKey.toString();

    console.log(`[ШАГ 1] Попытка создать Mint-аккаунт: ${mintAddress}`);

    // ==========================================================
    // НИЗКОУРОВНЕВАЯ ФУНКЦИЯ: Создание Mint-аккаунта и минтинг
    // ==========================================================
    await createMint(umi, {
        mint: mintKeypair,
        decimals: parsedDecimals,
        
        // authority: Для минтинга и закрытия
        authority: umi.identity.publicKey, 
        
        // tokenOwner: Владелец, которому будут перечислены токены
        tokenOwner: umi.identity.publicKey, 
        
        // amount: Количество токенов для минтинга (как BigInt)
        amount: totalAmount, 
        
        // updateAuthority: Authority, который сможет обновлять метаданные (нужен для Шага 2)
        updateAuthority: umi.identity.publicKey,
        
    }).sendAndConfirm(umi);
    
    console.log(`✅ [ШАГ 1] Токен создан и отчеканен. Адрес Mint: ${mintAddress}`);

    return { mint: mintAddress };
}


// --- Экспорт ---
export {
    initializeUmi,
    createToken
};