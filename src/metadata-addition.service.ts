// src/metadata-addition.service.ts

import mplTokenMetadataExports from "@metaplex-foundation/mpl-token-metadata";
console.log("Metaplex exports:", Object.keys(mplTokenMetadataExports));

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

// Импортируем PDA-функцию напрямую из подпакета!
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-token-metadata/dist/pdas';

// Остальные функции импортируем из основного пакета
import {
  createAndMint,
  TokenStandard,
  findMetadataPda,
  createMetadata,
  mplTokenMetadata
} from "@metaplex-foundation/mpl-token-metadata";

import { PublicKey as Web3JsPublicKey } from "@solana/web3.js";

// Локальные импорты - используем .js для NodeNext
import { getServiceWallet, getConnection } from './solana.service.js'; 
import { toBigInt } from './utils.js'; 

// --- Interfaces ---
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

    umi.use(defaultPlugins(connection.rpcEndpoint)); 
    umi.use(mplTokenMetadata()); 
    
    return umi;
}

/**
 * Получает UMI Keypair (Signer) из Keypair web3.js сервисного кошелька.
 * Также устанавливает его как Identity и Payer для Umi-экземпляра.
 * @returns {Signer} Umi Signer.
 */
function getUmiSigner(umi: any): Signer {
    const web3JsKeypair = getServiceWallet();
    const secretKey = Buffer.from(web3JsKeypair.secretKey);
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);

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

        const solanaConnection = getConnection();
        const web3JsPayerPublicKey = new Web3JsPublicKey(payer.publicKey.toString());
        const balance = await solanaConnection.getBalance(web3JsPayerPublicKey);

        const requiredBalance = Number(sol(0.01).basisPoints); 

        if (balance < requiredBalance) { 
            throw new Error(`Недостаточно SOL на кошельке ${payer.publicKey.toString()}. Требуется минимум 0.01 SOL.`);
        }
        
        const mint = generateSigner(umi);

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
            tokenStandard: TokenStandard.Fungible,
        }).sendAndConfirm(umi);

        const mintPublicKey = mint.publicKey.toString();
        
        // Теперь используем импортированную PDA-функцию
        const associatedTokenAccountPda = findAssociatedTokenPda(umi, {
            mint: mint.publicKey,
            owner: payer.publicKey,
        });

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
    const payer = getUmiSigner(umi);
    
    try {
        const mintPublicKey = umiPublicKey(mintAddress);

        const metadataPda = findMetadataPda(umi, {
            mint: mintPublicKey
        });

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

        return transaction.signature;

    } catch (error: any) {
        console.error("❌ UMI SDK addTokenMetadata Error:", error);
        throw new Error(`Failed to add metadata: ${error.message || error}`);
    }
}
