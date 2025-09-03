// Kanban Board JavaScript - External Script with Microsoft Pattern
// This follows VS Code webview best practices for security and functionality

(function() {
    const vscode = acquireVsCodeApi();
    
    // Initialize the kanban board when DOM loads
    document.addEventListener('DOMContentLoaded', function() {
        initializeKanbanBoard();
    });

    function initializeKanbanBoard() {
        console.log('Kanban board JavaScript loaded');
        
        // Add event listeners for all interactive elements
        setupEventListeners();
        
        // Initialize drag and drop
        initializeDragAndDrop();
    }

    function setupEventListeners() {
        // Add card buttons
        const addCardButtons = document.querySelectorAll('.add-card-btn');
        addCardButtons.forEach(button => {
            button.addEventListener('click', function() {
                const column = this.getAttribute('data-column');
                console.log('Add card clicked for column:', column);
                
                vscode.postMessage({
                    command: 'addCard',
                    column: column
                });
            });
        });

        // Delete card buttons
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-card-btn')) {
                const cardId = e.target.getAttribute('data-card-id');
                console.log('Delete card clicked for card:', cardId);
                
                vscode.postMessage({
                    command: 'deleteCard',
                    cardId: cardId
                });
            }
        });

        // Board rename functionality
        const boardTitle = document.querySelector('.board-title');
        if (boardTitle) {
            boardTitle.addEventListener('click', function() {
                console.log('Board title clicked - enabling rename');
                
                vscode.postMessage({
                    command: 'renameBoard',
                    currentName: this.textContent
                });
            });
        }
    }

    function initializeDragAndDrop() {
        const cards = document.querySelectorAll('.kanban-card');
        const columns = document.querySelectorAll('.kanban-column');

        // Make cards draggable
        cards.forEach(card => {
            card.draggable = true;
            
            card.addEventListener('dragstart', function(e) {
                e.dataTransfer.setData('text/plain', this.id);
                this.classList.add('dragging');
            });

            card.addEventListener('dragend', function() {
                this.classList.remove('dragging');
            });
        });

        // Make columns drop targets
        columns.forEach(column => {
            column.addEventListener('dragover', function(e) {
                e.preventDefault();
                this.classList.add('drag-over');
            });

            column.addEventListener('dragleave', function() {
                this.classList.remove('drag-over');
            });

            column.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('drag-over');
                
                const cardId = e.dataTransfer.getData('text/plain');
                const targetColumn = this.getAttribute('data-column');
                
                console.log('Card dropped:', cardId, 'to column:', targetColumn);
                
                vscode.postMessage({
                    command: 'moveCard',
                    cardId: cardId,
                    targetColumn: targetColumn
                });
            });
        });
    }

    // Handle messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'updateBoard':
                updateBoardDisplay(message.boardData);
                break;
            case 'cardAdded':
                addCardToBoard(message.card, message.column);
                break;
            case 'cardDeleted':
                removeCardFromBoard(message.cardId);
                break;
            case 'boardRenamed':
                updateBoardTitle(message.newName);
                break;
        }
    });

    function updateBoardDisplay(boardData) {
        // Update the entire board with new data
        console.log('Updating board display:', boardData);
    }

    function addCardToBoard(card, column) {
        const columnElement = document.querySelector(`[data-column="${column}"] .cards-container`);
        if (columnElement) {
            const cardElement = createCardElement(card);
            columnElement.appendChild(cardElement);
            
            // Re-initialize drag and drop for new card
            initializeDragAndDrop();
        }
    }

    function removeCardFromBoard(cardId) {
        const cardElement = document.getElementById(cardId);
        if (cardElement) {
            cardElement.remove();
        }
    }

    function updateBoardTitle(newName) {
        const titleElement = document.querySelector('.board-title');
        if (titleElement) {
            titleElement.textContent = newName;
        }
    }

    function createCardElement(card) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.id = card.id;
        cardDiv.draggable = true;
        cardDiv.setAttribute('data-card-id', card.id);
        
        cardDiv.innerHTML = `
            <div class="card-actions">
                <button class="delete-card-btn" data-card-id="${card.id}">&times;</button>
            </div>
            <div class="card-title">${card.title}</div>
            <div class="card-description">Click to add description</div>
        `;
        
        return cardDiv;
    }
})();
