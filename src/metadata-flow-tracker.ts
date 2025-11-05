// src/metadata-flow-tracker.ts

/**
 * Metadata Flow Tracker
 * 
 * This module provides detailed tracking and logging of metadata flow through the system.
 * It helps debug issues where metadata appears on Solana Explorer but not on Solscan.
 * 
 * Usage:
 * import { trackMetadataGeneration, trackTokenCreation, trackMetadataValidation } from './metadata-flow-tracker';
 */

import axios from 'axios';

export interface MetadataFlowStep {
    step: string;
    timestamp: Date;
    status: 'success' | 'warning' | 'error';
    details: any;
}

export interface MetadataFlowReport {
    sessionId: string;
    startTime: Date;
    endTime?: Date;
    steps: MetadataFlowStep[];
    summary: {
        totalSteps: number;
        successSteps: number;
        warningSteps: number;
        errorSteps: number;
    };
}

const activeFlows: Map<string, MetadataFlowReport> = new Map();

/**
 * Start tracking a new metadata flow
 */
export function startMetadataFlow(sessionId: string): MetadataFlowReport {
    const flow: MetadataFlowReport = {
        sessionId,
        startTime: new Date(),
        steps: [],
        summary: {
            totalSteps: 0,
            successSteps: 0,
            warningSteps: 0,
            errorSteps: 0,
        }
    };
    
    activeFlows.set(sessionId, flow);
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔍 METADATA FLOW TRACKING STARTED`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`Start Time: ${flow.startTime.toISOString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return flow;
}

/**
 * Add a step to the flow
 */
export function addFlowStep(
    sessionId: string,
    step: string,
    status: 'success' | 'warning' | 'error',
    details: any
): void {
    const flow = activeFlows.get(sessionId);
    if (!flow) {
        console.warn(`⚠️  No active flow found for session: ${sessionId}`);
        return;
    }
    
    const flowStep: MetadataFlowStep = {
        step,
        timestamp: new Date(),
        status,
        details
    };
    
    flow.steps.push(flowStep);
    flow.summary.totalSteps++;
    
    if (status === 'success') {
        flow.summary.successSteps++;
    } else if (status === 'warning') {
        flow.summary.warningSteps++;
    } else if (status === 'error') {
        flow.summary.errorSteps++;
    }
    
    // Log the step
    const icon = status === 'success' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    const elapsed = flowStep.timestamp.getTime() - flow.startTime.getTime();
    console.log(`${icon} [+${elapsed}ms] ${step}`);
    
    if (typeof details === 'object' && Object.keys(details).length > 0) {
        console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
}

/**
 * End the flow and generate report
 */
export function endMetadataFlow(sessionId: string): MetadataFlowReport | null {
    const flow = activeFlows.get(sessionId);
    if (!flow) {
        console.warn(`⚠️  No active flow found for session: ${sessionId}`);
        return null;
    }
    
    flow.endTime = new Date();
    const duration = flow.endTime.getTime() - flow.startTime.getTime();
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 METADATA FLOW TRACKING COMPLETED`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Summary:`);
    console.log(`  Total Steps: ${flow.summary.totalSteps}`);
    console.log(`  ✅ Success: ${flow.summary.successSteps}`);
    console.log(`  ⚠️  Warnings: ${flow.summary.warningSteps}`);
    console.log(`  ❌ Errors: ${flow.summary.errorSteps}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    activeFlows.delete(sessionId);
    return flow;
}

/**
 * Track metadata generation step
 */
export function trackMetadataGeneration(sessionId: string, data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    name: string;
    symbol: string;
    description: string;
}): void {
    addFlowStep(sessionId, 'Metadata Generation Request Received', 'success', {
        fileName: data.fileName,
        fileSize: `${data.fileSize} bytes`,
        mimeType: data.mimeType,
        tokenName: data.name,
        tokenSymbol: data.symbol,
        hasDescription: !!data.description,
    });
}

/**
 * Track image upload to IPFS
 */
export function trackImageUpload(sessionId: string, data: {
    ipfsHash: string;
    imageUri: string;
}): void {
    addFlowStep(sessionId, 'Image Uploaded to IPFS', 'success', {
        ipfsHash: data.ipfsHash,
        imageUri: data.imageUri,
        gateway: 'gateway.pinata.cloud',
    });
}

/**
 * Track metadata JSON creation
 */
export function trackMetadataJsonCreation(sessionId: string, metadata: any): void {
    addFlowStep(sessionId, 'Metadata JSON Created', 'success', {
        structure: {
            name: metadata.name,
            symbol: metadata.symbol,
            hasImage: !!metadata.image,
            hasDescription: !!metadata.description,
            hasAttributes: Array.isArray(metadata.attributes),
            hasProperties: !!metadata.properties,
            category: metadata.properties?.category,
            filesCount: metadata.properties?.files?.length || 0,
        }
    });
    
    // Validate critical fields for Solscan compatibility
    const warnings: string[] = [];
    
    if (!metadata.properties?.category) {
        warnings.push('Missing properties.category - Solscan may not display correctly');
    } else if (metadata.properties.category !== 'fungible') {
        warnings.push(`properties.category is "${metadata.properties.category}" - should be "fungible" for tokens`);
    }
    
    if (!metadata.properties?.files || metadata.properties.files.length === 0) {
        warnings.push('Missing properties.files array - Solscan requires this for proper display');
    }
    
    if (!metadata.image) {
        warnings.push('Missing image field - token logo will not display on Solscan');
    }
    
    if (warnings.length > 0) {
        addFlowStep(sessionId, 'Metadata Validation Warnings', 'warning', { warnings });
    }
}

/**
 * Track metadata JSON upload to IPFS
 */
export function trackMetadataUpload(sessionId: string, data: {
    ipfsHash: string;
    metadataUri: string;
}): void {
    addFlowStep(sessionId, 'Metadata JSON Uploaded to IPFS', 'success', {
        ipfsHash: data.ipfsHash,
        metadataUri: data.metadataUri,
        gateway: 'gateway.pinata.cloud',
    });
}

/**
 * Track token creation request
 */
export function trackTokenCreationRequest(sessionId: string, data: {
    name: string;
    symbol: string;
    uri: string;
    supply: string;
    decimals: string;
    recipientWallet?: string;
}): void {
    addFlowStep(sessionId, 'Token Creation Request Received', 'success', {
        name: data.name,
        symbol: data.symbol,
        uri: data.uri,
        supply: data.supply,
        decimals: data.decimals,
        recipientWallet: data.recipientWallet || 'service wallet',
    });
}

/**
 * Track metadata URI validation
 */
export async function trackMetadataUriValidation(sessionId: string, uri: string): Promise<void> {
    addFlowStep(sessionId, 'Validating Metadata URI', 'success', { uri });
    
    try {
        const response = await axios.get(uri, { timeout: 5000 });
        const metadata = response.data;
        
        addFlowStep(sessionId, 'Metadata URI Accessible', 'success', {
            statusCode: response.status,
            contentType: response.headers['content-type'],
        });
        
        // Validate metadata structure
        const requiredFields = ['name', 'symbol'];
        const missingFields = requiredFields.filter(field => !metadata[field]);
        
        if (missingFields.length > 0) {
            addFlowStep(sessionId, 'Metadata Structure Validation Failed', 'error', {
                missingFields,
                recommendation: 'Metadata is missing required fields for Solscan display',
            });
        } else {
            addFlowStep(sessionId, 'Metadata Structure Valid', 'success', {
                hasRequiredFields: true,
                hasImage: !!metadata.image,
                hasProperties: !!metadata.properties,
                category: metadata.properties?.category,
            });
        }
        
        // Check if image URI is accessible
        if (metadata.image) {
            try {
                const imageResponse = await axios.head(metadata.image, { timeout: 5000 });
                addFlowStep(sessionId, 'Image URI Accessible', 'success', {
                    imageUri: metadata.image,
                    contentType: imageResponse.headers['content-type'],
                });
            } catch (error) {
                addFlowStep(sessionId, 'Image URI Not Accessible', 'warning', {
                    imageUri: metadata.image,
                    error: error instanceof Error ? error.message : String(error),
                    impact: 'Token logo will not display on Solscan',
                });
            }
        } else {
            addFlowStep(sessionId, 'No Image URI Found', 'warning', {
                impact: 'Token logo will not display on Solscan',
            });
        }
        
    } catch (error) {
        addFlowStep(sessionId, 'Metadata URI Not Accessible', 'error', {
            uri,
            error: error instanceof Error ? error.message : String(error),
            impact: 'Token will not display properly on Solscan',
            recommendation: 'Use /api/generate-metadata endpoint to create properly formatted metadata',
        });
    }
}

/**
 * Track on-chain token creation
 */
export function trackOnChainCreation(sessionId: string, data: {
    mintAddress: string;
    ata: string;
    transactionSignature: string;
}): void {
    addFlowStep(sessionId, 'On-Chain Token Created', 'success', {
        mintAddress: data.mintAddress,
        associatedTokenAccount: data.ata,
        transactionSignature: data.transactionSignature,
    });
    
    addFlowStep(sessionId, 'Explorer Links Generated', 'success', {
        solanaExplorer: `https://explorer.solana.com/address/${data.mintAddress}/metadata?cluster=devnet`,
        solscan: `https://solscan.io/token/${data.mintAddress}?cluster=devnet`,
        transaction: `https://solscan.io/tx/${data.transactionSignature}?cluster=devnet`,
    });
}

/**
 * Track metadata account creation
 */
export function trackMetadataAccountCreation(sessionId: string, details: any): void {
    addFlowStep(sessionId, 'Metadata Account Created On-Chain', 'success', {
        metadataAccountCreated: true,
        details: {
            updateAuthority: details.updateAuthority,
            mint: details.mint,
            tokenStandard: details.tokenStandard,
            isMutable: details.isMutable,
        },
        note: 'This account stores the on-chain metadata that links to the off-chain JSON',
    });
}

/**
 * Generate a detailed report for troubleshooting
 */
export function generateTroubleshootingReport(flow: MetadataFlowReport): string {
    let report = '\n';
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    report += '🔍 METADATA FLOW TROUBLESHOOTING REPORT\n';
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    report += `Session ID: ${flow.sessionId}\n`;
    report += `Duration: ${flow.endTime ? flow.endTime.getTime() - flow.startTime.getTime() : 'In Progress'}ms\n\n`;
    
    report += 'Summary:\n';
    report += `  Total Steps: ${flow.summary.totalSteps}\n`;
    report += `  ✅ Success: ${flow.summary.successSteps}\n`;
    report += `  ⚠️  Warnings: ${flow.summary.warningSteps}\n`;
    report += `  ❌ Errors: ${flow.summary.errorSteps}\n\n`;
    
    if (flow.summary.errorSteps > 0) {
        report += '❌ ERRORS DETECTED:\n';
        flow.steps
            .filter(s => s.status === 'error')
            .forEach(step => {
                report += `  - ${step.step}\n`;
                report += `    Details: ${JSON.stringify(step.details, null, 2)}\n`;
            });
        report += '\n';
    }
    
    if (flow.summary.warningSteps > 0) {
        report += '⚠️  WARNINGS:\n';
        flow.steps
            .filter(s => s.status === 'warning')
            .forEach(step => {
                report += `  - ${step.step}\n`;
                report += `    Details: ${JSON.stringify(step.details, null, 2)}\n`;
            });
        report += '\n';
    }
    
    report += 'RECOMMENDATIONS:\n';
    
    if (flow.summary.errorSteps > 0) {
        report += '  1. Fix all errors before proceeding\n';
        report += '  2. Verify metadata URI is accessible\n';
        report += '  3. Check IPFS gateway status\n';
    } else if (flow.summary.warningSteps > 0) {
        report += '  1. Address warnings to ensure Solscan compatibility\n';
        report += '  2. Use /api/generate-metadata endpoint for guaranteed format\n';
        report += '  3. Verify metadata JSON structure matches Metaplex standard\n';
    } else {
        report += '  ✅ All checks passed!\n';
        report += '  ✅ Metadata should be visible on Solscan within 2-5 minutes\n';
        report += '  ✅ If not visible, wait longer or check IPFS gateway\n';
    }
    
    report += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    return report;
}

/**
 * Get active flow
 */
export function getActiveFlow(sessionId: string): MetadataFlowReport | undefined {
    return activeFlows.get(sessionId);
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
    return `metadata-flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
