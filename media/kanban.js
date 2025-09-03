// Kanban Board JavaScript - External Script with Microsoft Pattern
// This follows VS Code webview best practices for security and functionality

(function() {
    const vscode = acquireVsCodeApi();
    
    // Initialize immediately and also on DOM load to catch both scenarios
    initializeKanbanBoard();
    
    // Also initialize when DOM loads (backup)
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM loaded - reinitializing kanban board');
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
        const renameButton = document.querySelector('.rename-button');
        if (renameButton) {
            renameButton.addEventListener('click', function() {
                const boardTitle = document.querySelector('h1.board-title');
                const currentName = boardTitle ? boardTitle.textContent : 'Untitled Board';
                console.log('Rename button clicked - current name:', currentName);
                
                vscode.postMessage({
                    command: 'renameBoard',
                    currentName: currentName
                });
            });
        }

        // Add column button
        const addColumnButton = document.getElementById('add-column-btn');
        if (addColumnButton) {
            addColumnButton.addEventListener('click', function() {
                console.log('Add column clicked');
                
                vscode.postMessage({
                    command: 'addColumn'
                });
            });
        }

        // Delete column buttons
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-column-btn')) {
                const columnId = e.target.getAttribute('data-column');
                console.log('Delete column clicked for column:', columnId);
                
                vscode.postMessage({
                    command: 'deleteColumn',
                    columnId: columnId
                });
            }
        });
    }

    function initializeDragAndDrop() {
        // Initialize card drag and drop
        initializeCardDragAndDrop();
        
        // Initialize column drag and drop
        initializeColumnDragAndDrop();
    }

    function initializeCardDragAndDrop() {
        // Select ALL cards (existing and new) with correct class name
        const cards = document.querySelectorAll('.card');
        // Select ALL columns with correct class name  
        const columns = document.querySelectorAll('.cards-container');

        // Make cards draggable
        cards.forEach(card => {
            card.draggable = true;
            
            // Remove existing listeners to avoid duplicates
            card.removeEventListener('dragstart', handleCardDragStart);
            card.removeEventListener('dragend', handleCardDragEnd);
            
            // Add fresh listeners
            card.addEventListener('dragstart', handleCardDragStart);
            card.addEventListener('dragend', handleCardDragEnd);
        });

        // Make columns drop targets for cards
        columns.forEach(column => {
            // Remove existing listeners to avoid duplicates
            column.removeEventListener('dragover', handleCardDragOver);
            column.removeEventListener('dragleave', handleCardDragLeave);
            column.removeEventListener('drop', handleCardDrop);
            
            // Add fresh listeners
            column.addEventListener('dragover', handleCardDragOver);
            column.addEventListener('dragleave', handleCardDragLeave);
            column.addEventListener('drop', handleCardDrop);
        });
    }

    function initializeColumnDragAndDrop() {
        // Select all columns except the add column button
        const columns = document.querySelectorAll('.column[data-column]');
        const kanbanBoard = document.getElementById('kanban-board');

        // Make columns draggable
        columns.forEach(column => {
            column.draggable = true;
            
            // Remove existing listeners to avoid duplicates
            column.removeEventListener('dragstart', handleColumnDragStart);
            column.removeEventListener('dragend', handleColumnDragEnd);
            column.removeEventListener('dragover', handleColumnDragOver);
            column.removeEventListener('dragleave', handleColumnDragLeave);
            column.removeEventListener('drop', handleColumnDrop);
            
            // Add fresh listeners
            column.addEventListener('dragstart', handleColumnDragStart);
            column.addEventListener('dragend', handleColumnDragEnd);
            column.addEventListener('dragover', handleColumnDragOver);
            column.addEventListener('dragleave', handleColumnDragLeave);
            column.addEventListener('drop', handleColumnDrop);
        });
    }

    // Card drag event handlers
    function handleCardDragStart(e) {
        // Stop propagation to prevent column drag
        e.stopPropagation();
        
        // Ensure card has an ID for drag operations
        if (!this.id) {
            this.id = this.getAttribute('data-card-id') || `temp-${Date.now()}`;
        }
        
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'card',
            id: this.id
        }));
        this.classList.add('dragging');
        console.log('Card drag started for card:', this.id);
    }

    function handleCardDragEnd() {
        this.classList.remove('dragging');
        console.log('Card drag ended for card:', this.id);
    }

    function handleCardDragOver(e) {
        // Only allow card drops on cards containers
        const dragData = e.dataTransfer.types.includes('text/plain');
        if (dragData) {
            e.preventDefault();
            this.classList.add('drag-over');
        }
    }

    function handleCardDragLeave() {
        this.classList.remove('drag-over');
    }

    function handleCardDrop(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        try {
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            
            // Only handle card drops
            if (dragData.type === 'card') {
                const cardId = dragData.id;
                const targetColumn = this.getAttribute('data-column');
                
                console.log('Card dropped:', cardId, 'to column:', targetColumn);
                
                if (cardId && targetColumn) {
                    // Move the card in the UI immediately
                    const cardElement = document.getElementById(cardId);
                    if (cardElement && cardElement.parentElement !== this) {
                        this.appendChild(cardElement);
                        updateCardCounts();
                        
                        // Notify extension
                        vscode.postMessage({
                            command: 'moveCard',
                            cardId: cardId,
                            targetColumn: targetColumn
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error handling card drop:', error);
        }
    }

    // Column drag event handlers
    function handleColumnDragStart(e) {
        // Prevent column drag if initiated from cards, buttons, or other interactive elements
        if (e.target.classList.contains('card') || 
            e.target.classList.contains('add-card-btn') ||
            e.target.classList.contains('delete-card-btn') ||
            e.target.classList.contains('delete-column-btn') ||
            e.target.closest('.card') ||
            e.target.closest('.add-card-btn')) {
            e.preventDefault();
            return false;
        }
        
        const columnId = this.getAttribute('data-column');
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'column',
            id: columnId
        }));
        this.classList.add('dragging');
        
        // Add visual feedback to the board
        const kanbanBoard = document.getElementById('kanban-board');
        if (kanbanBoard) {
            kanbanBoard.classList.add('dragging-column');
        }
        
        console.log('Column drag started for column:', columnId);
    }

    function handleColumnDragEnd() {
        this.classList.remove('dragging');
        
        // Remove visual feedback from the board
        const kanbanBoard = document.getElementById('kanban-board');
        if (kanbanBoard) {
            kanbanBoard.classList.remove('dragging-column');
        }
        
        // Remove drag-over class from all columns
        document.querySelectorAll('.column').forEach(col => {
            col.classList.remove('drag-over');
        });
        console.log('Column drag ended');
    }

    function handleColumnDragOver(e) {
        // Only allow column drops on columns
        const dragData = e.dataTransfer.types.includes('text/plain');
        if (dragData) {
            e.preventDefault();
            this.classList.add('drag-over');
        }
    }

    function handleColumnDragLeave() {
        this.classList.remove('drag-over');
    }

    function handleColumnDrop(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        try {
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            
            // Only handle column drops
            if (dragData.type === 'column') {
                const draggedColumnId = dragData.id;
                const targetColumnId = this.getAttribute('data-column');
                
                console.log('Column dropped:', draggedColumnId, 'before column:', targetColumnId);
                
                if (draggedColumnId && targetColumnId && draggedColumnId !== targetColumnId) {
                    // Find the dragged column element
                    const draggedColumn = document.querySelector(`[data-column="${draggedColumnId}"]`);
                    const kanbanBoard = document.getElementById('kanban-board');
                    
                    if (draggedColumn && kanbanBoard) {
                        // Insert the dragged column before the target column
                        kanbanBoard.insertBefore(draggedColumn, this);
                        
                        // Notify extension about the reorder
                        vscode.postMessage({
                            command: 'reorderColumn',
                            draggedColumnId: draggedColumnId,
                            targetColumnId: targetColumnId
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error handling column drop:', error);
        }
    }

    // Update card counts in column headers
    function updateCardCounts() {
        document.querySelectorAll('.column').forEach(column => {
            const cardsContainer = column.querySelector('.cards-container');
            const cardCount = cardsContainer.children.length;
            const countElement = column.querySelector('.card-count');
            if (countElement) {
                countElement.textContent = cardCount;
            }
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
            case 'cardMoved':
                handleCardMoved(message.cardId, message.targetColumn, message.success);
                break;
            case 'cardMoveError':
                handleCardMoveError(message.cardId, message.error);
                break;
            case 'cardUpdated':
                updateCardInBoard(message.card);
                break;
            case 'boardRenamed':
                updateBoardTitle(message.newName);
                break;
            case 'boardRefreshed':
                refreshBoardDisplay(message.board);
                break;
            case 'columnAdded':
                addColumnToBoard(message.columnId, message.columnName);
                break;
            case 'columnDeleted':
                removeColumnFromBoard(message.columnId);
                break;
            case 'columnRenamed':
                updateColumnTitle(message.columnId, message.newTitle);
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
            
            // Re-initialize drag and drop for ALL cards (including new one)
            initializeDragAndDrop();
            
            // Update card counts
            updateCardCounts();
            
            console.log('Card added to UI:', card.id, 'in column:', column);
        }
    }

    function removeCardFromBoard(cardId) {
        const cardElement = document.getElementById(cardId);
        if (cardElement) {
            cardElement.remove();
            updateCardCounts();
            console.log('Card removed from UI:', cardId);
        }
    }

    function updateBoardTitle(newName) {
        const titleElement = document.querySelector('h1.board-title');
        if (titleElement) {
            titleElement.textContent = newName;
            console.log('Board title updated to:', newName);
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

    function addColumnToBoard(columnId, columnName) {
        const kanbanBoard = document.getElementById('kanban-board');
        const addColumnButton = document.getElementById('add-column-btn');
        
        if (kanbanBoard && addColumnButton) {
            // Create the new column element
            const columnDiv = document.createElement('div');
            columnDiv.className = 'column';
            columnDiv.setAttribute('data-column', columnId);
            columnDiv.draggable = true;
            
            columnDiv.innerHTML = `
                <div class="column-header">
                    <span class="column-title">${columnName}</span>
                    <div class="column-actions">
                        <span class="card-count">0</span>
                        <button class="delete-column-btn" data-column="${columnId}" title="Delete column">&times;</button>
                    </div>
                </div>
                <div class="cards-container" id="${columnId}-cards" data-column="${columnId}">
                </div>
                <div class="add-card-btn" data-column="${columnId}">+ Add a card</div>
            `;
            
            // Insert the new column before the add column button
            kanbanBoard.insertBefore(columnDiv, addColumnButton);
            
            // Re-initialize event listeners and drag-drop for the new column
            initializeKanbanBoard();
            
            console.log('Column added to UI:', columnId, 'with name:', columnName);
        }
    }

    function removeColumnFromBoard(columnId) {
        const columnElement = document.querySelector(`[data-column="${columnId}"]`);
        if (columnElement) {
            columnElement.remove();
            console.log('Column removed from UI:', columnId);
        }
    }

    // New handler functions for better persistence feedback
    
    function handleCardMoved(cardId, targetColumn, success) {
        if (success) {
            console.log('Card move confirmed by server:', cardId, 'to', targetColumn);
            // Card should already be in the right place from drag-and-drop
            // Just confirm the operation was saved
        } else {
            console.error('Card move failed on server, should revert');
            // Could implement revert logic here if needed
        }
    }

    function handleCardMoveError(cardId, error) {
        console.error('Card move error:', cardId, error);
        // Show user feedback about the error
        // Could revert the UI change here
    }

    function updateCardInBoard(card) {
        const cardElement = document.getElementById(card.id);
        if (cardElement) {
            // Update card content
            const titleElement = cardElement.querySelector('.card-title');
            const descElement = cardElement.querySelector('.card-description');
            
            if (titleElement) titleElement.textContent = card.title;
            if (descElement) descElement.textContent = card.description || '';
            
            console.log('Card updated in UI:', card.id);
        }
    }

    function updateColumnTitle(columnId, newTitle) {
        const columnElement = document.querySelector(`[data-column="${columnId}"] .column-title`);
        if (columnElement) {
            columnElement.textContent = newTitle;
            console.log('Column title updated:', columnId, 'to', newTitle);
        }
    }

    function refreshBoardDisplay(board) {
        console.log('Refreshing board display with latest data:', board);
        
        // Update board title
        const titleElement = document.querySelector('h1.board-title');
        if (titleElement && board.name) {
            titleElement.textContent = board.name;
        }

        // Refresh all columns and cards
        board.columns.forEach(column => {
            const columnElement = document.querySelector(`[data-column="${column.id}"]`);
            if (columnElement) {
                // Update column title
                const columnTitle = columnElement.querySelector('.column-title');
                if (columnTitle) {
                    columnTitle.textContent = column.title;
                }

                // Clear and rebuild cards container
                const cardsContainer = columnElement.querySelector('.cards-container');
                if (cardsContainer) {
                    cardsContainer.innerHTML = '';
                    
                    // Add all cards from storage
                    column.cards.forEach(card => {
                        const cardElement = createCardElement(card);
                        cardsContainer.appendChild(cardElement);
                    });
                }
            }
        });

        // Re-initialize drag and drop and event listeners
        initializeDragAndDrop();
        updateCardCounts();
        
        console.log('Board display refreshed successfully');
    }

    // Request board refresh on load to ensure sync with storage
    function requestBoardRefresh() {
        vscode.postMessage({
            command: 'refreshBoard'
        });
    }

    // Request refresh when the webview becomes visible again
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            console.log('Webview became visible, requesting board refresh');
            requestBoardRefresh();
        }
    });
})();
