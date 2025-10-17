// src/token.routes.js

import express from "express";
const router = express.Router();

// Удаляем старые раздельные сервисы. Импортируем новый объединенный сервис.
import { createTokenAndMetadata } from "./metadata-addition.service.js"; 
// Добавляем импорт getServiceWallet для получения кошелька-плательщика
import { getConnection, getServiceWalletBalance, getServiceWallet } from "./solana.service.js"; 

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
// --- Создание токена с метаданными (ОБЪЕДИНЕННЫЙ ШАГ) ---
// ---------------------------------------------
router.post("/create-token", async (req, res) => {
  const { name, symbol, uri, decimals, supply } = req.body; 

  console.log("Req Body Received:", req.body);
  console.log("Destructured values:", { name, symbol, uri, decimals, supply });
  
  if (!supply || !name || !symbol || !uri || !decimals) { 
    return res.status(400).json({ error: "❗ Необходимы supply, name, symbol, uri и decimals для создания токена" });
  }

  let mintAddress = null;

  try {
    const connection = getConnection();
    // Получаем кошелек-плательщик, который будет Mint Authority
    const payer = getServiceWallet(); 

    // ==========================================================
    // ШАГ 1-4: Создание токена, минтинг и добавление метаданных (ОДИН ВЫЗОВ)
    // ==========================================================
    console.log("Начинаем ШАГ 1-4: createTokenAndMetadata (полный процесс)");
    
    // Вызываем единственную, объединенную функцию
    const results = await createTokenAndMetadata(
        connection, 
        payer,
        name, 
        symbol, 
        uri, 
        supply,
        decimals
    );
    
    mintAddress = results.mint;
    
    // ==========================================================
    // УСПЕХ
    // ==========================================================
    console.log(`✅ Токен успешно создан. Mint: ${mintAddress}`);
    res.json({
      mint: mintAddress,
      associatedTokenAccount: results.ata,
      metadataTransaction: results.metadataTx,
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
    const balanceData = await getServiceWalletBalance(); 
    res.json(balanceData);
  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err.toString());
    res.status(500).json({ error: err.message || "Ошибка сервера при получении баланса" });
  }
});

export default router;
