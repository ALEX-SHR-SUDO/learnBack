// src/solana.service.js

import {
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID
} from "@solana/spl-token"; 

import { initializeUmi } from "./umi-initializer.js";
import { loadServiceWallet } from "./service-wallet.js"; // Нужен для получения адреса кошелька


// --- Инициализация Solana и Umi ---

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// ❌ УДАЛЕН: const umi = initializeUmi();
let serviceWallet = loadServiceWallet(); // Загружаем только кошелек при старте

// --- Функции Блокчейна ---

/**
 * Получает баланс SOL и список токенов сервисного кошелька.
 */
async function getServiceWalletBalance() { // ✅ ВСЕГДА БЫЛА ASYNC
  // ✅ ИСПОЛЬЗУЕМ await
  const umi = await initializeUmi(); 
  
  if (!umi || !serviceWallet) {
    throw new Error("Сервисный кошелек или Umi не загружены.");
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
export {
  connection,
  getServiceWalletBalance,
  initializeUmi // Экспортируем функцию из инициализатора
};