// src/token-account.service.ts

import { formatTokenAmount } from './utils.js';
import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, unpackAccount, getMint } from "@solana/spl-token";
import { getConnection } from "./solana.service.js";

interface TokenInfo {
    mint: string;
    amount: string;
    decimals: number;
}

async function getTokenDecimals(connection: Connection, mintAddress: string): Promise<number> {
    try {
        const mintPublicKey = new PublicKey(mintAddress);
        const mintInfo = await getMint(connection, mintPublicKey);
        return mintInfo.decimals;
    } catch (error) {
        console.error(`Error getting decimals for mint ${mintAddress}:`, error);
        return 9; // fallback
    }
}

export async function getSplTokensForWallet(ownerPublicKey: PublicKey): Promise<TokenInfo[]> {
    const connection: Connection = getConnection();

    try {
        console.log(`[TokenService DEBUG] Запрос токен-аккаунтов для ${ownerPublicKey.toBase58()}...`);
        const tokenAccounts = await connection.getTokenAccountsByOwner(
            ownerPublicKey,
            { programId: TOKEN_PROGRAM_ID }
        );
        console.log(`[TokenService DEBUG] API вернуло ${tokenAccounts.value.length} токен-аккаунтов.`);

        // Собираем промисы на парсинг с decimals
        const tokens: Promise<TokenInfo | null>[] = tokenAccounts.value.map(async (accountInfo) => {
            try {
                const account = unpackAccount(accountInfo.pubkey, accountInfo.account);
                
                // Check if account is initialized and has positive balance
                if (account.isInitialized && account.amount > 0n) {
                    // Получаем decimals для mint
                    const decimals = await getTokenDecimals(connection, account.mint.toBase58());
                    return {
                        mint: account.mint.toBase58(),
                        amount: formatTokenAmount(account.amount.toString(), decimals),
                        decimals,
                    };
                }
            } catch (error) {
                console.error(`[TokenService] Error parsing token account:`, error);
            }
            return null;
        });

        // Ждём все токены
        const tokenListAll = await Promise.all(tokens);

        // Отфильтровываем null
        const tokenList: TokenInfo[] = tokenListAll.filter((token): token is TokenInfo => token !== null);

        console.log(`[TokenService] Найдено токен-аккаунтов с положительным балансом: ${tokenList.length}`);
        return tokenList;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[TokenService] Ошибка при получении SPL-токенов: ${errorMessage}`);
        return [];
    }
}
