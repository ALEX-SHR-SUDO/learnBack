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
        
        // 💥 ФИНАЛЬНЫЙ ОБХОД V2: Агрессивно ищем плагин в единственном рабочем виде
        let adapterPlugin = (web3jsAdapters.web3Js || 
                             web3jsAdapters.default); // Начнем с наиболее вероятных мест

        // 1. Если это функция, вызываем ее, чтобы получить объект-плагин.
        if (typeof adapterPlugin === 'function') {
            adapterPlugin = adapterPlugin();
        }

        // 2. Если плагин все еще undefined или не имеет install, 
        // ищем в web3jsAdapters.default (на случай, если adapterPlugin был null/undefined)
        if (!adapterPlugin) {
            adapterPlugin = web3jsAdapters.default;
        }

        // 3. САМЫЙ ВАЖНЫЙ ШАГ: Проверка ДВОЙНОГО DEFAULT или обернутого объекта
        if (adapterPlugin && adapterPlugin.default) {
            // Если объект обернут еще раз (Node.js/CJS quirk), используем внутренний default
            adapterPlugin = adapterPlugin.default;
        }

        // 4. Если плагин — это функция после шага 3, вызываем его еще раз (это редкость, но нужно для покрытия)
        if (typeof adapterPlugin === 'function') {
            adapterPlugin = adapterPlugin();
        }


        // ФИНАЛЬНАЯ ПРОВЕРКА:
        if (!adapterPlugin || typeof adapterPlugin.install !== 'function') {
             // Если и это не сработало, значит, плагин не разрешен.
             throw new Error(`Web3Js adapter not correctly resolved. Plugin missing 'install' after all attempts. Resolved type: ${typeof adapterPlugin}.`);
        }
        // ...
        
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