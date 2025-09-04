/**
 * Enhanced Extension Entry Point Following Microsoft VS Code Best Practices
 * 
 * Microsoft standards implemented:
 * 1. Proper error handling and graceful degradation
 * 2. Resource management and disposal patterns
 * 3. Extension context usage for storage and configuration
 * 4. Enhanced logging and debugging capabilities
 * 5. Structured activation and deactivation lifecycle
 */

import * as vscode from 'vscode';
import { BoardManager } from './managers/boardManager';
import { ConfigurationManager } from './utils/configurationManager';
import { Logger } from './utils/logger';
import { EnhancedBoardsViewProvider } from './views/enhancedBoardsViewProvider';
import { EnhancedFileStorage } from './storage/enhancedFileStorage';

// Global extension state
let boardManager: BoardManager;
let configManager: ConfigurationManager;
let logger: Logger;
let boardsViewProvider: EnhancedBoardsViewProvider;

/**
 * Extension activation function - Microsoft recommended pattern
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        // Initialize core services first
        await initializeServices(context);
        
        // Register commands and views
        await registerCommands(context);
        await registerViews(context);
        
        // Setup configuration watchers
        setupConfigurationWatchers(context);
        
        // Initialize workspace
        await initializeWorkspace();
        
        logger.info('Kanri extension activated successfully');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown activation error';
        vscode.window.showErrorMessage(`Failed to activate Kanri extension: ${errorMessage}`);
        console.error('Kanri activation failed:', error);
        throw error; // Re-throw to let VS Code handle extension failure
    }
}

/**
 * Extension deactivation function - Microsoft recommended pattern
 */
export async function deactivate(): Promise<void> {
    try {
        logger?.info('Deactivating Kanri extension...');
        
        // Save all pending work
        if (boardManager) {
            await boardManager.saveAllBoards();
        }
        
        // Dispose of resources in reverse order
        boardsViewProvider?.dispose();
        boardManager?.dispose();
        
        logger?.info('Kanri extension deactivated successfully');
        
    } catch (error) {
        console.error('Error during Kanri deactivation:', error);
        // Don't throw during deactivation as it can cause issues
    }
}

/**
 * Initialize core services following Microsoft dependency injection patterns
 */
async function initializeServices(context: vscode.ExtensionContext): Promise<void> {
    // Initialize logger (uses its own output channel)
    logger = new Logger();
    
    // Initialize configuration manager
    configManager = new ConfigurationManager();
    
    // Initialize board manager with enhanced storage
    boardManager = new BoardManager(context, configManager, logger);
    
    // Initialize enhanced boards view provider
    boardsViewProvider = new EnhancedBoardsViewProvider(boardManager, logger);
    
    logger.info('Core services initialized');
}

/**
 * Register all VS Code commands following Microsoft patterns
 */
async function registerCommands(context: vscode.ExtensionContext): Promise<void> {
    const commands = [
        // Board management commands
        {
            command: 'kanri.createBoard',
            callback: createBoardCommand,
            title: 'Create Kanban Board'
        },
        {
            command: 'kanri.openBoard',
            callback: openBoardCommand,
            title: 'Open Kanban Board'
        },
        {
            command: 'kanri.listBoards',
            callback: listBoardsCommand,
            title: 'List All Boards'
        },
        {
            command: 'kanri.refreshBoards',
            callback: refreshBoardsCommand,
            title: 'Refresh Boards View'
        },
        
        // View management commands
        {
            command: 'kanri.showKanbanView',
            callback: showKanbanViewCommand,
            title: 'Show Kanban View'
        },
        
        // Utility commands
        {
            command: 'kanri.openSettings',
            callback: openSettingsCommand,
            title: 'Open Kanri Settings'
        }
    ];
    
    // Register commands with proper error handling
    for (const { command, callback, title } of commands) {
        const disposable = vscode.commands.registerCommand(command, async (...args: any[]) => {
            try {
                logger.debug(`Executing command: ${command}`);
                await callback(...args);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
                logger.error(`Command ${command} failed: ${errorMessage}`);
                vscode.window.showErrorMessage(`${title} failed: ${errorMessage}`);
            }
        });
        
        context.subscriptions.push(disposable);
    }
    
    logger.info(`Registered ${commands.length} commands`);
}

/**
 * Register views and view providers
 */
async function registerViews(context: vscode.ExtensionContext): Promise<void> {
    // Register tree data provider for boards view
    const treeView = vscode.window.createTreeView('kanri.boardsView', {
        treeDataProvider: boardsViewProvider,
        showCollapseAll: false,
        canSelectMany: false
    });
    
    context.subscriptions.push(treeView);
    context.subscriptions.push(boardsViewProvider);
    
    // Set up view actions (Microsoft pattern)
    treeView.onDidChangeSelection((event) => {
        if (event.selection.length > 0) {
            logger.debug(`Board selected: ${JSON.stringify(event.selection[0])}`);
        }
    });
    
    logger.info('Views registered successfully');
}

/**
 * Setup configuration change watchers (Microsoft pattern)
 */
function setupConfigurationWatchers(context: vscode.ExtensionContext): void {
    const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('kanri')) {
            logger.info('Kanri configuration changed');
            configManager.reloadConfiguration();
            boardManager.updateConfiguration();
            boardsViewProvider.refresh();
        }
    });
    
    context.subscriptions.push(configWatcher);
    logger.debug('Configuration watchers setup complete');
}

/**
 * Initialize workspace for board storage
 */
async function initializeWorkspace(): Promise<void> {
    try {
        await boardManager.initializeWorkspace();
        logger.info('Workspace initialized for Kanri');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Workspace initialization failed';
        logger.warn(`Workspace initialization failed: ${errorMessage}`);
        // Don't fail activation just because workspace init failed
    }
}

// ============================================================================
// COMMAND IMPLEMENTATIONS
// ============================================================================

/**
 * Create new board command
 */
async function createBoardCommand(): Promise<void> {
    const board = await boardManager.createBoard();
    if (board) {
        // Refresh the tree view to show the new board
        boardsViewProvider.refresh();
        
        // Option to open the newly created board
        const openBoard = await vscode.window.showInformationMessage(
            `Board "${board.name}" created successfully!`,
            'Open Board'
        );
        
        if (openBoard === 'Open Board') {
            await openBoardCommand(board.id);
        }
    }
}

/**
 * Open board command
 */
async function openBoardCommand(boardId?: string): Promise<void> {
    if (!boardId) {
        // Show board selection if no ID provided
        await listBoardsCommand();
        return;
    }
    
    const board = await boardManager.getBoard(boardId);
    if (!board) {
        vscode.window.showErrorMessage(`Board not found: ${boardId}`);
        return;
    }
    
    // TODO: Create enhanced webview for board editing
    await createKanbanBoardWebview(board, boardManager);
}

/**
 * List boards command
 */
async function listBoardsCommand(): Promise<void> {
    await boardManager.viewAllBoards();
}

/**
 * Refresh boards view command
 */
async function refreshBoardsCommand(): Promise<void> {
    boardsViewProvider.forceRefresh();
    vscode.window.showInformationMessage('Boards view refreshed');
}

/**
 * Show Kanban view command
 */
async function showKanbanViewCommand(): Promise<void> {
    await vscode.commands.executeCommand('kanri.boardsView.focus');
}

/**
 * Open settings command
 */
async function openSettingsCommand(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'kanri');
}

// ============================================================================
// WEBVIEW FUNCTIONALITY (Enhanced for Microsoft standards)
// ============================================================================

/**
 * Create Kanban board webview with enhanced error handling
 */
async function createKanbanBoardWebview(
    board: import('./config/defaults').KanbanBoard,
    boardManager: BoardManager
): Promise<void> {
    try {
        // Create webview panel
        const panel = vscode.window.createWebviewPanel(
            'kanbanBoard',
            `Kanban: ${board.name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                enableFindWidget: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, 'media')]
            }
        );
        
        // Set webview HTML content
        panel.webview.html = getWebviewContent(panel.webview, board);
        
        // Handle webview messages with enhanced error handling
        panel.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    await handleWebviewMessage(message, board, boardManager, panel);
                } catch (error) {
                    logger.error(`Webview message handling failed: ${error}`);
                    panel.webview.postMessage({
                        type: 'error',
                        message: 'An error occurred while processing your request'
                    });
                }
            }
        );
        
        // Handle panel disposal
        panel.onDidDispose(() => {
            logger.debug(`Webview closed for board: ${board.name}`);
        });
        
        logger.info(`Webview created for board: ${board.name}`);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create webview';
        logger.error(`Webview creation failed: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to open board: ${errorMessage}`);
    }
}

/**
 * Handle messages from webview
 */
async function handleWebviewMessage(
    message: any,
    board: import('./config/defaults').KanbanBoard,
    boardManager: BoardManager,
    panel: vscode.WebviewPanel
): Promise<void> {
    switch (message.type) {
        case 'boardUpdated':
            logger.debug('Board updated via webview');
            await boardManager.saveBoard(message.board);
            boardsViewProvider.refresh();
            break;
            
        case 'requestBoardData':
            logger.debug('Webview requesting board data');
            panel.webview.postMessage({
                type: 'boardData',
                board: board
            });
            break;
            
        default:
            logger.warn(`Unknown webview message type: ${message.type}`);
    }
}

/**
 * Generate HTML content for webview
 */
function getWebviewContent(webview: vscode.Webview, board: import('./config/defaults').KanbanBoard): string {
    // TODO: Enhanced webview implementation
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kanban Board: ${board.name}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        .board-header {
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .board-title {
            font-size: 24px;
            font-weight: bold;
            margin: 0;
        }
        .board-description {
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        .placeholder {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-top: 50px;
        }
    </style>
</head>
<body>
    <div class="board-header">
        <h1 class="board-title">${board.name}</h1>
        <p class="board-description">${board.description || 'No description provided'}</p>
    </div>
    
    <div class="placeholder">
        <p>🚧 Interactive Kanban Board Coming Soon! 🚧</p>
        <p>This enhanced webview will include:</p>
        <ul style="text-align: left; display: inline-block;">
            <li>Drag & drop card management</li>
            <li>Real-time column updates</li>
            <li>Card editing and details</li>
            <li>Board customization options</li>
        </ul>
        <p><strong>Board ID:</strong> ${board.id}</p>
        <p><strong>Columns:</strong> ${board.columns.length}</p>
        <p><strong>Total Cards:</strong> ${board.columns.reduce((sum, col) => sum + col.cards.length, 0)}</p>
    </div>
</body>
</html>`;
}
