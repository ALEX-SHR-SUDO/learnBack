// src/metadata-addition.service.js

// Добавляем 'Transaction' для более чистого создания транзакций
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js"; 
// Правильный импорт CommonJS-модулей в режиме ESM
import * as metaplex from "@metaplex-foundation/mpl-token-metadata";
import { Buffer } from "buffer";

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
    
    // Временно определяем Program ID внутри функции, чтобы избежать ошибки 
    // "Invalid public key input" при инициализации модуля в Node.js 22.x/ESM.
    const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6z8BXgZay');

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
        // Передаем явно определенный Program ID
        TOKEN_METADATA_PROGRAM_ID
    );

    // 3. ОТПРАВКА ТРАНЗАКЦИИ
    try {
        const { blockhash } = await connection.getLatestBlockhash();

        // Используем статически импортированный Transaction.
        const txSignature = await connection.sendTransaction(
            new Transaction({ 
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
