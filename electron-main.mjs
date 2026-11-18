import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { resolve } from 'node:path'
import { appendFileSync, mkdirSync } from 'node:fs'
import { setupRuntime } from './desktop/setup-runtime.mjs'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

let window
let server
let setupWindow
let settingUp = false
let setupState = {}
const setupAbort = new AbortController()
const dataRoot = process.env.AI_EDITOR_DATA_DIR || app.getPath('userData')
const logFile = resolve(dataRoot, 'setup.log')

function report(state) {
  setupState = { ...setupState, ...state }
  if (setupWindow && !setupWindow.isDestroyed()) setupWindow.webContents.send('setup:state', setupState)
}

async function initialize() {
  if (settingUp || setupAbort.signal.aborted) return
  settingUp = true
  report({ error: '', detail: '', stage: 'Đang kiểm tra môi trường…' })
  try {
    const root = app.getAppPath()
    const result = await setupRuntime({ appRoot: root,
      toolsRoot: app.isPackaged ? resolve(process.resourcesPath, 'runtime') : resolve(root, '.runtime'),
      dataRoot, migrateLegacy: app.isPackaged, report, signal: setupAbort.signal,
    })
    setupAbort.signal.throwIfAborted()
    Object.assign(process.env, result.env)
    process.chdir(result.workspace)
    // Import the backend only after configuring its paths and private runtime.
    const { preview } = await import('vite')
    const { codexApi, jobsApi } = await import('./dist-server/api.mjs')
    server = await preview({ root, configFile: false, cacheDir: resolve(dataRoot, 'vite-cache'),
      css: { postcss: { plugins: [] } },
      plugins: [{ name: 'desktop-api', configurePreviewServer(previewServer) {
        previewServer.middlewares.use(codexApi)
        previewServer.middlewares.use(jobsApi)
      } }],
      preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    })
    await createWindow()
    setupWindow?.close()
    setupWindow = undefined
  } catch (error) {
    if (setupAbort.signal.aborted) return
    if (server) { await server.close(); server = undefined }
    if (window) { window.close(); window = undefined }
    const message = error instanceof Error ? error.message : String(error)
    mkdirSync(dataRoot, { recursive: true })
    appendFileSync(logFile, `${new Date().toISOString()} ERROR ${error?.stack || message}\n`)
    report({ error: message, logFile })
  } finally { settingUp = false }
}

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
  window.on('closed', () => { window = undefined })
  await window.loadURL('http://127.0.0.1:4173/')
}

if (gotLock) {
  app.on('second-instance', () => {
    const active = window || setupWindow
    if (!active) return
    if (active.isMinimized()) active.restore()
    active.focus()
  })

  app.whenReady().then(async () => {
    setupWindow = new BrowserWindow({ width: 800, height: 740, backgroundColor: '#101318',
      webPreferences: { preload: resolve(app.getAppPath(), 'desktop/setup-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    const fromSetup = event => setupWindow && !setupWindow.isDestroyed() && event.sender === setupWindow.webContents
    ipcMain.on('setup:subscribe', event => { if (fromSetup(event)) report(setupState) })
    ipcMain.on('setup:retry', event => { if (fromSetup(event)) void initialize() })
    ipcMain.on('setup:log', event => { if (fromSetup(event)) void shell.openPath(logFile) })
    await setupWindow.loadFile(resolve(app.getAppPath(), 'desktop/setup.html'))
    void initialize()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })

  app.on('before-quit', () => {
    setupAbort.abort(new Error('Ứng dụng đã đóng; mở lại để tiếp tục thiết lập.'))
    void server?.close()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
