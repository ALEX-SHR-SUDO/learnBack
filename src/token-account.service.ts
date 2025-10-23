// src/token-account.service.ts

import { 
    PublicKey, 
    Connection 
} from "@solana/web3.js";
import { 
    AccountLayout, 
    TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
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
 */
export async function getSplTokensForWallet(ownerPublicKey: PublicKey): Promise<TokenInfo[]> {
    const connection: Connection = getConnection();

    try {
        console.log(`[TokenService DEBUG] Запрос токен-аккаунтов для ${ownerPublicKey.toBase58()}...`);
        
        // 1. Получаем все токен-аккаунты
        const tokenAccounts = await connection.getTokenAccountsByOwner(
            ownerPublicKey,
            { programId: TOKEN_PROGRAM_ID }
        );

        // ✅ ПРОВЕРКА 1: Логируем общее количество аккаунтов, полученных от API
        console.log(`[TokenService DEBUG] API вернуло ${tokenAccounts.value.length} токен-аккаунтов.`);

        const tokenList: TokenInfo[] = tokenAccounts.value
            .map((accountInfo, index) => { 
                // 2. Декодируем данные аккаунта токена
                const data = AccountLayout.decode(accountInfo.account.data);
                
                // ✅ ИСПРАВЛЕНИЕ: Преобразуем Buffer в PublicKey
                const mintPublicKey = new PublicKey(data.mint);
                
                console.log(`[TokenService DEBUG] Аккаунт #${index}: Mint=${mintPublicKey.toBase58()}, State=${data.state}, Amount=${data.amount.toString()}`);

                // 3. Фильтруем: проверяем, что аккаунт инициализирован (state === 1) и имеет положительный баланс
                if (data.state === 1 && data.amount > 0n) { 
                     return {
                        mint: mintPublicKey.toBase58(), // Используем исправленный PublicKey
                        amountRaw: data.amount.toString(), 
                    };
                }
                return null;
            })
            // Отфильтровываем пустые результаты
            .filter((token): token is TokenInfo => token !== null);

        console.log(`[TokenService] Найдено токен-аккаунтов с положительным балансом: ${tokenList.length}`);
        return tokenList;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[TokenService] Ошибка при получении SPL-токенов: ${errorMessage}`);
        return []; 
    }
}
