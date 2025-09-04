"use strict";
/**
 * Board Manager - Core class for kanban board operations
 *
 * This manager handles all board-related functionality including:
 * - Creating new kanban boards
 * - Loading existing boards from storage
 * - Saving board state to persistent storage
 * - Managing board lifecycle and workspace integration
 *
 * The BoardManager works closely with the file system to provide
 * persistent storage for boards within the VS Code workspace.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoardManager = void 0;
const vscode = require("vscode");
const path = require("path");
const defaults_1 = require("../config/defaults");
const fileStorage_1 = require("../storage/fileStorage");
/**
 * BoardManager class responsible for all kanban board operations
 * Provides a high-level API for board management while handling
 * low-level persistence and workspace integration
 */
class BoardManager {
    /**
     * Initialize the BoardManager
     *
     * @param context - VS Code extension context for storage and APIs
     * @param configManager - Configuration manager for user settings
     * @param logger - Logger instance for debugging and monitoring
     */
    constructor(context, configManager, logger) {
        this.context = context;
        this.configManager = configManager;
        this.logger = logger;
        /** Cache of loaded boards for performance */
        this.loadedBoards = new Map();
        this.fileStorage = new fileStorage_1.FileStorage(context, logger);
        this.setupFileWatcher();
    }
    /**
     * Get the storage instance (for access by other components)
     */
    get storage() {
        return this.fileStorage;
    }
    /**
     * List all boards (alias for getAllBoards for compatibility)
     */
    async listBoards() {
        return this.getAllBoards();
    }
    /**
     * Initialize the workspace for board storage
     * Creates the boards directory if it doesn't exist
     */
    async initializeWorkspace() {
        // FileStorage handles directory creation automatically
        // This method now serves as a validation and logging point
        const workspaceFolder = this.getWorkspaceFolder();
        if (!workspaceFolder) {
            throw new Error('No workspace folder available for board storage');
        }
        this.logger.info('Workspace initialized for Kanri board storage');
    }
    /**
     * Create a new kanban board
     * Prompts user for board details and creates the board file
     *
     * @param options - Optional board creation parameters
     * @returns The created board object
     */
    async createBoard(options) {
        // Get board name from user if not provided
        const boardName = options?.name || await this.promptForBoardName();
        if (!boardName) {
            throw new Error('Board creation cancelled - name is required');
        }
        // Validate board name doesn't already exist
        const existingBoards = await this.getAllBoards();
        if (existingBoards.some(board => board.name === boardName)) {
            throw new Error(`A board named "${boardName}" already exists`);
        }
        // Check board limit
        if (existingBoards.length >= defaults_1.MAX_BOARDS_PER_WORKSPACE) {
            throw new Error(`Maximum number of boards (${defaults_1.MAX_BOARDS_PER_WORKSPACE}) reached`);
        }
        // Generate unique ID for the board
        const boardId = this.generateId();
        // Get columns from options or user configuration
        const columns = options?.columns ||
            this.configManager.get('defaultColumns', defaults_1.DEFAULT_CONFIG.defaultColumns);
        // Create board object
        const newBoard = {
            ...defaults_1.DEFAULT_BOARD_TEMPLATE,
            id: boardId,
            name: boardName,
            description: options?.description || `Kanban board for ${boardName}`,
            columns: columns.map((title, index) => ({
                id: `${boardId}-col-${index}`,
                title,
                cards: []
            })),
            createdAt: new Date(),
            lastModified: new Date(),
            filePath: this.getBoardFilePath(boardId)
        };
        // Save board to file system
        await this.saveBoard(newBoard);
        // Add to loaded boards cache
        this.loadedBoards.set(boardId, newBoard);
        this.logger.info(`Created new board: ${boardName} (${boardId})`);
        // Show success message with option to open board
        const openBoard = await vscode.window.showInformationMessage(`Board "${boardName}" created successfully!`, 'Open Board');
        if (openBoard === 'Open Board') {
            await this.openBoard(boardId);
        }
        return newBoard;
    }
    /**
     * Open an existing board for editing
     * Displays board selection if no specific board ID provided
     *
     * @param boardId - Optional specific board ID to open
     */
    async openBoard(boardId) {
        let targetBoardId = boardId;
        // If no board ID provided, let user select from available boards
        if (!targetBoardId) {
            targetBoardId = await this.promptForBoardSelection();
            if (!targetBoardId) {
                return; // User cancelled selection
            }
        }
        // Load the board if not already in cache
        const board = await this.getBoard(targetBoardId);
        if (!board) {
            throw new Error(`Board with ID "${targetBoardId}" not found`);
        }
        // Create or show webview for the board
        await this.showBoardWebview(board);
        this.logger.info(`Opened board: ${board.name} (${targetBoardId})`);
    }
    /**
     * Get all available boards in the workspace
     * Scans the boards directory and loads board metadata
     *
     * @returns Array of all available boards
     */
    async getAllBoards() {
        try {
            const boards = await this.fileStorage.listBoards();
            return boards.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
        }
        catch (error) {
            this.logger.warn(`Failed to read boards directory: ${error}`);
            return [];
        }
    }
    /**
     * View all boards in a quick pick interface
     * Provides overview and allows selection for opening
     */
    async viewAllBoards() {
        const boards = await this.getAllBoards();
        if (boards.length === 0) {
            const createBoard = await vscode.window.showInformationMessage('No boards found. Would you like to create your first board?', 'Create Board');
            if (createBoard === 'Create Board') {
                await this.createBoard();
            }
            return;
        }
        // Create quick pick items for each board
        const quickPickItems = boards.map(board => ({
            label: board.name,
            description: board.description,
            detail: `${board.columns.length} columns • Last modified: ${board.lastModified.toLocaleDateString()}`,
            boardId: board.id
        }));
        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a board to open',
            matchOnDescription: true,
            matchOnDetail: true
        });
        if (selected) {
            await this.openBoard(selected.boardId);
        }
    }
    /**
     * Save a board to persistent storage
     * Handles auto-save debouncing and file system operations
     *
     * @param board - Board object to save
     */
    async saveBoard(board) {
        // Update last modified timestamp
        board.lastModified = new Date();
        // Update cache
        this.loadedBoards.set(board.id, board);
        // Handle auto-save with debouncing
        if (this.configManager.get('autoSave', defaults_1.DEFAULT_CONFIG.autoSave)) {
            if (this.autoSaveTimer) {
                clearTimeout(this.autoSaveTimer);
            }
            this.autoSaveTimer = setTimeout(async () => {
                await this.writeBoardToFile(board);
            }, defaults_1.AUTO_SAVE_DEBOUNCE_MS);
        }
        else {
            // Immediate save if auto-save is disabled
            await this.writeBoardToFile(board);
        }
    }
    /**
     * Save all loaded boards to storage
     * Used during extension deactivation
     */
    async saveAllBoards() {
        const savePromises = Array.from(this.loadedBoards.values()).map(board => this.writeBoardToFile(board));
        await Promise.all(savePromises);
        this.logger.info(`Saved ${savePromises.length} boards to storage`);
    }
    /**
     * Get a specific board by ID
     * Loads from cache or file system as needed
     *
     * @param boardId - Unique identifier of the board
     * @returns Board object or undefined if not found
     */
    async getBoard(boardId) {
        // Check cache first
        if (this.loadedBoards.has(boardId)) {
            return this.loadedBoards.get(boardId);
        }
        // Load from file system using FileStorage
        try {
            const board = await this.fileStorage.loadBoard(boardId);
            if (board) {
                // Cache the loaded board
                this.loadedBoards.set(boardId, board);
            }
            return board || undefined;
        }
        catch (error) {
            this.logger.warn(`Failed to load board ${boardId}: ${error}`);
            return undefined;
        }
    }
    /**
     * Delete a board by ID
     * Removes the board file and clears it from cache
     *
     * @param boardId - Unique identifier for the board to delete
     */
    async deleteBoard(boardId) {
        try {
            // Remove from file system
            await this.fileStorage.deleteBoard(boardId);
            // Remove from cache
            this.loadedBoards.delete(boardId);
            this.logger.info(`Board deleted: ${boardId}`);
        }
        catch (error) {
            this.logger.error(`Error deleting board ${boardId}: ${error}`);
            throw error;
        }
    }
    /**
     * Update configuration settings
     * Called when user changes extension settings
     */
    updateConfiguration() {
        this.logger.debug('Updating BoardManager configuration');
        // Configuration changes are automatically picked up via configManager
        // This method exists for future configuration-dependent logic
    }
    /**
     * Dispose of resources and cleanup
     * Called during extension deactivation
     */
    dispose() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        this.loadedBoards.clear();
        this.logger.debug('BoardManager disposed');
    }
    /**
     * Get the workspace folder for board storage
     * @returns Primary workspace folder or undefined
     */
    getWorkspaceFolder() {
        return vscode.workspace.workspaceFolders?.[0];
    }
    /**
     * Get the full path to the boards directory
     * @returns Absolute path to boards storage directory
     */
    getBoardsDirectory() {
        const workspaceFolder = this.getWorkspaceFolder();
        if (!workspaceFolder) {
            throw new Error('No workspace folder available');
        }
        const boardsDir = this.configManager.get('boardsDirectory', defaults_1.DEFAULT_CONFIG.boardsDirectory);
        return path.join(workspaceFolder.uri.fsPath, boardsDir);
    }
    /**
     * Get the file path for a specific board
     * @param boardId - Board identifier
     * @returns Absolute path to board file
     */
    getBoardFilePath(boardId) {
        const boardsDir = this.getBoardsDirectory();
        return path.join(boardsDir, `${boardId}${defaults_1.BOARD_FILE_EXTENSION}`);
    }
    /**
     * Generate a unique identifier for boards and other objects
     * @returns Random alphanumeric string
     */
    generateId() {
        return Array.from({ length: defaults_1.ID_LENGTH }, () => defaults_1.ID_CHARACTERS[Math.floor(Math.random() * defaults_1.ID_CHARACTERS.length)]).join('');
    }
    /**
     * Prompt user for board name input
     * @returns User-provided board name or undefined if cancelled
     */
    async promptForBoardName() {
        return await vscode.window.showInputBox({
            prompt: 'Enter a name for your new kanban board',
            placeHolder: 'My Project Board',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Board name cannot be empty';
                }
                if (value.length > 50) {
                    return 'Board name must be 50 characters or less';
                }
                return null;
            }
        });
    }
    /**
     * Prompt user to select from available boards
     * @returns Selected board ID or undefined if cancelled
     */
    async promptForBoardSelection() {
        const boards = await this.getAllBoards();
        if (boards.length === 0) {
            vscode.window.showInformationMessage('No boards found. Create a board first.');
            return undefined;
        }
        const quickPickItems = boards.map(board => ({
            label: board.name,
            description: board.description,
            detail: `Last modified: ${board.lastModified.toLocaleDateString()}`,
            boardId: board.id
        }));
        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a board to open'
        });
        return selected?.boardId;
    }
    /**
     * Write board data to file system
     * @param board - Board object to persist
     */
    async writeBoardToFile(board) {
        try {
            await this.fileStorage.saveBoard(board);
            this.logger.debug(`Saved board ${board.name}`);
        }
        catch (error) {
            this.logger.error(`Failed to save board ${board.name}: ${error}`);
            throw error;
        }
    }
    /**
     * Set up file system watcher for board file changes
     * Detects external changes to board files
     */
    setupFileWatcher() {
        const workspaceFolder = this.getWorkspaceFolder();
        if (!workspaceFolder) {
            return;
        }
        const boardsPattern = new vscode.RelativePattern(workspaceFolder, `${this.configManager.get('boardsDirectory', defaults_1.DEFAULT_CONFIG.boardsDirectory)}/*${defaults_1.BOARD_FILE_EXTENSION}`);
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(boardsPattern);
        this.fileWatcher.onDidChange(async (uri) => {
            const boardId = path.basename(uri.fsPath, defaults_1.BOARD_FILE_EXTENSION);
            this.logger.debug(`Board file changed: ${boardId}`);
            // Reload board from file if it's in cache
            if (this.loadedBoards.has(boardId)) {
                this.loadedBoards.delete(boardId);
                await this.getBoard(boardId); // This will reload from file
            }
        });
        this.fileWatcher.onDidDelete((uri) => {
            const boardId = path.basename(uri.fsPath, defaults_1.BOARD_FILE_EXTENSION);
            this.logger.debug(`Board file deleted: ${boardId}`);
            this.loadedBoards.delete(boardId);
        });
    }
    /**
     * Show webview for board visualization and editing
     * @param board - Board to display in webview
     */
    async showBoardWebview(board) {
        // TODO: Implement webview for board visualization
        // This would create a VS Code webview panel showing the kanban board
        // For now, show a placeholder message
        vscode.window.showInformationMessage(`Opening board "${board.name}" - Webview implementation coming soon!`);
        this.logger.debug(`Showing webview for board: ${board.name}`);
    }
}
exports.BoardManager = BoardManager;
//# sourceMappingURL=boardManager.js.map