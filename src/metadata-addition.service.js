// src/metadata-addition.service.js
// Низкоуровневый сервис для создания SPL Token и метаданных Metaplex.

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
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
// Buffer не нужен, если вы используете @solana/web3.js, который включает его полифилл.
// import { Buffer } from "buffer"; 

// Извлекаем необходимые функции Metaplex
const {
    createCreateMetadataAccountV3Instruction,
    findMetadataPda
} = metaplex;

// ✅ ИСПРАВЛЕНИЕ #1: Определяем Program ID метаданных как СТРОКУ,
// чтобы избежать немедленного вызова new PublicKey() при загрузке модуля.

const TOKEN_METADATA_PROGRAM_ID_STR = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

/**
 * [ШАГ 1, 2, 3] Создает новый Mint-аккаунт, Associated Token Account (ATA) для Mint Authority
 * и чеканит начальное предложение.
 * @param {Connection} connection Соединение с Solana.
 * @param {Keypair} payer Кошелек, оплачивающий транзакцию и являющийся Mint Authority.
 * @param {number} supply Общее начальное предложение токена (в виде целого числа).
 * @param {number} decimals Количество знаков после запятой.
 * @returns {Promise<{ mint: string, ata: string, mintKeypair: Keypair }>} Адреса Mint-аккаунта, ATA и Keypair Mint.
 */
async function createTokenAndMint(connection, payer, supply, decimals) {
  // 1. Создаем Mint-аккаунт
  const mintKeypair = Keypair.generate();
  const rentExempt = await getMinimumBalanceForRentExemptMint(connection);

  // Инструкция 1: Добавляем инструкцию для оплаты аренды за Mint-аккаунт
  const createMintAccountInstruction = SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        lamports: rentExempt,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
    });
  
  // Инструкция 2: Инициализируем Mint
  const initializeMintInstruction = createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      payer.publicKey, // Mint Authority
      payer.publicKey, // Freeze Authority (используем тот же Keypair для простоты)
      TOKEN_PROGRAM_ID
  );

  const createMintTx = new Transaction().add(
    createMintAccountInstruction,
    initializeMintInstruction
  );

  console.log('[ШАГ 1] Попытка создать Mint-аккаунт.');
  // Для создания Mint нужны подписи Payer и MintKeypair
  const mintSignature = await connection.sendTransaction(createMintTx, [payer, mintKeypair], { skipPreflight: false });
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
  // Приведение к BigInt для безопасных расчетов больших чисел
  const mintAmount = BigInt(supply) * BigInt(10 ** decimals); 

  const mintToTx = new Transaction().add(
    createMintToCheckedInstruction(
      mintKeypair.publicKey,
      associatedTokenAccount,
      payer.publicKey, // Mint Authority
      mintAmount, 
      decimals,
      [], // Signers for the Mint Authority
      TOKEN_PROGRAM_ID
    )
  );
  
  console.log('[ШАГ 3] Попытка отчеканить начальное предложение.');
  // Подписывает Payer, который является Mint Authority
  const mintToSignature = await connection.sendTransaction(mintToTx, [payer]);
  await connection.confirmTransaction(mintToSignature, 'confirmed');
  
  console.log(`✅ [ШАГ 3] Начальное предложение ${supply} токенов отчеканено.`);

  // Возвращаем MintKeypair для возможности обновления
  return { mint: mintAddress, ata: ataAddress, mintKeypair }; 
}

/**
 * [ШАГ 4] Добавляет метаданные Metaplex (имя, символ, URI) к существующему Mint-аккаунту токена.
 * @param {Connection} connection Соединение с Solana.
 * @param {Keypair} payer Кошелек, оплачивающий транзакцию и являющийся Mint Authority.
 * @param {string} mintAddress Адрес Mint-аккаунта токена.
 * @param {string} name Название токена.
 * @param {string} symbol Символ токена.
 * @param {string} uri Ссылка на JSON-файл метаданных.
 * @returns {Promise<string>} Подпись транзакции.
 */
async function addTokenMetadata(connection, payer, mintAddress, name, symbol, uri) {
    const mintPublicKey = new PublicKey(mintAddress);
    
    // ✅ ИСПРАВЛЕНИЕ #2: Создаем PublicKey здесь, во время выполнения функции (runtime).
    const tokenMetadataProgramId = new PublicKey(TOKEN_METADATA_PROGRAM_ID_STR);

    // 1. ВЫЧИСЛЕНИЕ АДРЕСА PDA МЕТАДАННЫХ
    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress}`);
    
    // Передаем явно созданный Program ID
    const pdaResult = findMetadataPda({
        mint: mintPublicKey,
        programId: tokenMetadataProgramId, 
    });
    
    // Единственная декларация metadataAddress
    const metadataAddress = pdaResult[0];

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
        tokenMetadataProgramId
    );

    // 3. ОТПРАВКА ТРАНЗАКЦИИ
    try {
        // УЛУЧШЕНИЕ: Запрашиваем свежий blockhash непосредственно перед отправкой
        const { blockhash } = await connection.getLatestBlockhash('confirmed');

        const txSignature = await connection.sendTransaction(
            new Transaction({ 
                recentBlockhash: blockhash,
                feePayer: payer.publicKey,
            }).add(instruction),
            [payer], // Подписывается только плательщик (Mint Authority)
            { 
                skipPreflight: false,
                preflightCommitment: "confirmed"
            }
        );

        await connection.confirmTransaction({ signature: txSignature, blockhash: blockhash, lastValidBlockHeight: (await connection.getLatestBlockhash('confirmed')).lastValidBlockHeight }, 'confirmed');


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
        // Получаем MintKeypair, хотя он не нужен для следующего шага, это хорошая практика.
        const { mint, ata } = await createTokenAndMint(
            connection,
            payer,
            numSupply,
            numDecimals
        );

        // ШАГ 4: Добавление метаданных 
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
