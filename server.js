const express = require("express");
const cors = require("cors");
const fs = require("fs");

const {
  Connection,
  Keypair,
  clusterApiUrl,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction
} = require("@solana/web3.js");

const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo
} = require("@solana/spl-token");

const {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID: TOKEN_METADATA_PROGRAM_ID
} = require("@metaplex-foundation/mpl-token-metadata");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// === Настройка CORS ===
const allowedOrigins = [
  "https://learn-front-c6vb0e3vv-alex-shr-sudos-projects.vercel.app",
  "http://localhost:3000"
];

app.use(cors({
  origin: true
}));


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

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// === Эндпоинт создания токена без логотипа ===
app.post("/chat", async (req, res) => {
  const { name, symbol, decimals, supply, description } = req.body;

  if (!name || !symbol || !supply) {
    return res.status(400).json({ error: "❗ Заполни name, symbol и supply" });
  }

  try {
    // 1️⃣ Создание mint
    const mint = await createMint(
      connection,
      serviceWallet,
      serviceWallet.publicKey,
      null,
      parseInt(decimals || 9)
    );

    // 2️⃣ Создание токен-аккаунта
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      serviceWallet,
      mint,
      serviceWallet.publicKey
    );

    // 3️⃣ Минт токенов
    await mintTo(
      connection,
      serviceWallet,
      mint,
      tokenAccount.address,
      serviceWallet.publicKey,
      parseFloat(supply) * 10 ** parseInt(decimals || 9)
    );

    // 4️⃣ PDA метаданных
    const metadataPDA = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    )[0];

    const metadataUrl = "https://example.com/meta.json"; // можно заменить на свой JSON

    const metadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mint,
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

    const solscanUrl = `https://solscan.io/token/${mint.toBase58()}?cluster=devnet`;

    res.json({
      message: "✅ Токен успешно создан!",
      mint: mint.toBase58(),
      metadataUrl,
      solscan: solscanUrl
    });

  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err);
    res.status(500).json({ error: "Ошибка при создании токена", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
