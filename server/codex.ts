import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
let loginRunning = false

function codexExecutable() {
  const configured = process.env.CODEX_BIN
  if (configured) return configured
  if (process.platform === 'win32') {
    const standard = join(process.env.LOCALAPPDATA || '', 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe')
    if (existsSync(standard)) return standard
    return 'codex.exe'
  }
  return 'codex'
}

async function status() {
  try {
    const { stdout, stderr } = await execFileAsync(codexExecutable(), ['login', 'status'], { timeout: 8000, windowsHide: true })
    const detail = `${stdout}${stderr}`.trim()
    return { installed: true, connected: /logged in/i.test(detail), detail: detail || 'Không xác định được phiên đăng nhập.' }
  } catch (error) {
    const failure = error as Error & { code?: string; stdout?: string; stderr?: string }
    if (failure.code === 'ENOENT') return { installed: false, connected: false, detail: 'Chưa tìm thấy Codex CLI trên máy.' }
    return { installed: true, connected: false, detail: `${failure.stdout || ''}${failure.stderr || ''}`.trim() || 'Codex chưa đăng nhập hoặc không phản hồi.' }
  }
}

function send(response: ServerResponse, code: number, data: unknown) {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(data))
}

function safeOrigin(request: IncomingMessage) {
  const origin = request.headers.origin
  if (!origin) return false
  try {
    const url = new URL(origin)
    return url.hostname === '127.0.0.1' && (url.port === '5173' || url.port === '4173')
  } catch { return false }
}

export async function codexApi(request: IncomingMessage, response: ServerResponse, next: () => void) {
  const path = request.url?.split('?')[0]
  if (path === '/api/codex/status' && request.method === 'GET') {
    send(response, 200, await status())
    return
  }
  if (path === '/api/codex/login' && request.method === 'POST') {
    if (!safeOrigin(request) || !request.headers['content-type']?.startsWith('application/json')) { send(response, 403, { error: 'Yêu cầu không hợp lệ.' }); return }
    const auth = await status()
    if (!auth.installed) { send(response, 404, { error: auth.detail }); return }
    if (auth.connected) { send(response, 200, { connected: true, detail: auth.detail }); return }
    if (loginRunning) { send(response, 200, { started: true, detail: 'Đang chờ đăng nhập trong trình duyệt.' }); return }
    try {
      const child = spawn(codexExecutable(), ['login'], { detached: true, stdio: 'ignore', windowsHide: true })
      await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject) })
      loginRunning = true
      child.once('exit', () => { loginRunning = false })
      child.unref()
      send(response, 200, { started: true, detail: 'Codex đã mở trang đăng nhập trong trình duyệt.' })
    } catch (error) {
      send(response, 502, { error: error instanceof Error ? error.message : 'Không mở được đăng nhập Codex.' })
    }
    return
  }
  next()
}
