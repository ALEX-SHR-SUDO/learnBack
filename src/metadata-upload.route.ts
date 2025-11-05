// src/metadata-upload.route.ts
// Route handlers for separated logo upload and metadata generation

import express, { Request, Response } from "express";
import multer from "multer";
import { 
    uploadLogoToIPFS, 
    generateMetadataJSON,
    SUPPORTED_IMAGE_TYPES, 
    MAX_FILE_SIZE 
} from "./metadata-upload.service.js";
import * as flowTracker from './metadata-flow-tracker.js';

const router = express.Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

/**
 * POST /api/upload-logo-only
 * 
 * Step 1: Upload logo to IPFS only (separate from metadata generation)
 * 
 * Request body (multipart/form-data):
 * - file: Logo image file (required)
 * 
 * Response:
 * - imageUri: IPFS URI of the logo image
 * - ipfsHash: IPFS hash of the uploaded file
 * - sessionId: Session ID for tracking the flow (use this when generating metadata)
 */
router.post("/upload-logo-only", upload.single("file"), async (req: Request, res: Response) => {
    try {
        // Validate file upload
        if (!req.file) {
            return res.status(400).json({ error: "No logo file provided. Please upload an image file." });
        }

        // Log received data
        console.log("📥 Logo upload request received:");
        console.log("  - File:", req.file.originalname, `(${req.file.size} bytes, ${req.file.mimetype})`);

        // Validate image file type
        if (!SUPPORTED_IMAGE_TYPES.includes(req.file.mimetype as any)) {
            return res.status(400).json({ 
                error: `Invalid image type: ${req.file.mimetype}. Allowed types: ${SUPPORTED_IMAGE_TYPES.join(', ')}` 
            });
        }

        // Generate session ID for tracking
        const sessionId = flowTracker.generateSessionId();
        flowTracker.startMetadataFlow(sessionId);

        // Upload logo to IPFS
        const result = await uploadLogoToIPFS(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );
        
        flowTracker.trackImageUpload(sessionId, {
            ipfsHash: result.ipfsHash,
            imageUri: result.imageUri,
        });

        console.log("✅ Logo upload successful");

        res.status(200).json({
            success: true,
            message: "Logo uploaded to IPFS successfully",
            imageUri: result.imageUri,
            ipfsHash: result.ipfsHash,
            sessionId: sessionId,
            note: "Use this imageUri and sessionId when calling /api/generate-metadata-only to create the metadata JSON"
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("❌ Error in logo upload endpoint:", errorMessage);
        
        const clientMessage = errorMessage.includes("Pinata") 
            ? "Failed to upload to IPFS. Please check your file and try again."
            : "Failed to upload logo. Please check your input and try again.";
            
        res.status(500).json({ 
            error: clientMessage
        });
    }
});

/**
 * POST /api/generate-metadata-only
 * 
 * Step 2: Generate metadata JSON using pre-uploaded logo URI
 * 
 * Request body (application/json):
 * - imageUri: IPFS URI of the pre-uploaded logo (required)
 * - name: Token name (required)
 * - symbol: Token symbol (required)
 * - description: Token description (optional, defaults to empty string)
 * - sessionId: Session ID from logo upload (optional, for flow tracking)
 * - imageMimeType: MIME type of the image (optional, defaults to 'image/png')
 * 
 * Response:
 * - metadataUri: IPFS URI of the metadata JSON (use this for token creation)
 * - metadataHash: IPFS hash of the metadata JSON
 */
router.post("/generate-metadata-only", async (req: Request, res: Response) => {
    try {
        const { imageUri, name, symbol, description = "", sessionId, imageMimeType } = req.body;

        // Log received data
        console.log("📥 Metadata generation request received:");
        console.log("  - Fields:", req.body);

        // Validate required fields
        if (!imageUri || typeof imageUri !== 'string' || imageUri.trim().length === 0) {
            return res.status(400).json({ error: "imageUri is required and must be a non-empty string." });
        }

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: "Token name is required and must be a non-empty string." });
        }

        if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
            return res.status(400).json({ error: "Token symbol is required and must be a non-empty string." });
        }

        // Validate imageUri format (should be IPFS URI)
        if (!imageUri.includes('ipfs') && !imageUri.includes('Qm') && !imageUri.includes('bafy')) {
            console.warn("⚠️  Warning: imageUri does not appear to be an IPFS URI:", imageUri);
        }

        // Generate metadata JSON
        const result = await generateMetadataJSON({
            name: name.trim(),
            symbol: symbol.trim(),
            description: description.trim(),
            imageUri: imageUri.trim(),
            imageMimeType,
            sessionId,
        });

        console.log("✅ Metadata generation successful");

        res.status(200).json({
            success: true,
            message: "Metadata JSON generated and uploaded successfully",
            metadataUri: result.metadataUri,
            metadataHash: result.metadataHash,
            sessionId: result.sessionId,
            note: "Use the metadataUri when creating your token to ensure proper display on Solscan"
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("❌ Error in metadata generation endpoint:", errorMessage);
        
        const clientMessage = errorMessage.includes("Pinata") 
            ? "Failed to upload metadata to IPFS. Please try again."
            : "Failed to generate metadata. Please check your inputs and try again.";
            
        res.status(500).json({ 
            error: clientMessage
        });
    }
});

export default router;
