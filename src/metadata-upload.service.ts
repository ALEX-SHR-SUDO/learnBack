// src/metadata-upload.service.ts
// Service for handling logo upload and metadata generation as separate operations

import axios from "axios";
import FormData from "form-data";
import * as flowTracker from './metadata-flow-tracker.js';

// Validate Pinata API keys at module load time
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY;

if (!PINATA_API_KEY || !PINATA_SECRET) {
    console.warn("⚠️  WARNING: Pinata API keys not configured. PINATA_API_KEY and PINATA_SECRET_API_KEY must be set in environment variables.");
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
 * Supported file types: JPEG, PNG, GIF, WebP
 * Maximum file size: 10MB
 * 
 * @param fileBuffer - File buffer to upload
 * @param filename - Original filename
 * @returns IPFS hash and full URI of the uploaded file
 * @throws {Error} If Pinata API keys are not configured or upload fails
 */
export async function uploadLogoToIPFS(
    fileBuffer: Buffer, 
    filename: string,
    mimeType: string
): Promise<{ ipfsHash: string; imageUri: string }> {
    if (!PINATA_API_KEY || !PINATA_SECRET) {
        throw new Error("Pinata API keys not configured. Please set PINATA_API_KEY and PINATA_SECRET_API_KEY environment variables.");
    }

    const data = new FormData();
    data.append("file", fileBuffer, { filename });

    try {
        console.log(`📤 Uploading logo (${filename}) to IPFS...`);
        
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

        const ipfsHash = response.data.IpfsHash;
        const imageUri = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        
        console.log(`✅ Logo uploaded: ${imageUri}`);

        return { ipfsHash, imageUri };
    } catch (error) {
        console.error("❌ Error uploading logo to IPFS:", error);
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.response?.data?.error || error.message;
            throw new Error(`Pinata upload failed (HTTP ${status}): ${message}`);
        }
        throw error;
    }
}

/**
 * Generate and upload Metaplex-compliant metadata JSON to IPFS
 * This function assumes the logo has already been uploaded and accepts its URI
 * 
 * @param params - Token metadata parameters including pre-uploaded image URI
 * @returns IPFS URI of the metadata JSON
 */
export async function generateMetadataJSON(params: {
    name: string;
    symbol: string;
    description: string;
    imageUri: string;
    imageMimeType?: string;
    sessionId?: string;
}): Promise<{ metadataUri: string; metadataHash: string; sessionId: string }> {
    if (!PINATA_API_KEY || !PINATA_SECRET) {
        throw new Error("Pinata API keys not configured. Please set PINATA_API_KEY and PINATA_SECRET_API_KEY environment variables.");
    }

    // Start or continue tracking metadata flow
    const sessionId = params.sessionId || flowTracker.generateSessionId();
    
    try {
        flowTracker.trackMetadataJsonCreation(sessionId, {
            name: params.name,
            symbol: params.symbol,
            description: params.description,
            image: params.imageUri,
        });

        // Create Metaplex-compliant metadata JSON for fungible SPL token
        // Use category "fungible" to ensure explorers display it as a token, not an NFT
        const metadata: MetaplexMetadata = {
            name: params.name,
            symbol: params.symbol,
            description: params.description,
            image: params.imageUri,
            attributes: [],
            properties: {
                files: [
                    {
                        uri: params.imageUri,
                        type: params.imageMimeType || 'image/png',
                    }
                ],
                category: "fungible",
            }
        };

        console.log(`📝 Generated metadata:`, JSON.stringify(metadata, null, 2));

        // Upload metadata JSON to IPFS
        const data = new FormData();
        const metadataBuffer = Buffer.from(JSON.stringify(metadata), 'utf-8');
        data.append("file", metadataBuffer, { filename: 'metadata.json' });

        console.log(`📤 Uploading metadata JSON to IPFS...`);
        
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
            throw new Error(`Pinata did not return IpfsHash for metadata. Status: ${response.status}`);
        }

        const metadataHash = response.data.IpfsHash;
        const metadataUri = `https://gateway.pinata.cloud/ipfs/${metadataHash}`;
        
        console.log(`✅ Metadata uploaded: ${metadataUri}`);
        
        flowTracker.trackMetadataUpload(sessionId, { ipfsHash: metadataHash, metadataUri });

        return { metadataUri, metadataHash, sessionId };

    } catch (error) {
        console.error("❌ Error generating metadata JSON:", error);
        flowTracker.addFlowStep(sessionId, 'Metadata JSON Generation Failed', 'error', {
            error: error instanceof Error ? error.message : String(error),
        });
        
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.response?.data?.error || error.message;
            throw new Error(`Failed to upload metadata JSON (HTTP ${status}): ${message}`);
        }
        throw new Error(`Failed to generate metadata JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}
