// src/metaplex.d.ts
//
// Кастомный файл декларации типов для принудительного разрешения модуля 
// '@metaplex-foundation/mpl-token-metadata'.
// Это обходит ошибку TS2307, указывая TypeScript, что модуль существует и имеет определенную форму.
// Все экспорты объявлены как 'any' или placeholder типы, чтобы компиляция прошла, 
// даже если фактические типы не могут быть найдены TSc в NodeNext-окружении.

declare module '@metaplex-foundation/mpl-token-metadata' {
    
    // Объявляем Enum, который используется в коде
    // Важно: FungibleAsset (1) - для SPL токенов, Fungible (2) - для semi-fungible NFTs
    export enum TokenStandard {
        NonFungible = 0,              // Unique NFTs (supply = 1)
        FungibleAsset = 1,            // SPL Tokens (standard fungible tokens) ✅
        Fungible = 2,                 // Semi-fungible NFTs (NFTs with supply > 1)
        NonFungibleEdition = 3,       // NFT Editions
        ProgrammableNonFungible = 4,  // Programmable NFTs (pNFTs)
        ProgrammableNonFungibleEdition = 5  // Programmable NFT Editions
    }

    // Объявляем функции, импортированные в src/metadata-addition.service.ts, как 'any'
    export const createAndMint: any;
    export const findAssociatedTokenPda: any;
    export const findMetadataPda: any;
    export const createMetadata: any;
    export const mplTokenMetadata: any;
    
    // Если вам потребуется использовать другие типы из этого пакета, 
    // просто объявите их здесь как `export type MyType = any;`.
}
