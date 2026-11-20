import { execFile, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type AgentProvider = 'codex' | 'antigravity'
export type AgentModel = { id: string; name: string }

type AgentSettings = {
  provider?: AgentProvider
  antigravityModel?: string
  antigravityLoggedOut?: boolean
}

export type AntigravityStatus = {
  installed: boolean
  connected: boolean
  detail: string
  models: AgentModel[]
  model: string
}

const settingsPath = join(process.cwd(), 'jobs', 'agent-settings.json')
let cachedModels: { at: number; models: AgentModel[]; detail: string } | null = null

function readSettings(): AgentSettings {
  try {
    const raw = JSON.parse(readFileSync(settingsPath, 'utf8')) as AgentSettings
    return {
      provider: raw.provider === 'antigravity' ? 'antigravity' : 'codex',
      antigravityModel: typeof raw.antigravityModel === 'string' ? raw.antigravityModel : '',
      antigravityLoggedOut: !!raw.antigravityLoggedOut,
    }
  } catch {
    return { provider: 'codex', antigravityModel: '', antigravityLoggedOut: false }
  }
}

function writeSettings(patch: Partial<AgentSettings>) {
  const next = { ...readSettings(), ...patch }
  mkdirSync(join(process.cwd(), 'jobs'), { recursive: true })
  writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function activeProvider(): AgentProvider {
  return readSettings().provider || 'codex'
}

export function saveActiveProvider(provider: AgentProvider) {
  if (provider !== 'codex' && provider !== 'antigravity') throw new Error('Agent không hợp lệ.')
  return writeSettings({ provider })
}

export function selectedAntigravityModel(): string {
  return readSettings().antigravityModel || ''
}

export function saveAntigravityModel(model: string) {
  if (model && !/^[a-z0-9][a-z0-9._-]*$/i.test(model)) throw new Error('Model Antigravity không hợp lệ.')
  return writeSettings({ antigravityModel: model })
}

export function agyExecutable(): string {
  const configured = process.env.AGY_BIN
  if (configured) return configured
  const local = join(homedir(), '.gemini', 'bin', process.platform === 'win32' ? 'agy.exe' : 'agy')
  if (existsSync(local)) return local
  return process.platform === 'win32' ? 'agy.exe' : 'agy'
}

function parseModels(stdout: string): AgentModel[] {
  const out: AgentModel[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || /^fetching\b/i.test(trimmed)) continue
    const tab = trimmed.indexOf('\t')
    if (tab > 0) {
      const id = trimmed.slice(0, tab).trim()
      const name = trimmed.slice(tab + 1).trim() || id
      if (/^[a-z0-9][a-z0-9._-]*$/i.test(id)) out.push({ id, name })
    }
  }
  return out
}

export async function antigravityStatus(force = false): Promise<AntigravityStatus> {
  const settings = readSettings()
  const bin = agyExecutable()
  if (bin.includes('\\') || bin.includes('/')) {
    if (!existsSync(bin)) {
      return { installed: false, connected: false, detail: 'Chưa tìm thấy Antigravity CLI (agy) trên máy.', models: [], model: settings.antigravityModel || '' }
    }
  }
  if (settings.antigravityLoggedOut && !force) {
    return { installed: true, connected: false, detail: 'Đã đăng xuất Antigravity trong ứng dụng.', models: [], model: settings.antigravityModel || '' }
  }
  if (!force && cachedModels && Date.now() - cachedModels.at < 60_000) {
    const connected = cachedModels.models.length > 0
    return { installed: true, connected, detail: cachedModels.detail, models: cachedModels.models, model: settings.antigravityModel || '' }
  }
  try {
    const { stdout, stderr } = await execFileAsync(bin, ['models'], { timeout: 15_000, windowsHide: true })
    const models = parseModels(stdout)
    const connected = models.length > 0
    const detail = connected
      ? `Đã kết nối Antigravity CLI (${models.length} model khả dụng).`
      : (`${stdout}${stderr}`.trim() || 'Antigravity chưa đăng nhập. Hãy đăng nhập để lấy danh sách model.')
    cachedModels = { at: Date.now(), models, detail }
    if (connected && settings.antigravityLoggedOut) writeSettings({ antigravityLoggedOut: false })
    return { installed: true, connected, detail, models, model: settings.antigravityModel || '' }
  } catch (error) {
    const failure = error as Error & { code?: string; stdout?: string; stderr?: string }
    if (failure.code === 'ENOENT') {
      return { installed: false, connected: false, detail: 'Chưa tìm thấy Antigravity CLI (agy) trên máy.', models: [], model: settings.antigravityModel || '' }
    }
    return {
      installed: true,
      connected: false,
      detail: `${failure.stderr || failure.stdout || failure.message}`.trim() || 'Antigravity chưa đăng nhập hoặc không phản hồi.',
      models: [],
      model: settings.antigravityModel || '',
    }
  }
}

export async function loginAntigravity(): Promise<{ connected?: boolean; started?: boolean; detail: string; status: AntigravityStatus }> {
  writeSettings({ antigravityLoggedOut: false })
  cachedModels = null
  const current = await antigravityStatus(true)
  if (!current.installed) throw new Error(current.detail)
  if (current.connected) {
    saveActiveProvider('antigravity')
    return { connected: true, detail: current.detail, status: current }
  }
  const bin = agyExecutable()
  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', 'start', '""', bin], { detached: true, stdio: 'ignore', windowsHide: false })
    child.unref()
  } else {
    const child = spawn(bin, [], { detached: true, stdio: 'ignore' })
    child.unref()
  }
  return { started: true, detail: 'Đã mở Antigravity CLI để đăng nhập Google. Hoàn tất đăng nhập rồi nhấn “Kiểm tra lại”.', status: current }
}

export function logoutAntigravity(): AntigravityStatus {
  cachedModels = null
  const next = writeSettings({ antigravityLoggedOut: true })
  return {
    installed: true,
    connected: false,
    detail: 'Đã đăng xuất Antigravity trong ứng dụng.',
    models: [],
    model: next.antigravityModel || '',
  }
}

export type TranslatedAgyInvocation = {
  command: string
  args: string[]
  cwd: string
  outPath: string
  hasSchema: boolean
  tempPromptFile?: string
}

export function translateCodexExecToAgy(
  codexArgs: string[],
  inputPrompt: string,
  model: string,
  fallbackCwd: string,
): TranslatedAgyInvocation {
  let cwd = fallbackCwd
  let schemaPath = ''
  let outPath = ''
  const images: string[] = []
  for (let i = 1; i < codexArgs.length; i++) {
    const flag = codexArgs[i]
    if (flag === '-C' && codexArgs[i + 1]) { cwd = codexArgs[++i]; continue }
    if (flag === '--output-schema' && codexArgs[i + 1]) { schemaPath = codexArgs[++i]; continue }
    if (flag === '-o' && codexArgs[i + 1]) { outPath = codexArgs[++i]; continue }
    if (flag === '-i' && codexArgs[i + 1]) { images.push(codexArgs[++i]); continue }
  }

  let fullPrompt = inputPrompt || ''
  if (images.length) {
    fullPrompt = `Attached image files to inspect first using read_file (in exact order):\n${images.map((img, idx) => `${idx + 1}. ${img}`).join('\n')}\n\n${fullPrompt}`
  }

  const agyArgs = ['--disable-slash-commands', '--output-format', 'json', '--dangerously-skip-permissions']
  if (model) agyArgs.push('--model', model)
  if (schemaPath) agyArgs.push('--json-schema', schemaPath)

  let tempPromptFile: string | undefined
  if (fullPrompt.length > 16_000) {
    mkdirSync(cwd, { recursive: true })
    tempPromptFile = join(cwd, `.agy-prompt-${randomBytes(4).toString('hex')}.txt`)
    writeFileSync(tempPromptFile, fullPrompt, 'utf8')
    agyArgs.push('--print', `Read the full instructions and input data in "${tempPromptFile}" using read_file, then follow them exactly and return ONLY the requested output.`)
  } else {
    agyArgs.push('--print', fullPrompt)
  }

  return { command: agyExecutable(), args: agyArgs, cwd, outPath, hasSchema: !!schemaPath, tempPromptFile }
}

export function finalizeAgyOutput(invocation: TranslatedAgyInvocation, rawStdout: string): string {
  if (invocation.tempPromptFile) {
    try { unlinkSync(invocation.tempPromptFile) } catch { /* best-effort cleanup */ }
  }
  const trimmed = rawStdout.trim()
  let parsed: { status?: string; response?: string; structured_output?: unknown; error?: string } | null = null
  const jsonStart = trimmed.indexOf('{')
  if (jsonStart >= 0) {
    try { parsed = JSON.parse(trimmed.slice(jsonStart)) } catch { parsed = null }
  }
  if (parsed?.status && parsed.status !== 'SUCCESS') {
    throw new Error(`Antigravity CLI trả về trạng thái ${parsed.status}: ${parsed.error || parsed.response || 'không rõ nguyên nhân'}`)
  }
  let text = ''
  if (invocation.hasSchema && parsed?.structured_output !== undefined) {
    text = JSON.stringify(parsed.structured_output, null, 2)
  } else if (typeof parsed?.response === 'string') {
    text = parsed.response.trim()
    if (invocation.hasSchema) {
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    }
  } else {
    text = trimmed
  }
  if (invocation.outPath) {
    writeFileSync(invocation.outPath, text, 'utf8')
  }
  return text
}
