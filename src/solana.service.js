// src/solana.service.js

// ✅ DIRECT IMPORT OF ALL NECESSARY CLASSES AND CONSTANTS
import { 
    Connection, 
    Keypair, 
    LAMPORTS_PER_SOL,
    PublicKey 
} from '@solana/web3.js'; 
import bs58 from 'bs58';
import * as splToken from '@solana/spl-token'; 

// --- ИСПРАВЛЕНИЕ METAPLEX PROGRAM ID ---
// ⚠️ Мы удаляем импорт '@metaplex-foundation/mpl-token-metadata' и жестко
// прописываем константный ID, чтобы гарантировать корректную инициализацию PublicKey.
// Это решает проблему "Invalid public key input".
const METADATA_PROGRAM_ID_STRING = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msC8hEzNqQ';
// ----------------------------------------

// --- GLOBAL CONSTANTS AND LAZY INITIALIZATION ---

const CLUSTER_URL = 'https://api.devnet.solana.com';
let connectionInstance = null;
let serviceKeypairInstance = null;

/**
 * Returns the Metaplex Token Metadata Program ID.
 * ✅ ИСПРАВЛЕНИЕ: Создаем PublicKey из гарантированно корректной строки.
 * @returns {PublicKey}
 */
export function getMetadataProgramId() {
    return new PublicKey(METADATA_PROGRAM_ID_STRING);
}

/**
 * Loads the Keypair from SERVICE_SECRET_KEY (Base58).
 * @returns {Keypair} Keypair of the service wallet
 */
export function getServiceKeypair() {
    if (serviceKeypairInstance) return serviceKeypairInstance;

    const secretKeyBs58 = process.env.SERVICE_SECRET_KEY;
    if (!secretKeyBs58) {
        throw new Error("SERVICE_SECRET_KEY is not defined in environment."); 
    }
    
    try {
        const secretKeyBytes = bs58.decode(secretKeyBs58);
        
        // Use Keypair directly
        serviceKeypairInstance = Keypair.fromSecretKey(secretKeyBytes); 
        
        console.log(`✅ Сервисный кошелёк загружен: ${serviceKeypairInstance.publicKey.toBase58()}`);
        return serviceKeypairInstance;
    } catch (e) {
        // If the error here is "Non-base58 character", then SERVICE_SECRET_KEY is invalid.
        throw new Error(`Failed to load Keypair from SERVICE_SECRET_KEY: ${e.message}`);
    }
}

/**
 * ALIAS: Returns the service wallet Keypair.
 * @returns {Keypair} Keypair of the service wallet
 */
export function getServiceWallet() {
    return getServiceKeypair();
}

/**
 * Returns the Connection.
 * @returns {Connection}
 */
export function getConnection() {
    if (!connectionInstance) {
        // Use Connection directly
        connectionInstance = new Connection(CLUSTER_URL, 'confirmed'); 
    }
    return connectionInstance;
}

/**
 * Returns the balance of the service wallet (in SOL) and its address.
 */
export async function getServiceWalletBalance() {
    const keypair = getServiceKeypair();
    const connection = getConnection();
    const serviceAddress = keypair.publicKey.toBase58();
    
    let tokenList = [];
    
    try {
        // --- 1. Fetch SOL balance ---
        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL; 
        
        // --- 2. Fetch SPL token list ---
        const tokenAccounts = await connection.getTokenAccountsByOwner(
            keypair.publicKey,
            // ✅ USE splToken.TOKEN_PROGRAM_ID
            { programId: splToken.TOKEN_PROGRAM_ID } 
        );

        tokenList = tokenAccounts.value
            .map(accountInfo => {
                // ✅ USE splToken.*
                const data = splToken.AccountLayout.decode(accountInfo.account.data);
                
                // Filter out closed (zeroed) accounts
                if (data.state === splToken.AccountState.Initialized) {
                     return {
                        mint: data.mint.toBase58(),
                        amount: Number(data.amount), // Convert BigInt to Number (for frontend)
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

