import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runFinalsStage } from '../server/finals-stage'

function fixture(t: { after: (fn: () => void) => void }) {
  const directory = mkdtempSync(join(tmpdir(), 'finals-stage-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  mkdirSync(join(directory, 'build/finals'), { recursive: true })
  writeFileSync(join(directory, 'index.html'), '<div></div>')
  return { root: process.cwd(), directory, manifest: join(directory, 'manifest.json'), stage: 'preview' as const }
}
test('preview failures include the actual browser error from the log', async t => {
  const f = fixture(t)
  writeFileSync(join(f.directory, 'build/finals/reel (preview).log'), 'Chrome cannot start: ETIMEDOUT')
  await assert.rejects(runFinalsStage({ ...f, run: async () => 'FAILED preview render reel' }), /Chrome cannot start: ETIMEDOUT/)
})
test('zero exit without a preview or with an empty preview fails', async t => {
  const f = fixture(t)
  await assert.rejects(runFinalsStage({ ...f, run: async () => '' }), /Không tạo được file/)
  writeFileSync(join(f.directory, 'build/finals/reel (preview).mp4'), '')
  await assert.rejects(runFinalsStage({ ...f, run: async () => '' }), /Không tạo được file/)
})
test('rerunning an old job cannot accept its stale preview', async t => {
  const f = fixture(t), file = join(f.directory, 'build/finals/reel (preview).mp4')
  writeFileSync(file, 'old')
  utimesSync(file, new Date(0), new Date(0))
  await assert.rejects(runFinalsStage({ ...f, run: async () => '' }), /bản dựng cũ/)
})
test('a current preview is accepted and final rendering disables the no-music pass', async t => {
  const f = fixture(t)
  for (const stage of ['preview', 'render'] as const) {
    const file = join(f.directory, 'build/finals', stage === 'preview' ? 'reel (preview).mp4' : 'reel.mp4')
    const output = await runFinalsStage({ ...f, stage, run: async (_command, args) => {
      assert.equal(args.includes('--no-nomusic'), stage === 'render')
      writeFileSync(file, 'new')
      return ''
    } })
    assert.equal(output, file)
  }
})
test('cancellation remains cancellation and subprocess failures keep their cause', async t => {
  const f = fixture(t), cancellation = new Error('stop'); cancellation.name = 'JobCancelledError'
  await assert.rejects(runFinalsStage({ ...f, run: async () => { throw cancellation } }), error => error === cancellation)
  await assert.rejects(runFinalsStage({ ...f, run: async () => { throw new Error('spawn uv ENOENT') } }), /spawn uv ENOENT/)
})
