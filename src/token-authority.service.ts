// src/token-authority.service.ts

import { 
    setAuthority,
    AuthorityType,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { getServiceWallet, getConnection } from './solana.service.js';

/**
 * Revokes freeze authority for a token mint.
 * After revoking, no one will be able to freeze token accounts for this mint.
 * @param mintAddress - The address of the token mint
 * @returns {Promise<string>} Transaction signature
 */
export async function revokeFreezeAuthority(mintAddress: string): Promise<string> {
    const connection = getConnection();
    const wallet = getServiceWallet();
    
    try {
        // Validate mint address format
        let mintPublicKey: PublicKey;
        try {
            mintPublicKey = new PublicKey(mintAddress);
        } catch (error) {
            throw new Error(`Invalid mint address format: ${mintAddress}`);
        }
        
        console.log(`🔒 Revoking freeze authority for mint: ${mintAddress}`);
        
        // Set authority to null to revoke it
        const signature = await setAuthority(
            connection,
            wallet, // payer
            mintPublicKey, // mint account
            wallet, // current authority
            AuthorityType.FreezeAccount, // authority type to revoke
            null, // new authority (null = revoke)
            [],
            undefined,
            TOKEN_PROGRAM_ID
        );
        
        console.log(`✅ Freeze authority revoked. Transaction: ${signature}`);
        return signature;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error revoking freeze authority: ${errorMessage}`);
        throw new Error(`Failed to revoke freeze authority: ${errorMessage}`);
    }
}

/**
 * Revokes mint authority for a token mint.
 * After revoking, no one will be able to mint new tokens.
 * This makes the token supply fixed and immutable.
 * @param mintAddress - The address of the token mint
 * @returns {Promise<string>} Transaction signature
 */
export async function revokeMintAuthority(mintAddress: string): Promise<string> {
    const connection = getConnection();
    const wallet = getServiceWallet();
    
    try {
        // Validate mint address format
        let mintPublicKey: PublicKey;
        try {
            mintPublicKey = new PublicKey(mintAddress);
        } catch (error) {
            throw new Error(`Invalid mint address format: ${mintAddress}`);
        }
        
        console.log(`🔒 Revoking mint authority for mint: ${mintAddress}`);
        
        // Set authority to null to revoke it
        const signature = await setAuthority(
            connection,
            wallet, // payer
            mintPublicKey, // mint account
            wallet, // current authority
            AuthorityType.MintTokens, // authority type to revoke
            null, // new authority (null = revoke)
            [],
            undefined,
            TOKEN_PROGRAM_ID
        );
        
        console.log(`✅ Mint authority revoked. Transaction: ${signature}`);
        return signature;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error revoking mint authority: ${errorMessage}`);
        throw new Error(`Failed to revoke mint authority: ${errorMessage}`);
    }
}
