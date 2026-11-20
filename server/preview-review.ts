import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { codexExecutable } from './codex'
import { pythonArgs, type Runner } from './native-pipeline'
import type { Recipe } from './recipe-contract'

type Issue = { at: number; severity: 'blocking' | 'minor'; problem: string; fix: string }
export type PreviewReview = { passed: boolean; summary: string; issues: Issue[] }

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const styleVideos: Record<string, string> = {
  'amber-talk': 'amber-talk.mp4',
  'clean-os': 'clean-os.mp4',
  pop: 'pop.mp4',
  'ref-b018836f': 'interview.mp4',
  'review-bds': 'review-bds.mp4',
}

function contactSheets(output: string) {
  const manifest = output.split(/\r?\n/).map(line => line.trim()).find(line => line.startsWith('["') && line.endsWith(']'))
  const sheets = JSON.parse(manifest || '[]') as string[]
  if (!sheets.length || sheets.some(path => !existsSync(path))) throw new Error('Không tạo được contact sheet từ video.')
  return sheets
}

export async function reviewPreview(input: {
  root: string; directory: string; preview: string; recipe: Recipe; round: number; run: Runner
}): Promise<PreviewReview> {
  const { root, directory, preview, recipe, round, run } = input
  const build = join(directory, 'build')
  const approvalPath = join(build, 'approval.json')
  if (!existsSync(approvalPath)) throw new Error('Thiếu danh sách khung hình để kiểm tra preview.')
  const approval = JSON.parse(readFileSync(approvalPath, 'utf8')) as {
    frames?: { t: number; tags: string[] }[]; warnings?: { severity: string; msg: string }[]; total?: number
  }
  if (!approval.frames?.length) throw new Error('Không có khung hình nào để kiểm tra preview.')
  const frames = [...approval.frames]
  if (Number.isFinite(approval.total) && approval.total! > 0) {
    for (let at = 2.5; at < approval.total! - 0.1; at += 2.5) {
      if (!frames.some(frame => Math.abs(frame.t - at) < 0.35)) frames.push({ t: Number(at.toFixed(2)), tags: ['temporal scan'] })
    }
  }
  frames.sort((a, b) => a.t - b.t)
  const framePlan = join(build, `review-frames-${round}.json`)
  writeFileSync(framePlan, JSON.stringify({ frames }, null, 2), 'utf8')

  const sheets = contactSheets(await run('uv', [...pythonArgs, join(root, 'server/visual-contact.py'),
    'video', preview, framePlan, join(build, `review-${round}`)]))
  const reference = styleVideos[recipe.id] && join(root, 'public/style-videos', styleVideos[recipe.id])
  let referenceSheets: string[] = []
  if (reference && existsSync(reference)) {
    const referencePlan = join(build, `review-reference-frames-${round}.json`)
    writeFileSync(referencePlan, JSON.stringify({ frames: [0.3, 1.3, 2.3].map(t => ({ t })) }), 'utf8')
    referenceSheets = contactSheets(await run('uv', [...pythonArgs, join(root, 'server/visual-contact.py'),
      'video', reference, referencePlan, join(build, `review-reference-${round}`)]))
  }

  const previewWordsPath = join(build, `preview-words-${round}.json`)
  await run('uv', ['run', '--no-project', '--python', '3.11', '--with', 'faster-whisper', 'python',
    join(root, 'server/transcribe.py'), preview, previewWordsPath, '', 'fast'])
  const previewWords = JSON.parse(readFileSync(previewWordsPath, 'utf8')) as { segments?: { start: number; end: number; text: string }[] }
  const reel = read(join(directory, 'reel.json'))
  const originalWords = read(join(build, 'words.whisper.json')) || read(join(build, 'words.cut.json'))
  const output = join(build, `preview-review-${round}.json`)
  const prompt = `Review an automatically edited vertical video. ${referenceSheets.length ? 'The FIRST attached contact sheet shows the first three seconds of a STYLE SAMPLE. Compare its recurring visual grammar: palette, typography hierarchy, person-matte layering and word entrance. Adapt speaker, content and framing to the raw video; do not require the same words or exact coordinates. For Pop, missing signature yellow pop typography and behind-person layering where feasible is a blocking defect. For other styles, judge fidelity against their recipe. All remaining sheets show the ACTUAL rendered preview.' : 'All attached sheets show the ACTUAL rendered preview.'} Preview sheets are in time order. Inspect every numbered preview frame, including the opening, cuts, visual beats and ending. When speech begins, check that a distinctive visual cue of the selected style appears within the FIRST THREE SECONDS of the finished video; if it is missing, mark a blocking opening defect with a specific fix. Compare the visible typography and layout with the recipe, and compare preview ASR with the source transcript and selected takes. ASR is fallible: do not call a difference an error unless the evidence supports it. Audio mixing and stream health are checked separately by technical QA; do not claim to hear sound from still images. Flag only concrete defects that can be fixed in the edit plan: unreadable or clipped text, text over the face, subtitles duplicating a simultaneous highlighted phrase, irrelevant or repeated graphics, visibly wrong style, black/frozen frames, abrupt start/end, dropped or repeated spoken content. Give the timestamp, evidence and a specific edit-plan change for each issue. Never suggest altering the source speaker's words or inventing content. A blocking issue means this preview should be rebuilt before final export. If no blocking issue is evidenced, passed=true. Minor observations may remain. Return JSON only.\n\nRecipe: ${JSON.stringify({ id: recipe.id, rules: recipe.rules, checks: recipe.checks, limitations: recipe.limitations }).slice(0, 14000)}\nFrame times and tags: ${JSON.stringify(frames).slice(0, 7000)}\nApproval warnings: ${JSON.stringify(approval.warnings || []).slice(0, 3000)}\nEdit plan: ${reel.slice(0, 16000)}\nSource word transcript: ${originalWords.slice(0, 16000)}\nPreview ASR: ${JSON.stringify(previewWords.segments || []).slice(0, 12000)}`
  await run(codexExecutable(), ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', directory,
    ...[...referenceSheets, ...sheets].flatMap(path => ['-i', path]), '--output-schema', join(root, 'server/preview-review-schema.json'),
    '-o', output, '-'], { input: prompt })
  const verdict = JSON.parse(readFileSync(output, 'utf8')) as PreviewReview
  if (typeof verdict.passed !== 'boolean' || !Array.isArray(verdict.issues)) throw new Error('Agent trả về review preview không hợp lệ.')
  if (verdict.issues.some(issue => issue.severity === 'blocking')) verdict.passed = false
  return verdict
}
