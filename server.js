const express = require("express");
const cors = require("cors");
const fs = require("fs");
const {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  PublicKey // Добавим PublicKey, чтобы его можно было использовать
} = require("@solana/web3.js");

// 🚨 ИСПРАВЛЕНИЕ ОШИБКИ: Импортируем весь объект spl-token
const splToken = require("@solana/spl-token");
const {
  TOKEN_PROGRAM_ID
} = splToken; // TOKEN_PROGRAM_ID можно безопасно деструктурировать

const app = express();
// На Render PORT всегда устанавливается окружением
const PORT = process.env.PORT || 3000; 

// === Разрешаем все фронтенды ===
app.use(cors({ origin: "*" }));
app.use(express.json());

// === Сервисный кошелёк ===
let serviceWallet;
try {
  // ВНИМАНИЕ: Для Render убедитесь, что service_wallet.json доступен
  // (обычно через гит или через переменную окружения Base64, если это production)
  const secretKey = JSON.parse(fs.readFileSync("service_wallet.json"));
  serviceWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("✅ Сервисный кошелёк:", serviceWallet.publicKey.toBase58());
} catch (err) {
  console.error("❌ Нет service_wallet.json. Создай через node create_wallet.js или проверь доступность файла на Render.");
  // На Render лучше не завершать процесс, а логгировать ошибку
  // process.exit(1); 
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
    const totalAmount = parsedSupply * Math.pow(10, parsedDecimals);

    // 1️⃣ Создаём mint (Используем splToken.createMint)
    const mint = await splToken.createMint(
      connection,
      serviceWallet,           // payer
      serviceWallet.publicKey, // mint authority
      null,                    // freeze authority
      parsedDecimals           // decimals
    );

    // 2️⃣ Создаём token account для сервисного кошелька (Используем splToken.getOrCreateAssociatedTokenAccount)
    const tokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      serviceWallet,
      mint,
      serviceWallet.publicKey
    );

    // 3️⃣ Минтим токены (Используем splToken.mintTo)
    await splToken.mintTo(
      connection,
      serviceWallet,
      mint,
      tokenAccount.address,
      serviceWallet.publicKey,
      totalAmount
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

    // Извлекаем только те аккаунты, у которых есть UI amount > 0
    const tokens = tokenAccounts.value
      .map(acc => {
        const info = acc.account.data.parsed.info;
        return { 
          mint: info.mint, 
          amount: info.tokenAmount.uiAmount 
        };
      })
      .filter(token => token.amount > 0); // Фильтруем пустые токены

    res.json({ 
      serviceAddress: pubKey.toBase58(), // Добавим адрес, чтобы фронтенд его отобразил
      sol: solBalance, 
      tokens 
    });
  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// === Запуск сервера ===
app.listen(PORT, () => console.log(`🚀 Backend запущен на порту ${PORT}`));
