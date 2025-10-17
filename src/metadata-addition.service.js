// src/metadata-addition.service.js

// 1. ЯВНЫЙ ИМПОРТ Buffer для гарантии правильной реализации в Node.js
import { Buffer } from 'buffer';

import {
    PublicKey, // Used inside addTokenMetadata
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction, 
} from '@solana/web3.js';

// 2. ИСПОЛЬЗУЕМ DEFAULT IMPORT ДЛЯ ИНСТРУКЦИЙ И DataV2
import * as mplTokenMetadataPkg from '@metaplex-foundation/mpl-token-metadata';

// Check if exports are under .default property (CommonJS/ESM workaround)
const mplExports = mplTokenMetadataPkg.default || mplTokenMetadataPkg;

const {
    DataV2, 
    createCreateMetadataAccountV3Instruction,
} = mplExports;

import { getServiceKeypair, getConnection } from "./solana.service.js";


// 🛑 КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: Создаем PublicKey для программы метаданных на уровне модуля.
// Это гарантирует, что она инстанцирована правильно и стабильно.
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msK8P3vc');


/**
 * Creates the Metaplex Metadata Account for the token (using V3).
 * @param {string} mintAddressString Mint account address as a Base58 string
 * @param {string} name Token name
 * @param {string} symbol Token symbol
 * @param {string} uri Metadata URI
 * @returns {Promise<PublicKey>} Address of the Metadata Account PDA.
 */
export async function addTokenMetadata(mintAddressString, name, symbol, uri) {
    const serviceKeypair = getServiceKeypair();
    const connection = getConnection();
    const payer = serviceKeypair;

    let mintAddress; 

    // CRITICAL DEBUGGING BLOCK: Isolate the PublicKey creation failure
    try {
        console.log(`[DEBUG] Входящая строка Mint-адреса: ${mintAddressString}`);
        // Создаем объект PublicKey здесь из переданной строки.
        mintAddress = new PublicKey(mintAddressString);
        console.log(`[DEBUG] Объект Mint PublicKey успешно создан: ${mintAddress.toBase58()}`);

    } catch (e) {
        console.error(`[КРИТИЧЕСКИЙ DEBUG] НЕ УДАЛОСЬ преобразовать строку в Mint PublicKey: ${e.message}`);
        throw new Error(`Невалидный адрес Mint: ${mintAddressString}. Причина: ${e.message}`);
    }

    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress.toBase58()}`);

    try {
        // --- 1. Get Metadata Account PDA address ---
        
        // 🛑 КРИТИЧЕСКИЙ DEBUG 2: Проверяем типы перед findProgramAddress
        console.log(`[DEBUG] Тип METADATA_PROGRAM_ID (константа модуля): ${METADATA_PROGRAM_ID.constructor.name}`); // Должен быть 'PublicKey'
        console.log(`[DEBUG] Тип mintAddress (создан в функции): ${mintAddress.constructor.name}`); // Должен быть 'PublicKey'
        
        // Используем .toBytes() для сидов.
       const [metadataAddress] = await PublicKey.findProgramAddress( 
            [
                Buffer.from("metadata", "utf8"),
                METADATA_PROGRAM_ID.toBytes(), 
                mintAddress.toBytes(),         
            ],
            METADATA_PROGRAM_ID
        );
        
        console.log(`[DEBUG] Адрес PDA метаданных успешно вычислен: ${metadataAddress.toBase58()}`);

        // --- 2. Define Metaplex DataV2 data ---
        const tokenData = new DataV2({
            name: name,
            symbol: symbol,
            uri: uri,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
        });

        // --- 3. Create V3 instruction ---
        // Если PDA вычислен, ошибка почти наверняка не здесь.
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

        // --- 4. Send transaction ---
        const transaction = new Transaction().add(metadataInstruction);

        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [payer] 
        );

        console.log(`✅ [ШАГ 4] Метаданные созданы. Signature: ${signature}`);
        
        return metadataAddress;

    } catch (error) {
        // Мы поймаем ошибку, если она произошла в findProgramAddress или в sendAndConfirmTransaction
        console.error("❌ Ошибка в addTokenMetadata:", error);
        throw new Error(`Не удалось создать метаданные: ${error.message}`);
    }
}
