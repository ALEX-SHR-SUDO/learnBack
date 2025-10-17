// src/metadata-addition.service.js

// ✅ 1. ЯВНЫЙ ИМПОРТ Buffer для гарантии правильной реализации в Node.js
import { Buffer } from 'buffer';

import {
    PublicKey,
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction, 
} from '@solana/web3.js';

// ✅ 2. Импортируем V3 Инструкцию и PROGRAM_ID напрямую, как в рабочем React-коде
import {
    DataV2, 
    createCreateMetadataAccountV3Instruction,
    PROGRAM_ID as METADATA_PROGRAM_ID, // <-- Переименовываем PROGRAM_ID
} from '@metaplex-foundation/mpl-token-metadata';

import { getServiceKeypair, getConnection } from "./solana.service.js";


/**
 * Создает Metaplex Metadata Account для токена (с использованием V3).
 * * Мы используем этот метод, поскольку он полностью соответствует рабочему
 * фронтенд-коду и явно включает все поля, необходимые для V3.
 * * @param {PublicKey} mintAddress Адрес Mint-аккаунта
 * @param {string} name Имя токена
 * @param {string} symbol Символ токена
 * @param {string} uri URI метаданных
 * @returns {Promise<PublicKey>} Адрес Metadata Account PDA.
 */
export async function addTokenMetadata(mintAddress, name, symbol, uri) {
    const serviceKeypair = getServiceKeypair();
    const connection = getConnection();
    const payer = serviceKeypair;

    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress.toBase58()}`);

    try {
        // --- 1. Получение адреса Metadata Account PDA ---
        // ✅ Используем импортированный METADATA_PROGRAM_ID
        // ✅ Явно конвертируем сид "metadata" в Buffer/Uint8Array для надёжности
       const [metadataAddress] = await PublicKey.findProgramAddress( 
            [
                new Uint8Array(Buffer.from("metadata")), 
                METADATA_PROGRAM_ID.toBuffer(),
                mintAddress.toBuffer(),
            ],
            METADATA_PROGRAM_ID
        );

        // --- 2. Определение данных Metaplex DataV2 ---
        // Используем DataV2 (стандартный формат метаданных)
        const tokenData = new DataV2({
            name: name,
            symbol: symbol,
            uri: uri,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
        });

        // --- 3. Создание инструкции V3 ---
        const metadataInstruction = createCreateMetadataAccountV3Instruction(
            {
                metadata: metadataAddress,
                mint: mintAddress,
                mintAuthority: payer.publicKey,
                payer: payer.publicKey,
                updateAuthority: payer.publicKey,
                systemProgram: SystemProgram.programId, 
            },
            {
                createMetadataAccountArgsV3: { 
                    data: tokenData,
                    isMutable: true, // Позволяет изменять метаданные в будущем
                    collectionDetails: null, // Обязательное поле для V3, если коллекция не используется
                },
            }
        );

        // --- 4. Отправка транзакции ---
        const transaction = new Transaction().add(metadataInstruction);

        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [payer] 
        );

        console.log(`✅ [ШАГ 4] Метаданные созданы. Signature: ${signature}`);
        
        return metadataAddress;

    } catch (error) {
        console.error("❌ Ошибка в addTokenMetadata:", error);
        throw new Error(`Не удалось создать метаданные: ${error.message}`);
    }
}
