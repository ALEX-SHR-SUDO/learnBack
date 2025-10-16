// src/solana.service.js

import {
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID
} from "@solana/spl-token"; 

// ✅ ИМПОРТ: Umi инициализатор
import { initializeUmi } from "./umi-initializer.js";
import { loadServiceWallet } from "./service-wallet.js"; // Нужен для получения адреса кошелька


// --- Инициализация Solana и Umi ---

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// ❌ УДАЛЕНА: let serviceWallet; 
// ❌ УДАЛЕНА: let umiInstance; 


// Вызываем инициализацию Umi сразу
const umi = initializeUmi();
let serviceWallet; // Переобъявим, чтобы использовать его публичный ключ в getServiceWalletBalance

if (umi) {
    // Получаем Keypair для использования в getServiceWalletBalance
    serviceWallet = loadServiceWallet(); 
}


// --- Функции Блокчейна ---

/**
 * Получает баланс SOL и список токенов сервисного кошелька.
 */
async function getServiceWalletBalance() {
  // ✅ Используем уже инициализированную инстанцию
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