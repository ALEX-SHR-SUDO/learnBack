// src/metadata-addition.service.js

import { 
    PublicKey, 
    Transaction, 
    sendAndConfirmTransaction,
    Keypair, // <-- ДОБАВЛЕНО ДЛЯ СОЗДАНИЯ MINT
    SystemProgram, // <-- ДОБАВЛЕНО ДЛЯ СОЗДАНИЯ MINT
    LAMPORTS_PER_SOL // <-- ДОБАВЛЕНО
} from '@solana/web3.js'; 

// 🛑 ИСПРАВЛЕНИЕ ОШИБКИ ESM/CommonJS: 
// Используем import * as для пакета Metaplex, который является CJS.
import * as mplTokenMetadata from '@metaplex-foundation/mpl-token-metadata';

// Извлекаем функции из импортированного объекта. 
const createCreateMetadataAccountV3Instruction = mplTokenMetadata.createCreateMetadataAccountV3Instruction || (mplTokenMetadata.default && mplTokenMetadata.default.createCreateMetadataAccountV3Instruction);
const findMetadataPda = mplTokenMetadata.findMetadataPda || (mplTokenMetadata.default && mplTokenMetadata.default.findMetadataPda);

// 🛑 НОВЫЕ ИМПОРТЫ SPL-TOKEN ДЛЯ СОЗДАНИЯ ТОКЕНА
import * as splToken from '@solana/spl-token';
const { 
    createMint, 
    createAssociatedTokenAccountInstruction, 
    createMintToInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    MINT_SIZE
} = splToken;


import { getConnection, getServiceWallet } from './solana.service.js';
import { Buffer } from 'buffer';

// --- НАСТРОЙКА КОНСТАНТ ---

const DEFAULT_METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6z8BXgZay';
const METADATA_PROGRAM_ID_STRING = process.env.TOKEN_METADATA_PROGRAM_ID || DEFAULT_METADATA_PROGRAM_ID;
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(METADATA_PROGRAM_ID_STRING); 
const DECIMAL_PLACES = 9; // Стандартное число десятичных знаков для SPL токенов

/**
 * [ПРИВАТНАЯ ФУНКЦИЯ] Создает инструкцию для добавления метаданных Metaplex.
 * @param {PublicKey} mintPublicKey - Публичный ключ минта токена.
 * @param {Keypair} payer - Кошелек, оплачивающий и подписывающий транзакцию.
 * @param {Object} metadataDetails - Детали метаданных (name, symbol, uri).
 * @returns {TransactionInstruction} Инструкция по созданию метаданных.
 */
function _createMetadataInstruction(mintPublicKey, payer, metadataDetails) {
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
 * @param {Object} tokenDetails - Детали токена и метаданных. Должен содержать name, symbol, uri, supply.
 * @returns {Promise<Object>} Объект с подписью и адресом минта.
 */
export async function createTokenAndMetadata(tokenDetails) {
    const connection = getConnection();
    const payer = getServiceWallet();
    const mintKeypair = Keypair.generate(); // Новый Keypair для минта
    const mintPublicKey = mintKeypair.publicKey;
    
    console.log(`\n--- НАЧАЛО СОЗДАНИЯ ТОКЕНА И МЕТАДАННЫХ ---`);
    console.log(`Новый Mint Address: ${mintPublicKey.toBase58()}`);
    
    // 1. Рассчитываем необходимый рент и адрес Ассоциированного Токен Аккаунта (ATA)
    const requiredRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    
    // ATA адрес для получателя (в данном случае - для сервисного кошелька)
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
            DECIMAL_PLACES,
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
    instructions.push(
        createMintToInstruction(
            mintPublicKey,
            tokenAccountAddress,
            payer.publicKey, // Mint Authority
            BigInt(tokenDetails.supply * (10 ** DECIMAL_PLACES)), // Amount in smallest unit
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
        
        // Транзакция подписывается: Payer и Mint Keypair (для создания аккаунта)
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
        
        // Обработка случая, когда метаданные уже существуют
        if (error.message && error.message.includes('already been executed')) {
             throw new Error("Метаданные для этого токена уже существуют.");
        }
        
        throw new Error("Ошибка транзакции Metaplex: " + error.message);
    }
}
