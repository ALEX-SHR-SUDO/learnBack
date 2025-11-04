// src/metadata-validator.ts

import axios from "axios";

/**
 * Metaplex Token Metadata Standard interface
 */
interface MetaplexMetadata {
    name: string;
    symbol: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
    properties?: {
        files?: Array<{
            uri: string;
            type: string;
        }>;
        category?: string;
        creators?: Array<{
            address: string;
            share: number;
        }>;
    };
}

/**
 * Validation result interface
 */
export interface MetadataValidationResult {
    isValid: boolean;
    warnings: string[];
    metadata?: MetaplexMetadata;
}

/**
 * Validates metadata JSON from a URI to ensure it follows Metaplex Token Metadata Standard
 * This helps prevent issues with Solscan and other explorers not displaying token info
 * 
 * @param uri - URI to the metadata JSON (e.g., IPFS URL)
 * @param expectedName - Expected token name (optional, for validation)
 * @param expectedSymbol - Expected token symbol (optional, for validation)
 * @returns Validation result with warnings if metadata is incomplete
 */
export async function validateMetadataUri(
    uri: string,
    expectedName?: string,
    expectedSymbol?: string
): Promise<MetadataValidationResult> {
    const warnings: string[] = [];

    try {
        // Fetch metadata JSON from URI
        const response = await axios.get(uri, {
            timeout: 10000, // 10 second timeout
            headers: {
                'Accept': 'application/json'
            }
        });

        const metadata = response.data as MetaplexMetadata;

        // Check required fields
        if (!metadata.name || typeof metadata.name !== 'string' || metadata.name.trim().length === 0) {
            warnings.push("Missing or invalid 'name' field in metadata JSON");
        }

        if (!metadata.symbol || typeof metadata.symbol !== 'string' || metadata.symbol.trim().length === 0) {
            warnings.push("Missing or invalid 'symbol' field in metadata JSON");
        }

        // Check if name/symbol match expected values
        if (expectedName && metadata.name !== expectedName) {
            warnings.push(`Metadata name '${metadata.name}' does not match token name '${expectedName}' - this may cause confusion`);
        }

        if (expectedSymbol && metadata.symbol !== expectedSymbol) {
            warnings.push(`Metadata symbol '${metadata.symbol}' does not match token symbol '${expectedSymbol}' - this may cause confusion`);
        }

        // Check recommended fields for Solscan display
        if (!metadata.image || typeof metadata.image !== 'string') {
            warnings.push("Missing 'image' field - token logo will not display on Solscan and other explorers");
        }

        if (!metadata.properties) {
            warnings.push("Missing 'properties' object - this is recommended for proper display on Solscan. Consider using /api/generate-metadata endpoint");
        } else {
            if (!metadata.properties.files || !Array.isArray(metadata.properties.files) || metadata.properties.files.length === 0) {
                warnings.push("Missing 'properties.files' array - token logo may not display properly on Solscan");
            }

            if (!metadata.properties.category) {
                warnings.push("Missing 'properties.category' field - recommended for proper categorization");
            }
        }

        // Description is optional but recommended
        if (!metadata.description) {
            warnings.push("Missing 'description' field - recommended for token information (this is a minor issue)");
        }

        return {
            isValid: warnings.length === 0,
            warnings,
            metadata
        };

    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                warnings.push(`Metadata URI is not accessible (timeout): ${uri}`);
            } else if (error.response?.status === 404) {
                warnings.push(`Metadata not found at URI: ${uri}`);
            } else if (error.response?.status && error.response.status >= 400) {
                warnings.push(`Metadata URI returned error ${error.response.status}: ${uri}`);
            } else {
                warnings.push(`Failed to fetch metadata from URI: ${error.message}`);
            }
        } else {
            warnings.push(`Error validating metadata: ${error instanceof Error ? error.message : String(error)}`);
        }

        return {
            isValid: false,
            warnings
        };
    }
}

/**
 * Formats validation warnings into a user-friendly message
 */
export function formatValidationWarnings(warnings: string[]): string {
    if (warnings.length === 0) {
        return "Metadata validation passed ✓";
    }

    return `Metadata validation found ${warnings.length} issue(s):\n${warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}`;
}
