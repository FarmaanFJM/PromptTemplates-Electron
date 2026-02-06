export function renderTemplate(template, values) {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const normalizedKey = key.trim();
    if (Object.prototype.hasOwnProperty.call(values, normalizedKey)) {
      return String(values[normalizedKey]);
    }
    return match;
  });
}

export function extractPlaceholders(template) {
  const placeholders = new Set();
  const regex = /\{\{([^}]+)\}\}/g;
  let match = regex.exec(template);
  while (match) {
    placeholders.add(match[1].trim());
    match = regex.exec(template);
  }
  return Array.from(placeholders);
}

export function validateTemplate(template, fields) {
  const placeholders = extractPlaceholders(template);
  const fieldKeys = fields.map((field) => field.key);
  const fieldKeySet = new Set(fieldKeys);

  const unknownPlaceholders = placeholders.filter(
    (placeholder) => !fieldKeySet.has(placeholder)
  );
  const unusedFields = Array.from(
    new Set(fieldKeys.filter((fieldKey) => !placeholders.includes(fieldKey)))
  );

  return {
    unknownPlaceholders: unknownPlaceholders.sort(),
    unusedFields: unusedFields.sort()
  };
}

const TEMPLATE_KEYS = ["id", "name", "description", "template", "fields"];
const FIELD_KEYS = ["key", "label", "type", "default", "options"];
const ALLOWED_FIELD_TYPES = ["text", "textarea", "select"];

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
  maxOptionLength: 120
};

function hasOnlyKeys(object, allowedKeys) {
  return Object.keys(object).every((key) => allowedKeys.includes(key));
}

function validateTemplateField(field, limits) {
  if (!field || typeof field !== "object") {
    return "Each field must be an object.";
  }
  if (!hasOnlyKeys(field, FIELD_KEYS)) {
    return "Field contains unknown keys.";
  }
  const { key, label, type, default: defaultValue, options } = field;
  if (
    typeof key !== "string" ||
    typeof label !== "string" ||
    typeof type !== "string" ||
    typeof defaultValue !== "string" ||
    !Array.isArray(options)
  ) {
    return "Field has invalid types.";
  }
  if (!ALLOWED_FIELD_TYPES.includes(type)) {
    return "Field type is not allowed.";
  }
  if (key.length > limits.maxFieldKeyLength) {
    return "Field key is too long.";
  }
  if (label.length > limits.maxFieldLabelLength) {
    return "Field label is too long.";
  }
  if (defaultValue.length > limits.maxFieldDefaultLength) {
    return "Field default value is too long.";
  }
  if (options.length > limits.maxOptions) {
    return "Field has too many options.";
  }
  if (!options.every((option) => typeof option === "string")) {
    return "Field options must be strings.";
  }
  if (options.some((option) => option.length > limits.maxOptionLength)) {
    return "Field option is too long.";
  }
  if (type === "select" && options.length === 0) {
    return "Select fields require options.";
  }
  return null;
}

function validateTemplateObject(template, limits) {
  if (!template || typeof template !== "object") {
    return "Template must be an object.";
  }
  if (!hasOnlyKeys(template, TEMPLATE_KEYS)) {
    return "Template contains unknown keys.";
  }
  const { id, name, description, template: rawTemplate, fields } = template;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof description !== "string" ||
    typeof rawTemplate !== "string" ||
    !Array.isArray(fields)
  ) {
    return "Template has invalid types.";
  }
  if (!id || id.length > limits.maxIdLength) {
    return "Template id is missing or too long.";
  }
  if (!name || name.length > limits.maxNameLength) {
    return "Template name is missing or too long.";
  }
  if (description.length > limits.maxDescriptionLength) {
    return "Template description is too long.";
  }
  if (!rawTemplate || rawTemplate.length > limits.maxTemplateLength) {
    return "Template body is missing or too long.";
  }
  if (fields.length > limits.maxFields) {
    return "Template has too many fields.";
  }
  for (const field of fields) {
    const fieldError = validateTemplateField(field, limits);
    if (fieldError) {
      return fieldError;
    }
  }
  return null;
}

export function validateTemplateImportPayload(payload, limits = {}) {
  const resolvedLimits = { ...DEFAULT_IMPORT_LIMITS, ...limits };
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Import payload must be an object." };
  }
  if (!hasOnlyKeys(payload, ["templates"])) {
    return { valid: false, error: "Import payload has unknown keys." };
  }
  if (!Array.isArray(payload.templates)) {
    return { valid: false, error: "Import payload templates must be an array." };
  }
  if (payload.templates.length === 0) {
    return { valid: false, error: "No templates found in import payload." };
  }
  if (payload.templates.length > resolvedLimits.maxTemplates) {
    return { valid: false, error: "Too many templates in import payload." };
  }

  for (const template of payload.templates) {
    const templateError = validateTemplateObject(template, resolvedLimits);
    if (templateError) {
      return { valid: false, error: templateError };
    }
  }

  return { valid: true, error: "" };
}

export function splitTemplateSections(template) {
  const lines = template.split("\n");
  const sections = [];
  let current = null;

  lines.forEach((line) => {
    if (line.startsWith("## ")) {
      if (current) {
        sections.push(current);
      }
      current = { title: line.slice(3).trim(), content: "" };
      return;
    }

    if (!current) {
      current = { title: "Overview", content: "" };
    }

    current.content = current.content
      ? `${current.content}\n${line}`
      : line;
  });

  if (current) {
    sections.push(current);
  }

  return sections;
}

export function composeTemplateSections(sections) {
  return sections
    .map((section) => {
      const header = `## ${section.title}`;
      const body = section.content.trim();
      return body ? `${header}\n${body}` : header;
    })
    .join("\n\n");
}

export function extractOverviewTokens(text) {
  const parts = [];
  const variables = new Set();
  const blocks = new Set();
  const regex = /\{\{([^}]+)\}\}|\{(?!\{)([^}]+)\}/g;
  let lastIndex = 0;
  let match = regex.exec(text);
  while (match) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      const key = match[1].trim();
      variables.add(key);
      parts.push({ type: "variable", label: `{{${key}}}` });
    } else if (match[2]) {
      const key = match[2].trim();
      blocks.add(key);
      parts.push({ type: "block", label: `{${key}}` });
    }
    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return {
    parts,
    variables: Array.from(variables),
    blocks: Array.from(blocks)
  };
}
