// src/metadata.service.js

import { createUmi, keypairIdentity } from '@metaplex-foundation/umi'; 
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
// ✅ Используем umi-bundle-defaults для получения плагинов, чтобы избежать ошибок именования
import { Umi as UmiBundle } from '@metaplex-foundation/umi-bundle-defaults'; 
import * as web3 from '@solana/web3.js'; 

import { createAndMint } from '@metaplex-foundation/mpl-token-metadata';


let umi;

/**
 * Инициализирует Umi с кошельком (payer) и устанавливает необходимые плагины.
 * @param {web3.Keypair} walletKeypair - Ключевая пара для плательщика.
 */
function initializeUmi(walletKeypair) {
    if (!walletKeypair) {
        throw new Error("Wallet Keypair required for Umi initialization.");
    }
    
    // 1. Создаем Umi с подключением к devnet
    umi = createUmi('https://api.devnet.solana.com');
        
    // 2. Устанавливаем ключевые плагины
    
    // Плагин для регистрации программ (решает ProgramRepositoryInterface)
    // Используем UmiBundle для доступа к defaultPlugins
    umi.use(UmiBundle.defaultPlugins()); 
    
    // Плагин для метаданных токена
    umi.use(mplTokenMetadata()); 
    
    // Плагин для установки идентичности (Payer/Signer), обходим проблемы с umi-web3js-adapters
    umi.use(keypairIdentity(walletKeypair)); 
    
    console.log(`Umi initialized. Payer: ${umi.identity.publicKey.toString()}`);
    
    return umi.identity; 
}


/**
 * Создает токен и минтит его с метаданными.
 */
async function createTokenWithMetadata({ name, symbol, uri, decimals, supply }) {
    if (!umi) {
        throw new Error("Umi not initialized. Call initializeUmi first.");
    }
    
    const parsedDecimals = parseInt(decimals || 9);
    const parsedSupply = parseFloat(supply);
    const totalAmount = BigInt(Math.round(parsedSupply * Math.pow(10, parsedDecimals))); 
    
    // Mint Keypair создается внутри Umi, а authority берется из identity
    // Примечание: Мы создаем Web3 Keypair для mint, потому что createAndMint принимает UmiSigner
    const mintKeypair = web3.Keypair.generate(); 
    
    await createAndMint(umi, {
        mint: mintKeypair,
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