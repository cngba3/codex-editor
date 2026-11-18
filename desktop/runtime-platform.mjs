import { join } from 'node:path'

export function runtimeTarget(manifest, platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`
  const target = manifest.targets[key]
  if (!target) throw new Error(`Unsupported desktop platform: ${key}. Use Windows x64 or macOS x64/arm64.`)
  return { ...target, key, platform, arch, windows: platform === 'win32' }
}

export function runtimePaths(target, toolsRoot, runtime) {
  return {
    node: join(toolsRoot, 'node', target.downloads.find(item => item.name === 'node').executable),
    uv: join(toolsRoot, 'uv', target.downloads.find(item => item.name === 'uv').executable),
    python: join(runtime, 'venv', ...(target.windows ? ['Scripts', 'python.exe'] : ['bin', 'python'])),
    codexName: target.windows ? 'codex.exe' : 'codex',
  }
}
