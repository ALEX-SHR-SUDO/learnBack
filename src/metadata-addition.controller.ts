// src/metadata-addition.controller.ts

import { Request, Response } from "express";
import { createTokenAndMetadata } from './metadata-addition.service.js';
import { solanaTxUrl, solscanTokenUrl, solscanTxUrl } from './utils/solana-signature.js';
import { validateMetadataUri, formatValidationWarnings } from './metadata-validator.js';

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

        // Validate metadata before creating token
        console.log("🔍 Validating metadata from URI...");
        const validationResult = await validateMetadataUri(uri, name, symbol);
        
        if (validationResult.warnings.length > 0) {
            console.warn("⚠️  Metadata validation warnings:");
            validationResult.warnings.forEach((warning, index) => {
                console.warn(`   ${index + 1}. ${warning}`);
            });
            
            // If metadata is critically invalid (can't fetch or missing required fields), reject the request
            const hasCriticalErrors = validationResult.warnings.some(w => 
                w.includes("not accessible") || 
                w.includes("not found") ||
                w.includes("Missing or invalid 'name'") ||
                w.includes("Missing or invalid 'symbol'")
            );
            
            if (hasCriticalErrors) {
                return res.status(400).json({
                    error: "Metadata validation failed",
                    warnings: validationResult.warnings,
                    recommendation: "Please ensure your metadata URI is accessible and contains valid 'name' and 'symbol' fields. Consider using /api/generate-metadata endpoint to create properly formatted metadata."
                });
            }
            
            // For non-critical warnings, log them but continue
            console.log("⚠️  Continuing with token creation despite metadata warnings...");
        } else {
            console.log("✅ Metadata validation passed");
        }

        const tokenDetails: CreateTokenRequest = { name, symbol, uri, supply, decimals };
        console.log("Начинаем ШАГ 1-4: createTokenAndMetadata (полный процесс)");
        
        // Mint + metadata (одна транзакция, без отдельного addTokenMetadata)
        const result = await createTokenAndMetadata(tokenDetails);
        
        const response: any = {
            message: "Token and metadata successfully created.",
            mintAddress: result.mintAddress,
            transactionSignature: result.mintTx, 
            explorerLinkCreate: solanaTxUrl(result.mintTx, 'devnet'),
            solscanTokenLink: solscanTokenUrl(result.mintAddress, 'devnet'),
            solscanTxLink: solscanTxUrl(result.mintTx, 'devnet'),
            ataAddress: result.ata
        };
        
        // Include warnings in response if metadata had issues
        if (validationResult.warnings.length > 0) {
            response.warnings = validationResult.warnings;
            response.note = "Token created successfully, but metadata may not display properly on Solscan due to the warnings above. Consider using /api/generate-metadata endpoint for properly formatted metadata.";
        }
        
        res.status(200).json(response);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`❌ Ошибка при создании токена: ${errorMessage}`, error);
        res.status(500).json({ 
            error: errorMessage, 
            details: "An error occurred during token creation or metadata addition." 
        });
    }
}

