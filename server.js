const express = require("express");
const cors = require("cors");
const fs = require("fs");
const {
  Connection,
  Keypair,
  clusterApiUrl,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} = require("@solana/web3.js");

const {
  MINT_SIZE,
  createInitializeMintInstruction,
  getOrCreateAssociatedTokenAccount,
  createMintToInstruction,
  TOKEN_PROGRAM_ID
} = require("@solana/spl-token");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" })); // разрешаем все фронты
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

// Подключение к devnet
const { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } = require("@solana/spl-token");

// Создание токена (без метаданных)
app.post("/api/create-token", async (req, res) => {
  const { decimals, supply } = req.body;
  if (!supply) return res.status(400).json({ error: "❗ Заполни supply" });

  try {
    // 1️⃣ Создаём mint
    const mint = await createMint(
      connection,
      serviceWallet,           // payer
      serviceWallet.publicKey, // mint authority
      null,                    // freeze authority
      parseInt(decimals || 9)  // decimals
    );

    // 2️⃣ Создаём token account для сервисного кошелька
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      serviceWallet,
      mint,
      serviceWallet.publicKey
    );

    // 3️⃣ Минтим токены
    await mintTo(
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
