import { loadState, saveState } from "../shared/storage.js";
import {
  extractOverviewTokens,
  renderTemplate,
  validateTemplateImportPayload
} from "../shared/templating.js";
console.log("popup.js loaded");
const templateList = document.getElementById("templateList");
const templateNameInput = document.getElementById("templateNameInput");
const templateDescriptionInput = document.getElementById("templateDescriptionInput");
const promptTemplateInput = document.getElementById("promptTemplateInput");
const overviewInputs = document.getElementById("overviewInputs");
const renderedOutput = document.getElementById("renderedOutput");
const exportTemplateOutput = document.getElementById("exportTemplateOutput");
const exportCopyButton = document.getElementById("exportCopyButton");
const importTemplateInput = document.getElementById("importTemplateInput");
const importTemplateButton = document.getElementById("importTemplateButton");
const importStatus = document.getElementById("importStatus");
const copyButton = document.getElementById("copyButton");
const newTemplateButton = document.getElementById("newTemplateButton");
const deleteTemplateButton = document.getElementById("deleteTemplateButton");
const statusMessage = document.getElementById("statusMessage");
const themeToggle = document.getElementById("themeToggle");

let state = null;
let currentTemplateId = null;
let variableValues = {};
let blockValues = {};
let statusTimeout = null;
let currentTheme = "light";
let saveDebounceTimer = null;

const SHARE_PREFIX = "prompttemplate://";
const MAX_IMPORT_CHARS = 100 * 1024;
const BASE64_PATTERN = /^[A-Za-z0-9+/=]+$/;

function debounce(fn, delay) {
  return function (...args) {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }
    saveDebounceTimer = setTimeout(() => fn(...args), delay);
  };
}

const saveTemplateInputValues = debounce(async () => {
  if (!currentTemplateId) {
    return;
  }
  if (!state.templateInputValues) {
    state.templateInputValues = {};
  }
  state.templateInputValues[currentTemplateId] = {
    variables: { ...variableValues },
    blocks: { ...blockValues }
  };
  await saveState(state);
}, 500);

function setStatus(message) {
  statusMessage.textContent = message;
  if (!message) {
    statusMessage.classList.remove("toast--visible");
    return;
  }
  statusMessage.classList.add("toast--visible");
  if (statusTimeout) {
    window.clearTimeout(statusTimeout);
  }
  statusTimeout = window.setTimeout(() => {
    statusMessage.classList.remove("toast--visible");
  }, 2200);
}

function setImportStatus(message) {
  importStatus.textContent = message;
}

function applyTheme(theme) {
  currentTheme = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("theme--dark", currentTheme === "dark");
  themeToggle.textContent =
    currentTheme === "dark" ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", currentTheme === "dark");
}

function getTemplateById(id) {
  return state.templates.find((template) => template.id === id);
}

function setDeleteButtonState() {
  deleteTemplateButton.disabled = !currentTemplateId;
}

function generateTemplateId() {
  const base = "template";
  const existing = new Set(state.templates.map((template) => template.id));
  let index = state.templates.length + 1;
  while (existing.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function buildTemplateList() {
  templateList.innerHTML = "";
  state.templates.forEach((template) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "template-list__item";
    if (template.id === currentTemplateId) {
      button.classList.add("is-active");
    }
    button.textContent = template.name || template.id;
    button.addEventListener("click", () => {
      applyTemplateSelection(template);
    });
    templateList.append(button);
  });
}

function renderTemplateInputs(template) {
  overviewInputs.innerHTML = "";
  variableValues = {};
  blockValues = {};

  if (!template) {
    templateNameInput.value = "";
    templateNameInput.disabled = true;
    templateDescriptionInput.value = "";
    templateDescriptionInput.disabled = true;
    promptTemplateInput.disabled = true;
    renderedOutput.value = "";
    exportTemplateOutput.value = "";
    return;
  }

  templateNameInput.value = template.name || "";
  templateNameInput.disabled = false;
  templateDescriptionInput.value = template.description || "";
  templateDescriptionInput.disabled = false;
  promptTemplateInput.disabled = false;
  const tokens = extractOverviewTokens(template.template);

  // Restore saved input values for this template
  const savedValues = state.templateInputValues?.[template.id] || { variables: {}, blocks: {} };

  tokens.variables.forEach((variable) => {
    variableValues[variable] = savedValues.variables[variable] || "";
    const field = document.createElement("label");
    field.className = "field";
    const label = document.createElement("span");
    label.className = "field__label";
    label.textContent = variable;
    const input = document.createElement("input");
    input.className = "field__input";
    input.type = "text";
    input.value = variableValues[variable];
    input.addEventListener("input", () => {
      variableValues[variable] = input.value;
      updateRenderedOutput();
      saveTemplateInputValues();
    });
    field.append(label, input);
    overviewInputs.append(field);
  });

  tokens.blocks.forEach((block) => {
    blockValues[block] = savedValues.blocks[block] || "";
    const field = document.createElement("label");
    field.className = "field";
    const label = document.createElement("span");
    label.className = "field__label";
    label.textContent = block;
    const textarea = document.createElement("textarea");
    textarea.className = "field__input";
    textarea.rows = 6;
    textarea.value = blockValues[block];
    textarea.addEventListener("input", () => {
      blockValues[block] = textarea.value;
      updateRenderedOutput();
      saveTemplateInputValues();
    });
    field.append(label, textarea);
    overviewInputs.append(field);
  });

  exportTemplateOutput.value = encodeShareTemplate(template);
  updateRenderedOutput();
}

function applyBlockValues(templateText) {
  return templateText.replace(/\{(?!\{)([^}]+)\}/g, (match, key) => {
    const normalizedKey = key.trim();
    if (Object.prototype.hasOwnProperty.call(blockValues, normalizedKey)) {
      return blockValues[normalizedKey];
    }
    return match;
  });
}

function updateRenderedOutput() {
  const template = getTemplateById(currentTemplateId);
  if (!template) {
    renderedOutput.value = "";
    return;
  }
  const withBlocks = applyBlockValues(template.template);
  renderedOutput.value = renderTemplate(withBlocks, variableValues);
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(renderedOutput.value);
    setStatus("Copied to clipboard.");
  } catch (error) {
    setStatus("Unable to copy to clipboard.");
  }
}

function encodeShareTemplate(template) {
  const json = JSON.stringify({ templates: [template] });
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return `${SHARE_PREFIX}${base64}`;
}

function decodeShareTemplate(payload) {
  if (!payload.startsWith(SHARE_PREFIX)) {
    return { payload: null, error: "Invalid import link." };
  }
  const raw = payload.slice(SHARE_PREFIX.length);
  if (!raw) {
    return { payload: null, error: "Import link is empty." };
  }
  if (payload.length > SHARE_PREFIX.length + MAX_IMPORT_CHARS) {
    return { payload: null, error: "Import payload exceeds 100KB limit." };
  }
  if (!BASE64_PATTERN.test(raw)) {
    return { payload: null, error: "Import payload is not valid base64." };
  }
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(json);
    return { payload: parsed, error: "" };
  } catch (error) {
    return { payload: null, error: "Import payload could not be decoded." };
  }
}

function applyTemplateSelection(template) {
  currentTemplateId = template.id;
  state.activeTemplateId = template.id;
  buildTemplateList();
  promptTemplateInput.value = template.template;
  renderTemplateInputs(template);
  setDeleteButtonState();
  debouncedSave();
}

async function init() {
  state = await loadState();
  if (!state.templates.length) {
    state.templates = [];
    await saveState(state);
  }
  if (!state.theme) {
    state.theme = "light";
    await saveState(state);
  }
  if (!state.templateInputValues) {
    state.templateInputValues = {};
    await saveState(state);
  }

  buildTemplateList();
  applyTheme(state.theme);

  const savedActiveId = state.activeTemplateId;
  const savedTemplate = savedActiveId ? getTemplateById(savedActiveId) : null;
  currentTemplateId = savedTemplate ? savedActiveId : (state.templates[0]?.id ?? null);

  if (currentTemplateId) {
    const template = getTemplateById(currentTemplateId);
    applyTemplateSelection(template);
  } else {
    promptTemplateInput.value = "";
    renderTemplateInputs(null);
    setDeleteButtonState();
  }
}

const debouncedSave = debounce(async () => {
  await saveState(state);
}, 500);

templateNameInput.addEventListener("input", () => {
  const template = getTemplateById(currentTemplateId);
  if (!template) {
    return;
  }
  template.name = templateNameInput.value;
  buildTemplateList();
  debouncedSave();
});

templateDescriptionInput.addEventListener("input", () => {
  const template = getTemplateById(currentTemplateId);
  if (!template) {
    return;
  }
  template.description = templateDescriptionInput.value;
  debouncedSave();
});

promptTemplateInput.addEventListener("input", () => {
  const template = getTemplateById(currentTemplateId);
  if (!template) {
    return;
  }
  template.template = promptTemplateInput.value;
  renderTemplateInputs(template);
  debouncedSave();
});

exportCopyButton.addEventListener("click", async () => {
  if (!exportTemplateOutput.value) {
    setStatus("No template selected.");
    return;
  }
  try {
    await navigator.clipboard.writeText(exportTemplateOutput.value);
    setStatus("Export copied.");
  } catch (error) {
    setStatus("Unable to copy export.");
  }
});

importTemplateButton.addEventListener("click", async () => {
  setImportStatus("");
  const value = importTemplateInput.value.trim();
  if (!value.startsWith(SHARE_PREFIX)) {
    setImportStatus("Invalid import link.");
    return;
  }
  if (value.length > SHARE_PREFIX.length + MAX_IMPORT_CHARS) {
    setImportStatus("Import payload exceeds 100KB limit.");
    return;
  }
  const decoded = decodeShareTemplate(value);
  if (!decoded.payload) {
    setImportStatus(decoded.error || "Malformed template data.");
    return;
  }
  const validation = validateTemplateImportPayload(decoded.payload);
  if (!validation.valid) {
    setImportStatus(validation.error);
    return;
  }
  const importedTemplates = decoded.payload.templates;
  const newTemplates = importedTemplates.map((template) => {
    const exists = state.templates.some((item) => item.id === template.id);
    return exists ? { ...template, id: generateTemplateId() } : template;
  });
  state.templates.push(...newTemplates);
  await saveState(state);
  applyTemplateSelection(newTemplates[0]);
  importTemplateInput.value = "";
  setImportStatus(
    newTemplates.length === 1 ? "Template imported." : "Templates imported."
  );
});

newTemplateButton.addEventListener("click", async () => {
  const newTemplate = {
    id: generateTemplateId(),
    name: "New template",
    description: "",
    template: "Hi {{name}},\n\nThanks for reaching out about {{topic}}.",
    fields: []
  };
  state.templates.push(newTemplate);
  await saveState(state);
  applyTemplateSelection(newTemplate);
});

deleteTemplateButton.addEventListener("click", async () => {
  if (!currentTemplateId) {
    return;
  }
  const template = getTemplateById(currentTemplateId);
  const shouldDelete = window.confirm(
    `Delete template "${template?.name || currentTemplateId}"?`
  );
  if (!shouldDelete) {
    return;
  }
  const nextTemplates = state.templates.filter(
    (item) => item.id !== currentTemplateId
  );
  state.templates = nextTemplates;
  currentTemplateId = state.templates[0]?.id ?? null;
  state.activeTemplateId = currentTemplateId;
  await saveState(state);
  buildTemplateList();
  if (currentTemplateId) {
    applyTemplateSelection(getTemplateById(currentTemplateId));
  } else {
    promptTemplateInput.value = "";
    renderTemplateInputs(null);
    setDeleteButtonState();
  }
});

copyButton.addEventListener("click", handleCopy);
themeToggle.addEventListener("click", async () => {
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  state.theme = nextTheme;
  applyTheme(nextTheme);
  await saveState(state);
});

init();
