# Kanri for VS Code

A comprehensive VS Code extension that brings kanban board functionality directly into your development workflow. Manage tasks, track progress, and organize your work without leaving your editor.

## ✨ Features

- **Visual Kanban Boards**: Create and manage kanban boards with drag-and-drop functionality
- **Card Management**: Add, edit, move, and delete cards with rich metadata
- **Column Management**: Create, delete, and reorder columns to fit your workflow
- **Drag & Drop**: Intuitive drag-and-drop for both cards and columns
- **Persistent Storage**: Boards are saved in your workspace's `.kanri` directory
- **Auto-save**: Changes are automatically saved as you work
- **VS Code Integration**: Fully integrated with VS Code's theming and command palette

## 🎯 Inspiration

This extension was inspired by [Kanri](https://github.com/trobonox/kanri), an excellent standalone kanban application. While this VS Code extension is a completely independent implementation using TypeScript and the VS Code Extension API, we credit the original Kanri project for the inspiration and design concepts that guided this development.

**Note**: This is not a port or fork of the original Kanri software. It's a fresh implementation built specifically for VS Code using Microsoft's webview patterns and extension APIs.

## 🏗️ Architecture Overview

This extension follows a modular architecture designed for maintainability and extensibility:

### Core Components

- **Extension Entry Point** (`extension.ts`) - Main activation and command registration
- **Board Manager** (`managers/boardManager.ts`) - Handles kanban board operations
- **Card Manager** (`managers/cardManager.ts`) - Manages kanban card operations
- **Configuration Manager** (`utils/configurationManager.ts`) - Type-safe settings management
- **Logger** (`utils/logger.ts`) - Comprehensive logging with multiple levels
- **Defaults** (`config/defaults.ts`) - Centralized configuration and type definitions

### Data Models

The extension uses strongly-typed interfaces for all kanban entities:

- `KanbanBoard` - Complete board structure with metadata
- `KanbanColumn` - Column definitions with card collections
- `KanbanCard` - Individual task cards with rich metadata
- `CardPriority` - Enumerated priority levels
- `KanriConfiguration` - Extension settings interface

## 🚀 Features

### Board Management
- Create new kanban boards with customizable columns
- Open and edit existing boards
- List all boards with quick selection
- Persistent storage in workspace `.kanri` directory
- Auto-save with configurable debouncing

### Card Operations
- Add cards to any column with rich metadata
- Move cards between columns
- Edit card properties (title, description, priority, tags, assignee, due date)
- Delete cards with confirmation
- Priority levels: Low, Medium, High, Urgent

### Configuration System
- User-configurable default columns
- Customizable auto-save behavior
- Adjustable logging levels
- Custom card color palettes
- Workspace-specific board storage location

### Developer Experience
- Comprehensive inline documentation
- Type-safe APIs throughout
- Structured logging with context
- Error handling with user-friendly messages
- Modular architecture for easy extension

## 📁 File Structure

```
src/
├── extension.ts                    # Main extension entry point
├── config/
│   └── defaults.ts                # Configuration defaults and types
├── managers/
│   ├── boardManager.ts            # Board operations and persistence
│   └── cardManager.ts             # Card operations and management
└── utils/
    ├── configurationManager.ts    # Settings management
    └── logger.ts                   # Logging utilities
```

## 🛠️ Getting Started

### Prerequisites
- VS Code 1.74.0 or higher
- Node.js 16.x or higher
- TypeScript knowledge for customization

### Building the Extension

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Compile TypeScript**
   ```bash
   npm run compile
   ```

3. **Watch Mode for Development**
   ```bash
   npm run watch
   ```

4. **Package Extension**
   ```bash
   npm run package
   ```

### Development Workflow

1. **Open in VS Code**: Open the project folder in VS Code
2. **Start Debugging**: Press F5 to launch Extension Development Host
3. **Test Commands**: Use Ctrl+Shift+P and search for "Kanri" commands
4. **View Logs**: Check the "Kanri for VS Code" output channel

## 📖 Usage Examples

### Creating a Board
```typescript
// Command: "Kanri: Create New Board"
// User is prompted for board name and description
// Board is created with default columns or user-configured columns
```

### Adding Cards
```typescript
// Command: "Kanri: Add Card to Board"
// User selects target board and column
// Card creation wizard collects title, description, priority, etc.
```

### Moving Cards
```typescript
// Command: "Kanri: Move Card"
// User selects card and target column
// Card is moved with timestamp updates
```

## ⚙️ Configuration

### Default Settings
```json
{
  "kanri.defaultColumns": [
    "Backlog",
    "To Do", 
    "In Progress",
    "Review",
    "Done"
  ],
  "kanri.autoSave": true,
  "kanri.boardsDirectory": ".kanri",
  "kanri.enableLogging": false,
  "kanri.logLevel": "info",
  "kanri.cardColors": [
    "#ffffff",
    "#ffeb3b", 
    "#4caf50",
    "#2196f3",
    "#ff9800",
    "#f44336"
  ]
}
```

### Customization Options

- **Default Columns**: Customize the initial columns for new boards
- **Auto-Save**: Enable/disable automatic saving of changes
- **Boards Directory**: Change where board files are stored
- **Logging**: Control debug output and verbosity
- **Card Colors**: Define available colors for card categorization

## 🔧 Extension Points

### Adding New Commands

1. **Register in package.json**:
   ```json
   {
     "command": "kanri.newCommand",
     "title": "New Command",
     "category": "Kanri"
   }
   ```

2. **Implement in extension.ts**:
   ```typescript
   const newCommand = vscode.commands.registerCommand(
     'kanri.newCommand',
     async () => {
       // Command implementation
     }
   );
   ```

3. **Add to command constants**:
   ```typescript
   export const COMMANDS = {
     // ... existing commands
     NEW_COMMAND: 'kanri.newCommand'
   } as const;
   ```

### Extending Data Models

Add new properties to interfaces in `defaults.ts`:

```typescript
export interface KanbanCard {
  // ... existing properties
  customField?: string;
  metadata?: Record<string, any>;
}
```

### Adding Configuration Options

1. **Define in package.json configuration**
2. **Add to KanriConfiguration interface**
3. **Update DEFAULT_CONFIG object**
4. **Add getter method to ConfigurationManager**

## 🧪 Testing

### Manual Testing Checklist

- [ ] Create new board with custom name
- [ ] Add cards to different columns
- [ ] Move cards between columns
- [ ] Edit card properties
- [ ] Delete cards with confirmation
- [ ] Test auto-save functionality
- [ ] Verify persistence across VS Code restarts
- [ ] Test configuration changes
- [ ] Check logging output at different levels

### Automated Testing

```bash
npm test
```

## 📝 Code Documentation Standards

This scaffold follows comprehensive documentation standards:

### Function Documentation
```typescript
/**
 * Brief description of what the function does
 * 
 * Longer description explaining the purpose, approach, and any
 * important implementation details that future developers need to know.
 * 
 * @param paramName - Description of what this parameter represents
 * @param optionalParam - Optional parameter description
 * @returns Description of what the function returns
 * @throws Description of when/why the function might throw errors
 */
```

### Interface Documentation
```typescript
/**
 * Interface description and purpose
 */
export interface ExampleInterface {
  /** Brief description of this property */
  property: string;
  /** Description including constraints or special behavior */
  optionalProperty?: number;
}
```

### Class Documentation
```typescript
/**
 * Class purpose and responsibility
 * 
 * Explain what this class manages, how it fits into the architecture,
 * and any important usage patterns or constraints.
 */
export class ExampleClass {
  /** Property documentation */
  private property: string;
}
```

## 🔄 Extension Lifecycle

### Activation
1. Extension activated on first command execution
2. Logger initialized with current configuration
3. Board and card managers created
4. Commands registered with VS Code
5. Configuration watchers established
6. Workspace initialized for board storage

### Runtime
1. Commands execute through registered handlers
2. Managers coordinate operations
3. Configuration changes trigger updates
4. Auto-save manages persistence
5. Logging captures operations and errors

### Deactivation
1. Pending changes saved to storage
2. Resources disposed properly
3. Event listeners cleaned up
4. Extension state cleared

## 🎨 UI/UX Considerations

### User Interactions
- All operations provide clear feedback
- Errors show helpful messages with suggested actions
- Confirmations for destructive operations
- Progress indicators for long-running tasks

### Accessibility
- Keyboard navigation support
- Screen reader compatible
- High contrast color options
- Consistent visual hierarchy

### Performance
- Lazy loading of boards
- Debounced auto-save
- Efficient file system operations
- Memory-conscious logging

## 🚧 Future Enhancements

### Planned Features
- [ ] Webview-based kanban board visualization
- [ ] Drag-and-drop card movement
- [ ] Board templates and themes
- [ ] Export/import functionality
- [ ] Team collaboration features
- [ ] Integration with Git workflow
- [ ] Time tracking and reporting
- [ ] Card attachments and links

### Extension Architecture
- [ ] Plugin system for custom card types
- [ ] API for other extensions to integrate
- [ ] Custom field definitions
- [ ] Workflow automation rules
- [ ] Data synchronization options

## 📚 Learning Resources

### VS Code Extension Development
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

### TypeScript Best Practices
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Effective TypeScript](https://effectivetypescript.com/)

### Kanban Methodology
- [Kanban Guide](https://www.atlassian.com/agile/kanban)
- [Lean and Kanban](https://leankit.com/learn/kanban/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

This extension was inspired by [Kanri](https://github.com/trobonox/kanri), an excellent standalone kanban application created by trobonox. While this VS Code extension is a completely independent implementation using TypeScript and the VS Code Extension API, we acknowledge and appreciate the original Kanri project for the inspiration and design concepts that guided this development.

**Important**: This is not a port, fork, or derivative work of the original Kanri software. It's a fresh, independent implementation built specifically for VS Code using Microsoft's official extension patterns and APIs. No code from the original Kanri project was used in this implementation.

## 🤝 Contributing

This scaffold serves as a reference implementation. When adapting for your own projects:

1. **Maintain Documentation Standards**: Keep inline comments comprehensive
2. **Follow Type Safety**: Use TypeScript features for robust code
3. **Test Thoroughly**: Validate all user interactions and edge cases
4. **Consider Accessibility**: Ensure inclusive user experience
5. **Plan for Scale**: Design with future feature additions in mind

---

**Note**: This extension prioritizes functionality and maintainability. Every component is thoroughly documented to facilitate learning and future development.
