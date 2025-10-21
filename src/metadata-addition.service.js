// src/metadata-addition.service.js

import { Buffer } from 'buffer';

import { 
    getServiceWallet, 
    getConnection, 
    getMetadataProgramId 
} from './solana.service.js';

import { 
    createAssociatedTokenAccountInstruction, 
    createInitializeMintInstruction, 
    getAssociatedTokenAddress, 
    MINT_SIZE,
    createMintToCheckedInstruction,
    createSetAuthorityInstruction,
    AuthorityType,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';

import { 
    Keypair, 
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction,
    PublicKey
} from '@solana/web3.js';

// ❌ УДАЛЕНО: Статический импорт Metaplex. Мы будем использовать динамический импорт.
// import * as mpl from '@metaplex-foundation/mpl-token-metadata';

// --- ГЛОБАЛЬНЫЙ КЭШ ДЛЯ METAPLEX ---
let mplCache = null;

/**
 * 💡 АСИНХРОННАЯ ФУНКЦИЯ: Динамически импортирует Metaplex, кэшируя результат.
 * @returns {object} - Объект, содержащий DataV2, Creator и инструкцию.
 */
async function getMetaplexExports() {
    if (mplCache) return mplCache;
    
    // Динамический импорт для обхода проблем CJS/ESM
    const mpl = await import('@metaplex-foundation/mpl-token-metadata');
    
    // В зависимости от того, как Node.js обрабатывает CJS, экспорты могут быть в .default
    const exports = mpl.default || mpl; 

    // Кэшируем и возвращаем необходимые компоненты
    mplCache = {
        createCreateMetadataAccountV3Instruction: exports.createCreateMetadataAccountV3Instruction,
        DataV2: exports.DataV2,
        Creator: exports.Creator
    };
    
    return mplCache;
}


// --- ФУНКЦИИ ---

/**
 * Возвращает адрес Public Key для адреса метаданных (PDA).
 * ... (без изменений)
 */
function getMetadataAddress(mint) {
    let programId = getMetadataProgramId(); 
    
    if (!programId) {
         throw new Error("❌ Metaplex Program ID не был загружен. Проверьте solana.service.js");
    }

    if (!mint || !(mint instanceof PublicKey)) {
        throw new Error("Invalid or undefined Mint Public Key provided to getMetadataAddress.");
    }
    
    const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            programId.toBuffer(),
            mint.toBuffer(),
        ],
        programId
    );
    return metadataAddress;
}


/**
 * Создает инструкцию для создания метаданных Metaplex V3.
 * ⚠️ Сделано асинхронным для динамического импорта.
 * * @param {object} params - { mint, owner, name, symbol, uri }
 * @returns {Promise<object>} - Инструкция и адрес метаданных.
 */
async function createMetaplexInstruction(params) {
    const { mint, owner, name, symbol, uri } = params;
    
    const { createCreateMetadataAccountV3Instruction, DataV2, Creator } = await getMetaplexExports();
    
    const metadataAddress = getMetadataAddress(mint);

    // --- 1. Подготовка структуры данных (DataV2) ---
    // ✅ ИСПРАВЛЕНО: Используем конструкторы, полученные через динамический импорт
    const dataV2 = new DataV2({
        name: name,
        symbol: symbol,
        uri: uri,
        sellerFeeBasisPoints: 0,
        creators: [
            new Creator({
                address: owner,
                verified: true,
                share: 100
            })
        ],
        collection: null,
        uses: null
    });

    // --- 2. Создание самой инструкции ---
    let ix = createCreateMetadataAccountV3Instruction(
        {
            metadata: metadataAddress,
            mint: mint,
            mintAuthority: owner,
            payer: owner,
            updateAuthority: owner,
            systemProgram: SystemProgram.programId,
        },
        {
            createMetadataAccountArgsV3: {
                data: dataV2,
                isMutable: true, 
                collectionDetails: null 
            }
        }
    );

    return { 
        metadataAddress: metadataAddress,
        ix: ix
    };
}


/**
 * Создает токен, чеканит его, отключает Authority и добавляет метаданные 
 * Metaplex в ОДНОЙ атомарной транзакции.
 * * @param {object} tokenDetails - name, symbol, uri, supply, decimals.
 * @returns {object} - { mintAddress, ata, transactionSignature }
 */
export async function createTokenAndMetadata(tokenDetails) {
    const connection = getConnection();
    const payer = getServiceWallet();
    const { name, symbol, uri, supply, decimals } = tokenDetails;
    
    // --- ПОДГОТОВКА ---
    const mint = Keypair.generate();
    const owner = payer.publicKey;
    const decimalPlaces = parseInt(decimals, 10);
    
    const amount = BigInt(supply) * BigInt(10 ** decimalPlaces);
    
    const transaction = new Transaction();
    const signers = [payer, mint]; 

    // Получаем Lamports для аренды Mint Account
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    // 1. Создание Mint Account
    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: owner,
            newAccountPubkey: mint.publicKey,
            space: MINT_SIZE,
            lamports,
            programId: TOKEN_PROGRAM_ID, 
        })
    );

    // 2. Инициализация Mint
    transaction.add(
        createInitializeMintInstruction(
            mint.publicKey,
            decimalPlaces,
            owner, // Mint Authority
            owner, // Freeze Authority
            TOKEN_PROGRAM_ID 
        )
    );
    
    // 3. Создание Associated Token Account (ATA) для владельца
    const associatedTokenAddress = await getAssociatedTokenAddress(
        mint.publicKey,
        owner,
        false, 
        TOKEN_PROGRAM_ID 
    );

    transaction.add(
        createAssociatedTokenAccountInstruction(
            owner, // payer
            associatedTokenAddress,
            owner, // owner
            mint.publicKey, // mint
            TOKEN_PROGRAM_ID 
        )
    );

    // 4. Чеканка токенов на ATA
    transaction.add(
        createMintToCheckedInstruction(
            mint.publicKey, 
            associatedTokenAddress,
            owner, // Mint Authority
            amount, 
            decimalPlaces,
            [], 
            TOKEN_PROGRAM_ID 
        )
    );
    
    // 5. Отключение Authority для чеканки
    transaction.add(
        createSetAuthorityInstruction(
            mint.publicKey,
            owner, // Current Authority
            AuthorityType.MintTokens,
            null, // New Authority (null = disable)
            [],
            TOKEN_PROGRAM_ID 
        )
    );

    // 6. Добавление инструкции Metaplex Metadata (ВСЕ В ОДНОЙ ТРАНЗАКЦИИ)
    // ⚠️ Теперь эта функция асинхронна
    const { ix: metadataIx } = await createMetaplexInstruction({
        mint: mint.publicKey,
        owner: payer.publicKey,
        ...tokenDetails
    });
    transaction.add(metadataIx);


    // 7. Отправка и подтверждение атомарной транзакции
    try {
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            signers,
            { commitment: 'confirmed' }
        );
        
        const mintAddress = mint.publicKey.toBase58();

        return { 
            mintAddress: mintAddress, 
            ata: associatedTokenAddress.toBase58(),
            transactionSignature: signature
        };
    } catch (error) {
        console.error("❌ Ошибка при создании токена и метаданных:", error.message);
        throw error;
    }
}


/**
 * ⚠️ ВОССТАНОВЛЕНА ДЛЯ СОВМЕСТИМОСТИ.
 * Добавляет метаданные Metaplex к существующему токену.
 * @param {string} mintAddress - Mint Public Key (Base58).
 * @param {object} metadata - name, symbol, uri.
 * @returns {string} - Transaction signature.
 */
export async function addTokenMetadata(mintAddress, metadata) {
    const connection = getConnection();
    const payer = getServiceWallet();
    const mint = new PublicKey(mintAddress);
    
    console.warn("⚠️ Используется устаревшая функция addTokenMetadata. Рекомендуется использовать createTokenAndMetadata.");

    // ⚠️ Теперь эта функция асинхронна
    const { ix } = await createMetaplexInstruction({
        mint,
        owner: payer.publicKey,
        ...metadata
    });

    if (!ix) {
        console.error("❌ Фатальная ошибка: Metaplex Instruction не была создана.");
        return "Metadata_Application_Failed";
    }

    try {
        const transaction = new Transaction().add(ix);
        
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [payer],
            { commitment: 'confirmed' }
        );
        
        return signature;
    } catch (error) {
        console.error("❌ Ошибка при отправке транзакции метаданных:", error.message);
        throw error;
    }
}
