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

const splToken = require("@solana/spl-token");
const {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID: TOKEN_METADATA_PROGRAM_ID
} = require("@metaplex-foundation/mpl-token-metadata");

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

// === Подключаемся к devnet ===
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

// === Создание токена ===
app.post("/api/create-token", async (req, res) => {
  const { name, symbol, decimals, supply, description } = req.body;

  if (!name || !symbol || !supply) {
    return res.status(400).json({ error: "❗ Заполни name, symbol и supply" });
  }

  try {
    // 1️⃣ Создаём mint
    const mint = await splToken.createMint(
      connection,
      serviceWallet,
      serviceWallet.publicKey,
      null,
      parseInt(decimals || 9)
    );

    // 2️⃣ Создаём токен-аккаунт
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

    // 4️⃣ Создаём метаданные (без логотипа)
    const metadataPDA = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    )[0];

    const metadataUrl = "https://example.com/meta.json";

    const metadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint,
        mintAuthority: serviceWallet.publicKey,
        payer: serviceWallet.publicKey,
        updateAuthority: serviceWallet.publicKey
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name,
            symbol,
            uri: metadataUrl,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null
          },
          isMutable: true,
          collectionDetails: null
        }
      }
    );

    const transaction = new Transaction().add(metadataInstruction);
    await sendAndConfirmTransaction(connection, transaction, [serviceWallet]);

    res.json({
      message: "✅ Токен успешно создан!",
      mint: mint.toBase58(),
      metadataUrl,
      solscan: `https://solscan.io/token/${mint.toBase58()}?cluster=devnet`
    });

  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err);
    res.status(500).json({ error: "Ошибка при создании токена", details: err.toString() });
  }
});

// === Получение баланса кошелька ===
app.get("/api/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const publicKey = new PublicKey(address);

    const solBalanceLamports = await connection.getBalance(publicKey);
    const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;

    // Получаем токены
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

    res.json({
      sol: solBalance,
      tokens
    });
  } catch (err) {
    console.error("❌ Ошибка при получении баланса:", err);
    res.status(500).json({ error: "Ошибка при получении баланса", details: err.toString() });
  }
});

// === Запуск ===
app.listen(PORT, () => console.log(`🚀 Backend запущен на порту ${PORT}`));
