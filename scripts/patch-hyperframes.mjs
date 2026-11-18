// Keep this compatibility patch reproducible in npm ci and release builds.
// Fail on upstream changes rather than silently shipping an unpatched build.
import { readFileSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pkg = join(root, 'node_modules/hyperframes')
const version = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version
if (version !== '0.8.159') throw new Error(`Recheck the Windows Chrome probe patch for HyperFrames ${version}`)
const dist = join(pkg, 'dist')
const candidates = readdirSync(dist).filter(name => name.endsWith('.js')).filter(name =>
  readFileSync(join(dist, name), 'utf8').includes('async function chromeLaunchOutcome('))
if (candidates.length !== 1) throw new Error('Cannot locate the HyperFrames Chrome preflight')
const path = join(dist, candidates[0])
const marker = '// AI Editor Studio: Windows headless Chrome preflight'
let source = readFileSync(path, 'utf8')
if (!source.includes(marker)) {
  const before = 'const { stdout } = await runCancellableProcess(executablePath, ["--version"], {'
  if (source.split(before).length !== 2) throw new Error('HyperFrames Chrome preflight changed; review the compatibility patch')
  source = `${marker}\nimport { probeWindowsChrome } from "./ai-editor-windows-chrome-probe.mjs";\n` + source.replace(before,
    'const { stdout } = process.platform === "win32" ? { stdout: await probeWindowsChrome(executablePath, signal) } : await runCancellableProcess(executablePath, ["--version"], {')
}
source = source.replace(' --version${details ? ` (${details})` : ""}.', '${process.platform === "win32" ? " (headless/CDP)" : " --version"}${details ? ` (${details})` : ""}.')
writeFileSync(path, source)
copyFileSync(join(root, 'scripts/lib/windows-chrome-probe.mjs'), join(dist, 'ai-editor-windows-chrome-probe.mjs'))
console.log(`HyperFrames ${version}: Windows headless Chrome preflight ready.`)
