/**
 * Simple Logger for Kanri Extension
 * 
 * Provides basic logging functionality with VS Code output channel integration.
 */

import * as vscode from 'vscode';

export class Logger {
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Kanri');
    }

    /**
     * Log an informational message
     */
    info(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] INFO: ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(`[Kanri] ${logMessage}`);
    }

    /**
     * Log a debug message
     */
    debug(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] DEBUG: ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.log(`[Kanri] ${logMessage}`);
    }

    /**
     * Log a warning message
     */
    warn(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] WARN: ${message}`;
        this.outputChannel.appendLine(logMessage);
        console.warn(`[Kanri] ${logMessage}`);
    }

    /**
     * Log an error message
     */
    error(message: string, error?: any): void {
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
    show(): void {
        this.outputChannel.show();
    }

    /**
     * Dispose of the logger
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}
