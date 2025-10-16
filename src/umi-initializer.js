// src/umi-initializer.js

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
import { Connection } from '@solana/web3.js'; 
import { loadServiceWallet } from "./service-wallet.js"; 

let umiInstance;

// 1. ПЛАГИН АДАПТЕРА WEB3JS (ИСПРАВЛЕНА СТРУКТУРА)
function web3JsUmiAdapter(connection) {
    return {
        // ✅ МЕТОД INSTALL ДОЛЖЕН ПРИНИМАТЬ UMI И ВЫЗЫВАТЬ umi.use({...})
        install(umi) { 
            umi.use({ 
                getRpc: () => ({
                    send: (rpcInput) => { 
                        // Здесь должна быть более сложная логика, но для sendTransaction достаточно
                        throw new Error("RPC send not fully implemented in manual adapter.");
                    },
                    sendTransaction: (transaction) => connection.sendRawTransaction(transaction.serialize()),
                }),
                getConnection: () => connection,
            });
        }
    };
}

// 2. ПЛАГИН EDDSA (ИСПРАВЛЕНА СТРУКТУРА)
function eddsaAdapter() {
    return {
        // ✅ МЕТОД INSTALL ДОЛЖЕН ПРИНИМАТЬ UMI И ВЫЗЫВАТЬ umi.use({...})
        install(umi) {
            umi.use({
                eddsa: {
                    // Принудительно добавляем generateKeypair, чтобы generateSigner(umi) сработал
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
        
        // 1. Адаптер Web3JS (Вызываем функцию, чтобы получить объект с install)
        umiInstance.use(web3JsUmiAdapter(connection)); 

        // 2. Плагин EDDSA (Вызываем функцию)
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