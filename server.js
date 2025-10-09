// server.js (В корне проекта)

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  PublicKey
} = require("@solana/web3.js");

// 🚨 ИСПРАВЛЕНИЕ: Импортируем функции действий из CJS-совместимого подмодуля
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");

const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID
} = require("@solana/spl-token");

const app = express();
const PORT = process.env.PORT || 3000;

// === Middlewares ===
app.use(cors({ origin: "*" }));
app.use(express.json());

// === Сервисный кошелёк ===
let serviceWallet;
try {
  const secretKey = JSON.parse(fs.readFileSync("service_wallet.json"));
  serviceWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("✅ Сервисный кошелёк:", serviceWallet.publicKey.toBase58());
} catch (err) {
  console.error("❌ Нет service_wallet.json. Проверьте доступность файла на Render.");
}

// === Подключение к devnet ===
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// === Проверка соединения ===
app.get("/api/ping", async (req, res) => {
  try {
    const version = await connection.getVersion();
    res.json({ ok: true, solana: version });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.toString() });
  }
});

// === Создание токена без метаданных ===
app.post("/api/create-token", async (req, res) => {
  const { decimals, supply } = req.body;
  
  if (!serviceWallet) {
    return res.status(500).json({ error: "❗ Сервисный кошелек не загружен." });
  }
  if (!supply) {
    return res.status(400).json({ error: "❗ Заполни supply" });
  }

  try {
    const parsedDecimals = parseInt(decimals || 9);
    const parsedSupply = parseFloat(supply);
    // Обработка возможной ошибки при больших числах
    const totalAmount = BigInt(Math.round(parsedSupply * Math.pow(10, parsedDecimals))); 

    // 1️⃣ Создаём mint 
    const mint = await createMint( // вызываем напрямую
      connection,
      serviceWallet,           // payer
      serviceWallet.publicKey, // mint authority
      null,                    // freeze authority
      parsedDecimals           // decimals
    );

    // 2️⃣ Создаём token account
    const tokenAccount = await getOrCreateAssociatedTokenAccount( // вызываем напрямую
      connection,
      serviceWallet,
      mint,
      serviceWallet.publicKey
    );

    // 3️⃣ Минтим токены
    await mintTo( // вызываем напрямую
      connection,
      serviceWallet,
      mint,
      tokenAccount.address,
      serviceWallet.publicKey,
      totalAmount // используем BigInt для точности
    );

    res.json({
      mint: mint.toBase58(),
      solscan: `https://solscan.io/token/${mint.toBase58()}?cluster=devnet`
    });

  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// === Баланс сервисного кошелька + токены (Эндпоинт /api/balance) ===
app.get("/api/balance", async (req, res) => {
  if (!serviceWallet) {
    return res.status(500).json({ error: "❗ Сервисный кошелек не загружен." });
  }
  
  try {
    const pubKey = serviceWallet.publicKey;
    const solBalanceLamports = await connection.getBalance(pubKey);
    const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
      programId: TOKEN_PROGRAM_ID
    });

    const tokens = tokenAccounts.value
      .map(acc => {
        const info = acc.account.data.parsed.info;
        return { 
          mint: info.mint, 
          amount: info.tokenAmount.uiAmount 
        };
      })
      .filter(token => token.amount > 0); 

    res.json({ 
      serviceAddress: pubKey.toBase58(), 
      sol: solBalance, 
      tokens 
    });
  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// === Запуск сервера ===
app.listen(PORT, () => {
    // Адрес кошелька уже должен быть выведен из solana.service.js
    console.log(`🚀 Backend запущен на порту ${PORT}`);
});