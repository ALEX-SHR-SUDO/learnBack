// src/solana.service.ts
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from "bs58";
import { AccountLayout, TOKEN_PROGRAM_ID
// ✅ ИСПРАВЛЕНО: AccountState удален, так как он больше не экспортируется
 } from '@solana/spl-token';
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
        const secretKeyUint8 = bs58.decode(WALLET_SECRET_KEY);
        serviceWalletInstance = Keypair.fromSecretKey(secretKeyUint8);
        console.log(`✅ Сервисный кошелёк загружен: ${serviceWalletInstance.publicKey.toBase58()}`);
        return serviceWalletInstance;
    }
    catch (e) {
        throw new Error(`Failed to load Keypair from SERVICE_SECRET_KEY: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
}
/**
 * Возвращает баланс сервисного кошелька (в SOL) и список токенов.
 * @returns {Promise<object>} Объект с адресом, балансом SOL и списком токенов.
 */
export async function getServiceWalletBalance() {
    try {
        const keypair = getServiceWallet();
        const connection = getConnection();
        const serviceAddress = keypair.publicKey.toBase58();
        let tokenList = [];
        // Fetch SOL balance
        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
        // Fetch SPL token list
        const tokenAccounts = await connection.getTokenAccountsByOwner(keypair.publicKey, 
        // ✅ ИСПРАВЛЕНО: Убран префикс splToken
        { programId: TOKEN_PROGRAM_ID });
        tokenList = tokenAccounts.value
            .map(accountInfo => {
            // ✅ ИСПРАВЛЕНО: Убран префикс splToken
            const data = AccountLayout.decode(accountInfo.account.data);
            // ✅ ИСПРАВЛЕНО: Заменен splToken.AccountState.Initialized на 1.
            if (data.state === 1 && data.amount > 0) { // 1 = Initialized
                return {
                    mint: data.mint.toBase58(),
                    // Предполагается 9 десятичных знаков для отображения
                    amount: Number(data.amount) / Math.pow(10, 9),
                };
            }
            return null;
        })
            // Улучшена фильтрация для TS
            .filter((token) => token !== null);
        return {
            serviceAddress: serviceAddress,
            sol: balanceSOL,
            tokens: tokenList
        };
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('Account not found')) {
            const address = getServiceWallet().publicKey.toBase58();
            return {
                serviceAddress: address,
                sol: 0,
                tokens: []
            };
        }
        throw new Error(`Failed to fetch service wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
