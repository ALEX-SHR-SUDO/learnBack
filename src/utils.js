// src/utils.js

/**
 * Преобразует строковое значение количества токенов и их десятичные разряды
 * в целое число (BigInt), подходящее для блокчейна.
 * * Использование BigInt предотвращает потерю точности при работе с большими числами.
 * * @param {string} amountStr - Строка с количеством токенов (например, "1000000").
 * @param {number} decimals - Количество десятичных разрядов (например, 9).
 * @returns {bigint} Целочисленное значение токенов в наименьших единицах.
 */
export function toBigInt(amountStr, decimals) {
    if (typeof amountStr !== 'string' || amountStr.length === 0) {
        throw new Error("Amount must be a non-empty string.");
    }
    
    // Преобразование строки в BigInt
    const amount = BigInt(amountStr);
    
    // Вычисление множителя: 10^decimals
    const multiplier = BigInt(10) ** BigInt(decimals);
    
    return amount * multiplier;
}

