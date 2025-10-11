// src/metadata.service.js

// --- Надежный способ импорта Umi плагинов в CommonJS (require) ---

/**
 * Функция-помощник для безопасного получения объекта из require.
 * Проверяет наличие свойства .default, типичного для ESM в CommonJS.
 */
const getModule = (pkg) => {
    const mod = require(pkg);
    // Проверяем, есть ли экспорт в свойстве .default (типично для ESM)
    if (mod && mod.__esModule && mod.default) {
        return mod.default;
    }
    return mod;
};

// 1. Импортируем ВСЕ необходимые пакеты Umi целиком:
const umiCore = getModule('@metaplex-foundation/umi');
const umiTokenMetadata = getModule('@metaplex-foundation/mpl-token-metadata');
const umiWeb3jsAdapters = getModule('@metaplex-foundation/umi-web3js-adapters');

// 2. Извлекаем нужные константы и функции из импортированных объектов:
const createUmi = umiCore.createUmi;
const mplTokenMetadata = umiTokenMetadata.mplTokenMetadata; // Функция-плагин
const fromWeb3JsKeypair = umiWeb3jsAdapters.fromWeb3JsKeypair;
const web3JsAdaptor = umiWeb3jsAdapters.web3JsAdaptor; // Объект-плагин


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
        // 1. Добавляем адаптер web3.js (как объект-плагин)
        .use(web3JsAdaptor) 
        // 2. Добавляем плагин метаданных (как функцию)
        .use(mplTokenMetadata()) 
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
    
    // Получаем createAndMint через тот же стабильный require
    const { createAndMint } = getModule('@metaplex-foundation/mpl-token-metadata');

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