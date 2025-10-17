// src/metadata-addition.service.js

import * as web3 from '@solana/web3.js';
// ✅ ИСПОЛЬЗУЕМ СИНТАКСИС, РЕКОМЕНДОВАННЫЙ NODE.JS ДЛЯ CJS/ESM
import mplTokenMetadataPkg from '@metaplex-foundation/mpl-token-metadata';
import { getServiceKeypair, getConnection } from "./solana.service.js"; 

// Деструктурируем необходимые экспорты из полученного объекта
const { DataV2, createCreateMetadataAccountV2Instruction } = mplTokenMetadataPkg;

// ✅ HARDCODE FIX: Адрес программы Metaplex Token Metadata
const METADATA_PROGRAM_ID = new web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msK8P3vc');

/**
 * Создает Metaplex Metadata Account для токена.
 * @param {web3.PublicKey} mintAddress Адрес Mint-аккаунта
 * @param {string} name Имя токена
 * @param {string} symbol Символ токена
 * @param {string} uri URI метаданных
 * @returns {Promise<web3.PublicKey>} Адрес Metadata Account PDA.
 */
export async function addTokenMetadata(mintAddress, name, symbol, uri) {
    const serviceKeypair = getServiceKeypair();
    const connection = getConnection();
    const payer = serviceKeypair;

    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress.toBase58()}`);

    try {
        // --- 1. Получение адреса Metadata Account PDA ---
        const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                METADATA_PROGRAM_ID.toBuffer(), // ✅ ИСПОЛЬЗУЕМ HARDCODED PROGRAM_ID
                mintAddress.toBuffer(),
            ],
            METADATA_PROGRAM_ID
        );

        // --- 2. Определение данных Metaplex DataV2 ---
        // ✅ ИСПОЛЬЗУЕМ DataV2 ИМПОРТИРОВАННУЮ НАПРЯМУЮ
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
        // ✅ ИСПОЛЬЗУЕМ createCreateMetadataAccountV2Instruction ИМПОРТИРОВАННУЮ НАПРЯМУЮ
        const metadataInstruction = createCreateMetadataAccountV2Instruction(
            {
                metadata: metadataAddress,
                mint: mintAddress,
                mintAuthority: payer.publicKey,
                payer: payer.publicKey,
                updateAuthority: payer.publicKey,
                systemProgram: web3.SystemProgram.programId,
            },
            {
                createMetadataAccountArgsV2: {
                    data: tokenData,
                    isMutable: true,
                },
            }
        );

        // --- 4. Отправка транзакции ---
        const transaction = new web3.Transaction().add(metadataInstruction);

        const signature = await web3.sendAndConfirmTransaction(
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