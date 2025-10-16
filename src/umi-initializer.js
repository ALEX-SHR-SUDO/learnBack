// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as web3jsAdapters from '@metaplex-foundation/umi-web3js-adapters'; // ✅ НОВЫЙ ИМПОРТ
import * as Umi from '@metaplex-foundation/umi'; 
import { loadServiceWallet } from "./service-wallet.js"; 

let umiInstance;

export async function initializeUmi() {
    if (umiInstance) return umiInstance;
    
    try {
        const serviceWallet = loadServiceWallet();
        if (!serviceWallet) {
            throw new Error("Сервисный кошелек не загружен.");
        }
        
        // --- Инициализация Umi с прямой функцией ---
        umiInstance = createUmi('https://api.devnet.solana.com');  
        
        // 💥 ФИНАЛЬНЫЙ ФИКС: Явно добавляем адаптер и плагины.
        // EDDSA является частью базового Umi, и это наш последний шанс, что он сработает.

        // 1. Адаптер (используем только .default, чтобы обойти CJS/ESM)
        umiInstance.use(web3jsAdapters.web3Js || web3jsAdapters.default); 

        // 2. Идентификатор (Signer Identity)
        const serviceSigner = createSignerFromKeypair(umiInstance, serviceWallet);
        umiInstance.use(Umi.signerIdentity(serviceSigner)); 

        // 3. Плагин метаданных
        umiInstance.use(mplTokenMetadata());
        
        return umiInstance;
    } catch (err) {
        console.error(`❌ Umi Initializer: Не удалось инициализировать Umi. Причина: ${err.message}`);
        return undefined;
    }
}