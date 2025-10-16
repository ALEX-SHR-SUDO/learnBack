// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
// ❌ УДАЛЯЕМ: import * as web3jsAdapters from '@metaplex-foundation/umi-web3js-adapters';

import { loadServiceWallet } from "./service-wallet.js"; 

let umiInstance;

/**
 * Централизованная функция инициализации Umi (Снова ASYNC).
 * @returns {Promise<Umi.Umi | undefined>} Инстанция Umi
 */
export async function initializeUmi() { // ✅ СДЕЛАНО ASYNC
    if (umiInstance) return umiInstance;
    
    try {
        const serviceWallet = loadServiceWallet();
        if (!serviceWallet) {
            throw new Error("Сервисный кошелек не загружен. Проверьте SERVICE_SECRET_KEY.");
        }
        
        // --- Динамический импорт Адаптера ---
        const web3jsAdapters = await import('@metaplex-foundation/umi-web3js-adapters');
        
        // 💥 ФИНАЛЬНЫЙ ПОИСК АДАПТЕРА: Проверяем все возможные места
        // 1. web3Js() (если это функция) 2. web3Js (если это объект) 3. .default 4. .default.web3Js
        let adapterPlugin = web3jsAdapters.web3Js;
        
        if (!adapterPlugin) {
            adapterPlugin = web3jsAdapters.default?.web3Js || web3jsAdapters.default;
        }

        if (typeof adapterPlugin === 'function') {
            adapterPlugin = adapterPlugin(); // Вызываем, если это функция
        }
        
        if (!adapterPlugin || typeof adapterPlugin.install !== 'function') {
            throw new Error(`Web3Js adapter not correctly resolved. Resolved type: ${typeof adapterPlugin}`);
        }

        // --- Инициализация Umi ---
        umiInstance = createUmi('https://api.devnet.solana.com');  
        
        // ✅ Используем найденный плагин
        umiInstance.use(adapterPlugin);
        
        // ✅ ФИКС SIGNER IDENTITY (для решения проблемы eddsa)
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