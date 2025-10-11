// src/metadata.service.js

// ИМПОРТЫ Umi:
const { createUmi } = require('@metaplex-foundation/umi'); 
const { mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');
// ⚠️ ИСПРАВЛЕНИЕ: Импортируем web3JsAdaptor как константу (объект-плагин)
const { fromWeb3JsKeypair, web3JsAdaptor } = require('@metaplex-foundation/umi-web3js-adapters'); 

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
        // ✅ ИСПРАВЛЕНИЕ: Используем web3JsAdaptor как объект-плагин, без вызова ()
        .use(web3JsAdaptor) 
        .use(mplTokenMetadata()) 
        // Устанавливаем Payer/Signer
        .identity(umiPayer)      
        .payer(umiPayer);        
    
    console.log(`Umi initialized. Payer: ${umi.identity.publicKey.toString()}`);
    
    return umiPayer; 
}

// ... (остальные функции остаются без изменений: createTokenWithMetadata и module.exports) ...

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