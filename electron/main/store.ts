import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_TEMPLATES } from '../../src/shared/defaults'

// ── Types ──

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

// ── Logging (dev-only) ──

const isDev = !app.isPackaged

function log(...args: unknown[]): void {
  if (isDev) {
    console.log('[store]', ...args)
  }
}

// ── Store path ──

let _storePath: string | null = null

export function getStorePath(): string {
  if (!_storePath) {
    _storePath = path.join(app.getPath('userData'), 'templates.json')
    log('Resolved data path:', _storePath)
  }
  return _storePath
}

// ── Default state ──

function getDefaultState(): AppState {
  return {
    templates: [...DEFAULT_TEMPLATES],
    pinnedTemplatesByHost: {},
    theme: 'light',
    templateInputValues: {},
    activeTemplateId: null,
  }
}

// ── Core persistence ──

export function loadTemplates(): AppState {
  const filePath = getStorePath()

  if (!fs.existsSync(filePath)) {
    log('Load: no store file found, using defaults')
    return getDefaultState()
  }

  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    log('Load: failed to read store file:', err)
    return getDefaultState()
  }

  try {
    const parsed = JSON.parse(raw) as AppState
    // Sanity check: must have a templates array
    if (!parsed || !Array.isArray(parsed.templates)) {
      throw new Error('Invalid store structure: missing templates array')
    }
    log('Load: loaded', parsed.templates.length, 'templates from file')
    return parsed
  } catch (err) {
    // File exists but is corrupt — rename it so we don't lose data, then use defaults
    const timestamp = Date.now()
    const corruptPath = `${filePath}.corrupt-${timestamp}`
    log('Load: corrupt store file, renaming to', corruptPath, '— error:', err)
    try {
      fs.renameSync(filePath, corruptPath)
    } catch (renameErr) {
      log('Load: failed to rename corrupt file:', renameErr)
    }
    return getDefaultState()
  }
}

export function saveTemplates(state: AppState): void {
  const filePath = getStorePath()
  const dir = path.dirname(filePath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Atomic write: write to temp file, then rename over the target
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8')
    fs.renameSync(tmpPath, filePath)
    log('Save: wrote', state.templates.length, 'templates')
  } catch (err) {
    log('Save: error during atomic write:', err)
    // Clean up temp file if rename failed
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
    } catch { /* ignore cleanup errors */ }
    // Fall back to direct write
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8')
    log('Save: fell back to direct write')
  }
}

// ── CRUD operations (use core persistence internally) ──

export function listTemplates(): AppState {
  return loadTemplates()
}

export function getTemplate(id: string): Template | null {
  const state = loadTemplates()
  return state.templates.find(t => t.id === id) ?? null
}

export function createTemplate(template: Template): AppState {
  const state = loadTemplates()
  state.templates.push(template)
  saveTemplates(state)
  return state
}

export function updateTemplate(id: string, patch: Partial<Template>): AppState {
  const state = loadTemplates()
  const idx = state.templates.findIndex(t => t.id === id)
  if (idx !== -1) {
    state.templates[idx] = { ...state.templates[idx], ...patch, id }
  }
  saveTemplates(state)
  return state
}

export function deleteTemplate(id: string): AppState {
  const state = loadTemplates()
  state.templates = state.templates.filter(t => t.id !== id)
  // Clean up saved input values
  if (state.templateInputValues?.[id]) {
    delete state.templateInputValues[id]
  }
  if (state.activeTemplateId === id) {
    state.activeTemplateId = state.templates[0]?.id ?? null
  }
  saveTemplates(state)
  return state
}

export function saveFullState(state: AppState): AppState {
  saveTemplates(state)
  return state
}

export function importTemplates(templates: Template[]): AppState {
  const state = loadTemplates()
  const existingIds = new Set(state.templates.map(t => t.id))
  for (const t of templates) {
    if (existingIds.has(t.id)) {
      t.id = generateTemplateId(state)
    }
    state.templates.push(t)
    existingIds.add(t.id)
  }
  saveTemplates(state)
  return state
}

export function exportTemplates(ids: string[]): Template[] {
  const state = loadTemplates()
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
  return getStorePath()
}
