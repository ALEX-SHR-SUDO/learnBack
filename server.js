const express = require("express");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
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
const { PinataSDK } = require("pinata-web3");

const app = express();
const PORT = process.env.PORT || 3000;

// === Multer ===
const upload = multer({ dest: "uploads/" });

// === Настройки CORS ===
const allowedOrigins = [
  "https://learn-front-ltcpdcp8c-alex-shr-sudos-projects.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      // Запрос без origin (Postman, curl)
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      // Разрешённые источники
      return callback(null, true);
    }
    console.warn(`❌ Блокирован origin: ${origin}`);
    // Отклоняем, но не выбрасываем ошибку
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Отлавливаем ошибки CORS, чтобы сервер не падал
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "❌ CORS ошибка: доступ запрещён для этого origin" });
  }
  next(err);
});

app.use(express.json());

// === Pinata ===
// PINATA_JWT и PINATA_GATEWAY_URL через env
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud",
});

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

// === Эндпоинт: создание токена ===
app.post("/chat", upload.single("logo"), async (req, res) => {
  const { name, symbol, decimals, supply, description } = req.body;
  const logoFile = req.file;

  if (!name || !symbol || !supply) {
    return res.status(400).json({ error: "❗ Заполни name, symbol и supply" });
  }

  try {
    // 1️⃣ Загрузка логотипа на IPFS
    let logoUrl = null;
    if (logoFile) {
      const file = fs.createReadStream(logoFile.path);
      const uploadLogo = await pinata.upload.file(file);
      logoUrl = `${pinata.config.pinataGateway}/ipfs/${uploadLogo.IpfsHash}`;
      fs.unlinkSync(logoFile.path);
    }

    // 2️⃣ JSON метаданных
    const metadata = {
      name,
      symbol,
      description: description || "Token created via ChatGPT Solana App",
      image: logoUrl,
      attributes: [{ trait_type: "Creator", value: "ChatGPT Solana App" }],
    };

    const uploadMeta = await pinata.upload.json(metadata);
    const metadataUrl = `${pinata.config.pinataGateway}/ipfs/${uploadMeta.IpfsHash}`;

    // 3️⃣ Создание mint
    const mint = await createMint(
      connection,
      serviceWallet,
      serviceWallet.publicKey,
      null,
      parseInt(decimals || 9)
    );

    // 4️⃣ Создание токен-аккаунта
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      serviceWallet,
      mint,
      serviceWallet.publicKey
    );

    // 5️⃣ Минт токенов
    await mintTo(
      connection,
      serviceWallet,
      mint,
      tokenAccount.address,
      serviceWallet.publicKey,
      parseFloat(supply) * 10 ** parseInt(decimals || 9)
    );

    // 6️⃣ PDA метаданных
    const metadataPDA = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    )[0];

    // 7️⃣ Инструкция метаданных
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
          data: {
            name,
            symbol,
            uri: metadataUrl,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
          },
          isMutable: true,
          collectionDetails: null,
        },
      }
    );

    const transaction = new Transaction().add(metadataInstruction);
    await sendAndConfirmTransaction(connection, transaction, [serviceWallet]);

    const solscanUrl = `https://solscan.io/token/${mint.toBase58()}?cluster=devnet`;

    res.json({
      message: "✅ Токен успешно создан и загружен в IPFS!",
      mint: mint.toBase58(),
      metadataUrl,
      logoUrl,
      solscan: solscanUrl,
    });
  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err);
    res.status(500).json({ error: "Ошибка при создании токена", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
