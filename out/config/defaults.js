"use strict";
/**
 * Default configuration values for the Kanri for VS Code extension
 *
 * This module centralizes all default settings to ensure consistency
 * across the extension and make it easy to modify defaults when needed.
 * Each configuration option is documented with its purpose and impact.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ID_LENGTH = exports.ID_CHARACTERS = exports.AUTO_SAVE_DEBOUNCE_MS = exports.DEFAULT_WIP_LIMIT = exports.MAX_BOARDS_PER_WORKSPACE = exports.BOARD_FILE_EXTENSION = exports.CONFIG_KEYS = exports.COMMANDS = exports.DEFAULT_CARD_TEMPLATE = exports.DEFAULT_BOARD_TEMPLATE = exports.DEFAULT_CONFIG = exports.CardPriority = void 0;
/**
 * Enumeration of card priority levels
 * Used for visual indicators and sorting
 */
var CardPriority;
(function (CardPriority) {
    CardPriority["LOW"] = "low";
    CardPriority["MEDIUM"] = "medium";
    CardPriority["HIGH"] = "high";
    CardPriority["URGENT"] = "urgent";
})(CardPriority = exports.CardPriority || (exports.CardPriority = {}));
/**
 * Default configuration values for the extension
 * These values are used when user settings are not available
 * or when initializing new boards
 */
exports.DEFAULT_CONFIG = {
    /**
     * Standard kanban columns that work for most development workflows
     * Can be customized by users in VS Code settings
     */
    defaultColumns: [
        'Backlog',
        'To Do',
        'In Progress',
        'Review',
        'Done' // Completed items
    ],
    /**
     * Auto-save enabled by default to prevent data loss
     * Users can disable this if they prefer manual saving
     */
    autoSave: true,
    /**
     * Hidden directory to store board files
     * Keeps the workspace clean while maintaining persistence
     */
    boardsDirectory: '.kanri',
    /**
     * Logging disabled by default for production use
     * Can be enabled for debugging and development
     */
    enableLogging: false,
    /**
     * Info level provides good balance of detail without spam
     * Can be adjusted for more or less verbose logging
     */
    logLevel: 'info',
    /**
     * Material Design inspired color palette
     * Provides good contrast and accessibility
     */
    cardColors: [
        '#ffffff',
        '#ffeb3b',
        '#4caf50',
        '#2196f3',
        '#ff9800',
        '#f44336' // Red - urgent/error
    ]
};
/**
 * Default board template for new boards
 * Provides a starting point with standard columns
 */
exports.DEFAULT_BOARD_TEMPLATE = {
    name: 'New Board',
    description: 'A kanban board for organizing tasks and workflow',
    columns: exports.DEFAULT_CONFIG.defaultColumns.map((title, index) => ({
        id: `column-${index}`,
        title,
        cards: []
    }))
};
/**
 * Default card template for new cards
 * Provides sensible defaults for card creation
 */
exports.DEFAULT_CARD_TEMPLATE = {
    title: 'New Task',
    description: '',
    priority: CardPriority.MEDIUM,
    tags: [],
    assignee: undefined,
    dueDate: undefined,
    color: exports.DEFAULT_CONFIG.cardColors[0],
    estimatedEffort: undefined,
    actualEffort: undefined
};
/**
 * Command identifiers used throughout the extension
 * These must match the command IDs defined in package.json
 */
exports.COMMANDS = {
    /** Open an existing kanban board */
    OPEN_BOARD: 'kanri.openBoard',
    /** Create a new kanban board */
    CREATE_BOARD: 'kanri.createBoard',
    /** Add a new card to a board */
    ADD_CARD: 'kanri.addCard',
    /** View all available boards */
    VIEW_BOARDS: 'kanri.viewBoards',
    /** Delete a card from a board */
    DELETE_CARD: 'kanri.deleteCard',
    /** Move a card between columns */
    MOVE_CARD: 'kanri.moveCard'
};
/**
 * Configuration keys for VS Code settings
 * These must match exactly with the keys defined in package.json
 */
exports.CONFIG_KEYS = {
    DEFAULT_COLUMNS: 'kanri.defaultColumns',
    AUTO_SAVE: 'kanri.autoSave',
    BOARDS_DIRECTORY: 'kanri.boardsDirectory',
    ENABLE_LOGGING: 'kanri.enableLogging',
    LOG_LEVEL: 'kanri.logLevel',
    CARD_COLORS: 'kanri.cardColors'
};
/**
 * File extension used for kanban board files
 * JSON format for easy parsing and human readability
 */
exports.BOARD_FILE_EXTENSION = '.kanri.json';
/**
 * Maximum number of boards allowed per workspace
 * Prevents performance issues with too many boards
 */
exports.MAX_BOARDS_PER_WORKSPACE = 50;
/**
 * Maximum number of cards allowed per column
 * Helps enforce Work In Progress (WIP) limits
 */
exports.DEFAULT_WIP_LIMIT = 10;
/**
 * Debounce delay for auto-save operations (in milliseconds)
 * Prevents excessive file writes during rapid changes
 */
exports.AUTO_SAVE_DEBOUNCE_MS = 1000;
/**
 * Valid characters for board and card IDs
 * Used for generating unique identifiers
 */
exports.ID_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';
/**
 * Length of generated IDs
 * Balance between uniqueness and readability
 */
exports.ID_LENGTH = 8;
//# sourceMappingURL=defaults.js.map