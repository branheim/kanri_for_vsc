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

import * as vscode from 'vscode';
import * as path from 'path';
import { 
  KanbanBoard, 
  DEFAULT_CONFIG, 
  DEFAULT_BOARD_TEMPLATE,
  BOARD_FILE_EXTENSION,
  MAX_BOARDS_PER_WORKSPACE,
  AUTO_SAVE_DEBOUNCE_MS,
  ID_CHARACTERS,
  ID_LENGTH
} from '../config/defaults';
import { ConfigurationManager } from '../utils/configurationManager';
import { Logger } from '../utils/logger';
import { FileStorage } from '../storage/fileStorage';

/**
 * Interface for board creation options
 * Allows customization of new board properties
 */
interface BoardCreationOptions {
  /** Name for the new board */
  name?: string;
  /** Description for the new board */
  description?: string;
  /** Custom column names (overrides default columns) */
  columns?: string[];
}

/**
 * BoardManager class responsible for all kanban board operations
 * Provides a high-level API for board management while handling
 * low-level persistence and workspace integration
 */
export class BoardManager {
  /** Cache of loaded boards for performance */
  private loadedBoards: Map<string, KanbanBoard> = new Map();
  
  /** Auto-save timer to debounce save operations */
  private autoSaveTimer: NodeJS.Timeout | undefined;
  
  /** File system watcher for board file changes */
  private fileWatcher: vscode.FileSystemWatcher | undefined;

  /** File storage for board persistence */
  private fileStorage: FileStorage;

  /**
   * Initialize the BoardManager
   * 
   * @param context - VS Code extension context for storage and APIs
   * @param configManager - Configuration manager for user settings
   * @param logger - Logger instance for debugging and monitoring
   */
  constructor(
    private context: vscode.ExtensionContext,
    private configManager: ConfigurationManager,
    private logger: Logger
  ) {
    this.fileStorage = new FileStorage(logger);
    this.setupFileWatcher();
  }

  /**
   * Initialize the workspace for board storage
   * Creates the boards directory if it doesn't exist
   */
  async initializeWorkspace(): Promise<void> {
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
  async createBoard(options?: BoardCreationOptions): Promise<KanbanBoard> {
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
    if (existingBoards.length >= MAX_BOARDS_PER_WORKSPACE) {
      throw new Error(`Maximum number of boards (${MAX_BOARDS_PER_WORKSPACE}) reached`);
    }

    // Generate unique ID for the board
    const boardId = this.generateId();
    
    // Get columns from options or user configuration
    const columns = options?.columns || 
                   this.configManager.get('defaultColumns', DEFAULT_CONFIG.defaultColumns);

    // Create board object
    const newBoard: KanbanBoard = {
      ...DEFAULT_BOARD_TEMPLATE,
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
    const openBoard = await vscode.window.showInformationMessage(
      `Board "${boardName}" created successfully!`,
      'Open Board'
    );
    
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
  async openBoard(boardId?: string): Promise<void> {
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
  async getAllBoards(): Promise<KanbanBoard[]> {
    try {
      const boards = await this.fileStorage.listBoards();
      return boards.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch (error) {
      this.logger.warn(`Failed to read boards directory: ${error}`);
      return [];
    }
  }

  /**
   * View all boards in a quick pick interface
   * Provides overview and allows selection for opening
   */
  async viewAllBoards(): Promise<void> {
    const boards = await this.getAllBoards();
    
    if (boards.length === 0) {
      const createBoard = await vscode.window.showInformationMessage(
        'No boards found. Would you like to create your first board?',
        'Create Board'
      );
      
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
  async saveBoard(board: KanbanBoard): Promise<void> {
    // Update last modified timestamp
    board.lastModified = new Date();
    
    // Update cache
    this.loadedBoards.set(board.id, board);

    // Handle auto-save with debouncing
    if (this.configManager.get('autoSave', DEFAULT_CONFIG.autoSave)) {
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
      }
      
      this.autoSaveTimer = setTimeout(async () => {
        await this.writeBoardToFile(board);
      }, AUTO_SAVE_DEBOUNCE_MS);
    } else {
      // Immediate save if auto-save is disabled
      await this.writeBoardToFile(board);
    }
  }

  /**
   * Save all loaded boards to storage
   * Used during extension deactivation
   */
  async saveAllBoards(): Promise<void> {
    const savePromises = Array.from(this.loadedBoards.values()).map(board => 
      this.writeBoardToFile(board)
    );
    
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
  async getBoard(boardId: string): Promise<KanbanBoard | undefined> {
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
    } catch (error) {
      this.logger.warn(`Failed to load board ${boardId}: ${error}`);
      return undefined;
    }
  }

  /**
   * Update configuration settings
   * Called when user changes extension settings
   */
  updateConfiguration(): void {
    this.logger.debug('Updating BoardManager configuration');
    // Configuration changes are automatically picked up via configManager
    // This method exists for future configuration-dependent logic
  }

  /**
   * Dispose of resources and cleanup
   * Called during extension deactivation
   */
  dispose(): void {
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
  private getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
  }

  /**
   * Get the full path to the boards directory
   * @returns Absolute path to boards storage directory
   */
  private getBoardsDirectory(): string {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error('No workspace folder available');
    }
    
    const boardsDir = this.configManager.get('boardsDirectory', DEFAULT_CONFIG.boardsDirectory);
    return path.join(workspaceFolder.uri.fsPath, boardsDir);
  }

  /**
   * Get the file path for a specific board
   * @param boardId - Board identifier
   * @returns Absolute path to board file
   */
  private getBoardFilePath(boardId: string): string {
    const boardsDir = this.getBoardsDirectory();
    return path.join(boardsDir, `${boardId}${BOARD_FILE_EXTENSION}`);
  }

  /**
   * Generate a unique identifier for boards and other objects
   * @returns Random alphanumeric string
   */
  private generateId(): string {
    return Array.from({ length: ID_LENGTH }, () => 
      ID_CHARACTERS[Math.floor(Math.random() * ID_CHARACTERS.length)]
    ).join('');
  }

  /**
   * Prompt user for board name input
   * @returns User-provided board name or undefined if cancelled
   */
  private async promptForBoardName(): Promise<string | undefined> {
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
  private async promptForBoardSelection(): Promise<string | undefined> {
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
  private async writeBoardToFile(board: KanbanBoard): Promise<void> {
    try {
      await this.fileStorage.saveBoard(board);
      this.logger.debug(`Saved board ${board.name}`);
    } catch (error) {
      this.logger.error(`Failed to save board ${board.name}: ${error}`);
      throw error;
    }
  }

  /**
   * Set up file system watcher for board file changes
   * Detects external changes to board files
   */
  private setupFileWatcher(): void {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      return;
    }

    const boardsPattern = new vscode.RelativePattern(
      workspaceFolder,
      `${this.configManager.get('boardsDirectory', DEFAULT_CONFIG.boardsDirectory)}/*${BOARD_FILE_EXTENSION}`
    );

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(boardsPattern);
    
    this.fileWatcher.onDidChange(async (uri) => {
      const boardId = path.basename(uri.fsPath, BOARD_FILE_EXTENSION);
      this.logger.debug(`Board file changed: ${boardId}`);
      
      // Reload board from file if it's in cache
      if (this.loadedBoards.has(boardId)) {
        this.loadedBoards.delete(boardId);
        await this.getBoard(boardId); // This will reload from file
      }
    });

    this.fileWatcher.onDidDelete((uri) => {
      const boardId = path.basename(uri.fsPath, BOARD_FILE_EXTENSION);
      this.logger.debug(`Board file deleted: ${boardId}`);
      this.loadedBoards.delete(boardId);
    });
  }

  /**
   * Show webview for board visualization and editing
   * @param board - Board to display in webview
   */
  private async showBoardWebview(board: KanbanBoard): Promise<void> {
    // TODO: Implement webview for board visualization
    // This would create a VS Code webview panel showing the kanban board
    // For now, show a placeholder message
    vscode.window.showInformationMessage(
      `Opening board "${board.name}" - Webview implementation coming soon!`
    );
    
    this.logger.debug(`Showing webview for board: ${board.name}`);
  }
}
