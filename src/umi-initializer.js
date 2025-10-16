// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
// Мы используем динамический импорт для web3jsAdapters ниже
import { loadServiceWallet } from "./service-wallet.js"; 

let umiInstance;

/**
 * Централизованная функция инициализации Umi (ASYNC).
 * Использует динамический импорт и агрессивный поиск плагина для обхода конфликтов ESM/CJS.
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
        
        // 💥 ФИНАЛЬНЫЙ АГРЕССИВНЫЙ ПОИСК АДАПТЕРА: 
        // Проверяем web3Js, затем .default, затем .default.web3Js
        let adapterPlugin = web3jsAdapters.web3Js;
        
        if (!adapterPlugin) {
            // Если web3Js не найден, ищем в .default или .default.web3Js
            adapterPlugin = web3jsAdapters.default?.web3Js || web3jsAdapters.default;
        }

        // Если это функция, вызываем ее (она должна вернуть объект-плагин)
        if (typeof adapterPlugin === 'function') {
            adapterPlugin = adapterPlugin(); 
        }
        
        // ФИНАЛЬНАЯ ПРОВЕРКА: Если плагин все еще невалиден, выбрасываем информативную ошибку
        if (!adapterPlugin || typeof adapterPlugin.install !== 'function') {
            throw new Error(`Web3Js adapter not correctly resolved. Resolved type: ${typeof adapterPlugin}`);
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