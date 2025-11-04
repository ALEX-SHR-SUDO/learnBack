// src/token-authority.controller.ts

import { Request, Response } from "express";
import { revokeFreezeAuthority, revokeMintAuthority } from './token-authority.service.js';
import { solanaTxUrl, solscanTxUrl } from './utils/solana-signature.js';

interface RevokeAuthorityRequest {
    mintAddress: string;
}

/**
 * Handler for revoking freeze authority
 */
export async function handleRevokeFreezeAuthority(
    req: Request<any, any, RevokeAuthorityRequest>, 
    res: Response
) {
    try {
        const { mintAddress } = req.body;
        console.log("Revoke Freeze Authority Request:", req.body);

        if (!mintAddress) {
            return res.status(400).json({ 
                error: "Missing required field: mintAddress" 
            });
        }

        // Basic validation for mint address format
        if (typeof mintAddress !== 'string' || mintAddress.trim().length === 0) {
            return res.status(400).json({ 
                error: "Invalid mintAddress: must be a non-empty string" 
            });
        }

        const signature = await revokeFreezeAuthority(mintAddress);
        
        res.status(200).json({
            message: "Freeze authority successfully revoked.",
            mintAddress,
            transactionSignature: signature,
            explorerLink: solanaTxUrl(signature, 'devnet'),
            solscanTxLink: solscanTxUrl(signature, 'devnet')
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`❌ Error revoking freeze authority: ${errorMessage}`, error);
        res.status(500).json({ 
            error: errorMessage,
            details: "An error occurred while revoking freeze authority." 
        });
    }
}

/**
 * Handler for revoking mint authority
 */
export async function handleRevokeMintAuthority(
    req: Request<any, any, RevokeAuthorityRequest>, 
    res: Response
) {
    try {
        const { mintAddress } = req.body;
        console.log("Revoke Mint Authority Request:", req.body);

        if (!mintAddress) {
            return res.status(400).json({ 
                error: "Missing required field: mintAddress" 
            });
        }

        // Basic validation for mint address format
        if (typeof mintAddress !== 'string' || mintAddress.trim().length === 0) {
            return res.status(400).json({ 
                error: "Invalid mintAddress: must be a non-empty string" 
            });
        }

        const signature = await revokeMintAuthority(mintAddress);
        
        res.status(200).json({
            message: "Mint authority successfully revoked. Token supply is now fixed.",
            mintAddress,
            transactionSignature: signature,
            explorerLink: solanaTxUrl(signature, 'devnet'),
            solscanTxLink: solscanTxUrl(signature, 'devnet')
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`❌ Error revoking mint authority: ${errorMessage}`, error);
        res.status(500).json({ 
            error: errorMessage,
            details: "An error occurred while revoking mint authority." 
        });
    }
}
