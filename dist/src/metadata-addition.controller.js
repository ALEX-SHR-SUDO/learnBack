// src/metadata-addition.controller.ts
import { createTokenAndMetadata } from './metadata-addition.service.js';
export async function handleCreateTokenAndMetadata(req, res) {
    try {
        const { name, symbol, uri, supply, decimals } = req.body;
        console.log("Req Body Received:", req.body);
        if (!name || !symbol || !uri || !supply || !decimals) {
            return res.status(400).json({ error: "Missing required fields: name, symbol, uri, supply, or decimals." });
        }
        const tokenDetails = { name, symbol, uri, supply, decimals };
        console.log("Начинаем ШАГ 1-4: createTokenAndMetadata (полный процесс)");
        // Mint + metadata (одна транзакция, без отдельного addTokenMetadata)
        const result = await createTokenAndMetadata(tokenDetails);
        res.status(200).json({
            message: "Token and metadata successfully created.",
            mintAddress: result.mintAddress,
            transactionSignature: result.mintTx,
            explorerLinkCreate: `https://explorer.solana.com/tx/${result.mintTx}?cluster=devnet`,
            ataAddress: result.ata
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`❌ Ошибка при создании токена: ${errorMessage}`, error);
        res.status(500).json({
            error: errorMessage,
            details: "An error occurred during token creation or metadata addition."
        });
    }
}
