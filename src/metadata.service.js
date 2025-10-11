// src/metadata.service.js

// ⚠️ ИСПРАВЛЕНИЕ ИМПОРТА METAPLEX UMI: 
// 1. Убеждаемся, что получаем нужные функции
const { createUmi } = require('@metaplex-foundation/umi'); 
const { mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');

// 2. Получаем весь объект адаптеров, чтобы избежать проблем с деструктуризацией.
const umiWeb3jsAdapters = require('@metaplex-foundation/umi-web3js-adapters');
// Получаем нужные константы из полученного объекта
const fromWeb3JsKeypair = umiWeb3jsAdapters.fromWeb3JsKeypair;
const web3JsAdaptor = umiWeb3jsAdapters.web3JsAdaptor; 


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
    
    // 2. Инициализируем Umi
    umi = createUmi('https://api.devnet.solana.com') 
        // ✅ ИСПРАВЛЕНИЕ: Используем корректно импортированный объект плагина
        .use(web3JsAdaptor) 
        .use(mplTokenMetadata()) 
        // Устанавливаем Payer/Signer
        .identity(umiPayer)      
        .payer(umiPayer);        
    
    console.log(`Umi initialized. Payer: ${umi.identity.publicKey.toString()}`);
    
    return umiPayer; 
}

// ... (остальные функции: createTokenWithMetadata и module.exports) ...

async function createTokenWithMetadata({ umiPayer, name, symbol, uri, decimals, supply }) {
    if (!umi) {
        throw new Error("Umi not initialized. Call initializeUmi first.");
    }
    
    const { createAndMint } = require('@metaplex-foundation/mpl-token-metadata');

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


module.exports = {
    initializeUmi,
    createTokenWithMetadata
};