/**
 * Integration Example: Webview Communication Router
 * 
 * This file demonstrates how to integrate the WebviewMessageRouter
 * with the existing Kanri extension, showing practical usage patterns
 * and best practices for maintaining clean, scalable code.
 * 
 * @fileoverview Example integration showing router usage patterns
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { createCardStorage, CardStorage } from '../storage/cardStorage';
import { 
    WebviewMessageRouter, 
    createMessageRouter, 
    MessageContext,
    CreateCardPayload,
    MoveCardPayload,
    UpdateCardPayload,
    DeleteCardPayload 
} from './webviewRouter';

/**
 * Enhanced webview creation with integrated message router
 * 
 * Shows how to replace direct message handling with the router pattern
 * for better maintainability and type safety. This approach scales
 * well as new message types are added.
 */
export async function createKanbanBoardWithRouter(
    context: vscode.ExtensionContext, 
    boardName: string
): Promise<void> {
    // Initialize dependencies with dependency injection pattern
    const logger = new Logger();
    const cardStorage = createCardStorage(context, logger);
    const messageRouter = createMessageRouter(logger);
    
    // Create webview panel following Microsoft patterns
    const panel = vscode.window.createWebviewPanel(
        'kanriBoard',
        `Kanri Board: ${boardName}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
        }
    );

    // Register all card operation handlers with the router
    await registerCardHandlers(messageRouter, cardStorage);
    
    // Set up bidirectional message handling
    panel.webview.onDidReceiveMessage(async (message) => {
        const messageContext: MessageContext = {
            panel,
            logger,
            originalMessage: message,
            extensionContext: context
        };
        
        try {
            const response = await messageRouter.processMessage(message, messageContext);
            
            // Send response back to webview if needed
            if (response && !response.success) {
                await messageRouter.sendMessage(panel, 'error', {
                    originalRequest: message.requestId,
                    error: response.error
                });
            }
        } catch (error) {
            logger.error(`Failed to process webview message: ${error}`);
        }
    });

    // Clean up router when panel is disposed
    panel.onDidDispose(() => {
        messageRouter.dispose();
    });
    
    logger.info(`Kanban board "${boardName}" created with message router`);
}

/**
 * Register all card-related message handlers
 * 
 * Centralizes handler registration for better organization and
 * easier testing. Each handler focuses on a single responsibility
 * and follows the same async pattern for consistency.
 */
async function registerCardHandlers(
    router: WebviewMessageRouter, 
    cardStorage: CardStorage
): Promise<void> {
    
    // Handler for creating new cards
    router.registerHandler<CreateCardPayload, any>('createCard', async (payload, context) => {
        const startTime = Date.now();
        
        try {
            // Validate payload structure
            if (!payload.title?.trim() || !payload.columnId?.trim()) {
                return {
                    requestId: context.originalMessage.requestId,
                    success: false,
                    error: 'Title and columnId are required for card creation',
                    processingTime: Date.now() - startTime
                };
            }

            // Create card using storage system
            const result = await cardStorage.createCard({
                title: payload.title.trim(),
                columnId: payload.columnId,
                description: payload.description,
                tags: payload.tags || []
            });

            if (result.success && result.data) {
                // Notify webview of successful creation
                await router.sendMessage(context.panel, 'cardCreated', {
                    card: result.data
                });

                context.logger.info(`Card created: ${result.data.id}`);
                
                return {
                    requestId: context.originalMessage.requestId,
                    success: true,
                    data: result.data,
                    processingTime: Date.now() - startTime
                };
            } else {
                return {
                    requestId: context.originalMessage.requestId,
                    success: false,
                    error: result.error || 'Failed to create card',
                    processingTime: Date.now() - startTime
                };
            }
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            context.logger.error(`Error in createCard handler: ${errorMessage}`);
            
            return {
                requestId: context.originalMessage.requestId,
                success: false,
                error: `Card creation failed: ${errorMessage}`,
                processingTime: Date.now() - startTime
            };
        }
    });

    // Handler for moving cards between columns
    router.registerHandler<MoveCardPayload, any>('moveCard', async (payload, context) => {
        const startTime = Date.now();
        
        try {
            if (!payload.cardId?.trim() || !payload.targetColumnId?.trim()) {
                return {
                    requestId: context.originalMessage.requestId,
                    success: false,
                    error: 'CardId and targetColumnId are required for card movement',
                    processingTime: Date.now() - startTime
                };
            }

            // Update card position using storage system
            const result = await cardStorage.updateCard(payload.cardId, {
                columnId: payload.targetColumnId
            });

            if (result.success) {
                context.logger.info(`Card moved: ${payload.cardId} to ${payload.targetColumnId}`);
                
                return {
                    requestId: context.originalMessage.requestId,
                    success: true,
                    data: { cardId: payload.cardId, newColumn: payload.targetColumnId },
                    processingTime: Date.now() - startTime
                };
            } else {
                return {
                    requestId: context.originalMessage.requestId,
                    success: false,
                    error: result.error || 'Failed to move card',
                    processingTime: Date.now() - startTime
                };
            }
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            context.logger.error(`Error in moveCard handler: ${errorMessage}`);
            
            return {
                requestId: context.originalMessage.requestId,
                success: false,
                error: `Card movement failed: ${errorMessage}`,
                processingTime: Date.now() - startTime
            };
        }
    });

    // Handler for updating card content
    router.registerHandler<UpdateCardPayload, any>('updateCard', async (payload, context) => {
        const startTime = Date.now();
        
        try {
            if (!payload.cardId?.trim()) {
                return {
                    requestId: context.originalMessage.requestId,
                    success: false,
                    error: 'CardId is required for card updates',
                    processingTime: Date.now() - startTime
                };
            }

            // Update card using storage system
            const result = await cardStorage.updateCard(payload.cardId, payload.updates);

            if (result.success && result.data) {
                // Notify webview of successful update
                await router.sendMessage(context.panel, 'cardUpdated', {
                    card: result.data
                });

                context.logger.info(`Card updated: ${payload.cardId}`);
                
                return {
                    requestId: context.originalMessage.requestId,
                    success: true,
                    data: result.data,
                    processingTime: Date.now() - startTime
                };
            } else {
                return {
                    requestId: context.originalMessage.requestId,
                    success: false,
                    error: result.error || 'Failed to update card',
                    processingTime: Date.now() - startTime
                };
            }
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            context.logger.error(`Error in updateCard handler: ${errorMessage}`);
            
            return {
                requestId: context.originalMessage.requestId,
                success: false,
                error: `Card update failed: ${errorMessage}`,
                processingTime: Date.now() - startTime
            };
        }
    });

    // Handler for deleting cards
    router.registerHandler<DeleteCardPayload, any>('deleteCard', async (payload, context) => {
        const startTime = Date.now();
        
        try {
            if (!payload.cardId?.trim()) {
                return {
                    requestId: context.originalMessage.requestId,
                    success: false,
                    error: 'CardId is required for card deletion',
                    processingTime: Date.now() - startTime
                };
            }

            // Delete card using storage system (soft delete by default)
            const result = await cardStorage.deleteCard(payload.cardId);

            if (result.success) {
                // Notify webview of successful deletion
                await router.sendMessage(context.panel, 'cardDeleted', {
                    cardId: payload.cardId
                });

                context.logger.info(`Card deleted: ${payload.cardId}`);
                
                return {
                    requestId: context.originalMessage.requestId,
                    success: true,
                    data: { deletedCardId: payload.cardId },
                    processingTime: Date.now() - startTime
                };
            } else {
                return {
                    requestId: context.originalMessage.requestId,
                    success: false,
                    error: result.error || 'Failed to delete card',
                    processingTime: Date.now() - startTime
                };
            }
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            context.logger.error(`Error in deleteCard handler: ${errorMessage}`);
            
            return {
                requestId: context.originalMessage.requestId,
                success: false,
                error: `Card deletion failed: ${errorMessage}`,
                processingTime: Date.now() - startTime
            };
        }
    });
}
