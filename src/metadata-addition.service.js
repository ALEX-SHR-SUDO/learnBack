// src/metadata-addition.service.js

// ✅ ИМПОРТЫ СТАЛИ ЕЩЕ БОЛЕЕ ПРЯМЫМИ
import {
    PublicKey,
    SystemProgram, // Используется напрямую
    Transaction, // Используется напрямую
    sendAndConfirmTransaction, // Используется напрямую
    PublicKey as Web3PublicKey // Используется для типа в JSDoc (поскольку web3.PublicKey был удален)
} from '@solana/web3.js';
import mplTokenMetadataPkg from '@metaplex-foundation/mpl-token-metadata';
import { getServiceKeypair, getConnection } from "./solana.service.js";
import { Buffer } from 'buffer'; // ✅ ЯВНЫЙ ИМПОРТ Buffer

// Деструктурируем необходимые экспорты из полученного объекта
const { DataV2, createCreateMetadataAccountV2Instruction } = mplTokenMetadataPkg;

// ❌ УДАЛЕНА ПРОБЛЕМНАЯ СТРОКА: Инициализация константы при загрузке модуля
// const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msK8P3vc');

// ✅ ИНИЦИАЛИЗАЦИЯ: Ленивая (lazy) инициализация, чтобы PublicKey создавался только при вызове
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
    
    // ✅ Инициализируем константу внутри функции (безопасное место)
    const METADATA_PROGRAM_ID = getMetadataProgramId();

    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress.toBase58()}`);

    try {
        // --- 1. Получение адреса Metadata Account PDA ---
        // PublicKey здесь уже доступен, так как он импортирован напрямую
        const [metadataAddress] = PublicKey.findProgramAddressSync( 
            [
                Buffer.from("metadata"),
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
                // ❌ БЫЛО: web3.SystemProgram.programId (web3 не определен)
                // ✅ СТАЛО: SystemProgram.programId (импортирован напрямую)
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
        // ❌ БЫЛО: new web3.Transaction().add (web3 не определен)
        // ✅ СТАЛО: new Transaction().add (импортирован напрямую)
        const transaction = new Transaction().add(metadataInstruction);

        // ❌ БЫЛО: web3.sendAndConfirmTransaction (web3 не определен)
        // ✅ СТАЛО: sendAndConfirmTransaction (импортирован напрямую)
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