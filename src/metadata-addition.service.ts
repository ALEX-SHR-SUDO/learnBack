// src/metadata-addition.service.ts

// Import proper named exports from mpl-token-metadata
import { 
    createAndMint,
    TokenStandard,
    mplTokenMetadata
} from "@metaplex-foundation/mpl-token-metadata";
import { 
    keypairIdentity, 
    generateSigner, 
    sol,
    Signer,
    TransactionSignature,
    percentAmount,
    publicKey as umiPublicKey,
    some,
} from "@metaplex-foundation/umi";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

import { PublicKey as Web3JsPublicKey, PublicKey } from "@solana/web3.js";
import { getServiceWallet, getConnection } from './solana.service.js'; 
import { toBigInt } from './utils.js';
import { formatSignature, solanaTxUrl, solscanTokenUrl } from './utils/solana-signature.js'; 
import * as flowTracker from './metadata-flow-tracker.js'; 

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
    recipientWallet?: string; // Optional: if provided, tokens will be minted to this wallet
}

function initializeUmi(): any {
    const connection = getConnection();
    const umi = createUmi(connection.rpcEndpoint); 
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
export async function createTokenAndMetadata(details: TokenDetails, sessionId?: string): Promise<{ mintAddress: string, ata: string, mintTx: TransactionSignature }> {
    const umi = initializeUmi();
    const payer = getUmiSigner(umi); 
    try {
        const supplyBigInt = toBigInt(details.supply, Number.parseInt(details.decimals, 10));
        const decimalsNumber = Number.parseInt(details.decimals, 10);

        const solanaConnection = getConnection();
        const web3JsPayerPublicKey = new Web3JsPublicKey(payer.publicKey.toString());
        const balance = await solanaConnection.getBalance(web3JsPayerPublicKey);

        const requiredBalance = Number(sol(0.01).basisPoints); 
        if (balance < requiredBalance) { 
            throw new Error(`Недостаточно SOL на кошельке ${payer.publicKey.toString()}. Требуется минимум 0.01 SOL.`);
        }
        
        const mint = generateSigner(umi);

        // Determine the token owner (who receives the tokens)
        // If recipientWallet is provided, tokens go to that wallet, otherwise to the service wallet
        const tokenOwnerAddress = details.recipientWallet || payer.publicKey.toString();
        
        // Validate the recipient wallet address (defensive programming)
        if (details.recipientWallet) {
            try {
                new PublicKey(details.recipientWallet);
            } catch (error) {
                throw new Error(`Invalid recipientWallet address: ${details.recipientWallet}. Must be a valid Solana public key.`);
            }
        }
        
        const tokenOwnerPubkey = umiPublicKey(tokenOwnerAddress);

        console.log(`🔨 Creating SPL token with mint address: ${mint.publicKey.toString()}`);
        console.log(`📊 Token parameters:`, {
            name: details.name,
            symbol: details.symbol,
            uri: details.uri,
            decimals: decimalsNumber,
            supply: supplyBigInt.toString(),
            tokenStandard: 'Fungible',
            tokenOwner: tokenOwnerAddress,
            payer: payer.publicKey.toString()
        });
        
        if (sessionId) {
            flowTracker.addFlowStep(sessionId, 'Starting On-Chain Token Creation', 'success', {
                mintAddress: mint.publicKey.toString(),
                tokenOwner: tokenOwnerAddress,
                payer: payer.publicKey.toString(),
            });
        }

        // Create the token mint with metadata and mint initial supply in a single transaction
        // Using createAndMint to atomically create metadata and mint tokens for fungible SPL tokens
        // This ensures metadata will be visible on Solscan and other explorers
        const result = await createAndMint(umi, {
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
            // Add creators field to match Metaplex metadata standard
            // This ensures the metadata structure matches standard tokens like VALOR
            creators: some([
                {
                    address: payer.publicKey,
                    verified: true,
                    share: 100,
                }
            ]),
            amount: supplyBigInt,
            tokenOwner: tokenOwnerPubkey,
        }).sendAndConfirm(umi);

        console.log(`✅ Token mint, metadata created and tokens minted: ${mint.publicKey.toString()}`);
        console.log(`📝 Transaction signature: ${formatSignature(result.signature)}`);
        console.log(`🔍 View token on Solscan: ${solscanTokenUrl(mint.publicKey.toString(), 'devnet')}`);
        console.log(`🔍 View transaction: ${solanaTxUrl(result.signature, 'devnet')}`);

        // Calculate the associated token account address for the return value
        const associatedTokenAccountPda = findAssociatedTokenPda(umi, {
            mint: mint.publicKey,
            owner: tokenOwnerPubkey,
        });

        const mintPublicKey = mint.publicKey.toString();
        
        if (sessionId) {
            flowTracker.trackOnChainCreation(sessionId, {
                mintAddress: mintPublicKey,
                ata: associatedTokenAccountPda[0].toString(),
                transactionSignature: result.signature,
            });
            
            flowTracker.trackMetadataAccountCreation(sessionId, {
                updateAuthority: payer.publicKey.toString(),
                mint: mintPublicKey,
                tokenStandard: 'Fungible',
                isMutable: true,
            });
        }

        return {
            mintAddress: mintPublicKey,
            ata: associatedTokenAccountPda[0].toString(),
            mintTx: result.signature
        };

    } catch (error: any) {
        console.error("❌ UMI SDK createTokenAndMetadata Error:", error);
        if (sessionId) {
            flowTracker.addFlowStep(sessionId, 'Token Creation Failed', 'error', {
                error: error.message || error,
            });
        }
        throw new Error(`Failed to create token and metadata: ${error.message || error}`);
    }
}
