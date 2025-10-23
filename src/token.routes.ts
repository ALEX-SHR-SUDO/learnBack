// src/token.routes.ts

import express, { Request, Response } from "express"; // Импортируем типы для Express
const router = express.Router();

// ✅ ИМПОРТ ФУНКЦИЙ КОНТРОЛЛЕРА
import { 
    handleCreateTokenAndMetadata, 
    handleAddTokenMetadata 
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
// --- Проверка соединения ---
// ---------------------------------------------
router.get("/ping", async (req: Request, res: Response) => {
  try {
    const connection = getConnection();
    if (!connection) throw new Error("Solana connection failed.");
      
    const version = await connection.getVersion(); 
    res.json({ ok: true, solana: version });
  } catch (e) {
    // ✅ ИСПРАВЛЕНИЕ TS: Проверяем, является ли ошибка объектом Error, чтобы безопасно получить сообщение
    const errorMessage = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: errorMessage });
  }
});

// ---------------------------------------------
// --- 1. Создание токена с метаданными (ОБЪЕДИНЕННЫЙ ШАГ) ---
// ---------------------------------------------
router.post("/create-token", handleCreateTokenAndMetadata);

// ---------------------------------------------
// --- 2. Добавление метаданных к существующему токену ---
// ---------------------------------------------
router.post("/add-metadata", handleAddTokenMetadata);


// ---------------------------------------------
// --- Баланс сервисного кошелька + токены ---
// ---------------------------------------------
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const wallet = getServiceWallet(); // Получаем Keypair для публичного ключа
    
    // 1. Получаем SOL баланс (и pubKey)
    const balanceData = await getServiceWalletBalance(); 
    
    // 2. Получаем SPL токены
    const tokens = await getSplTokensForWallet(wallet.publicKey);
    
    // 3. Комбинируем и отправляем ответ
    res.json({
        ...balanceData, 
        // ✅ ДОБАВЛЕНО: Список токенов SPL
        splTokens: tokens 
    });
  } catch (err) {
    
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ Ошибка при получении баланса и токенов:", errorMessage);
    res.status(500).json({ error: errorMessage || "Ошибка сервера при получении баланса и токенов" });
  }
});

export default router;

