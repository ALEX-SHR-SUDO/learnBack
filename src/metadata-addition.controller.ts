// src/metadata-addition.controller.ts

import { Request, Response } from "express";
import { createTokenAndMetadata } from './metadata-addition.service.js';
import { solanaTxUrl } from './utils/solana-signature.js';

interface CreateTokenRequest {
    name: string;
    symbol: string;
    uri: string;
    supply: string;
    decimals: string;
}

export async function handleCreateTokenAndMetadata(req: Request<any, any, CreateTokenRequest>, res: Response) {
    try {
        const { name, symbol, uri, supply, decimals } = req.body;
        console.log("Req Body Received:", req.body);

        if (!name || !symbol || !uri || !supply || !decimals) {
            return res.status(400).json({ error: "Missing required fields: name, symbol, uri, supply, or decimals." });
        }

        const tokenDetails: CreateTokenRequest = { name, symbol, uri, supply, decimals };
        console.log("Начинаем ШАГ 1-4: createTokenAndMetadata (полный процесс)");
        
        // Mint + metadata (одна транзакция, без отдельного addTokenMetadata)
        const result = await createTokenAndMetadata(tokenDetails);
        
        res.status(200).json({
            message: "Token and metadata successfully created.",
            mintAddress: result.mintAddress,
            transactionSignature: result.mintTx, 
            explorerLinkCreate: solanaTxUrl(result.mintTx, 'devnet'),
            solscanTokenLink: `https://solscan.io/token/${result.mintAddress}?cluster=devnet`,
            solscanTxLink: `https://solscan.io/tx/${result.mintTx}?cluster=devnet`,
            ataAddress: result.ata 
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`❌ Ошибка при создании токена: ${errorMessage}`, error);
        res.status(500).json({ 
            error: errorMessage, 
            details: "An error occurred during token creation or metadata addition." 
        });
    }
}

