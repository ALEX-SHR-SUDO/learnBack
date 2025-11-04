// src/solana.service.ts


import { 
    Connection, 
    Keypair, 
    LAMPORTS_PER_SOL,
    PublicKey 
} from '@solana/web3.js'; 
import bs58 from "bs58";
// ✅ УДАЛЕНЫ: imports из @solana/spl-token, так как логика токенов SPL вынесена 
// в src/token-account.service.ts.
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Дополнительный вызов dotenv.config(), чтобы сервис мог работать автономно 
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ГЛОБАЛЬНЫЕ КОНСТАНТЫ И ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ ---
// Получаем URL из .env, чтобы кластер можно было менять
const CLUSTER_URL = process.env.SOLANA_CLUSTER_URL || 'https://api.devnet.solana.com';
const WALLET_SECRET_KEY = process.env.SERVICE_SECRET_KEY;
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
 * Загружает Keypair из SERVICE_SECRET_KEY (base58) или из service_wallet.json.
 * @returns {Keypair} Keypair of the service wallet
 */
export function getServiceWallet(): Keypair {
    if (serviceWalletInstance) return serviceWalletInstance;

    // Try to load from environment variable first (base58 format)
    if (WALLET_SECRET_KEY) {
        try {
            const secretKeyBuffer = bs58.decode(WALLET_SECRET_KEY);
            // Convert Buffer to Uint8Array by casting to any to handle iterable issue
            const secretKeyUint8 = Uint8Array.from(secretKeyBuffer as any);
            serviceWalletInstance = Keypair.fromSecretKey(secretKeyUint8);
            console.log(`✅ Сервисный кошелёк загружен из .env: ${serviceWalletInstance.publicKey.toBase58()}`);
            return serviceWalletInstance;
        } catch (e) {
            console.warn(`⚠️ Failed to load from SERVICE_SECRET_KEY, trying service_wallet.json...`);
        }
    }

    // Fallback: try to load from service_wallet.json
    try {
        const walletPath = path.join(__dirname, '..', '..', 'service_wallet.json');
        if (fs.existsSync(walletPath)) {
            const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
            const secretKeyUint8 = Uint8Array.from(walletData);
            serviceWalletInstance = Keypair.fromSecretKey(secretKeyUint8);
            console.log(`✅ Сервисный кошелёк загружен из service_wallet.json: ${serviceWalletInstance.publicKey.toBase58()}`);
            return serviceWalletInstance;
        }
    } catch (e) {
        console.error(`❌ Failed to load from service_wallet.json: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    throw new Error("Failed to load service wallet. Check SERVICE_SECRET_KEY in .env or service_wallet.json file.");
}

/**
 * Возвращает баланс сервисного кошелька (в SOL).
 * Теперь не возвращает токены SPL, так как эта логика вынесена в token-account.service.ts.
 * @returns {Promise<{ serviceAddress: string, address: string, walletAddress: string, sol: number }>} Объект с адресом и балансом SOL.
 */
export async function getServiceWalletBalance(): Promise<{ serviceAddress: string, address: string, walletAddress: string, sol: number }> {
    const keypair = getServiceWallet();
    const connection = getConnection();
    const serviceAddress = keypair.publicKey.toBase58();
    
    try {
        // Fetch SOL balance
        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
        console.log(`🪙 Баланс SOL сервисного кошелька (${serviceAddress}): ${balanceSOL}`);
        
        // Возвращаем SOL баланс и адрес в нескольких форматах для совместимости с фронтендом
        return { 
            serviceAddress: serviceAddress,
            address: serviceAddress,
            walletAddress: serviceAddress,
            sol: balanceSOL,
        };

   } catch (error) {
        // Безопасное обращение к 'error.message'
        const err = error instanceof Error ? error : new Error(String(error));
        
        if (err.message.includes('Account not found')) {
             // Если аккаунт не найден, возвращаем 0 SOL
             return { 
                serviceAddress: serviceAddress,
                address: serviceAddress,
                walletAddress: serviceAddress,
                sol: 0,
            };
        }
        
        throw new Error(`Failed to fetch service wallet balance: ${err.message}`);
    }
}
