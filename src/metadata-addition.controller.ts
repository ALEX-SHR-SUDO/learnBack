// src/metadata-addition.controller.ts

import { Request, Response } from "express";
import { createTokenAndMetadata } from './metadata-addition.service.js';
import { solanaTxUrl, solscanTokenUrl, solscanTxUrl } from './utils/solana-signature.js';
import { validateMetadataUri, formatValidationWarnings } from './metadata-validator.js';
import { revokeFreezeAuthority, revokeMintAuthority } from './token-authority.service.js';
import { PublicKey } from '@solana/web3.js';
import * as flowTracker from './metadata-flow-tracker.js';

interface CreateTokenRequest {
    name: string;
    symbol: string;
    uri: string;
    supply: string;
    decimals: string;
    recipientWallet?: string; // Optional: wallet address to receive the minted tokens
    revokeFreezeAuthority?: boolean;
    revokeMintAuthority?: boolean;
    sessionId?: string; // Optional: session ID for flow tracking (from metadata generation)
}

export async function handleCreateTokenAndMetadata(req: Request<any, any, CreateTokenRequest>, res: Response) {
    try {
        const { name, symbol, uri, supply, decimals, recipientWallet, revokeFreezeAuthority: shouldRevokeFreezeAuth, revokeMintAuthority: shouldRevokeMintAuth, sessionId: providedSessionId } = req.body;
        console.log("Req Body Received:", req.body);

        // Start or continue flow tracking
        const sessionId = providedSessionId || flowTracker.generateSessionId();
        let flow = flowTracker.getActiveFlow(sessionId);
        
        if (!flow) {
            flowTracker.startMetadataFlow(sessionId);
        }
        
        flowTracker.trackTokenCreationRequest(sessionId, {
            name,
            symbol,
            uri,
            supply,
            decimals,
            recipientWallet,
        });

        if (!name || !symbol || !uri || !supply || !decimals) {
            flowTracker.addFlowStep(sessionId, 'Token Creation Failed - Missing Fields', 'error', {
                providedFields: { name: !!name, symbol: !!symbol, uri: !!uri, supply: !!supply, decimals: !!decimals }
            });
            flowTracker.endMetadataFlow(sessionId);
            return res.status(400).json({ error: "Missing required fields: name, symbol, uri, supply, or decimals." });
        }

        // Validate recipientWallet if provided
        if (recipientWallet) {
            try {
                new PublicKey(recipientWallet);
                console.log(`📬 Tokens will be minted to recipient wallet: ${recipientWallet}`);
                flowTracker.addFlowStep(sessionId, 'Recipient Wallet Validated', 'success', {
                    recipientWallet
                });
            } catch (error) {
                flowTracker.addFlowStep(sessionId, 'Invalid Recipient Wallet', 'error', {
                    recipientWallet,
                    error: 'Not a valid Solana public key'
                });
                flowTracker.endMetadataFlow(sessionId);
                return res.status(400).json({ 
                    error: "Invalid recipientWallet address. Please provide a valid Solana public key." 
                });
            }
        } else {
            console.log(`📬 Tokens will be minted to service wallet (default behavior)`);
        }

        // Validate metadata before creating token
        console.log("🔍 Validating metadata from URI...");
        await flowTracker.trackMetadataUriValidation(sessionId, uri);
        
        const validationResult = await validateMetadataUri(uri, name, symbol);
        
        if (validationResult.warnings.length > 0) {
            console.warn("⚠️  Metadata validation warnings:");
            validationResult.warnings.forEach((warning, index) => {
                console.warn(`   ${index + 1}. ${warning}`);
            });
            
            // If metadata is critically invalid (can't fetch or missing required fields), reject the request
            const hasCriticalErrors = validationResult.warnings.some(w => 
                w.includes("not accessible") || 
                w.includes("not found") ||
                w.includes("Missing or invalid 'name'") ||
                w.includes("Missing or invalid 'symbol'")
            );
            
            if (hasCriticalErrors) {
                flowTracker.addFlowStep(sessionId, 'Critical Metadata Validation Errors', 'error', {
                    warnings: validationResult.warnings,
                });
                flowTracker.endMetadataFlow(sessionId);
                return res.status(400).json({
                    error: "Metadata validation failed",
                    warnings: validationResult.warnings,
                    recommendation: "Please ensure your metadata URI is accessible and contains valid 'name' and 'symbol' fields. Consider using /api/generate-metadata endpoint to create properly formatted metadata."
                });
            }
            
            // For non-critical warnings, log them but continue
            console.log("⚠️  Continuing with token creation despite metadata warnings...");
        } else {
            console.log("✅ Metadata validation passed");
        }

        const tokenDetails = { name, symbol, uri, supply, decimals, recipientWallet };
        console.log("Начинаем ШАГ 1-4: createTokenAndMetadata (полный процесс)");
        
        // Mint + metadata (одна транзакция, без отдельного addTokenMetadata)
        const result = await createTokenAndMetadata(tokenDetails, sessionId);
        
        const response: any = {
            message: "Token and metadata successfully created.",
            mintAddress: result.mintAddress,
            transactionSignature: result.mintTx, 
            explorerLinkCreate: solanaTxUrl(result.mintTx, 'devnet'),
            solscanTokenLink: solscanTokenUrl(result.mintAddress, 'devnet'),
            solscanTxLink: solscanTxUrl(result.mintTx, 'devnet'),
            ataAddress: result.ata,
            recipientWallet: recipientWallet || "service wallet",
            sessionId: sessionId,
        };
        
        // Handle authority revocation if requested
        const revokedAuthorities: string[] = [];
        const revocationErrors: string[] = [];
        
        if (shouldRevokeFreezeAuth) {
            try {
                console.log("🔒 Revoking freeze authority as requested...");
                const freezeAuthSig = await revokeFreezeAuthority(result.mintAddress);
                revokedAuthorities.push('freeze');
                response.revokeFreezeAuthorityTx = freezeAuthSig;
                response.revokeFreezeAuthorityLink = solanaTxUrl(freezeAuthSig, 'devnet');
                console.log(`✅ Freeze authority revoked: ${freezeAuthSig}`);
                flowTracker.addFlowStep(sessionId, 'Freeze Authority Revoked', 'success', {
                    transactionSignature: freezeAuthSig
                });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`❌ Failed to revoke freeze authority: ${errorMsg}`);
                revocationErrors.push(`freeze: ${errorMsg}`);
                flowTracker.addFlowStep(sessionId, 'Freeze Authority Revocation Failed', 'error', {
                    error: errorMsg
                });
            }
        }
        
        if (shouldRevokeMintAuth) {
            try {
                console.log("🔒 Revoking mint authority as requested...");
                const mintAuthSig = await revokeMintAuthority(result.mintAddress);
                revokedAuthorities.push('mint');
                response.revokeMintAuthorityTx = mintAuthSig;
                response.revokeMintAuthorityLink = solanaTxUrl(mintAuthSig, 'devnet');
                console.log(`✅ Mint authority revoked: ${mintAuthSig}`);
                flowTracker.addFlowStep(sessionId, 'Mint Authority Revoked', 'success', {
                    transactionSignature: mintAuthSig
                });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`❌ Failed to revoke mint authority: ${errorMsg}`);
                revocationErrors.push(`mint: ${errorMsg}`);
                flowTracker.addFlowStep(sessionId, 'Mint Authority Revocation Failed', 'error', {
                    error: errorMsg
                });
            }
        }
        
        // Update response message based on revocations
        if (revokedAuthorities.length > 0) {
            response.message = `Token created successfully. Revoked authorities: ${revokedAuthorities.join(', ')}.`;
        }
        
        if (revocationErrors.length > 0) {
            response.revocationErrors = revocationErrors;
            if (revokedAuthorities.length > 0) {
                response.message += ` Note: Some authority revocations failed. You can retry using /api/revoke-freeze-authority or /api/revoke-mint-authority endpoints.`;
            } else {
                response.message = `Token created successfully, but authority revocation failed. You can retry using /api/revoke-freeze-authority or /api/revoke-mint-authority endpoints.`;
            }
        }
        
        // Include warnings in response if metadata had issues
        if (validationResult.warnings.length > 0) {
            response.warnings = validationResult.warnings;
            response.note = "Token created successfully, but metadata may not display properly on Solscan due to the warnings above. Consider using /api/generate-metadata endpoint for properly formatted metadata.";
        }
        
        // End flow tracking
        const finalFlow = flowTracker.endMetadataFlow(sessionId);
        if (finalFlow) {
            response.metadataFlowSummary = flowTracker.generateTroubleshootingReport(finalFlow);
        }
        
        res.status(200).json(response);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`❌ Ошибка при создании токена: ${errorMessage}`, error);
        res.status(500).json({ 
            error: errorMessage, 
            details: "An error occurred during token creation or metadata addition." 
        });
    }
}

