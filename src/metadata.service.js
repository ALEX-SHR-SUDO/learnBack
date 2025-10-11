// src/metadata.service.js

import { createUmi, keypairIdentity, programs, publicKey } from '@metaplex-foundation/umi'; 
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
// ✅ УДАЛЕН КОНФЛИКТУЮЩИЙ ИМПОРТ: umi-bundle-defaults
import * as web3 from '@solana/web3.js'; 

import { createAndMint } from '@metaplex-foundation/mpl-token-metadata';


let umi;

/**
 * Ручная регистрация адресов программ Solana для Devnet.
 * Это обходной путь для устранения ошибки ProgramRepositoryInterface, когда defaultPlugins не работает.
 */
function registerDevnetPrograms(umiContext) {
    const programRepository = {
        // Стандартные программы Solana
        'splToken': publicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        'splAta': publicKey('ATokenGPvbdGV1bmQe1mqFaB1xfuDk9Rz22c4Ld9P9d'),
        
        // Программа Metaplex Token Metadata (для создания токена)
        'mplTokenMetadata': publicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msFhoExbnw'),
        
        // Мы можем добавить другие, если потребуется, но этих должно быть достаточно
    };
    
    // Вручную устанавливаем ProgramRepository в контекст Umi
    umiContext.programs.add(programRepository);
}


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
        
    // 2. ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Ручная регистрация программ
    registerDevnetPrograms(umi); 
    
    // 3. Устанавливаем ключевые плагины
    umi.use(mplTokenMetadata()); 
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