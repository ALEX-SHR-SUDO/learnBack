// src/metadata-addition.controller.ts

import { Request, Response } from "express";
import { createTokenAndMetadata, addTokenMetadata } from './metadata-addition.service.js';

interface CreateTokenRequest {
    name: string;
    symbol: string;
    uri: string;
    supply: string;
    decimals: string;
}

interface AddMetadataRequest {
    mintAddress: string;
    name: string;
    symbol: string;
    uri: string;
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
        
        // Вызов сервисной функции (mint + metadata)
        const result = await createTokenAndMetadata(tokenDetails);
        
        res.status(200).json({
            message: "Token and metadata successfully created.",
            mintAddress: result.mintAddress,
            transactionSignature: result.mintTx, 
            metadataSignature: result.metadataTx,
            explorerLinkCreate: `https://explorer.solana.com/tx/${result.mintTx}?cluster=devnet`,
            explorerLinkMetadata: `https://explorer.solana.com/tx/${result.metadataTx}?cluster=devnet`,
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

export async function handleAddTokenMetadata(req: Request<any, any, AddMetadataRequest>, res: Response) {
    try {
        const { mintAddress, name, symbol, uri } = req.body;

        if (!mintAddress || !name || !symbol || !uri) {
            return res.status(400).json({ error: "Missing required fields: mintAddress, name, symbol, or uri." });
        }

        const metadataDetails = { name, symbol, uri };

        console.log("Начинаем ШАГ 5: addTokenMetadata");
        const signature = await addTokenMetadata(mintAddress, metadataDetails);
        
        res.status(200).json({
            message: "Metadata successfully added to existing token.",
            transactionSignature: signature,
            explorerLink: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`❌ Ошибка при добавлении метаданных: ${errorMessage}`, error);
        res.status(500).json({ 
            error: errorMessage, 
            details: "An error occurred while adding metadata." 
        });
    }
}
