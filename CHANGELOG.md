# Change Log

All notable changes to the "kanri-for-vscode" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4] - 2025-09-03

### Fixed

- **Critical persistence issue**: Replaced workspaceState with file-based storage system
- **Data reliability**: Board data now persists reliably across VS Code sessions and installations
- **Project portability**: Kanban boards now travel with project files in .kanri directory

### Added

- **FileStorage class**: Comprehensive file-based storage using VS Code workspace.fs API
- **Cross-platform compatibility**: Uses VS Code's workspace API for consistent file operations
- **Version control friendly**: Board data stored as JSON files that can be committed to git
- **Automatic backup**: FileStorage creates backups before destructive operations
- **Storage README**: Automatically creates documentation in .kanri directory

### Changed

- **BoardManager integration**: Updated to use FileStorage instead of Node.js fs module
- **Storage architecture**: Moved from workspace state to project-specific file storage
- **Data persistence**: Board data now survives workspace changes and VS Code updates
- **Storage location**: Boards saved in workspace/.kanri/ directory for organization

### Technical Details

- Implements VS Code workspace.fs API for cross-platform file operations
- Creates .kanri directory in workspace root for organized board storage
- Stores boards as human-readable JSON files for transparency and debugging
- Provides automatic date object conversion for proper data hydration
- Includes comprehensive error handling with logger integration

## [0.1.3] - 2025-09-03

### Fixed

- **Repository links**: Updated all GitHub repository links to point to correct repository
- **Marketplace integration**: Extension page now shows proper source code and issues links
- **Developer experience**: Users can now properly report issues and contribute to the project

### Changed

- Repository URL: Updated from `bheimbigner/kanri-for-vscode` to `branheim/kanri_for_vsc`
- Issues URL: Now points to correct GitHub issues page
- Homepage URL: Updated to match actual repository location

## [0.1.2] - 2025-09-03

### Added

- **Sidebar integration**: Added proper activity bar icon and view for seamless VS Code integration
- **Boards view**: New sidebar panel showing all kanban boards with click-to-open functionality
- **Enhanced navigation**: Refresh boards command and improved board management UI

### Improved

- **Activity bar icon**: Redesigned icon following Microsoft's VS Code design guidelines
- **User experience**: Professional sidebar presence with board listing and management
- **Icon design**: Simplified, theme-adaptive SVG icon that scales properly at all sizes

### Technical

- Added TreeDataProvider for boards view in sidebar
- Implemented proper viewsContainers and views contribution points
- Created activity-bar-simple.svg following VS Code icon standards
- Enhanced command integration with sidebar functionality

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
