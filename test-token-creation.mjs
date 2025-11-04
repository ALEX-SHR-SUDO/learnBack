// Test script to create a token with metadata and verify it's visible
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
    createUmi, 
    keypairIdentity, 
    generateSigner, 
    sol,
    percentAmount,
} from "@metaplex-foundation/umi";
import { defaultPlugins } from "@metaplex-foundation/umi-bundle-defaults";
import { 
    createAndMint,
    TokenStandard,
    mplTokenMetadata
} from "@metaplex-foundation/mpl-token-metadata";
import { readFileSync } from 'fs';

const CLUSTER_URL = 'https://api.devnet.solana.com';

async function testTokenCreation() {
    console.log('🔧 Starting token creation test...\n');
    
    // Load service wallet
    const secretKeyArray = JSON.parse(readFileSync('/home/runner/work/learnBack/learnBack/service_wallet.json', 'utf-8'));
    const web3jsKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    console.log('📝 Service Wallet Address:', web3jsKeypair.publicKey.toBase58());
    
    // Check balance
    const connection = new Connection(CLUSTER_URL, 'confirmed');
    const balance = await connection.getBalance(web3jsKeypair.publicKey);
    console.log('💰 Balance:', balance / LAMPORTS_PER_SOL, 'SOL');
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
        throw new Error('Insufficient balance. Need at least 0.01 SOL');
    }
    
    // Initialize UMI
    console.log('\n🔨 Initializing UMI SDK...');
    const umi = createUmi(CLUSTER_URL);
    umi.use(defaultPlugins());
    umi.use(mplTokenMetadata());
    
    // Convert web3.js keypair to UMI keypair
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(web3jsKeypair.secretKey);
    umi.use(keypairIdentity(umiKeypair));
    console.log('✅ UMI initialized with payer:', umiKeypair.publicKey);
    
    // Generate new mint
    const mint = generateSigner(umi);
    console.log('\n🆕 New mint address will be:', mint.publicKey);
    
    // Token details
    const tokenDetails = {
        name: 'Test Token Metadata Fix',
        symbol: 'TMFIX',
        uri: 'https://gateway.pinata.cloud/ipfs/QmSampleHash',
        supply: '1000',
        decimals: 9
    };
    
    console.log('\n📊 Token details:', tokenDetails);
    
    // Calculate supply in smallest units
    const supplyBigInt = BigInt(tokenDetails.supply) * BigInt(10 ** tokenDetails.decimals);
    
    console.log('\n⚙️ Creating token with metadata...');
    console.log('Parameters:', {
        mintAddress: mint.publicKey,
        authority: umiKeypair.publicKey,
        name: tokenDetails.name,
        symbol: tokenDetails.symbol,
        uri: tokenDetails.uri,
        decimals: tokenDetails.decimals,
        tokenStandard: 'Fungible',
        amount: supplyBigInt.toString()
    });
    
    try {
        const result = await createAndMint(umi, {
            mint,
            authority: umiKeypair,
            name: tokenDetails.name,
            symbol: tokenDetails.symbol,
            uri: tokenDetails.uri,
            sellerFeeBasisPoints: percentAmount(0),
            decimals: tokenDetails.decimals,
            tokenStandard: TokenStandard.Fungible,
            isMutable: true,
            updateAuthority: umiKeypair.publicKey,
            amount: supplyBigInt,
            tokenOwner: umiKeypair.publicKey,
        }).sendAndConfirm(umi);
        
        console.log('\n✅ SUCCESS! Token created with metadata!');
        console.log('📝 Mint address:', mint.publicKey);
        console.log('🔗 Transaction signature:', result.signature);
        console.log('\n🔍 View on Solscan:');
        console.log(`   https://solscan.io/token/${mint.publicKey}?cluster=devnet`);
        console.log('\n🔍 View transaction on Solana Explorer:');
        console.log(`   https://explorer.solana.com/tx/${result.signature}?cluster=devnet`);
        
    } catch (error) {
        console.error('\n❌ ERROR during token creation:', error);
        throw error;
    }
}

testTokenCreation().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
