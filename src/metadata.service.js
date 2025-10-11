// src/metadata.service.js

import { createUmi } from '@metaplex-foundation/umi'; 
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { fromWeb3JsKeypair, web3jsAdaptor } from '@metaplex-foundation/umi-web3js-adapters'; 
import { createAndMint } from '@metaplex-foundation/mpl-token-metadata';


let umi;

/**
 * Инициализирует Umi с кошельком (payer) и устанавливает необходимые плагины.
 */
function initializeUmi(walletKeypair) {
    if (!walletKeypair) {
        throw new Error("Wallet Keypair required for Umi initialization.");
    }
    
    // 1. Конвертируем web3.js Keypair в Umi Keypair
    const umiPayer = fromWeb3JsKeypair(walletKeypair);
    
    // 2. Инициализируем Umi с чистыми плагинами (теперь это работает!)
    umi = createUmi('https://api.devnet.solana.com') 
        .use(web3JsAdaptor)       // Объект-плагин
        .use(mplTokenMetadata())  // Функция-плагин
        // Устанавливаем Payer/Signer
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
    const totalAmount = BigInt(Math.round(parsedSupply * Math.pow(10, parsedDecimals))); 
    
    const mintKeypair = umiPayer; 

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