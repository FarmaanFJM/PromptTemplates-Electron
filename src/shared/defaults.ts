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

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'angular-commit-from-diff',
    name: 'Generate Angular Commit (from git diff)',
    description: 'Generate a strict Angular-style git commit message using ONLY a pasted git diff. Use git diff | clip to copy the diff to clipboard.',
    template:
      '## Task\n' +
      'Generate a Git commit message that strictly follows the Angular commit conventions.\n\n' +
      'Rules you MUST follow:\n' +
      '- Format:\n' +
      '  <type>(<scope>): <subject>\n' +
      '  \n' +
      '  <body>\n' +
      '  \n' +
      '  <footer>\n' +
      '- Scope is optional.\n' +
      '- Subject:\n' +
      '  - imperative, present tense\n' +
      '  - no capital first letter\n' +
      '  - no trailing period\n' +
      '- Wrap all lines to max 100 characters.\n' +
      '- Body explains motivation and contrasts previous behavior.\n' +
      '- Footer includes BREAKING CHANGE and/or issue references if applicable.\n' +
      '- Only include BREAKING CHANGE if the diff truly introduces one.\n' +
      '- Infer type and scope from the diff; do not guess wildly.\n\n' +
      'Allowed types:\n' +
      'feat, fix, docs, style, refactor, perf, test, chore\n\n' +
      '## Input (git diff)\n' +
      '{Diff}\n\n' +
      '## Output\n' +
      'Return ONLY the final commit message text.\n' +
      'Do NOT explain your reasoning.\n' +
      'Do NOT include markdown or code fences.\n' +
      'Do NOT mention the diff explicitly in the output.',
    fields: [],
  },
  {
    id: 'role-instruction-architect',
    name: 'Role Instruction (Architect / Functionality Author)',
    description: 'Direct a primary author to design and explain full, ordered batches.',
    template:
      'Role Instruction (Architect / Functionality Author)\n\nYou are the primary code author and functionality designer.\nYour responsibility is to design and generate correct, high-quality code and explain what files must be updated and how.\nIf the total output is large, do not reduce quality or decide to give other code in next prompt. Instead, divide the output into clear batches,\neach containing a list of complete files (never partial files). Always provide the recommended batch order (e.g. Batch 1, Batch 2, Batch 3) so the implementation agent can apply them sequentially without context overflow. Do not optimize for tool execution or minimal diffs\u2014optimize for clarity, correctness, and completeness.\n\n{ Task }\n\n',
    fields: [],
  },
  {
    id: 'role-instruction-executor',
    name: 'Role Instruction (Executor / Paster)',
    description: 'Strictly apply provided batches without inventing new behavior.',
    template:
      'Role Instruction (Executor / Paster)\n\nYou are an implementation-only agent.\nYour job is to apply code exactly as provided, file by file, in the specified batch order.\nYou are not allowed to invent functionality, refactor logic, or reinterpret intent.\nYou may only:\n\ncreate or overwrite files exactly as given\n\nfix obvious compiler errors (e.g. undefined types, missing imports) without changing runtime behavior\nIf anything is ambiguous or missing, stop and report it instead of guessing.\nYour goal is faithful application, not design.\n\n{ Task }\n\n',
    fields: [],
  },
  {
    id: 'role-instruction-reviewer',
    name: 'Role Instruction (Reviewer / QA)',
    description: 'Guide a reviewer to validate outputs for correctness and gaps.',
    template:
      'Role Instruction (Reviewer / QA)\n\nYou are responsible for reviewing the work before it ships.\nYou must validate correctness, completeness, and potential risks.\nProvide clear feedback grouped by severity and include steps to reproduce any issues.\nIf something is ambiguous, call it out explicitly and request clarification.\n\n{ Task }\n\n',
    fields: [],
  },
  {
    id: 'role-instruction-editor',
    name: 'Role Instruction (Editor / Clarity)',
    description: 'Focus on rewriting for clarity, tone, and user friendliness.',
    template:
      'Role Instruction (Editor / Clarity)\n\nYou improve wording for clarity, brevity, and tone without changing meaning.\nYou may reorder sections for flow, but keep the intent and required constraints intact.\nReturn the rewritten content plus a brief list of notable changes.\n\n{ Task }\n\n',
    fields: [],
  },
  {
    id: 'daily-standup',
    name: 'Daily Standup Update',
    description: 'Share progress, next steps, and blockers in a tight format.',
    template:
      '## Yesterday\n{Yesterday}\n\n## Today\n{Today}\n\n## Blockers\n{Blockers}\n\n## Help Needed\n{HelpNeeded}',
    fields: [],
  },
  {
    id: 'email-reply',
    name: 'Email Reply',
    description: 'Draft a clear, friendly response with action items.',
    template:
      '## Context\n{Context}\n\n## Recipient\n{{Recipient}}\n\n## Goal\n{Goal}\n\n## Key Points\n{KeyPoints}\n\n## Tone\n{{Tone}}\n\n## Draft Reply\n{Draft}',
    fields: [],
  },
  {
    id: 'meeting-recap',
    name: 'Meeting Recap',
    description: 'Summarize decisions and action items for follow-up.',
    template:
      '## Summary\n{Summary}\n\n## Decisions\n{Decisions}\n\n## Action Items\n{Actions}\n\n## Open Questions\n{Questions}',
    fields: [],
  },
  {
    id: 'task-planning',
    name: 'Task Planning',
    description: 'Break down a task with steps, owners, and deadlines.',
    template:
      '## Objective\n{Objective}\n\n## Steps\n{Steps}\n\n## Owners\n{Owners}\n\n## Due Dates\n{DueDates}\n\n## Risks\n{Risks}',
    fields: [],
  },
]

export const DEFAULT_STATE: AppState = {
  templates: DEFAULT_TEMPLATES,
  pinnedTemplatesByHost: {},
  theme: 'light',
  templateInputValues: {},
  activeTemplateId: null,
}
