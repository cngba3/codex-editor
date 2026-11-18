// Build-time only: no globally installed tools are needed on the customer's PC.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, access, writeFile, chmod } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { parseArgs } from 'node:util'
import { runtimeTarget } from '../desktop/runtime-platform.mjs'
const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(join(root, 'desktop/runtime-manifest.json'), 'utf8'))
const { values } = parseArgs({ options: { platform: { type: 'string', default: process.platform }, arch: { type: 'string', default: process.arch } } })
const target = runtimeTarget(manifest, values.platform, values.arch)
const runtime = join(root, '.runtime', target.key)
await mkdir(runtime, { recursive: true })
async function hash(file) {
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(file)) digest.update(chunk)
  return digest.digest('hex')
}
for (const item of target.downloads) {
  const zip = join(runtime, `${item.name}${item.url.endsWith('.zip') ? '.zip' : '.tar.gz'}`)
  if (await hash(zip).catch(() => '') !== item.sha256) {
    console.log(`Downloading ${item.url}`)
    const response = await fetch(item.url, { signal: AbortSignal.timeout(600_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${item.url}`)
    await pipeline(response.body, createWriteStream(zip))
    if (await hash(zip) !== item.sha256) throw new Error(`SHA256 mismatch: ${item.name}`)
  }
  const destination = join(runtime, item.name)
  const executable = join(destination, item.executable)
  const receiptPath = join(runtime, `${item.name}.verified.json`)
  const receipt = await readFile(receiptPath, 'utf8').then(JSON.parse).catch(() => ({}))
  const expectedBinary = item.binarySha256 || (receipt.archive === item.sha256 ? receipt.binary : undefined)
  if (expectedBinary && await hash(executable).catch(() => '') === expectedBinary) continue
  await mkdir(destination, { recursive: true })
  const result = item.url.endsWith('.zip')
    ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:AE_ARCHIVE -DestinationPath $env:AE_DESTINATION -Force"], {
      env: { ...process.env, AE_ARCHIVE: zip, AE_DESTINATION: destination }, stdio: 'inherit', windowsHide: true,
    })
    : spawnSync('tar', ['-xzf', zip, '-C', destination], { stdio: 'inherit' })
  if (result.error || result.status !== 0) throw result.error || new Error(`Cannot extract ${item.name}`)
  await access(executable)
  const binary = await hash(executable)
  if (item.binarySha256 && binary !== item.binarySha256) throw new Error(`Executable checksum mismatch: ${item.name}`)
  if (process.platform !== 'win32') await chmod(executable, 0o755)
  await writeFile(receiptPath, JSON.stringify({ archive: item.sha256, binary }))
}
const redist = join(runtime, 'vc_redist.x64.exe')
if (target.windows && await hash(redist).catch(() => '') !== manifest.vcRedist.sha256) {
  const response = await fetch(manifest.vcRedist.url, { signal: AbortSignal.timeout(600_000) })
  if (!response.ok) throw new Error(`Visual C++ download: HTTP ${response.status}`)
  await pipeline(response.body, createWriteStream(redist))
  if (await hash(redist) !== manifest.vcRedist.sha256) throw new Error('Visual C++ SHA256 mismatch')
}
await writeFile(join(runtime, 'target.json'), JSON.stringify({ key: target.key }))
console.log(`Verified ${target.key} runtime is ready for packaging.`)
