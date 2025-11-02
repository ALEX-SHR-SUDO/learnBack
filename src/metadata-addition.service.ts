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

// Import the functions we need from mpl-token-metadata
// Type assertion needed due to TypeScript ESM/CommonJS interop limitations
const createV1 = (mplTokenMetadataExports as any).createV1;
const mintV1 = (mplTokenMetadataExports as any).mintV1;
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

// --- Create SPL token with proper Metaplex metadata for Solscan visibility ---
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

        console.log(`🔨 Creating SPL token with mint address: ${mint.publicKey.toString()}`);

        // Step 1: Create the token mint with metadata account
        // Using createV1 instead of createAndMint to properly create metadata for standard SPL tokens
        // This ensures metadata will be visible on Solscan and other explorers
        const createResult = await createV1(umi, {
            mint,
            authority: payer,
            name: details.name,
            symbol: details.symbol,
            uri: details.uri,
            sellerFeeBasisPoints: percentAmount(0),
            decimals: decimalsNumber,
            tokenStandard: TokenStandard.Fungible,
            // Set isMutable to allow future metadata updates if needed
            isMutable: true,
            // Update authority can be set to the payer or a specific address
            updateAuthority: payer.publicKey,
        }).sendAndConfirm(umi);

        console.log(`✅ Token mint and metadata created: ${mint.publicKey.toString()}`);
        console.log(`📝 Create transaction signature: ${createResult.signature}`);

        // Step 2: Calculate the associated token account address before minting
        const associatedTokenAccountPda = findAssociatedTokenPda(umi, {
            mint: mint.publicKey,
            owner: payer.publicKey,
        });

        // Step 3: Mint the initial supply to the payer's associated token account
        const mintResult = await mintV1(umi, {
            mint: mint.publicKey,
            authority: payer,
            amount: supplyBigInt,
            token: umiPublicKey(associatedTokenAccountPda[0].toString()),
            tokenOwner: payer.publicKey,
            tokenStandard: TokenStandard.Fungible,
        }).sendAndConfirm(umi);

        console.log(`✅ Tokens minted to ATA. Mint transaction signature: ${mintResult.signature}`);

        const mintPublicKey = mint.publicKey.toString();

        return {
            mintAddress: mintPublicKey,
            ata: associatedTokenAccountPda[0].toString(),
            mintTx: createResult.signature
        };

    } catch (error: any) {
        console.error("❌ UMI SDK createTokenAndMetadata Error:", error);
        throw new Error(`Failed to create token and metadata: ${error.message || error}`);
    }
}
