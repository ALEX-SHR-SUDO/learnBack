const express = require("express");
const cors = require("cors");
const fs = require("fs");
const {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require("@solana/spl-token");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// === Загружаем сервисный кошелёк ===
let serviceWallet;
try {
  const secretKey = JSON.parse(fs.readFileSync("service_wallet.json"));
  serviceWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("✅ Сервисный кошелёк загружен:", serviceWallet.publicKey.toBase58());
} catch (err) {
  console.error("❌ Ошибка: не найден service_wallet.json. Сначала создай кошелёк командой:");
  console.error("   node create_wallet.js");
  process.exit(1);
}

// === Подключаемся к Devnet ===
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// === 💬 CHAT endpoint ===
app.post("/chat", async (req, res) => {
  const { name, symbol, decimals, supply, description } = req.body;

  if (!name || !symbol || !decimals || !supply) {
    return res.json({
      message: "❗ Заполни все поля (name, symbol, decimals, supply, description)",
    });
  }

  try {
    // 1️⃣ Создаём токен
    const mint = await createMint(
      connection,
      serviceWallet,
      serviceWallet.publicKey,
      null,
      parseInt(decimals)
    );

    // 2️⃣ Создаём токен-аккаунт
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      serviceWallet,
      mint,
      serviceWallet.publicKey
    );

    // 3️⃣ Выпускаем токены
    await mintTo(
      connection,
      serviceWallet,
      mint,
      tokenAccount.address,
      serviceWallet.publicKey,
      parseFloat(supply) * 10 ** parseInt(decimals)
    );

    // 4️⃣ Формируем ссылку на Solscan
    const solscanUrl = `https://solscan.io/token/${mint.toBase58()}?cluster=devnet`;

    // 5️⃣ Формируем ответ
    const reply = {
      message: "✅ Токен успешно создан!",
      name: `Имя: ${name}`,
      symbol: `Символ: ${symbol}`,
      mint: `Mint адрес: ${mint.toBase58()}`,
      decimals: `Десятичные: ${decimals}`,
      supply: `Выпущено: ${supply}`,
      description: `Описание: ${description}`,
      link: `🔗 Ссылка: ${solscanUrl}`,
    };

    res.json(reply);
  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err);
    res.status(500).json({ error: "Ошибка при создании токена" });
  }
});


// === Проверка баланса ===
app.get("/balance", async (req, res) => {
  try {
    const balance = await connection.getBalance(serviceWallet.publicKey);
    res.json({
      wallet: serviceWallet.publicKey.toBase58(),
      balance: balance / LAMPORTS_PER_SOL,
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка при получении баланса" });
  }
});

// === Airdrop ===
app.get("/airdrop", async (req, res) => {
  try {
    const signature = await connection.requestAirdrop(
      serviceWallet.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
    const newBalance = await connection.getBalance(serviceWallet.publicKey);
    res.json({
      message: "✅ Airdrop успешен!",
      wallet: serviceWallet.publicKey.toBase58(),
      balance: newBalance / LAMPORTS_PER_SOL,
    });
  } catch (err) {
    console.error("Ошибка при airdrop:", err);
    res.status(500).json({ error: "Ошибка при airdrop" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
