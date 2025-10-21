// src/metadata-addition.service.ts

// --- ИМПОРТ UMI И PLUGINS ---
import { createUmi, Umi, PublicKey as UmiPublicKey } from "@metaplex-foundation/umi";
import { web3JsEddsa, web3JsPublicKey, web3JsKeypair } from "@metaplex-foundation/umi-bundle-defaults";
import { 
    findAssociatedTokenPda, 
    createV1, 
    updateV1,
    TokenStandard,
    mplTokenMetadata
} from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner } from "@metaplex-foundation/umi";


// --- ИМПОРТ SOLANA SERVICE и UTILS ---
import { getConnection, getServiceWallet } from "./solana.service";
import { toBigInt } from "./utils";


// ==========================================================
// --- ТИПЫ ДЛЯ КОНТРОЛЛЕРА ---
// ==========================================================

interface TokenDetails {
    name: string;
    symbol: string;
    uri: string;
    supply: string;
    decimals: string;
}

interface MetadataDetails {
    name: string;
    symbol: string;
    uri: string;
}

// ==========================================================
// --- UMI ИНИЦИАЛИЗАЦИЯ ---
// ==========================================================

/**
 * Инициализирует и настраивает Umi-инстанс.
 * @returns Настроенный Umi-инстанс.
 */
function getUmiInstance(): Umi {
    // Получаем текущее соединение (Connection)
    const connection = getConnection();
    if (!connection) {
        throw new Error("Solana connection is not established.");
    }
    
    // Получаем Keypair для оплаты транзакций
    const payerKeypair = getServiceWallet();

    // 1. Инициализация Umi с URL кластера (взято из Connection)
    const umi = createUmi(connection.rpcEndpoint)
        // 2. Применение бандла по умолчанию (web3.js adapters)
        .use(web3JsEddsa())
        .use(web3JsPublicKey())
        .use(web3JsKeypair())
        // 3. Плагин для Token Metadata
        .use(mplTokenMetadata());
        
    // 4. Установка Keypair для оплаты транзакций
    umi.use(web3JsKeypair(payerKeypair, true)); // true = make it the payer
    
    return umi;
}

// ==========================================================
// --- ЭКСПОРТИРУЕМАЯ ЛОГИКА (ОБЪЕДИНЕННЫЙ СЕРВИС) ---
// ==========================================================

/**
 * [ОБЪЕДИНЕННЫЙ СЕРВИС] Создает Mint токена, чеканит supply и прикрепляет метаданные Metaplex.
 * @param tokenDetails - Детали токена (name, symbol, uri, supply, decimals).
 * @returns Promise<Object> Mint Address, ATA, и подпись транзакции.
 */
export async function createTokenAndMetadata(tokenDetails: TokenDetails) {
    const umi = getUmiInstance();
    
    const { name, symbol, uri, supply, decimals } = tokenDetails;

    const decimalCount = parseInt(decimals, 10);

    // Преобразуем строковое количество в BigInt в наименьших единицах
    const initialSupply = toBigInt(supply, decimalCount);

    try {
        console.log(`Umi: Начинаем создание токена ${symbol} с запасом ${supply}.`);

        // Генерируем новый Mint Address
        const mintSigner = generateSigner(umi);

        // Расчет ATA для сервисного кошелька (он же получатель, Mint Authority и Freeze Authority)
        const associatedTokenAddress = findAssociatedTokenPda(umi, {
            mint: mintSigner.publicKey, 
            owner: umi.payer.publicKey,
        });

        // Используем Umi createV1 для создания токена, чеканки и метаданных.
        const result = await createV1(umi, {
            // Права и участники
            payer: umi.payer,
            mint: mintSigner, // Новый Mint Address
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

        // Подпись транзакции
        const metadataTx = umi.transactions.toString(result.signature);

        console.log(`✅ Umi: Токен создан. Mint: ${umi.publicKeys.toString(mintSigner.publicKey)}`);
        
        return {
            mintAddress: umi.publicKeys.toString(mintSigner.publicKey),
            ata: umi.publicKeys.toString(associatedTokenAddress),
            metadataTx: metadataTx,
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
 * @param mintAddress - Mint Address существующего токена.
 * @param details - name, symbol, uri.
 * @returns Promise<string> - Подпись транзакции.
 */
export async function addTokenMetadata(mintAddress: string, details: MetadataDetails) {
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
                // Опционально: можно добавить creators, collection и т.д.
            },
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
