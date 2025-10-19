// src/solana.service.js

// ✅ ПРЯМОЙ ИМПОРТ ВСЕХ НЕОБХОДИМЫХ КЛАССОВ И КОНСТАНТ
import { 
    Connection, 
    Keypair, 
    LAMPORTS_PER_SOL,
    PublicKey 
} from '@solana/web3.js'; 
import bs58 from 'bs58';
import * as splToken from '@solana/spl-token'; 

// --- ГЛОБАЛЬНЫЕ КОНСТАНТЫ И ЛЕЙЗИ-ИНИЦИАЛИЗАЦИЯ ---

const CLUSTER_URL = 'https://api.devnet.solana.com';
let connectionInstance = null;
let serviceKeypairInstance = null;

// ✅ НОВЫЙ ПОДХОД: Функция для ленивой (lazy) инициализации Metaplex ID.
// Это гарантирует, что она будет вызвана только после полной загрузки модуля.
export function getMetadataProgramId() {
    return new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6z8BXgZay');
}

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
        
        // Используем Keypair напрямую
        serviceKeypairInstance = Keypair.fromSecretKey(secretKeyBytes); 
        
        console.log(`✅ Сервисный кошелёк загружен: ${serviceKeypairInstance.publicKey.toBase58()}`);
        return serviceKeypairInstance;
    } catch (e) {
        // Если ошибка здесь "Non-base58 character", значит, SERVICE_SECRET_KEY неверный.
        throw new Error(`Failed to load Keypair from SERVICE_SECRET_KEY: ${e.message}`);
    }
}

/**
 * ПСЕВДОНИМ: Возвращает Keypair сервисного кошелька.
 * @returns {Keypair} Keypair сервисного кошелька
 */
export function getServiceWallet() {
    return getServiceKeypair();
}

/**
 * Возвращает Connection.
 * @returns {Connection}
 */
export function getConnection() {
    if (!connectionInstance) {
        // Используем Connection напрямую
        connectionInstance = new Connection(CLUSTER_URL, 'confirmed'); 
    }
    return connectionInstance;
}

/**
 * Возвращает баланс сервисного кошелька (в SOL) и его адрес.
 */
export async function getServiceWalletBalance() {
    const keypair = getServiceKeypair();
    const connection = getConnection();
    const serviceAddress = keypair.publicKey.toBase58();
    
    let tokenList = [];
    
    try {
        // --- 1. Получение баланса SOL ---
        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL; 
        
        // --- 2. Получение списка токенов SPL ---
        const tokenAccounts = await connection.getTokenAccountsByOwner(
            keypair.publicKey,
            // ✅ ИСПОЛЬЗУЕМ splToken.TOKEN_PROGRAM_ID
            { programId: splToken.TOKEN_PROGRAM_ID } 
        );

        tokenList = tokenAccounts.value
            .map(accountInfo => {
                // ✅ ИСПОЛЬЗУЕМ splToken.*
                const data = splToken.AccountLayout.decode(accountInfo.account.data);
                
                // Фильтруем закрытые (зануленные) аккаунты
                if (data.state === splToken.AccountState.Initialized) {
                     return {
                        mint: data.mint.toBase58(),
                        amount: Number(data.amount), // Преобразуем BigInt в Number (для фронтенда)
                    };
                }
                return null;
            })
            .filter(token => token !== null);

        return { 
            serviceAddress: serviceAddress,
            sol: balanceSOL,
            tokens: tokenList
        };
        
    } catch (error) {
        if (error.message && error.message.includes('Account not found')) {
             return { 
                serviceAddress: serviceAddress,
                sol: 0,
                tokens: []
            };
        }
        
        throw new Error(`Failed to fetch service wallet balance: ${error.message}`);
    }
}
