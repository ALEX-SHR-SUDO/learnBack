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

const {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID: TOKEN_METADATA_PROGRAM_ID
} = require("@metaplex-foundation/mpl-token-metadata");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
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

// === Подключение к devnet ===
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// === Пинг backend ===
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
    // 🔹 Создаём mint
    const mintKeypair = Keypair.generate();
    const lamportsForMint = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    // Создаём аккаунт mint
    const createMintTx = new Transaction().add(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        parseInt(decimals || 9),
        serviceWallet.publicKey,
        null,
        TOKEN_PROGRAM_ID
      )
    );

    // Создаём Associated Token Account для сервисного кошелька
    const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      serviceWallet,
      mintKeypair.publicKey,
      serviceWallet.publicKey
    );

    // Минтим токены на сервисный кошелёк
    const mintToIx = createMintToInstruction(
      mintKeypair.publicKey,
      associatedTokenAccount.address,
      serviceWallet.publicKey,
      parseFloat(supply) * 10 ** parseInt(decimals || 9)
    );

    createMintTx.add(mintToIx);

    await sendAndConfirmTransaction(connection, createMintTx, [serviceWallet, mintKeypair]);

    // 🔹 Создаём метаданные
    const metadataPDA = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    )[0];

    const metadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mintKeypair.publicKey,
        mintAuthority: serviceWallet.publicKey,
        payer: serviceWallet.publicKey,
        updateAuthority: serviceWallet.publicKey
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name,
            symbol,
            uri: "https://example.com/meta.json",
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

    const txMeta = new Transaction().add(metadataInstruction);
    await sendAndConfirmTransaction(connection, txMeta, [serviceWallet]);

    res.json({
      message: "✅ Токен успешно создан!",
      mint: mintKeypair.publicKey.toBase58(),
      solscan: `https://solscan.io/token/${mintKeypair.publicKey.toBase58()}?cluster=devnet`
    });

  } catch (err) {
    console.error("❌ Ошибка при создании токена:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// === Баланс и токены кошелька ===
app.get("/api/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const publicKey = new PublicKey(address);

    const solBalanceLamports = await connection.getBalance(publicKey);
    const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: TOKEN_PROGRAM_ID
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

app.listen(PORT, () => console.log(`🚀 Backend запущен на порту ${PORT}`));
