import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const DATA_FILE = path.join(app.getPath('userData'), 'templates.json')

export interface TemplateField {
  key: string
  label: string
  type: string
  default: string
  options: string[]
}

export interface Template {
  id: string
  name: string
  description: string
  template: string
  fields: TemplateField[]
}

export interface AppState {
  templates: Template[]
  pinnedTemplatesByHost: Record<string, string>
  theme: string
  templateInputValues: Record<string, { variables: Record<string, string>; blocks: Record<string, string> }>
  activeTemplateId: string | null
}

function readStore(): AppState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      return JSON.parse(raw) as AppState
    }
  } catch {
    // corrupted file — fall through to default
  }
  return getDefaultState()
}

function writeStore(state: AppState): void {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8')
}

function getDefaultState(): AppState {
  // Inline defaults matching legacy/src/shared/defaults.js
  return {
    templates: [],
    pinnedTemplatesByHost: {},
    theme: 'light',
    templateInputValues: {},
    activeTemplateId: null,
  }
}

// ── CRUD operations ──

export function listTemplates(): AppState {
  return readStore()
}

export function getTemplate(id: string): Template | null {
  const state = readStore()
  return state.templates.find(t => t.id === id) ?? null
}

export function createTemplate(template: Template): AppState {
  const state = readStore()
  state.templates.push(template)
  writeStore(state)
  return state
}

export function updateTemplate(id: string, patch: Partial<Template>): AppState {
  const state = readStore()
  const idx = state.templates.findIndex(t => t.id === id)
  if (idx !== -1) {
    state.templates[idx] = { ...state.templates[idx], ...patch, id }
  }
  writeStore(state)
  return state
}

export function deleteTemplate(id: string): AppState {
  const state = readStore()
  state.templates = state.templates.filter(t => t.id !== id)
  // Clean up saved input values
  if (state.templateInputValues?.[id]) {
    delete state.templateInputValues[id]
  }
  if (state.activeTemplateId === id) {
    state.activeTemplateId = state.templates[0]?.id ?? null
  }
  writeStore(state)
  return state
}

export function saveFullState(state: AppState): AppState {
  writeStore(state)
  return state
}

export function importTemplates(templates: Template[]): AppState {
  const state = readStore()
  const existingIds = new Set(state.templates.map(t => t.id))
  for (const t of templates) {
    if (existingIds.has(t.id)) {
      t.id = generateTemplateId(state)
    }
    state.templates.push(t)
    existingIds.add(t.id)
  }
  writeStore(state)
  return state
}

export function exportTemplates(ids: string[]): Template[] {
  const state = readStore()
  if (!ids || ids.length === 0) {
    return state.templates
  }
  const idSet = new Set(ids)
  return state.templates.filter(t => idSet.has(t.id))
}

function generateTemplateId(state: AppState): string {
  const base = 'template'
  const existing = new Set(state.templates.map(t => t.id))
  let index = state.templates.length + 1
  while (existing.has(`${base}-${index}`)) {
    index += 1
  }
  return `${base}-${index}`
}

export function getDataFilePath(): string {
  return DATA_FILE
}
