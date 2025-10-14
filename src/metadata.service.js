// src/metadata.service.js

// ✅ КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: Используем createUmi из бандла, который включает все плагины и адреса
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'; 
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import * as Umi from '@metaplex-foundation/umi'; // Сохраняем для keypairIdentity
import * as web3 from '@solana/web3.js'; 
import { createAndMint } from '@metaplex-foundation/mpl-token-metadata';


let umi;

// ✅ ФУНКЦИЯ registerDevnetPrograms УДАЛЕНА

function initializeUmi(walletKeypair) {
    if (!walletKeypair) {
        throw new Error("Wallet Keypair required for Umi initialization.");
    }
    
    // 1. Создаем Umi с помощью Umi-Bundle. Он автоматически регистрирует ProgramRepository.
    umi = createUmi('https://api.devnet.solana.com'); 
        
    // 2. Устанавливаем оставшийся плагин
    umi.use(mplTokenMetadata()); 
    umi.use(Umi.keypairIdentity(walletKeypair)); 
    
    console.log(`Umi initialized. Payer: ${umi.identity.publicKey.toString()}`);
    
    return umi.identity; 
}


async function createTokenWithMetadata({ name, symbol, uri, decimals, supply }) {
    if (!umi) {
        throw new Error("Umi not initialized. Call initializeUmi first.");
    }
    
    // ✅ ИСПРАВЛЕНИЕ: Гарантируем, что строковые поля не null/undefined
    const tokenName = String(name || ''); // Гарантируем, что это строка
    const tokenSymbol = String(symbol || '');
    const tokenUri = String(uri || '');

    const parsedDecimals = parseInt(decimals || 9);
    const parsedSupply = parseFloat(supply);
    const totalAmount = BigInt(Math.round(parsedSupply * Math.pow(10, parsedDecimals))); 
    
    //zamena (const mintKeypair = web3.Keypair.generate(); )
    const mintKeypair = umi.eddsa.generateKeypair();

    await createAndMint(umi, {
        mint: mintKeypair,
        authority: umi.identity.publicKey.toString(),
        name: tokenName,
        symbol: tokenSymbol,
        uri: tokenUri,
        sellerFeeBasisPoints: 0, 
        decimals: parsedDecimals,
        amount: totalAmount,
        tokenOwner: umi.identity.publicKey.toString(), 

    }).sendAndConfirm(umi);
    
    return { mint: mintKeypair.publicKey.toString() };
}


// --- Экспорт ---
export {
    initializeUmi,
    createTokenWithMetadata
};