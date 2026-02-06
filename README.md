# PromptTemplates (Electron Desktop App)

A fullscreen desktop application for creating and reusing prompt templates with dynamic placeholders. Converted from a browser extension to a standalone Electron app using Vite + Vue 3.

## Features

- Built-in prompt templates (role instructions, daily workflows like standups, email replies, meeting recaps)
- Editable prompt templates with `{{variables}}` and `{text blocks}`
- Auto-generated inputs for detected variables and blocks
- Rendered prompt preview with one-click copy
- Local export/import via `prompttemplate://` links
- Light/dark theme toggle
- Search/filter templates by name or description
- Data persisted to a local JSON file (no cloud, no tracking)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts the Vite dev server and launches the Electron app with hot-reload.

### Production Build

```bash
npm run build
```

Builds the Vue renderer, compiles the Electron main/preload processes, and packages the app using electron-builder. Output goes to `release/`.

## Where Data Is Stored

All template data is persisted in a single JSON file (`templates.json`) inside the Electron `userData` directory. This location is managed by the OS and survives app restarts and updates.

| OS      | Path                                                                 |
|---------|----------------------------------------------------------------------|
| macOS   | `~/Library/Application Support/prompt-templates/templates.json`      |
| Windows | `%APPDATA%\prompt-templates\templates.json`                          |
| Linux   | `~/.config/prompt-templates/templates.json`                          |

### Persistence behavior

- **First run**: no file exists, so built-in default templates are shown.
- **Subsequent runs**: the saved file is loaded; user edits, additions, and deletions persist across restarts.
- **Corrupt file**: if `templates.json` cannot be parsed, it is renamed to `templates.json.corrupt-<timestamp>` (preserving the data for manual recovery) and defaults are loaded instead.
- **Writes are atomic**: data is written to a temporary file first, then renamed over the target to prevent corruption from partial writes.

The data schema is the same as the original browser extension:

```json
{
  "templates": [...],
  "pinnedTemplatesByHost": {},
  "theme": "light",
  "templateInputValues": {},
  "activeTemplateId": null
}
```

## Architecture

- **Electron Main Process** (`electron/main/`): Window management, IPC handlers, JSON file storage
- **Preload Script** (`electron/preload/`): Exposes minimal IPC API via `contextBridge` (`contextIsolation: true`, `nodeIntegration: false`)
- **Vue 3 Renderer** (`src/`): Single-page app with three-pane layout
- **Legacy** (`legacy/`): Original browser extension source for reference

### IPC API (exposed via `window.electronAPI`)

| Method             | Description                         |
|--------------------|-------------------------------------|
| `loadTemplates()`  | Load persisted state (or defaults)  |
| `saveTemplates(state)` | Persist full app state (atomic write) |
| `listTemplates()`  | Load full app state (legacy alias)  |
| `getTemplate(id)`  | Get a single template by ID         |
| `createTemplate(t)`| Add a new template                  |
| `updateTemplate(id, patch)` | Patch an existing template |
| `deleteTemplate(id)` | Remove a template                 |
| `saveState(state)` | Persist full app state (legacy alias) |
| `importTemplates(templates)` | Bulk import templates     |
| `exportTemplates(ids)` | Export templates by IDs          |
| `getDataPath()`    | Get the templates.json file path    |

## License

MIT
