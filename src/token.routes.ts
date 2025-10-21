// src/token.routes.ts

import express, { Request, Response } from "express";
const router = express.Router();

// ✅ ИМПОРТ ФУНКЦИЙ КОНТРОЛЛЕРА
// Удален суффикс .js, так как теперь мы используем .ts файлы
import { 
    handleCreateTokenAndMetadata, 
    handleAddTokenMetadata 
} from "./metadata-addition.controller.js"; 

// Импорт сервисов для вспомогательных функций (balance, ping)
// Удален суффикс .js
import { 
    getConnection, 
    getServiceWalletBalance, 
    getServiceWallet 
} from "./solana.service.js"; 

// ---------------------------------------------
// --- Проверка соединения ---
// ---------------------------------------------
// Добавлена явная типизация Request и Response
router.get("/ping", async (req: Request, res: Response) => {
  try {
    const connection = getConnection();
    if (!connection) throw new Error("Solana connection failed.");
      
    const version = await connection.getVersion(); 
    // Возвращаем публичный ключ сервисного кошелька для удобства
    const serviceAddress = getServiceWallet().publicKey.toBase58();

    res.json({ 
        ok: true, 
        cluster: connection.rpcEndpoint, 
        solana: version,
        serviceAddress: serviceAddress
    });
  } catch (e) {
    // Явно приводим ошибку к строке
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "Unknown error during ping" });
  }
});

// ---------------------------------------------
// --- 1. Создание токена с метаданными (ОБЪЕДИНЕННЫЙ ШАГ) ---
// ---------------------------------------------
// ✅ Используем функцию контроллера для обработки логики запроса/ответа
router.post("/create-token", handleCreateTokenAndMetadata);

// ---------------------------------------------
// --- 2. Добавление метаданных к существующему токену ---
// ---------------------------------------------
// ✅ Добавляем маршрут для добавления метаданных 
router.post("/add-metadata", handleAddTokenMetadata);


// ---------------------------------------------
// --- Баланс сервисного кошелька + токены ---
// ---------------------------------------------
// Добавлена явная типизация Request и Response
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const balanceData = await getServiceWalletBalance(); 
    res.json(balanceData);
  } catch (err) {
    // Корректный вывод ошибки и статуса
    const errorMessage = err instanceof Error ? err.message : "Ошибка сервера при получении баланса";
    console.error("❌ Ошибка при получении баланса:", errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
