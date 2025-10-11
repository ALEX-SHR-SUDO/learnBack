// src/solana.service.js

import {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID
} from "@solana/spl-token"; 

import * as metadataService from "./metadata.service.js"; // Импортируем с .js

// --- Инициализация Solana ---

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

let serviceWallet;
let umiPayer; // Umi Keypair для сервиса метаданных

try {
  // 1. Получаем секретный ключ из переменной окружения (Render)
  const secretKeyString = process.env.SERVICE_SECRET_KEY;

  if (!secretKeyString) {
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
// Используем export вместо module.exports
export {
  connection,
  createNewToken,
  getServiceWalletBalance,
  serviceWallet
};