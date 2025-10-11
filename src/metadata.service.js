// src/metadata.service.js

import { createUmi } from '@metaplex-foundation/umi'; 
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createAndMint } from '@metaplex-foundation/mpl-token-metadata';

// ✅ НАДЕЖНОЕ РЕШЕНИЕ: Импортируем весь модуль адаптеров как объект
import * as umiAdapters from '@metaplex-foundation/umi-web3js-adapters';


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
    
    // 1. Используем umiAdapters для доступа к fromWeb3JsKeypair
    const umiPayer = umiAdapters.fromWeb3JsKeypair(walletKeypair);
    
    // 2. Инициализируем Umi
    umi = createUmi('https://api.devnet.solana.com') 
        // Используем самый распространенный вариант именования плагина web3js
        .use(umiAdapters.web3jsAdapter) 
        .use(mplTokenMetadata())  
        .identity(umiPayer)      
        .payer(umiPayer);        
    
    console.log(`Umi initialized. Payer: ${umi.identity.publicKey.toString()}`);
    
    return umiPayer; 
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