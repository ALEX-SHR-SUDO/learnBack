// src/metaplex-import-check.ts
//
// Этот файл создан для проверки, может ли TypeScript-компилятор (tsc)
// найти модуль '@metaplex-foundation/mpl-token-metadata' и его типы.
// Если этот файл компилируется, это означает, что корневая проблема
// не в импорте, а в структуре или зависимостях в основном сервисном файле.
import { TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
/**
 * Просто возвращает тип токена.
 * Цель: убедиться, что тип TokenStandard разрешается компилятором.
 * @returns {TokenStandard}
 */
export function getTokenStandardCheck() {
    // Используем один из экспортированных типов
    console.log("TokenStandard (Fungible):", TokenStandard.Fungible);
    return TokenStandard.Fungible;
}
// Теперь запустите команду 'npm run build' и посмотрите, какая ошибка возникнет.
