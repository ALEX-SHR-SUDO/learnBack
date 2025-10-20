// src/metadata-addition.service.js

import { Buffer } from 'buffer'; // <-- Явный импорт Buffer для работы в ESM-среде

import { 
    getServiceWallet, 
    getConnection, 
    getMetadataProgramId // <-- Импортировано из solana.service.js
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

// ✅ ИСПРАВЛЕНИЕ CJS/ESM: Импортируем весь модуль Metaplex как объект 'mpl'
import * as mpl from '@metaplex-foundation/mpl-token-metadata'; 
const { 
    createCreateMetadataAccountV3Instruction, 
    DataV2, 
    Creator 
} = mpl;

// --- КОНСТАНТЫ И ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ ---

// ❌ УДАЛЕНО: Убираем getFallbackProgramId и fallbackProgramIdCache,
// поскольку getMetadataProgramId должен быть надежным.

/**
 * Возвращает адрес Public Key для адреса метаданных (PDA).
 * @param {PublicKey} mint - Mint Public Key.
 * @returns {PublicKey}
 */
function getMetadataAddress(mint) {
    // 1. Получаем Program ID из solana.service.js 
    let programId = getMetadataProgramId(); 
    
    // ❌ УДАЛЕНО: Убираем логику запасного варианта, просто проверяем.
    if (!programId) {
         throw new Error("❌ Metaplex Program ID не был загружен. Проверьте solana.service.js");
    }

    if (!mint || !(mint instanceof PublicKey)) {
        throw new Error("Invalid or undefined Mint Public Key provided to getMetadataAddress.");
    }
    
    // ВАЖНО: Buffer используется для создания буферов 'metadata' и 'mint.toBuffer()'.
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
 * * @param {object} params - { mint, owner, name, symbol, uri }
 * @returns {object} - Инструкция и адрес метаданных.
 */
function createMetaplexInstruction(params) {
    const { mint, owner, name, symbol, uri } = params;
    
    const metadataAddress = getMetadataAddress(mint);

    // --- 1. Подготовка структуры данных (DataV2) ---
    // ✅ ИСПРАВЛЕНИЕ: Используем конструкторы DataV2 и Creator,
    // чтобы обеспечить правильную сериализацию данных Metaplex.
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
    // Используем mpl.createCreateMetadataAccountV3Instruction
    let ix = createCreateMetadataAccountV3Instruction(
        {
            metadata: metadataAddress,
            mint: mint,
            mintAuthority: owner,
            payer: owner,
            updateAuthority: owner,
            systemProgram: SystemProgram.programId,
            // ❌ УДАЛЕНО: Поле `rent` больше не используется в v3 и вызывает ошибку
        },
        {
            createMetadataAccountArgsV3: {
                data: dataV2,
                isMutable: true, // Разрешить изменять метаданные в будущем
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
 * 1. Создает Mint аккаунт. 
 * 2. Инициализирует его.
 * 3. Чеканит токены на ATA.
 * 4. Устанавливает Authority для чеканки на null.
 * 5. Пытается добавить метаданные (отдельной транзакцией).
 * * @param {object} tokenDetails - name, symbol, uri, supply, decimals.
 * @returns {object} - { mintAddress, ata, metadataTx }
 */
export async function createTokenAndMetadata(tokenDetails) {
    const connection = getConnection();
    const payer = getServiceWallet();
    const { name, symbol, uri, supply, decimals } = tokenDetails;
    
    // --- ПОДГОТОВКА ---
    const mint = Keypair.generate();
    const owner = payer.publicKey;
    const decimalPlaces = parseInt(decimals, 10);
    
    // ✅ ИСПРАВЛЕНИЕ: Правильный расчет окончательного количества токенов (BigInt)
    const amount = BigInt(supply) * BigInt(10 ** decimalPlaces);
    
    const transaction = new Transaction();
    const signers = [payer, mint]; 

    // 1. Создание аккаунта (Mint Account)
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    
    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: owner,
            newAccountPubkey: mint.publicKey,
            space: MINT_SIZE,
            lamports,
            programId: TOKEN_PROGRAM_ID, // Используем импортированный ID
        })
    );

    // 2. Инициализация Mint
    transaction.add(
        createInitializeMintInstruction(
            mint.publicKey,
            decimalPlaces,
            owner, // Mint Authority
            owner, // Freeze Authority
            TOKEN_PROGRAM_ID // Используем импортированный ID
        )
    );
    
    // 3. Создание Associated Token Account (ATA) для владельца
    const associatedTokenAddress = await getAssociatedTokenAddress(
        mint.publicKey,
        owner,
        false, 
        TOKEN_PROGRAM_ID // Используем импортированный ID
    );

    transaction.add(
        createAssociatedTokenAccountInstruction(
            owner, // payer
            associatedTokenAddress,
            owner, // owner
            mint.publicKey, // mint
            TOKEN_PROGRAM_ID // Используем импортированный ID
        )
    );

    // 4. Чеканка токенов на ATA
    transaction.add(
        createMintToCheckedInstruction(
            mint.publicKey, 
            associatedTokenAddress,
            owner, // Mint Authority
            amount, // ✅ ИСПРАВЛЕНО: Количество (уже с учетом десятичных знаков)
            decimalPlaces,
            [], 
            TOKEN_PROGRAM_ID // Используем импортированный ID
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
            TOKEN_PROGRAM_ID // Используем импортированный ID
        )
    );

    // 6. Отправка и подтверждение транзакции (Создание токена и чеканка)
    try {
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            signers,
            { commitment: 'confirmed' }
        );
        
        const mintAddress = mint.publicKey.toBase58();

        // 7. Попытка добавления метаданных (отдельной транзакцией)
        const metadataTxSignature = await addTokenMetadata(mintAddress, { name, symbol, uri });

        return { 
            mintAddress: mintAddress, 
            ata: associatedTokenAddress.toBase58(),
            metadataTx: metadataTxSignature
        };
    } catch (error) {
        console.error("❌ Ошибка при создании или чеканке токена:", error.message);
        throw error;
    }
}


/**
 * Добавляет метаданные Metaplex к существующему токену.
 * @param {string} mintAddress - Mint Public Key (Base58).
 * @param {object} metadata - name, symbol, uri.
 * @returns {string} - Transaction signature.
 */
export async function addTokenMetadata(mintAddress, metadata) {
    const connection = getConnection();
    const payer = getServiceWallet();
    const mint = new PublicKey(mintAddress);
    
    const { ix } = createMetaplexInstruction({
        mint,
        owner: payer.publicKey,
        ...metadata
    });

    if (!ix) {
        // Этого не должно произойти, если SDK установлен и импортирован
        console.error("❌ Фатальная ошибка: Metaplex Instruction не была создана. Проверьте импорты SDK.");
        return "Metadata_Application_Failed";
    }

    // Если инструкция создана (т.е. SDK был импортирован), отправляем:
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

