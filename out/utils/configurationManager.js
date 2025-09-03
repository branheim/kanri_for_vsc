"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManager = void 0;
const vscode = require("vscode");
class ConfigurationManager {
    get(key, defaultValue) {
        const config = vscode.workspace.getConfiguration('kanri');
        return config.get(key, defaultValue);
    }
    async set(key, value) {
        const config = vscode.workspace.getConfiguration('kanri');
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }
    reloadConfiguration() {
        // Simple implementation
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=configurationManager.js.map