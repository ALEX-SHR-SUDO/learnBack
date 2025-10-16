// src/token.routes.js

import express from "express";
const router = express.Router();
import { initializeUmi, getServiceWalletBalance } from "./solana.service.js"; 
import { createToken } from "./token-creation.service.js";
import { addMetadataToToken } from "./metadata-addition.service.js";


// --- Проверка соединения ---
router.get("/ping", async (req, res) => {
  try {
    const umi = initializeUmi();
    if (!umi) throw new Error("Umi is not initialized.");
      
    const version = await umi.rpc.getVersion(); 
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
  
  // ✅ Инициализация Umi здесь
  const umi = initializeUmi();
  if (!umi) {
      return res.status(500).json({ error: "❌ Umi не инициализирован. Проверьте SERVICE_SECRET_KEY." });
  }

  if (!supply || !name || !symbol || !uri || !decimals) { 
    return res.status(400).json({ error: "❗ Необходимы supply, name, symbol, uri и decimals для создания токена" });
  }

  let mintAddress = null;

  try {
    // ==========================================================
    // ШАГ 1: Создание токена и минтинг
    // ==========================================================
    console.log("Начинаем ШАГ 1: createToken (создание Mint-аккаунта)");
    const tokenResult = await createToken({ 
        umi, // ✅ ПЕРЕДАЕМ UMI
        decimals: Number(decimals), 
        supply: Number(supply) 
    });
    mintAddress = tokenResult.mint;
    
    // ==========================================================
    // ШАГ 2: Добавление метаданных
    // ==========================================================
    console.log("Начинаем ШАГ 2: addMetadataToToken (добавление метаданных)");
    await addMetadataToToken({ 
        umi, // ✅ ПЕРЕДАЕМ UMI
        mintAddress, 
        name, 
        symbol, 
        uri 
    });
    
    // ==========================================================
    // УСПЕХ
    // ==========================================================
    console.log(`✅ Токен успешно создан. Mint: ${mintAddress}`);
    res.json({
      mint: mintAddress,
      solscan: `https://solscan.io/token/${mintAddress}?cluster=devnet`
    });

  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err.toString());
    res.status(500).json({ 
        error: `Ошибка на Mint: ${mintAddress || 'N/A'}. Причина: ${err.message || "Ошибка сервера"}` 
    });
  }
});

// --- Баланс сервисного кошелька + токены ---
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