// src/token.routes.js

import express from "express";
const router = express.Router();
import * as solanaService from "./solana.service.js"; 

// --- Проверка соединения ---
router.get("/ping", async (req, res) => {
  try {
    const version = await solanaService.connection.getVersion();
    res.json({ ok: true, solana: version });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.toString() });
  }
});

// --- Создание токена с метаданными ---
router.post("/create-token", async (req, res) => {
  const { name, symbol, uri, decimals, supply } = req.body; 

  if (!supply || !name || !symbol || !uri) { 
    return res.status(400).json({ error: "❗ Необходимы supply, name, symbol и uri для создания токена" });
  }

  try {
    const result = await solanaService.createNewToken({ name, symbol, uri, decimals, supply });

    res.json({
      mint: result.mint,
      solscan: `https://solscan.io/token/${result.mint}?cluster=devnet`
    });

  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err.toString());
    res.status(500).json({ error: err.message || "Ошибка сервера при создании токена" });
  }
});

// --- Баланс сервисного кошелька + токены ---
router.get("/balance", async (req, res) => {
  try {
    const balanceData = await solanaService.getServiceWalletBalance();
    res.json(balanceData);
  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err.toString());
    res.status(500).json({ error: err.message || "Ошибка сервера при получении баланса" });
  }
});

export default router;