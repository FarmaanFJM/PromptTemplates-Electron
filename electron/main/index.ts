import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import {
  loadTemplates,
  saveTemplates,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  saveFullState,
  importTemplates,
  exportTemplates,
  getDataFilePath,
} from './store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Lock the app name before any app.getPath() call so userData resolves consistently
app.setName('PromptTemplates')

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'PromptTemplates',
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ── IPC Handlers ──

ipcMain.handle('templates:load', () => loadTemplates())
ipcMain.handle('templates:save', (_, state) => { saveTemplates(state); return true })
ipcMain.handle('templates:list', () => listTemplates())
ipcMain.handle('templates:get', (_, id: string) => getTemplate(id))
ipcMain.handle('templates:create', (_, template) => createTemplate(template))
ipcMain.handle('templates:update', (_, id: string, patch) => updateTemplate(id, patch))
ipcMain.handle('templates:delete', (_, id: string) => deleteTemplate(id))
ipcMain.handle('templates:save-state', (_, state) => saveFullState(state))
ipcMain.handle('templates:import', (_, templates) => importTemplates(templates))
ipcMain.handle('templates:export', (_, ids: string[]) => exportTemplates(ids))
ipcMain.handle('templates:data-path', () => getDataFilePath())

// ── App lifecycle ──

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
