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
function createKanbanBoardWebview(context, boardName) {
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
    panel.webview.html = getKanbanBoardHTML(boardName, panel.webview, nonce, scriptUri);
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'addCard':
                handleAddCard(panel, message.column);
                break;
            case 'moveCard':
                handleMoveCard(message.cardId, message.targetColumn);
                break;
            case 'deleteCard':
                handleDeleteCard(panel, message.cardId);
                break;
            case 'renameBoard':
                handleRenameBoard(panel, message.currentName);
                break;
        }
    }, undefined, context.subscriptions);
    vscode.window.showInformationMessage(`Kanban board "${boardName}" opened!`);
}
/**
 * Generates HTML for the Kanban board interface using Microsoft's security pattern
 */
function getKanbanBoardHTML(boardName, webview, nonce, scriptUri) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
    <title>Kanri Board: ${boardName}</title>
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
        }
        
        .column-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .column-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
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
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px dashed var(--vscode-input-border);
            border-radius: 6px;
            padding: 12px;
            cursor: pointer;
            text-align: center;
            transition: all 0.2s ease;
            margin-top: 10px;
        }
        
        .add-card-btn:hover {
            background: var(--vscode-button-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }
        
        .card.dragging {
            opacity: 0.5;
            transform: rotate(2deg);
        }
        
        .column.drag-over {
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
        <h1 class="board-title">${boardName}</h1>
        <button class="rename-button" title="Rename board">✏️</button>
    </div>
    
    <div class="kanban-board" id="kanban-board">
        <div class="column" data-column="todo">
            <div class="column-header">
                <span class="column-title">To Do</span>
                <span class="card-count">2</span>
            </div>
            <div class="cards-container" id="todo-cards" data-column="todo">
                <div class="card" draggable="true" data-card-id="1" id="1">
                    <div class="card-actions">
                        <button class="delete-card-btn" data-card-id="1">&times;</button>
                    </div>
                    <div class="card-title">Design new feature</div>
                    <div class="card-description">Create mockups and wireframes for the new dashboard feature</div>
                </div>
                <div class="card" draggable="true" data-card-id="2" id="2">
                    <div class="card-actions">
                        <button class="delete-card-btn" data-card-id="2">&times;</button>
                    </div>
                    <div class="card-title">Write documentation</div>
                    <div class="card-description">Update API documentation with new endpoints</div>
                </div>
            </div>
            <div class="add-card-btn" data-column="todo">+ Add a card</div>
        </div>
        
        <div class="column" data-column="inprogress">
            <div class="column-header">
                <span class="column-title">In Progress</span>
                <span class="card-count">1</span>
            </div>
            <div class="cards-container" id="inprogress-cards" data-column="inprogress">
                <div class="card" draggable="true" data-card-id="3" id="3">
                    <div class="card-actions">
                        <button class="delete-card-btn" data-card-id="3">&times;</button>
                    </div>
                    <div class="card-title">Implement authentication</div>
                    <div class="card-description">Add OAuth integration and JWT token handling</div>
                </div>
            </div>
            <div class="add-card-btn" data-column="inprogress">+ Add a card</div>
        </div>
        
        <div class="column" data-column="done">
            <div class="column-header">
                <span class="column-title">Done</span>
                <span class="card-count">1</span>
            </div>
            <div class="cards-container" id="done-cards" data-column="done">
                <div class="card" draggable="true" data-card-id="4" id="4">
                    <div class="card-actions">
                        <button class="delete-card-btn" data-card-id="4">&times;</button>
                    </div>
                    <div class="card-title">Setup project structure</div>
                    <div class="card-description">Initialize repository and configure build tools</div>
                </div>
            </div>
            <div class="add-card-btn" data-column="done">+ Add a card</div>
        </div>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
// Message handlers for webview communication
function handleAddCard(panel, columnId) {
    // Prompt user for card text
    vscode.window.showInputBox({
        prompt: 'Enter card title:',
        placeHolder: 'Enter your task or idea'
    }).then(cardText => {
        if (cardText && cardText.trim()) {
            // Generate unique card ID
            const cardId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            // Send message to webview to add the card
            panel.webview.postMessage({
                command: 'cardAdded',
                card: {
                    id: cardId,
                    title: cardText.trim(),
                    columnId: columnId
                },
                column: columnId
            });
            logger.info(`Added card "${cardText}" to column ${columnId}`);
        }
    });
}
function handleMoveCard(cardId, targetColumn) {
    logger.info(`Moving card ${cardId} to ${targetColumn}`);
    // TODO: Update persistent storage when implemented
}
function handleDeleteCard(panel, cardId) {
    logger.info(`Deleting card ${cardId}`);
    // Send message to webview to remove the card
    panel.webview.postMessage({
        command: 'cardDeleted',
        cardId: cardId
    });
    // TODO: Remove from persistent storage when implemented
}
function handleRenameBoard(panel, currentName) {
    // Prompt user for new board name
    vscode.window.showInputBox({
        prompt: 'Enter new board name:',
        value: currentName,
        placeHolder: 'Board name'
    }).then(newName => {
        if (newName && newName.trim() && newName !== currentName) {
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
    });
}
/**
 * Extension deactivation - called when VS Code unloads the extension
 */
function deactivate() {
    console.log('Kanri for VS Code has been deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map