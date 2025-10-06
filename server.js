const express = require("express");
const cors = require("cors");
const fs = require("fs");
const {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  PublicKey,
} = require("@solana/web3.js");
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require("@solana/spl-token");

const {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID: TOKEN_METADATA_PROGRAM_ID,
} = require("@metaplex-foundation/mpl-token-metadata");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Разрешённые источники
const allowedOrigins = [
  "https://learn-front-c6vb0e3vv-alex-shr-sudos-projects.vercel.app",
  "http://localhost:3000"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json());


// === Загрузка сервисного кошелька ===
let serviceWallet;
try {
  const secretKey = JSON.parse(fs.readFileSync("service_wallet.json"));
  serviceWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("✅ Сервисный кошелёк:", serviceWallet.publicKey.toBase58());
} catch (err) {
  console.error("❌ Нет service_wallet.json, создай через node create_wallet.js");
  process.exit(1);
}

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// === Создание токена с метаданными ===
app.post("/chat", async (req, res) => {
  const { name, symbol, decimals, supply, description, logo } = req.body;

  if (!name || !symbol || !supply) {
    return res.json({ error: "❗ Заполни name, symbol и supply" });
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

    // 3️⃣ Выпуск токенов
    await mintTo(
      connection,
      serviceWallet,
      mint,
      tokenAccount.address,
      serviceWallet.publicKey,
      parseFloat(supply) * 10 ** parseInt(decimals || 9)
    );

    // 4️⃣ Создание метаданных токена
    const metadataPDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )[0];

    const metadataData = {
      name,
      symbol,
      uri: logo || "https://bafybeihfakeipfsurl/ipfs/meta.json", // можешь подставить IPFS URL
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    };

    const metadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mint,
        mintAuthority: serviceWallet.publicKey,
        payer: serviceWallet.publicKey,
        updateAuthority: serviceWallet.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: metadataData,
          isMutable: true,
          collectionDetails: null,
        },
      }
    );

    const transaction = new (require("@solana/web3.js").Transaction)().add(
      metadataInstruction
    );

    await require("@solana/web3.js").sendAndConfirmTransaction(
      connection,
      transaction,
      [serviceWallet]
    );

    const solscanUrl = `https://solscan.io/token/${mint.toBase58()}?cluster=devnet`;

    res.json({
      message: "✅ Токен создан с метаданными!",
      mint: mint.toBase58(),
      metadata: metadataData,
      link: solscanUrl,
    });
  } catch (err) {
    console.error("Ошибка при создании токена:", err);
    res.status(500).json({ error: "Ошибка при создании токена" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

