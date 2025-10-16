// src/service-wallet.js

import { Keypair } from "@solana/web3.js";

/**
 * Загружает сервисный кошелёк из переменной окружения.
 * @returns {Keypair | undefined} Объект Keypair или undefined в случае ошибки.
 */
export function loadServiceWallet() {
    try {
        const secretKeyString = process.env.SERVICE_SECRET_KEY;
        if (!secretKeyString) {
            throw new Error("Переменная окружения SERVICE_SECRET_KEY не найдена.");
        }

        const secretKey = JSON.parse(secretKeyString);
        const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        
        console.log("✅ Сервисный кошелёк загружен:", wallet.publicKey.toBase58());
        return wallet;
    } catch (err) {
        console.error(`❌ Ошибка загрузки сервисного кошелька: ${err.message}`);
        return undefined;
    }
}