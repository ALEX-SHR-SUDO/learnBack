import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const bs58 = require("bs58");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Загружаем сервисный кошелёк из .env
const secretKey = bs58.decode(process.env.SERVICE_WALLET_PRIVATE_KEY);
const serviceWallet = Keypair.fromSecretKey(secretKey);

// 🔗 Подключаемся к сети
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

console.log(`✅ Сервисный кошелёк: ${serviceWallet.publicKey.toBase58()}`);

// ===============================
// 📌 1. Создание нового токена
// ===============================
app.post("/api/create-token", async (req, res) => {
  try {
    const { name, symbol, decimals, amount } = req.body;

    // Создаём новый аккаунт для токена
    const mint = Keypair.generate();

    const rentExemptionLamports = await connection.getMinimumBalanceForRentExemption(splToken.MINT_SIZE);

    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: serviceWallet.publicKey,
      newAccountPubkey: mint.publicKey,
      space: splToken.MINT_SIZE,
      lamports: rentExemptionLamports,
      programId: splToken.TOKEN_PROGRAM_ID
    });

    const initializeMintIx = splToken.createInitializeMint2Instruction(
      mint.publicKey,
      decimals,
      serviceWallet.publicKey,
      serviceWallet.publicKey,
      splToken.TOKEN_PROGRAM_ID
    );

    const ata = await splToken.getAssociatedTokenAddress(
      mint.publicKey,
      serviceWallet.publicKey
    );

    const createAtaIx = splToken.createAssociatedTokenAccountInstruction(
      serviceWallet.publicKey,
      ata,
      serviceWallet.publicKey,
      mint.publicKey
    );

    const mintToIx = splToken.createMintToInstruction(
      mint.publicKey,
      ata,
      serviceWallet.publicKey,
      amount * Math.pow(10, decimals)
    );

    const tx = new Transaction().add(createAccountIx, initializeMintIx, createAtaIx, mintToIx);

    await sendAndConfirmTransaction(connection, tx, [serviceWallet, mint]);

    console.log(`✅ Токен создан: ${mint.publicKey.toBase58()}`);

    res.json({
      mint: mint.publicKey.toBase58(),
      name,
      symbol,
      decimals,
      amount
    });
  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 📌 2. Получение баланса
// ===============================
app.get("/api/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const publicKey = new PublicKey(address);

    const solLamports = await connection.getBalance(publicKey);
    const sol = solLamports / LAMPORTS_PER_SOL;

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: splToken.TOKEN_PROGRAM_ID
    });

    const tokens = tokenAccounts.value.map(acc => {
      const info = acc.account.data.parsed.info;
      return {
        mint: info.mint,
        amount: info.tokenAmount.uiAmount
      };
    });

    res.json({ sol, tokens });
  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 📌 3. Проверка работы сервера
// ===============================
app.get("/", (req, res) => {
  res.send("✅ Solana Backend работает!");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
