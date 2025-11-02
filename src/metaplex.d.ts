// src/metaplex.d.ts
//
// Кастомный файл декларации типов для принудительного разрешения модуля 
// '@metaplex-foundation/mpl-token-metadata'.
// Это обходит ошибку TS2307, указывая TypeScript, что модуль существует и имеет определенную форму.
// Все экспорты объявлены как 'any' или placeholder типы, чтобы компиляция прошла, 
// даже если фактические типы не могут быть найдены TSc в NodeNext-окружении.

declare module '@metaplex-foundation/mpl-token-metadata' {
    
    // Объявляем Enum, который используется в коде
    // Важно: Fungible (2) - для SPL токенов с метаданными
    export enum TokenStandard {
        NonFungible = 0,              // Unique NFTs (supply = 1)
        FungibleAsset = 1,            // Token-2022 fungible tokens ✅
        Fungible = 2,                 // SPL Tokens with metadata (standard fungible tokens) ✅
        NonFungibleEdition = 3,       // NFT Editions
        ProgrammableNonFungible = 4,  // Programmable NFTs (pNFTs)
        ProgrammableNonFungibleEdition = 5  // Programmable NFT Editions
    }

    // Объявляем функции, импортированные в src/metadata-addition.service.ts, как 'any'
    export const createV1: any;
    export const mintV1: any;
    export const createAndMint: any;
    export const findAssociatedTokenPda: any;
    export const findMetadataPda: any;
    export const createMetadata: any;
    export const mplTokenMetadata: any;
    
    // Если вам потребуется использовать другие типы из этого пакета, 
    // просто объявите их здесь как `export type MyType = any;`.
}
