// src/token.routes.js

import express from "express";
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

// ---------------------------------------------
// --- Проверка соединения ---
// ---------------------------------------------
router.get("/ping", async (req, res) => {
  try {
    const connection = getConnection();
    if (!connection) throw new Error("Solana connection failed.");
      
    const version = await connection.getVersion(); 
    res.json({ ok: true, solana: version });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.toString() });
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
router.get("/balance", async (req, res) => {
  try {
    const balanceData = await getServiceWalletBalance(); 
    res.json(balanceData);
  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err.toString());
    res.status(500).json({ error: err.message || "Ошибка сервера при получении баланса" });
  }
});

export default router;
