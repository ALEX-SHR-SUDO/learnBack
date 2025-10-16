// src/solana.service.js

import {
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID
} from "@solana/spl-token"; 

// ✅ ИМПОРТ: загрузка кошелька
import { loadServiceWallet } from "./service-wallet.js"; 

import { createUmi, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 
import * as web3jsAdapters from '@metaplex-foundation/umi-web3js-adapters';


// --- Инициализация Solana и Umi ---

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

let serviceWallet;
let umiInstance; // Umi ИНСТАНЦИЯ

/**
 * Централизованная функция инициализации Umi.
 * @returns {Umi.Umi | undefined} Инстанция Umi
 */
function initializeUmi() {
    if (umiInstance) return umiInstance;
    
    try {
        serviceWallet = loadServiceWallet();
        if (!serviceWallet) {
            throw new Error("Сервисный кошелек не загружен. Проверьте SERVICE_SECRET_KEY.");
        }
        
        // --- Инициализация Umi ---
        umiInstance = createUmi('https://api.devnet.solana.com');  
        
        // 💥 ФИНАЛЬНЫЙ ФИКС АДАПТЕРА:
        const web3JsPlugin = web3jsAdapters.web3Js || web3jsAdapters.default?.web3Js;

        if (typeof web3JsPlugin === 'function') {
            umiInstance.use(web3JsPlugin()); 
        } else {
            umiInstance.use(web3jsAdapters.web3Js);
        }
        
        // ✅ ФИКС SIGNER IDENTITY (для решения проблемы eddsa)
        const serviceSigner = createSignerFromKeypair(umiInstance, serviceWallet);
        umiInstance.use(Umi.signerIdentity(serviceSigner)); 

        umiInstance.use(mplTokenMetadata());
        // -------------------------

        return umiInstance;
    } catch (err) {
        console.error(`❌ Solana Service: Не удалось инициализировать Umi. Причина: ${err.message}`);
        return undefined;
    }
}

// Вызываем инициализацию сразу
initializeUmi();


// --- Функции Блокчейна ---

/**
 * Получает баланс SOL и список токенов сервисного кошелька.
 * (Оставлено здесь, так как использует общие переменные)
 */
async function getServiceWalletBalance() {
  const umi = initializeUmi(); 
  if (!umi || !serviceWallet) {
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
export {
  connection,
  // ❌ УДАЛЕНА createNewToken
  getServiceWalletBalance,
  initializeUmi 
};