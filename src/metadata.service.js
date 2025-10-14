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
    
    // Защита строк (как мы уже делали)
    const tokenName = String(name || ''); 
    const tokenSymbol = String(symbol || '');
    const tokenUri = String(uri || '');
    
    // ✅ УСИЛЕННАЯ ЗАЩИТА ЧИСЕЛ
    const parsedDecimals = parseInt(decimals) || 9; // parseInt('9') -> 9
    // Если supply null, используем 0. Затем парсим.
    const safeSupply = supply ? parseFloat(supply) : 0; 
    
    // 💥 ИСПРАВЛЕНИЕ BigInt: Более безопасный расчет
    // Используем BigInt для степени и умножения, чтобы избежать ошибок с плавающей точкой.
    const multiplier = BigInt(10) ** BigInt(parsedDecimals);
    
    // Выполняем расчет в BigInt, используя строку, а не Math.round()
    // NOTE: Поскольку JS не работает с BigInt и float напрямую, мы должны использовать
    // старый метод, но с защитой от NaN.
    const amountFloat = safeSupply * Math.pow(10, parsedDecimals); 
    
    // Проверяем, что результат не NaN, иначе возвращаем 0L (BigInt ноль)
    const totalAmount = isNaN(amountFloat) 
        ? BigInt(0) 
        : BigInt(Math.round(amountFloat)); // Теперь Math.round защищен
    
    if (totalAmount === BigInt(0) && safeSupply > 0) {
        console.error("Total amount calculation resulted in zero despite non-zero supply.");
        // Можете добавить здесь throw Error, если хотите предотвратить создание токена с нулевым запасом
    }
    
    const mintKeypair = umi.eddsa.generateKeypair(); 
    
    await createAndMint(umi, {
        mint: mintKeypair,
        authority: umi.identity.publicKey.toString(),
        name: tokenName,
        symbol: tokenSymbol,
        uri: tokenUri,
        sellerFeeBasisPoints: Number(0), 
        decimals: parsedDecimals,
        amount: totalAmount, // <-- Используем защищенный totalAmount
        tokenOwner: umi.identity.publicKey.toString(), 
        
    }).sendAndConfirm(umi);
    
    return { mint: mintKeypair.publicKey.toString() };
}


// --- Экспорт ---
export {
    initializeUmi,
    createTokenWithMetadata
};