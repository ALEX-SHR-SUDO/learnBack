// src/metadata-addition.controller.js

import { createTokenAndMetadata, addTokenMetadata } from './metadata-addition.service.js';

/**
 * Обрабатывает запрос на создание нового токена, чеканку и добавление метаданных.
 * * Ожидаемый JSON Body:
 * {
 * "name": "Token Name",
 * "symbol": "SYM",
 * "uri": "http://uri-to-metadata.json",
 * "supply": "1000000000", // Общее количество токенов (строка)
 * "decimals": "9"          // Количество десятичных знаков (строка)
 * }
 */
export async function handleCreateTokenAndMetadata(req, res) {
    try {
        // --- КРИТИЧНОЕ ИСПРАВЛЕНИЕ: ПРАВИЛЬНАЯ ДЕСТРУКТУРИЗАЦИЯ ВСЕХ ПОЛЕЙ ---
        const { name, symbol, uri, supply, decimals } = req.body;

        console.log("Req Body Received:", req.body);
        
        // Создаем объект со всеми необходимыми данными для сервиса
        const tokenDetails = {
            name, 
            symbol, 
            uri,
            supply,   // Убедитесь, что supply передается
            decimals  // Убедитесь, что decimals передается
        };

        // Логирование для отслеживания того, что будет передано в сервис
        console.log("Destructured values to be passed to service:", tokenDetails);
        
        // Дополнительная проверка на наличие всех полей
        if (!name || !symbol || !uri || !supply || !decimals) {
            return res.status(400).json({ error: "Missing required fields: name, symbol, uri, supply, or decimals." });
        }

        console.log("Начинаем ШАГ 1-4: createTokenAndMetadata (полный процесс)");
        const result = await createTokenAndMetadata(tokenDetails);
        
        res.status(200).json({
            message: "Token and metadata successfully created.",
            mintAddress: result.mintAddress,
            transactionSignature: result.signature,
            explorerLink: `https://explorer.solana.com/tx/${result.signature}?cluster=devnet`
        });

    } catch (error) {
        console.error(`❌ Ошибка при создании токена: ${error.message}`, error);
        res.status(500).json({ 
            error: error.message, 
            details: "An error occurred during token creation or metadata addition." 
        });
    }
}

/**
 * Обрабатывает запрос на добавление метаданных к существующему токену.
 * Ожидаемый JSON Body:
 * {
 * "mintAddress": "...",
 * "name": "Token Name",
 * "symbol": "SYM",
 * "uri": "http://uri-to-metadata.json"
 * }
 */
export async function handleAddTokenMetadata(req, res) {
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
        console.error(`❌ Ошибка при добавлении метаданных: ${error.message}`, error);
        res.status(500).json({ 
            error: error.message, 
            details: "An error occurred while adding metadata." 
        });
    }
}
