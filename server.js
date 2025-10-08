const express = require("express");
const cors = require("cors");
const fs = require("fs");
const {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL
} = require("@solana/web3.js");

const splToken = require("@solana/spl-token"); // <== все функции через splToken

const app = express();
const PORT = process.env.PORT || 3000;

// === Разрешаем все фронтенды ===
app.use(cors({ origin: "*" }));
app.use(express.json());

// === Сервисный кошелёк ===
let serviceWallet;
try {
  const secretKey = JSON.parse(fs.readFileSync("service_wallet.json"));
  serviceWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("✅ Сервисный кошелёк:", serviceWallet.publicKey.toBase58());
} catch (err) {
  console.error("❌ Нет service_wallet.json. Создай через node create_wallet.js");
  process.exit(1);
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
  if (!supply) return res.status(400).json({ error: "❗ Заполни supply" });

  try {
    // 1️⃣ Создаём mint
    const mint = await splToken.createMint(
      connection,
      serviceWallet,           // payer
      serviceWallet.publicKey, // mint authority
      null,                    // freeze authority
      parseInt(decimals || 9)  // decimals
    );

    // 2️⃣ Создаём token account для сервисного кошелька
    const tokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      serviceWallet,
      mint,
      serviceWallet.publicKey
    );

    // 3️⃣ Минтим токены
    await splToken.mintTo(
      connection,
      serviceWallet,
      mint,
      tokenAccount.address,
      serviceWallet.publicKey,
      parseFloat(supply) * 10 ** parseInt(decimals || 9)
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

// === Баланс сервисного кошелька + токены ===
app.get("/api/balance", async (req, res) => {
  try {
    const pubKey = serviceWallet.publicKey;
    const solBalanceLamports = await connection.getBalance(pubKey);
    const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
      programId: splToken.TOKEN_PROGRAM_ID
    });

    const tokens = tokenAccounts.value.map(acc => {
      const info = acc.account.data.parsed.info;
      return { mint: info.mint, amount: info.tokenAmount.uiAmount };
    });

    res.json({ sol: solBalance, tokens });
  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// === Запуск сервера ===
app.listen(PORT, () => console.log(`🚀 Backend запущен на порту ${PORT}`));
