// test-create-token.js
import dotenv from 'dotenv';
import { createTokenAndMetadata } from './dist/src/metadata-addition.service.js';

dotenv.config();

const tokenDetails = {
    name: "Test SPL Token",
    symbol: "TEST",
    uri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    supply: "1000000",
    decimals: "9"
};

console.log('Creating token with details:', tokenDetails);

try {
    const result = await createTokenAndMetadata(tokenDetails);
    console.log('\n✅ SUCCESS!');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\n🔍 View on Solscan:', `https://solscan.io/token/${result.mintAddress}?cluster=devnet`);
    process.exit(0);
} catch (error) {
    console.error('\n❌ FAILED:', error.message);
    console.error('Full error:', error);
    process.exit(1);
}
