// src/utils.js
import BigNumber from 'bignumber.js';
/**
 * Преобразует строковое количество токенов и десятичные знаки (decimals)
 * в BigInt в наименьших единицах (lamports/solana).
 *
 * Пример: toBigInt("100", 9) => 100000000000 (BigInt)
 *
 * @param amount - Строковое количество токенов (например, "100.5").
 * @param decimals - Количество десятичных знаков токена (например, 9).
 * @returns BigInt в наименьших единицах.
 */
export function toBigInt(amount, decimals) {
    try {
        // Используем BigNumber для точной работы с большими числами и десятичными дробями
        const bn = new BigNumber(amount).shiftedBy(decimals);
        // Проверка на целостность после сдвига
        if (!bn.isInteger()) {
            throw new Error(`Amount "${amount}" has too many decimal places for ${decimals} decimals.`);
        }
        // Возвращаем результат как BigInt
        return BigInt(bn.toString(10));
    }
    catch (e) {
        if (e instanceof Error) {
            throw new Error(`Ошибка преобразования BigInt: ${e.message}`);
        }
        throw new Error("Неизвестная ошибка при преобразовании BigInt.");
    }
}
