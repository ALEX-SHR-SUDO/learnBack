const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL } = require("@solana/web3.js");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Настройка CORS — разрешаем фронт с Vercel
app.use(cors({
  origin: [
    "https://learn-front-c6vb0e3vv-alex-shr-sudos-projects.vercel.app", // твой фронтенд
    "http://localhost:3000" // для локальной разработки
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// ✅ Загружаем сервисный кошелёк
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

// ✅ Подключаемся к Devnet
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// 💬 Эндпоинт чата
app.post("/chat", (req, res) => {
  const { name, symbol, decimals, supply, description } = req.body;

  const reply = {
    name: name ? `Имя токена принято: ${name}` : "Нет имени",
    symbol: symbol ? `Символ принят: ${symbol}` : "Нет символа",
    decimals: decimals ? `Десятичные: ${decimals}` : "Не указано",
    supply: supply ? `Эмиссия: ${supply}` : "Не указано",
    description: description ? `Описание принято: ${description}` : "Нет описания",
    wallet: `Платёжный адрес: ${serviceWallet.publicKey.toBase58()}`
  };

  res.json(reply);
});

// 🔹 Проверка баланса
app.get("/balance", async (req, res) => {
  try {
    const balance = await connection.getBalance(serviceWallet.publicKey);
    res.json({
      wallet: serviceWallet.publicKey.toBase58(),
      balance: balance / LAMPORTS_PER_SOL
    });
  } catch (err) {
    console.error("Ошибка при получении баланса:", err);
    res.status(500).json({ error: "Ошибка при получении баланса" });
  }
});

// 🔹 Airdrop (получить 1 SOL)
app.get("/airdrop", async (req, res) => {
  try {
    const signature = await connection.requestAirdrop(serviceWallet.publicKey, 1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature, "confirmed");
    const newBalance = await connection.getBalance(serviceWallet.publicKey);

    res.json({
      message: "✅ Airdrop успешен!",
      wallet: serviceWallet.publicKey.toBase58(),
      balance: newBalance / LAMPORTS_PER_SOL
    });
  } catch (err) {
    console.error("Ошибка при airdrop:", err);
    res.status(500).json({ error: "❌ Ошибка при выполнении airdrop" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
