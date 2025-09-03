"use strict";
/**
 * Kanri for VS Code - Main Extension Entry Point
 *
 * This extension provides a visual Kanban board interface within VS Code,
 * similar to the desktop Kanri application, using webviews for rich UI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const logger_1 = require("./utils/logger");
const boardManager_1 = require("./managers/boardManager");
const configurationManager_1 = require("./utils/configurationManager");
const cardStorage_1 = require("./storage/cardStorage");
// Global logger instance
const logger = new logger_1.Logger();
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
 * Extension activation - called when VS Code loads the extension
 */
function activate(context) {
    console.log('Kanri for VS Code is now active!');
    // Register the create board command - now opens a visual board
    const createBoardCommand = vscode.commands.registerCommand('kanri.createBoard', async () => {
        try {
            const boardName = await vscode.window.showInputBox({
                prompt: 'Enter a name for your new kanban board',
                placeHolder: 'My Project Board'
            });
            if (boardName) {
                // Create and show the visual kanban board
                createKanbanBoardWebview(context, boardName);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create board: ${error}`);
        }
    });
    // Register the open board command - shows existing board
    const openBoardCommand = vscode.commands.registerCommand('kanri.openBoard', async () => {
        try {
            // For now, just create a sample board - later this will load saved boards
            createKanbanBoardWebview(context, 'Sample Board');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to open board: ${error}`);
        }
    });
    // Add commands to subscriptions for proper disposal
    context.subscriptions.push(createBoardCommand, openBoardCommand);
}
exports.activate = activate;
/**
 * Creates and displays a visual Kanban board using Microsoft's proven webview pattern
 * Uses external JavaScript files, proper CSP, and nonce-based security
 */
async function createKanbanBoardWebview(context, boardName) {
    // Initialize managers
    const logger = new logger_1.Logger();
    const configManager = new configurationManager_1.ConfigurationManager();
    const boardManager = new boardManager_1.BoardManager(context, configManager, logger);
    // Initialize card storage with Microsoft patterns
    const cardStorage = (0, cardStorage_1.createCardStorage)(context, logger);
    // Initialize workspace
    await boardManager.initializeWorkspace();
    // Try to load existing board or create a new one
    let board;
    try {
        const boards = await boardManager.getAllBoards();
        const existingBoard = boards.find((b) => b.name === boardName);
        if (existingBoard) {
            board = existingBoard;
        }
        else {
            // Create new board with empty columns
            board = await boardManager.createBoard({ name: boardName });
        }
    }
    catch (error) {
        // If board loading fails, create a new one
        board = await boardManager.createBoard({ name: boardName });
    }
    // Create webview panel with proper options following Microsoft's pattern
    const panel = vscode.window.createWebviewPanel('kanriBoard', `Kanri Board: ${boardName}`, vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'media')
        ]
    });
    // Generate nonce for security (Microsoft's pattern)
    const nonce = getNonce();
    // Get URIs for external resources
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'kanban.js'));
    // Set webview HTML content with Microsoft's CSP and external script pattern
    panel.webview.html = getKanbanBoardHTML(board, panel.webview, nonce, scriptUri);
    // Handle messages from webview with proper persistence
    panel.webview.onDidReceiveMessage(async (message) => {
        try {
            switch (message.command) {
                case 'addCard':
                    await handleAddCard(panel, message.column, cardStorage, boardManager, boardName);
                    break;
                case 'moveCard':
                    await handleMoveCard(message.cardId, message.targetColumn, cardStorage, panel);
                    break;
                case 'deleteCard':
                    await handleDeleteCard(panel, message.cardId, cardStorage);
                    break;
                case 'updateCard':
                    await handleUpdateCard(panel, message.cardId, message.updates, cardStorage);
                    break;
                case 'renameBoard':
                    await handleRenameBoard(panel, message.currentName, boardManager, boardName);
                    break;
                case 'addColumn':
                    await handleAddColumn(panel, boardManager, boardName);
                    break;
                case 'deleteColumn':
                    await handleDeleteColumn(panel, message.columnId, cardStorage, boardManager, boardName);
                    break;
                case 'renameColumn':
                    await handleRenameColumn(panel, message.columnId, message.newTitle, boardManager, boardName);
                    break;
                case 'reorderColumn':
                    await handleReorderColumn(message.draggedColumnId, message.targetColumnId, boardManager, boardName);
                    break;
                case 'refreshBoard':
                    await refreshBoardView(panel, boardName, cardStorage, boardManager);
                    break;
            }
        }
        catch (error) {
            logger.error(`Error handling message ${message.command}:`, error);
            vscode.window.showErrorMessage(`Failed to ${message.command}: ${error}`);
        }
    }, undefined, context.subscriptions);
    vscode.window.showInformationMessage(`Kanban board "${boardName}" opened!`);
}
/**
 * Generates HTML for the Kanban board interface using Microsoft's security pattern
 */
/**
 * Helper function to generate HTML for columns and cards based on board data
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
        // Create a safe column ID for HTML attributes
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
                </div>
                <div class="add-card-btn" data-column="${safeColumnId}">+ Add a card</div>
            </div>
        `;
    }).join('');
}
/**
 * Helper function to escape HTML characters for security
 */
function escapeHtml(text) {
    if (!text)
        return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/**
 * Generate HTML for kanban board webview using board data
 */
function getKanbanBoardHTML(board, webview, nonce, scriptUri) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
    <title>Kanri Board: ${board.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            height: 100vh;
            overflow-x: auto;
        }
        
        .board-header {
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .board-title {
            font-size: 24px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            flex: 1;
        }
        
        .rename-button {
            background: transparent;
            border: 1px solid var(--vscode-button-border);
            color: var(--vscode-button-foreground);
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
            opacity: 0.7;
            transition: opacity 0.2s;
        }
        
        .rename-button:hover {
            opacity: 1;
            background: var(--vscode-button-hoverBackground);
        }
        
        .kanban-board {
            display: flex;
            gap: 20px;
            min-height: calc(100vh - 100px);
            align-items: flex-start;
        }
        
        .column {
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            min-width: 300px;
            max-width: 350px;
            padding: 15px;
            flex-shrink: 0;
            cursor: grab;
            transition: all 0.2s ease;
        }
        
        .column:active {
            cursor: grabbing;
        }
        
        .column.dragging {
            opacity: 0.5;
            transform: scale(0.95);
            z-index: 1000;
        }
        
        .column.drag-over {
            border-left: 3px solid var(--vscode-focusBorder);
            transform: translateX(5px);
        }
        
        .kanban-board.dragging-column .column:not(.dragging) {
            border-left: 2px dashed var(--vscode-panel-border);
            transition: border-left 0.2s ease;
        }
        
        .column-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: grab;
            user-select: none;
        }
        
        .column-header:active {
            cursor: grabbing;
        }
        
        .column-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            flex: 1;
        }
        
        .column-actions {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        
        .delete-column-btn {
            background: transparent;
            border: none;
            color: var(--vscode-errorForeground);
            cursor: pointer;
            font-size: 14px;
            padding: 2px 4px;
            border-radius: 3px;
            opacity: 0.6;
            transition: opacity 0.2s;
        }
        
        .delete-column-btn:hover {
            opacity: 1;
            background: var(--vscode-inputValidation-errorBackground);
        }
        
        .card-count {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
        }
        
        .cards-container {
            min-height: 200px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
        }
        
        .card:hover {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .card-title {
            font-weight: 500;
            margin-bottom: 6px;
            color: var(--vscode-editor-foreground);
        }
        
        .card-description {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.4;
        }
        
        .card-actions {
            position: absolute;
            top: 8px;
            right: 8px;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        
        .card:hover .card-actions {
            opacity: 1;
        }
        
        .card-delete {
            background: var(--vscode-errorForeground);
            color: white;
            border: none;
            border-radius: 3px;
            width: 20px;
            height: 20px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .add-card-btn {
            background: transparent;
            border: 2px dashed var(--vscode-panel-border);
            color: var(--vscode-descriptionForeground);
            padding: 12px;
            border-radius: 6px;
            cursor: pointer;
            margin-top: 10px;
            text-align: center;
            transition: all 0.2s ease;
        }
        
        .add-card-btn:hover {
            border-color: var(--vscode-focusBorder);
            color: var(--vscode-editor-foreground);
            background: var(--vscode-list-hoverBackground);
        }
        
        .add-column-btn {
            background: transparent;
            border: 2px dashed var(--vscode-panel-border);
            color: var(--vscode-descriptionForeground);
            min-width: 300px;
            min-height: 100px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }
        
        .add-column-btn:hover {
            border-color: var(--vscode-focusBorder);
            color: var(--vscode-editor-foreground);
            background: var(--vscode-list-hoverBackground);
        }
        
        .card.dragging {
            opacity: 0.5;
            transform: rotate(2deg);
        }
        
        .cards-container.drag-over {
            background: var(--vscode-list-hoverBackground);
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            .kanban-board {
                flex-direction: column;
            }
            
            .column {
                min-width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="board-header">
        <h1 class="board-title">${board.name}</h1>
        <button class="rename-button" title="Rename board">✏️</button>
    </div>
    
    <div class="kanban-board" id="kanban-board">
        ${generateColumnsHTML(board)}
        <div class="add-column-btn" id="add-column-btn">+ Add Column</div>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
// Message handlers for webview communication
async function handleAddCard(panel, columnId, cardStorage, boardManager, boardName) {
    try {
        // Prompt user for card text
        const cardText = await vscode.window.showInputBox({
            prompt: 'Enter card title:',
            placeHolder: 'Enter your task or idea'
        });
        if (cardText && cardText.trim()) {
            // Create card using our robust storage system
            const createOptions = {
                title: cardText.trim(),
                columnId: columnId
            };
            const result = await cardStorage.createCard(createOptions);
            if (result.success && result.data) {
                // Send message to webview to add the card
                panel.webview.postMessage({
                    command: 'cardAdded',
                    card: {
                        id: result.data.id,
                        title: result.data.title,
                        description: result.data.description || '',
                        columnId: result.data.columnId
                    },
                    column: columnId
                });
                logger.info(`Added card "${cardText}" to column ${columnId} with ID ${result.data.id}`);
                vscode.window.showInformationMessage(`Card "${cardText}" added successfully!`);
            }
            else {
                // Handle storage error gracefully
                logger.error(`Failed to create card: ${result.error}`);
                vscode.window.showErrorMessage(`Failed to create card: ${result.error}`);
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error in handleAddCard: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to add card: ${errorMessage}`);
    }
}
async function handleMoveCard(cardId, targetColumn, cardStorage, panel) {
    try {
        logger.info(`Moving card ${cardId} to ${targetColumn}`);
        // Update card's column using storage system
        const result = await cardStorage.updateCard(cardId, { columnId: targetColumn });
        if (result.success) {
            // Send confirmation to webview that move was persisted
            panel.webview.postMessage({
                command: 'cardMoved',
                cardId: cardId,
                targetColumn: targetColumn,
                success: true
            });
            logger.info(`Successfully moved card ${cardId} to column ${targetColumn}`);
        }
        else {
            // Send failure notification to webview to revert the move
            panel.webview.postMessage({
                command: 'cardMoveError',
                cardId: cardId,
                error: result.error
            });
            logger.error(`Failed to move card ${cardId}: ${result.error}`);
            vscode.window.showWarningMessage(`Failed to save card move: ${result.error}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error moving card ${cardId}: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to move card: ${errorMessage}`);
    }
}
async function handleDeleteCard(panel, cardId, cardStorage) {
    try {
        logger.info(`Deleting card ${cardId}`);
        // Delete from storage first
        const result = await cardStorage.deleteCard(cardId);
        if (result.success) {
            // Send message to webview to remove the card
            panel.webview.postMessage({
                command: 'cardDeleted',
                cardId: cardId
            });
            logger.info(`Successfully deleted card ${cardId}`);
            vscode.window.showInformationMessage('Card deleted successfully');
        }
        else {
            logger.error(`Failed to delete card ${cardId}: ${result.error}`);
            vscode.window.showErrorMessage(`Failed to delete card: ${result.error}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error deleting card ${cardId}: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to delete card: ${errorMessage}`);
    }
}
function handleReorderColumn(draggedColumnId, targetColumnId, boardManager, boardName) {
    logger.info(`Reordering column ${draggedColumnId} before ${targetColumnId}`);
    // TODO: Update persistent storage when implemented
    // For now, just log the reorder operation
}
/**
 * Handle card updates with persistence
 */
async function handleUpdateCard(panel, cardId, updates, cardStorage) {
    try {
        const result = await cardStorage.updateCard(cardId, updates);
        if (result.success && result.data) {
            // Send updated card back to webview
            panel.webview.postMessage({
                command: 'cardUpdated',
                card: result.data
            });
            logger.info(`Updated card ${cardId}`);
        }
        else {
            logger.error(`Failed to update card ${cardId}: ${result.error}`);
            vscode.window.showErrorMessage(`Failed to update card: ${result.error}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error updating card ${cardId}: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to update card: ${errorMessage}`);
    }
}
/**
 * Handle board rename with persistence
 */
async function handleRenameBoard(panel, currentName, boardManager, boardName) {
    try {
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new board name:',
            value: currentName,
            placeHolder: 'Board name'
        });
        if (newName && newName.trim() && newName !== currentName) {
            // Update board in storage
            const board = await boardManager.getBoard(boardName);
            if (board) {
                board.name = newName.trim();
                await boardManager.saveBoard(board);
            }
            // Update the panel title
            panel.title = `Kanri Board: ${newName}`;
            // Send message to webview to update the board name
            panel.webview.postMessage({
                command: 'boardRenamed',
                newName: newName
            });
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
 * Handle column addition with persistence
 */
async function handleAddColumn(panel, boardManager, boardName) {
    try {
        const columnName = await vscode.window.showInputBox({
            prompt: 'Enter column name:',
            placeHolder: 'Column name'
        });
        if (columnName && columnName.trim()) {
            // Generate a unique column ID
            const columnId = columnName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
            // Update board structure
            const board = await boardManager.getBoard(boardName);
            if (board) {
                board.columns.push({
                    id: columnId,
                    title: columnName.trim(),
                    cards: []
                });
                await boardManager.saveBoard(board);
            }
            // Send message to webview to add the column
            panel.webview.postMessage({
                command: 'columnAdded',
                columnId: columnId,
                columnName: columnName.trim()
            });
            logger.info(`Added column "${columnName}" with ID "${columnId}"`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error adding column: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to add column: ${errorMessage}`);
    }
}
/**
 * Handle column deletion with persistence
 */
async function handleDeleteColumn(panel, columnId, cardStorage, boardManager, boardName) {
    try {
        const answer = await vscode.window.showWarningMessage(`Are you sure you want to delete this column? All cards in it will be lost.`, { modal: true }, 'Delete Column');
        if (answer === 'Delete Column') {
            // Delete all cards in the column first
            const columnCards = await cardStorage.getCardsByColumn(columnId);
            if (columnCards.success && columnCards.data) {
                for (const card of columnCards.data) {
                    await cardStorage.deleteCard(card.id);
                }
            }
            // Update board structure
            const board = await boardManager.getBoard(boardName);
            if (board) {
                board.columns = board.columns.filter(col => col.id !== columnId);
                await boardManager.saveBoard(board);
            }
            // Send message to webview to remove the column
            panel.webview.postMessage({
                command: 'columnDeleted',
                columnId: columnId
            });
            logger.info(`Deleted column ${columnId}`);
            vscode.window.showInformationMessage('Column deleted');
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error deleting column: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to delete column: ${errorMessage}`);
    }
}
/**
 * Handle column renaming with persistence
 */
async function handleRenameColumn(panel, columnId, newTitle, boardManager, boardName) {
    try {
        // Update board structure
        const board = await boardManager.getBoard(boardName);
        if (board) {
            const column = board.columns.find(col => col.id === columnId);
            if (column) {
                column.title = newTitle.trim();
                await boardManager.saveBoard(board);
                // Send confirmation to webview
                panel.webview.postMessage({
                    command: 'columnRenamed',
                    columnId: columnId,
                    newTitle: newTitle
                });
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
 * Helper function to update board structure when card is added
 */
async function updateBoardWithNewCard(card, boardManager, boardName) {
    try {
        const board = await boardManager.getBoard(boardName);
        if (board) {
            const column = board.columns.find(col => col.id === card.columnId);
            if (column) {
                // Add card to column if not already there
                const existingCard = column.cards.find(c => c.id === card.id);
                if (!existingCard) {
                    const boardCard = {
                        id: card.id,
                        title: card.title,
                        description: card.description || '',
                        priority: card.priority || 'medium',
                        tags: card.tags || [],
                        createdAt: card.createdAt,
                        lastModified: card.updatedAt
                    };
                    column.cards.push(boardCard);
                    await boardManager.saveBoard(board);
                }
            }
        }
    }
    catch (error) {
        logger.error(`Error updating board structure: ${error}`);
    }
}
/**
 * Refresh board view with latest data from storage
 */
async function refreshBoardView(panel, boardName, cardStorage, boardManager) {
    try {
        // Get fresh board data
        const board = await boardManager.getBoard(boardName);
        if (board) {
            // Get all cards from storage and organize by column
            const allCards = await cardStorage.getAllCards();
            if (allCards.success && allCards.data) {
                // Update board columns with current cards
                for (const column of board.columns) {
                    const columnCards = allCards.data
                        .filter(card => card.columnId === column.id)
                        .sort((a, b) => a.order - b.order)
                        .map(card => ({
                        id: card.id,
                        title: card.title,
                        description: card.description,
                        priority: card.priority || 'medium',
                        tags: card.tags || [],
                        createdAt: card.createdAt,
                        lastModified: card.updatedAt
                    }));
                    column.cards = columnCards; // Type assertion for compatibility
                }
                // Save updated board structure
                await boardManager.saveBoard(board);
                // Send fresh board data to webview
                panel.webview.postMessage({
                    command: 'boardRefreshed',
                    board: board
                });
            }
        }
    }
    catch (error) {
        logger.error(`Error refreshing board view: ${error}`);
    }
}
/**
 * Extension deactivation - called when VS Code unloads the extension
 */
function deactivate() {
    console.log('Kanri for VS Code has been deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map