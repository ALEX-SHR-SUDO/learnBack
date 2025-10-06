const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction
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

// === Разрешённые источники (CORS) ===
const allowedOrigins = [
  "https://learn-front-c6vb0e3vv-alex-shr-sudos-projects.vercel.app",
  "http://localhost:3000",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "10mb" }));

// === Загружаем сервисный кошелёк ===
let serviceWallet;
try {
  const secretKey = JSON.parse(fs.readFileSync("service_wallet.json"));
  serviceWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("✅ Сервисный кошелёк:", serviceWallet.publicKey.toBase58());
} catch (err) {
  console.error("❌ Нет service_wallet.json. Создай его командой: node create_wallet.js");
  process.exit(1);
}

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// === 💬 Эндпоинт для создания токена с метаданными и логотипом ===
app.post("/chat", async (req, res) => {
  const { name, symbol, decimals, supply, description, logo } = req.body;

  if (!name || !symbol || !supply || !logo) {
    return res.json({ error: "❗ Заполни все поля: name, symbol, supply, logo" });
  }

  try {
    // 1️⃣ Загрузка логотипа в IPFS через Pinata
    console.log("🚀 Загружаем логотип в IPFS...");
    const formData = new FormData();
    const buffer = Buffer.from(logo.split(",")[1], "base64");
    formData.append("file", buffer, `${symbol}.png`);

    const uploadImage = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
          ...formData.getHeaders(),
        },
      }
    );

    const imageUrl = `https://gateway.pinata.cloud/ipfs/${uploadImage.data.IpfsHash}`;
    console.log("✅ Логотип загружен:", imageUrl);

    // 2️⃣ Создание JSON метаданных
    const metadata = {
      name,
      symbol,
      description,
      image: imageUrl,
      attributes: [
        { trait_type: "Creator", value: "Solana Token Creator" },
        { trait_type: "Supply", value: supply },
        { trait_type: "Decimals", value: decimals || 9 },
      ],
    };

    const uploadMetadata = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      metadata,
      {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
          "Content-Type": "application/json",
        },
      }
    );

    const metadataUri = `https://gateway.pinata.cloud/ipfs/${uploadMetadata.data.IpfsHash}`;
    console.log("✅ Метаданные загружены:", metadataUri);

    // 3️⃣ Создание токена
    const mint = await createMint(
      connection,
      serviceWallet,
      serviceWallet.publicKey,
      null,
      parseInt(decimals || 9)
    );

    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      serviceWallet,
      mint,
      serviceWallet.publicKey
    );

    await mintTo(
      connection,
      serviceWallet,
      mint,
      tokenAccount.address,
      serviceWallet.publicKey,
      parseFloat(supply) * 10 ** parseInt(decimals || 9)
    );

    // 4️⃣ Добавление метаданных в Solana (Metaplex)
    const metadataPDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )[0];

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
            uri: metadataUri,
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

    const tx = new Transaction().add(metadataInstruction);
    await sendAndConfirmTransaction(connection, tx, [serviceWallet]);

    const solscanUrl = `https://solscan.io/token/${mint.toBase58()}?cluster=devnet`;

    res.json({
      message: "✅ Токен успешно создан с метаданными и логотипом!",
      mint: mint.toBase58(),
      image: imageUrl,
      metadata: metadataUri,
      link: solscanUrl,
    });
  } catch (err) {
    console.error("❌ Ошибка:", err.response?.data || err.message);
    res.status(500).json({ error: "Ошибка при создании токена или загрузке в IPFS" });
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
    const sig = await connection.requestAirdrop(serviceWallet.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
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
