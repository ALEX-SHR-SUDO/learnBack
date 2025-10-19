// src/metadata-addition.service.js

import { 
    Connection, 
    Keypair, 
    PublicKey, 
} from '@solana/web3.js';
// Удаляем import * as splToken
// Удаляем импорт системных программ, так как они встроены в SDK
import { toBigInt } from './utils.js'; // Предполагается, что этот импорт существует
import { getServiceWallet, getConnection } from './solana.service.js'; // Предполагается, что этот импорт существует

// =========================================================================
// ✅ НОВОЕ ИСПРАВЛЕНИЕ: ПЕРЕХОД НА @metaplex-foundation/js SDK
// Этот SDK упрощает создание токена и автоматически решает проблемы импорта
// =========================================================================
import { Metaplex, keypairIdentity, toBigNumber } from '@metaplex-foundation/js';

// Константы Metaplex
const TOKEN_METADATA_PROGRAM_ID_STR = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6z8BXgZay';
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(TOKEN_METADATA_PROGRAM_ID_STR);


/**
 * Создает новый токен SPL (SFT), минтит начальную эмиссию и добавляет метаданные.
 *
 * NOTE: Высокоуровневый метод Metaplex createSft() выполняет все 4 шага:
 * 1. Создает Mint-аккаунт.
 * 2. Создает Associated Token Account (ATA).
 * 3. Минтит начальное предложение.
 * 4. Создает аккаунт метаданных (Metaplex).
 *
 * @param {string} name - Название токена.
 * @param {string} symbol - Символ токена.
 * @param {string} uri - URI метаданных (Pinata).
 * @param {string} supplyStr - Начальное предложение (строка).
 * @param {string} decimalsStr - Количество десятичных знаков (строка).
 * @returns {object} Объект с адресом Mint и подписью транзакции.
 */
export async function createTokenAndMetadata(name, symbol, uri, supplyStr, decimalsStr) {
    const connection = getConnection();
    const payer = getServiceWallet();
    
    const decimals = parseInt(decimalsStr, 10);
    // Преобразуем начальное предложение в BigInt, затем в Metaplex BigNumber
    const initialSupply = toBigInt(supplyStr, decimals); 

    console.log("Начинаем ШАГ 1-4: createTokenAndMetadata (полный процесс) с Metaplex JS SDK");

    try {
        // 1. Инициализация Metaplex с Connection и Keypair
        // keypairIdentity (payer) сообщает Metaplex, какой кошелек использовать для оплаты и как authority.
        const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

        // 2. ИСПОЛЬЗУЕМ ОДИН ВЫЗОВ ДЛЯ ВСЕХ 4 ШАГОВ (Mint, ATA, MintTo, Metadata)
        // Мы используем createSft (Standard Fungible Token)
        const { response, mintAddress, tokenAddress } = await metaplex.nfts().createSft({
            
            // --- Основные параметры токена ---
            name: name,
            symbol: symbol,
            uri: uri,
            sellerFeeBasisPoints: 0,
            isMutable: true,

            // --- Параметры Mint ---
            decimals: decimals,
            
            // --- Параметры Minting (Начальная эмиссия) ---
            tokenOwner: payer.publicKey,
            // toBigNumber преобразует количество токенов в нужный формат Metaplex
            supply: toBigNumber(initialSupply.toString()), 
            
        }, { 
            // Payer уже установлен через keypairIdentity, но мы можем указать его еще раз
            signer: payer 
        }).run();


        console.log(`✅ [ШАГ 1-4] Токен (SFT) создан. Mint: ${mintAddress.toBase58()}`);
        console.log(`✅ Транзакция завершена. Подпись: ${response.signature}`);
        
        return {
            mintAddress: mintAddress.toBase58(),
            ataAddress: tokenAddress.toBase58(), // Metaplex называет это tokenAddress
            metadataTx: response.signature // Это подпись транзакции, включающей метаданные
        };

    } catch (error) {
        console.error(`❌ Ошибка при создании токена и метаданных: ${error.message}`);
        // Дополнительный лог для трассировки
        console.error(error.stack); 
        
        // Перебрасываем ошибку для обработки в маршруте
        throw new Error(`Ошибка при создании токена: ${error.message}`);
    }
}
