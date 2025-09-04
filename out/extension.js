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
        {
            command: 'kanri.deleteBoard',
            callback: deleteBoardCommand,
            title: 'Delete Board'
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
 * Delete board command
 */
async function deleteBoardCommand(treeItem) {
    try {
        // If called from context menu, treeItem will contain the BoardTreeItem
        let targetBoardId;
        if (treeItem && treeItem.board && treeItem.board.id) {
            // Called from context menu - use the board from the tree item
            targetBoardId = treeItem.board.id;
        }
        let targetBoard;
        if (!targetBoardId) {
            // Show board selection
            const boards = await boardManager.listBoards();
            if (boards.length === 0) {
                vscode.window.showInformationMessage('No boards to delete');
                return;
            }
            const boardItems = boards.map(board => ({
                label: board.name,
                description: `${board.columns.length} columns, ${board.columns.reduce((sum, col) => sum + col.cards.length, 0)} cards`,
                id: board.id
            }));
            const selectedBoard = await vscode.window.showQuickPick(boardItems, {
                placeHolder: 'Select a board to delete',
                canPickMany: false
            });
            if (!selectedBoard) {
                return; // User cancelled
            }
            targetBoardId = selectedBoard.id;
            targetBoard = boards.find(b => b.id === targetBoardId);
        }
        else {
            targetBoard = await boardManager.getBoard(targetBoardId);
        }
        if (!targetBoard) {
            vscode.window.showErrorMessage(`Board not found: ${targetBoardId}`);
            return;
        }
        // Confirmation dialog
        const totalCards = targetBoard.columns.reduce((sum, col) => sum + col.cards.length, 0);
        const confirmation = await vscode.window.showWarningMessage(`Are you sure you want to delete "${targetBoard.name}"?`, {
            modal: true,
            detail: `This will permanently delete the board with ${targetBoard.columns.length} columns and ${totalCards} cards. This action cannot be undone.`
        }, 'Delete Board');
        if (confirmation !== 'Delete Board') {
            return; // User cancelled
        }
        // Delete the board
        await boardManager.deleteBoard(targetBoardId);
        // Refresh the tree view
        boardsViewProvider.refresh();
        vscode.window.showInformationMessage(`Board "${targetBoard.name}" deleted successfully`);
        logger.info(`Board deleted: ${targetBoard.name} (${targetBoardId})`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error deleting board: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to delete board: ${errorMessage}`);
    }
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
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Generate a nonce for script security (Microsoft's pattern)
 */
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
// ============================================================================
// WEBVIEW FUNCTIONALITY (Enhanced for Microsoft standards)
// ============================================================================
/**
 * Create Kanban board webview with full functionality restored
 */
async function createKanbanBoardWebview(board, boardManager) {
    try {
        // Create webview panel with proper configuration
        const panel = vscode.window.createWebviewPanel('kanbanBoard', `Kanban: ${board.name}`, vscode.ViewColumn.One, {
            enableScripts: true,
            enableFindWidget: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'media'),
                vscode.Uri.file(require('path').join(__dirname, '..', 'media'))
            ]
        });
        // Generate nonce for security
        const nonce = getNonce();
        // Get script URI
        const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(__dirname, '..', 'media', 'kanban.js')));
        // Set webview HTML content with working Kanban board
        panel.webview.html = getKanbanBoardHTML(board, panel.webview, nonce, scriptUri);
        // Handle webview messages with full functionality
        panel.webview.onDidReceiveMessage(async (message) => {
            try {
                await handleWebviewMessage(message, board, boardManager, panel);
                // Refresh boards view after any change
                boardsViewProvider.refresh();
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
 * Handle messages from webview with full board functionality
 */
async function handleWebviewMessage(message, board, boardManager, panel) {
    switch (message.type) {
        case 'boardUpdated':
            logger.debug('Board updated via webview');
            await boardManager.saveBoard(message.board);
            break;
        case 'requestBoardData':
            logger.debug('Webview requesting board data');
            panel.webview.postMessage({
                type: 'boardData',
                board: board
            });
            break;
        case 'addCard':
            await handleAddCard(panel, message.column, boardManager, board);
            break;
        case 'moveCard':
            await handleMoveCard(message.cardId, message.targetColumn, boardManager, board, panel, message.sourceColumn, message.position);
            break;
        case 'deleteCard':
            await handleDeleteCard(panel, message.cardId, boardManager, board);
            break;
        case 'updateCard':
            await handleUpdateCard(panel, message.cardId, message.updates, boardManager, board);
            break;
        case 'addColumn':
            await handleAddColumn(panel, boardManager, board);
            break;
        case 'deleteColumn':
            await handleDeleteColumn(panel, message.columnId, boardManager, board);
            break;
        case 'renameColumn':
            await handleRenameColumn(panel, message.columnId, message.currentTitle, boardManager, board);
            break;
        case 'renameBoard':
            await handleRenameBoard(panel, message.currentName, boardManager, board);
            break;
        case 'reorderColumn':
            await handleReorderColumn(panel, message.draggedColumnId, message.targetColumnId, boardManager, board);
            break;
        default:
            logger.warn(`Unknown webview message type: ${message.type}`);
    }
}
/**
 * Generate full functional HTML for Kanban board
 */
function getKanbanBoardHTML(board, webview, nonce, scriptUri) {
    const columnsHTML = generateColumnsHTML(board);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Kanban Board: ${escapeHtml(board.name)}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            margin: 0;
            padding: 20px;
            overflow-x: auto;
        }
        
        .board-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        
        .board-title {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-foreground);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }
        
        .board-title:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .board-actions {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .board-container {
            display: flex;
            gap: 20px;
            overflow-x: auto;
            min-height: 500px;
            padding-bottom: 20px;
        }
        
        .column {
            background-color: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            min-width: 300px;
            max-width: 350px;
            flex-shrink: 0;
        }
        
        .column-header {
            padding: 15px;
            background-color: var(--vscode-sideBarTitle-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 8px 8px 0 0;
        }
        
        .column-title {
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }
        
        .column-title:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .column-actions {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .card-count {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
        }
        
        .delete-column-btn {
            background: none;
            border: none;
            color: var(--vscode-errorForeground);
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
        }
        
        .cards-container {
            padding: 15px;
            min-height: 200px;
            max-height: 600px;
            overflow-y: auto;
        }
        
        .card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            margin-bottom: 10px;
            padding: 12px;
            cursor: grab;
            position: relative;
            transition: box-shadow 0.2s ease;
        }
        
        .card:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        
        .card.dragging {
            opacity: 0.5;
            transform: rotate(5deg);
        }
        
        .card-actions {
            position: absolute;
            top: 5px;
            right: 5px;
        }
        
        .delete-card-btn {
            background: none;
            border: none;
            color: var(--vscode-errorForeground);
            font-size: 16px;
            cursor: pointer;
            width: 20px;
            height: 20px;
            border-radius: 50%;
        }
        
        .delete-card-btn:hover {
            background-color: var(--vscode-errorBackground);
        }
        
        .card-title {
            font-weight: bold;
            margin-bottom: 8px;
            padding-right: 25px;
        }
        
        .card-description {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            line-height: 1.4;
        }
        
        .add-card-btn {
            width: 100%;
            padding: 10px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px dashed var(--vscode-panel-border);
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
        }
        
        .add-card-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .drop-zone {
            border: 2px dashed var(--vscode-focusBorder);
            background-color: var(--vscode-inputValidation-infoBackground);
            border-radius: 6px;
            margin: 10px 0;
            padding: 20px;
            text-align: center;
            color: var(--vscode-inputValidation-infoForeground);
        }
    </style>
</head>
<body>
    <div class="board-header">
        <h1 class="board-title">${escapeHtml(board.name)}</h1>
        <div class="board-actions">
            <button class="btn add-column-btn">Add Column</button>
        </div>
    </div>
    
    <div class="board-container" id="kanban-board">
        ${columnsHTML}
    </div>
    
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
/**
 * Generate HTML for columns and cards
 */
function generateColumnsHTML(board) {
    return board.columns.map(column => {
        const cardsHTML = column.cards.map(card => `
            <div class="card" draggable="true" data-card-id="${card.id}" id="${card.id}">
                <div class="card-actions">
                    <button class="delete-card-btn" data-card-id="${card.id}">&times;</button>
                </div>
                <div class="card-title">${escapeHtml(card.title)}</div>
                <div class="card-description">${escapeHtml(card.description || '')}</div>
            </div>
        `).join('');
        const safeColumnId = column.id.replace(/[^a-zA-Z0-9-_]/g, '');
        return `
            <div class="column" data-column="${safeColumnId}">
                <div class="column-header">
                    <span class="column-title">${escapeHtml(column.title)}</span>
                    <div class="column-actions">
                        <span class="card-count">${column.cards.length}</span>
                        <button class="delete-column-btn" data-column="${safeColumnId}" title="Delete column">&times;</button>
                    </div>
                </div>
                <div class="cards-container" id="${safeColumnId}-cards" data-column="${safeColumnId}">
                    ${cardsHTML}
                    <button class="add-card-btn" data-column="${safeColumnId}">+ Add Card</button>
                </div>
            </div>
        `;
    }).join('');
}
// ============================================================================
// CARD AND COLUMN HANDLERS
// ============================================================================
/**
 * Handle adding a new card
 */
async function handleAddCard(panel, columnId, boardManager, board) {
    try {
        const cardTitle = await vscode.window.showInputBox({
            prompt: 'Enter card title:',
            placeHolder: 'Card title'
        });
        if (cardTitle && cardTitle.trim()) {
            const cardDescription = await vscode.window.showInputBox({
                prompt: 'Enter card description (optional):',
                placeHolder: 'Card description'
            });
            // Generate unique card ID
            const cardId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            // Find the target column and add the card
            const targetColumn = board.columns.find(col => col.id === columnId);
            if (targetColumn) {
                const newCard = {
                    id: cardId,
                    title: cardTitle.trim(),
                    description: cardDescription?.trim() || '',
                    priority: 'medium',
                    tags: [],
                    createdAt: new Date(),
                    lastModified: new Date()
                };
                targetColumn.cards.push(newCard);
                await boardManager.saveBoard(board);
                // Refresh the webview
                panel.webview.html = getKanbanBoardHTML(board, panel.webview, getNonce(), panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(__dirname, '..', 'media', 'kanban.js'))));
                logger.info(`Added card "${cardTitle}" to column ${columnId}`);
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error adding card: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to add card: ${errorMessage}`);
    }
}
/**
 * Handle moving a card between columns or within the same column
 */
async function handleMoveCard(cardId, targetColumnId, boardManager, board, panel, sourceColumnId, position) {
    try {
        // Find the card in any column
        let sourceColumn = null;
        let cardToMove = null;
        for (const column of board.columns) {
            const card = column.cards.find(c => c.id === cardId);
            if (card) {
                sourceColumn = column;
                cardToMove = card;
                break;
            }
        }
        if (cardToMove && sourceColumn) {
            // Remove from source column
            sourceColumn.cards = sourceColumn.cards.filter(c => c.id !== cardId);
            // Add to target column at specified position
            const targetColumn = board.columns.find(col => col.id === targetColumnId);
            if (targetColumn) {
                cardToMove.lastModified = new Date();
                // Insert at specific position or append to end
                if (typeof position === 'number' && position >= 0 && position <= targetColumn.cards.length) {
                    targetColumn.cards.splice(position, 0, cardToMove);
                }
                else {
                    targetColumn.cards.push(cardToMove);
                }
                await boardManager.saveBoard(board);
                // Refresh the webview
                panel.webview.html = getKanbanBoardHTML(board, panel.webview, getNonce(), panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(__dirname, '..', 'media', 'kanban.js'))));
                logger.info(`Moved card ${cardId} to column ${targetColumnId}${typeof position === 'number' ? ` at position ${position}` : ''}`);
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error moving card: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to move card: ${errorMessage}`);
    }
}
/**
 * Handle deleting a card
 */
async function handleDeleteCard(panel, cardId, boardManager, board) {
    try {
        // Find and remove the card
        for (const column of board.columns) {
            const cardIndex = column.cards.findIndex(c => c.id === cardId);
            if (cardIndex !== -1) {
                column.cards.splice(cardIndex, 1);
                await boardManager.saveBoard(board);
                // Refresh the webview
                panel.webview.html = getKanbanBoardHTML(board, panel.webview, getNonce(), panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(__dirname, '..', 'media', 'kanban.js'))));
                logger.info(`Deleted card ${cardId}`);
                vscode.window.showInformationMessage('Card deleted successfully');
                break;
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error deleting card: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to delete card: ${errorMessage}`);
    }
}
/**
 * Handle updating a card
 */
async function handleUpdateCard(panel, cardId, updates, boardManager, board) {
    try {
        // Find and update the card
        for (const column of board.columns) {
            const card = column.cards.find(c => c.id === cardId);
            if (card) {
                Object.assign(card, updates);
                card.lastModified = new Date();
                await boardManager.saveBoard(board);
                // Refresh the webview
                panel.webview.html = getKanbanBoardHTML(board, panel.webview, getNonce(), panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(__dirname, '..', 'media', 'kanban.js'))));
                logger.info(`Updated card ${cardId}`);
                break;
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error updating card: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to update card: ${errorMessage}`);
    }
}
/**
 * Handle adding a new column
 */
async function handleAddColumn(panel, boardManager, board) {
    try {
        const columnName = await vscode.window.showInputBox({
            prompt: 'Enter column name:',
            placeHolder: 'Column name'
        });
        if (columnName && columnName.trim()) {
            const columnId = `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            board.columns.push({
                id: columnId,
                title: columnName.trim(),
                cards: []
            });
            await boardManager.saveBoard(board);
            // Refresh the webview
            panel.webview.html = getKanbanBoardHTML(board, panel.webview, getNonce(), panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(__dirname, '..', 'media', 'kanban.js'))));
            logger.info(`Added column "${columnName}"`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error adding column: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to add column: ${errorMessage}`);
    }
}
/**
 * Handle deleting a column
 */
async function handleDeleteColumn(panel, columnId, boardManager, board) {
    try {
        const column = board.columns.find(col => col.id === columnId);
        if (column && column.cards.length > 0) {
            const answer = await vscode.window.showWarningMessage(`Are you sure you want to delete this column? It contains ${column.cards.length} card(s).`, { modal: true }, 'Delete Column');
            if (answer !== 'Delete Column') {
                return;
            }
        }
        // Remove the column
        board.columns = board.columns.filter(col => col.id !== columnId);
        await boardManager.saveBoard(board);
        // Refresh the webview
        panel.webview.html = getKanbanBoardHTML(board, panel.webview, getNonce(), panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(__dirname, '..', 'media', 'kanban.js'))));
        logger.info(`Deleted column ${columnId}`);
        vscode.window.showInformationMessage('Column deleted');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error deleting column: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to delete column: ${errorMessage}`);
    }
}
/**
 * Handle renaming a column
 */
async function handleRenameColumn(panel, columnId, currentTitle, boardManager, board) {
    try {
        const newTitle = await vscode.window.showInputBox({
            prompt: 'Enter new column name:',
            placeHolder: 'Column name',
            value: currentTitle
        });
        if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
            const column = board.columns.find(col => col.id === columnId);
            if (column) {
                column.title = newTitle.trim();
                await boardManager.saveBoard(board);
                // Refresh the webview
                panel.webview.html = getKanbanBoardHTML(board, panel.webview, getNonce(), panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(__dirname, '..', 'media', 'kanban.js'))));
                logger.info(`Renamed column ${columnId} to "${newTitle}"`);
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error renaming column: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to rename column: ${errorMessage}`);
    }
}
/**
 * Handle renaming the board
 */
async function handleRenameBoard(panel, currentName, boardManager, board) {
    try {
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new board name:',
            placeHolder: 'Board name',
            value: currentName
        });
        if (newName && newName.trim() && newName.trim() !== currentName) {
            board.name = newName.trim();
            board.lastModified = new Date();
            await boardManager.saveBoard(board);
            // Refresh the webview
            panel.webview.html = getKanbanBoardHTML(board, panel.webview, getNonce(), panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(__dirname, '..', 'media', 'kanban.js'))));
            // Update the panel title
            panel.title = `Kanban: ${newName}`;
            logger.info(`Renamed board to "${newName}"`);
            vscode.window.showInformationMessage(`Board renamed to "${newName}"`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error renaming board: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to rename board: ${errorMessage}`);
    }
}
/**
 * Handle reordering columns
 */
async function handleReorderColumn(panel, draggedColumnId, targetColumnId, boardManager, board) {
    try {
        const draggedIndex = board.columns.findIndex(col => col.id === draggedColumnId);
        const targetIndex = board.columns.findIndex(col => col.id === targetColumnId);
        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
            // Remove the dragged column from its current position
            const [draggedColumn] = board.columns.splice(draggedIndex, 1);
            // Insert it before the target column
            const newTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
            board.columns.splice(newTargetIndex, 0, draggedColumn);
            board.lastModified = new Date();
            await boardManager.saveBoard(board);
            // Refresh the webview
            panel.webview.html = getKanbanBoardHTML(board, panel.webview, getNonce(), panel.webview.asWebviewUri(vscode.Uri.file(require('path').join(__dirname, '..', 'media', 'kanban.js'))));
            logger.info(`Reordered column ${draggedColumnId} before ${targetColumnId}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error reordering column: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to reorder column: ${errorMessage}`);
    }
}
//# sourceMappingURL=extension.js.map