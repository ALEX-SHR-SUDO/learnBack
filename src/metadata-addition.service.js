// src/metadata-addition.service.js

import { 
    PublicKey, 
    Transaction, 
    sendAndConfirmTransaction 
} from '@solana/web3.js'; 

import { 
    createCreateMetadataAccountV3Instruction, 
    findMetadataPda
} from '@metaplex-foundation/mpl-token-metadata'; // Используем mpl-token-metadata для инструкций

import { getConnection, getServiceWallet } from './solana.service.js';
import { Buffer } from 'buffer'; // Нужен для findProgramAddressSync

// --- НАСТРОЙКА КОНСТАНТ ---

// 🛑 ИСПРАВЛЕНИЕ ОШИБКИ 'Invalid public key input' 
// 1. Используем жестко закодированный Program ID, если ENV переменная отсутствует,
//    чтобы избежать передачи пустой строки в new PublicKey().
const DEFAULT_METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6z8BXgZay';

// Line 21 (или около того - предотвращает сбой при пустой ENV):
const METADATA_PROGRAM_ID_STRING = process.env.TOKEN_METADATA_PROGRAM_ID || DEFAULT_METADATA_PROGRAM_ID;

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(METADATA_PROGRAM_ID_STRING); 

/**
 * Добавляет метаданные Metaplex для существующего токена.
 * @param {string} mintAddress - Публичный ключ минта токена.
 * @param {Object} metadataDetails - Детали метаданных (name, symbol, uri).
 * @returns {Promise<string>} Подпись транзакции.
 */
export async function addTokenMetadata(mintAddress, metadataDetails) {
    const connection = getConnection();
    const payer = getServiceWallet();
    
    console.log(`\n--- Добавление метаданных для: ${mintAddress} ---`);
    
    const mintPublicKey = new PublicKey(mintAddress);
    
    // 1. Вычисление адреса PDA метаданных
    // Используем findProgramAddressSync для совместимости с Buffer
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

    // 3. Отправка транзакции
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
