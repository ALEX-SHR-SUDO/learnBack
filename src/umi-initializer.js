// src/umi-initializer.js

// ❌ УДАЛЕН НЕРАБОЧИЙ ИМПОРТ EDDSA: import { eddsa } from '@metaplex-foundation/umi-signer-eddsa'; 
// ✅ ИСПОЛЬЗУЕМ БАНДЛ
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
        
        // ❌ УДАЛЕН НЕРАБОЧИЙ ВЫЗОВ: umiInstance.use(eddsa());

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