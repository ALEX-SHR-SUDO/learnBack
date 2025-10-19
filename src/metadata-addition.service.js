// src/metadata-addition.service.js

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
    AuthorityType
} from '@solana/spl-token';

import { 
    Keypair, 
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction,
    PublicKey
} from '@solana/web3.js';

// 🛑 ВАЖНО: ДЛЯ ТОГО ЧТОБЫ ЭТИ СТРОКИ РАБОТАЛИ, 
// ВЫ ДОЛЖНЫ УСТАНОВИТЬ: npm install @metaplex-foundation/mpl-token-metadata
// Затем вы должны раскомментировать эти импорты:
/*
import { 
    createCreateMetadataAccountV3Instruction, 
    PROGRAM_ID as METAPLEX_PROGRAM_ID,
    DataV2
} from '@metaplex-foundation/mpl-token-metadata';
*/

// --- КОНСТАНТЫ ---
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbCKSMYyzJm64FbLqxTSeiM'); 

// ⚠️ ВРЕМЕННЫЕ ЗАГЛУШКИ ДЛЯ ИМПОРТА METAPLEX, ПОКА SDK НЕ УСТАНОВЛЕН
// Если SDK установлен, удалите этот блок и раскомментируйте импорты выше.
const createCreateMetadataAccountV3Instruction = (accounts, args) => {
    console.error("❌ ОШИБКА: Metaplex SDK не импортирован. Инструкция не может быть создана.");
    return null; // Возвращаем null, если функция SDK недоступна
};
const METAPLEX_PROGRAM_ID = getMetadataProgramId();
// ------------------------------------------------------------------------


/**
 * Возвращает адрес Public Key для адреса метаданных (PDA).
 * @param {PublicKey} mint - Mint Public Key.
 * @returns {PublicKey}
 */
function getMetadataAddress(mint) {
    const METADATA_PROGRAM_ID = getMetadataProgramId(); 
    
    const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        METADATA_PROGRAM_ID
    );
    return metadataAddress;
}


/**
 * Создает инструкцию для создания метаданных Metaplex V3.
 * * @param {object} params - { mint, owner, name, symbol, uri }
 * @returns {object} - Инструкция (или null) и адрес метаданных.
 */
function createMetaplexInstruction(params) {
    const { mint, owner, name, symbol, uri } = params;
    
    const metadataAddress = getMetadataAddress(mint);

    // --- 1. Подготовка структуры данных (DataV2) ---
    // Это ключевая структура, которую ожидает Metaplex.
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
    // Если Metaplex SDK установлен, этот вызов создаст корректную инструкцию.
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
            programId: TOKEN_PROGRAM_ID,
        })
    );

    // 2. Инициализация Mint
    transaction.add(
        createInitializeMintInstruction(
            mint.publicKey,
            decimalPlaces,
            owner, // Mint Authority
            owner, // Freeze Authority (можно установить null)
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

    // 6. Отправка и подтверждение транзакции (Создание токена и чеканка)
    const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        signers,
        { commitment: 'confirmed' }
    );
    
    const mintAddress = mint.publicKey.toBase58();

    // 7. Попытка добавления метаданных (отдельная транзакция)
    const metadataTxSignature = await addTokenMetadata(mintAddress, { name, symbol, uri });

    return { 
        mintAddress: mintAddress, 
        ata: associatedTokenAddress.toBase58(),
        metadataTx: metadataTxSignature
    };
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
        // Возвращаем специальную сигнатуру, если инструкция не была создана
        console.warn("⚠️ Инструкция Metaplex не была создана. Убедитесь, что Metaplex SDK установлен.");
        return "Metadata_Not_Applied_No_Metaplex_SDK";
    }

    // Если инструкция создана (т.е. SDK был импортирован), отправляем:
    const transaction = new Transaction().add(ix);
    
    const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer],
        { commitment: 'confirmed' }
    );
    
    return signature;
}
