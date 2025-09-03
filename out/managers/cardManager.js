"use strict";
/**
 * Card Manager - Core class for kanban card operations
 *
 * This manager handles all card-related functionality including:
 * - Creating new cards within board columns
 * - Moving cards between columns
 * - Editing card properties and metadata
 * - Deleting cards and managing card lifecycle
 *
 * The CardManager works in conjunction with BoardManager to provide
 * complete kanban functionality within VS Code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardManager = void 0;
const vscode = require("vscode");
const defaults_1 = require("../config/defaults");
/**
 * CardManager class responsible for all kanban card operations
 * Provides a high-level API for card management while coordinating
 * with BoardManager for persistence and board state management
 */
class CardManager {
    /**
     * Initialize the CardManager
     *
     * @param boardManager - Board manager for accessing board state
     * @param configManager - Configuration manager for user settings
     * @param logger - Logger instance for debugging and monitoring
     */
    constructor(boardManager, configManager, logger) {
        this.boardManager = boardManager;
        this.configManager = configManager;
        this.logger = logger;
    }
    /**
     * Add a new card to a kanban board
     * Prompts user for card details and target location
     *
     * @param options - Optional card creation parameters
     * @returns The created card object
     */
    async addCard(options) {
        // Get target board and column
        const { board, columnId } = await this.getTargetBoardAndColumn(options?.boardId, options?.columnId);
        if (!board || !columnId) {
            throw new Error('Card creation cancelled - board and column are required');
        }
        // Get card details from user if not provided
        const cardTitle = options?.title || await this.promptForCardTitle();
        if (!cardTitle) {
            throw new Error('Card creation cancelled - title is required');
        }
        const cardDescription = options?.description || await this.promptForCardDescription();
        const cardPriority = options?.priority || await this.promptForCardPriority();
        const cardTags = options?.tags || await this.promptForCardTags();
        const cardAssignee = options?.assignee || await this.promptForCardAssignee();
        const cardDueDate = options?.dueDate || await this.promptForCardDueDate();
        // Generate unique ID for the card
        const cardId = this.generateId();
        // Create card object
        const newCard = {
            ...defaults_1.DEFAULT_CARD_TEMPLATE,
            id: cardId,
            title: cardTitle,
            description: cardDescription,
            priority: cardPriority,
            tags: cardTags,
            assignee: cardAssignee,
            dueDate: cardDueDate,
            createdAt: new Date(),
            lastModified: new Date()
        };
        // Find target column and add card
        const targetColumn = board.columns.find(col => col.id === columnId);
        if (!targetColumn) {
            throw new Error(`Column with ID "${columnId}" not found in board`);
        }
        targetColumn.cards.push(newCard);
        // Save updated board
        await this.boardManager.saveBoard(board);
        this.logger.info(`Created new card: ${cardTitle} in column ${targetColumn.title}`);
        // Show success message
        vscode.window.showInformationMessage(`Card "${cardTitle}" added to "${targetColumn.title}"`);
        return newCard;
    }
    /**
     * Delete a card from its board
     *
     * @param cardId - ID of the card to delete (optional, will prompt if not provided)
     */
    async deleteCard(cardId) {
        let targetCardId = cardId;
        // If no card ID provided, let user select from available cards
        if (!targetCardId) {
            const cardSelection = await this.promptForCardSelection();
            if (!cardSelection) {
                return; // User cancelled selection
            }
            targetCardId = cardSelection.cardId;
        }
        // Find the card and its location
        const cardLocation = await this.findCardLocation(targetCardId);
        if (!cardLocation) {
            throw new Error(`Card with ID "${targetCardId}" not found`);
        }
        const { board, column, card, cardIndex } = cardLocation;
        // Confirm deletion
        const confirmDelete = await vscode.window.showWarningMessage(`Are you sure you want to delete the card "${card.title}"?`, { modal: true }, 'Delete Card');
        if (confirmDelete !== 'Delete Card') {
            return; // User cancelled deletion
        }
        // Remove card from column
        column.cards.splice(cardIndex, 1);
        // Save updated board
        await this.boardManager.saveBoard(board);
        this.logger.info(`Deleted card: ${card.title} from column ${column.title}`);
        vscode.window.showInformationMessage(`Card "${card.title}" deleted successfully`);
    }
    /**
     * Move a card between columns or within the same column
     *
     * @param cardId - ID of the card to move (optional, will prompt if not provided)
     * @param targetColumnId - ID of the target column (optional, will prompt if not provided)
     */
    async moveCard(cardId, targetColumnId) {
        let targetCardId = cardId;
        let targetColId = targetColumnId;
        // If no card ID provided, let user select from available cards
        if (!targetCardId) {
            const cardSelection = await this.promptForCardSelection();
            if (!cardSelection) {
                return; // User cancelled selection
            }
            targetCardId = cardSelection.cardId;
        }
        // Find the card and its current location
        const cardLocation = await this.findCardLocation(targetCardId);
        if (!cardLocation) {
            throw new Error(`Card with ID "${targetCardId}" not found`);
        }
        const { board, column: sourceColumn, card, cardIndex } = cardLocation;
        // If no target column provided, let user select
        if (!targetColId) {
            targetColId = await this.promptForColumnSelection(board, sourceColumn.id);
            if (!targetColId) {
                return; // User cancelled selection
            }
        }
        // Find target column
        const targetColumn = board.columns.find(col => col.id === targetColId);
        if (!targetColumn) {
            throw new Error(`Target column with ID "${targetColId}" not found`);
        }
        // Check if moving to the same column
        if (sourceColumn.id === targetColId) {
            vscode.window.showInformationMessage(`Card "${card.title}" is already in column "${targetColumn.title}"`);
            return;
        }
        // Perform the move operation
        const moveOperation = {
            cardId: targetCardId,
            sourceColumnId: sourceColumn.id,
            targetColumnId: targetColId,
            boardId: board.id,
            targetIndex: targetColumn.cards.length // Add to end by default
        };
        await this.executeCardMove(moveOperation);
        this.logger.info(`Moved card: ${card.title} from ${sourceColumn.title} to ${targetColumn.title}`);
        vscode.window.showInformationMessage(`Card "${card.title}" moved to "${targetColumn.title}"`);
    }
    /**
     * Edit an existing card's properties
     *
     * @param cardId - ID of the card to edit
     */
    async editCard(cardId) {
        const cardLocation = await this.findCardLocation(cardId);
        if (!cardLocation) {
            throw new Error(`Card with ID "${cardId}" not found`);
        }
        const { board, card } = cardLocation;
        // Show edit options
        const editOption = await vscode.window.showQuickPick([
            { label: 'Edit Title', value: 'title' },
            { label: 'Edit Description', value: 'description' },
            { label: 'Change Priority', value: 'priority' },
            { label: 'Manage Tags', value: 'tags' },
            { label: 'Change Assignee', value: 'assignee' },
            { label: 'Set Due Date', value: 'dueDate' }
        ], {
            placeHolder: 'What would you like to edit?'
        });
        if (!editOption) {
            return; // User cancelled
        }
        let hasChanges = false;
        switch (editOption.value) {
            case 'title':
                const newTitle = await this.promptForCardTitle(card.title);
                if (newTitle && newTitle !== card.title) {
                    card.title = newTitle;
                    hasChanges = true;
                }
                break;
            case 'description':
                const newDescription = await this.promptForCardDescription(card.description);
                if (newDescription !== card.description) {
                    card.description = newDescription;
                    hasChanges = true;
                }
                break;
            case 'priority':
                const newPriority = await this.promptForCardPriority(card.priority);
                if (newPriority !== card.priority) {
                    card.priority = newPriority;
                    hasChanges = true;
                }
                break;
            case 'tags':
                const newTags = await this.promptForCardTags(card.tags);
                if (JSON.stringify(newTags) !== JSON.stringify(card.tags)) {
                    card.tags = newTags;
                    hasChanges = true;
                }
                break;
            case 'assignee':
                const newAssignee = await this.promptForCardAssignee(card.assignee);
                if (newAssignee !== card.assignee) {
                    card.assignee = newAssignee;
                    hasChanges = true;
                }
                break;
            case 'dueDate':
                const newDueDate = await this.promptForCardDueDate(card.dueDate);
                if (newDueDate?.getTime() !== card.dueDate?.getTime()) {
                    card.dueDate = newDueDate;
                    hasChanges = true;
                }
                break;
        }
        if (hasChanges) {
            card.lastModified = new Date();
            await this.boardManager.saveBoard(board);
            vscode.window.showInformationMessage(`Card "${card.title}" updated successfully`);
        }
    }
    /**
     * Dispose of resources and cleanup
     * Called during extension deactivation
     */
    dispose() {
        this.logger.debug('CardManager disposed');
    }
    /**
     * Execute a card move operation
     * @param operation - Move operation details
     */
    async executeCardMove(operation) {
        const board = await this.boardManager.getBoard(operation.boardId);
        if (!board) {
            throw new Error(`Board with ID "${operation.boardId}" not found`);
        }
        const sourceColumn = board.columns.find(col => col.id === operation.sourceColumnId);
        const targetColumn = board.columns.find(col => col.id === operation.targetColumnId);
        if (!sourceColumn || !targetColumn) {
            throw new Error('Source or target column not found');
        }
        const cardIndex = sourceColumn.cards.findIndex(card => card.id === operation.cardId);
        if (cardIndex === -1) {
            throw new Error('Card not found in source column');
        }
        // Remove card from source column
        const [card] = sourceColumn.cards.splice(cardIndex, 1);
        // Update card timestamp
        card.lastModified = new Date();
        // Add card to target column at specified index
        const targetIndex = operation.targetIndex ?? targetColumn.cards.length;
        targetColumn.cards.splice(targetIndex, 0, card);
        // Save updated board
        await this.boardManager.saveBoard(board);
    }
    /**
     * Find the location of a card within all boards
     * @param cardId - ID of the card to find
     * @returns Card location details or undefined if not found
     */
    async findCardLocation(cardId) {
        const boards = await this.boardManager.getAllBoards();
        for (const board of boards) {
            for (const column of board.columns) {
                const cardIndex = column.cards.findIndex((card) => card.id === cardId);
                if (cardIndex !== -1) {
                    return {
                        board,
                        column,
                        card: column.cards[cardIndex],
                        cardIndex
                    };
                }
            }
        }
        return undefined;
    }
    /**
     * Get target board and column for card operations
     */
    async getTargetBoardAndColumn(boardId, columnId) {
        let targetBoard;
        let targetColumnId = columnId;
        if (boardId) {
            targetBoard = await this.boardManager.getBoard(boardId);
        }
        else {
            // Prompt user to select board
            const boardSelection = await this.promptForBoardSelection();
            if (boardSelection) {
                targetBoard = await this.boardManager.getBoard(boardSelection);
            }
        }
        if (targetBoard && !targetColumnId) {
            // Prompt user to select column
            targetColumnId = await this.promptForColumnSelection(targetBoard);
        }
        return { board: targetBoard, columnId: targetColumnId };
    }
    /**
     * Generate a unique identifier
     */
    generateId() {
        return Array.from({ length: defaults_1.ID_LENGTH }, () => defaults_1.ID_CHARACTERS[Math.floor(Math.random() * defaults_1.ID_CHARACTERS.length)]).join('');
    }
    // Prompt methods for user input
    async promptForCardTitle(defaultValue) {
        return await vscode.window.showInputBox({
            prompt: 'Enter the card title',
            value: defaultValue,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Title cannot be empty';
                }
                return null;
            }
        });
    }
    async promptForCardDescription(defaultValue) {
        const description = await vscode.window.showInputBox({
            prompt: 'Enter the card description (optional)',
            value: defaultValue || '',
            placeHolder: 'Detailed description of the task...'
        });
        return description || '';
    }
    async promptForCardPriority(defaultValue) {
        const priorityOptions = [
            { label: 'Low Priority', value: defaults_1.CardPriority.LOW },
            { label: 'Medium Priority', value: defaults_1.CardPriority.MEDIUM },
            { label: 'High Priority', value: defaults_1.CardPriority.HIGH },
            { label: 'Urgent', value: defaults_1.CardPriority.URGENT }
        ];
        const selected = await vscode.window.showQuickPick(priorityOptions, {
            placeHolder: 'Select card priority'
        });
        return selected?.value || defaultValue || defaults_1.CardPriority.MEDIUM;
    }
    async promptForCardTags(defaultValue) {
        const tagsInput = await vscode.window.showInputBox({
            prompt: 'Enter tags separated by commas (optional)',
            value: defaultValue?.join(', ') || '',
            placeHolder: 'frontend, bug, urgent'
        });
        if (!tagsInput) {
            return defaultValue || [];
        }
        return tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }
    async promptForCardAssignee(defaultValue) {
        return await vscode.window.showInputBox({
            prompt: 'Enter assignee name (optional)',
            value: defaultValue,
            placeHolder: 'John Doe'
        });
    }
    async promptForCardDueDate(defaultValue) {
        const dateInput = await vscode.window.showInputBox({
            prompt: 'Enter due date in YYYY-MM-DD format (optional)',
            value: defaultValue?.toISOString().split('T')[0] || '',
            placeHolder: '2024-12-31',
            validateInput: (value) => {
                if (!value)
                    return null;
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    return 'Please enter a valid date in YYYY-MM-DD format';
                }
                return null;
            }
        });
        return dateInput ? new Date(dateInput) : defaultValue;
    }
    async promptForBoardSelection() {
        const boards = await this.boardManager.getAllBoards();
        if (boards.length === 0) {
            vscode.window.showInformationMessage('No boards found. Create a board first.');
            return undefined;
        }
        const quickPickItems = boards.map(board => ({
            label: board.name,
            description: board.description,
            boardId: board.id
        }));
        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a board'
        });
        return selected?.boardId;
    }
    async promptForColumnSelection(board, excludeColumnId) {
        const availableColumns = board.columns.filter(col => col.id !== excludeColumnId);
        if (availableColumns.length === 0) {
            vscode.window.showInformationMessage('No available columns found.');
            return undefined;
        }
        const quickPickItems = availableColumns.map(column => ({
            label: column.title,
            description: `${column.cards.length} cards`,
            columnId: column.id
        }));
        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a column'
        });
        return selected?.columnId;
    }
    async promptForCardSelection() {
        const boards = await this.boardManager.getAllBoards();
        const allCards = [];
        // Collect all cards from all boards
        for (const board of boards) {
            for (const column of board.columns) {
                for (const card of column.cards) {
                    allCards.push({ card, board, column });
                }
            }
        }
        if (allCards.length === 0) {
            vscode.window.showInformationMessage('No cards found.');
            return undefined;
        }
        const quickPickItems = allCards.map(({ card, board, column }) => ({
            label: card.title,
            description: `${board.name} → ${column.title}`,
            detail: card.description || 'No description',
            cardId: card.id,
            boardId: board.id
        }));
        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a card',
            matchOnDescription: true,
            matchOnDetail: true
        });
        return selected ? { cardId: selected.cardId, boardId: selected.boardId } : undefined;
    }
}
exports.CardManager = CardManager;
//# sourceMappingURL=cardManager.js.map