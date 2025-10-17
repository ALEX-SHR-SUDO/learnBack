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


// Program ID: Token Metadata Program
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
        // ✅ САМОЕ НАДЕЖНОЕ РЕШЕНИЕ: используем PublicKey объекты напрямую для сидов.
        // Это стандартный и наиболее устойчивый паттерн.
       const [metadataAddress] = await PublicKey.findProgramAddress( 
            [
                Buffer.from("metadata", "utf8"), // Seed 1: String prefix as Buffer
                METADATA_PROGRAM_ID,             // Seed 2: Program ID (as PublicKey object)
                mintAddress,                     // Seed 3: Mint Key (as PublicKey object)
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
        // Логирование, если сбой происходит после вычисления PDA
        if (error.message.includes('Invalid public key input')) {
            console.error("❌ Ошибка в addTokenMetadata: Ключ не прошел валидацию в findProgramAddress.");
        } else {
            console.error("❌ Ошибка в addTokenMetadata:", error);
        }
        throw new Error(`Не удалось создать метаданные. Причина: ${error.message}`);
    }
}
