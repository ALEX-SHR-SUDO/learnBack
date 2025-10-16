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
// ❌ УДАЛИТЕ ЭТУ СТРОКУ, так как getServiceWalletBalance загружает кошелек или Umi.initializeUmi его загружает
// let serviceWallet = loadServiceWallet(); 


// --- Функции Блокчейна ---

/**
 * Получает баланс SOL и список токенов сервисного кошелька.
 */
async function getServiceWalletBalance() { 
  // ✅ ИСПОЛЬЗУЕМ await. Umi инициализирует и получает доступ к кошельку.
  const umi = await initializeUmi(); 
  
  // Кошелек должен быть доступен через umi.identity.keypair
  const serviceWallet = loadServiceWallet(); // Перезагружаем кошелек для доступа к его ключу
  
  if (!umi || !serviceWallet) { // Проверяем и umi, и кошелек (на всякий случай)
    throw new Error("Сервисный кошелек или Umi не загружены.");
  }
  
  const pubKey = serviceWallet.publicKey; // Используем публичный ключ
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