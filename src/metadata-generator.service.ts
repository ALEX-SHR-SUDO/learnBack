// src/metadata-generator.service.ts

import axios from "axios";
import FormData from "form-data";

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY;

/**
 * Metaplex Token Metadata Standard
 * This interface defines the structure expected by Solana explorers like Solscan
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
        category: string;
        creators?: Array<{
            address: string;
            share: number;
        }>;
    };
}

/**
 * Upload a file to Pinata IPFS
 * @param fileBuffer - File buffer to upload
 * @param filename - Original filename
 * @returns IPFS hash of the uploaded file
 */
async function uploadToPinata(fileBuffer: Buffer, filename: string): Promise<string> {
    if (!PINATA_API_KEY || !PINATA_SECRET) {
        throw new Error("Pinata API keys not configured");
    }

    const data = new FormData();
    data.append("file", fileBuffer, { filename });

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
        throw new Error("Pinata did not return IpfsHash");
    }

    return response.data.IpfsHash;
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

        // Step 2: Create Metaplex-compliant metadata JSON
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
                category: "image",
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
