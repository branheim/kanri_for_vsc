"use strict";
/**
 * Simple Logger for Kanri Extension
 *
 * Provides basic logging functionality with VS Code output channel integration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const vscode = require("vscode");
class Logger {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Kanri');
    }
    /**
     * Log an informational message
     */
    info(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] INFO: ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(`[Kanri] ${logMessage}`);
    }
    /**
     * Log a debug message
     */
    debug(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] DEBUG: ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(`[Kanri] ${logMessage}`);
    }
    /**
     * Log a warning message
     */
    warn(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] WARN: ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.warn(`[Kanri] ${logMessage}`);
    }
    /**
     * Log an error message
     */
    error(message, error) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ERROR: ${message}`;
        this.outputChannel.appendLine(logMessage);
        if (error) {
            this.outputChannel.appendLine(`Details: ${error}`);
        }
        console.error(`[Kanri] ${logMessage}`, error);
    }
    /**
     * Show the output channel
     */
    show() {
        this.outputChannel.show();
    }
    /**
     * Dispose of the logger
     */
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map