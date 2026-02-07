<script setup lang="ts">
import { ref, computed, toRaw, onMounted, onBeforeUnmount } from 'vue'
import type { Template, AppState } from './shared/defaults'
import { renderTemplate, extractOverviewTokens, validateTemplateImportPayload } from './shared/templating'

const api = window.electronAPI

// ── State ──
const loading = ref(true)
const state = ref<AppState>({
  templates: [],
  pinnedTemplatesByHost: {},
  theme: 'light',
  templateInputValues: {},
  activeTemplateId: null,
})
const currentTemplateId = ref<string | null>(null)
const variableValues = ref<Record<string, string>>({})
const blockValues = ref<Record<string, string>>({})
const searchQuery = ref('')
const statusMessage = ref('')
const statusVisible = ref(false)
const importText = ref('')
const importStatus = ref('')
let statusTimeout: ReturnType<typeof setTimeout> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let stateReady = false

const SHARE_PREFIX = 'prompttemplate://'
const MAX_IMPORT_CHARS = 100 * 1024
const BASE64_PATTERN = /^[A-Za-z0-9+/=]+$/

// ── Computed ──
const filteredTemplates = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return state.value.templates
  return state.value.templates.filter(
    t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  )
})

const currentTemplate = computed(() =>
  state.value.templates.find(t => t.id === currentTemplateId.value) ?? null
)

const tokens = computed(() => {
  if (!currentTemplate.value) return { parts: [], variables: [], blocks: [] }
  return extractOverviewTokens(currentTemplate.value.template)
})

const renderedOutput = computed(() => {
  if (!currentTemplate.value) return ''
  const withBlocks = applyBlockValues(currentTemplate.value.template)
  return renderTemplate(withBlocks, variableValues.value)
})

const exportOutput = computed(() => {
  if (!currentTemplate.value) return ''
  return encodeShareTemplate(currentTemplate.value)
})

// ── Helpers ──
function applyBlockValues(templateText: string): string {
  return templateText.replace(/\{(?!\{)([^}]+)\}/g, (match, key) => {
    const normalizedKey = key.trim()
    if (Object.prototype.hasOwnProperty.call(blockValues.value, normalizedKey)) {
      return blockValues.value[normalizedKey]
    }
    return match
  })
}

function setStatus(message: string) {
  statusMessage.value = message
  if (!message) {
    statusVisible.value = false
    return
  }
  statusVisible.value = true
  if (statusTimeout) clearTimeout(statusTimeout)
  statusTimeout = setTimeout(() => {
    statusVisible.value = false
  }, 2200)
}

function generateTemplateId(): string {
  const base = 'template'
  const existing = new Set(state.value.templates.map(t => t.id))
  let index = state.value.templates.length + 1
  while (existing.has(`${base}-${index}`)) {
    index += 1
  }
  return `${base}-${index}`
}

function plainState(): AppState {
  return JSON.parse(JSON.stringify(toRaw(state.value)))
}

function debouncedSave() {
  if (!stateReady) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await api.saveTemplates(plainState())
  }, 500)
}

function debouncedSaveInputValues() {
  if (!currentTemplateId.value) return
  if (!state.value.templateInputValues) {
    state.value.templateInputValues = {}
  }
  state.value.templateInputValues[currentTemplateId.value] = {
    variables: { ...variableValues.value },
    blocks: { ...blockValues.value },
  }
  debouncedSave()
}

function encodeShareTemplate(template: Template): string {
  const json = JSON.stringify({ templates: [template] })
  const base64 = btoa(unescape(encodeURIComponent(json)))
  return `${SHARE_PREFIX}${base64}`
}

function decodeShareTemplate(payload: string): { payload: Record<string, unknown> | null; error: string } {
  if (!payload.startsWith(SHARE_PREFIX)) {
    return { payload: null, error: 'Invalid import link.' }
  }
  const raw = payload.slice(SHARE_PREFIX.length)
  if (!raw) {
    return { payload: null, error: 'Import link is empty.' }
  }
  if (payload.length > SHARE_PREFIX.length + MAX_IMPORT_CHARS) {
    return { payload: null, error: 'Import payload exceeds 100KB limit.' }
  }
  if (!BASE64_PATTERN.test(raw)) {
    return { payload: null, error: 'Import payload is not valid base64.' }
  }
  try {
    const json = decodeURIComponent(escape(atob(raw)))
    const parsed = JSON.parse(json)
    return { payload: parsed, error: '' }
  } catch {
    return { payload: null, error: 'Import payload could not be decoded.' }
  }
}

// ── Actions ──
function selectTemplate(template: Template) {
  currentTemplateId.value = template.id
  state.value.activeTemplateId = template.id

  // Restore saved input values
  const saved = state.value.templateInputValues?.[template.id] || { variables: {}, blocks: {} }
  const newVars: Record<string, string> = {}
  const newBlocks: Record<string, string> = {}
  const t = extractOverviewTokens(template.template)
  t.variables.forEach(v => { newVars[v] = saved.variables[v] || '' })
  t.blocks.forEach(b => { newBlocks[b] = saved.blocks[b] || '' })
  variableValues.value = newVars
  blockValues.value = newBlocks

  debouncedSave()
}

async function createNewTemplate() {
  const newTemplate: Template = {
    id: generateTemplateId(),
    name: 'New template',
    description: '',
    template: 'Hi {{name}},\n\nThanks for reaching out about {{topic}}.',
    fields: [],
  }
  state.value.templates.push(newTemplate)
  await api.saveTemplates(plainState())
  selectTemplate(newTemplate)
}

async function deleteCurrentTemplate() {
  if (!currentTemplateId.value) return
  const template = currentTemplate.value
  const shouldDelete = confirm(`Delete template "${template?.name || currentTemplateId.value}"?`)
  if (!shouldDelete) return

  state.value.templates = state.value.templates.filter(t => t.id !== currentTemplateId.value)
  if (state.value.templateInputValues?.[currentTemplateId.value!]) {
    delete state.value.templateInputValues[currentTemplateId.value!]
  }
  currentTemplateId.value = state.value.templates[0]?.id ?? null
  state.value.activeTemplateId = currentTemplateId.value
  await api.saveTemplates(plainState())
  if (currentTemplateId.value) {
    selectTemplate(state.value.templates.find(t => t.id === currentTemplateId.value)!)
  } else {
    variableValues.value = {}
    blockValues.value = {}
  }
}

async function copyRendered() {
  try {
    await navigator.clipboard.writeText(renderedOutput.value)
    setStatus('Copied to clipboard.')
  } catch {
    setStatus('Unable to copy to clipboard.')
  }
}

async function copyExport() {
  if (!exportOutput.value) {
    setStatus('No template selected.')
    return
  }
  try {
    await navigator.clipboard.writeText(exportOutput.value)
    setStatus('Export copied.')
  } catch {
    setStatus('Unable to copy export.')
  }
}

async function importTemplate() {
  importStatus.value = ''
  const value = importText.value.trim()
  if (!value.startsWith(SHARE_PREFIX)) {
    importStatus.value = 'Invalid import link.'
    return
  }
  if (value.length > SHARE_PREFIX.length + MAX_IMPORT_CHARS) {
    importStatus.value = 'Import payload exceeds 100KB limit.'
    return
  }
  const decoded = decodeShareTemplate(value)
  if (!decoded.payload) {
    importStatus.value = decoded.error || 'Malformed template data.'
    return
  }
  const validation = validateTemplateImportPayload(decoded.payload)
  if (!validation.valid) {
    importStatus.value = validation.error
    return
  }
  const importedTemplates = (decoded.payload as { templates: Template[] }).templates
  const newTemplates = importedTemplates.map(template => {
    const exists = state.value.templates.some(item => item.id === template.id)
    return exists ? { ...template, id: generateTemplateId() } : template
  })
  state.value.templates.push(...newTemplates)
  await api.saveTemplates(plainState())
  selectTemplate(newTemplates[0])
  importText.value = ''
  importStatus.value = newTemplates.length === 1 ? 'Template imported.' : 'Templates imported.'
}

async function toggleTheme() {
  const nextTheme = state.value.theme === 'dark' ? 'light' : 'dark'
  state.value.theme = nextTheme
  applyTheme(nextTheme)
  await api.saveTemplates(plainState())
}

function applyTheme(theme: string) {
  document.body.classList.toggle('theme--dark', theme === 'dark')
}

// ── Template field change handlers ──
function onNameChange(event: Event) {
  const template = currentTemplate.value
  if (!template) return
  template.name = (event.target as HTMLInputElement).value
  debouncedSave()
}

function onDescriptionChange(event: Event) {
  const template = currentTemplate.value
  if (!template) return
  template.description = (event.target as HTMLTextAreaElement).value
  debouncedSave()
}

function onTemplateBodyChange(event: Event) {
  const template = currentTemplate.value
  if (!template) return
  template.template = (event.target as HTMLTextAreaElement).value

  // Re-extract tokens and rebuild input values
  const t = extractOverviewTokens(template.template)
  const saved = state.value.templateInputValues?.[template.id] || { variables: {}, blocks: {} }
  const newVars: Record<string, string> = {}
  const newBlocks: Record<string, string> = {}
  t.variables.forEach(v => { newVars[v] = variableValues.value[v] ?? saved.variables[v] ?? '' })
  t.blocks.forEach(b => { newBlocks[b] = blockValues.value[b] ?? saved.blocks[b] ?? '' })
  variableValues.value = newVars
  blockValues.value = newBlocks

  debouncedSave()
}

function onVariableInput(key: string, value: string) {
  variableValues.value[key] = value
  debouncedSaveInputValues()
}

function onBlockInput(key: string, value: string) {
  blockValues.value[key] = value
  debouncedSaveInputValues()
}

// ── Init ──
onMounted(async () => {
  // Main process handles defaults: returns saved data or defaults if no file/corrupt
  const loaded = await api.loadTemplates()

  state.value = loaded
  applyTheme(loaded.theme || 'light')

  // Allow saves only after disk state has been loaded into the reactive tree.
  // Before this point debouncedSave() is a no-op, so the initial empty
  // { templates: [] } can never be flushed to disk.
  stateReady = true

  const savedActiveId = loaded.activeTemplateId
  const savedTemplate = savedActiveId
    ? loaded.templates.find((t: Template) => t.id === savedActiveId)
    : null
  const firstId = savedTemplate ? savedActiveId : (loaded.templates[0]?.id ?? null)

  if (firstId) {
    const template = loaded.templates.find((t: Template) => t.id === firstId)!
    selectTemplate(template)
  }

  loading.value = false
})

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<template>
  <main class="app">
    <div v-if="loading" class="app-loading-state">Loading templates...</div>
    <section v-else class="layout-shell">
      <header class="app__header">
        <h1>PromptTemplates</h1>
        <button class="button button--ghost" type="button" @click="toggleTheme">
          {{ state.theme === 'dark' ? 'Light mode' : 'Dark mode' }}
        </button>
      </header>

      <!-- Sidebar -->
      <aside class="layout-shell__sidebar">
        <div class="sidebar__header">
          <h2>Templates</h2>
          <button class="button" @click="createNewTemplate">New</button>
        </div>
        <div class="sidebar__search">
          <input
            v-model="searchQuery"
            class="field__input"
            type="text"
            placeholder="Search templates..."
          />
        </div>
        <div class="template-list">
          <button
            v-for="template in filteredTemplates"
            :key="template.id"
            type="button"
            class="template-list__item"
            :class="{ 'is-active': template.id === currentTemplateId }"
            @click="selectTemplate(template)"
          >
            <span class="template-list__item-name">{{ template.name || template.id }}</span>
            <span v-if="template.description" class="template-list__item-desc">{{ template.description }}</span>
          </button>
        </div>
      </aside>

      <!-- Main editor -->
      <section class="layout-shell__main">
        <div>
          <h2>Prompt Template</h2>
        </div>
        <label class="field">
          <span class="field__label">Name</span>
          <input
            class="field__input"
            type="text"
            placeholder="Template name"
            :value="currentTemplate?.name ?? ''"
            :disabled="!currentTemplate"
            @input="onNameChange"
          />
        </label>
        <label class="field">
          <span class="field__label">Description</span>
          <textarea
            class="field__input"
            rows="2"
            placeholder="Optional description"
            :value="currentTemplate?.description ?? ''"
            :disabled="!currentTemplate"
            @input="onDescriptionChange"
          ></textarea>
        </label>
        <label class="field">
          <span class="field__label">Template</span>
          <textarea
            class="field__input"
            rows="8"
            :value="currentTemplate?.template ?? ''"
            :disabled="!currentTemplate"
            @input="onTemplateBodyChange"
          ></textarea>
        </label>

        <!-- Dynamic variable inputs -->
        <div class="overview-inputs">
          <label v-for="v in tokens.variables" :key="'var-' + v" class="field">
            <span class="field__label">{{ v }}</span>
            <input
              class="field__input"
              type="text"
              :value="variableValues[v] ?? ''"
              @input="(e) => onVariableInput(v, (e.target as HTMLInputElement).value)"
            />
          </label>
          <label v-for="b in tokens.blocks" :key="'block-' + b" class="field">
            <span class="field__label">{{ b }}</span>
            <textarea
              class="field__input"
              rows="6"
              :value="blockValues[b] ?? ''"
              @input="(e) => onBlockInput(b, (e.target as HTMLTextAreaElement).value)"
            ></textarea>
          </label>
        </div>

        <!-- Rendered output -->
        <div class="overview-output">
          <h3>Rendered Prompt</h3>
          <textarea class="field__input" rows="8" readonly :value="renderedOutput"></textarea>
        </div>
      </section>

      <!-- Actions panel -->
      <section class="layout-shell__actions">
        <div class="actions-block">
          <h2>Actions</h2>
          <div class="actions">
            <button class="button" @click="copyRendered">Copy Prompt</button>
            <button
              class="button button--danger"
              type="button"
              :disabled="!currentTemplateId"
              @click="deleteCurrentTemplate"
            >
              Delete Template
            </button>
          </div>
        </div>
        <div class="actions-block">
          <h3>Export Template</h3>
          <textarea class="field__input" rows="8" readonly :value="exportOutput"></textarea>
          <button class="button" @click="copyExport">Copy export</button>
        </div>
        <div class="actions-block">
          <h3>Import Template</h3>
          <textarea
            v-model="importText"
            class="field__input"
            rows="8"
            placeholder="Paste a prompttemplate:// link"
          ></textarea>
          <button class="button" @click="importTemplate">Import</button>
          <p v-if="importStatus" class="muted" role="status" aria-live="polite">{{ importStatus }}</p>
        </div>
      </section>
    </section>

    <!-- Toast notification -->
    <div class="toast" :class="{ 'toast--visible': statusVisible }" role="status" aria-live="polite">
      {{ statusMessage }}
    </div>
  </main>
</template>
