// src/solana.service.js

import { 
    Connection, 
    Keypair, 
    LAMPORTS_PER_SOL,
    PublicKey 
} from '@solana/web3.js'; 
import bs58 from 'bs58';
import * as splToken from '@solana/spl-token'; 

// --- КОНСТАНТЫ ПРОГРАММЫ ---
// Program ID для Metaplex Token Metadata
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msC8hEzNqQ'); 
// ----------------------------

// --- ГЛОБАЛЬНЫЕ КОНСТАНТЫ И ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ ---
const CLUSTER_URL = 'https://api.devnet.solana.com';
const WALLET_SECRET_KEY = process.env.SERVICE_SECRET_KEY; // Предполагаемый ключ
let connectionInstance = null;
let serviceWalletInstance = null;

/**
 * Возвращает Program ID для Metaplex Token Metadata.
 * @returns {PublicKey}
 */
export function getMetadataProgramId() {
    return METAPLEX_PROGRAM_ID;
}

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
 * Загружает Keypair из SERVICE_SECRET_KEY (Base58).
 * @returns {Keypair} Keypair of the service wallet
 */
export function getServiceWallet() {
    if (serviceWalletInstance) return serviceWalletInstance;

    if (!WALLET_SECRET_KEY) {
        throw new Error("SERVICE_SECRET_KEY is not defined in environment.");
    }
    try {
        const secretKeyUint8 = bs58.decode(WALLET_SECRET_KEY);
        serviceWalletInstance = Keypair.fromSecretKey(secretKeyUint8);
        console.log(`✅ Сервисный кошелёк загружен: ${serviceWalletInstance.publicKey.toBase58()}`);
        return serviceWalletInstance;
    } catch (e) {
        throw new Error(`Failed to load Keypair from SERVICE_SECRET_KEY: ${e.message}`);
    }
}

/**
 * Возвращает баланс сервисного кошелька (в SOL) и список токенов.
 */
export async function getServiceWalletBalance() {
    const keypair = getServiceWallet();
    const connection = getConnection();
    const serviceAddress = keypair.publicKey.toBase58();
    
    let tokenList = [];
    
    try {
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
                
                if (data.state === splToken.AccountState.Initialized) {
                     return {
                        mint: data.mint.toBase58(),
                        amount: Number(data.amount),
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
