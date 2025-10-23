// src/metadata-addition.service.ts


import { 
    createUmi, 
    publicKey as umiPublicKey, 
    keypairIdentity, 
    generateSigner, 
    sol,
    Signer,
    Keypair as UmiKeypair, 
    TransactionSignature,
    percentAmount,
} from "@metaplex-foundation/umi";

import { defaultPlugins } from "@metaplex-foundation/umi-bundle-defaults";

// Импорт Metaplex-функций
import mplTokenMetadataExports from "@metaplex-foundation/mpl-token-metadata";
const { 
    createAndMint, 
    TokenStandard, 
    findMetadataPda, 
    createMetadata,
    mplTokenMetadata 
} = mplTokenMetadataExports;

import { PublicKey as Web3JsPublicKey, PublicKey } from "@solana/web3.js";

// Локальные импорты
import { getServiceWallet, getConnection } from './solana.service.js'; 
import { toBigInt } from './utils.js'; 

// --- Utility: ручная функция PDA для Associated Token Account (ATA) ---
function findAssociatedTokenPda(_umi: any, { mint, owner }: { mint: any, owner: any }): [PublicKey] {
    // SPL Token Program ID
    const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    // Associated Token Program ID
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvRkZbJwTtT9pR9rMwvGmXbGmJ7Q1rGk7iCz");

    // В UMI publicKey.toString() возвращает base58, поэтому PublicKey(mint.toString())
    const mintKey = new PublicKey(mint.toString());
    const ownerKey = new PublicKey(owner.toString());

    const [address] = PublicKey.findProgramAddressSync(
        [
            ownerKey.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mintKey.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return [address];
}

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
function initializeUmi(): any {
    const connection = getConnection();
    const umi = createUmi();
    umi.use(defaultPlugins(connection.rpcEndpoint)); 
    umi.use(mplTokenMetadata()); 
    return umi;
}

function getUmiSigner(umi: any): Signer {
    const web3JsKeypair = getServiceWallet();
    const secretKey = Buffer.from(web3JsKeypair.secretKey);
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    umi.use(keypairIdentity(umiKeypair));
    return umiKeypair;
}

// --- API FUNCTIONS ---

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
            authority: payer,
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
        
        // Используем ручную PDA-функцию!
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
