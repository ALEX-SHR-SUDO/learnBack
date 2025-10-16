// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
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
        
        // --- Динамический импорт Адаптера ---
        const web3jsAdapters = await import('@metaplex-foundation/umi-web3js-adapters');
        
        // 💥 ФИНАЛЬНЫЙ АГРЕССИВНЫЙ ОБХОД: Мы пытаемся получить плагин из всех возможных мест
        let adapterPlugin = web3jsAdapters.web3Js || web3jsAdapters.default;

        // ВАЖНО: Если плагин — это функция, мы должны вызвать его.
        if (typeof adapterPlugin === 'function') {
            adapterPlugin = adapterPlugin();
        }

        // ВАЖНО: Если результат вызова/импорта сам содержит свойство .default 
        // (двойной бандлинг), используем его.
        if (adapterPlugin && adapterPlugin.default) {
            adapterPlugin = adapterPlugin.default;
        }

        // ФИНАЛЬНАЯ ПРОВЕРКА: Если плагин все еще невалиден
        if (!adapterPlugin || typeof adapterPlugin.install !== 'function') {
            throw new Error(`Web3Js adapter not correctly resolved. Plugin is missing the 'install' method. Resolved type: ${typeof adapterPlugin}`);
        }

        // --- Инициализация Umi ---
        umiInstance = createUmi('https://api.devnet.solana.com');  
        
        // ✅ Используем найденный плагин
        umiInstance.use(adapterPlugin);
        
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