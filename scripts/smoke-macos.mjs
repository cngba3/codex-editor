// Run on a native Mac runner after packaging. No user account or global tools.
import { spawn } from 'node:child_process'
import { access, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { openSync, constants } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { once } from 'node:events'
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'
import { Browser, computeExecutablePath } from '@puppeteer/browsers'
import { runtimeTarget, runtimePaths } from '../desktop/runtime-platform.mjs'

assert.equal(process.platform, 'darwin', 'Run this acceptance check on macOS')
const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(join(root, 'desktop/runtime-manifest.json'), 'utf8'))
const target = runtimeTarget(manifest)
const bundle = join(root, 'release', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'AI Editor Studio.app')
const resources = join(bundle, 'Contents/Resources')
const appRoot = join(resources, 'app')
const dataRoot = join(root, '.cache/mac-smoke')
const runtime = join(dataRoot, 'runtime', target.key)
const tools = runtimePaths(target, join(resources, 'runtime'), runtime)
const ffmpeg = join(appRoot, 'node_modules/ffmpeg-static/ffmpeg')
const ffprobe = join(appRoot, 'node_modules/ffprobe-static/bin/darwin', process.arch, 'ffprobe')
await mkdir(dataRoot, { recursive: true })
await mkdir(join(dataRoot, 'codex-empty'), { recursive: true })
const log = openSync(join(root, '.cache/mac-smoke.log'), 'a')
const env = { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', AI_EDITOR_DATA_DIR: dataRoot,
  CODEX_HOME: join(dataRoot, 'codex-empty'), PYTHONUTF8: '1', DO_NOT_TRACK: '1' }
delete env.ELECTRON_RUN_AS_NODE
for (const file of [tools.node, tools.uv, ffmpeg, ffprobe]) await access(file, constants.X_OK)
let appProcess, browser
const delay = ms => new Promise(done => setTimeout(done, ms))
async function startApp(offline = false) {
  appProcess = spawn(join(bundle, 'Contents/MacOS/AI Editor Studio'),
    ['--remote-debugging-port=9226', '--remote-debugging-address=127.0.0.1'], {
      env: { ...env, ...(offline ? { HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', NODE_USE_ENV_PROXY: '1' } : {}) },
      detached: true, stdio: ['ignore', log, log],
    })
  let launchError
  appProcess.on('error', error => { launchError = error })
  for (let attempt = 0; attempt < 60; attempt++) {
    if (launchError) throw launchError
    if (appProcess.exitCode !== null) throw new Error(`App exited before setup: ${appProcess.exitCode}`)
    try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9226' }); break } catch { await delay(1000) }
  }
  assert.ok(browser, 'Packaged app must expose its test debugger')
  let lastStage = ''
  const deadline = Date.now() + (offline ? 120_000 : 30 * 60_000)
  while (Date.now() < deadline) {
    for (const page of await browser.pages()) {
      if (page.url() === 'http://127.0.0.1:4173/') {
        await page.waitForSelector('#root > *')
        await page.screenshot({ path: join(dataRoot, offline ? 'cached.png' : 'studio.png') })
        const status = await fetch('http://127.0.0.1:4173/api/codex/status').then(response => response.json())
        assert.equal(status.installed, true)
        assert.equal(status.connected, false)
        return
      }
      if (page.url().endsWith('/desktop/setup.html')) {
        const state = await page.evaluate(() => ({ stage: document.querySelector('#stage')?.textContent, error: document.querySelector('#error')?.textContent }))
        if (state.stage !== lastStage) { console.log(state.stage); lastStage = state.stage }
        if (state.error) {
          await page.screenshot({ path: join(dataRoot, 'setup-error.png') })
          throw new Error(state.error)
        }
      }
    }
    await delay(1000)
  }
  throw new Error('Setup did not complete before the acceptance-test deadline')
}
async function stopApp() {
  if (browser) { await browser.close().catch(() => {}); browser = undefined }
  if (appProcess && appProcess.exitCode === null) {
    await Promise.race([once(appProcess, 'exit'), delay(5000)])
    if (appProcess.exitCode === null) { try { process.kill(-appProcess.pid, 'SIGKILL') } catch { /* already stopped */ } }
  }
}
async function run(command, args, cwd, childEnv) {
  console.log(`Checking: ${command} ${args.join(' ')}`)
  const child = spawn(command, args, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  const timer = setTimeout(() => child.kill('SIGKILL'), 300_000)
  try { const [code] = await once(child, 'exit'); assert.equal(code, 0, 'Native runtime command failed') } finally { clearTimeout(timer) }
}
try {
  await startApp()
  const workspace = join(dataRoot, 'workspace')
  const childEnv = { ...env, PATH: [dirname(tools.node), dirname(ffmpeg), dirname(ffprobe), env.PATH].join(':'),
    HYPERFRAMES_FFMPEG_PATH: ffmpeg,
    HYPERFRAMES_BROWSER_PATH: computeExecutablePath({ browser: Browser.CHROME, buildId: manifest.chrome, platform: target.browserPlatform, cacheDir: join(runtime, 'browser') }),
  }
  await run(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '1', 'smoke.wav'], workspace, childEnv)
  await run(tools.python, [join(workspace, 'server/transcribe.py'), 'smoke.wav', 'smoke.json'], workspace, childEnv)
  assert.equal(JSON.parse(await readFile(join(workspace, 'smoke.json'), 'utf8')).model, 'small')
  const project = join(dataRoot, 'render')
  await mkdir(project, { recursive: true })
  await copyFile(join(workspace, '.cache/recipe-fonts/gsap-3.14.2.min.js'), join(project, 'gsap.js'))
  await writeFile(join(project, 'index.html'), `<!doctype html><html><head><script src="gsap.js"></script><style>body{margin:0;background:#101318}#root{position:relative;width:100%;height:100%;overflow:hidden}.clip{position:absolute;inset:0}#box{position:absolute;left:80px;top:80px;width:80px;height:80px;background:#94d7ba}</style></head><body><div id="root" data-composition-id="main" data-width="320" data-height="240" data-duration="1"><section class="clip" data-start="0" data-duration="1"><div id="box"></div></section></div><script>const tl=gsap.timeline({paused:true});tl.to('#box',{x:80,duration:1,ease:'none'},0);window.__timelines['main']=tl;</script></body></html>`)
  const cli = join(appRoot, 'node_modules/hyperframes/bin/hyperframes.mjs')
  await run(tools.node, [cli, 'check', project, '--json'], project, childEnv)
  await run(tools.node, [cli, 'render', project, '--quality', 'draft', '--output', join(project, 'output.mp4')], project, childEnv)
  await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', join(project, 'output.mp4')], project, childEnv)
  await stopApp()
  await startApp(true)
  console.log(`PASS: native ${target.key}, first-run setup, signed-out Codex, ASR, MP4 and cached startup`)
} finally { await stopApp() }
