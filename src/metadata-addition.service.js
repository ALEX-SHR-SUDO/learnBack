// src/metadata-addition.service.js

import { PublicKey, TransactionInstruction } from "@solana/web3.js";
// Правильный импорт CommonJS-модулей в режиме ESM: импортируем все как 'metaplex'
import * as metaplex from "@metaplex-foundation/mpl-token-metadata";
import { Buffer } from "buffer";

// Извлекаем функции и константы из импортированного объекта metaplex
const { 
    createCreateMetadataAccountV3Instruction, 
    PROGRAM_ID: METADATA_PROGRAM_ID, 
    findMetadataPda 
} = metaplex;

/**
 * Добавляет метаданные Metaplex (имя, символ, URI) к существующему Mint-аккаунту токена.
 * * @param {import('@solana/web3.js').Connection} connection Соединение с Solana.
 * @param {import('@solana/web3.js').Keypair} payer Кошелек, оплачивающий транзакцию и являющийся Mint Authority.
 * @param {string} mintAddress Адрес Mint-аккаунта токена.
 * @param {string} name Название токена.
 * @param {string} symbol Символ токена.
 * @param {string} uri Ссылка на JSON-файл метаданных.
 * @returns {Promise<string>} Подпись транзакции.
 */
export async function addTokenMetadata(connection, payer, mintAddress, name, symbol, uri) {
    const mintPublicKey = new PublicKey(mintAddress);
    
    // 1. ВЫЧИСЛЕНИЕ АДРЕСА PDA МЕТАДАННЫХ
    // Используем Metaplex Helper, который обходит внутренние проблемы web3.js/Buffer, 
    // что было нашим изначальным предположением
    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress}`);
    
    // findMetadataPda: [ 'metadata', METADATA_PROGRAM_ID, mint.publicKey ]
    const [metadataAddress] = findMetadataPda({
        mint: mintPublicKey,
    });

    console.log(`[ШАГ 4] Адрес PDA метаданных успешно вычислен: ${metadataAddress.toBase58()}`);

    // 2. ФОРМИРОВАНИЕ ИНСТРУКЦИИ
    const instruction = createCreateMetadataAccountV3Instruction(
        {
            metadata: metadataAddress,
            mint: mintPublicKey,
            mintAuthority: payer.publicKey,
            payer: payer.publicKey,
            updateAuthority: payer.publicKey, // Используем плательщика в качестве Update Authority
        },
        {
            createMetadataAccountArgsV3: {
                data: {
                    name: name,
                    symbol: symbol,
                    uri: uri,
                    sellerFeeBasisPoints: 0, // Устанавливаем 0, так как это не NFT
                    creators: null,
                    collection: null,
                    uses: null,
                },
                isMutable: true,
                collectionDetails: null,
            },
        }
    );

    // 3. ОТПРАВКА ТРАНЗАКЦИИ
    const transaction = await connection.getLatestBlockhash();
    
    // При создании транзакции с одной инструкцией безопаснее использовать массив инструкций
    // или создать новую транзакцию, используя .add
    const tx = await connection.sendTransaction(
        new TransactionInstruction({
            keys: instruction.keys,
            programId: instruction.programId,
            data: instruction.data,
        }),
        [payer], // Подписывается только плательщик
        { 
            skipPreflight: false,
            preflightCommitment: "confirmed"
        }
    );

    try {
        console.log(`✅ [ШАГ 4] Метаданные токена созданы. Подпись: ${tx}`);
        return tx;
    } catch (error) {
        console.error("❌ Ошибка при добавлении метаданных токена:", error);
        throw new Error("Ошибка при добавлении метаданных токена: " + error.message);
    }
}
