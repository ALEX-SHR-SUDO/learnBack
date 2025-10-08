import express from "express";
import cors from "cors";
import fs from "fs";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";

import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint
} from "@solana/spl-token";

const app = express();
const PORT = process.env.PORT || 3000;

// === Разрешаем все фронтенды ===
app.use(cors({ origin: "*" }));
app.use(express.json());

// === Загружаем сервисный кошелёк ===
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
  } catch (err) {
    res.status(500).json({ ok: false, error: err.toString() });
  }
});

// === Создание токена SPL Token 2022 ===
app.post("/api/create-token", async (req, res) => {
  try {
    const { decimals = 2, supply = 1000 } = req.body;

    // 1️⃣ Создаём Keypair для mint
    const mint = Keypair.generate();

    // 2️⃣ Получаем минимальный баланс для rent-exempt
    const rentExemptionLamports = await getMinimumBalanceForRentExemptMint(connection);

    // 3️⃣ Создаём аккаунт под mint
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: serviceWallet.publicKey,
      newAccountPubkey: mint.publicKey,
      space: MINT_SIZE,
      lamports: rentExemptionLamports,
      programId: TOKEN_2022_PROGRAM_ID
    });

    // 4️⃣ Инициализация mint
    const initMintIx = createInitializeMint2Instruction(
      mint.publicKey,
      decimals,
      serviceWallet.publicKey, // mint authority
      serviceWallet.publicKey, // freeze authority
      TOKEN_2022_PROGRAM_ID
    );

    // 5️⃣ Отправка транзакции
    const tx = new Transaction().add(createAccountIx, initMintIx);
    await sendAndConfirmTransaction(connection, tx, [serviceWallet, mint]);

    res.json({
      mint: mint.publicKey.toBase58(),
      solscan: `https://solscan.io/token/${mint.publicKey.toBase58()}?cluster=devnet`
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
      programId: TOKEN_2022_PROGRAM_ID
    });

    const tokens = tokenAccounts.value.map(acc => {
      const info = acc.account.data.parsed.info;
      return {
        mint: info.mint,
        amount: info.tokenAmount.uiAmount
      };
    });

    res.json({ sol: solBalance, tokens });

  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// === Запуск сервера ===
app.listen(PORT, () => console.log(`🚀 Backend запущен на порту ${PORT}`));
