import * as vscode from 'vscode';
import { BoardManager } from '../managers/boardManager';

export class BoardsViewProvider implements vscode.TreeDataProvider<BoardItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BoardItem | undefined | null | void> = new vscode.EventEmitter<BoardItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BoardItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private boardManager: BoardManager) {}

    refresh(): void {
        console.log('BoardsViewProvider: Refresh called');
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
            console.log('BoardsViewProvider: Getting boards...');
            const boards = await this.boardManager.getAllBoards();
            console.log(`BoardsViewProvider: Found ${boards.length} boards:`, boards.map(b => ({ id: b.id, name: b.name })));
            
            if (boards.length === 0) {
                console.log('BoardsViewProvider: No boards found, showing placeholder');
                return [new BoardItem('No boards found', '', vscode.TreeItemCollapsibleState.None)];
            }
            
            return boards.map(board => new BoardItem(
                board.name,
                board.id,
                vscode.TreeItemCollapsibleState.None
            ));
        } catch (error) {
            console.error('BoardsViewProvider: Error getting boards:', error);
            return [new BoardItem('Error loading boards', '', vscode.TreeItemCollapsibleState.None)];
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
