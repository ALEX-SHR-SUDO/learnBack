// src/metadata.service.js

// Мы сохраняем импорт * as Umi для всех служебных функций
import * as Umi from '@metaplex-foundation/umi'; 

import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as web3 from '@solana/web3.js'; 

import { createAndMint } from '@metaplex-foundation/mpl-token-metadata';


let umi;

/**
 * Ручная регистрация адресов программ Solana для Devnet.
 */
function registerDevnetPrograms(umiContext) {
    const programRepository = {
        // Стандартные программы Solana
        'splToken': Umi.publicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        'splAta': Umi.publicKey('ATokenGPvbdGV1bmQe1mqFaB1xfuDk9Rz22c4Ld9P9d'),
        
        // Программа Metaplex Token Metadata
        'mplTokenMetadata': Umi.publicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msFhoExbnw'),
    };
    
    // ✅ ФИНАЛЬНОЕ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Прямое присвоение
    // Это обходит ошибки .add() и .set(), что работает в самых старых версиях.
    umiContext.programs = programRepository; 
}


function initializeUmi(walletKeypair) {
    if (!walletKeypair) {
        throw new Error("Wallet Keypair required for Umi initialization.");
    }
    
    // 1. Создаем Umi
    umi = Umi.createUmi('https://api.devnet.solana.com');
        
    // 2. Ручная регистрация программ
    registerDevnetPrograms(umi); 
    
    // 3. Устанавливаем ключевые плагины
    umi.use(mplTokenMetadata()); 
    umi.use(Umi.keypairIdentity(walletKeypair)); 
    
    console.log(`Umi initialized. Payer: ${umi.identity.publicKey.toString()}`);
    
    return umi.identity; 
}


async function createTokenWithMetadata({ name, symbol, uri, decimals, supply }) {
    if (!umi) {
        throw new Error("Umi not initialized. Call initializeUmi first.");
    }
    
    const parsedDecimals = parseInt(decimals || 9);
    const parsedSupply = parseFloat(supply);
    const totalAmount = BigInt(Math.round(parsedSupply * Math.pow(10, parsedDecimals))); 
    
    const mintKeypair = web3.Keypair.generate(); 
    
    await createAndMint(umi, {
        mint: mintKeypair,
        // Authority берется из identity, которое уже является Umi Signer
        authority: umi.identity, 
        name: name,
        symbol: symbol,
        uri: uri,
        sellerFeeBasisPoints: 0, 
        decimals: parsedDecimals,
        amount: totalAmount,
        tokenOwner: umi.identity.publicKey, 
    }).sendAndConfirm(umi);
    
    return { mint: mintKeypair.publicKey.toString() };
}


// --- Экспорт ---
export {
    initializeUmi,
    createTokenWithMetadata
};