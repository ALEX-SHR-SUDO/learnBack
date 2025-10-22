// src/metadata-addition.controller.ts
// Удаляем суффикс .js и импортируем функции сервиса
import { createTokenAndMetadata, addTokenMetadata } from './metadata-addition.service.js';
/**
 * Обрабатывает запрос на создание нового токена, чеканку и добавление метаданных.
 * * Ожидаемый JSON Body: CreateTokenRequest
 */
export async function handleCreateTokenAndMetadata(req, res) {
    try {
        const { name, symbol, uri, supply, decimals } = req.body;
        console.log("Req Body Received:", req.body);
        // Проверка наличия обязательных полей
        if (!name || !symbol || !uri || !supply || !decimals) {
            return res.status(400).json({ error: "Missing required fields: name, symbol, uri, supply, or decimals." });
        }
        const tokenDetails = {
            name,
            symbol,
            uri,
            supply,
            decimals
        };
        console.log("Начинаем ШАГ 1-4: createTokenAndMetadata (полный процесс)");
        // Вызов сервисной функции
        const result = await createTokenAndMetadata(tokenDetails);
        // Используем mintAddress и metadataTx (которое является подписью транзакции) для ответа
        res.status(200).json({
            message: "Token and metadata successfully created.",
            mintAddress: result.mintAddress,
            // metadataTx содержит подпись транзакции, созданной Umi.
            transactionSignature: result.metadataTx,
            explorerLink: `https://explorer.solana.com/tx/${result.metadataTx}?cluster=devnet`,
            ataAddress: result.ata // Добавляем ATA (Associated Token Account) для полноты
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
/**
 * Обрабатывает запрос на добавление метаданных к существующему токену.
 * Ожидаемый JSON Body: AddMetadataRequest
 */
export async function handleAddTokenMetadata(req, res) {
    try {
        const { mintAddress, name, symbol, uri } = req.body;
        if (!mintAddress || !name || !symbol || !uri) {
            return res.status(400).json({ error: "Missing required fields: mintAddress, name, symbol, or uri." });
        }
        const metadataDetails = { name, symbol, uri };
        console.log("Начинаем ШАГ 5: addTokenMetadata");
        // Вызов сервисной функции
        const signature = await addTokenMetadata(mintAddress, metadataDetails);
        res.status(200).json({
            message: "Metadata successfully added to existing token.",
            transactionSignature: signature,
            explorerLink: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`❌ Ошибка при добавлении метаданных: ${errorMessage}`, error);
        res.status(500).json({
            error: errorMessage,
            details: "An error occurred while adding metadata."
        });
    }
}
