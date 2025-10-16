// src/umi-initializer.js

// ✅ ДОБАВЛЕН ИМПОРТ ДЛЯ EDDSA
import { eddsa } from '@metaplex-foundation/umi-signer-eddsa'; 
// ✅ ИСПОЛЬЗУЕМ БАНДЛ, который включает адаптер web3.js
import { createUmi as createUmiBundle } from '@metaplex-foundation/umi-bundle-defaults'; 
import { createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
import { loadServiceWallet } from "./service-wallet.js"; 

let umiInstance;

/**
 * Централизованная функция инициализации Umi (ASYNC).
 * @returns {Promise<Umi.Umi | undefined>} Инстанция Umi
 */
export async function initializeUmi() {
    if (umiInstance) return umiInstance;
    
    try {
        const serviceWallet = loadServiceWallet();
        if (!serviceWallet) {
            throw new Error("Сервисный кошелек не загружен. Проверьте SERVICE_SECRET_KEY.");
        }
        
        // --- Инициализация Umi с помощью Bundled-функции ---
        umiInstance = createUmiBundle('https://api.devnet.solana.com');  
        
        // 💥 ФИКС: ЯВНО ДОБАВЛЯЕМ ПЛАГИН EDDSA (для устранения ошибки generateKeypair)
        umiInstance.use(eddsa());

        // ✅ ФИКС SIGNER IDENTITY (решает проблему eddsa)
        const serviceSigner = createSignerFromKeypair(umiInstance, serviceWallet);
        umiInstance.use(Umi.signerIdentity(serviceSigner)); 

        umiInstance.use(mplTokenMetadata());
        // -------------------------

        return umiInstance;
    } catch (err) {
        console.error(`❌ Umi Initializer: Не удалось инициализировать Umi. Причина: ${err.message}`);
        return undefined;
    }
}