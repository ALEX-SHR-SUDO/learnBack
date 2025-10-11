// src/metadata.service.js

// Импортируем весь модуль Umi как объект
import * as Umi from '@metaplex-foundation/umi'; 
// ✅ НОВЫЙ ИМПОРТ: Попробуем импортировать programs из отдельного пакета, как это часто бывает в старых версиях Umi
import { programs } from '@metaplex-foundation/umi-programs'; 

import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as web3 from '@solana/web3.js'; 

import { createAndMint } from '@metaplex-foundation/mpl-token-metadata';


let umi;

// ✅ УДАЛЕНА ФУНКЦИЯ registerDevnetPrograms, т.к. она вызывала ошибку .set()/.add()

/**
 * Инициализирует Umi с кошельком (payer) и устанавливает необходимые плагины.
 * @param {web3.Keypair} walletKeypair - Ключевая пара для плательщика.
 */
function initializeUmi(walletKeypair) {
    if (!walletKeypair) {
        throw new Error("Wallet Keypair required for Umi initialization.");
    }
    
    // 1. Создаем Umi (доступ через Umi.createUmi)
    umi = Umi.createUmi('https://api.devnet.solana.com');
        
    // 2. Устанавливаем ключевые плагины
    
    // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем плагин programs() (если он импортирован) 
    // Если programs() не работает, то проблема в том, что его нет в установленных пакетах.
    // Если же он есть в пакете umi-programs, он сработает:
    umi.use(programs()); 
    
    // Плагин для метаданных токена
    umi.use(mplTokenMetadata()); 
    // Плагин keypairIdentity
    umi.use(Umi.keypairIdentity(walletKeypair)); 
    
    console.log(`Umi initialized. Payer: ${umi.identity.publicKey.toString()}`);
    
    return umi.identity; 
}


async function createTokenWithMetadata({ name, symbol, uri, decimals, supply }) {
    if (!umi) {
        throw new Error("Umi not initialized. Call initializeUmi first.");
    }
    
    const parsedDecimals = parseInt(decimals || 9);
    const parsedSupply = parseFloat(supply);
    const totalAmount = BigInt(Math.round(parsedSupply * Math.pow(10, parsedDecimals))); 
    
    const mintKeypair = web3.Keypair.generate(); 
    
    await createAndMint(umi, {
        mint: mintKeypair,
        // Authority берется из identity, которое уже является Umi Signer
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