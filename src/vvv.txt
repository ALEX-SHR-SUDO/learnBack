// src/metadata-addition.service.js

import { 
    Connection, 
    Keypair, 
    Transaction, 
    PublicKey, 
    sendAndConfirmTransaction, 
    SystemProgram
} from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { getServiceWallet, getConnection } from './solana.service.js'; // Предполагается, что этот импорт существует
import { toBigInt } from './utils.js'; // Предполагается, что этот импорт существует

// =========================================================================
// ✅ ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ METAPLEX: ДИНАМИЧЕСКИЙ ASYNC IMPORT
// -------------------------------------------------------------------------

// 1. Объявляем переменные, которые будут присвоены после динамического импорта.
// В ESM-файле 'require()' запрещен (ReferenceError), поэтому используем async/await import().
let createCreateMetadataAccountV3Instruction;
let findMetadataPda;

// 2. Выполняем динамический импорт (Top-level await поддерживается в Node 22)
// Этот метод является наиболее надежным для CommonJS-пакетов в ESM-среде.
console.log('Инициализация Metaplex через динамический импорт...');
try {
    // Dynamic import возвращает Promise, который разрешается в объект модуля
    const metaplexModule = await import('@metaplex-foundation/mpl-token-metadata');
    
    // Пакет Metaplex является CommonJS, поэтому функции могут быть в корне или в .default
    const exportsToUse = metaplexModule.default || metaplexModule;

    // 3. Присваиваем функции глобальным переменным
    findMetadataPda = exportsToUse.findMetadataPda;
    createCreateMetadataAccountV3Instruction = exportsToUse.createCreateMetadataAccountV3Instruction;
    
    // Дополнительная проверка на случай глубокой вложенности
    if (!findMetadataPda && exportsToUse.default) {
        findMetadataPda = exportsToUse.default.findMetadataPda;
        createCreateMetadataAccountV3Instruction = exportsToUse.default.createCreateMetadataAccountV3Instruction;
    }

    if (findMetadataPda) {
        console.log('✅ Инициализация Metaplex завершена успешно.');
    } else {
        console.error("КРИТИЧЕСКАЯ ОШИБКА: Metaplex-функции не найдены после динамического импорта.");
    }

} catch (error) {
    console.error('❌ Ошибка при динамическом импорте Metaplex:', error.message);
}

// =========================================================================

// Константы Metaplex
const TOKEN_METADATA_PROGRAM_ID_STR = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6z8BXgZay';
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(TOKEN_METADATA_PROGRAM_ID_STR);


/**
 * Шаг 4: Добавление метаданных Metaplex к Mint-аккаунту.
 * @param {PublicKey} mintPublicKey - Публичный ключ Mint-аккаунта.
 * @param {Keypair} payer - Кошелек, оплачивающий комиссию и являющийся Mint-Authority.
 * @param {object} details - Детали метаданных (name, symbol, uri).
 */
export async function addTokenMetadata(mintPublicKey, payer, details) {
    if (!findMetadataPda || !createCreateMetadataAccountV3Instruction) {
        throw new Error("Не удалось инициализировать Metaplex-функции. Отмена создания метаданных.");
    }
    
    const tokenMetadataProgramId = TOKEN_METADATA_PROGRAM_ID;

    // 1. Найти адрес Program Derived Address (PDA) для метаданных
    // ИСПОЛЬЗУЕМ ИМПОРТИРОВАННУЮ ФУНКЦИЮ findMetadataPda
    const [metadataAddress] = findMetadataPda({
        mint: mintPublicKey,
        programId: tokenMetadataProgramId, 
    });

    console.log(`Адрес PDA метаданных успешно вычислен: ${metadataAddress.toBase58()}`);

    // 2. Создание инструкции V3
    // ИСПОЛЬЗУЕМ ИМПОРТИРОВАННУЮ ФУНКЦИЮ createCreateMetadataAccountV3Instruction
    const instruction = createCreateMetadataAccountV3Instruction(
        {
            metadata: metadataAddress,
            mint: mintPublicKey,
            mintAuthority: payer.publicKey,
            payer: payer.publicKey,
            updateAuthority: payer.publicKey,
            systemProgram: SystemProgram.programId,
            rent: splToken.ASSOCIATED_TOKEN_PROGRAM_ID, // Rent is usually handled by SystemProgram, but in some versions, this field is required and ignored
        },
        {
            createMetadataAccountArgsV3: {
                data: {
                    name: details.name,
                    symbol: details.symbol,
                    uri: details.uri,
                    sellerFeeBasisPoints: 0,
                    creators: null,
                    collection: null,
                    uses: null,
                },
                isMutable: true,
                collectionDetails: null, // Оставляем null для обычного токена
            },
        },
        tokenMetadataProgramId
    );

    // 3. Отправка транзакции
    const connection = getConnection();
    const { blockhash } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction({ 
        recentBlockhash: blockhash,
        feePayer: payer.publicKey,
    }).add(instruction);

    try {
        const txSignature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [payer],
            { 
                skipPreflight: false,
                preflightCommitment: "confirmed"
            }
        );

        console.log(`✅ [ШАГ 4] Метаданные созданы. Подпись: ${txSignature}`);
        return txSignature;
    } catch (error) {
        console.error(`❌ Ошибка на ШАГЕ 4 (Метаданные): ${error.message}`);
        throw error;
    }
}


/**
 * Создает новый токен SPL, минтит начальную эмиссию и добавляет метаданные.
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
    const mintKeypair = Keypair.generate();
    
    const decimals = parseInt(decimalsStr, 10);
    // Преобразуем начальное предложение в BigInt
    const initialSupply = toBigInt(supplyStr, decimals); 

    console.log("Начинаем ШАГ 1-4: createTokenAndMetadata (полный процесс)");

    // --- ШАГ 1: Создание Mint-аккаунта ---
    try {
        console.log(`[ШАГ 1] Попытка создать Mint-аккаунт.`);
        
        const mintTxSignature = await splToken.createMint(
            connection,
            payer,
            payer.publicKey, // Mint Authority
            payer.publicKey, // Freeze Authority
            decimals,
            mintKeypair,
            null, // Transaction
            splToken.TOKEN_PROGRAM_ID
        );

        const mintPublicKey = mintKeypair.publicKey;
        console.log(`✅ [ШАГ 1] Mint-аккаунт создан: ${mintPublicKey.toBase58()}`);

        // --- ШАГ 2: Создание Associated Token Account (ATA) ---
        console.log(`[ШАГ 2] Попытка создать Associated Token Account (ATA).`);
        
        const ataPublicKey = await splToken.getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mintPublicKey,
            payer.publicKey,
            false, // Allow owner off curve
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID
        );

        console.log(`✅ [ШАГ 2] Associated Token Account (ATA) создан: ${ataPublicKey.address.toBase58()}`);

        // --- ШАГ 3: Минт начального предложения ---
        console.log(`[ШАГ 3] Попытка отчеканить начальное предложение.`);
        
        const mintToTxSignature = await splToken.mintTo(
            connection,
            payer,
            mintPublicKey,
            ataPublicKey.address,
            payer, // Mint Authority
            initialSupply,
            [], // MultiSigners
            null, // Transaction
            splToken.TOKEN_PROGRAM_ID
        );

        console.log(`✅ [ШАГ 3] Начальное предложение ${supplyStr} токенов отчеканено.`);

        // --- ШАГ 4: Добавление метаданных ---
        console.log(`[ШАГ 4] Попытка создать метаданные для ${mintPublicKey.toBase58()}`);
        
        const metadataTxSignature = await addTokenMetadata(
            mintPublicKey,
            payer,
            { name, symbol, uri }
        );
        
        return {
            mintAddress: mintPublicKey.toBase58(),
            ataAddress: ataPublicKey.address.toBase58(),
            metadataTx: metadataTxSignature
        };

    } catch (error) {
        console.error(`❌ Ошибка при создании токена и метаданных: ${error.message}`);
        // Дополнительный лог для трассировки
        console.error(error.stack); 
        
        // Перебрасываем ошибку для обработки в маршруте
        throw new Error(`Ошибка при создании токена: ${error.message}`);
    }
}
