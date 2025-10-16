// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
import * as web3jsAdapters from '@metaplex-foundation/umi-web3js-adapters';
import { loadServiceWallet } from "./service-wallet.js"; // Используем существующий загрузчик кошелька

let umiInstance;

/**
 * Централизованная функция инициализации Umi.
 * @returns {Umi.Umi | undefined} Инстанция Umi
 */
export function initializeUmi() {
    if (umiInstance) return umiInstance;
    
    try {
        const serviceWallet = loadServiceWallet();
        if (!serviceWallet) {
            throw new Error("Сервисный кошелек не загружен. Проверьте SERVICE_SECRET_KEY.");
        }
        
        // --- Инициализация Umi ---
        umiInstance = createUmi('https://api.devnet.solana.com');  
        
        // 💥 ФИНАЛЬНЫЙ ФИКС АДАПТЕРА: УДАЛЕНЫ СКОБКИ ()
        // Мы передаем объект плагина, чтобы Umi смог найти его метод 'install'.
        umiInstance.use(web3jsAdapters.web3Js); // <-- ИЗМЕНЕНИЕ: УДАЛЕНЫ ()
        
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