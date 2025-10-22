// src/metadata-addition.service.ts
//
// Использует Metaplex Umi SDK для создания токенов и метаданных.
// Umi SDK является современным и рекомендуемым решением.
// --- ИМПОРТ UMI И PLUGINS ---
// --- ИМПОРТ UMI И PLUGINS ---
import { createUmi } from "@metaplex-foundation/umi";
// ✅ ИСПРАВЛЕНИЕ TS: Заменен деструктурирующий импорт на импорт со звездочкой, 
// чтобы обойти ошибку с неэкспортируемыми членами в пакете umi-bundle-defaults.
import * as UmiAdapters from "@metaplex-foundation/umi-bundle-defaults";
import { findAssociatedTokenPda, createV1, updateV1, TokenStandard, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner } from "@metaplex-foundation/umi";
// --- ИМПОРТ SOLANA SERVICE и UTILS ---
import { getConnection, getServiceWallet } from "./solana.service";
import { toBigInt } from "./utils";
// ==========================================================
// --- UMI ИНИЦИАЛИЗАЦИЯ ---
// ==========================================================
/**
 * Инициализирует и настраивает Umi-инстанс.
 * @returns Настроенный Umi-инстанс.
 */
function getUmiInstance() {
    const connection = getConnection();
    if (!connection) {
        throw new Error("Solana connection is not established.");
    }
    // Получаем Keypair для оплаты транзакций
    const payerKeypair = getServiceWallet();
    // 1. Инициализация Umi с URL кластера
    const umi = createUmi(connection.rpcEndpoint)
        // 2. Применение бандла по умолчанию (web3.js adapters)
        // ✅ ИСПРАВЛЕНО: Используем методы через алиас UmiAdapters
        .use(UmiAdapters.web3JsEddsa())
        .use(UmiAdapters.web3JsPublicKey())
        .use(UmiAdapters.web3JsKeypair())
        // 3. Плагин для Token Metadata
        .use(mplTokenMetadata());
    // 4. Установка Keypair для оплаты транзакций
    // ✅ ИСПРАВЛЕНО: Передаем ключпару из service.ts
    umi.use(UmiAdapters.web3JsKeypair(payerKeypair, true)); // true = make it the payer and signer
    return umi;
}
// ==========================================================
// --- ЭКСПОРТИРУЕМАЯ ЛОГИКА ---
// ==========================================================
/**
 * Создает Mint токена, чеканит supply и прикрепляет метаданные Metaplex.
 * @param tokenDetails - Детали токена (name, symbol, uri, supply, decimals).
 * @returns Promise<Object> Mint Address, ATA, и подпись транзакции.
 */
export async function createTokenAndMetadata(tokenDetails) {
    const umi = getUmiInstance();
    const { name, symbol, uri, supply, decimals } = tokenDetails;
    const decimalCount = parseInt(decimals, 10);
    const initialSupply = toBigInt(supply, decimalCount);
    try {
        console.log(`Umi: Начинаем создание токена ${symbol} с запасом ${supply}.`);
        // Генерируем новый Mint Address
        const mintSigner = generateSigner(umi);
        // Расчет ATA для сервисного кошелька (он же получатель)
        const associatedTokenAddress = findAssociatedTokenPda(umi, {
            mint: mintSigner.publicKey,
            owner: umi.payer.publicKey,
        });
        // Используем Umi createV1 для создания токена, чеканки и метаданных.
        const result = await createV1(umi, {
            // Права и участники
            payer: umi.payer,
            mint: mintSigner, // Новый Mint Address (Signer)
            authority: umi.payer.publicKey, // Mint Authority
            updateAuthority: umi.payer, // Update Authority (Signer)
            // Токен
            decimals: decimalCount,
            tokenStandard: TokenStandard.Fungible,
            // Метаданные
            name: name,
            symbol: symbol,
            uri: uri,
            // Начальная чеканка (Mint to associatedToken)
            amount: initialSupply,
            destination: associatedTokenAddress,
            // Дополнительные параметры
            isMutable: true,
            sellerFeeBasisPoints: 0,
        }).sendAndConfirm(umi);
        const metadataTx = umi.transactions.toString(result.signature);
        console.log(`✅ Umi: Токен создан. Mint: ${umi.publicKeys.toString(mintSigner.publicKey)}`);
        return {
            mintAddress: umi.publicKeys.toString(mintSigner.publicKey),
            ata: umi.publicKeys.toString(associatedTokenAddress),
            metadataTx: metadataTx,
        };
    }
    catch (error) {
        console.error("❌ Umi Create Token Error:", error);
        if (error.logs) {
            console.error("Umi Simulation Logs:", error.logs);
        }
        throw new Error(`Ошибка при создании токена через Umi: ${error.message}`);
    }
}
/**
 * Добавляет или обновляет метаданные к СУЩЕСТВУЮЩЕМУ токену (UpdateV1).
 * @param mintAddress - Mint Address существующего токена.
 * @param details - name, symbol, uri.
 * @returns Promise<string> - Подпись транзакции.
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
            authority: umi.payer, // Update Authority - это Keypair, установленный в getUmiInstance().
            data: {
                name: details.name,
                symbol: details.symbol,
                uri: details.uri,
                sellerFeeBasisPoints: 0,
            },
        }).sendAndConfirm(umi);
        const txSignature = umi.transactions.toString(signature);
        console.log(`✅ Umi: Метаданные успешно обновлены. Tx: ${txSignature}`);
        return txSignature;
    }
    catch (error) {
        console.error("❌ Umi Add Metadata Error:", error);
        if (error.logs) {
            console.error("Umi Simulation Logs:", error.logs);
        }
        throw new Error(`Ошибка при добавлении метаданных через Umi: ${error.message}`);
    }
}
