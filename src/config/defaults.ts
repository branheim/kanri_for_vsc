/**
 * Default configuration values for the Kanri for VS Code extension
 * 
 * This module centralizes all default settings to ensure consistency
 * across the extension and make it easy to modify defaults when needed.
 * Each configuration option is documented with its purpose and impact.
 */

/**
 * Interface defining the structure of a kanban board
 * Used throughout the extension for type safety and IntelliSense
 */
export interface KanbanBoard {
    /** Unique identifier for the board */
    id: string;
    /** Display name of the board */
    name: string;
    /** Brief description of the board's purpose */
    description?: string;
    /** Array of columns in the board (ordered left to right) */
    columns: KanbanColumn[];
    /** Timestamp when the board was created */
    createdAt: Date;
    /** Timestamp when the board was last modified */
    lastModified: Date;
    /** Path to the board file relative to workspace root */
    filePath: string;
}

/**
 * Interface defining the structure of a kanban column
 * Columns represent different stages of work (e.g., "To Do", "Done")
 */
export interface KanbanColumn {
    /** Unique identifier for the column within the board */
    id: string;
    /** Display name of the column */
    title: string;
    /** Array of cards in this column (ordered top to bottom) */
    cards: KanbanCard[];
    /** Maximum number of cards allowed in this column (for WIP limits) */
    maxCards?: number;
    /** Color theme for the column header */
    color?: string;
}

/**
 * Interface defining the structure of a kanban card
 * Cards represent individual tasks or work items
 */
export interface KanbanCard {
    /** Unique identifier for the card */
    id: string;
    /** Title/summary of the task */
    title: string;
    /** Detailed description of the task */
    description?: string;
    /** Priority level of the card */
    priority: CardPriority;
    /** Tags for categorization and filtering */
    tags: string[];
    /** Assigned team member or owner */
    assignee?: string;
    /** Due date for the task */
    dueDate?: Date;
    /** Timestamp when the card was created */
    createdAt: Date;
    /** Timestamp when the card was last modified */
    lastModified: Date;
    /** Color for visual categorization */
    color?: string;
    /** Estimated effort or story points */
    estimatedEffort?: number;
    /** Actual time spent on the task */
    actualEffort?: number;
}

/**
 * Enumeration of card priority levels
 * Used for visual indicators and sorting
 */
export enum CardPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    URGENT = 'urgent'
}

/**
 * Interface for extension configuration settings
 * Maps to the configuration properties defined in package.json
 */
export interface KanriConfiguration {
    /** Default columns to create for new boards */
    defaultColumns: string[];
    /** Whether to automatically save changes */
    autoSave: boolean;
    /** Directory name for storing board files */
    boardsDirectory: string;
    /** Whether detailed logging is enabled */
    enableLogging: boolean;
    /** Logging level for the extension */
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    /** Available colors for card categorization */
    cardColors: string[];
}

/**
 * Default configuration values for the extension
 * These values are used when user settings are not available
 * or when initializing new boards
 */
export const DEFAULT_CONFIG: KanriConfiguration = {
    /**
     * Standard kanban columns that work for most development workflows
     * Can be customized by users in VS Code settings
     */
    defaultColumns: [
        'Backlog',      // Items waiting to be started
        'To Do',        // Items ready to be worked on
        'In Progress',  // Items currently being worked on
        'Review',       // Items pending review/testing
        'Done'          // Completed items
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
        '#ffffff',  // White - default
        '#ffeb3b',  // Yellow - attention needed
        '#4caf50',  // Green - ready/approved
        '#2196f3',  // Blue - in progress
        '#ff9800',  // Orange - blocked/warning
        '#f44336'   // Red - urgent/error
    ]
};

/**
 * Default board template for new boards
 * Provides a starting point with standard columns
 */
export const DEFAULT_BOARD_TEMPLATE: Omit<KanbanBoard, 'id' | 'createdAt' | 'lastModified' | 'filePath'> = {
    name: 'New Board',
    description: 'A kanban board for organizing tasks and workflow',
    columns: DEFAULT_CONFIG.defaultColumns.map((title, index) => ({
        id: `column-${index}`,
        title,
        cards: []
    }))
};

/**
 * Default card template for new cards
 * Provides sensible defaults for card creation
 */
export const DEFAULT_CARD_TEMPLATE: Omit<KanbanCard, 'id' | 'createdAt' | 'lastModified'> = {
    title: 'New Task',
    description: '',
    priority: CardPriority.MEDIUM,
    tags: [],
    assignee: undefined,
    dueDate: undefined,
    color: DEFAULT_CONFIG.cardColors[0], // White as default
    estimatedEffort: undefined,
    actualEffort: undefined
};

/**
 * Command identifiers used throughout the extension
 * These must match the command IDs defined in package.json
 */
export const COMMANDS = {
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
} as const;

/**
 * Configuration keys for VS Code settings
 * These must match exactly with the keys defined in package.json
 */
export const CONFIG_KEYS = {
    DEFAULT_COLUMNS: 'kanri.defaultColumns',
    AUTO_SAVE: 'kanri.autoSave',
    BOARDS_DIRECTORY: 'kanri.boardsDirectory',
    ENABLE_LOGGING: 'kanri.enableLogging',
    LOG_LEVEL: 'kanri.logLevel',
    CARD_COLORS: 'kanri.cardColors'
} as const;

/**
 * File extension used for kanban board files
 * JSON format for easy parsing and human readability
 */
export const BOARD_FILE_EXTENSION = '.kanri.json';

/**
 * Maximum number of boards allowed per workspace
 * Prevents performance issues with too many boards
 */
export const MAX_BOARDS_PER_WORKSPACE = 50;

/**
 * Maximum number of cards allowed per column
 * Helps enforce Work In Progress (WIP) limits
 */
export const DEFAULT_WIP_LIMIT = 10;

/**
 * Debounce delay for auto-save operations (in milliseconds)
 * Prevents excessive file writes during rapid changes
 */
export const AUTO_SAVE_DEBOUNCE_MS = 1000;

/**
 * Valid characters for board and card IDs
 * Used for generating unique identifiers
 */
export const ID_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Length of generated IDs
 * Balance between uniqueness and readability
 */
export const ID_LENGTH = 8;
