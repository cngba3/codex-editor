import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cutWords } from '../server/native-pipeline'
import { saveStyleRecipe } from '../server/recipe-contract'
import { saveReferenceStyle, type StoredReferenceStyle } from '../server/reference-style'
import { finishRecipe } from '../server/recipe-quality'
import { alignTakeEdges, speechCandidates } from '../server/speech-edit'
import { buildPopBeats } from '../server/pop-layout'
import { readTaste, recordFeedback, tastePrompt } from '../server/taste-memory'
import { chooseMusic } from '../server/sound-direction'

test('speech planning detects repeated takes and protects word boundaries', () => {
  const segments = [{ start: 0, end: 5, text: 'Xin chào bạn. Xin chào bạn.', words: [
    { word: 'Xin', start: .1, end: .3 }, { word: 'chào', start: .3, end: .6 }, { word: 'bạn.', start: .6, end: .9 },
    { word: 'Xin', start: 2.1, end: 2.3 }, { word: 'chào', start: 2.3, end: 2.6 }, { word: 'bạn.', start: 2.6, end: 2.9 },
  ] }]
  const result = speechCandidates(segments)
  assert.deepEqual(result.duplicates, [[0, 1]])
  assert.deepEqual(alignTakeEdges([{ a: .2, b: .7 }], segments), [{ a: .1, b: .9 }])
})

test('feedback is remembered by style and music follows matching mood', () => {
  const directory = mkdtempSync(join(tmpdir(), 'taste-memory-'))
  mkdirSync(join(directory, 'one'))
  writeFileSync(join(directory, 'one/reel.json'), JSON.stringify({ music: { id: 'brainiac' }, beats: [{ type: 'scene', kind: 'ui' }] }))
  recordFeedback(directory, { jobId: 'one', style: 'launch', liked: false, comment: 'Ít hiệu ứng lóe sáng hơn', createdAt: 1 })
  assert.match(tastePrompt(directory, 'launch'), /lóe sáng/)
  assert.match(tastePrompt(directory, 'launch'), /scene:ui/)
  assert.equal(tastePrompt(directory, 'clean'), '')
  assert.equal(readTaste(directory).reels.length, 1)
  assert.equal(readTaste(directory).reels[0].music, 'brainiac')
  const music = chooseMusic(join(process.cwd(), 'ghost-editor'), 'launch', 'công nghệ', [{ a: 0, b: 10 }])
  assert.ok(music && music.id)
})

test('native captions map source words onto frame-rounded edit cuts', () => {
  const words = { segments: [{ start: 0, end: 10, text: '', words: [{ word: 'Một', start: 1.05, end: 1.3 }, { word: 'hai', start: 4.2, end: 4.4 }, { word: 'bỏ', start: 3, end: 3.4 }] }] }
  const mapped = cutWords(words, [{ a: 1, b: 1.52 }, { a: 4, b: 4.71 }])
  assert.equal(mapped.segments[0].end, 16 / 30)
  assert.equal(mapped.segments[1].words[0].word, 'hai')
  assert.ok(Math.abs(mapped.segments[1].words[0].start - (16 / 30 + .2)) < 1e-9)
  assert.equal(mapped.segments.flatMap(s => s.words).length, 2)
  assert.throws(() => cutWords({ segments: [] }, [{ a: 0, b: 2 }]), /timestamp/)
})

test('POP keeps exact spoken words, their onsets and a verified kicker', () => {
  const segments = [{ start: 1, end: 3.3, text: 'Vậy hôm nay thử cách mới', words: [
    { word: 'Vậy', start: 1, end: 1.3 }, { word: 'hôm', start: 1.3, end: 1.6 },
    { word: 'nay', start: 1.6, end: 1.85 }, { word: 'thử', start: 1.85, end: 2.2 },
    { word: 'cách', start: 2.2, end: 2.6 }, { word: 'mới', start: 2.6, end: 3.1 },
  ] }]
  const beats = buildPopBeats([{ text: 'Vậy hôm nay thử cách mới', kicker: 'Vậy hôm nay', at: 1, to: 3.2 },
    { text: 'một cách lạ', kicker: '', at: 1, to: 3.2 }], segments, [{ a: 1, b: 3.3 }])
  assert.equal(beats.length, 1)
  assert.equal(beats[0].kicker, 'Vậy hôm nay')
  assert.deepEqual(beats[0].words.map(word => word.at), [1.85, 2.2, 2.6])
  assert.equal(beats[0].text, 'thử cách mới')
  const opening = buildPopBeats([], segments, [{ a: 1, b: 3.3 }])
  assert.equal(opening.length, 1)
  assert.ok(opening[0].at < 3)
  const keyword = buildPopBeats([{ text: 'mới', kicker: '', at: 2.5, to: 3.2 }], segments, [{ a: 1, b: 3.3 }])
  assert.ok(keyword.some(beat => beat.text === 'mới'))
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

test('preview is reviewed before approval and final render', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'recipe-auto-approve-'))
  mkdirSync(join(directory, 'build/finals'), { recursive: true })
  const recipe = saveStyleRecipe(process.cwd() + '/ghost-editor', 'amber-talk')
  const steps: string[] = []
  const runner = async (command: string, args: string[]) => {
    if (args.some(arg => arg.endsWith('approval_sheet.py'))) {
      steps.push(args.includes('--mark-approved') ? 'approve' : 'sheet')
      if (!args.includes('--mark-approved')) {
        writeFileSync(join(directory, 'build/approval.html'), 'sheet')
        writeFileSync(join(directory, 'build/approval.json'), JSON.stringify({ frames: [{ t: 1, tags: ['hook'] }] }))
      }
    }
    if (args.some(arg => arg.endsWith('visual-contact.py'))) {
      steps.push('frames')
      const sheet = join(directory, 'build/review-0-1.jpg')
      writeFileSync(sheet, 'image')
      return JSON.stringify([sheet])
    }
    if (args.some(arg => arg.endsWith('transcribe.py'))) {
      steps.push('asr')
      writeFileSync(args.at(-3)!, JSON.stringify({ segments: [{ start: 0, end: 1, text: 'Xin chào' }] }))
    }
    if (command.includes('codex')) {
      steps.push('review')
      writeFileSync(args[args.indexOf('-o') + 1], JSON.stringify({ passed: true, summary: 'Đạt', issues: [] }))
    }
    const step = args.findIndex(arg => arg.endsWith('finals.py'))
    if (step >= 0) {
      steps.push(args[step + 1])
      if (args[step + 1] === 'preview') writeFileSync(join(directory, 'build/finals/reel (preview).mp4'), 'preview')
      if (args[step + 1] === 'render') writeFileSync(join(directory, 'build/finals/reel.mp4'), 'final')
    }
    const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : ''
    if (out.includes('render-report-')) writeFileSync(out, JSON.stringify({ summary: { status: 'pass' }, checks: [] }))
    return ''
  }
  const output = await finishRecipe({ root: process.cwd(), directory, recipe, run: runner, job: { stage: '', progress: 0 }, build: async () => {
    writeFileSync(join(directory, 'index.html'), '<div data-composition-id="main" data-duration="10"></div>')
  } })
  assert.equal(output, join(directory, 'build/reel.mp4'))
  assert.deepEqual(steps, ['sheet', 'preview', 'frames', 'frames', 'asr', 'review', 'approve', 'render'])
})

test('agent review blocks final render and sends timestamped defects into the next round', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'recipe-quality-'))
  mkdirSync(join(directory, 'build/finals'), { recursive: true })
  const recipe = saveStyleRecipe(process.cwd() + '/ghost-editor', 'amber-talk')
  let builds = 0
  let finalRenders = 0
  const runner = async (_command: string, args: string[]) => {
    if (args.some(arg => arg.endsWith('approval_sheet.py')) && !args.includes('--mark-approved')) {
      writeFileSync(join(directory, 'build/approval.html'), 'sheet')
      writeFileSync(join(directory, 'build/approval.json'), JSON.stringify({ frames: [{ t: 2, tags: ['beat'] }] }))
    }
    const step = args.findIndex(arg => arg.endsWith('finals.py'))
    if (step >= 0 && args[step + 1] === 'preview') writeFileSync(join(directory, 'build/finals/reel (preview).mp4'), 'preview')
    if (step >= 0 && args[step + 1] === 'render') finalRenders++
    if (args.some(arg => arg.endsWith('visual-contact.py'))) {
      const sheet = join(directory, 'build/review.jpg')
      writeFileSync(sheet, 'image')
      return JSON.stringify([sheet])
    }
    if (args.some(arg => arg.endsWith('transcribe.py'))) writeFileSync(args.at(-3)!, JSON.stringify({ segments: [] }))
    if (args[0] === 'exec' && args.includes('--output-schema')) writeFileSync(args[args.indexOf('-o') + 1], JSON.stringify({ passed: false, summary: 'Chữ che mặt', issues: [{ at: 2, severity: 'blocking', problem: 'Chữ che mặt', fix: 'Dời chữ xuống dưới' }] }))
    const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : ''
    if (out.includes('render-report-')) writeFileSync(out, JSON.stringify({ summary: { status: 'fail' }, checks: [{ id: 'captions', status: 'fail' }] }))
    return ''
  }
  await assert.rejects(() => finishRecipe({ root: process.cwd(), directory, recipe, run: runner, job: { stage: '', progress: 0 }, build: async (_round, feedback) => {
    if (builds) assert.match(feedback, /Chữ che mặt/)
    builds++
    writeFileSync(join(directory, 'index.html'), '<div data-composition-id="main" data-duration="10"></div>')
  } }), /3 vòng/)
  assert.equal(builds, 3)
  assert.equal(finalRenders, 0)
})
