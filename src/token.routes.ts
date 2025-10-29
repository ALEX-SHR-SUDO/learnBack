// src/token.routes.ts

import express, { Request, Response } from "express";
const router = express.Router();

// ✅ ИМПОРТ ФУНКЦИЙ КОНТРОЛЛЕРА
import { 
    handleCreateTokenAndMetadata
    // handleAddTokenMetadata // <-- Удалить! Такой функции больше нет
} from "./metadata-addition.controller.js"; 

// Импорт сервисов для вспомогательных функций (balance, ping)
import { 
    getConnection, 
    getServiceWalletBalance, 
    getServiceWallet 
} from "./solana.service.js"; 

// ✅ НОВЫЙ ИМПОРТ: Функция для получения списка SPL-токенов
import { getSplTokensForWallet } from "./token-account.service.js"; 

// ---------------------------------------------
// --- Вспомогательная функция для получения баланса и токенов ---
/**
 * Получает баланс сервисного кошелька и список SPL-токенов.
 * @returns {Promise<{serviceAddress: string, sol: number, splTokens: TokenInfo[]}>} 
 *          Объект с адресом кошелька, балансом SOL и массивом SPL-токенов
 * @throws {Error} Если не удается получить баланс или список токенов
 */
async function getWalletBalanceWithTokens() {
    const wallet = getServiceWallet();
    const balanceData = await getServiceWalletBalance(); 
    const tokens = await getSplTokensForWallet(wallet.publicKey);
    return {
        ...balanceData, 
        splTokens: tokens 
    };
}

// ---------------------------------------------
// --- Проверка соединения ---
router.get("/ping", async (req: Request, res: Response) => {
  try {
    const connection = getConnection();
    if (!connection) throw new Error("Solana connection failed.");
      
    const version = await connection.getVersion(); 
    res.json({ ok: true, solana: version });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: errorMessage });
  }
});

// ---------------------------------------------
// --- 1. Создание токена с метаданными (ОБЪЕДИНЕННЫЙ ШАГ) ---
router.post("/create-token", handleCreateTokenAndMetadata);

// ---------------------------------------------
// --- 2. Добавление метаданных к существующему токену ---
// УДАЛЯЕМ этот маршрут, т.к. функции нет!
// router.post("/add-metadata", handleAddTokenMetadata);

// ---------------------------------------------
// --- Баланс сервисного кошелька + токены ---
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const result = await getWalletBalanceWithTokens();
    res.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ Ошибка при получении баланса и токенов:", errorMessage);
    res.status(500).json({ error: errorMessage || "Ошибка сервера при получении баланса и токенов" });
  }
});

// ---------------------------------------------
// --- Баланс кошелька (альтернативный эндпоинт) ---
router.get("/wallet-balance", async (req: Request, res: Response) => {
  try {
    const result = await getWalletBalanceWithTokens();
    res.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ Ошибка при получении баланса кошелька:", errorMessage);
    res.status(500).json({ error: errorMessage || "Ошибка сервера при получении баланса кошелька" });
  }
});

export default router;
