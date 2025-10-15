// src/token.routes.js

import express from "express";
const router = express.Router();
import { initializeUmi, getServiceWalletBalance } from "./solana.service.js"; 
import { createToken } from "./token-creation.service.js";
import { addMetadataToToken } from "./metadata-addition.service.js";


// --- Проверка соединения ---
router.get("/ping", async (req, res) => {
  try {
    // Используем Umi для проверки RPC
    const umi = initializeUmi();
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
  

  if (!supply || !name || !symbol || !uri) { 
    return res.status(400).json({ error: "❗ Необходимы supply, name, symbol и uri для создания токена" });
  }

  let mintAddress = null; // Будет хранить адрес, если Шаг 1 пройдет

  try {
    // Umi будет инициализирован внутри сервисных функций
    
    // ==========================================================
    // ШАГ 1: Создание токена и минтинг
    // ==========================================================
    console.log("Начинаем ШАГ 1: createToken (создание Mint-аккаунта)");
    const tokenResult = await createToken({ decimals, supply });
    mintAddress = tokenResult.mint; // Получаем адрес Mint
    
    // ==========================================================
    // ШАГ 2: Добавление метаданных
    // ==========================================================
    console.log("Начинаем ШАГ 2: addMetadataToToken (добавление метаданных)");
    await addMetadataToToken({ 
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
    // Если ошибка произошла на Шаге 1, `mintAddress` будет null.
    // Если ошибка произошла на Шаге 2, `mintAddress` будет адресом токена, который не получил метаданные.
    res.status(500).json({ 
        error: `Ошибка на Mint: ${mintAddress || 'N/A'}. Причина: ${err.message || "Ошибка сервера"}` 
    });
  }
});

// --- Баланс сервисного кошелька + токены ---
router.get("/balance", async (req, res) => {
  try {
    // Используем новую функцию getServiceWalletBalance
    const balanceData = await getServiceWalletBalance();
    res.json(balanceData);
  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err.toString());
    res.status(500).json({ error: err.message || "Ошибка сервера при получении баланса" });
  }
});

export default router;