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

All template data is stored in a single JSON file at the Electron `userData` path:

| OS      | Path                                                                 |
|---------|----------------------------------------------------------------------|
| macOS   | `~/Library/Application Support/prompt-templates/templates.json`      |
| Windows | `%APPDATA%\prompt-templates\templates.json`                          |
| Linux   | `~/.config/prompt-templates/templates.json`                          |

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
| `listTemplates()`  | Load full app state                 |
| `getTemplate(id)`  | Get a single template by ID         |
| `createTemplate(t)`| Add a new template                  |
| `updateTemplate(id, patch)` | Patch an existing template |
| `deleteTemplate(id)` | Remove a template                 |
| `saveState(state)` | Persist full app state              |
| `importTemplates(templates)` | Bulk import templates     |
| `exportTemplates(ids)` | Export templates by IDs          |
| `getDataPath()`    | Get the templates.json file path    |

## License

MIT
