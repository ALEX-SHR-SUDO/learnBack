// src/metadata-addition.service.js

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'; 
import pkg from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
const { createMint, mplTokenMetadata } = pkg; // <--- НОВЫЙ СИНТАКСИС


let umi;

function initializeUmi(walletKeypair) {
    if (!walletKeypair) {
        throw new Error("Wallet Keypair required for Umi initialization.");
    }
    
    umi = createUmi('https://api.devnet.solana.com'); 
    umi.use(mplTokenMetadata()); 
    umi.use(Umi.keypairIdentity(walletKeypair)); 
    
    // В этом сервисе мы используем тот же Keypair для аутентификации.
    console.log(`Umi initialized (Metadata Service). Payer: ${umi.identity.publicKey.toString()}`);
    return umi.identity; 
}


/**
 * Добавляет метаданные к существующему Mint-аккаунту.
 */
async function addMetadataToToken({ mintAddress, name, symbol, uri }) {
    if (!umi) {
        throw new Error("Umi not initialized. Call initializeUmi first.");
    }

    // --- Защита Входных Данных ---
    const tokenName = String(name || ''); 
    const tokenSymbol = String(symbol || '');
    const tokenUri = String(uri || '');
    
    // Преобразуем строку адреса в PublicKey Umi для использования в транзакции.
    const mintPublicKey = Umi.publicKey(mintAddress); 

    console.log(`[ШАГ 2] Попытка добавить метаданные к Mint: ${mintAddress}`);

    // ==========================================================
    // НИЗКОУРОВНЕВАЯ ФУНКЦИЯ: Обновление (добавление) метаданных
    // ==========================================================
    await updateMetadata(umi, {
        mint: mintPublicKey,
        
        // authority: ДОЛЖЕН БЫТЬ Signer (тот, у кого есть закрытый ключ)
        // Этот Signer должен быть 'updateAuthority', установленным на Шаге 1.
        authority: umi.identity, 
        
        data: {
            name: tokenName,
            symbol: tokenSymbol,
            uri: tokenUri,
            sellerFeeBasisPoints: 0, 
        },
        
        // isMutable: true, чтобы разрешить будущие обновления
        isMutable: true, 
    }).sendAndConfirm(umi);
    
    console.log("✅ [ШАГ 2] Метаданные успешно добавлены.");

    return { success: true, mint: mintAddress };
}


// --- Экспорт ---
export {
    initializeUmi,
    addMetadataToToken
};