// src/metadata-addition.service.js

import { Buffer } from 'buffer';

import {
    PublicKey,
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction, 
} from '@solana/web3.js';

// ИСПОЛЬЗУЕМ DEFAULT IMPORT ДЛЯ ИНСТРУКЦИЙ И DataV2
import * as mplTokenMetadataPkg from '@metaplex-foundation/mpl-token-metadata';

const mplExports = mplTokenMetadataPkg.default || mplTokenMetadataPkg;

const {
    DataV2, 
    createCreateMetadataAccountV3Instruction,
} = mplExports;

import { getServiceKeypair, getConnection } from "./solana.service.js";


const METADATA_PROGRAM_ID_STRING = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msK8P3vc';


/**
 * Создает Metaplex Metadata Account для токена (с использованием V3).
 * @param {string} mintAddressString Адрес Mint-аккаунта в виде строки Base58
 * @param {string} name Имя токена
 * @param {string} symbol Символ токена
 * @param {string} uri URI метаданных
 * @returns {Promise<PublicKey>} Адрес Metadata Account PDA.
 */
export async function addTokenMetadata(mintAddressString, name, symbol, uri) {
    const serviceKeypair = getServiceKeypair();
    const connection = getConnection();
    const payer = serviceKeypair;

    // Безопасное инстанцирование PublicKey внутри функции
    const mintAddress = new PublicKey(mintAddressString);
    const METADATA_PROGRAM_ID = new PublicKey(METADATA_PROGRAM_ID_STRING);

    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress.toBase58()}`);

    try {
        // --- 1. Получение адреса Metadata Account PDA ---
        
        // 🛑 КРИТИЧЕСКИЙ ДЕБАГ: Получаем байты и проверяем их длину
        const metadataProgramBytes = METADATA_PROGRAM_ID.toBytes();
        const mintAddressBytes = mintAddress.toBytes();
        
        console.log(`[DEBUG PDA] METADATA_PROGRAM_ID bytes length: ${metadataProgramBytes.length}`);
        console.log(`[DEBUG PDA] mintAddress bytes length: ${mintAddressBytes.length}`);


        // ✅ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Все сиды передаются как явные объекты Buffer,
        // что является самым низкоуровневым и надежным способом.
       const [metadataAddress] = await PublicKey.findProgramAddress( 
            [
                Buffer.from("metadata", "utf8"),
                // Явное преобразование Uint8Array в Buffer
                Buffer.from(metadataProgramBytes), 
                Buffer.from(mintAddressBytes),         
            ],
            METADATA_PROGRAM_ID
        );
        
        console.log(`[DEBUG PDA] Адрес PDA метаданных успешно вычислен: ${metadataAddress.toBase58()}`);


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
        throw new Error(`Не удалось создать метаданные. Возможно, проблема с метаданными или лимитом транзакции. Причина: ${error.message}`);
    }
}
