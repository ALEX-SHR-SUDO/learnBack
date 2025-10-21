// src/metadata-addition.service.js
//
// Использует Metaplex Umi SDK для создания токенов и метаданных.
// Umi SDK является современным и рекомендуемым решением.

// --- ИМПОРТ UMI И PLUGINS ---
import { createUmi } from "@metaplex-foundation/umi";
import { web3JsEddsa, web3JsPublicKey, web3JsKeypair } from "@metaplex-foundation/umi-bundle-defaults";
import { findAssociatedTokenPda, createAndMint, updateV1, createV1 } from "@metaplex-foundation/mpl-token-metadata";
import { Umi } from "@metaplex-foundation/umi";

// --- ИМПОРТ SOLANA SERVICE ---
import { getConnection, getServiceWallet } from "./solana.service.js";
import { toBigInt } from "./utils.js";
import { PublicKey } from "@solana/web3.js";

// ==========================================================
// --- UMI ИНИЦИАЛИЗАЦИЯ ---
// ==========================================================

/**
 * Инициализирует и настраивает Umi-инстанс.
 * @returns {Umi} Настроенный Umi-инстанс.
 */
function getUmiInstance() {
    // Получаем текущее соединение (Connection)
    const connection = getConnection();
    if (!connection) {
        throw new Error("Solana connection is not established.");
    }
    
    // Получаем Keypair
    const payerKeypair = getServiceWallet();

    // 1. Инициализация Umi с URL кластера (взято из Connection)
    const umi = createUmi(connection.rpcEndpoint)
        // 2. Применение бандла по умолчанию (включает web3.js/spl-token)
        .use(web3JsEddsa())
        .use(web3JsPublicKey())
        .use(web3JsKeypair());
        
    // 3. Установка Keypair для оплаты транзакций
    umi.use(web3JsKeypair(payerKeypair));
    
    return umi;
}

// ==========================================================
// --- ЭКСПОРТИРУЕМАЯ ЛОГИКА (ОБЪЕДИНЕННЫЙ СЕРВИС) ---
// ==========================================================

/**
 * [ОБЪЕДИНЕННЫЙ СЕРВИС] Создает Mint токена, Mint Authority, Account, 
 * чеканит supply и прикрепляет метаданные Metaplex (все за 1-2 транзакции).
 * @param {Object} tokenDetails - Детали токена (name, symbol, uri, supply, decimals).
 * @returns {Promise<Object>} Mint Address, ATA, и транзакция метаданных.
 */
export async function createTokenAndMetadata(tokenDetails) {
    const umi = getUmiInstance();
    const payerPublicKey = umi.payer.publicKey;
    
    const { name, symbol, uri, supply, decimals } = tokenDetails;

    // Преобразуем строковое количество в BigInt в наименьших единицах
    const initialSupply = toBigInt(supply, parseInt(decimals, 10));

    try {
        console.log(`Umi: Начинаем создание токена ${symbol} с запасом ${supply}.`);

        // Используем Umi createV1 для создания токена, чеканки и метаданных.
        const { mint, associatedToken } = await createV1(umi, {
            // Права
            payer: umi.payer,
            authority: umi.payer.publicKey, // Update Authority
            
            // Токен
            mint: umi.eddsa.generateKeypair(), // Генерируем новый Mint Address
            decimals: parseInt(decimals, 10),
            tokenStandard: 0, // Fungible

            // Метаданные
            name: name,
            symbol: symbol,
            uri: uri,
            
            // Начальная чеканка (Mint to associatedToken)
            amount: initialSupply,
            associatedToken: findAssociatedTokenPda(umi, {
                mint: umi.keys.publicKey(umi.publicKey), 
                owner: umi.publicKey,
            }),
            
            // Другие параметры
            isMutable: true,
            sellerFeeBasisPoints: 0,
            
        }).sendAndConfirm(umi);


        console.log(`✅ Umi: Токен создан. Mint: ${umi.publicKeys.toString(mint)}`);
        
        return {
            mintAddress: umi.publicKeys.toString(mint),
            ata: umi.publicKeys.toString(associatedToken),
            metadataTx: "Handled by createV1 transaction",
        };

    } catch (error) {
        console.error("❌ Umi Create Token Error:", error);
        // Добавление логов Umi для лучшей отладки
        if (error.logs) {
            console.error("Umi Simulation Logs:", error.logs);
        }
        throw new Error(`Ошибка при создании токена через Umi: ${error.message}`);
    }
}


/**
 * Добавляет или обновляет метаданные к СУЩЕСТВУЮЩЕМУ токену (UpdateV1).
 * @param {string} mintAddress - Mint Address существующего токена.
 * @param {Object} details - name, symbol, uri.
 * @returns {Promise<string>} - Подпись транзакции.
 */
export async function addTokenMetadata(mintAddress, details) {
    const umi = getUmiInstance();
    
    // Преобразование строкового Mint Address в Umi PublicKey
    const mint = umi.publicKeys.publicKey(mintAddress);

    try {
        console.log(`Umi: Обновляем метаданные для токена: ${mintAddress}`);

        // Используем updateV1 для обновления метаданных существующего токена
        const signature = await updateV1(umi, {
            mint: mint,
            authority: umi.payer,
            data: {
                name: details.name,
                symbol: details.symbol,
                uri: details.uri,
                sellerFeeBasisPoints: 0, // Оставляем 0 для Fungible
                creators: umi.options.creators, // Передача креаторов, если они нужны
                collection: umi.options.collection,
                uses: umi.options.uses,
            },
            // Заметка: Update Authority - это Keypair, установленный в getUmiInstance().
        }).sendAndConfirm(umi);

        const txSignature = umi.transactions.toString(signature);
        
        console.log(`✅ Umi: Метаданные успешно обновлены. Tx: ${txSignature}`);
        return txSignature;

    } catch (error) {
        console.error("❌ Umi Add Metadata Error:", error);
        if (error.logs) {
            console.error("Umi Simulation Logs:", error.logs);
        }
        throw new Error(`Ошибка при добавлении метаданных через Umi: ${error.message}`);
    }
}
