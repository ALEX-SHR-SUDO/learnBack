// src/solana.service.js

const {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  PublicKey
} = require("@solana/web3.js");

const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID
} = require("@solana/spl-token"); 

// --- Инициализация Solana ---

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

let serviceWallet;
try {
  // ВНИМАНИЕ: Путь к файлу теперь должен быть относительным к КОРНЮ, 
  // или вы должны передать его из server.js
  const fs = require("fs"); 
  const path = require("path");
  
  // Предполагаем, что service_wallet.json находится в корне проекта
  const secretKeyPath = path.resolve(__dirname, '..', 'service_wallet.json'); 
  const secretKey = JSON.parse(fs.readFileSync(secretKeyPath));
  
  serviceWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log("✅ Сервисный кошелёк (Solana Service):", serviceWallet.publicKey.toBase58());
} catch (err) {
  console.error("❌ Solana Service: Не удалось загрузить service_wallet.json.");
}

// --- Функции Блокчейна ---

async function createNewToken({ decimals, supply }) {
  if (!serviceWallet) {
    throw new Error("Сервисный кошелек не загружен.");
  }

  const parsedDecimals = parseInt(decimals || 9);
  const parsedSupply = parseFloat(supply);
  const totalAmount = BigInt(Math.round(parsedSupply * Math.pow(10, parsedDecimals)));

  // 1️⃣ Создаём mint 
  const mint = await createMint(
    connection,
    serviceWallet,           // payer
    serviceWallet.publicKey, // mint authority
    null,                    // freeze authority
    parsedDecimals           // decimals
  );

  // 2️⃣ Создаём token account
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
    totalAmount
  );

  return { mint: mint.toBase58() };
}

async function getServiceWalletBalance() {
  if (!serviceWallet) {
    throw new Error("Сервисный кошелек не загружен.");
  }
  
  const pubKey = serviceWallet.publicKey;
  const solBalanceLamports = await connection.getBalance(pubKey);
  const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
    programId: TOKEN_PROGRAM_ID
  });

  const tokens = tokenAccounts.value
    .map(acc => ({
      mint: acc.account.data.parsed.info.mint,
      amount: acc.account.data.parsed.info.tokenAmount.uiAmount
    }))
    .filter(token => token.amount > 0);

  return {
    serviceAddress: pubKey.toBase58(),
    sol: solBalance,
    tokens
  };
}


// --- Экспорт ---

module.exports = {
  connection, // для пинга
  createNewToken,
  getServiceWalletBalance,
  serviceWallet // для отображения адреса при запуске
};