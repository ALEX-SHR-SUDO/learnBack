// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
import { Connection } from '@solana/web3.js'; 
import { loadServiceWallet } from "./service-wallet.js"; 

let umiInstance;

// 1. Адаптер Web3JS (Переименован)
function web3JsCustomAdapter(connection) { // ⬅️ ПЕРЕИМЕНОВАНО
    return {
        install(umi) {
            umi.use({ 
                getRpc: () => ({
                    send: (rpcInput) => { 
                        throw new Error("RPC send not fully implemented in manual adapter.");
                    },
                    sendTransaction: (transaction) => connection.sendRawTransaction(transaction.serialize()),
                }),
                getConnection: () => connection,
            });
        }
    };
}

// 2. Плагин EDDSA (Переименован)
function eddsaCustomAdapter() { // ⬅️ ПЕРЕИМЕНОВАНО
    return {
        install(umi) {
            umi.use({
                eddsa: {
                    generateKeypair: Umi.generateSigner,
                    verify: Umi.verifySignature,
                    sign: Umi.signTransaction,
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

        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        
        umiInstance = createUmi('https://api.devnet.solana.com');  
        
        // 1. Адаптер Web3JS (Используем новое имя)
        umiInstance.use(web3JsCustomAdapter(connection)); 

        // 2. Плагин EDDSA (Используем новое имя)
        umiInstance.use(eddsaCustomAdapter()); 

        // 3. Идентификатор
        const serviceSigner = createSignerFromKeypair(umiInstance, serviceWallet);
        umiInstance.use(Umi.signerIdentity(serviceSigner)); 

        // 4. Плагин метаданных
        umiInstance.use(mplTokenMetadata());
        
        return umiInstance;
    } catch (err) {
        // Мы хотим видеть ошибку в консоли, если инициализация не удалась
        console.error(`❌ Umi Initializer: Не удалось инициализировать Umi. Причина: ${err.message}`);
        return undefined; // Возвращаем undefined при ошибке
    }
}