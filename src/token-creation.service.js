// src/token-creation.service.js

// ✅ Используем только необходимые импорты.
// createAndMint - это высокоуровневая функция, которая упрощает процесс.
import { generateSigner } from '@metaplex-foundation/umi';
import { createAndMint } from '@metaplex-foundation/mpl-token-metadata';


// ❌ УДАЛЕНА: initializeUmi (она теперь в solana.service.js)
// ❌ УДАЛЕНЫ: pkg, updateMetadata, umi (глобальная переменная)
// ❌ УДАЛЕНЫ: createMint (низкоуровневая, склонная к ошибкам)


/**
 * Создает Mint-аккаунт и минтит начальное предложение.
 * @param {object} params
 * @param {Umi} params.umi Инстанция Umi (ОБЯЗАТЕЛЬНА)
 * @param {number | string} params.decimals Количество десятичных знаков
 * @param {number | string} params.supply Общее предложение токена
 * @returns {Promise<{ mint: string }>} Адрес нового Mint-аккаунта
 */
export async function createToken({ umi, decimals, supply }) { // ✅ ПРИНИМАЕТ UMI и уже ЭКСПОРТИРОВАНА
    if (!umi) {
        throw new Error("UMI instance is required. Please pass it from the router/service.");
    }
    
    // --- Расчет Supply ---
    const parsedDecimals = Number(decimals);
    const parsedSupply = Number(supply);

    if (isNaN(parsedDecimals) || isNaN(parsedSupply) || parsedSupply <= 0) {
        throw new Error("Invalid decimals or supply provided.");
    }

    // Umi.createAndMint принимает supply как Number, а не BigInt,
    // поскольку использует встроенные механизмы расчета.
    
    const mint = generateSigner(umi);
    const mintAddress = mint.publicKey.toString();

    console.log(`[ШАГ 1] Попытка создать Mint-аккаунт: ${mintAddress}`);

    try {
        // ==========================================================
        // ВЫСОКОУРОВНЕВАЯ ФУНКЦИЯ: Создание Mint-аккаунта и минтинг
        // ==========================================================
        const transaction = createAndMint(umi, {
            mint,
            decimals: parsedDecimals,
            
            // amount: количество для минтинга (Umi сам выполнит расчет)
            amount: parsedSupply, 
            
            tokenOwner: umi.identity.publicKey,
            authority: umi.identity, // Это Mint и Freeze Authority
        });

        // Отправляем транзакцию
        await transaction.sendAndConfirm(umi);

        console.log(`✅ [ШАГ 1] Токен создан и отчеканен. Адрес Mint: ${mintAddress}`);
        
        return { mint: mintAddress };
    } catch (error) {
        console.error("❌ Ошибка в createToken:", error);
        throw new Error(`Не удалось создать Mint-аккаунт: ${error.message}`);
    }
}


// --- Экспорт ---
// ❌ УДАЛЕН ДУБЛИРУЮЩИЙ БЛОК: 
// export {
//     createToken
// };