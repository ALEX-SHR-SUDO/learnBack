// src/solana.service.js

// ✅ ПРЯМОЙ ИМПОРТ ВСЕХ НЕОБХОДИМЫХ КЛАССОВ И КОНСТАНТ
import { 
    Connection, 
    Keypair, 
    LAMPORTS_PER_SOL 
} from '@solana/web3.js'; 
import bs58 from 'bs58';

const CLUSTER_URL = 'https://api.devnet.solana.com';
let connectionInstance = null;
let serviceKeypairInstance = null;

/**
 * Загружает Keypair из SERVICE_SECRET_KEY (Base58).
 * @returns {Keypair} Keypair сервисного кошелька
 */
export function getServiceKeypair() {
    if (serviceKeypairInstance) return serviceKeypairInstance;

    const secretKeyBs58 = process.env.SERVICE_SECRET_KEY;
    if (!secretKeyBs58) {
        throw new Error("SERVICE_SECRET_KEY is not defined in environment.");
    }
    
    try {
        const secretKeyBytes = bs58.decode(secretKeyBs58);
        
        // ❌ Исправление: Использовать Keypair напрямую
        serviceKeypairInstance = Keypair.fromSecretKey(secretKeyBytes); 
        
        console.log(`✅ Сервисный кошелёк загружен: ${serviceKeypairInstance.publicKey.toBase58()}`);
        return serviceKeypairInstance;
    } catch (e) {
        // Если ошибка здесь "Non-base58 character", значит, SERVICE_SECRET_KEY неверный.
        throw new Error(`Failed to load Keypair from SERVICE_SECRET_KEY: ${e.message}`);
    }
}

/**
 * Возвращает Connection.
 * @returns {Connection}
 */
export function getConnection() {
    if (!connectionInstance) {
        // ❌ Исправление: Использовать Connection напрямую
        connectionInstance = new Connection(CLUSTER_URL, 'confirmed'); 
    }
    return connectionInstance;
}

/**
 * Возвращает баланс сервисного кошелька (в SOL).
 */
export async function getServiceWalletBalance() {
    try {
        const keypair = getServiceKeypair();
        const connection = getConnection();

        const balanceLamports = await connection.getBalance(keypair.publicKey);
        
        // ❌ Исправление: Использовать LAMPORTS_PER_SOL напрямую
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL; 

        return { 
            wallet: keypair.publicKey.toBase58(),
            balanceSOL: balanceSOL
        };
    } catch (error) {
        throw new Error(`Failed to fetch service wallet balance: ${error.message}`);
    }
}