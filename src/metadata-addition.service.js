// src/metadata-addition.service.js

// ✅ 1. ЯВНЫЙ ИМПОРТ Buffer для гарантии правильной реализации в Node.js
import { Buffer } from 'buffer';

import {
    PublicKey,
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction, 
} from '@solana/web3.js';

// ✅ 2. ИСПОЛЬЗУЕМ DEFAULT IMPORT ДЛЯ ИНСТРУКЦИЙ И DataV2
import * as mplTokenMetadataPkg from '@metaplex-foundation/mpl-token-metadata';

// Проверяем, находятся ли экспорты в свойстве .default (обход CommonJS/ESM)
const mplExports = mplTokenMetadataPkg.default || mplTokenMetadataPkg;

const {
    DataV2, 
    createCreateMetadataAccountV3Instruction,
} = mplExports;

// ✅ 3. ЖЕСТКОЕ КОДИРОВАНИЕ PROGRAM_ID Metaplex, чтобы избежать проблем с импортом,
// так как адрес программы метаданных всегда один и тот же.
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msK8P3vc');

import { getServiceKeypair, getConnection } from "./solana.service.js";


/**
 * Создает Metaplex Metadata Account для токена (с использованием V3).
 * @param {PublicKey} mintAddress Адрес Mint-аккаунта
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
        // Используем METADATA_PROGRAM_ID (который теперь является надежной константой PublicKey)
       const [metadataAddress] = await PublicKey.findProgramAddress( 
            [
                new Uint8Array(Buffer.from("metadata")), 
                METADATA_PROGRAM_ID.toBuffer(),
                mintAddress.toBuffer(),
            ],
            METADATA_PROGRAM_ID
        );

        // --- 2. Определение данных Metaplex DataV2 ---
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
                    isMutable: true,
                    collectionDetails: null, 
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
