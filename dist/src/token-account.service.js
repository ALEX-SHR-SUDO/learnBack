// src/token-account.service.js
import { PublicKey } from '@solana/web3.js';
// Предполагаем, что getServiceWallet и getConnection экспортируются из solana.service.js
import { getServiceWallet, getConnection } from './solana.service.js';
/**
 * Получает список всех SPL-токенов и их балансы для заданного публичного ключа кошелька.
 * @param {PublicKey} ownerPublicKey - Публичный ключ владельца кошелька.
 * @returns {Promise<Array<{mint: string, amount: string, decimals: number}>>} - Список токенов.
 */
export async function getSplTokensForWallet(ownerPublicKey) {
    const connection = getConnection();
    try {
        // Program ID для Токенов (Solana Token Program)
        const tokenProgramId = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
        // Используем getParsedTokenAccountsByOwner для получения списка токенов
        // с автоматическим парсингом данных.
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, { programId: tokenProgramId });
        // Фильтруем аккаунты, у которых баланс больше 0, и форматируем результат.
        const tokens = tokenAccounts.value
            .filter(account => account.account.data.parsed.info.tokenAmount.uiAmount > 0)
            .map(account => {
            const info = account.account.data.parsed.info;
            return {
                mint: info.mint,
                amount: info.tokenAmount.uiAmount.toString(), // Количество, удобное для чтения (с десятичными знаками)
                decimals: info.tokenAmount.decimals,
            };
        });
        return tokens;
    }
    catch (error) {
        console.error("Error fetching SPL token accounts:", error);
        // Исправление: Проверяем, является ли ошибка объектом Error, чтобы избежать ошибки TS18046.
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error("Failed to fetch SPL token accounts: " + errorMessage);
    }
}
