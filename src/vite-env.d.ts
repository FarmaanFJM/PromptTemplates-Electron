/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  listTemplates(): Promise<import('./shared/defaults').AppState>
  getTemplate(id: string): Promise<import('./shared/defaults').Template | null>
  createTemplate(template: import('./shared/defaults').Template): Promise<import('./shared/defaults').AppState>
  updateTemplate(id: string, patch: Partial<import('./shared/defaults').Template>): Promise<import('./shared/defaults').AppState>
  deleteTemplate(id: string): Promise<import('./shared/defaults').AppState>
  saveState(state: import('./shared/defaults').AppState): Promise<import('./shared/defaults').AppState>
  importTemplates(templates: import('./shared/defaults').Template[]): Promise<import('./shared/defaults').AppState>
  exportTemplates(ids: string[]): Promise<import('./shared/defaults').Template[]>
  getDataPath(): Promise<string>
}

interface Window {
  electronAPI: ElectronAPI
}
