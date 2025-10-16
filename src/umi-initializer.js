// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
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
        
         // --- Динамический импорт Адаптера (новый, чистый обход) ---
        // Импортируем только сам плагин, без *, и принудительно ищем .default
        const web3JsAdapter = (await import('@metaplex-foundation/umi-web3js-adapters')).default; 
        
        let adapterPlugin = web3JsAdapter;

        // ВАЖНО: Адаптер может быть обернут в функцию, которую нужно вызвать, 
        // чтобы получить объект-плагин (в отличие от других плагинов).
        if (typeof adapterPlugin === 'function') {
             adapterPlugin = adapterPlugin();
        }
        
        // 💥 ФИНАЛЬНАЯ ПРОВЕРКА:
        if (!adapterPlugin || typeof adapterPlugin.install !== 'function') {
             throw new Error(`Web3Js adapter not resolved after all attempts. (Type: ${typeof adapterPlugin})`);
        }

        // --- Инициализация Umi с чистой функцией ---
        umiInstance = createUmi('https://api.devnet.solana.com');  
        
        // 1. Адаптер
        umiInstance.use(adapterPlugin); 

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