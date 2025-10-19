// src/utils.js

/**
 * Преобразует строковое значение количества токенов и их десятичные разряды
 * в целое число (BigInt), подходящее для блокчейна.
 * @param {string} amountStr - Строка с количеством токенов (например, "1000000").
 * @param {number} decimals - Количество десятичных разрядов (например, 9).
 * @returns {bigint} Целочисленное значение токенов.
 */
export function toBigInt(amountStr, decimals) {
    const amount = BigInt(amountStr);
    const multiplier = BigInt(10) ** BigInt(decimals);
    return amount * multiplier;
}
