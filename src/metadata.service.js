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
    
    // --- Защита Входных Данных ---
    const tokenName = String(name || ''); 
    const tokenSymbol = String(symbol || '');
    const tokenUri = String(uri || '');
    
    const parsedDecimals = parseInt(decimals) || 9;
    const parsedSupply = parseFloat(supply || 0);
    
    const amountFloat = parsedSupply * Math.pow(10, parsedDecimals);
    const totalAmount = isNaN(amountFloat) 
        ? BigInt(0) 
        : BigInt(Math.round(amountFloat));
    
    const mintKeypair = umi.eddsa.generateKeypair(); 
    
    // --- КРИТИЧЕСКИЙ БЛОК: Заполнение ВСЕХ обязательных полей Umi ---
    await createAndMint(umi, {
        mint: mintKeypair,
        
        // Власть над токеном (требуется для будущих изменений)
        authority: umi.identity.publicKey.toString(), 
        
        // Метаданные
        name: tokenName,
        symbol: tokenSymbol,
        uri: tokenUri,
        
        // Числовые поля
        sellerFeeBasisPoints: Number(0), // Роялти: 0%
        decimals: parsedDecimals,
        amount: totalAmount, 
        
        // 💥 ИСПРАВЛЕНИЕ: Owner и TokenOwner
        // Owner — владелец токен-счёта (для Umi это важно)
        owner: umi.identity.publicKey.toString(), 
        
        // TokenOwner — владелец токена (для SPL)
        tokenOwner: umi.identity.publicKey.toString(), 
        
        // 💥 ИСПРАВЛЕНИЕ: Явно указываем создателей (creators) и коллекцию
        creators: [{
            address: umi.identity.publicKey.toString(),
            share: 100, // 100% доля принадлежит нашему кошельку
            verified: true,
        }],
        
        // Явно говорим, что токен не является частью коллекции
        collection: null, 
        
    }).sendAndConfirm(umi);
    
    return { mint: mintKeypair.publicKey.toString() };
}


// --- Экспорт ---
export {
    initializeUmi,
    createTokenWithMetadata
};