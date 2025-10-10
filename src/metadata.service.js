// src/metadata.service.js

// ИМПОРТЫ Umi:
// createUmi из бандла
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
// mplTokenMetadata из основного пакета (он сам по себе является плагином)
const { mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');
// fromWeb3JsKeypair из адаптера (для конвертации)
const { fromWeb3JsKeypair } = require('@metaplex-foundation/umi-web3js-adapters'); 


let umi;

/**
 * Инициализирует Umi с кошельком (payer) и устанавливает необходимые плагины.
 * @param {Keypair} walletKeypair - web3.js Keypair сервисного кошелька.
 */
function initializeUmi(walletKeypair) {
    if (!walletKeypair) {
        throw new Error("Wallet Keypair required for Umi initialization.");
    }
    
    // 1. Конвертируем web3.js Keypair в Umi Keypair для использования в качестве Payer/Signer
    const umiPayer = fromWeb3JsKeypair(walletKeypair);
    
    // 2. Инициализируем Umi
    // ВНИМАНИЕ: Плагин mplTokenMetadata() вызывается как ФУНКЦИЯ
    umi = createUmi('https://api.devnet.solana.com') 
        .use(mplTokenMetadata()) // <--- Вызываем mplTokenMetadata как функцию!
        .identity(umiPayer)      // <--- Устанавливаем Payer/Signer с помощью .identity()
        .payer(umiPayer);        // <--- Устанавливаем Payer с помощью .payer()
    
    return umiPayer; 
}


/**
 * Создает токен и минтит его с метаданными.
 * @param {object} params
 */
async function createTokenWithMetadata({ umiPayer, name, symbol, uri, decimals, supply }) {
    if (!umi) {
        throw new Error("Umi not initialized. Call initializeUmi first.");
    }
    
    // ... (логика расчета amount и вызов createAndMint)
    const { createAndMint } = require('@metaplex-foundation/mpl-token-metadata'); // Добавляем сюда, чтобы избежать конфликтов импорта.

    const parsedDecimals = parseInt(decimals || 9);
    const parsedSupply = parseFloat(supply);
    const totalAmount = BigInt(Math.round(parsedSupply * Math.pow(10, parsedDecimals))); 
    
    const mintKeypair = umiPayer; 

    // Выполнение создания и минтинга токена с метаданными
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