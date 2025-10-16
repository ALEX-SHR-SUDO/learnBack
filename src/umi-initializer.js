// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
import { Connection } from '@solana/web3.js'; 
import { loadServiceWallet } from "./service-wallet.js"; 

let umiInstance;

// 1. ПЛАГИН АДАПТЕРА WEB3JS (Обходной путь, который мы только что использовали)
function web3JsUmiAdapter(connection) {
    return {
        install(umi) {
            umi.use({ 
                getRpc: () => ({
                    send: (rpcInput) => { throw new Error("RPC send not fully implemented in manual adapter."); },
                    sendTransaction: (transaction) => connection.sendRawTransaction(transaction.serialize()),
                }),
                getConnection: () => connection,
            });
        }
    };
}

// 💥 2. ПЛАГИН EDDSA (Окончательный обходной путь для 'generateKeypair')
function eddsaAdapter() {
    return {
        install(umi) {
            // Эта логика принудительно добавляет необходимые функции EDDSA к Umi
            umi.use({
                eddsa: {
                    // Используем встроенный в Umi метод для генерации ключей,
                    // который должен быть доступен, если Umi загружен
                    generateKeypair: Umi.generateSigner,
                    // Добавляем другие необходимые методы
                    verify: Umi.verifySignature,
                    sign: Umi.signTransaction,
                    // Мы не можем легко создать generateSigner, но generateKeypair будет вызван из generateSigner
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
        
        // 1. Адаптер Web3JS (Обходной путь)
        umiInstance.use(web3JsUmiAdapter(connection)); 

        // 💥 2. ПЛАГИН EDDSA (Принудительно!)
        umiInstance.use(eddsaAdapter()); 

        // 3. Идентификатор (Signer Identity)
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