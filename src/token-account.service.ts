// src/token-account.service.ts

import { formatTokenAmount } from './utils.js';
import { PublicKey, Connection } from "@solana/web3.js";
import { AccountLayout, TOKEN_PROGRAM_ID, MintLayout, u64 } from "@solana/spl-token";
import { getConnection } from "./solana.service.js";

interface TokenInfo {
    mint: string;
    amount: string;
    decimals: number;
}

async function getTokenDecimals(connection: Connection, mintAddress: string): Promise<number> {
    const mintPublicKey = new PublicKey(mintAddress);
    const mintAccountInfo = await connection.getAccountInfo(mintPublicKey);
    if (!mintAccountInfo) return 9; // fallback
    const mintData = MintLayout.decode(mintAccountInfo.data);
    return mintData.decimals;
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
        const tokens: Promise<TokenInfo | null>[] = tokenAccounts.value.map(async (accountInfo, index) => {
            const data = AccountLayout.decode(accountInfo.account.data);
            const mintPublicKey = new PublicKey(data.mint);

            // Amount как BigInt
          let amount: bigint;
             if (typeof data.amount === 'bigint') {
             amount = data.amount;
             } else if (Buffer.isBuffer(data.amount)) {
                 amount = BigInt(u64.fromBuffer(data.amount).toString());
            } else {
                 amount = BigInt(0);
           }

            if (data.state === 1 && amount > 0n) {
                // Получаем decimals для mint
                const decimals = await getTokenDecimals(connection, mintPublicKey.toBase58());
                return {
                    mint: mintPublicKey.toBase58(),
                    amount: formatTokenAmount(amount.toString(), decimals),
                    decimals,
                };
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
