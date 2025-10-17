// src/metadata-addition.service.js

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  createAssociatedTokenAccountInstruction,
  createMintToCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import * as metaplex from "@metaplex-foundation/mpl-token-metadata";
import { Buffer } from "buffer";

// Извлекаем необходимые функции Metaplex
const {
    createCreateMetadataAccountV3Instruction,
    findMetadataPda
} = metaplex;

// Определяем Program ID метаданных
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6z8BXgZay');

/**
 * [ШАГ 1, 2, 3] Создает новый Mint-аккаунт, Associated Token Account (ATA) для Mint Authority
 * и чеканит начальное предложение.
 * @param {Connection} connection Соединение с Solana.
 * @param {Keypair} payer Кошелек, оплачивающий транзакцию и являющийся Mint Authority.
 * @param {number} supply Общее начальное предложение токена (в виде целого числа).
 * @param {number} decimals Количество знаков после запятой.
 * @returns {Promise<{ mint: string, ata: string }>} Адреса Mint-аккаунта и ATA.
 */
async function createTokenAndMint(connection, payer, supply, decimals) {
  // 1. Создаем Mint-аккаунт
  const mintKeypair = Keypair.generate();
  const rentExempt = await getMinimumBalanceForRentExemptMint(connection);

  const createMintTx = new Transaction().add(
    // Инструкция 1: Создать аккаунт для Mint
    await createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      payer.publicKey,
      payer.publicKey, // Freeze Authority не используется, поэтому ставим Mint Authority
      TOKEN_PROGRAM_ID
    )
  );
  
  // Добавляем инструкцию для оплаты аренды за Mint-аккаунт
  createMintTx.add(
    SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        lamports: rentExempt,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
    })
  );

  console.log('[ШАГ 1] Попытка создать Mint-аккаунт.');
  const mintSignature = await connection.sendTransaction(createMintTx, [payer, mintKeypair]);
  await connection.confirmTransaction(mintSignature, 'confirmed');
  
  const mintAddress = mintKeypair.publicKey.toBase58();
  console.log(`✅ [ШАГ 1] Mint-аккаунт создан: ${mintAddress}`);

  // 2. Создаем Associated Token Account (ATA)
  const associatedTokenAccount = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    payer.publicKey
  );

  const createAtaTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      associatedTokenAccount,
      payer.publicKey,
      mintKeypair.publicKey
    )
  );

  console.log('[ШАГ 2] Попытка создать Associated Token Account (ATA).');
  const ataSignature = await connection.sendTransaction(createAtaTx, [payer]);
  await connection.confirmTransaction(ataSignature, 'confirmed');
  
  const ataAddress = associatedTokenAccount.toBase58();
  console.log(`✅ [ШАГ 2] Associated Token Account (ATA) создан: ${ataAddress}`);
  

  // 3. Чеканим начальное предложение (Mint to)
  const mintAmount = BigInt(supply) * BigInt(10 ** decimals);

  const mintToTx = new Transaction().add(
    createMintToCheckedInstruction(
      mintKeypair.publicKey,
      associatedTokenAccount,
      payer.publicKey,
      mintAmount,
      decimals
    )
  );
  
  console.log('[ШАГ 3] Попытка отчеканить начальное предложение.');
  const mintToSignature = await connection.sendTransaction(mintToTx, [payer]);
  await connection.confirmTransaction(mintToSignature, 'confirmed');
  
  console.log(`✅ [ШАГ 3] Начальное предложение ${supply} токенов отчеканено.`);

  return { mint: mintAddress, ata: ataAddress };
}

/**
 * [ШАГ 4] Добавляет метаданные Metaplex (имя, символ, URI) к существующему Mint-аккаунту токена.
 * * ВНИМАНИЕ: ЭТА ФУНКЦИЯ СОДЕРЖИТ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ СОВМЕСТИМОСТИ.
 * * @param {Connection} connection Соединение с Solana.
 * @param {Keypair} payer Кошелек, оплачивающий транзакцию и являющийся Mint Authority.
 * @param {string} mintAddress Адрес Mint-аккаунта токена.
 * @param {string} name Название токена.
 * @param {string} symbol Символ токена.
 * @param {string} uri Ссылка на JSON-файл метаданных.
 * @returns {Promise<string>} Подпись транзакции.
 */
async function addTokenMetadata(connection, payer, mintAddress, name, symbol, uri) {
    const mintPublicKey = new PublicKey(mintAddress);
    
    // 1. ВЫЧИСЛЕНИЕ АДРЕСА PDA МЕТАДАННЫХ
    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress}`);
    
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Явно передаем programId в findMetadataPda.
    // Это обходит проблему "Invalid public key input", принудительно используя
    // наш валидный объект PublicKey.
    const [metadataAddress] = findMetadataPda({
        mint: mintPublicKey,
        programId: TOKEN_METADATA_PROGRAM_ID, 
    });

    console.log(`[ШАГ 4] Адрес PDA метаданных успешно вычислен: ${metadataAddress.toBase58()}`);

    // 2. ФОРМИРОВАНИЕ ИНСТРУКЦИИ
    const instruction = createCreateMetadataAccountV3Instruction(
        {
            metadata: metadataAddress,
            mint: mintPublicKey,
            mintAuthority: payer.publicKey,
            payer: payer.publicKey,
            updateAuthority: payer.publicKey,
        },
        {
            createMetadataAccountArgsV3: {
                data: {
                    name: name,
                    symbol: symbol,
                    uri: uri,
                    sellerFeeBasisPoints: 0,
                    creators: null,
                    collection: null,
                    uses: null,
                },
                isMutable: true,
                collectionDetails: null,
            },
        },
        // Передаем явно определенный Program ID
        TOKEN_METADATA_PROGRAM_ID
    );

    // 3. ОТПРАВКА ТРАНЗАКЦИИ
    try {
        const { blockhash } = await connection.getLatestBlockhash();

        const txSignature = await connection.sendTransaction(
            new Transaction({ 
                recentBlockhash: blockhash,
                feePayer: payer.publicKey,
            }).add(instruction),
            [payer], // Подписывается только плательщик
            { 
                skipPreflight: false,
                preflightCommitment: "confirmed"
            }
        );

        console.log(`✅ [ШАГ 4] Метаданные токена созданы. Подпись: ${txSignature}`);
        return txSignature;
    } catch (error) {
        console.error("❌ Ошибка при добавлении метаданных токена:", error);
        throw new Error("Ошибка при добавлении метаданных токена: " + error.message);
    }
}

/**
 * Главная функция-оркестратор, которая выполняет весь процесс создания токена.
 * @param {Connection} connection Соединение с Solana.
 * @param {Keypair} payer Кошелек, оплачивающий транзакцию и являющийся Mint Authority.
 * @param {string} name Название токена.
 * @param {string} symbol Символ токена.
 * @param {string} uri Ссылка на JSON-файл метаданных.
 * @param {string} supply Общее начальное предложение токена (строка).
 * @param {string} decimals Количество знаков после запятой (строка).
 * @returns {Promise<{ mint: string, ata: string, metadataTx: string }>} Результаты создания.
 */
export async function createTokenAndMetadata(connection, payer, name, symbol, uri, supply, decimals) {
    try {
        const numDecimals = parseInt(decimals);
        const numSupply = parseInt(supply);

        // ШАГ 1-3: Создание Mint-аккаунта, ATA и чеканка
        const { mint, ata } = await createTokenAndMint(
            connection,
            payer,
            numSupply,
            numDecimals
        );

        // ШАГ 4: Добавление метаданных (используя наш исправленный код)
        const metadataTx = await addTokenMetadata(
            connection,
            payer,
            mint,
            name,
            symbol,
            uri
        );

        return { mint, ata, metadataTx };
    } catch (error) {
        console.error("❌ Ошибка при создании токена и метаданных:", error);
        throw error;
    }
}
