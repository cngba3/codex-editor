import { appendFileSync, existsSync } from 'node:fs'
import { cp, mkdir, readFile, writeFile, readdir, readlink, symlink, unlink, stat } from 'node:fs/promises'
import { join, dirname, delimiter, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { install, computeExecutablePath, Browser } from '@puppeteer/browsers'
import puppeteer from 'puppeteer-core'
import ffmpeg from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'
import { runtimeTarget, runtimePaths } from './runtime-platform.mjs'

export async function setupRuntime({ appRoot, toolsRoot, dataRoot, migrateLegacy = false, report = () => {}, signal }) {
  const manifest = JSON.parse(await readFile(join(appRoot, 'desktop/runtime-manifest.json'), 'utf8'))
  const target = runtimeTarget(manifest)
  // Separate native Python environments when switching Intel/Apple Silicon builds.
  const runtime = join(dataRoot, 'runtime', target.windows ? '' : target.key)
  const workspace = join(dataRoot, 'workspace')
  const logFile = join(dataRoot, 'setup.log')
  await mkdir(dataRoot, { recursive: true })
  if (await stat(logFile).then(s => s.size > 5_000_000).catch(() => false)) await writeFile(logFile, '')
  let stage = ''
  function log(message) {
    appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`)
    report({ stage, detail: message.slice(-4000), logFile })
  }
  function step(label, index) {
    signal?.throwIfAborted()
    stage = label
    report({ stage, index, total: 8, logFile })
    log(label)
  }
  const { node, uv, python, codexName } = runtimePaths(target, toolsRoot, runtime)
  const bundledTarget = JSON.parse(await readFile(join(toolsRoot, 'target.json'), 'utf8'))
  if (bundledTarget.key !== target.key) throw new Error(`Wrong runtime: ${bundledTarget.key}; this app needs ${target.key}.`)
  // Use the native official package, including its helper executables.
  async function findCodex(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name)
      if (entry.isFile() && entry.name === codexName) return file
      if (entry.isDirectory()) { const found = await findCodex(file); if (found) return found }
    }
  }
  const codex = await findCodex(join(appRoot, 'node_modules', target.codexPackage))
  if (!codex) throw new Error('Bộ cài thiếu Codex CLI. Hãy cài lại AI Editor Studio.')
  const browserOptions = { browser: Browser.CHROME, buildId: manifest.chrome, platform: target.browserPlatform, cacheDir: join(runtime, 'browser') }
  const chrome = computeExecutablePath(browserOptions)
  const env = {
    ...process.env,
    PATH: [dirname(node), dirname(uv), dirname(codex), join(dirname(codex), '..', 'codex-path'), dirname(python), dirname(ffmpeg), dirname(ffprobe.path), process.env.PATH || ''].join(delimiter),
    CODEX_BIN: codex, AI_EDITOR_NODE: node, AI_EDITOR_PYTHON: python,
    MEDIA_PY: python, PYTHONUTF8: '1', PYTHONUNBUFFERED: '1',
    UV_PYTHON_INSTALL_DIR: join(runtime, 'python'), UV_CACHE_DIR: join(runtime, 'uv-cache'),
    UV_PYTHON_BIN_DIR: join(runtime, 'python-bin'), UV_NO_CONFIG: '1', UV_PYTHON_PREFERENCE: 'only-managed',
    U2NET_HOME: join(runtime, 'models', 'rembg'), HF_HOME: join(runtime, 'models', 'huggingface'),
    HYPERFRAMES_BROWSER_PATH: chrome, CHROME_PATH: chrome,
    HYPERFRAMES_CLI_PATH: join(appRoot, 'node_modules/hyperframes/bin/hyperframes.mjs'),
    HYPERFRAMES_FFMPEG_PATH: ffmpeg,
    AE_VCREDIST: join(toolsRoot, 'vc_redist.x64.exe'),
  }
  delete env.ELECTRON_RUN_AS_NODE
  // Never inherit a developer's virtualenv or Python module search path.
  delete env.VIRTUAL_ENV
  delete env.PYTHONHOME
  delete env.PYTHONPATH
  async function run(command, args, timeout = 30 * 60_000) {
    signal?.throwIfAborted()
    log(`> ${command} ${args.join(' ')}`)
    return new Promise((fulfil, reject) => {
      let tail = ''
      let timedOut = false
      const started = Date.now()
      const child = spawn(command, args, { cwd: workspace, env, detached: !target.windows, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      const stop = () => {
        if (!child.pid) return
        if (!target.windows) {
          try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill('SIGKILL') }
          return
        }
        const kill = spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
        kill.on('error', () => child.kill())
      }
      const timer = setTimeout(() => { timedOut = true; stop() }, timeout)
      const heartbeat = setInterval(() => report({ stage, detail: `${tail.slice(-2000)}\nĐang xử lý · ${Math.round((Date.now() - started) / 1000)} giây`, logFile }), 15_000)
      signal?.addEventListener('abort', stop, { once: true })
      const cleanup = () => { clearTimeout(timer); clearInterval(heartbeat); signal?.removeEventListener('abort', stop) }
      const output = chunk => { const value = chunk.toString('utf8'); tail = (tail + value).slice(-6000); log(value.trimEnd()) }
      child.stdout.on('data', output)
      child.stderr.on('data', output)
      child.once('error', error => { cleanup(); reject(error) })
      child.once('close', code => {
        cleanup()
        if (signal?.aborted) reject(signal.reason)
        else if (timedOut) reject(new Error(`${stage}: quá thời gian chờ. Có thể thử lại.\n${tail}`))
        else if (code !== 0) reject(new Error(`${stage}: mã lỗi ${code}\n${tail}`))
        else fulfil(tail)
      })
    })
  }
  step('Chuẩn bị thư mục và công cụ', 1)
  await mkdir(workspace, { recursive: true })
  await mkdir(runtime, { recursive: true })
  // Keep writable jobs/models outside the installation directory, including Program Files.
  for (const folder of ['server', 'ghost-editor', 'assets', 'public']) {
    if (existsSync(join(appRoot, folder))) await cp(join(appRoot, folder), join(workspace, folder), { recursive: true, force: true,
      filter: source => !source.split(/[\\/]/).some(part => ['.git', '__pycache__', '.cache', '.git.local-backup'].includes(part)) })
  }
  const modules = join(workspace, 'node_modules')
  const modulesTarget = join(appRoot, 'node_modules')
  const previous = await readlink(modules).catch(() => null)
  if (previous && resolve(dirname(modules), previous) !== resolve(modulesTarget)) await unlink(modules)
  if (!existsSync(modules)) await symlink(modulesTarget, modules, target.windows ? 'junction' : 'dir')
  // Preserve jobs and downloaded ASR models from the previous desktop layout.
  if (migrateLegacy && !existsSync(join(dataRoot, 'migrated-v1'))) {
    for (const folder of ['jobs', '.cache/faster-whisper-small', '.cache/faster-whisper-medium', '.cache/faster-whisper-tiny']) {
      if (existsSync(join(appRoot, folder))) await cp(join(appRoot, folder), join(workspace, folder), { recursive: true, force: false, errorOnExist: false })
    }
    await writeFile(join(dataRoot, 'migrated-v1'), 'done')
  }
  await run(node, ['--version'])
  await run(uv, ['--version'])
  await run(codex, ['--version'])
  await run(ffmpeg, ['-version'])
  await run(ffprobe.path, ['-version'])
  const system = join(process.env.SystemRoot || 'C:\\Windows', 'System32')
  if (target.windows && ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'].some(file => !existsSync(join(system, file)))) {
    log('Cài Microsoft Visual C++ Runtime. Vui lòng chấp nhận hộp thoại của Windows nếu được yêu cầu.')
    await run(join(system, 'WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference='Stop'; $installer=Start-Process -FilePath $env:AE_VCREDIST -ArgumentList '/install','/quiet','/norestart' -Verb RunAs -WindowStyle Hidden -Wait -PassThru; if ($installer.ExitCode -notin @(0,3010,1638)) { exit $installer.ExitCode }"])
  }

  step('Cài Python và thư viện xử lý video', 2)
  const requirements = join(appRoot, 'desktop', target.requirements)
  const signature = createHash('sha256').update(await readFile(requirements)).update(await readFile(join(appRoot, 'desktop/setup-models.py'))).update(JSON.stringify(manifest)).digest('hex')
  const marker = join(runtime, 'ready.json')
  const previousState = await readFile(marker, 'utf8').then(value => JSON.parse(value)).catch(() => ({}))
  const imports = ['-c', 'import importlib\nfor name in ["faster_whisper", "numpy", "cv2", "PIL", "fontTools", "brotli", "rembg", "onnxruntime"]:\n print("Checking " + name, flush=True)\n importlib.import_module(name)\nprint("Python libraries OK", flush=True)']
  const pythonSignature = createHash('sha256').update(await readFile(requirements)).update(manifest.python).update(target.key).digest('hex')
  const pythonMarker = join(runtime, 'python-ready.txt')
  const installedSignature = await readFile(pythonMarker, 'utf8').catch(() => '')
  let pythonReady = false
  let repairPython = false
  if (existsSync(python) && installedSignature === pythonSignature) {
    try {
      await run(python, ['-c', 'import importlib.util\nfor name in ["faster_whisper", "numpy", "cv2", "PIL", "fontTools", "brotli", "rembg", "onnxruntime"]:\n assert importlib.util.find_spec(name), "Missing package: " + name\nprint("Python environment OK")'], 60_000)
      pythonReady = true
    } catch { repairPython = true; log('Sửa lại môi trường Python.') }
  }
  if (!pythonReady) {
    await run(uv, ['python', 'install', manifest.python, '--no-bin', ...(target.windows ? ['--no-registry'] : [])])
    if (!existsSync(python)) await run(uv, ['venv', '--python', manifest.python, join(runtime, 'venv')])
    await run(uv, ['pip', 'sync', '--python', python, '--require-hashes', '--only-binary', ':all:', ...(repairPython ? ['--reinstall'] : []), requirements])
    await run(python, imports, 600_000)
    await writeFile(pythonMarker, pythonSignature)
  }

  const modelFiles = [
    ...['config.json', 'tokenizer.json', 'vocabulary.txt', 'model.bin'].map(file => join(workspace, '.cache/faster-whisper-small', file)),
    join(workspace, 'ghost-editor/library/models/face_detection_yunet_2023mar.onnx'),
    join(env.U2NET_HOME, 'models/birefnet-portrait/birefnet-portrait.onnx'),
  ]
  const modelInventory = () => Promise.all(modelFiles.map(async file => {
    const info = await stat(file).catch(() => null)
    return info && info.size > 0 ? { file, size: info.size, modified: info.mtimeMs } : null
  }))
  const inventory = await modelInventory()
  const modelsReady = previousState.signature === signature && inventory.every(Boolean) && JSON.stringify(inventory) === JSON.stringify(previousState.models)
  step('Kiểm tra model nhận dạng giọng nói', 3)
  if (!modelsReady) await run(python, [join(appRoot, 'desktop/setup-models.py'), 'asr'], 60 * 60_000)

  step('Tải model khuôn mặt và tách nền', 4)
  if (!modelsReady) await run(python, [join(appRoot, 'desktop/setup-models.py'), 'vision'], 60 * 60_000)

  step('Chuẩn bị trình duyệt dựng video', 5)
  if (!existsSync(chrome)) {
    let last = 0
    await install({ ...browserOptions, downloadProgressCallback: (done, total) => {
      if (Date.now() - last > 1000) { last = Date.now(); log(`Chromium: ${Math.round(done / 1048576)} / ${Math.round(total / 1048576)} MB`) }
    } })
  }
  signal?.throwIfAborted()
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, timeout: 60_000 })
  try { const page = await browser.newPage(); await page.setContent('<h1>AI Editor Studio</h1>'); await page.screenshot() } finally { await browser.close() }

  step('Chuẩn bị âm thanh và nhạc nền', 6)
  const mediaIds = []
  for (const type of ['sfx', 'music']) {
    const media = JSON.parse(await readFile(join(workspace, `ghost-editor/library/${type}/manifest.json`), 'utf8'))
    for (const [id, item] of Object.entries(media)) {
      if (!existsSync(join(workspace, 'ghost-editor/library', type, item.file))) mediaIds.push(id)
    }
  }
  if (mediaIds.length) await run(node, [join(appRoot, 'server/restore-media.mjs'), ...mediaIds], 60 * 60_000)

  step('Chuẩn bị phông chữ và hiệu ứng', 7)
  await run(node, [join(appRoot, 'server/recipe-fonts.mjs'), join(workspace, '.cache/font-preview')])

  step('Kiểm tra môi trường hoàn tất', 8)
  await run(python, [join(appRoot, 'desktop/setup-models.py'), 'check'])
  await writeFile(marker, JSON.stringify({ signature, models: await modelInventory(), completedAt: new Date().toISOString() }))
  log('Môi trường đã sẵn sàng.')
  return { workspace, env, logFile }
}
