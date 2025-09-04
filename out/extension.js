"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const boardManager_1 = require("./managers/boardManager");
const configurationManager_1 = require("./utils/configurationManager");
const logger_1 = require("./utils/logger");
const boardsViewProvider_1 = require("./views/boardsViewProvider");
// Global extension state
let boardManager;
let configManager;
let logger;
let boardsViewProvider;
/**
 * Extension activation function - Microsoft recommended pattern with lazy loading
 */
async function activate(context) {
    const startTime = Date.now();
    try {
        // Microsoft pattern: Initialize core services first with error boundaries
        await initializeServices(context);
        // Microsoft optimization: Register commands early for fast response
        await registerCommands(context);
        // Microsoft pattern: Defer view registration for faster startup
        await registerViews(context);
        // Microsoft optimization: Setup watchers after initial load
        setupConfigurationWatchers(context);
        // Microsoft pattern: Initialize workspace asynchronously
        setImmediate(async () => {
            try {
                await initializeWorkspace();
            }
            catch (error) {
                logger.warn(`Workspace initialization deferred: ${error}`);
                // Don't fail activation for workspace issues
            }
        });
        const activationTime = Date.now() - startTime;
        logger.info(`Kanri extension activated successfully in ${activationTime}ms`);
        // Microsoft pattern: Report activation success for telemetry
        context.globalState.update('kanri.lastActivationTime', activationTime);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown activation error';
        const activationTime = Date.now() - startTime;
        // Microsoft pattern: Comprehensive error reporting
        logger.error(`Activation failed after ${activationTime}ms: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to activate Kanri extension: ${errorMessage}`);
        // Microsoft pattern: Store error info for debugging
        context.globalState.update('kanri.lastActivationError', {
            message: errorMessage,
            timestamp: Date.now(),
            duration: activationTime
        });
        throw error; // Re-throw to let VS Code handle extension failure
    }
}
exports.activate = activate;
/**
 * Extension deactivation function - Microsoft recommended pattern with enhanced cleanup
 */
async function deactivate() {
    const startTime = Date.now();
    try {
        logger?.info('Deactivating Kanri extension...');
        // Microsoft pattern: Save all pending work first
        if (boardManager) {
            try {
                await boardManager.saveAllBoards();
                logger?.info('All board data saved successfully');
            }
            catch (error) {
                logger?.error(`Failed to save boards during deactivation: ${error}`);
                // Continue with deactivation even if save fails
            }
        }
        // Microsoft pattern: Dispose of resources in reverse order of creation
        try {
            boardsViewProvider?.dispose();
            boardManager?.dispose();
            logger?.info('Extension resources disposed successfully');
        }
        catch (error) {
            logger?.error(`Error disposing resources: ${error}`);
        }
        const deactivationTime = Date.now() - startTime;
        logger?.info(`Kanri extension deactivated successfully in ${deactivationTime}ms`);
    }
    catch (error) {
        const deactivationTime = Date.now() - startTime;
        console.error(`Error during Kanri deactivation (${deactivationTime}ms):`, error);
        // Microsoft pattern: Don't throw during deactivation as it can cause issues
    }
}
exports.deactivate = deactivate;
/**
 * Initialize core services following Microsoft dependency injection patterns
 */
async function initializeServices(context) {
    // Initialize logger (uses its own output channel)
    logger = new logger_1.Logger();
    // Initialize configuration manager
    configManager = new configurationManager_1.ConfigurationManager();
    // Initialize board manager with enhanced storage
    boardManager = new boardManager_1.BoardManager(context, configManager, logger);
    // Initialize enhanced boards view provider
    boardsViewProvider = new boardsViewProvider_1.BoardsViewProvider(boardManager, logger);
    logger.info('Core services initialized');
}
/**
 * Register all VS Code commands following Microsoft patterns
 */
async function registerCommands(context) {
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
        const disposable = vscode.commands.registerCommand(command, async (...args) => {
            const commandStartTime = Date.now();
            try {
                logger.debug(`Executing command: ${command}`);
                await callback(...args);
                const commandDuration = Date.now() - commandStartTime;
                logger.debug(`Command ${command} completed in ${commandDuration}ms`);
            }
            catch (error) {
                const commandDuration = Date.now() - commandStartTime;
                const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
                // Microsoft pattern: Comprehensive error logging
                logger.error(`Command ${command} failed after ${commandDuration}ms: ${errorMessage}`);
                // Microsoft pattern: User-friendly error messages with actions
                const retry = await vscode.window.showErrorMessage(`${title} failed: ${errorMessage}`, 'Retry', 'Report Issue');
                if (retry === 'Retry') {
                    // Microsoft pattern: Retry mechanism for transient failures
                    try {
                        await callback(...args);
                        vscode.window.showInformationMessage(`${title} succeeded on retry`);
                    }
                    catch (retryError) {
                        const retryErrorMessage = retryError instanceof Error ? retryError.message : 'Retry failed';
                        vscode.window.showErrorMessage(`${title} failed again: ${retryErrorMessage}`);
                    }
                }
                else if (retry === 'Report Issue') {
                    // Microsoft pattern: Direct user to issue reporting
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/branheim/kanri_for_vsc/issues/new'));
                }
            }
        });
        context.subscriptions.push(disposable);
    }
    logger.info(`Registered ${commands.length} commands`);
}
/**
 * Register views and view providers
 */
async function registerViews(context) {
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
function setupConfigurationWatchers(context) {
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
async function initializeWorkspace() {
    try {
        await boardManager.initializeWorkspace();
        logger.info('Workspace initialized for Kanri');
    }
    catch (error) {
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
async function createBoardCommand() {
    const board = await boardManager.createBoard();
    if (board) {
        // Refresh the tree view to show the new board
        boardsViewProvider.refresh();
        // Option to open the newly created board
        const openBoard = await vscode.window.showInformationMessage(`Board "${board.name}" created successfully!`, 'Open Board');
        if (openBoard === 'Open Board') {
            await openBoardCommand(board.id);
        }
    }
}
/**
 * Open board command
 */
async function openBoardCommand(boardId) {
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
async function listBoardsCommand() {
    await boardManager.viewAllBoards();
}
/**
 * Refresh boards view command
 */
async function refreshBoardsCommand() {
    boardsViewProvider.forceRefresh();
    vscode.window.showInformationMessage('Boards view refreshed');
}
/**
 * Show Kanban view command
 */
async function showKanbanViewCommand() {
    await vscode.commands.executeCommand('kanri.boardsView.focus');
}
/**
 * Open settings command
 */
async function openSettingsCommand() {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'kanri');
}
// ============================================================================
// WEBVIEW FUNCTIONALITY (Enhanced for Microsoft standards)
// ============================================================================
/**
 * Create Kanban board webview with enhanced error handling
 */
async function createKanbanBoardWebview(board, boardManager) {
    try {
        // Create webview panel
        const panel = vscode.window.createWebviewPanel('kanbanBoard', `Kanban: ${board.name}`, vscode.ViewColumn.One, {
            enableScripts: true,
            enableFindWidget: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'media')]
        });
        // Set webview HTML content
        panel.webview.html = getWebviewContent(panel.webview, board);
        // Handle webview messages with enhanced error handling
        panel.webview.onDidReceiveMessage(async (message) => {
            try {
                await handleWebviewMessage(message, board, boardManager, panel);
            }
            catch (error) {
                logger.error(`Webview message handling failed: ${error}`);
                panel.webview.postMessage({
                    type: 'error',
                    message: 'An error occurred while processing your request'
                });
            }
        });
        // Handle panel disposal
        panel.onDidDispose(() => {
            logger.debug(`Webview closed for board: ${board.name}`);
        });
        logger.info(`Webview created for board: ${board.name}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create webview';
        logger.error(`Webview creation failed: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to open board: ${errorMessage}`);
    }
}
/**
 * Handle messages from webview
 */
async function handleWebviewMessage(message, board, boardManager, panel) {
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
function getWebviewContent(webview, board) {
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
//# sourceMappingURL=extension.js.map