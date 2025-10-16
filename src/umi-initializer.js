// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
import { Connection } from '@solana/web3.js'; // Используем базовый Connection
import { loadServiceWallet } from "./service-wallet.js"; 

let umiInstance;

/**
 * Создает плагин адаптера Web3Js вручную (ОБХОДНОЙ ПУТЬ).
 * @param {Connection} connection 
 */
function web3JsUmiAdapter(connection) {
    return {
        install(umi) {
            // Эту логику мы берем из umi-web3js-adapters, но создаем вручную
            umi.use({ 
                getRpc() {
                    return {
                        send(rpcInput) {
                            // Здесь должна быть логика отправки
                            throw new Error("RPC send not fully implemented in manual adapter.");
                        },
                        sendTransaction(transaction) {
                            return connection.sendRawTransaction(transaction.serialize());
                        }
                    };
                },
                getConnection() {
                    return connection;
                }
            });
        }
    };
}


export async function initializeUmi() {
    if (umiInstance) return umiInstance;
    
    try {
        const serviceWallet = loadServiceWallet();
        if (!serviceWallet) {
            throw new Error("Сервисный кошелек не загружен. Проверьте SERVICE_SECRET_KEY.");
        }

        // 1. Создаем Connection
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        
        // 2. Инициализация Umi с чистой функцией
        umiInstance = createUmi('https://api.devnet.solana.com');  
        
        // 💥 ФИНАЛЬНЫЙ ФИКС: Используем самодельный адаптер
        umiInstance.use(web3JsUmiAdapter(connection)); 

        // 3. Идентификатор
        const serviceSigner = createSignerFromKeypair(umiInstance, serviceWallet);
        umiInstance.use(Umi.signerIdentity(serviceSigner)); 

        // 4. Плагин метаданных
        umiInstance.use(mplTokenMetadata());
        
        return umiInstance;
    } catch (err) {
        console.error(`❌ Umi Initializer: Не удалось инициализировать Umi. Причина: ${err.message}`);
        return undefined;
    }
}