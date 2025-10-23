// src/metadata-addition.service.ts

import { 
    createUmi, 
    publicKey as umiPublicKey, 
    keypairIdentity, 
    generateSigner, 
    sol, // Используется для безопасного сравнения SOL-сумм
    Signer,
    Keypair as UmiKeypair, 
    TransactionSignature, // Используем тип UMI для подписи
    percentAmount, // Используем для установки процентов
} from "@metaplex-foundation/umi";

import { defaultPlugins } from "@metaplex-foundation/umi-bundle-defaults";

// Импортируем Metaplex Token Metadata через импорт по умолчанию (как рекомендуется для CJS модулей в ESM).
import mplTokenMetadataExports from "@metaplex-foundation/mpl-token-metadata";

// Импортируем findAssociatedTokenPda из mpl-essentials (или другой актуальной точки, если твоя версия другая)
import { findAssociatedTokenPda } from "@metaplex-foundation/mpl-token-metadata";
// Если используешь другую версию, возможно нужно:
// import { findAssociatedTokenPda } from "@metaplex-foundation/mpl-token-metadata/dist/pdas";

const { 
    createAndMint, 
    TokenStandard, 
    findMetadataPda, 
    createMetadata,
    mplTokenMetadata 
} = mplTokenMetadataExports;

import { PublicKey as Web3JsPublicKey } from "@solana/web3.js";

// Локальные импорты - КРИТИЧЕСКИ ВАЖНО: используем .js для NodeNext
import { getServiceWallet, getConnection } from './solana.service.js'; 
import { toBigInt } from './utils.js'; 

// --- Interfaces (Рекомендуется для TS) ---
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

// --- UTILITY ---
/**
 * Создает и настраивает UMI-экземпляр с необходимыми плагинами.
 * @returns {any} Настроенный UMI-экземпляр.
 */
function initializeUmi(): any {
    const connection = getConnection();
    
    const umi = createUmi();

    // defaultPlugins теперь принимает RPC endpoint
    umi.use(defaultPlugins(connection.rpcEndpoint)); 
    
    // ВАЖНО: Применяем плагин Metaplex Token Metadata.
    umi.use(mplTokenMetadata()); 
    
    return umi;
}

/**
 * Получает UMI Keypair (Signer) из Keypair web3.js сервисного кошелька.
 * Также устанавливает его как Identity и Payer для Umi-экземпляра.
 * @returns {Signer} Umi Signer.
 */
function getUmiSigner(umi: any): Signer {
    // ВНИМАНИЕ: Предполагается, что './solana.service.js' экспортирует функцию getServiceWallet(),
    // которая возвращает Keypair из '@solana/web3.js'.
    const web3JsKeypair = getServiceWallet(); // Получаем Web3JsKeypair
    
    // Конвертируем Web3.js Keypair (Uint8Array) в Umi Keypair
    const secretKey = Buffer.from(web3JsKeypair.secretKey);
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);

    // Устанавливаем его как Identity и Payer глобально на UMI-экземпляре
    umi.use(keypairIdentity(umiKeypair));
    
    return umiKeypair;
}


// --- API FUNCTIONS ---

/**
 * Создает новый токен, чеканит его на сервисный кошелек и добавляет метаданные.
 * @param {TokenDetails} details - Детали токена (имя, символ, URI, саплай, десятичные знаки).
 * @returns {Promise<{ mintAddress: string, ata: string, metadataTx: TransactionSignature }>} 
 */
export async function createTokenAndMetadata(details: TokenDetails): Promise<{ mintAddress: string, ata: string, metadataTx: TransactionSignature }> {
    const umi = initializeUmi();
    const payer = getUmiSigner(umi); 

    try {
        const supplyBigInt = toBigInt(details.supply, parseInt(details.decimals, 10));
        const decimalsNumber = parseInt(details.decimals, 10);

        // Проверяем баланс для оплаты комиссий.
        const solanaConnection = getConnection();
        
        // Конвертируем UMI.PublicKey в Web3Js.PublicKey для getBalance
        const web3JsPayerPublicKey = new Web3JsPublicKey(payer.publicKey.toString());
        const balance = await solanaConnection.getBalance(web3JsPayerPublicKey);

        // sol().basisPoints возвращает BigInt. Конвертируем в Number для сравнения с балансом
        const requiredBalance = Number(sol(0.01).basisPoints); 

        if (balance < requiredBalance) { 
            throw new Error(`Недостаточно SOL на кошельке ${payer.publicKey.toString()}. Требуется минимум 0.01 SOL.`);
        }
        
        const mint = generateSigner(umi); 

        // Используем Metaplex's simplified `createAndMint`
        const transaction = await createAndMint(umi, {
            mint,
            authority: payer, // Mint и Freeze authority
            payer: payer,
            name: details.name,
            symbol: details.symbol,
            uri: details.uri,
            sellerFeeBasisPoints: percentAmount(0), 
            isMutable: true,
            decimals: decimalsNumber,
            amount: supplyBigInt,
            tokenOwner: payer.publicKey,
            // Указываем, что это Fungible токен
            tokenStandard: TokenStandard.Fungible,
        }).sendAndConfirm(umi);

        // Используем standard toString()
        const mintPublicKey = mint.publicKey.toString();
        
        // Используем findAssociatedTokenPda из актуального импорта
        const associatedTokenAccountPda = findAssociatedTokenPda(umi, {
            mint: mint.publicKey,
            owner: payer.publicKey,
        });

        // transaction.signature теперь имеет тип TransactionSignature, который мы возвращаем
        return {
            mintAddress: mintPublicKey,
            ata: associatedTokenAccountPda[0].toString(), 
            metadataTx: transaction.signature, 
        };

    } catch (error: any) {
        console.error("❌ UMI SDK createTokenAndMetadata Error:", error);
        throw new Error(`Failed to create token and metadata: ${error.message || error}`);
    }
}


/**
 * Добавляет метаданные к уже существующему токену.
 * @param {string} mintAddress - Публичный ключ Mint-аккаунта токена.
 * @param {MetadataDetails} details - Детали метаданных (имя, символ, URI).
 * @returns {Promise<TransactionSignature>} - Подпись транзакции.
 */
export async function addTokenMetadata(mintAddress: string, details: MetadataDetails): Promise<TransactionSignature> {
    const umi = initializeUmi();
    const payer = getUmiSigner(umi); // Устанавливает Identity/Payer
    
    try {
        const mintPublicKey = umiPublicKey(mintAddress);

        // Используем findMetadataPda (теперь импортирован напрямую)
        const metadataPda = findMetadataPda(umi, {
            mint: mintPublicKey
        });

        // Используем createMetadata (теперь импортирован напрямую)
        const transaction = await createMetadata(umi, {
            metadata: metadataPda,
            mint: mintPublicKey,
            updateAuthority: payer,
            data: {
                name: details.name,
                symbol: details.symbol,
                uri: details.uri,
                sellerFeeBasisPoints: percentAmount(0), 
                creators: null,
                collection: null,
                uses: null,
            },
            isMutable: true,
            collectionDetails: null,
            tokenStandard: TokenStandard.Fungible,
        }).sendAndConfirm(umi);

        // Возвращаем подпись напрямую
        return transaction.signature;

    } catch (error: any) {
        console.error("❌ UMI SDK addTokenMetadata Error:", error);
        throw new Error(`Failed to add metadata: ${error.message || error}`);
    }
}
