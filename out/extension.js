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
 * Creates and displays a visual Kanban board using VS Code webview
 */
function createKanbanBoardWebview(context, boardName) {
    // Create webview panel
    const panel = vscode.window.createWebviewPanel('kanriBoard', `Kanri Board: ${boardName}`, vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true
    });
    // Set webview HTML content
    panel.webview.html = getKanbanBoardHTML(boardName);
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'addCard':
                handleAddCard(panel, message.columnId, message.cardText);
                break;
            case 'moveCard':
                handleMoveCard(message.cardId, message.fromColumn, message.toColumn);
                break;
            case 'deleteCard':
                handleDeleteCard(message.cardId);
                break;
            case 'renameBoard':
                handleRenameBoard(panel, message.newName);
                break;
        }
    }, undefined, context.subscriptions);
    vscode.window.showInformationMessage(`Kanban board "${boardName}" opened!`);
}
/**
 * Generates HTML for the Kanban board interface
 */
function getKanbanBoardHTML(boardName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        <button class="rename-button" onclick="renameBoard()" title="Rename board">✏️</button>
    </div>
    
    <div class="kanban-board" id="kanban-board">
        <div class="column" data-column="todo">
            <div class="column-header">
                <span class="column-title">To Do</span>
                <span class="card-count">2</span>
            </div>
            <div class="cards-container" id="todo-cards">
                <div class="card" draggable="true" data-card-id="1">
                    <div class="card-actions">
                        <button class="card-delete" onclick="deleteCard('1')">&times;</button>
                    </div>
                    <div class="card-title">Design new feature</div>
                    <div class="card-description">Create mockups and wireframes for the new dashboard feature</div>
                </div>
                <div class="card" draggable="true" data-card-id="2">
                    <div class="card-actions">
                        <button class="card-delete" onclick="deleteCard('2')">&times;</button>
                    </div>
                    <div class="card-title">Write documentation</div>
                    <div class="card-description">Update API documentation with new endpoints</div>
                </div>
            </div>
            <div class="add-card-btn" onclick="addCard('todo')">+ Add a card</div>
        </div>
        
        <div class="column" data-column="inprogress">
            <div class="column-header">
                <span class="column-title">In Progress</span>
                <span class="card-count">1</span>
            </div>
            <div class="cards-container" id="inprogress-cards">
                <div class="card" draggable="true" data-card-id="3">
                    <div class="card-actions">
                        <button class="card-delete" onclick="deleteCard('3')">&times;</button>
                    </div>
                    <div class="card-title">Implement authentication</div>
                    <div class="card-description">Add OAuth integration and JWT token handling</div>
                </div>
            </div>
            <div class="add-card-btn" onclick="addCard('inprogress')">+ Add a card</div>
        </div>
        
        <div class="column" data-column="done">
            <div class="column-header">
                <span class="column-title">Done</span>
                <span class="card-count">1</span>
            </div>
            <div class="cards-container" id="done-cards">
                <div class="card" draggable="true" data-card-id="4">
                    <div class="card-actions">
                        <button class="card-delete" onclick="deleteCard('4')">&times;</button>
                    </div>
                    <div class="card-title">Setup project structure</div>
                    <div class="card-description">Initialize repository and configure build tools</div>
                </div>
            </div>
            <div class="add-card-btn" onclick="addCard('done')">+ Add a card</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let draggedCard = null;
        
        // Add card functionality
        function addCard(columnId) {
            const cardText = prompt('Enter card title:');
            if (cardText && cardText.trim()) {
                vscode.postMessage({
                    command: 'addCard',
                    columnId: columnId,
                    cardText: cardText.trim()
                });
            }
        }
        
        // Delete card functionality
        function deleteCard(cardId) {
            if (confirm('Delete this card?')) {
                vscode.postMessage({
                    command: 'deleteCard',
                    cardId: cardId
                });
                
                // Remove from UI immediately
                const cardElement = document.querySelector(\`[data-card-id="\${cardId}"]\`);
                if (cardElement) {
                    cardElement.remove();
                    updateCardCounts();
                }
            }
        }
        
        // Add card to column UI
        function addCardToColumn(columnId, title, cardId) {
            const cardsContainer = document.getElementById(columnId + '-cards');
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.draggable = true;
            cardElement.setAttribute('data-card-id', cardId);
            cardElement.innerHTML = \`
                <div class="card-actions">
                    <button class="card-delete" onclick="deleteCard('\${cardId}')">&times;</button>
                </div>
                <div class="card-title">\${title}</div>
                <div class="card-description">Click to add description</div>
            \`;
            
            cardsContainer.appendChild(cardElement);
            setupDragAndDrop(cardElement);
            updateCardCounts();
        }
        
        // Setup drag and drop for cards
        function setupDragAndDrop(cardElement) {
            cardElement.addEventListener('dragstart', (e) => {
                draggedCard = cardElement;
                cardElement.classList.add('dragging');
            });
            
            cardElement.addEventListener('dragend', (e) => {
                cardElement.classList.remove('dragging');
                draggedCard = null;
            });
        }
        
        // Setup drop zones for columns
        document.querySelectorAll('.cards-container').forEach(container => {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.parentElement.classList.add('drag-over');
            });
            
            container.addEventListener('dragleave', (e) => {
                container.parentElement.classList.remove('drag-over');
            });
            
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.parentElement.classList.remove('drag-over');
                
                if (draggedCard && container !== draggedCard.parentElement) {
                    const fromColumn = draggedCard.parentElement.id.replace('-cards', '');
                    const toColumn = container.id.replace('-cards', '');
                    const cardId = draggedCard.getAttribute('data-card-id');
                    
                    // Move card in UI
                    container.appendChild(draggedCard);
                    updateCardCounts();
                    
                    // Notify extension
                    vscode.postMessage({
                        command: 'moveCard',
                        cardId: cardId,
                        fromColumn: fromColumn,
                        toColumn: toColumn
                    });
                }
            });
        });
        
        // Update card counts in column headers
        function updateCardCounts() {
            document.querySelectorAll('.column').forEach(column => {
                const cardsContainer = column.querySelector('.cards-container');
                const cardCount = cardsContainer.children.length;
                const countElement = column.querySelector('.card-count');
                countElement.textContent = cardCount;
            });
        }
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'cardAdded':
                    // Card was successfully added, ensure it's in the UI
                    const existingCard = document.querySelector(\`[data-card-id="\${message.card.id}"]\`);
                    if (!existingCard) {
                        addCardToColumn(message.card.columnId, message.card.text, message.card.id);
                    }
                    break;
                case 'boardRenamed':
                    // Update the board title in the UI
                    const titleElement = document.querySelector('h1');
                    if (titleElement) {
                        titleElement.textContent = message.newName;
                    }
                    break;
            }
        });
        
        // Function to rename board
        function renameBoard() {
            const currentName = document.querySelector('h1').textContent;
            const newName = prompt('Enter new board name:', currentName);
            if (newName && newName.trim() && newName !== currentName) {
                vscode.postMessage({
                    command: 'renameBoard',
                    newName: newName.trim()
                });
            }
        }
        
        // Initialize drag and drop for existing cards
        document.querySelectorAll('.card').forEach(setupDragAndDrop);
    </script>
</body>
</html>`;
}
// Message handlers for webview communication
function handleAddCard(panel, columnId, cardText) {
    if (!cardText.trim()) {
        vscode.window.showWarningMessage('Card text cannot be empty');
        return;
    }
    // Generate unique card ID
    const cardId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Send message to webview to add the card
    panel.webview.postMessage({
        command: 'cardAdded',
        card: {
            id: cardId,
            text: cardText,
            columnId: columnId
        }
    });
    logger.info(`Added card "${cardText}" to column ${columnId}`);
}
function handleMoveCard(cardId, fromColumn, toColumn) {
    logger.info(`Moving card ${cardId} from ${fromColumn} to ${toColumn}`);
    // TODO: Update persistent storage when implemented
}
function handleDeleteCard(cardId) {
    logger.info(`Deleting card ${cardId}`);
    // TODO: Remove from persistent storage when implemented
}
function handleRenameBoard(panel, newName) {
    if (!newName.trim()) {
        vscode.window.showWarningMessage('Board name cannot be empty');
        return;
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
/**
 * Extension deactivation - called when VS Code unloads the extension
 */
function deactivate() {
    console.log('Kanri for VS Code has been deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map