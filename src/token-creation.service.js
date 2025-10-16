// src/token-creation.service.js

// ✅ Используем импортированный generateSigner
import { generateSigner } from '@metaplex-foundation/umi';
import { createAndMint } from '@metaplex-foundation/mpl-token-metadata';


/**
 * Создает Mint-аккаунт и минтит начальное предложение.
 * @param {object} params
 * @param {Umi} params.umi Инстанция Umi (ОБЯЗАТЕЛЬНА)
 * // ... (остальные параметры)
 */
export async function createToken({ umi, decimals, supply }) { 
    if (!umi) {
        // Эта проверка должна работать, но на всякий случай...
        throw new Error("UMI instance is required.");
    }
    
    // --- Расчет Supply и Генерация Mint ---
    const parsedDecimals = Number(decimals);
    const parsedSupply = Number(supply);

    if (isNaN(parsedDecimals) || isNaN(parsedSupply) || parsedSupply <= 0) {
        throw new Error("Invalid decimals or supply provided.");
    }
    
    // 💥 ФИКС: Используем импортированный generateSigner(umi)
    const mint = generateSigner(umi); 
    const mintAddress = mint.publicKey.toString();

    console.log(`[ШАГ 1] Попытка создать Mint-аккаунт: ${mintAddress}`);

    try {
        const transaction = createAndMint(umi, {
            mint,
            decimals: parsedDecimals,
            amount: parsedSupply, 
            
            // Владелец и Authority берутся из umi.identity, который мы настроили
            tokenOwner: umi.identity.publicKey,
            authority: umi.identity, 
        });

        await transaction.sendAndConfirm(umi);

        console.log(`✅ [ШАГ 1] Токен создан и отчеканен. Адрес Mint: ${mintAddress}`);
        
        return { mint: mintAddress };
    } catch (error) {
        console.error("❌ Ошибка в createToken:", error);
        throw new Error(`Не удалось создать Mint-аккаунт: ${error.message}`);
    }
}

export { createToken };