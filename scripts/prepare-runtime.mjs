// Build-time only: no globally installed tools are needed on the customer's PC.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, access } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(join(root, 'desktop/runtime-manifest.json'), 'utf8'))
const runtime = join(root, '.runtime')
await mkdir(runtime, { recursive: true })
async function hash(file) {
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(file)) digest.update(chunk)
  return digest.digest('hex')
}
for (const item of manifest.downloads) {
  const zip = join(runtime, `${item.name}.zip`)
  if (await hash(zip).catch(() => '') !== item.sha256) {
    console.log(`Downloading ${item.url}`)
    const response = await fetch(item.url, { signal: AbortSignal.timeout(600_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${item.url}`)
    await pipeline(response.body, createWriteStream(zip))
    if (await hash(zip) !== item.sha256) throw new Error(`SHA256 mismatch: ${item.name}`)
  }
  const destination = join(runtime, item.name)
  if (await hash(join(destination, item.executable)).catch(() => '') === item.binarySha256) continue
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:AE_ARCHIVE -DestinationPath $env:AE_DESTINATION -Force"], {
    env: { ...process.env, AE_ARCHIVE: zip, AE_DESTINATION: destination }, stdio: 'inherit', windowsHide: true,
  })
  if (result.error || result.status !== 0) throw result.error || new Error(`Cannot extract ${item.name}`)
  await access(join(destination, item.executable))
  if (await hash(join(destination, item.executable)) !== item.binarySha256) throw new Error(`Executable checksum mismatch: ${item.name}`)
}
console.log('Verified Windows runtime is ready for packaging.')
const redist = join(runtime, 'vc_redist.x64.exe')
if (await hash(redist).catch(() => '') !== manifest.vcRedist.sha256) {
  const response = await fetch(manifest.vcRedist.url, { signal: AbortSignal.timeout(600_000) })
  if (!response.ok) throw new Error(`Visual C++ download: HTTP ${response.status}`)
  await pipeline(response.body, createWriteStream(redist))
  if (await hash(redist) !== manifest.vcRedist.sha256) throw new Error('Visual C++ SHA256 mismatch')
}
