import * as vscode from 'vscode';
import { BoardManager } from '../managers/boardManager';

export class BoardsViewProvider implements vscode.TreeDataProvider<BoardItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BoardItem | undefined | null | void> = new vscode.EventEmitter<BoardItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BoardItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private boardManager: BoardManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BoardItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: BoardItem): Thenable<BoardItem[]> {
        if (!element) {
            // Root level - show all boards
            return this.getBoardItems();
        }
        return Promise.resolve([]);
    }

    private async getBoardItems(): Promise<BoardItem[]> {
        try {
            const boards = await this.boardManager.getAllBoards();
            return boards.map(board => new BoardItem(
                board.name,
                board.id,
                vscode.TreeItemCollapsibleState.None
            ));
        } catch (error) {
            console.error('Error getting boards:', error);
            return [];
        }
    }
}

export class BoardItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly boardId: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label} - Kanban Board`;
        this.description = 'Kanban Board';
        this.contextValue = 'board';
        this.command = {
            command: 'kanri.openBoard',
            title: 'Open Board',
            arguments: [this.boardId]
        };
    }

    iconPath = new vscode.ThemeIcon('project');
}
