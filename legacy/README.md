# PromptTemplates

PromptTemplates is a lightweight browser extension for authoring reusable prompt templates. It provides a three-pane popup that lets you pick a template, edit the prompt template, fill variables and text blocks, and copy or insert the rendered prompt.

## Features
- Built-in prompt templates (role instructions plus daily workflow templates like standups, email replies, and meeting recaps).
- Editable prompt template with `{{variables}}` and `{text blocks}`.
- Auto-generated inputs for detected variables and blocks.
- Rendered prompt preview with one-click copy or insert.
- Local export/import via `prompttemplate://` links.
- Optional light/dark theme toggle with ChatGPT-inspired styling.

## Screenshots

![promptTemplatesScreenshot1](./docs/screenshots/promptTemplatesScreenshot.png)
![promptTemplatesScreenshot2](./docs/screenshots/promptTemplatesLightScreenshot.png)


## Installation (Unpacked)
1. Clone this repository.
2. Open Chrome (or any Chromium browser) and navigate to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository folder.

For Firefox:
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.

## Usage
1. Open the extension popup.
2. Select a template from the left pane.
3. Edit the prompt template, fill in variable and block inputs, and review the rendered prompt.
    - Use `{{variable}}` for inputs and use `{ text }` for textareas.
4. Use **Copy Prompt** to use the final prompt.
5. Use **Export Template** to share a template or **Import Template** to load one.

## Development
- Source code lives under `src/`.
- Popup UI: `src/popup/`
- Shared helpers: `src/shared/`
- Content script: `src/content/`

## License
MIT
