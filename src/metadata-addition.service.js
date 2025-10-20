// src/metadata-addition.service.js

import { Buffer } from 'buffer'; // <--- ДОБАВЛЕНО: Явный импорт Buffer для работы в ESM-среде

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

// ✅ ШАГ 1: Раскомментируйте эти импорты после установки Metaplex SDK (npm install @metaplex-foundation/mpl-token-metadata)
import { 
    createCreateMetadataAccountV3Instruction, 
    PROGRAM_ID as METAPLEX_PROGRAM_ID_STUB, 
    DataV2
} from '@metaplex-foundation/mpl-token-metadata';


// --- КОНСТАНТЫ И ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ ---

let fallbackProgramIdCache = null;

/**
 * Генерирует и кеширует запасной Program ID только при первом вызове.
 * Этот запасной вариант используется, ТОЛЬКО ЕСЛИ Program ID не импортирован из SDK.
 * @returns {PublicKey}
 */
function getFallbackProgramId() {
    if (!fallbackProgramIdCache) {
        // Мы вызываем new PublicKey(string) только здесь, как последнюю меру 
        // против неожиданных сбоев при загрузке модуля.
        fallbackProgramIdCache = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6z8BXgZay');
    }
    return fallbackProgramIdCache;
}

// ❌ ШАГ 2: Удалены временные заглушки, так как импорты выше теперь работают.


/**
 * Возвращает адрес Public Key для адреса метаданных (PDA).
 * @param {PublicKey} mint - Mint Public Key.
 * @returns {PublicKey}
 */
function getMetadataAddress(mint) {
    // 1. Пытаемся получить Program ID из solana.service.js (который теперь должен быть импортирован)
    let programId = getMetadataProgramId(); 
    
    // 2. Если импорт не удался (проблема CommonJS/ESM), используем наш ленивый запасной вариант.
    if (!programId) {
        console.warn("⚠️ Metaplex Program ID не был загружен. Используется локальный, лениво инициализированный запасной вариант.");
        programId = getFallbackProgramId();
    } else {
        // Для отладки: если SDK импортирован, мы должны попасть сюда
        console.log("✅ Metaplex Program ID успешно загружен из SDK.");
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
    // Используем DataV2 из Metaplex SDK
    const dataV2 = {
        name: name,
        symbol: symbol,
        uri: uri,
        sellerFeeBasisPoints: 0,
        creators: [
            {
                address: owner,
                verified: true,
                share: 100
            }
        ],
        collection: null,
        uses: null
    };

    // --- 2. Создание самой инструкции ---
    // createCreateMetadataAccountV3Instruction теперь доступен из SDK
    let ix = createCreateMetadataAccountV3Instruction(
        {
            metadata: metadataAddress,
            mint: mint,
            mintAuthority: owner,
            payer: owner,
            updateAuthority: owner,
            systemProgram: SystemProgram.programId,
            rent: SystemProgram.programId, // Используется как SystemProgram
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
    const amount = BigInt(supply);
    const decimalPlaces = parseInt(decimals, 10);
    // Используем импортированный TOKEN_PROGRAM_ID

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
            owner, // Freeze Authority (можно установить null)
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
            amount,
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

