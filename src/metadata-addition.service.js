// src/metadata-addition.service.js

import { 
    PublicKey, 
    Transaction, 
    sendAndConfirmTransaction,
    Keypair, 
    SystemProgram, 
    LAMPORTS_PER_SOL 
} from '@solana/web3.js'; 

// 🛑 ИСПРАВЛЕНИЕ ОШИБКИ ESM/CommonJS: 
import * as mplTokenMetadata from '@metaplex-foundation/mpl-token-metadata';

const createCreateMetadataAccountV3Instruction = mplTokenMetadata.createCreateMetadataAccountV3Instruction || (mplTokenMetadata.default && mplTokenMetadata.default.createCreateMetadataAccountV3Instruction);
const findMetadataPda = mplTokenMetadata.findMetadataPda || (mplTokenMetadata.default && mplTokenMetadata.default.findMetadataPda);

// 🛑 НОВЫЕ ИМПОРТЫ SPL-TOKEN
import * as splToken from '@solana/spl-token';
const { 
    createMint, 
    createAssociatedTokenAccountInstruction, 
    createMintToInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    MINT_SIZE
} = splToken;

// ✅ СТРОКА 31: ОБНОВЛЕННЫЙ ИМПОРТ - Включаем METADATA_PROGRAM_ID из solana.service.js
import { getConnection, getServiceWallet, METADATA_PROGRAM_ID } from './solana.service.js';
import { Buffer } from 'buffer';

// ✅ СТРОКА 35: ИМПОРТ НОВОЙ ФУНКЦИИ БЕЗОПАСНЫХ ВЫЧИСЛЕНИЙ
import { toBigInt } from './utils.js';

// --- НАСТРОЙКА КОНСТАНТ ---
// ❌ СТРОКИ 40-57 (УДАЛЕНО): УДАЛЯЕМ старую константу METAPLEX_PROGRAM_ID_DEFAULT 
// и проблемную функцию _getMetadataProgramId, которая вызывала ошибку PublicKey.

/**
 * [ПРИВАТНАЯ ФУНКЦИЯ] Создает инструкцию для добавления метаданных Metaplex.
 * @param {PublicKey} mintPublicKey - Публичный ключ минта токена.
 * @param {Keypair} payer - Кошелек, оплачивающий и подписывающий транзакцию.
 * @param {Object} metadataDetails - Детали метаданных (name, symbol, uri).
 * @returns {TransactionInstruction} Инструкция по созданию метаданных.
 */
function _createMetadataInstruction(mintPublicKey, payer, metadataDetails) {
    // ✅ СТРОКА 67: Используем импортированный, готовый PublicKey
    const TOKEN_METADATA_PROGRAM_ID = METADATA_PROGRAM_ID; 
    
    // 1. Вычисление адреса PDA метаданных
    const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(), 
            mintPublicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID 
    );
    
    console.log(`Адрес PDA метаданных: ${metadataAddress.toBase58()}`);
    
    // 2. Создание инструкции
    const instruction = createCreateMetadataAccountV3Instruction(
        {
            metadata: metadataAddress,
            mint: mintPublicKey,
            mintAuthority: payer.publicKey,
            payer: payer.publicKey,
            updateAuthority: payer.publicKey,
        },
        {
            createMetadataAccountArgsV3: {
                data: {
                    name: metadataDetails.name,
                    symbol: metadataDetails.symbol,
                    uri: metadataDetails.uri,
                    sellerFeeBasisPoints: 0,
                    creators: null,
                    collection: null,
                    uses: null,
                },
                isMutable: true,
                collectionDetails: null,
            },
        },
        TOKEN_METADATA_PROGRAM_ID
    );
    
    return instruction;
}


/**
 * СОЗДАЕТ ТОКЕН MINT, ЧЕКАНКУЕТ ЕГО И ДОБАВЛЯЕТ МЕТАДАННЫЕ METAPLEX.
 * @param {Object} tokenDetails - Детали токена и метаданных. Должен содержать name, symbol, uri, supply, decimals.
 * @returns {Promise<Object>} Объект с подписью и адресом минта.
 */
export async function createTokenAndMetadata(tokenDetails) {
    const connection = getConnection();
    const payer = getServiceWallet();
    const mintKeypair = Keypair.generate(); 
    const mintPublicKey = mintKeypair.publicKey;
    
    // --- ИСПРАВЛЕНИЕ: БОЛЕЕ СТРОГИЙ ПАРСИНГ ЦЕЛЫХ ЧИСЕЛ И ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ ---
    
    const decimalsString = tokenDetails.decimals || '9'; 
    const supplyString = tokenDetails.supply || '0';     

    const decimals = parseInt(decimalsString, 10);
    // Для валидации используем стандартное число, но для чеканки используем строку
    const supplyForValidation = parseInt(supplyString, 10);
    
    // ВРЕМЕННОЕ ЛОГГИРОВАНИЕ ДЛЯ ДЕБАГА
    console.log(`[DEBUG] Input tokenDetails.supply: '${tokenDetails.supply}'`);
    console.log(`[DEBUG] Parsed supply value (parseInt): ${supplyForValidation}`);
    console.log(`[DEBUG] isNaN(supplyForValidation): false`);
    console.log(`[DEBUG] supplyForValidation <= 0: ${supplyForValidation <= 0}`);
    

    // Валидация
    if (isNaN(supplyForValidation) || supplyForValidation <= 0) {
        throw new Error("Supply (общий запас) должен быть положительным целым числом.");
    }
    
    // Если decimals не указан или некорректен, используем стандартное значение 9.
    const finalDecimals = (isNaN(decimals) || decimals < 0 || decimals > 9) ? 9 : decimals;
    
    console.log(`\n--- НАЧАЛО СОЗДАНИЯ ТОКЕНА И МЕТАДАННЫХ (D:${finalDecimals}, S:${supplyForValidation}) ---`);
    console.log(`Новый Mint Address: ${mintPublicKey.toBase58()}`);
    
    // 1. Рассчитываем необходимый рент и адрес Ассоциированного Токен Аккаунта (ATA)
    const requiredRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    
    const tokenAccountAddress = getAssociatedTokenAddressSync(
        mintPublicKey,
        payer.publicKey,
        false, 
        TOKEN_PROGRAM_ID
    );
    
    console.log(`ATA Address (Payer): ${tokenAccountAddress.toBase58()}`);

    // --- ФОРМИРОВАНИЕ ИНСТРУКЦИЙ ---
    let instructions = [];
    
    // 1. Инструкция: Создание Mint Account
    instructions.push(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mintPublicKey,
            space: MINT_SIZE,
            lamports: requiredRent,
            programId: TOKEN_PROGRAM_ID,
        })
    );
    
    // 2. Инструкция: Инициализация Mint Account
    instructions.push(
        createMint(
            connection,
            payer,
            mintPublicKey,
            payer.publicKey, // Mint Authority
            finalDecimals, // ИСПОЛЬЗУЕМ ПРОВЕРЕННОЕ ЗНАЧЕНИЕ
            mintKeypair,
            TOKEN_PROGRAM_ID,
        )
    );
    
    // 3. Инструкция: Создание ATA
    instructions.push(
        createAssociatedTokenAccountInstruction(
            payer.publicKey,
            tokenAccountAddress,
            payer.publicKey,
            mintPublicKey,
            TOKEN_PROGRAM_ID
        )
    );
    
    // 4. Инструкция: Чеканка (Mint)
    // ✅ ИСПОЛЬЗУЕМ НОВУЮ БЕЗОПАСНУЮ ФУНКЦИЮ toBigInt для предотвращения потери точности.
    const amountInSmallestUnit = toBigInt(supplyString, finalDecimals);

    instructions.push(
        createMintToInstruction(
            mintPublicKey,
            tokenAccountAddress,
            payer.publicKey, // Mint Authority
            amountInSmallestUnit, // Amount in smallest unit (УЖЕ BigInt)
            [],
            TOKEN_PROGRAM_ID
        )
    );
    
    // 5. Инструкция: Создание Метаданных Metaplex
    const metadataInstruction = _createMetadataInstruction(
        mintPublicKey, 
        payer, 
        tokenDetails
    );
    instructions.push(metadataInstruction);

    // 6. Отправка транзакции
    try {
        const tx = new Transaction().add(...instructions);
        
        const signature = await sendAndConfirmTransaction(
            connection,
            tx,
            [payer, mintKeypair], 
            { 
                commitment: "confirmed",
                skipPreflight: false,
            }
        );

        console.log(`✅ Токен и метаданные созданы. Подпись: ${signature}`);
        return { 
            mintAddress: mintPublicKey.toBase58(),
            signature: signature 
        };
    } catch (error) {
        console.error("❌ Ошибка при создании токена и метаданных:", error);
        throw new Error("Ошибка транзакции токена/метаданных: " + error.message);
    }
}


/**
 * Добавляет метаданные Metaplex для существующего токена.
 * * @param {string} mintAddress - Публичный ключ минта токена.
 * @param {Object} metadataDetails - Детали метаданных (name, symbol, uri).
 * @returns {Promise<string>} Подпись транзакции.
 */
export async function addTokenMetadata(mintAddress, metadataDetails) {
    const connection = getConnection();
    const payer = getServiceWallet();
    
    console.log(`\n--- Добавление метаданных для: ${mintAddress} ---`);
    
    const mintPublicKey = new PublicKey(mintAddress);
    
    // 1. Создаем инструкцию
    const instruction = _createMetadataInstruction(mintPublicKey, payer, metadataDetails);

    // 2. Отправка транзакции
    try {
        const tx = new Transaction().add(instruction);
        
        const signature = await sendAndConfirmTransaction(
            connection,
            tx,
            [payer], // Подписывается только наш сервисный кошелек
            { 
                commitment: "confirmed"
            }
        );

        console.log(`✅ Метаданные созданы. Подпись: ${signature}`);
        return signature;
    } catch (error) {
        console.error("❌ Ошибка при добавлении метаданных:", error);
        
        if (error.message && error.message.includes('already been executed')) {
             throw new Error("Метаданные для этого токена уже существуют.");
        }
        
        throw new Error("Ошибка транзакции Metaplex: " + error.message);
    }
}
