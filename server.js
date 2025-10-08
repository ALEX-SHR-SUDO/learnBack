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
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Создание токена (без метаданных)
app.post("/api/create-token", async (req, res) => {
  const { decimals, supply } = req.body;
  if (!supply) return res.status(400).json({ error: "❗ Заполни supply" });

  try {
    const mintKeypair = Keypair.generate();

    // Создаем mint
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const tx = new Transaction().add(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        parseInt(decimals || 9),
        serviceWallet.publicKey,
        null,
        TOKEN_PROGRAM_ID
      )
    );

    // Создаем Associated Token Account
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      serviceWallet,
      mintKeypair.publicKey,
      serviceWallet.publicKey
    );

    // Минтим токены
    tx.add(
      createMintToInstruction(
        mintKeypair.publicKey,
        tokenAccount.address,
        serviceWallet.publicKey,
        parseFloat(supply) * 10 ** parseInt(decimals || 9)
      )
    );

    await sendAndConfirmTransaction(connection, tx, [serviceWallet, mintKeypair]);

    res.json({
      mint: mintKeypair.publicKey.toBase58(),
      solscan: `https://solscan.io/token/${mintKeypair.publicKey.toBase58()}?cluster=devnet`
    });
  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// Баланс сервисного кошелька
app.get("/api/balance", async (req, res) => {
  try {
    const pubKey = serviceWallet.publicKey;
    const solBalanceLamports = await connection.getBalance(pubKey);
    const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
      programId: TOKEN_PROGRAM_ID
    });

    const tokens = tokenAccounts.value.map(acc => {
      const info = acc.account.data.parsed.info;
      return { mint: info.mint, amount: info.tokenAmount.uiAmount };
    });

    res.json({ sol: solBalance, tokens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
});

app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
