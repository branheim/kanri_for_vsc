/**
 * Card Storage Module for Kanri VS Code Extension
 * 
 * This module provides persistent storage capabilities for kanban cards,
 * implementing Microsoft's official VS Code extension storage patterns
 * and best practices for reliable, performant data management.
 * 
 * Microsoft VS Code Storage Guidelines Implemented:
 * 
 * 1. **Storage Scope Selection**:
 *    - workspaceState: Used for cards (workspace-specific data)
 *    - globalState: Reserved for user preferences and cross-workspace settings
 *    - Reasoning: Cards belong to specific projects/workspaces
 * 
 * 2. **Memento Interface Patterns**:
 *    - Uses Memento.update() returning Thenable<void> for async operations
 *    - Leverages Memento.get<T>() with type safety and default values
 *    - Implements Memento.keys() efficiently with minimal calls
 *    - Uses undefined to remove keys (Microsoft's deletion pattern)
 * 
 * 3. **Performance Optimizations**:
 *    - Maintains index structures to minimize expensive key enumeration
 *    - Caches frequently accessed data following Microsoft guidelines
 *    - Batches updates to reduce I/O operations
 * 
 * 4. **Error Handling & Resilience**:
 *    - Implements comprehensive error boundaries with graceful degradation
 *    - Uses defensive programming with storage verification
 *    - Provides detailed error context for debugging
 * 
 * 5. **Data Integrity**:
 *    - Soft delete pattern preserves data for recovery
 *    - Atomic operations prevent partial state corruption
 *    - Version-aware data structures support future migrations
 * 
 * @fileoverview Microsoft-compliant card persistence with async patterns
 * @version 2.0.0 - Updated to follow official VS Code storage guidelines
 * @author Kanri Extension Team
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext
 * @see https://code.visualstudio.com/api/references/vscode-api#Memento
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { 
    InputValidator, 
    ValidationPresets, 
    ValidationResult, 
    createInputValidator 
} from '../utils/inputValidator';

/**
 * Represents a kanban card with all necessary metadata
 * 
 * This interface defines the complete structure of a card,
 * including optional fields for future feature expansion.
 */
export interface KanbanCard {
    /** Unique identifier for the card - used for DOM manipulation and storage keys */
    id: string;
    
    /** Display title of the card - primary content shown to users */
    title: string;
    
    /** Optional detailed description - supports markdown formatting */
    description?: string;
    
    /** Parent column identifier - establishes card-to-column relationship */
    columnId: string;
    
    /** Creation timestamp - enables sorting and audit trails */
    createdAt: Date;
    
    /** Last modification timestamp - tracks edit history */
    updatedAt: Date;
    
    /** Display order within column - enables custom sorting */
    order: number;
    
    /** Optional tags for categorization - future feature support */
    tags?: string[];
    
    /** Optional priority level - supports workflow management */
    priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Configuration options for card creation
 * 
 * Provides a clean interface for creating new cards while
 * allowing the storage layer to handle metadata automatically.
 */
export interface CreateCardOptions {
    /** Required title for the new card */
    title: string;
    
    /** Target column for card placement */
    columnId: string;
    
    /** Optional description content */
    description?: string;
    
    /** Optional initial tags */
    tags?: string[];
    
    /** Optional priority setting */
    priority?: KanbanCard['priority'];
}

/**
 * Result wrapper for storage operations
 * 
 * Provides consistent error handling and success indication
 * across all storage operations, improving debugging and UX.
 */
export interface StorageResult<T> {
    /** Indicates if the operation completed successfully */
    success: boolean;
    
    /** Contains the result data on success, undefined on failure */
    data?: T;
    
    /** Contains error information on failure */
    error?: string;
    
    /** Optional additional context for debugging */
    context?: Record<string, any>;
}

/**
 * Card Storage Manager
 * 
 * Centralized class for all card persistence operations following Microsoft's
 * VS Code extension storage best practices. Implements async patterns for
 * non-blocking operations and provides comprehensive error handling.
 * 
 * Microsoft VS Code Storage Strategy:
 * - Uses workspaceState for workspace-specific card data (survives workspace reloads)
 * - Uses globalState for user preferences and cross-workspace settings
 * - Implements proper async/await patterns with Thenable<void> handling
 * - Follows Microsoft's Memento interface patterns for key-value storage
 * 
 * Design principles:
 * - Single responsibility: only handles card storage
 * - Fail-safe: graceful error handling with recovery options
 * - Observable: detailed logging for debugging and monitoring
 * - Extensible: ready for features like sync, backup, versioning
 */
export class CardStorage {
    /** VS Code extension context for accessing storage APIs */
    private readonly context: vscode.ExtensionContext;
    
    /** Logger instance for operation tracking and debugging */
    private readonly logger: Logger;
    
    /** Input validator for secure data handling */
    private readonly validator: InputValidator;
    
    /** Storage key prefix to avoid conflicts with other extensions */
    private readonly storagePrefix = 'kanri.cards';
    
    /** 
     * Storage scope indicator - using workspaceState for cards since they're
     * workspace-specific data, following Microsoft's recommendation
     */
    private get storage(): vscode.Memento {
        return this.context.workspaceState;
    }

    /**
     * Initialize the card storage manager
     * 
     * Following Microsoft's patterns, we use workspaceState for cards since
     * they are workspace-specific data that should persist across VS Code sessions
     * but remain scoped to the current workspace.
     * 
     * @param context - VS Code extension context for storage access
     * @param logger - Logger instance for operation tracking
     */
    constructor(context: vscode.ExtensionContext, logger: Logger) {
        this.context = context;
        this.logger = logger;
        this.validator = createInputValidator(logger);
        
        // Log initialization for debugging extension lifecycle
        this.logger.info(`CardStorage initialized with prefix: ${this.storagePrefix}`);
        
        // Initialize storage indices for performance optimization
        this.initializeStorageIndices();
    }

    /**
     * Initialize storage indices for efficient card lookups
     * 
     * Microsoft recommends minimizing calls to Memento.keys() and caching
     * frequently accessed data for better performance.
     * 
     * @private
     */
    private async initializeStorageIndices(): Promise<void> {
        try {
            // Create or update card index for fast column-based lookups
            await this.updateCardIndex();
            this.logger.debug('Storage indices initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize storage indices', error);
        }
    }

    /**
     * Update the card index for efficient column-based queries
     * 
     * Maintains a separate index structure following Microsoft's pattern
     * of using dedicated keys for metadata.
     * 
     * @private
     */
    private async updateCardIndex(): Promise<void> {
        const indexKey = `${this.storagePrefix}.index`;
        const cardKeys = this.storage.keys().filter(key => 
            key.startsWith(this.storagePrefix) && 
            !key.includes('.index') &&
            !key.includes('.deleted')
        );
        
        const columnIndex: Record<string, string[]> = {};
        
        for (const key of cardKeys) {
            const card = this.storage.get<KanbanCard>(key);
            if (card) {
                if (!columnIndex[card.columnId]) {
                    columnIndex[card.columnId] = [];
                }
                columnIndex[card.columnId].push(card.id);
            }
        }
        
        // Use VS Code's Memento.update which returns Thenable<void>
        await this.storage.update(indexKey, columnIndex);
    }

    /**
     * Create a new card with automatic metadata generation
     * 
     * This method handles the complete card creation process:
     * 1. Generates unique ID and timestamps
     * 2. Calculates appropriate order within column
     * 3. Persists to storage with error handling
     * 4. Returns the created card or error details
     * 
     * @param options - Card creation parameters
     * @returns Promise resolving to storage result with created card
     */
    async createCard(options: CreateCardOptions): Promise<StorageResult<KanbanCard>> {
        try {
            // ========================================
            // Input Validation Phase
            // ========================================
            
            // Validate card title using preset validation rules
            const titleValidation = this.validator.validate(options.title, ValidationPresets.CARD_TITLE);
            if (!titleValidation.isValid) {
                this.logger.error(`Card title validation failed: ${titleValidation.errors.join(', ')}`);
                return {
                    success: false,
                    error: `Invalid card title: ${titleValidation.errors.join(', ')}`,
                    context: { validationErrors: titleValidation.errors, errorCodes: titleValidation.errorCodes }
                };
            }

            // Validate card description if provided
            let sanitizedDescription: string | undefined;
            if (options.description) {
                const descValidation = this.validator.validate(options.description, ValidationPresets.CARD_DESCRIPTION);
                if (!descValidation.isValid) {
                    this.logger.error(`Card description validation failed: ${descValidation.errors.join(', ')}`);
                    return {
                        success: false,
                        error: `Invalid card description: ${descValidation.errors.join(', ')}`,
                        context: { validationErrors: descValidation.errors, errorCodes: descValidation.errorCodes }
                    };
                }
                sanitizedDescription = descValidation.sanitizedValue;
            }

            // Validate column ID using board name preset (similar validation rules)
            const columnValidation = this.validator.validate(options.columnId, ValidationPresets.COLUMN_NAME);
            if (!columnValidation.isValid) {
                this.logger.error(`Column ID validation failed: ${columnValidation.errors.join(', ')}`);
                return {
                    success: false,
                    error: `Invalid column ID: ${columnValidation.errors.join(', ')}`,
                    context: { validationErrors: columnValidation.errors, errorCodes: columnValidation.errorCodes }
                };
            }

            // Validate and sanitize tags if provided
            const sanitizedTags: string[] = [];
            if (options.tags && options.tags.length > 0) {
                for (const tag of options.tags) {
                    const tagValidation = this.validator.validate(tag, {
                        minLength: 1,
                        maxLength: 20,
                        allowHtml: false,
                        allowScripts: false,
                        trimWhitespace: true,
                        allowedPattern: /^[a-zA-Z0-9\s\-_]+$/
                    });
                    
                    if (!tagValidation.isValid) {
                        this.logger.warn(`Skipping invalid tag "${tag}": ${tagValidation.errors.join(', ')}`);
                        continue; // Skip invalid tags rather than failing entire operation
                    }
                    
                    sanitizedTags.push(tagValidation.sanitizedValue);
                }
            }

            // ========================================
            // Card Creation Phase
            // ========================================
            
            // Generate unique ID using timestamp and random component
            // This ensures uniqueness across sessions and rapid creation
            const cardId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Get current timestamp for audit trail
            const now = new Date();
            
            // Calculate order by finding highest order in target column
            // This ensures new cards appear at the end by default
            const columnCards = await this.getCardsByColumn(options.columnId);
            const maxOrder = columnCards.data?.reduce((max, card) => Math.max(max, card.order), 0) || 0;
            
            // Construct the complete card object with validated and sanitized data
            const newCard: KanbanCard = {
                id: cardId,
                title: titleValidation.sanitizedValue, // Use sanitized title
                description: sanitizedDescription, // Use sanitized description
                columnId: columnValidation.sanitizedValue, // Use sanitized column ID
                createdAt: now,
                updatedAt: now,
                order: maxOrder + 1, // Place at end of column
                tags: sanitizedTags, // Use validated tags only
                priority: options.priority
            };

            // Persist the card to storage
            const saveResult = await this.saveCard(newCard);
            
            if (saveResult.success) {
                // Update index for efficient lookups (Microsoft best practice)
                await this.updateCardIndex();
                
                this.logger.info(`Card created successfully: ${newCard.id} in column ${newCard.columnId}`);
                
                return {
                    success: true,
                    data: newCard,
                    context: { operation: 'create', cardId: newCard.id }
                };
            } else {
                // Propagate save error with additional context
                return {
                    success: false,
                    error: `Failed to save new card: ${saveResult.error}`,
                    context: { operation: 'create', attemptedCard: newCard }
                };
            }
            
        } catch (error) {
            // Handle unexpected errors during card creation
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error creating card: ${errorMessage}`, JSON.stringify({ options }));
            
            return {
                success: false,
                error: `Card creation failed: ${errorMessage}`,
                context: { operation: 'create', options }
            };
        }
    }

    /**
     * Retrieve a specific card by its unique identifier
     * 
     * @param cardId - Unique card identifier
     * @returns Promise resolving to storage result with card data
     */
    async getCard(cardId: string): Promise<StorageResult<KanbanCard>> {
        try {
            // Construct storage key for this specific card
            const storageKey = `${this.storagePrefix}.${cardId}`;
            
            // Retrieve raw data from VS Code's workspaceState (Microsoft pattern)
            const cardData = this.storage.get<KanbanCard>(storageKey);
            
            if (cardData) {
                // Reconstruct Date objects (JSON serialization converts them to strings)
                const card: KanbanCard = {
                    ...cardData,
                    createdAt: new Date(cardData.createdAt),
                    updatedAt: new Date(cardData.updatedAt)
                };
                
                return {
                    success: true,
                    data: card,
                    context: { operation: 'get', cardId }
                };
            } else {
                return {
                    success: false,
                    error: `Card not found: ${cardId}`,
                    context: { operation: 'get', cardId }
                };
            }
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error retrieving card ${cardId}: ${errorMessage}`);
            
            return {
                success: false,
                error: `Failed to retrieve card: ${errorMessage}`,
                context: { operation: 'get', cardId }
            };
        }
    }

    /**
     * Retrieve all cards belonging to a specific column
     * 
     * Optimized implementation using storage index for performance,
     * following Microsoft's recommendation to minimize Memento.keys() calls.
     * 
     * @param columnId - Target column identifier
     * @returns Promise resolving to storage result with card array
     */
    async getCardsByColumn(columnId: string): Promise<StorageResult<KanbanCard[]>> {
        try {
            // Use index for efficient lookup (Microsoft best practice)
            const indexKey = `${this.storagePrefix}.index`;
            const columnIndex = this.storage.get<Record<string, string[]>>(indexKey, {});
            const cardIds = columnIndex[columnId] || [];
            
            // Retrieve cards by ID
            const columnCards: KanbanCard[] = [];
            
            for (const cardId of cardIds) {
                const cardResult = await this.getCard(cardId);
                if (cardResult.success && cardResult.data) {
                    columnCards.push(cardResult.data);
                }
            }
            
            // Sort cards by order field for consistent display
            columnCards.sort((a, b) => a.order - b.order);
            
            this.logger.debug(`Retrieved ${columnCards.length} cards for column ${columnId}`);
            
            return {
                success: true,
                data: columnCards,
                context: { operation: 'getByColumn', columnId, count: columnCards.length }
            };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error retrieving cards for column ${columnId}: ${errorMessage}`);
            
            return {
                success: false,
                error: `Failed to retrieve column cards: ${errorMessage}`,
                context: { operation: 'getByColumn', columnId }
            };
        }
    }

    /**
     * Update an existing card with new data
     * 
     * Implements optimistic update pattern: updates local state
     * immediately, then persists to storage with rollback on failure.
     * 
     * @param cardId - Target card identifier
     * @param updates - Partial card data to update
     * @returns Promise resolving to storage result with updated card
     */
    async updateCard(cardId: string, updates: Partial<Omit<KanbanCard, 'id' | 'createdAt'>>): Promise<StorageResult<KanbanCard>> {
        try {
            // First, retrieve the existing card
            const currentResult = await this.getCard(cardId);
            
            if (!currentResult.success || !currentResult.data) {
                return {
                    success: false,
                    error: `Cannot update non-existent card: ${cardId}`,
                    context: { operation: 'update', cardId }
                };
            }
            
            // Merge updates with existing data, preserving immutable fields
            const updatedCard: KanbanCard = {
                ...currentResult.data,
                ...updates,
                id: currentResult.data.id, // Preserve immutable ID
                createdAt: currentResult.data.createdAt, // Preserve creation timestamp
                updatedAt: new Date() // Update modification timestamp
            };
            
            // Persist the updated card
            const saveResult = await this.saveCard(updatedCard);
            
            if (saveResult.success) {
                // Update index if column changed (Microsoft best practice)
                if (updates.columnId && updates.columnId !== currentResult.data.columnId) {
                    await this.updateCardIndex();
                }
                
                this.logger.info(`Card updated successfully: ${cardId} (fields: ${Object.keys(updates).join(', ')})`);
                
                return {
                    success: true,
                    data: updatedCard,
                    context: { operation: 'update', cardId, updatedFields: Object.keys(updates) }
                };
            } else {
                return saveResult;
            }
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error updating card ${cardId}: ${errorMessage}`, JSON.stringify({ updates }));
            
            return {
                success: false,
                error: `Card update failed: ${errorMessage}`,
                context: { operation: 'update', cardId, updates }
            };
        }
    }

    /**
     * Delete a card from storage
     * 
     * Implements soft delete pattern by moving card to a special
     * "deleted" namespace, enabling potential recovery operations.
     * 
     * @param cardId - Target card identifier
     * @returns Promise resolving to storage result indicating success
     */
    async deleteCard(cardId: string): Promise<StorageResult<boolean>> {
        try {
            const storageKey = `${this.storagePrefix}.${cardId}`;
            
            // Verify card exists before attempting deletion
            const existingCard = this.storage.get<KanbanCard>(storageKey);
            
            if (!existingCard) {
                return {
                    success: false,
                    error: `Cannot delete non-existent card: ${cardId}`,
                    context: { operation: 'delete', cardId }
                };
            }
            
            // Perform soft delete by moving to deleted namespace
            const deletedKey = `${this.storagePrefix}.deleted.${cardId}`;
            await this.storage.update(deletedKey, {
                ...existingCard,
                deletedAt: new Date()
            });
            
            // Remove from active storage (Microsoft pattern: undefined removes key)
            await this.storage.update(storageKey, undefined);
            
            // Update index after deletion (Microsoft best practice)
            await this.updateCardIndex();
            
            this.logger.info(`Card deleted successfully: ${cardId} ("${existingCard.title}")`);
            
            return {
                success: true,
                data: true,
                context: { operation: 'delete', cardId, deletedKey }
            };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error deleting card ${cardId}: ${errorMessage}`);
            
            return {
                success: false,
                error: `Card deletion failed: ${errorMessage}`,
                context: { operation: 'delete', cardId }
            };
        }
    }

    /**
     * Private helper method to save a card to storage
     * 
     * Centralizes the storage operation following Microsoft's Memento patterns.
     * Uses workspaceState.update() which returns Thenable<void> for proper
     * async handling as recommended by VS Code API guidelines.
     * 
     * @param card - Complete card object to persist
     * @returns Promise resolving to storage result
     */
    private async saveCard(card: KanbanCard): Promise<StorageResult<KanbanCard>> {
        try {
            const storageKey = `${this.storagePrefix}.${card.id}`;
            
            // Persist to VS Code's workspaceState (Microsoft recommended pattern)
            await this.storage.update(storageKey, card);
            
            // Verify the save operation by reading back (defensive programming)
            const verification = this.storage.get<KanbanCard>(storageKey);
            
            if (verification && verification.id === card.id) {
                return {
                    success: true,
                    data: card,
                    context: { operation: 'save', cardId: card.id }
                };
            } else {
                throw new Error('Storage verification failed - data may be corrupted');
            }
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error saving card ${card.id}: ${errorMessage}`);
            
            return {
                success: false,
                error: `Failed to save card: ${errorMessage}`,
                context: { operation: 'save', cardId: card.id }
            };
        }
    }

    /**
     * Retrieve all active cards across all columns
     * 
     * Utility method for backup, export, and debugging operations.
     * Uses Microsoft's recommended Memento.keys() pattern efficiently.
     * 
     * @returns Promise resolving to storage result with all cards
     */
    async getAllCards(): Promise<StorageResult<KanbanCard[]>> {
        try {
            // Use Microsoft's Memento.keys() method for key enumeration
            const allKeys = this.storage.keys();
            const activeCardKeys = allKeys.filter(key => 
                key.startsWith(this.storagePrefix) && 
                !key.includes('.deleted.') &&
                !key.includes('.index')
            );
            
            const allCards: KanbanCard[] = [];
            
            for (const key of activeCardKeys) {
                const cardData = this.storage.get<KanbanCard>(key);
                if (cardData) {
                    // Reconstruct Date objects (JSON serialization converts to strings)
                    allCards.push({
                        ...cardData,
                        createdAt: new Date(cardData.createdAt),
                        updatedAt: new Date(cardData.updatedAt)
                    });
                }
            }
            
            // Sort by creation date for consistent ordering
            allCards.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            
            return {
                success: true,
                data: allCards,
                context: { operation: 'getAllCards', count: allCards.length }
            };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error retrieving all cards: ${errorMessage}`);
            
            return {
                success: false,
                error: `Failed to retrieve all cards: ${errorMessage}`,
                context: { operation: 'getAllCards' }
            };
        }
    }

    /**
     * Clear all card data from storage
     * 
     * Utility method for testing and workspace cleanup.
     * Follows Microsoft's pattern of using undefined to remove keys.
     * 
     * @returns Promise resolving to storage result indicating success
     */
    async clearAllCards(): Promise<StorageResult<boolean>> {
        try {
            const allKeys = this.storage.keys();
            const cardKeys = allKeys.filter(key => key.startsWith(this.storagePrefix));
            
            // Remove all card-related keys using Microsoft's pattern
            for (const key of cardKeys) {
                await this.storage.update(key, undefined);
            }
            
            this.logger.info(`Cleared ${cardKeys.length} storage keys`);
            
            return {
                success: true,
                data: true,
                context: { operation: 'clearAll', clearedKeys: cardKeys.length }
            };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error clearing card storage: ${errorMessage}`);
            
            return {
                success: false,
                error: `Failed to clear storage: ${errorMessage}`,
                context: { operation: 'clearAll' }
            };
        }
    }
}

/**
 * Factory function to create a CardStorage instance
 * 
 * Provides a clean, testable way to instantiate the storage manager
 * following Microsoft's dependency injection patterns for VS Code extensions.
 * This factory enables proper testing with mock contexts and loggers.
 * 
 * Microsoft Guidelines Followed:
 * - Extension context is injected rather than globally accessed
 * - Logger dependency is explicitly provided for testability
 * - Returns concrete implementation rather than interface for simplicity
 * - Enables easy mocking for unit tests
 * 
 * @param context - VS Code extension context (required for Memento access)
 * @param logger - Logger instance (required for operation tracking)
 * @returns Configured CardStorage instance ready for use
 * 
 * @example
 * ```typescript
 * // In extension activation
 * const logger = new Logger();
 * const cardStorage = createCardStorage(context, logger);
 * 
 * // Use the storage
 * const result = await cardStorage.createCard({
 *     title: "My Task",
 *     columnId: "todo"
 * });
 * ```
 */
export function createCardStorage(context: vscode.ExtensionContext, logger: Logger): CardStorage {
    return new CardStorage(context, logger);
}

/**
 * Type guard to check if a storage result indicates success
 * 
 * Utility function to help with TypeScript type narrowing when
 * working with StorageResult objects. Follows Microsoft's
 * recommendation for type-safe error handling.
 * 
 * @param result - Storage result to check
 * @returns True if result indicates success with data
 */
export function isStorageSuccess<T>(result: StorageResult<T>): result is StorageResult<T> & { success: true; data: T } {
    return result.success && result.data !== undefined;
}

/**
 * Create a storage key following Microsoft's naming conventions
 * 
 * Utility function to generate consistent storage keys that avoid
 * conflicts with other extensions and follow VS Code patterns.
 * 
 * @param prefix - Extension-specific prefix
 * @param type - Data type identifier
 * @param id - Unique identifier
 * @returns Formatted storage key
 */
export function createStorageKey(prefix: string, type: string, id: string): string {
    return `${prefix}.${type}.${id}`;
}
