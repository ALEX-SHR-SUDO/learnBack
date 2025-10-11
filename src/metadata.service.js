// src/metadata.service.js

import { createUmi } from '@metaplex-foundation/umi'; 
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';

// ✅ ИСПОЛЬЗУЕМ СТАНДАРТНЫЙ ПЛАГИН: keypairIdentity
import { keypairIdentity, signerIdentity } from '@metaplex-foundation/umi'; 
// ✅ ИСПОЛЬЗУЕМ БАЗОВЫЕ ФУНКЦИИ web3.js
import * as web3 from '@solana/web3.js'; 

import { createAndMint } from '@metaplex-foundation/mpl-token-metadata';


let umi;

/**
 * Инициализирует Umi с кошельком (payer) и устанавливает необходимые плагины.
 * * Мы используем 'umiAdapters.web3jsAdapter' как самый вероятный экспортируемый объект.
 * Если плагин не будет найден, вам придется поменять его на 'umiAdapters.web3JsAdapter'
 * (с заглавной 'J'), так как регистр в этой библиотеке очень нестабилен.
 */
function initializeUmi(walletKeypair) {
    if (!walletKeypair) {
        throw new Error("Wallet Keypair required for Umi initialization.");
    }

    // 1. Создаем Umi
    umi = createUmi('https://api.devnet.solana.com'); 
        
    // 2. Устанавливаем идентичность (Payer/Signer)
    // ✅ КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: Используем стандартный keypairIdentity, который не ломается
    umi.use(mplTokenMetadata()); 
    umi.use(keypairIdentity(walletKeypair)); 
    
    // Примечание: В современных версиях Umi, keypairIdentity автоматически устанавливает payer.
    
    console.log(`Umi initialized. Payer: ${umi.identity.publicKey.toString()}`);
    
    // Поскольку мы удалили проблемный адаптер, нам больше не нужен umiPayer из него.
    // Возвращаем просто публичный ключ.
    return umi.identity; 
}


/**
 * Создает токен и минтит его с метаданными.
 */
async function createTokenWithMetadata({ umiPayer, name, symbol, uri, decimals, supply }) {
    if (!umi) {
        throw new Error("Umi not initialized. Call initializeUmi first.");
    }
    
    const parsedDecimals = parseInt(decimals || 9);
    const parsedSupply = parseFloat(supply);
    // Рассчитываем общее количество токенов в BigInt (для точности)
    const totalAmount = BigInt(Math.round(parsedSupply * Math.pow(10, parsedDecimals))); 
    
    const mintKeypair = umiPayer; 

    // Создание токена и минтинг в одной транзакции
    await createAndMint(umi, {
        mint: mintKeypair,
        authority: mintKeypair,
        name: name,
        symbol: symbol,
        uri: uri,
        sellerFeeBasisPoints: 0, 
        decimals: parsedDecimals,
        amount: totalAmount,
        tokenOwner: mintKeypair.publicKey,
    }).sendAndConfirm(umi);
    
    return { mint: mintKeypair.publicKey.toString() };
}


// --- Экспорт ---
export {
    initializeUmi,
    createTokenWithMetadata
};