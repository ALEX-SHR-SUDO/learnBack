// src/utils/solana-signature.ts

import bs58 from 'bs58';
import { Buffer } from 'buffer';

/**
 * Valid Solana cluster types
 */
type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet';

/**
 * Validate if a cluster is a valid Solana cluster.
 * @param cluster - Cluster name to validate
 * @throws Error if cluster is not valid
 */
function validateCluster(cluster: string): void {
    const validClusters: SolanaCluster[] = ['mainnet-beta', 'devnet', 'testnet'];
    if (!validClusters.includes(cluster as SolanaCluster)) {
        throw new Error(`Invalid cluster: ${cluster}. Must be one of: ${validClusters.join(', ')}`);
    }
}

/**
 * Validate if a string is a valid base58 signature.
 * Basic validation - checks if the string can be decoded as base58.
 * @param str - String to validate
 * @returns true if valid base58, false otherwise
 */
function isValidBase58(str: string): boolean {
    try {
        bs58.decode(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Format a transaction signature to base58 string.
 * Accepts Uint8Array, Buffer, or string (returns as-is if already string).
 * 
 * @param sig - Transaction signature as Uint8Array, Buffer, or string
 * @returns Base58-encoded signature string
 * @throws Error if string input is not valid base58
 * 
 * @example
 * const signature = new Uint8Array([1, 2, 3, ...]);
 * const base58Sig = formatSignature(signature);
 * console.log(base58Sig); // "3Zx7..."
 */
export function formatSignature(sig: Uint8Array | Buffer | string): string {
    // If already a string, validate and return
    if (typeof sig === 'string') {
        if (!isValidBase58(sig)) {
            throw new Error('Invalid base58 signature string provided');
        }
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
 * @throws Error if cluster is not a valid Solana cluster
 * 
 * @example
 * const url = solanaTxUrl(txSignature, 'devnet');
 * console.log(url); // "https://explorer.solana.com/tx/3Zx7...?cluster=devnet"
 */
export function solanaTxUrl(signature: Uint8Array | Buffer | string, cluster: string = 'devnet'): string {
    validateCluster(cluster);
    const base58Sig = formatSignature(signature);
    return `https://explorer.solana.com/tx/${base58Sig}?cluster=${cluster}`;
}

/**
 * Build a Solana Explorer token URL (for viewing token metadata).
 * 
 * @param mintAddress - Token mint address (string)
 * @param cluster - Solana cluster (default: 'devnet')
 * @returns Full URL to view the token on Solana Explorer
 * @throws Error if cluster is not a valid Solana cluster
 * 
 * @example
 * const url = solanaTokenUrl('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'devnet');
 * console.log(url); // "https://explorer.solana.com/address/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU?cluster=devnet"
 */
export function solanaTokenUrl(mintAddress: string, cluster: string = 'devnet'): string {
    validateCluster(cluster);
    return `https://explorer.solana.com/address/${mintAddress}?cluster=${cluster}`;
}

/**
 * Build a Solscan transaction URL.
 * 
 * @param signature - Transaction signature (Uint8Array, Buffer, or string)
 * @param cluster - Solana cluster (default: 'devnet')
 * @returns Full URL to view the transaction on Solscan
 * @throws Error if cluster is not a valid Solana cluster
 * 
 * @example
 * const url = solscanTxUrl(txSignature, 'devnet');
 * console.log(url); // "https://solscan.io/tx/3Zx7...?cluster=devnet"
 */
export function solscanTxUrl(signature: Uint8Array | Buffer | string, cluster: string = 'devnet'): string {
    validateCluster(cluster);
    const base58Sig = formatSignature(signature);
    return `https://solscan.io/tx/${base58Sig}?cluster=${cluster}`;
}

/**
 * Build a Solscan token URL.
 * 
 * @param mintAddress - Token mint address (string)
 * @param cluster - Solana cluster (default: 'devnet')
 * @returns Full URL to view the token on Solscan
 * @throws Error if cluster is not a valid Solana cluster
 * 
 * @example
 * const url = solscanTokenUrl('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'devnet');
 * console.log(url); // "https://solscan.io/token/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU?cluster=devnet"
 */
export function solscanTokenUrl(mintAddress: string, cluster: string = 'devnet'): string {
    validateCluster(cluster);
    return `https://solscan.io/token/${mintAddress}?cluster=${cluster}`;
}
