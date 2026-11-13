import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cutWords } from '../server/native-pipeline'
import { saveStyleRecipe } from '../server/recipe-contract'
import { saveReferenceStyle, type StoredReferenceStyle } from '../server/reference-style'
import { finishRecipe } from '../server/recipe-quality'

test('native captions map source words onto frame-rounded edit cuts', () => {
  const words = { segments: [{ start: 0, end: 10, text: '', words: [{ word: 'Một', start: 1.05, end: 1.3 }, { word: 'hai', start: 4.2, end: 4.4 }, { word: 'bỏ', start: 3, end: 3.4 }] }] }
  const mapped = cutWords(words, [{ a: 1, b: 1.52 }, { a: 4, b: 4.71 }])
  assert.equal(mapped.segments[0].end, 16 / 30)
  assert.equal(mapped.segments[1].words[0].word, 'hai')
  assert.ok(Math.abs(mapped.segments[1].words[0].start - (16 / 30 + .2)) < 1e-9)
  assert.equal(mapped.segments.flatMap(s => s.words).length, 2)
  assert.throws(() => cutWords({ segments: [] }, [{ a: 0, b: 2 }]), /timestamp/)
})

test('reference styles persist a real recipe and revisions change its fingerprint', () => {
  const root = mkdtempSync(join(tmpdir(), 'recipe-contract-')), styles = join(root, 'styles')
  mkdirSync(styles); writeFileSync(join(styles, 'clean.json'), '{}')
  const style = { id: 'ref-12345678', name: 'Test', about: '', basePreset: 'clean', study: { visualRules: 'Chữ trên đầu', motionRules: 'Nhấn khi nói', soundRules: 'Nhạc nhẹ', editRules: 'Mở bằng câu hỏi', assetRules: 'Ảnh đúng câu', recipeChecks: ['Không che mắt'], limitations: 'Âm thanh chưa xác định' } } as StoredReferenceStyle
  saveReferenceStyle(styles, style)
  const first = JSON.parse(readFileSync(join(root, 'style-recipes/ref-12345678.json'), 'utf8'))
  assert.equal(first.rules.editorial, 'Mở bằng câu hỏi')
  assert.ok(first.checks.includes('Không che mắt'))
  assert.equal(first.fingerprint, saveStyleRecipe(root, style.id).fingerprint)
  style.study.motionRules = 'Cắt thẳng'
  saveReferenceStyle(styles, style)
  assert.notEqual(first.fingerprint, saveStyleRecipe(root, style.id).fingerprint)
  assert.throws(() => saveStyleRecipe(root, '../secrets'), /không hợp lệ/)
})

test('failed visual QA causes a rebuild and cannot be delivered after three failures', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'recipe-quality-')); mkdirSync(join(directory, 'build'))
  const recipe = saveStyleRecipe(process.cwd() + '/ghost-editor', 'amber-talk')
  let builds = 0
  const job = { stage: '', progress: 0 }
  const runner = async (_command: string, args: string[]) => {
    const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : args.includes('-o') ? args[args.indexOf('-o') + 1] : ''
    if (out.endsWith('.json')) writeFileSync(out, JSON.stringify(out.includes('review') ? { passed: false, notes: 'Chữ che mặt' } : { summary: { status: 'pass' }, checks: [] }))
    if (args.at(-1)?.endsWith('reel-normalized.mp4')) writeFileSync(args.at(-1)!, 'fake video')
    return ''
  }
  await assert.rejects(() => finishRecipe({ root: process.cwd(), directory, recipe, run: runner, ffmpeg: 'ffmpeg', codex: 'codex', job, build: async (_round, feedback) => {
    if (builds) assert.match(feedback, /Chữ che mặt/)
    builds++; writeFileSync(join(directory, 'index.html'), '<div data-composition-id="main" data-duration="10"></div>')
  } }), /3 vòng/)
  assert.equal(builds, 3)
})
