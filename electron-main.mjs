import { app, BrowserWindow, dialog } from 'electron'
import { resolve } from 'node:path'
import { preview } from 'vite'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

let window
let server

async function createWindow() {
  if (window || !server) return
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#101318',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.loadURL('http://127.0.0.1:4173/')
  window.on('closed', () => { window = undefined })
}

if (gotLock) {
  app.on('second-instance', () => {
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  app.whenReady().then(async () => {
    try {
      // The backend resolves its bundled scripts and media relative to cwd.
      process.chdir(app.getAppPath())
      const root = app.getAppPath()
      server = await preview({
        root,
        configFile: resolve(root, 'vite.config.ts'),
        preview: { host: '127.0.0.1', port: 4173, strictPort: true },
      })
      await createWindow()
    } catch (error) {
      dialog.showErrorBox('Không thể mở AI Editor Studio', error instanceof Error ? error.message : String(error))
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })

  app.on('before-quit', () => {
    void server?.close()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
