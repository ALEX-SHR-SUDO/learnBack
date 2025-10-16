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
        
        // --- Динамический импорт Адаптера (чтобы обойти конфликты) ---
        const web3jsAdapters = await import('@metaplex-foundation/umi-web3js-adapters');
        
        // 💥 АГРЕССИВНЫЙ ПОИСК АДАПТЕРА (повторяем то, что работало лучше всего)
        let adapterPlugin = web3jsAdapters.web3Js || web3jsAdapters.default;

        if (typeof adapterPlugin === 'function') {
            adapterPlugin = adapterPlugin(); 
        }

        if (adapterPlugin && adapterPlugin.default) {
            adapterPlugin = adapterPlugin.default;
        }

        if (!adapterPlugin || typeof adapterPlugin.install !== 'function') {
             throw new Error(`Web3Js adapter not resolved after all attempts.`);
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