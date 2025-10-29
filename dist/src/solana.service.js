// src/solana.service.ts
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from "bs58";
// ✅ УДАЛЕНЫ: imports из @solana/spl-token, так как логика токенов SPL вынесена 
// в src/token-account.service.ts.
import dotenv from 'dotenv';
// Дополнительный вызов dotenv.config(), чтобы сервис мог работать автономно 
dotenv.config();
// --- ГЛОБАЛЬНЫЕ КОНСТАНТЫ И ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ ---
// Получаем URL из .env, чтобы кластер можно было менять
const CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
const WALLET_SECRET_KEY = process.env.SERVICE_SECRET_KEY;
let connectionInstance = null;
let serviceWalletInstance = null;
/**
 * Возвращает объект Connection.
 * @returns {Connection}
 */
export function getConnection() {
    if (!connectionInstance) {
        connectionInstance = new Connection(CLUSTER_URL, 'confirmed');
        console.log(`✅ Подключение к кластеру: ${CLUSTER_URL}`);
    }
    return connectionInstance;
}
/**
 * Загружает Keypair из SERVICE_SECRET_KEY.
 * @returns {Keypair} Keypair of the service wallet
 */
export function getServiceWallet() {
    if (serviceWalletInstance)
        return serviceWalletInstance;
    if (!WALLET_SECRET_KEY) {
        throw new Error("SERVICE_SECRET_KEY is not defined in environment. Check your .env file.");
    }
    try {
        const secretKeyBuffer = bs58.decode(WALLET_SECRET_KEY);
        // Convert Buffer to Uint8Array by casting to any to handle iterable issue
        const secretKeyUint8 = Uint8Array.from(secretKeyBuffer);
        serviceWalletInstance = Keypair.fromSecretKey(secretKeyUint8);
        console.log(`✅ Сервисный кошелёк загружен: ${serviceWalletInstance.publicKey.toBase58()}`);
        return serviceWalletInstance;
    }
    catch (e) {
        throw new Error(`Failed to load Keypair from SERVICE_SECRET_KEY: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
}
/**
 * Возвращает баланс сервисного кошелька (в SOL).
 * Теперь не возвращает токены SPL, так как эта логика вынесена в token-account.service.ts.
 * @returns {Promise<{ serviceAddress: string, sol: number }>} Объект с адресом и балансом SOL.
 */
export async function getServiceWalletBalance() {
    const keypair = getServiceWallet();
    const connection = getConnection();
    const serviceAddress = keypair.publicKey.toBase58();
    try {
        // Fetch SOL balance
        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
        // Возвращаем только SOL баланс и адрес
        return {
            serviceAddress: serviceAddress,
            sol: balanceSOL,
        };
    }
    catch (error) {
        // Безопасное обращение к 'error.message'
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message.includes('Account not found')) {
            // Если аккаунт не найден, возвращаем 0 SOL
            return {
                serviceAddress: serviceAddress,
                sol: 0,
            };
        }
        throw new Error(`Failed to fetch service wallet balance: ${err.message}`);
    }
}
