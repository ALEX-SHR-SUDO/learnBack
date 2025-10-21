// src/solana.service.ts

import { 
    Connection, 
    Keypair, 
    LAMPORTS_PER_SOL,
    PublicKey 
} from '@solana/web3.js'; 
import bs58 from "bs58";
import * as splToken from '@solana/spl-token'; 
import dotenv from 'dotenv';

// Дополнительный вызов dotenv.config(), чтобы сервис мог работать автономно 
// (например, при тестировании) и не зависеть только от server.ts.
dotenv.config();

// --- ГЛОБАЛЬНЫЕ КОНСТАНТЫ И ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ ---
// Получаем URL из .env, чтобы кластер можно было менять
const CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
const WALLET_SECRET_KEY = process.env.SERVICE_SECRET_KEY_BASE58; // Исправлено имя переменной согласно .env
let connectionInstance: Connection | null = null;
let serviceWalletInstance: Keypair | null = null;

/**
 * Возвращает объект Connection.
 * @returns {Connection}
 */
export function getConnection(): Connection {
    if (!connectionInstance) {
        connectionInstance = new Connection(CLUSTER_URL, 'confirmed');
        console.log(`✅ Подключение к кластеру: ${CLUSTER_URL}`);
    }
    return connectionInstance;
}

/**
 * Загружает Keypair из SERVICE_SECRET_KEY_BASE58.
 * @returns {Keypair} Keypair of the service wallet
 */
export function getServiceWallet(): Keypair {
    if (serviceWalletInstance) return serviceWalletInstance;

    if (!WALLET_SECRET_KEY) {
        throw new Error("SERVICE_SECRET_KEY_BASE58 is not defined in environment. Check your .env file.");
    }
    try {
        // Мы ожидаем, что ключ Base58 будет без ошибок, 
        // иначе произойдет сбой, который мы отлавливаем ниже.
        const secretKeyUint8 = bs58.decode(WALLET_SECRET_KEY);
        // Keypair.fromSecretKey принимает Uint8Array (64 байта)
        serviceWalletInstance = Keypair.fromSecretKey(secretKeyUint8);
        console.log(`✅ Сервисный кошелёк загружен: ${serviceWalletInstance.publicKey.toBase58()}`);
        return serviceWalletInstance;
    } catch (e) {
        throw new Error(`Failed to load Keypair from SERVICE_SECRET_KEY_BASE58: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
}

/**
 * Возвращает баланс сервисного кошелька (в SOL) и список токенов.
 * @returns {Promise<object>} Объект с адресом, балансом SOL и списком токенов.
 */
export async function getServiceWalletBalance(): Promise<{ serviceAddress: string, sol: number, tokens: { mint: string, amount: number }[] }> {
    try {
        const keypair = getServiceWallet();
        const connection = getConnection();
        const serviceAddress = keypair.publicKey.toBase58();
        
        let tokenList: { mint: string, amount: number }[] = [];
        
        // Fetch SOL balance
        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
        
        // Fetch SPL token list
        const tokenAccounts = await connection.getTokenAccountsByOwner(
            keypair.publicKey,
            { programId: splToken.TOKEN_PROGRAM_ID } 
        );

        tokenList = tokenAccounts.value
            .map(accountInfo => {
                const data = splToken.AccountLayout.decode(accountInfo.account.data);
                
                // Проверяем, что аккаунт инициализирован и имеет ненулевой баланс
                if (data.state === splToken.AccountState.Initialized && data.amount > 0) {
                     return {
                        mint: data.mint.toBase58(),
                        amount: Number(data.amount) / Math.pow(10, 9), // Предполагаем 9 десятичных знаков для простоты
                    };
                }
                return null;
            })
            .filter((token): token is { mint: string, amount: number } => token !== null);

        return { 
            serviceAddress: serviceAddress,
            sol: balanceSOL,
            tokens: tokenList
        };
        
    } catch (error) {
        // Если кошелек еще не имеет активности, он может быть "не найден". 
        // Возвращаем дефолтные значения.
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

// --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ---
// Вызываем функцию при импорте, чтобы проверить .env и вывести адрес кошелька в консоль.
try {
    getServiceWallet();
} catch (e) {
    console.error("🚨 КРИТИЧЕСКАЯ ОШИБКА ИНИЦИАЛИЗАЦИИ КОШЕЛЬКА:", e instanceof Error ? e.message : 'Unknown error');
    console.error("Убедитесь, что SERVICE_SECRET_KEY_BASE58 указан в файле .env.");
    // Мы не останавливаем процесс, чтобы Express мог запуститься, но логгируем ошибку.
}
