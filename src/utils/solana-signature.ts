// src/utils/solana-signature.ts

import bs58 from 'bs58';
import { Buffer } from 'buffer';

/**
 * Format a transaction signature to base58 string.
 * Accepts Uint8Array, Buffer, or string (returns as-is if already string).
 * 
 * @param sig - Transaction signature as Uint8Array, Buffer, or string
 * @returns Base58-encoded signature string
 * 
 * @example
 * const signature = new Uint8Array([1, 2, 3, ...]);
 * const base58Sig = formatSignature(signature);
 * console.log(base58Sig); // "3Zx7..."
 */
export function formatSignature(sig: Uint8Array | Buffer | string): string {
    // If already a string, return as-is
    if (typeof sig === 'string') {
        return sig;
    }
    
    // Convert to Buffer and encode as base58
    const buffer = Buffer.from(sig);
    return bs58.encode(buffer);
}

/**
 * Build a Solana Explorer transaction URL.
 * 
 * @param signature - Transaction signature (Uint8Array, Buffer, or string)
 * @param cluster - Solana cluster (default: 'devnet')
 * @returns Full URL to view the transaction on Solana Explorer
 * 
 * @example
 * const url = solanaTxUrl(txSignature, 'devnet');
 * console.log(url); // "https://explorer.solana.com/tx/3Zx7...?cluster=devnet"
 */
export function solanaTxUrl(signature: Uint8Array | Buffer | string, cluster: string = 'devnet'): string {
    const base58Sig = formatSignature(signature);
    return `https://explorer.solana.com/tx/${base58Sig}?cluster=${cluster}`;
}

/**
 * Build a Solana Explorer token URL (for viewing token metadata).
 * 
 * @param mintAddress - Token mint address (string)
 * @param cluster - Solana cluster (default: 'devnet')
 * @returns Full URL to view the token on Solana Explorer
 * 
 * @example
 * const url = solanaTokenUrl('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'devnet');
 * console.log(url); // "https://explorer.solana.com/address/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU?cluster=devnet"
 */
export function solanaTokenUrl(mintAddress: string, cluster: string = 'devnet'): string {
    return `https://explorer.solana.com/address/${mintAddress}?cluster=${cluster}`;
}

/**
 * Build a Solscan transaction URL.
 * 
 * @param signature - Transaction signature (Uint8Array, Buffer, or string)
 * @param cluster - Solana cluster (default: 'devnet')
 * @returns Full URL to view the transaction on Solscan
 * 
 * @example
 * const url = solscanTxUrl(txSignature, 'devnet');
 * console.log(url); // "https://solscan.io/tx/3Zx7...?cluster=devnet"
 */
export function solscanTxUrl(signature: Uint8Array | Buffer | string, cluster: string = 'devnet'): string {
    const base58Sig = formatSignature(signature);
    return `https://solscan.io/tx/${base58Sig}?cluster=${cluster}`;
}

/**
 * Build a Solscan token URL.
 * 
 * @param mintAddress - Token mint address (string)
 * @param cluster - Solana cluster (default: 'devnet')
 * @returns Full URL to view the token on Solscan
 * 
 * @example
 * const url = solscanTokenUrl('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'devnet');
 * console.log(url); // "https://solscan.io/token/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU?cluster=devnet"
 */
export function solscanTokenUrl(mintAddress: string, cluster: string = 'devnet'): string {
    return `https://solscan.io/token/${mintAddress}?cluster=${cluster}`;
}
