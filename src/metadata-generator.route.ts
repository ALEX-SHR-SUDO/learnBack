// src/metadata-generator.route.ts

import express, { Request, Response } from "express";
import multer from "multer";
import { generateAndUploadMetadata, SUPPORTED_IMAGE_TYPES, MAX_FILE_SIZE } from "./metadata-generator.service.js";

const router = express.Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

/**
 * POST /api/generate-metadata
 * 
 * Generates Metaplex-compliant metadata and uploads it to IPFS along with the logo.
 * This ensures the metadata has the correct format for Solscan and other explorers.
 * 
 * Request body (multipart/form-data):
 * - file: Logo image file (required)
 * - name: Token name (required)
 * - symbol: Token symbol (required)
 * - description: Token description (optional, defaults to empty string)
 * 
 * Response:
 * - metadataUri: IPFS URI of the metadata JSON (use this for token creation)
 * - imageUri: IPFS URI of the logo image
 */
router.post("/generate-metadata", upload.single("file"), async (req: Request, res: Response) => {
    try {
        // Validate file upload
        if (!req.file) {
            return res.status(400).json({ error: "No logo file provided. Please upload an image file." });
        }

        // Log received data
        console.log("📥 Metadata generation request received:");
        console.log("  - File:", req.file.originalname, `(${req.file.size} bytes, ${req.file.mimetype})`);
        console.log("  - Fields:", req.body);

        // Validate required fields
        const { name, symbol, description = "" } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: "Token name is required and must be a non-empty string." });
        }

        if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
            return res.status(400).json({ error: "Token symbol is required and must be a non-empty string." });
        }

        // Validate image file type
        if (!SUPPORTED_IMAGE_TYPES.includes(req.file.mimetype as any)) {
            return res.status(400).json({ 
                error: `Invalid image type: ${req.file.mimetype}. Allowed types: ${SUPPORTED_IMAGE_TYPES.join(', ')}` 
            });
        }

        // Generate and upload metadata
        const result = await generateAndUploadMetadata({
            name: name.trim(),
            symbol: symbol.trim(),
            description: description.trim(),
            logoBuffer: req.file.buffer,
            logoFilename: req.file.originalname,
            logoMimetype: req.file.mimetype,
        });

        console.log("✅ Metadata generation successful");

        res.status(200).json({
            success: true,
            message: "Metadata generated and uploaded successfully",
            metadataUri: result.metadataUri,
            imageUri: result.imageUri,
            note: "Use the metadataUri when creating your token to ensure proper display on Solscan"
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("❌ Error in metadata generation endpoint:", errorMessage);
        
        // Don't expose internal error details to client
        const clientMessage = errorMessage.includes("Pinata") 
            ? "Failed to upload to IPFS. Please check your file and try again."
            : "Failed to generate metadata. Please check your inputs and try again.";
            
        res.status(500).json({ 
            error: clientMessage
        });
    }
});

export default router;
