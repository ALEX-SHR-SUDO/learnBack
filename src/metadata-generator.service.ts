// src/metadata-generator.service.ts

import axios from "axios";
import FormData from "form-data";

// Validate Pinata API keys at module load time
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY;

if (!PINATA_API_KEY || !PINATA_SECRET) {
    console.warn("⚠️  WARNING: Pinata API keys not configured. PINATA_API_KEY and PINATA_SECRET_API_KEY must be set in environment variables.");
    console.warn("⚠️  Metadata generation will fail until these are configured.");
}

/**
 * Supported image formats and their MIME types
 */
export const SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
] as const;

/**
 * Maximum file size for uploads (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Metaplex Token Metadata Standard
 * This interface defines the structure expected by Solana explorers like Solscan
 * For fungible SPL tokens, we exclude NFT-specific fields like 'creators'
 */
interface MetaplexMetadata {
    name: string;
    symbol: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
    properties?: {
        files: Array<{
            uri: string;
            type: string;
        }>;
        category?: string;
    };
}

/**
 * Upload a file to Pinata IPFS
 * 
 * Supported file types: JPEG, PNG, GIF, WebP, and JSON files
 * Maximum file size: 10MB
 * 
 * @param fileBuffer - File buffer to upload
 * @param filename - Original filename
 * @returns IPFS hash of the uploaded file
 * @throws {Error} If Pinata API keys are not configured or upload fails
 */
async function uploadToPinata(fileBuffer: Buffer, filename: string): Promise<string> {
    if (!PINATA_API_KEY || !PINATA_SECRET) {
        throw new Error("Pinata API keys not configured. Please set PINATA_API_KEY and PINATA_SECRET_API_KEY environment variables.");
    }

    const data = new FormData();
    data.append("file", fileBuffer, { filename });

    try {
        const response = await axios.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            data,
            {
                maxBodyLength: Infinity,
                headers: {
                    ...data.getHeaders(),
                    'pinata_api_key': PINATA_API_KEY,
                    'pinata_secret_api_key': PINATA_SECRET,
                },
            }
        );

        if (!response.data?.IpfsHash) {
            throw new Error(`Pinata did not return IpfsHash. Status: ${response.status}, Response: ${JSON.stringify(response.data)}`);
        }

        return response.data.IpfsHash;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.response?.data?.error || error.message;
            throw new Error(`Pinata upload failed (HTTP ${status}): ${message}`);
        }
        throw error;
    }
}

/**
 * Generate proper Metaplex-compliant metadata and upload to IPFS
 * @param params - Token metadata parameters including logo buffer
 * @returns IPFS URI of the metadata JSON
 */
export async function generateAndUploadMetadata(params: {
    name: string;
    symbol: string;
    description: string;
    logoBuffer: Buffer;
    logoFilename: string;
    logoMimetype: string;
}): Promise<{ metadataUri: string; imageUri: string }> {
    try {
        // Step 1: Upload logo to IPFS
        console.log(`📤 Uploading logo (${params.logoFilename}) to IPFS...`);
        const imageHash = await uploadToPinata(params.logoBuffer, params.logoFilename);
        const imageUri = `https://gateway.pinata.cloud/ipfs/${imageHash}`;
        console.log(`✅ Logo uploaded: ${imageUri}`);

        // Step 2: Create Metaplex-compliant metadata JSON for fungible SPL token
        // Use category "fungible" to ensure explorers display it as a token, not an NFT
        const metadata: MetaplexMetadata = {
            name: params.name,
            symbol: params.symbol,
            description: params.description,
            image: imageUri,
            attributes: [],
            properties: {
                files: [
                    {
                        uri: imageUri,
                        type: params.logoMimetype,
                    }
                ],
                category: "fungible",
            }
        };

        console.log(`📝 Generated metadata:`, JSON.stringify(metadata, null, 2));

        // Step 3: Upload metadata JSON to IPFS
        const metadataBuffer = Buffer.from(JSON.stringify(metadata), 'utf-8');
        console.log(`📤 Uploading metadata JSON to IPFS...`);
        const metadataHash = await uploadToPinata(metadataBuffer, 'metadata.json');
        const metadataUri = `https://gateway.pinata.cloud/ipfs/${metadataHash}`;
        console.log(`✅ Metadata uploaded: ${metadataUri}`);

        return { metadataUri, imageUri };

    } catch (error) {
        console.error("❌ Error generating and uploading metadata:", error);
        throw new Error(`Failed to generate metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
}
