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


import { createToken as createTokenStep } from "./token-creation.service.js";
import { addMetadataToToken as addMetadataStep } from "./metadata-addition.service.js"; 
import { createUmi } from '@metaplex-foundation/umi'; // Базовый Umi
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; 

// ✅ Оставляем require(), так как чистый import не работает
const web3jsAdapters = require('@metaplex-foundation/umi-web3js-adapters');


// --- Инициализация Solana и Umi ---

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

let serviceWallet;
let umiInstance; // Umi ИНСТАНЦИЯ

/**
 * Централизованная функция инициализации Umi (чтобы не парсить ключ 3 раза).
 * @returns {Umi.Umi | undefined} Инстанция Umi
 */
function initializeUmi() {
    if (umiInstance) return umiInstance;
    
    try {
        const secretKeyString = process.env.SERVICE_SECRET_KEY;
        if (!secretKeyString) {
            throw new Error("Переменная окружения SERVICE_SECRET_KEY не найдена.");
        }

        const secretKey = JSON.parse(secretKeyString);
        serviceWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        
        // --- Инициализация Umi ---
        umiInstance = createUmi('https://api.devnet.solana.com');  
        
        // 💥 ФИНАЛЬНЫЙ ФИКС: Логика для надежного вызова функции-плагина:
        let web3JsPlugin;
        
        // 1. Пытаемся получить функцию из .web3Js
        if (typeof web3jsAdapters.web3Js === 'function') {
            web3JsPlugin = web3jsAdapters.web3Js;
        // 2. Если не функция, ищем в .default (стандарт CommonJS)
        } else if (web3jsAdapters.default && typeof web3jsAdapters.default.web3Js === 'function') {
            web3JsPlugin = web3jsAdapters.default.web3Js;
        } else {
            // Если найти функцию не удалось, используем сам объект (последняя надежда)
            web3JsPlugin = web3jsAdapters.web3Js; 
        }

        // Вызываем найденную функцию, если это функция, иначе передаем объект
        umiInstance.use(typeof web3JsPlugin === 'function' ? web3JsPlugin() : web3JsPlugin);
        
        umiInstance.use(mplTokenMetadata()); // <-- Это функция, вызываем ее
        umiInstance.use(Umi.keypairIdentity(serviceWallet)); 
        // -------------------------

        console.log("✅ Сервисный кошелёк (Solana Service) загружен:", serviceWallet.publicKey.toBase58());
        return umiInstance;
    } catch (err) {
        console.error(`❌ Solana Service: Не удалось загрузить сервисный кошелек/Umi. Причина: ${err.message}`);
        return undefined;
    }
}

// Вызываем инициализацию сразу
initializeUmi();


// --- Функции Блокчейна ---

/**
 * Создает и минтит новый токен с метаданными в 2 этапа.
 */
async function createNewToken({ name, symbol, uri, decimals, supply }) {
  const umi = initializeUmi();
  if (!umi) {
    throw new Error("Umi не инициализирован. Проверьте SERVICE_SECRET_KEY.");
  }
  if (!name || !symbol || !uri) {
    throw new Error("Необходимо указать name, symbol и uri для метаданных.");
  }
  
  let mintAddress = null;

  try {
      // ------------------------------------------------------------------
      // ШАГ 1: Создание токена и минтинг (используем импортированную функцию)
      // ------------------------------------------------------------------
      console.log("Начинаем ШАГ 1: Создание токена...");
      // 💥 ФИКСИМ ВЫЗОВ: Передаем { umi, decimals, supply }
      const tokenResult = await createTokenStep({ 
          umi, // <--- ЭТО САМОЕ ВАЖНОЕ: ПЕРЕДАЕМ ИНСТАНС UMI!
          decimals, 
          supply 
      }); 
      mintAddress = tokenResult.mint;
      console.log(`✅ ШАГ 1 успешен. Адрес Mint: ${mintAddress}`);
      
      // ------------------------------------------------------------------
      // ШАГ 2: Добавление метаданных
      // ------------------------------------------------------------------
      console.log("Начинаем ШАГ 2: Добавление метаданных...");
      await addMetadataStep({ umi, mintAddress, name, symbol, uri });
      console.log("✅ ШАГ 2 успешен. Метаданные добавлены.");

      return { mint: mintAddress }; 

  } catch (err) {
      console.error(`❌ ОШИБКА во время создания токена (Mint: ${mintAddress || 'N/A'}):`, err.message);
      // Перебрасываем ошибку для обработки в роуте
      throw new Error(`Ошибка на этапе создания токена. ${err.message}`); 
  }
}

/**
 * Получает баланс SOL и список токенов сервисного кошелька.
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
  createNewToken,
  getServiceWalletBalance,
  // Экспортируем функцию, а не переменную
  initializeUmi 
};