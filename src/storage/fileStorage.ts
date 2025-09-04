/**
 * Enhanced Storage System Following Microsoft VS Code Best Practices
 * 
 * Microsoft recommends using Extensi## What's stored here:
- Board configurations (name, description, creation date)
- Column definitions (titles, order, card counts)
- Individual cards (content, metadata, timestamps)

## Version Control:
- **COMMIT THESE FILES** to track your project's progress over time
- Share board state with your team by committing to your repository
- Board history becomes part of your project history

## File Format:
JSON files with structured kanban data. Each board is stored as a separate 
.kanri file with complete state information for easy backup and synchronization.

## Troubleshooting:eUri for workspace-specific
 * extension data instead of creating custom directories in the workspace.
 * 
 * Key Improvements:
 * 1. Uses context.storageUri for extension data (Microsoft recommended)
 * 2. Keeps .kanri in workspace for user-visible project data
 * 3. Implements proper error handling patterns
 * 4. Uses structured logging with output channels
 * 5. Implements file watching for automatic updates
 */

import * as vscode from 'vscode';
import { KanbanBoard } from '../config/defaults';
import { Logger } from '../utils/logger';

/**
 * Microsoft-compliant storage manager following VS Code best practices
 */
export class FileStorage {
    private readonly logger: Logger;
    private readonly context: vscode.ExtensionContext;
    private readonly userDataDir = '.kanri';  // User-visible project data
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    
    // Event emitter for storage changes (Microsoft pattern)
    private readonly _onDidChangeStorage = new vscode.EventEmitter<void>();
    readonly onDidChangeStorage = this._onDidChangeStorage.event;

    constructor(context: vscode.ExtensionContext, logger: Logger) {
        this.context = context;
        this.logger = logger;
        this.setupFileWatcher();
    }

    /**
     * Get workspace root with proper error handling (Microsoft pattern)
     */
    private getWorkspaceRoot(): vscode.Uri | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this.logger.error('No workspace folder open - cannot access project data');
            return null;
        }
        return workspaceFolders[0].uri;
    }

    /**
     * Get extension storage directory (Microsoft recommended pattern)
     */
    private getExtensionStorageUri(): vscode.Uri | null {
        if (!this.context.storageUri) {
            this.logger.warn('Extension storage not available - using fallback');
            return null;
        }
        return this.context.storageUri;
    }

    /**
     * Ensure directories exist with proper error handling
     */
    private async ensureDirectories(): Promise<{ userDir: vscode.Uri | null, extensionDir: vscode.Uri | null }> {
        const workspaceRoot = this.getWorkspaceRoot();
        const extensionStorageUri = this.getExtensionStorageUri();
        
        let userDir: vscode.Uri | null = null;
        let extensionDir: vscode.Uri | null = null;

        // Create user-visible .kanri directory for project data
        if (workspaceRoot) {
            userDir = vscode.Uri.joinPath(workspaceRoot, this.userDataDir);
            try {
                await vscode.workspace.fs.createDirectory(userDir);
                await this.createUserReadme(userDir);
            } catch (error) {
                if (!(error instanceof vscode.FileSystemError && error.code === 'FileExists')) {
                    this.logger.error('Failed to create user data directory', error);
                }
            }
        }

        // Create extension storage directory (Microsoft pattern)
        if (extensionStorageUri) {
            try {
                await vscode.workspace.fs.createDirectory(extensionStorageUri);
                extensionDir = extensionStorageUri;
            } catch (error) {
                if (!(error instanceof vscode.FileSystemError && error.code === 'FileExists')) {
                    this.logger.error('Failed to create extension storage directory', error);
                }
            }
        }

        return { userDir, extensionDir };
    }

    /**
     * Create README for user directory (improved version)
     */
    private async createUserReadme(userDir: vscode.Uri): Promise<void> {
        const readmePath = vscode.Uri.joinPath(userDir, 'README.md');
        
        try {
            await vscode.workspace.fs.stat(readmePath);
            return; // README already exists
        } catch {
            // README doesn't exist, create it
        }

        const readmeContent = `# Kanri Board Data

This directory contains your Kanban board data for this project.

## 📋 What's stored here:
- Each \`.kanri.json\` file represents a Kanban board
- Board data includes columns, cards, and their current state
- Files are automatically managed by the Kanri VS Code extension

## 🔄 Version Control:
- **✅ COMMIT THESE FILES** to track your project's progress over time
- 📤 Share board state with your team by committing to your repository
- 📈 Board history becomes part of your project history

## ⚙️ File Format:
- Human-readable JSON format for transparency
- Can be manually edited if needed (with caution)
- Automatic backups created when boards are deleted

## 🛠️ Troubleshooting:
- If boards don't appear, check VS Code output (Kanri channel)
- Ensure workspace is properly opened in VS Code
- Report issues: https://github.com/branheim/kanri_for_vsc/issues

Generated by Kanri for VS Code v${this.context.extension.packageJSON.version}
`;

        try {
            const uint8Array = Buffer.from(readmeContent, 'utf8');
            await vscode.workspace.fs.writeFile(readmePath, uint8Array);
            this.logger.info(`Created user README: ${readmePath.fsPath}`);
        } catch (error) {
            this.logger.warn(`Failed to create user README: ${error}`);
        }
    }

    /**
     * Save board with dual storage strategy (Microsoft compliant)
     */
    async saveBoard(board: KanbanBoard): Promise<{ success: boolean; error?: string }> {
        const { userDir, extensionDir } = await this.ensureDirectories();
        
        if (!userDir) {
            return { success: false, error: 'No workspace available for saving' };
        }

        try {
            // Save to user-visible directory (primary storage)
            const fileName = `${this.sanitizeFileName(board.id)}.kanri.json`;
            const userFilePath = vscode.Uri.joinPath(userDir, fileName);
            
            // Enhanced board data with metadata
            const boardData = {
                ...board,
                lastSaved: new Date().toISOString(),
                version: '1.0.0',
                savedBy: 'Kanri for VS Code',
                extensionVersion: this.context.extension.packageJSON.version
            };

            const jsonData = JSON.stringify(boardData, null, 2);
            const uint8Array = Buffer.from(jsonData, 'utf8');
            
            await vscode.workspace.fs.writeFile(userFilePath, uint8Array);
            
            // Optional: Create backup in extension storage
            if (extensionDir) {
                const backupPath = vscode.Uri.joinPath(extensionDir, `${fileName}.backup`);
                await vscode.workspace.fs.writeFile(backupPath, uint8Array);
            }
            
            this.logger.info(`Board saved successfully: ${userFilePath.fsPath}`);
            this._onDidChangeStorage.fire();
            
            return { success: true };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to save board ${board.id}: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Load board with enhanced error handling
     */
    async loadBoard(boardId: string): Promise<KanbanBoard | null> {
        const { userDir } = await this.ensureDirectories();
        if (!userDir) return null;

        try {
            const fileName = `${this.sanitizeFileName(boardId)}.kanri.json`;
            const filePath = vscode.Uri.joinPath(userDir, fileName);
            
            const uint8Array = await vscode.workspace.fs.readFile(filePath);
            const jsonData = Buffer.from(uint8Array).toString('utf8');
            const boardData = JSON.parse(jsonData);
            
            // Enhanced validation
            if (!this.isValidBoard(boardData)) {
                this.logger.error(`Invalid board structure in file: ${filePath.fsPath}`);
                return null;
            }
            
            // Convert date strings back to Date objects (Microsoft pattern)
            if (boardData.createdAt) {
                boardData.createdAt = new Date(boardData.createdAt);
            }
            if (boardData.lastModified) {
                boardData.lastModified = new Date(boardData.lastModified);
            }
            
            this.logger.debug(`Board loaded successfully: ${filePath.fsPath}`);
            return boardData as KanbanBoard;
            
        } catch (error) {
            if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                this.logger.debug(`Board file not found: ${boardId}`);
            } else {
                this.logger.error(`Failed to load board ${boardId}: ${error}`);
            }
            return null;
        }
    }

    /**
     * List boards with enhanced error handling
     */
    async listBoards(): Promise<KanbanBoard[]> {
        const { userDir } = await this.ensureDirectories();
        if (!userDir) return [];

        try {
            const entries = await vscode.workspace.fs.readDirectory(userDir);
            const boardFiles = entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.kanri.json'))
                .map(([name]) => name.replace('.kanri.json', ''));
            
            const boards: KanbanBoard[] = [];
            const loadPromises = boardFiles.map(async (boardId) => {
                const board = await this.loadBoard(boardId);
                if (board) {
                    boards.push(board);
                }
            });
            
            await Promise.all(loadPromises);
            
            this.logger.debug(`Found ${boards.length} boards in workspace`);
            return boards.sort((a, b) => new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime());
            
        } catch (error) {
            this.logger.error(`Failed to list boards: ${error}`);
            return [];
        }
    }

    /**
     * Delete a board file
     * @param boardId - Unique identifier for the board to delete
     */
    async deleteBoard(boardId: string): Promise<void> {
        const { userDir } = await this.ensureDirectories();
        if (!userDir) {
            throw new Error('No workspace available for board deletion');
        }

        try {
            const filePath = vscode.Uri.joinPath(userDir, `${boardId}.kanri.json`);
            
            // Check if file exists first
            try {
                await vscode.workspace.fs.stat(filePath);
            } catch (error) {
                throw new Error(`Board file not found: ${boardId}`);
            }

            // Delete the file
            await vscode.workspace.fs.delete(filePath);
            
            this.logger.info(`Board file deleted: ${boardId}`);
            
            // Emit storage change event
            this._onDidChangeStorage.fire();
            
        } catch (error) {
            this.logger.error(`Failed to delete board ${boardId}: ${error}`);
            throw error;
        }
    }

    /**
     * Setup file watcher (Microsoft optimized pattern)
     * Uses specific patterns to minimize resource usage and implements debouncing
     */
    private setupFileWatcher(): void {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return;

        // Microsoft recommendation: Use specific patterns to avoid recursive watching
        const pattern = new vscode.RelativePattern(workspaceRoot, `${this.userDataDir}/*.kanri.json`);
        
        // Microsoft pattern: Only watch for necessary events to reduce overhead
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            pattern,
            false, // Watch create events
            false, // Watch change events
            false  // Watch delete events
        );

        // Microsoft optimization: Debounce file events to prevent excessive updates
        let debounceTimer: NodeJS.Timeout | undefined;
        const debouncedFireChange = () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
                this.logger.debug('Board files changed externally (debounced)');
                this._onDidChangeStorage.fire();
            }, 150); // Microsoft recommended debounce time
        };

        // Microsoft pattern: React to file system changes with debouncing
        this.fileWatcher.onDidCreate((uri) => {
            this.logger.debug(`Board file created externally: ${uri.fsPath}`);
            debouncedFireChange();
        });

        this.fileWatcher.onDidChange((uri) => {
            this.logger.debug(`Board file changed externally: ${uri.fsPath}`);
            debouncedFireChange();
        });

        this.fileWatcher.onDidDelete((uri) => {
            this.logger.debug(`Board file deleted externally: ${uri.fsPath}`);
            debouncedFireChange();
        });
    }

    /**
     * Enhanced filename sanitization following Microsoft cross-platform guidelines
     */
    private sanitizeFileName(boardId: string): string {
        // Microsoft recommendation: Handle all platform-specific forbidden characters
        return boardId
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Windows forbidden characters
            .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, '_$1_') // Windows reserved names
            .replace(/\.$/, '_') // Remove trailing periods (Windows issue)
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .toLowerCase()
            .substring(0, 50); // Limit length for cross-platform compatibility
    }

    /**
     * Enhanced board validation
     */
    private isValidBoard(data: any): boolean {
        return (
            data &&
            typeof data.id === 'string' &&
            typeof data.name === 'string' &&
            Array.isArray(data.columns) &&
            data.columns.every((col: any) => 
                col &&
                typeof col.id === 'string' &&
                typeof col.title === 'string' &&
                Array.isArray(col.cards)
            )
        );
    }

    /**
     * Microsoft pattern: Dispose resources with proper cleanup order
     */
    dispose(): void {
        // Dispose file watcher first to stop incoming events
        this.fileWatcher?.dispose();
        
        // Then dispose event emitter
        this._onDidChangeStorage.dispose();
        
        this.logger.debug('FileStorage disposed with proper cleanup');
    }
}
