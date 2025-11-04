// src/utils/solana-signature.ts

import bs58 from 'bs58';
import { Buffer } from 'buffer';

/**
 * Formats a Solana transaction signature to base58 string format.
 * 
 * @param sig - Transaction signature as Uint8Array, Buffer, or string
 * @returns Base58-encoded signature string
 * 
 * @example
 * ```typescript
 * const signature = formatSignature(result.signature);
 * console.log(`Transaction signature: ${signature}`);
 * ```
 */
export function formatSignature(sig: Uint8Array | Buffer | string): string {
    // If already a string, return as-is (assume it's already base58)
    if (typeof sig === 'string') {
        return sig;
    }
    
    // Convert Uint8Array or Buffer to base58
    return bs58.encode(Buffer.from(sig));
}

/**
 * Generates a Solana Explorer transaction URL.
 * 
 * @param signature - Transaction signature as Uint8Array, Buffer, or string
 * @param cluster - Solana cluster name (default: 'devnet')
 * @returns Complete Solana Explorer URL for the transaction
 * 
 * @example
 * ```typescript
 * const url = solanaTxUrl(result.signature);
 * console.log(`View transaction: ${url}`);
 * ```
 */
export function solanaTxUrl(signature: Uint8Array | Buffer | string, cluster: string = 'devnet'): string {
    const base58Signature = formatSignature(signature);
    return `https://explorer.solana.com/tx/${base58Signature}?cluster=${cluster}`;
}

/**
 * Generates a Solana Explorer token URL.
 * 
 * @param mintAddress - Token mint address
 * @param cluster - Solana cluster name (default: 'devnet')
 * @returns Complete Solana Explorer URL for the token
 * 
 * @example
 * ```typescript
 * const url = solanaTokenUrl('TokenMint...');
 * console.log(`View token: ${url}`);
 * ```
 */
export function solanaTokenUrl(mintAddress: string, cluster: string = 'devnet'): string {
    return `https://explorer.solana.com/address/${mintAddress}?cluster=${cluster}`;
}
