// src/metadata-addition.service.js

// ✅ 1. ЯВНЫЙ ИМПОРТ Buffer для гарантии правильной реализации
import { Buffer } from 'buffer';

// ✅ 2. ИМПОРТЫ СТАЛИ ЕЩЕ БОЛЕЕ ПРЯМЫМИ
import {
    PublicKey,
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction, 
    PublicKey as Web3PublicKey 
} from '@solana/web3.js';
import mplTokenMetadataPkg from '@metaplex-foundation/mpl-token-metadata';
import { getServiceKeypair, getConnection } from "./solana.service.js";

// Деструктурируем необходимые экспорты из полученного объекта
const { DataV2, createCreateMetadataAccountV2Instruction } = mplTokenMetadataPkg;

// ✅ ИНИЦИАЛИЗАЦИЯ: Ленивая (lazy) инициализация адреса Metaplex Program ID
function getMetadataProgramId() {
    return new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msK8P3vc');
}

/**
 * Создает Metaplex Metadata Account для токена.
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
    
    const METADATA_PROGRAM_ID = getMetadataProgramId();

    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress.toBase58()}`);

    try {
        // --- 1. Получение адреса Metadata Account PDA ---
        // ✅ Асинхронный вызов, явный Buffer, явный Uint8Array
       const [metadataAddress] = await PublicKey.findProgramAddress( // ⬅️ await PublicKey.findProgramAddress
            [
                new Uint8Array(Buffer.from("metadata")), // ⬅️ Buffer.from() + new Uint8Array()
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

        // --- 3. Создание инструкции ---
        const metadataInstruction = createCreateMetadataAccountV2Instruction(
            {
                metadata: metadataAddress,
                mint: mintAddress,
                mintAuthority: payer.publicKey,
                payer: payer.publicKey,
                updateAuthority: payer.publicKey,
                systemProgram: SystemProgram.programId, 
            },
            {
                createMetadataAccountArgsV2: {
                    data: tokenData,
                    isMutable: true,
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