// src/token-account.service.ts
//
// Сервис, отвечающий за поиск и декодирование SPL-токенов в кошельке.

import { 
    PublicKey, 
    Connection 
} from "@solana/web3.js";
import { 
    AccountLayout, 
    TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
// ✅ ИСПРАВЛЕНО: Import теперь указывает на .js для корректного выполнения в рантайме
import { getConnection } from "./solana.service.js"; 

/**
 * Описывает структуру данных о токене, которую возвращает функция.
 */
interface TokenInfo {
    mint: string;
    amountRaw: string; // BigInt в виде строки
}

/**
 * Получает все SPL-токены для заданного публичного ключа кошелька.
 * @param {PublicKey} ownerPublicKey - Публичный ключ кошелька, баланс которого нужно проверить.
 * @returns {Promise<TokenInfo[]>} Список найденных токенов.
 */
export async function getSplTokensForWallet(ownerPublicKey: PublicKey): Promise<TokenInfo[]> {
    const connection: Connection = getConnection();

    try {
        // 1. Получаем все токен-аккаунты, принадлежащие владельцу, фильтруя по Program ID (TOKEN_PROGRAM_ID)
        const tokenAccounts = await connection.getTokenAccountsByOwner(
            ownerPublicKey,
            { programId: TOKEN_PROGRAM_ID }
        );

        const tokenList: TokenInfo[] = tokenAccounts.value
            .map(accountInfo => {
                // 2. Декодируем данные аккаунта токена
                // AccountLayout.decode возвращает структуру с полем amount типа BigInt
                const data = AccountLayout.decode(accountInfo.account.data);
                
                // 3. Проверяем, что аккаунт инициализирован (state === 1) и имеет положительный баланс
                // Количество токенов хранится в наименьших единицах (BigInt).
                if (data.state === 1 && data.amount > 0n) { 
                     return {
                        mint: data.mint.toBase58(),
                        amountRaw: data.amount.toString(), // Возвращаем BigInt как строку
                    };
                }
                return null;
            })
            // Отфильтровываем пустые результаты и явно типизируем
            .filter((token): token is TokenInfo => token !== null);

        console.log(`[TokenService] Найдено токен-аккаунтов: ${tokenList.length}`);
        return tokenList;

    } catch (error) {
        // Безопасная обработка ошибки (как мы делали ранее в solana.service.ts)
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[TokenService] Ошибка при получении SPL-токенов: ${errorMessage}`);
        // Возвращаем пустой массив при ошибке
        return []; 
    }
}
