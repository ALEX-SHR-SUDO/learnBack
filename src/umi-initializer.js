// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
// ✅ ВОЗВРАЩАЕМ СТАТИЧЕСКИЙ ИМПОРТ
import * as web3jsAdapters from '@metaplex-foundation/umi-web3js-adapters';

import { loadServiceWallet } from "./service-wallet.js"; 

let umiInstance;

export async function initializeUmi() {
    if (umiInstance) return umiInstance;
    
    try {
        const serviceWallet = loadServiceWallet();
        if (!serviceWallet) {
            throw new Error("Сервисный кошелек не загружен. Проверьте SERVICE_SECRET_KEY.");
        }
        
        // 💥 ФИНАЛЬНЫЙ АГРЕССИВНЫЙ ПОИСК АДАПТЕРА (без await)
        // Проверяем все возможные места, которые может создать статический импорт
        let adapterPlugin = web3jsAdapters.web3Js || web3jsAdapters.default; 
        
        // Если это функция, вызываем ее
        if (typeof adapterPlugin === 'function') {
             adapterPlugin = adapterPlugin();
        }

        // Если все еще undefined, пробуем агрессивный поиск (например, .default.web3Js)
        if (!adapterPlugin) {
             adapterPlugin = web3jsAdapters.default?.web3Js;
        }

        // ФИНАЛЬНАЯ ПРОВЕРКА:
        if (!adapterPlugin || typeof adapterPlugin.install !== 'function') {
             throw new Error(`Web3Js adapter not resolved after all attempts.`);
        }

        // --- Инициализация Umi ---
        umiInstance = createUmi('https://api.devnet.solana.com');  
        
        // 1. Используем найденный плагин
        umiInstance.use(adapterPlugin);
        
        // 2. Идентификатор
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