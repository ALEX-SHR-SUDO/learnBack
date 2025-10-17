// src/metadata-addition.service.js

// 1. ЯВНЫЙ ИМПОРТ Buffer для гарантии правильной реализации в Node.js
import { Buffer } from 'buffer';

import {
    PublicKey, // Used inside addTokenMetadata
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction, 
} from '@solana/web3.js';

// 2. ИСПОЛЬЗУЕМ DEFAULT IMPORT ДЛЯ ИНСТРУКЦИЙ И DataV2
import * as mplTokenMetadataPkg from '@metaplex-foundation/mpl-token-metadata';

// Check if exports are under .default property (CommonJS/ESM workaround)
const mplExports = mplTokenMetadataPkg.default || mplTokenMetadataPkg;

const {
    DataV2, 
    createCreateMetadataAccountV3Instruction,
} = mplExports;

import { getServiceKeypair, getConnection } from "./solana.service.js";


// 3. Используем адрес программы метаданных как строку.
const METADATA_PROGRAM_ID_STRING = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6msK8P3vc';


/**
 * Creates the Metaplex Metadata Account for the token (using V3).
 * @param {string} mintAddressString Mint account address as a Base58 string
 * @param {string} name Token name
 * @param {string} symbol Token symbol
 * @param {string} uri Metadata URI
 * @returns {Promise<PublicKey>} Address of the Metadata Account PDA.
 */
export async function addTokenMetadata(mintAddressString, name, symbol, uri) {
    const serviceKeypair = getServiceKeypair();
    const connection = getConnection();
    const payer = serviceKeypair;

    let mintAddress; // Declared here for use inside the try/catch

    // 🛑 CRITICAL DEBUGGING BLOCK: Isolate the PublicKey creation failure
    try {
        console.log(`[DEBUG] Входящая строка Mint-адреса: ${mintAddressString}`);
        
        // Create PublicKey object here from the passed string.
        mintAddress = new PublicKey(mintAddressString);

        console.log(`[DEBUG] Объект PublicKey успешно создан: ${mintAddress.toBase58()}`);

    } catch (e) {
        console.error(`[КРИТИЧЕСКИЙ DEBUG] НЕ УДАЛОСЬ преобразовать строку в PublicKey: ${e.message}`);
        throw new Error(`Невалидный адрес Mint: ${mintAddressString}. Причина: ${e.message}`);
    }

    // --- Convert the string metadata program address to PublicKey inside the function ---
    const METADATA_PROGRAM_ID = new PublicKey(METADATA_PROGRAM_ID_STRING);

    console.log(`[ШАГ 4] Попытка создать метаданные для ${mintAddress.toBase58()}`);

    try {
        // --- 1. Get Metadata Account PDA address ---
        // Using .toBytes() for seeds.
       const [metadataAddress] = await PublicKey.findProgramAddress( 
            [
                Buffer.from("metadata", "utf8"),
                METADATA_PROGRAM_ID.toBytes(), 
                mintAddress.toBytes(),         
            ],
            METADATA_PROGRAM_ID
        );

        // --- 2. Define Metaplex DataV2 data ---
        const tokenData = new DataV2({
            name: name,
            symbol: symbol,
            uri: uri,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
        });

        // --- 3. Create V3 instruction ---
        const metadataInstruction = createCreateMetadataAccountV3Instruction(
            {
                metadata: metadataAddress,
                mint: mintAddress,
                mintAuthority: payer.publicKey,
                payer: payer.publicKey,
                updateAuthority: payer.publicKey,
                systemProgram: SystemProgram.programId, 
            },
            {
                createMetadataAccountArgsV3: { 
                    data: tokenData,
                    isMutable: true,
                    collectionDetails: null, 
                },
            }
        );

        // --- 4. Send transaction ---
        const transaction = new Transaction().add(metadataInstruction);

        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [payer] 
        );

        console.log(`✅ [ШАГ 4] Метаданные созданы. Signature: ${signature}`);
        
        return metadataAddress;

    } catch (error) {
        console.error("❌ Ошибка в addTokenMetadata:", error);
        throw new Error(`Не удалось создать метаданные: ${error.message}`);
    }
}
