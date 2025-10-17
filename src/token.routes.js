// src/token.routes.js

import express from "express";
const router = express.Router();

// ❌ УДАЛЕНЫ импорты Umi и solana.service
// ✅ ИСПОЛЬЗУЕМ ТОЛЬКО НОВЫЕ НАТИВНЫЕ ФУНКЦИИ
import { createTokenAndMint } from "./token-creation.service.js"; // Переименовано для ясности
import { addTokenMetadata } from "./metadata-addition.service.js"; // Переименовано для ясности
import { getConnection, getServiceWalletBalance } from "./solana.service.js"; // ✅ Возвращаем функции для баланса и соединения

// ---------------------------------------------
// --- Проверка соединения ---
// ---------------------------------------------
router.get("/ping", async (req, res) => {
  try {
    // ✅ Используем нативное web3.js соединение
    const connection = getConnection();
    if (!connection) throw new Error("Solana connection failed.");
      
    const version = await connection.getVersion(); 
    res.json({ ok: true, solana: version });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.toString() });
  }
});

// ---------------------------------------------
// --- Создание токена с метаданными (2 ШАГА) ---
// ---------------------------------------------
router.post("/create-token", async (req, res) => {
  const { name, symbol, uri, decimals, supply } = req.body; 

  console.log("Req Body Received:", req.body);
  console.log("Destructured values:", { name, symbol, uri, decimals, supply });
  
  // ❌ УДАЛЕНА Инициализация Umi. Мы полагаемся на то, что Keypair загружается в сервисах.
  
  if (!supply || !name || !symbol || !uri || !decimals) { 
    return res.status(400).json({ error: "❗ Необходимы supply, name, symbol, uri и decimals для создания токена" });
  }

  let mintAddress = null;

  try {
    // ==========================================================
    // ШАГ 1: Создание токена и минтинг
    // ==========================================================
    console.log("Начинаем ШАГ 1: createTokenAndMint (создание Mint-аккаунта)");
    // ✅ Вызываем нативную функцию. Umi больше не нужен
    const mintPublicKey = await createTokenAndMint({ 
        decimals: Number(decimals), 
        supply: Number(supply) 
    });
    mintAddress = mintPublicKey.toBase58();
    
    // ==========================================================
    // ШАГ 2: Добавление метаданных
    // ==========================================================
    console.log("Начинаем ШАГ 2: addTokenMetadata (добавление метаданных)");
    // ✅ Вызываем нативную функцию. Umi больше не нужен
    const metadataPublicKey = await addTokenMetadata(
        mintPublicKey, // Передаем PublicKey
        name, 
        symbol, 
        uri 
    );
    
    // ==========================================================
    // УСПЕХ
    // ==========================================================
    console.log(`✅ Токен успешно создан. Mint: ${mintAddress}`);
    res.json({
      mint: mintAddress,
      metadata: metadataPublicKey.toBase58(),
      solscan: `https://solscan.io/token/${mintAddress}?cluster=devnet`
    });

  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err.toString());
    res.status(500).json({ 
        error: `Ошибка на Mint: ${mintAddress || 'N/A'}. Причина: ${err.message || "Ошибка сервера"}` 
    });
  }
});

// ---------------------------------------------
// --- Баланс сервисного кошелька + токены ---
// ---------------------------------------------
router.get("/balance", async (req, res) => {
  try {
    // ✅ Используем функцию, которая теперь должна быть нативной (в src/solana.service.js)
    const balanceData = await getServiceWalletBalance(); 
    res.json(balanceData);
  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err.toString());
    res.status(500).json({ error: err.message || "Ошибка сервера при получении баланса" });
  }
});

export default router;