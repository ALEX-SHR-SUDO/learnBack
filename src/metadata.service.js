// src/metadata.service.js

const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { createAndMint, mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');
const { fromWeb3JsKeypair } = require('@metaplex-foundation/umi-web3js-adapters');
const { publicKey } = require('@metaplex-foundation/umi');

let umi;

// Функция для инициализации Umi с кошельком (payer)
function initializeUmi(walletKeypair) {
    if (!walletKeypair) {
        throw new Error("Wallet Keypair required for Umi initialization.");
    }
    
    // 1. Конвертируем web3.js Keypair в Umi Keypair
    const umiPayer = fromWeb3JsKeypair(walletKeypair);
    
    // 2. Инициализируем Umi
    umi = createUmi('https://api.devnet.solana.com') // Используем devnet
        .use(mplTokenMetadata())
        .use(umiPayer); 
    
    // Возвращаем публичный ключ UmiPayer для использования в качестве Mint/Authority
    return umiPayer; 
}


// Функция для создания токена с метаданными
async function createTokenWithMetadata({ umiPayer, name, symbol, uri, decimals, supply }) {
    if (!umi) {
        throw new Error("Umi not initialized. Call initializeUmi first.");
    }
    
    const parsedDecimals = parseInt(decimals || 9);
    const parsedSupply = parseFloat(supply);
    const totalAmount = BigInt(Math.round(parsedSupply * Math.pow(10, parsedDecimals))); 
    
    // Mint-адрес совпадает с адресом Keypair, который мы передаем в "mint"
    const mintKeypair = umiPayer; 

    // Выполнение создания и минтинга токена с метаданными
    await createAndMint(umi, {
        mint: mintKeypair,
        authority: mintKeypair,
        name: name,
        symbol: symbol,
        uri: uri, // Ссылка на JSON-файл метаданных
        sellerFeeBasisPoints: 0, 
        decimals: parsedDecimals,
        amount: totalAmount,
        tokenOwner: mintKeypair.publicKey, // Токены будут отправлены на кошелек
    }).sendAndConfirm(umi);
    
    return { mint: mintKeypair.publicKey.toString() };
}


module.exports = {
    initializeUmi,
    createTokenWithMetadata
};