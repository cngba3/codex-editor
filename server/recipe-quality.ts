import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Recipe } from './recipe-contract'
import { pythonArgs, type Runner } from './native-pipeline'
import { runFinalsStage } from './finals-stage'
import { reviewPreview } from './preview-review'

type QualityJob = { stage: string; progress: number; qa?: string; review?: string; recipe?: string; recipeVersion?: string; qualityRound?: number; warning?: string; previewFile?: string; previewFallback?: boolean }
const isJobCancelled = (error: unknown) => error instanceof Error && error.name === 'JobCancelledError'
export async function finishRecipe(input: {
  root: string; directory: string; recipe: Recipe; run: Runner; job: QualityJob
  build: (round: number, feedback: string) => Promise<void>
}) {
  const { root, directory, recipe, run, job, build } = input
  const cli = join(root, 'node_modules/hyperframes/bin/hyperframes.mjs')
  const builder = join(root, 'ghost-editor/scripts/build.mjs')
  const output = join(directory, 'build/reel.mp4')
  const previousFailure = join(directory, 'build', 'repair-2.txt')
  let feedback = existsSync(previousFailure) ? readFileSync(previousFailure, 'utf8').slice(-16000) : ''
  let failureSummary = ''
  job.recipe = recipe.name; job.recipeVersion = recipe.fingerprint
  delete job.previewFallback
  try {
    await run(process.execPath, ['--check', builder])
  } catch (error) {
    if (isJobCancelled(error)) throw error
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Recipe builder failed its syntax check before quality rounds. ${detail}`)
  }
  for (let round = 0; round < 3; round++) {
    job.qualityRound = round + 1
    job.stage = round ? `Sửa theo kiểm tra recipe · vòng ${round + 1}/3` : 'Dựng theo recipe'
    job.progress = 70
    try {
      await build(round, feedback)
      job.stage = 'Kiểm tra bản dựng trước render'; job.progress = 73
      await run(process.execPath, [cli, 'lint'], { cwd: directory })
      const html = readFileSync(join(directory, 'index.html'), 'utf8')
      const seconds = Number(html.match(/data-composition-id=["'][^"']+["'][^>]*data-duration=["']([\d.]+)["']/)?.[1])
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 65) throw new Error('Recipe tạo thời lượng không hợp lệ.')
      for (const [index, at] of [Math.min(1.5, seconds / 4), seconds / 2, Math.max(0.05, seconds - 1)].entries()) {
        const snapshotDir = join(directory, 'build', `preview-snapshot-${index}`)
        mkdirSync(snapshotDir, { recursive: true })
        job.stage = `Chụp ảnh xem trước ${index + 1}/3`; job.progress = 73 + index
        try {
          await run(process.execPath, [cli, 'snapshot', directory, '--at', at.toFixed(3), '-o', snapshotDir, '--describe', 'false', '--no-end'], { cwd: directory })
          const png = readdirSync(snapshotDir).find(file => /^frame-.*\.png$/.test(file))
          if (png) await run('ffmpeg', ['-v', 'error', '-y', '-i', join(snapshotDir, png), '-vf', 'scale=450:-2', '-q:v', '4', '-frames:v', '1', join(directory, 'build', `preview-frame-${index}.jpg`)])
        } catch (error) { if (isJobCancelled(error)) throw error }
      }
      const approval = join(root, 'ghost-editor/scripts/approval_sheet.py')
      await run('uv', [...pythonArgs, approval, directory, '--no-build', '--max-frames', '24'])
      const approvalHtml = join(directory, 'build/approval.html')
      const finalsDir = join(directory, 'build/finals')
      const manifest = join(directory, 'build/finals-manifest.json')
      writeFileSync(manifest, JSON.stringify({ reels: [{ project: directory, out: finalsDir, name: 'reel', workers: 1, recipe: recipe.id, profile: recipe.id === 'seoul-list' ? 'broll-led' : 'talking-head', no_music: false, normalize_loudness: true }] }), 'utf8')
      job.stage = `Render preview · vòng ${round + 1}/3`; job.progress = 75
      const preview = await runFinalsStage({ root, directory, manifest, stage: 'preview', run })
      job.previewFile = basename(preview)
      writeFileSync(manifest, JSON.stringify({ reels: [{ project: directory, out: finalsDir, name: 'reel', workers: 1, recipe: recipe.id, profile: recipe.id === 'seoul-list' ? 'broll-led' : 'talking-head', no_music: false, normalize_loudness: true, preview_file: job.previewFile }] }), 'utf8')
      job.stage = 'Agent kiểm tra preview đã render'; job.progress = 80
      const review = await reviewPreview({ root, directory, preview, recipe, round, run })
      job.review = JSON.stringify(review)
      writeFileSync(join(directory, 'build', 'quality.json'), JSON.stringify({ round: round + 1, preview, review, approval: approvalHtml, recipe: recipe.fingerprint }, null, 2))
      if (!review.passed) throw new Error(`PREVIEW REVIEW: ${JSON.stringify(review).slice(0, 12000)}`)
      await run('uv', [...pythonArgs, approval, directory, '--mark-approved'])
      job.stage = 'Preview đạt kiểm tra tự động'; job.progress = 82
      job.stage = `Render MP4 · vòng ${round + 1}/3`; job.progress = 84
      const final = await runFinalsStage({ root, directory, manifest, stage: 'render', run })
      copyFileSync(final, output)
      job.stage = 'Kiểm tra hình, âm thanh và recipe'; job.progress = 94
      const report = join(directory, 'build', `render-report-${round}.json`)
      let technicalFailure = ''
      try {
        await run('uv', [...pythonArgs, join(root, 'server/recipe-audio.py'), directory])
        await run('uv', [...pythonArgs, join(root, 'ghost-editor/scripts/render_report.py'), directory, output, '--style', recipe.id, '--stem', join(directory, 'build/sfx-stem.wav'), '--out', report, '--no-html', ...(recipe.id === 'seoul-list' ? ['--broll-profile', 'broll-led'] : [])])
      } catch (error) { if (isJobCancelled(error)) throw error; technicalFailure = error instanceof Error ? error.message : String(error) }
      if (!existsSync(report)) throw new Error(`Không tạo được báo cáo QA: ${technicalFailure}`)
      const reportText = readFileSync(report, 'utf8')
      job.qa = reportText.slice(-12000)
      const qa = JSON.parse(reportText) as { summary?: { status?: string }; checks?: Array<{ id?: string; status?: string; value?: string | number }> }
      const technicalPassed = !technicalFailure && ['pass', 'warn'].includes(qa.summary?.status || '')
      writeFileSync(join(directory, 'build/quality.json'), JSON.stringify({ round: round + 1, technicalPassed, review, recipe: recipe.fingerprint, report, approval: approvalHtml, preview }, null, 2))
      if (technicalPassed) return output
      failureSummary = (qa.checks || []).filter(check => check.status === 'fail').map(check => `${check.id || 'QA'}: ${String(check.value ?? 'không đạt')}`).join('; ') || technicalFailure || 'Báo cáo QA chưa đạt.'
      feedback = `TECHNICAL: ${technicalFailure}\nREPORT: ${reportText}`
    } catch (error) {
      if (isJobCancelled(error)) throw error
      feedback = error instanceof Error ? error.message : String(error)
      failureSummary = feedback.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(-4).join(' | ').slice(-700)
    }
    writeFileSync(join(directory, 'build', `repair-${round}.txt`), feedback, 'utf8')
  }
  const previewName = job.previewFile && basename(job.previewFile) === job.previewFile && /^reel \(preview\)(?:-\d+-\d+)?\.mp4$/.test(job.previewFile)
    ? job.previewFile : 'reel (preview).mp4'
  const preview = join(directory, 'build/finals', previewName)
  if (existsSync(preview) && statSync(preview).size > 0) {
    copyFileSync(preview, output)
    job.previewFallback = true
    return output
  }
  throw new Error(`Không có video xem trước để xuất sau 3 vòng dựng. ${failureSummary}`)
}
