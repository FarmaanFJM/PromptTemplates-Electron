export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const normalizedKey = key.trim()
    if (Object.prototype.hasOwnProperty.call(values, normalizedKey)) {
      return String(values[normalizedKey])
    }
    return match
  })
}

export function extractPlaceholders(template: string): string[] {
  const placeholders = new Set<string>()
  const regex = /\{\{([^}]+)\}\}/g
  let match = regex.exec(template)
  while (match) {
    placeholders.add(match[1].trim())
    match = regex.exec(template)
  }
  return Array.from(placeholders)
}

const TEMPLATE_KEYS = ['id', 'name', 'description', 'template', 'fields']
const FIELD_KEYS = ['key', 'label', 'type', 'default', 'options']
const ALLOWED_FIELD_TYPES = ['text', 'textarea', 'select']

export const DEFAULT_IMPORT_LIMITS = {
  maxTemplates: 20,
  maxIdLength: 64,
  maxNameLength: 120,
  maxDescriptionLength: 1000,
  maxTemplateLength: 20000,
  maxFields: 50,
  maxFieldKeyLength: 64,
  maxFieldLabelLength: 120,
  maxFieldDefaultLength: 2000,
  maxOptions: 100,
  maxOptionLength: 120,
}

function hasOnlyKeys(object: Record<string, unknown>, allowedKeys: string[]): boolean {
  return Object.keys(object).every((key) => allowedKeys.includes(key))
}

function validateTemplateField(field: Record<string, unknown>, limits: typeof DEFAULT_IMPORT_LIMITS): string | null {
  if (!field || typeof field !== 'object') return 'Each field must be an object.'
  if (!hasOnlyKeys(field, FIELD_KEYS)) return 'Field contains unknown keys.'
  const { key, label, type, default: defaultValue, options } = field as Record<string, unknown>
  if (
    typeof key !== 'string' ||
    typeof label !== 'string' ||
    typeof type !== 'string' ||
    typeof defaultValue !== 'string' ||
    !Array.isArray(options)
  ) return 'Field has invalid types.'
  if (!ALLOWED_FIELD_TYPES.includes(type)) return 'Field type is not allowed.'
  if ((key as string).length > limits.maxFieldKeyLength) return 'Field key is too long.'
  if ((label as string).length > limits.maxFieldLabelLength) return 'Field label is too long.'
  if ((defaultValue as string).length > limits.maxFieldDefaultLength) return 'Field default value is too long.'
  if (options.length > limits.maxOptions) return 'Field has too many options.'
  if (!options.every((o: unknown) => typeof o === 'string')) return 'Field options must be strings.'
  if (options.some((o: unknown) => (o as string).length > limits.maxOptionLength)) return 'Field option is too long.'
  if (type === 'select' && options.length === 0) return 'Select fields require options.'
  return null
}

function validateTemplateObject(template: Record<string, unknown>, limits: typeof DEFAULT_IMPORT_LIMITS): string | null {
  if (!template || typeof template !== 'object') return 'Template must be an object.'
  if (!hasOnlyKeys(template, TEMPLATE_KEYS)) return 'Template contains unknown keys.'
  const { id, name, description, template: rawTemplate, fields } = template as Record<string, unknown>
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof description !== 'string' ||
    typeof rawTemplate !== 'string' ||
    !Array.isArray(fields)
  ) return 'Template has invalid types.'
  if (!id || (id as string).length > limits.maxIdLength) return 'Template id is missing or too long.'
  if (!name || (name as string).length > limits.maxNameLength) return 'Template name is missing or too long.'
  if ((description as string).length > limits.maxDescriptionLength) return 'Template description is too long.'
  if (!rawTemplate || (rawTemplate as string).length > limits.maxTemplateLength) return 'Template body is missing or too long.'
  if (fields.length > limits.maxFields) return 'Template has too many fields.'
  for (const field of fields) {
    const fieldError = validateTemplateField(field as Record<string, unknown>, limits)
    if (fieldError) return fieldError
  }
  return null
}

export function validateTemplateImportPayload(
  payload: Record<string, unknown>,
  limits: Partial<typeof DEFAULT_IMPORT_LIMITS> = {}
): { valid: boolean; error: string } {
  const resolvedLimits = { ...DEFAULT_IMPORT_LIMITS, ...limits }
  if (!payload || typeof payload !== 'object') return { valid: false, error: 'Import payload must be an object.' }
  if (!hasOnlyKeys(payload, ['templates'])) return { valid: false, error: 'Import payload has unknown keys.' }
  if (!Array.isArray(payload.templates)) return { valid: false, error: 'Import payload templates must be an array.' }
  if (payload.templates.length === 0) return { valid: false, error: 'No templates found in import payload.' }
  if (payload.templates.length > resolvedLimits.maxTemplates) return { valid: false, error: 'Too many templates in import payload.' }

  for (const template of payload.templates) {
    const templateError = validateTemplateObject(template, resolvedLimits)
    if (templateError) return { valid: false, error: templateError }
  }

  return { valid: true, error: '' }
}

export interface OverviewToken {
  type: 'text' | 'variable' | 'block'
  value?: string
  label?: string
}

export function extractOverviewTokens(text: string): {
  parts: OverviewToken[]
  variables: string[]
  blocks: string[]
} {
  const parts: OverviewToken[] = []
  const variables = new Set<string>()
  const blocks = new Set<string>()
  const regex = /\{\{([^}]+)\}\}|\{(?!\{)([^}]+)\}/g
  let lastIndex = 0
  let match = regex.exec(text)
  while (match) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    if (match[1]) {
      const key = match[1].trim()
      variables.add(key)
      parts.push({ type: 'variable', label: `{{${key}}}` })
    } else if (match[2]) {
      const key = match[2].trim()
      blocks.add(key)
      parts.push({ type: 'block', label: `{${key}}` })
    }
    lastIndex = regex.lastIndex
    match = regex.exec(text)
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return {
    parts,
    variables: Array.from(variables),
    blocks: Array.from(blocks),
  }
}
