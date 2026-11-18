import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runtimeTarget, runtimePaths } from '../desktop/runtime-platform.mjs'

const manifest = JSON.parse(readFileSync(new URL('../desktop/runtime-manifest.json', import.meta.url)))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
for (const [platform, arch, browser] of [['win32', 'x64', 'win64'], ['darwin', 'arm64', 'mac_arm'], ['darwin', 'x64', 'mac']]) {
  test(`complete native runtime for ${platform}/${arch}`, () => {
    const target = runtimeTarget(manifest, platform, arch)
    const paths = runtimePaths(target, 'tools with spaces', 'user data')
    assert.equal(target.browserPlatform, browser)
    assert.equal(target.codexPackage, `@openai/codex-${platform}-${arch}`)
    assert.equal(paths.python, join('user data', 'venv', ...(platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python'])))
    assert.equal(paths.codexName, platform === 'win32' ? 'codex.exe' : 'codex')
    for (const item of target.downloads) {
      assert.match(item.url, /^https:\/\//)
      assert.match(item.sha256, /^[0-9a-f]{64}$/)
      if (platform === 'darwin') assert.ok(!item.executable.endsWith('.exe'))
    }
    const lock = readFileSync(new URL(`../desktop/${target.requirements}`, import.meta.url), 'utf8')
    for (const dependency of ['faster-whisper', 'onnxruntime', 'rembg', 'opencv-python-headless', 'numpy']) {
      assert.match(lock, new RegExp(`^${dependency}==`, 'm'))
    }
    assert.match(lock, /--hash=sha256:/)
  })
}
test('reject unsupported hosts instead of mixing native binaries', () => {
  assert.throws(() => runtimeTarget(manifest, 'linux', 'x64'), /Unsupported/)
  assert.throws(() => runtimeTarget(manifest, 'win32', 'arm64'), /Unsupported/)
})
test('Mac package retains FFprobe and uses an architecture-specific runtime', () => {
  assert.ok(!pkg.build.files.includes('!node_modules/ffprobe-static/bin/darwin/**'))
  assert.equal(pkg.build.extraResources[0].from, '.runtime/${platform}-${arch}')
  assert.match(pkg.build.mac.artifactName, /\$\{arch\}/)
  assert.equal(pkg.build.mac.minimumSystemVersion, '14.0')
})
