// src/solana.service.js

const {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  PublicKey
} = require("@solana/web3.js");

const {
  TOKEN_PROGRAM_ID
} = require("@solana/spl-token"); 

const metadataService = require("./metadata.service"); 
// Удаляем 'fs' и 'path', так как они больше не нужны для чтения файла
// const fs = require("fs"); 
// const path = require("path");

// --- Инициализация Solana ---

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

let serviceWallet;
let umiPayer; // Umi Keypair для сервиса метаданных

try {
  // 1. Получаем секретный ключ из переменной окружения (Render)
  const secretKeyString = process.env.SERVICE_SECRET_KEY;

  if (!secretKeyString) {
      // Это критическая ошибка, если ключ не установлен
      throw new Error("Переменная окружения SERVICE_SECRET_KEY не найдена.");
  }

  // 2. Парсим строку обратно в массив чисел (Uint8Array)
  const secretKey = JSON.parse(secretKeyString);
  
  // 3. Создаем Keypair
  serviceWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  // 4. Инициализируем Umi
  umiPayer = metadataService.initializeUmi(serviceWallet);

  console.log("✅ Сервисный кошелёк (Solana Service) загружен:", serviceWallet.publicKey.toBase58());
} catch (err) {
  console.error(`❌ Solana Service: Не удалось загрузить сервисный кошелек. Причина: ${err.message}`);
}


// --- Функции Блокчейна ---

/**
 * Создает и минтит новый токен с метаданными.
 */
async function createNewToken({ name, symbol, uri, decimals, supply }) {
  if (!serviceWallet) {
    throw new Error("Сервисный кошелек не загружен.");
  }
  if (!name || !symbol || !uri) {
    throw new Error("Необходимо указать name, symbol и uri для метаданных.");
  }

  // Вызываем функцию из отдельного сервиса метаданных
  const result = await metadataService.createTokenWithMetadata({
    umiPayer,
    name,
    symbol,
    uri,
    decimals,
    supply
  });

  return result; // { mint: string }
}

/**
 * Получает баланс SOL и список токенов сервисного кошелька.
 */
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

  // Извлекаем только те аккаунты, у которых есть UI amount > 0
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
  connection,
  createNewToken,
  getServiceWalletBalance,
  serviceWallet
};