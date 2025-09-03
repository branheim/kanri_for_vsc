import * as vscode from 'vscode';

export class ConfigurationManager {
    get<T>(key: string, defaultValue: T): T {
        const config = vscode.workspace.getConfiguration('kanri');
        return config.get(key, defaultValue);
    }

    async set(key: string, value: any): Promise<void> {
        const config = vscode.workspace.getConfiguration('kanri');
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }

    reloadConfiguration(): void {
        // Simple implementation
    }
}
