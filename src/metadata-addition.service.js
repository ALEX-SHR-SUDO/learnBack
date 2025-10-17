// src/metadata-addition.service.js

import { PublicKey, TransactionInstruction } from "@solana/web3.js";
// Правильный импорт CommonJS-модулей в режиме ESM
import * as metaplex from "@metaplex-foundation/mpl-token-metadata";
import { Buffer } from "buffer";

// Явное определение Metaplex Program ID, чтобы избежать проблем с импортом CJS/ESM
// Это гарантирует, что ключ метаданных всегда будет валидным объектом PublicKey.
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6z8BXgZay');

// Извлекаем необходимые функции
const { 
    createCreateMetadataAccountV3Instruction, 
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
    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress}`);
    
    // findMetadataPda использует Mint-адрес, который у нас есть (mintPublicKey), и 
    // внутренне использует Program ID метаданных. Мы полагаемся на помощник.
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
            updateAuthority: payer.publicKey,
        },
        {
            createMetadataAccountArgsV3: {
                data: {
                    name: name,
                    symbol: symbol,
                    uri: uri,
                    sellerFeeBasisPoints: 0,
                    creators: null,
                    collection: null,
                    uses: null,
                },
                isMutable: true,
                collectionDetails: null,
            },
        },
        // Передаем явно определенный Program ID (на случай, если Metaplex v3
        // в нашей среде требует его в аргументах)
        TOKEN_METADATA_PROGRAM_ID
    );

    // 3. ОТПРАВКА ТРАНЗАКЦИИ
    // Мы убрали лишний new TransactionInstruction, так как connection.sendTransaction
    // может принимать и готовые инструкции.
    try {
        const { blockhash } = await connection.getLatestBlockhash();

        const txSignature = await connection.sendTransaction(
            new (await import('@solana/web3.js')).Transaction({
                recentBlockhash: blockhash,
                feePayer: payer.publicKey,
            }).add(instruction),
            [payer], // Подписывается только плательщик
            { 
                skipPreflight: false,
                preflightCommitment: "confirmed"
            }
        );

        console.log(`✅ [ШАГ 4] Метаданные токена созданы. Подпись: ${txSignature}`);
        return txSignature;
    } catch (error) {
        console.error("❌ Ошибка при добавлении метаданных токена:", error);
        throw new Error("Ошибка при добавлении метаданных токена: " + error.message);
    }
}
