# Change Log

All notable changes to the "kanri-for-vscode" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2025-09-03

### Fixed

- **Critical persistence issue**: User customizations (cards, columns, board names) now properly save between VS Code reloads
- Enhanced storage integration ensuring all board operations persist to workspaceState
- Improved webview-extension synchronization for reliable data consistency

### Enhanced

- Added comprehensive async message handlers with proper error handling
- Implemented board refresh functionality for data synchronization
- Enhanced user feedback with success/failure indicators for all operations
- Improved robustness of card operations with input validation
- Added automatic board refresh when extension regains focus

### Technical

- Upgraded message handling system with async/await patterns
- Enhanced bidirectional communication between webview and extension
- Improved error handling with graceful degradation
- Added comprehensive logging for debugging persistence operations

## [0.1.0] - 2025-09-03

### Added

- Initial release of Kanri for VS Code
- Visual kanban board creation and management
- Card creation, editing, and deletion
- Drag and drop card movement between columns
- Column management (add, delete, reorder)
- Persistent storage using VS Code workspace state
- Microsoft-compliant webview security patterns
- Comprehensive TypeScript implementation
- Configurable default columns
- Auto-save functionality
- Command palette integration
- Extensive inline documentation

### Features
- **Board Management**: Create multiple kanban boards per workspace
- **Card Operations**: Full CRUD operations for cards
- **Column Customization**: Dynamic column creation and management
- **Persistence**: Automatic saving of board state
- **Security**: CSP-compliant webview implementation
- **Type Safety**: Comprehensive TypeScript coverage
- **Performance**: Optimized storage and communication patterns

### Technical Implementation
- WebView-based UI with external JavaScript
- Microsoft's recommended security patterns
- Command pattern for message routing
- Factory pattern for component creation
- Comprehensive error handling
- Performance monitoring capabilities

[Unreleased]: https://github.com/bheimbigner/kanri-for-vscode/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/bheimbigner/kanri-for-vscode/releases/tag/v0.1.0
