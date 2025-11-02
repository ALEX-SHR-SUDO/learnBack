// src/metadata-addition.service.ts

import { Buffer } from "buffer";
// Using default import with type assertions for proper CommonJS interop
import mplTokenMetadataExports from "@metaplex-foundation/mpl-token-metadata";
import { 
    createUmi, 
    publicKey as umiPublicKey, 
    keypairIdentity, 
    generateSigner, 
    sol,
    Signer,
    TransactionSignature,
    percentAmount,
} from "@metaplex-foundation/umi";

import { defaultPlugins } from "@metaplex-foundation/umi-bundle-defaults";

// Используем createAndMint для SPL токенов (объединяет создание и минтинг в одной транзакции)
// Type assertion needed due to TypeScript ESM/CommonJS interop limitations
const createAndMint = (mplTokenMetadataExports as any).createAndMint;
const TokenStandard = (mplTokenMetadataExports as any).TokenStandard;
const mplTokenMetadata = (mplTokenMetadataExports as any).mplTokenMetadata;

import { PublicKey as Web3JsPublicKey, PublicKey } from "@solana/web3.js";
import { getServiceWallet, getConnection } from './solana.service.js'; 
import { toBigInt } from './utils.js'; 

function findAssociatedTokenPda(_umi: any, { mint, owner }: { mint: any, owner: any }): [PublicKey] {
    const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvRkZbJwTtT9pR9rMwvGmXbGmJ7Q1rGk7iCz");
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

interface TokenDetails {
    name: string;
    symbol: string;
    uri: string;
    supply: string;
    decimals: string;
}

function initializeUmi(): any {
    const connection = getConnection();
    const umi = createUmi();
    umi.use(defaultPlugins(connection.rpcEndpoint)); 
    umi.use(mplTokenMetadata()); 
    return umi;
}

function getUmiSigner(umi: any): Signer {
    const web3JsKeypair = getServiceWallet();
    const secretKey = new Uint8Array(web3JsKeypair.secretKey);
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    umi.use(keypairIdentity(umiKeypair));
    return umiKeypair;
}

// --- Используем createAndMint для правильного создания SPL токена ---
export async function createTokenAndMetadata(details: TokenDetails): Promise<{ mintAddress: string, ata: string, mintTx: TransactionSignature }> {
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

        // Используем createAndMint для атомарного создания токена с метаданными и минтинга
        // Это решает проблему "Incorrect account owner" которая возникает при разделении операций
        const result = await createAndMint(umi, {
            mint,
            authority: payer,
            name: details.name,
            symbol: details.symbol,
            uri: details.uri,
            sellerFeeBasisPoints: percentAmount(0), 
            decimals: decimalsNumber,
            amount: supplyBigInt,
            tokenOwner: payer.publicKey,
            tokenStandard: TokenStandard.Fungible,
        }).sendAndConfirm(umi);

        console.log(`✅ SPL токен создан и заминчен: ${mint.publicKey.toString()}`);

        const mintPublicKey = mint.publicKey.toString();
        const associatedTokenAccountPda = findAssociatedTokenPda(umi, {
            mint: mint.publicKey,
            owner: payer.publicKey,
        });

        return {
            mintAddress: mintPublicKey,
            ata: associatedTokenAccountPda[0].toString(), 
            mintTx: result.signature
        };

    } catch (error: any) {
        console.error("❌ UMI SDK createTokenAndMetadata Error:", error);
        throw new Error(`Failed to create token and metadata: ${error.message || error}`);
    }
}
