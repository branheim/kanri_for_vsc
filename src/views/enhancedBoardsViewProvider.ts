/**
 * Enhanced Boards View Provider Following Microsoft VS Code Best Practices
 * 
 * Microsoft TreeDataProvider patterns implemented:
 * 1. Proper event-driven refresh using onDidChangeTreeData
 * 2. Async data loading with loading states
 * 3. Enhanced error handling and user feedback
 * 4. Resource disposal and cleanup
 * 5. Optimized refresh patterns to prevent excessive updates
 */

import * as vscode from 'vscode';
import { BoardManager } from '../managers/boardManager';
import { KanbanBoard } from '../config/defaults';
import { Logger } from '../utils/logger';

/**
 * Tree item for board representation
 */
export class BoardTreeItem extends vscode.TreeItem {
    constructor(
        public readonly board: KanbanBoard,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(board.name, collapsibleState);
        
        this.id = board.id;
        this.tooltip = this.buildTooltip(board);
        this.description = this.buildDescription(board);
        this.contextValue = 'kanriBoard';
        
        // Set command to open board when clicked
        this.command = {
            command: 'kanri.openBoard',
            title: 'Open Board',
            arguments: [board.id]
        };
        
        // Enhanced iconPath with fallback
        this.iconPath = new vscode.ThemeIcon('project');
    }

    private buildTooltip(board: KanbanBoard): string {
        const totalCards = board.columns.reduce((sum, col) => sum + col.cards.length, 0);
        const lastModified = board.lastModified ? new Date(board.lastModified).toLocaleDateString() : 'Never';
        
        return `${board.name}\n` +
               `Columns: ${board.columns.length}\n` +
               `Cards: ${totalCards}\n` +
               `Last Modified: ${lastModified}`;
    }

    private buildDescription(board: KanbanBoard): string {
        const totalCards = board.columns.reduce((sum, col) => sum + col.cards.length, 0);
        return `${board.columns.length} cols, ${totalCards} cards`;
    }
}

/**
 * Enhanced loading state item
 */
export class LoadingTreeItem extends vscode.TreeItem {
    constructor() {
        super('Loading boards...', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('loading~spin');
        this.description = 'Please wait...';
    }
}

/**
 * Enhanced error state item
 */
export class ErrorTreeItem extends vscode.TreeItem {
    constructor(errorMessage: string) {
        super('Error loading boards', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('error');
        this.description = 'Click to retry';
        this.tooltip = errorMessage;
        this.command = {
            command: 'kanri.refreshBoards',
            title: 'Retry Loading'
        };
    }
}

/**
 * Empty state item
 */
export class EmptyTreeItem extends vscode.TreeItem {
    constructor() {
        super('No boards found', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('inbox');
        this.description = 'Create your first board';
        this.command = {
            command: 'kanri.createBoard',
            title: 'Create Board'
        };
    }
}

/**
 * Microsoft-compliant TreeDataProvider for Kanban boards
 */
export class EnhancedBoardsViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly logger: Logger;
    private readonly boardManager: BoardManager;
    
    // Microsoft pattern: Event emitter for tree changes
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    // State management for better UX
    private isLoading = false;
    private lastError: string | null = null;
    private lastRefresh = 0;
    private readonly refreshThrottle = 500; // Prevent excessive refreshes
    
    // Cache for better performance
    private boardCache: KanbanBoard[] = [];
    private cacheTimestamp = 0;
    private readonly cacheTimeout = 5000; // 5 seconds

    constructor(boardManager: BoardManager, logger: Logger) {
        this.boardManager = boardManager;
        this.logger = logger;
        
        // Microsoft pattern: Listen to storage changes for automatic updates
        if (this.boardManager.storage && 'onDidChangeStorage' in this.boardManager.storage) {
            (this.boardManager.storage as any).onDidChangeStorage(() => {
                this.logger.debug('Storage changed - refreshing tree view');
                this.refresh();
            });
        }
    }

    /**
     * Microsoft pattern: Throttled refresh to prevent excessive updates
     */
    refresh(): void {
        const now = Date.now();
        if (now - this.lastRefresh < this.refreshThrottle) {
            this.logger.debug('Refresh throttled - too soon since last refresh');
            return;
        }
        
        this.lastRefresh = now;
        this.invalidateCache();
        this._onDidChangeTreeData.fire();
        this.logger.debug('Tree view refreshed');
    }

    /**
     * Invalidate cache to force fresh data load
     */
    private invalidateCache(): void {
        this.boardCache = [];
        this.cacheTimestamp = 0;
    }

    /**
     * Microsoft pattern: Main TreeDataProvider method with enhanced error handling
     */
    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        try {
            // For root level, return boards
            if (!element) {
                return await this.getRootItems();
            }
            
            // No children for board items currently
            return [];
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.logger.error(`Failed to get tree children: ${errorMessage}`);
            this.lastError = errorMessage;
            return [new ErrorTreeItem(errorMessage)];
        }
    }

    /**
     * Get root items with loading states and caching
     */
    private async getRootItems(): Promise<vscode.TreeItem[]> {
        // Show loading state during async operations
        if (this.isLoading) {
            return [new LoadingTreeItem()];
        }

        // Use cache if valid
        const now = Date.now();
        if (this.boardCache.length > 0 && (now - this.cacheTimestamp) < this.cacheTimeout) {
            this.logger.debug(`Using cached boards (${this.boardCache.length} items)`);
            return this.boardCache.map(board => new BoardTreeItem(board));
        }

        // Load fresh data
        this.isLoading = true;
        this.lastError = null;
        
        try {
            this.logger.debug('Loading boards from storage...');
            const boards = await this.boardManager.listBoards();
            
            // Update cache
            this.boardCache = boards;
            this.cacheTimestamp = now;
            
            this.logger.info(`Loaded ${boards.length} boards successfully`);
            
            if (boards.length === 0) {
                return [new EmptyTreeItem()];
            }
            
            return boards.map((board: KanbanBoard) => new BoardTreeItem(board));
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load boards';
            this.logger.error(`Error loading boards: ${errorMessage}`);
            this.lastError = errorMessage;
            return [new ErrorTreeItem(errorMessage)];
            
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Microsoft pattern: Required TreeDataProvider method
     */
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Microsoft pattern: Handle tree item selection
     */
    getParent(element: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem> {
        // All items are at root level currently
        return null;
    }

    /**
     * Microsoft pattern: Resolve tree item for additional details
     */
    resolveTreeItem(item: vscode.TreeItem, element: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem> {
        if (element instanceof BoardTreeItem) {
            // Could add additional async loading here if needed
            return element;
        }
        return item;
    }

    /**
     * Get current state for debugging
     */
    getState(): {
        isLoading: boolean;
        lastError: string | null;
        cacheSize: number;
        cacheAge: number;
    } {
        return {
            isLoading: this.isLoading,
            lastError: this.lastError,
            cacheSize: this.boardCache.length,
            cacheAge: Date.now() - this.cacheTimestamp
        };
    }

    /**
     * Force refresh (for command palette)
     */
    forceRefresh(): void {
        this.logger.info('Force refresh requested');
        this.invalidateCache();
        this.refresh();
    }

    /**
     * Microsoft pattern: Dispose resources
     */
    dispose(): void {
        this._onDidChangeTreeData.dispose();
        this.logger.debug('BoardsViewProvider disposed');
    }
}
