// src/metadata-addition.service.js

// ✅ ИСПРАВЛЕННЫЕ ИМПОРТЫ

import { 
    PublicKey, 
    TransactionInstruction, 
    SystemProgram, 
    Keypair,
    Transaction, 
    sendAndConfirmTransaction, 
    ComputeBudgetProgram, // Добавлено для надежности транзакции
} from '@solana/web3.js';
import bs58 from 'bs58';
// Добавлено getConnection для выполнения транзакции
import { getMetadataProgramId, getServiceWallet, getConnection } from './solana.service.js'; 
import * as splToken from '@solana/spl-token';


/**
 * Создает инструкцию для создания счета метаданных Metaplex.
 * @param {PublicKey} mint - Public Key токена (Mint Account).
 * @param {string} name - Имя токена.
 * @param {string} symbol - Символ токена.
 * @param {string} uri - URI метаданных (JSON).
 * @returns {TransactionInstruction} Инструкция Metaplex.
 */
export function createMetaplexInstruction(mint, name, symbol, uri) {
    const owner = getServiceWallet().publicKey;
    const programId = getMetadataProgramId();
    
    // Получение адреса метаданных через PDA
    const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('metadata'),
            programId.toBuffer(),
            mint.toBuffer(),
        ],
        programId
    );
    
    // Создание объекта DataV2 (Metaplex format)
    const dataV2 = new DataV2({
        name: name,
        symbol: symbol,
        uri: uri,
        sellerFeeBasisPoints: 0,
        creators: [
            new Creator({
                address: owner,
                share: 100,
                verified: true,
            }),
        ],
        collection: null,
        uses: null,
    });
    
    // --- 2. Создание самой инструкции ---
    // ✅ ИСПРАВЛЕНИЕ: Вызываем функцию createCreateMetadataAccountV3Instruction напрямую.
    const ix = createCreateMetadataAccountV3Instruction(
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
                isMutable: true, // Разрешить изменять метаданные в будущем
                collectionDetails: null 
            }
        }
    );

    return ix;
}


/**
 * Шаг 1-4. Создает Mint Account, Mint ATA, чеканит токены и добавляет метаданные Metaplex.
 * Это основная функция, которая объединяет весь процесс создания токена.
 * * @param {string} name - Имя токена.
 * @param {string} symbol - Символ токена.
 * @param {string} uri - URI метаданных (JSON).
 * @param {string} supply - Общее количество токенов (как строка).
 * @param {string} decimals - Количество десятичных знаков (как строка).
 * @returns {Promise<{ mintAddress: string, txSignature: string }>} Адрес нового токена и подпись транзакции.
 */
export async function createTokenAndMetadata(name, symbol, uri, supply, decimals) {
    const connection = getConnection();
    const serviceWallet = getServiceWallet();
    const owner = serviceWallet.publicKey;
    
    // Новая пара ключей для Mint Account
    const mintKeypair = Keypair.generate();
    const mintAddress = mintKeypair.publicKey;

    // Конвертация входных данных
    const parsedDecimals = parseInt(decimals, 10);
    const parsedSupply = BigInt(supply);
    const initialSupply = parsedSupply * BigInt(10 ** parsedDecimals);

    // 1. Создание ATA для чеканки токенов (владелец: serviceWallet)
    const tokenAccount = splToken.getAssociatedTokenAddressSync(
        mintAddress,
        owner,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // 2. Инструкции для создания токена
    const instructions = [
        // Опционально: Добавляем инструкцию для увеличения бюджета
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }), 
        
        // 2a. Создание Mint Account
        splToken.createMintToInstruction(
            mintAddress,
            tokenAccount,
            owner, // Mint Authority
            initialSupply,
            splToken.TOKEN_PROGRAM_ID
        ),

        // 2b. Создание Associated Token Account (ATA) для владельца
        splToken.createAssociatedTokenAccountInstruction(
            owner, // Payer
            tokenAccount, // Associated Token Account
            owner, // Owner (Wallet)
            mintAddress, // Mint
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID
        ),
        
        // 2c. Чеканка токенов в ATA
        splToken.createMint(
            connection,
            serviceWallet,
            owner, // Mint Authority
            owner, // Freeze Authority
            parsedDecimals,
            mintKeypair,
            splToken.TOKEN_PROGRAM_ID,
        ),
        
        // 3. Добавление инструкции Metaplex Metadata
        createMetaplexInstruction(mintAddress, name, symbol, uri),
    ];

    // 4. Отправка транзакции
    const transaction = new Transaction().add(...instructions);
    
    try {
        const txSignature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [serviceWallet, mintKeypair], // Подписывают сервис-кошелек и Mint Keypair
            { commitment: 'confirmed' }
        );

        return { 
            mintAddress: mintAddress.toBase58(), 
            txSignature: txSignature 
        };
    } catch (error) {
        console.error("❌ Ошибка при выполнении транзакции:", error);
        throw new Error(`Ошибка при создании токена: ${error.message}`);
    }
}
