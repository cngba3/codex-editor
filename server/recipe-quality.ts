import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Recipe } from './recipe-contract'
import { pythonArgs, type Runner } from './native-pipeline'

type QualityJob = { stage: string; progress: number; qa?: string; review?: string; recipe?: string; recipeVersion?: string; qualityRound?: number }
export async function finishRecipe(input: {
  root: string; directory: string; recipe: Recipe; run: Runner; job: QualityJob
  build: (round: number, feedback: string) => Promise<void>
}) {
  const { root, directory, recipe, run, job, build } = input
  const cli = join(root, 'node_modules/hyperframes/bin/hyperframes.mjs')
  const output = join(directory, 'build/reel.mp4')
  const previousFailure = join(directory, 'build', 'repair-2.txt')
  let feedback = existsSync(previousFailure) ? readFileSync(previousFailure, 'utf8').slice(-16000) : ''
  let failureSummary = ''
  job.recipe = recipe.name; job.recipeVersion = recipe.fingerprint
  for (let round = 0; round < 3; round++) {
    job.qualityRound = round + 1
    job.stage = round ? `Sửa theo kiểm tra recipe · vòng ${round + 1}/3` : 'Dựng theo recipe'
    job.progress = 70
    try {
      await build(round, feedback)
      job.stage = 'Kiểm tra bản dựng trước render'; job.progress = 73
      await run(process.execPath, [cli, 'lint'], { cwd: directory })
      const approval = join(root, 'ghost-editor/scripts/approval_sheet.py')
      await run('uv', [...pythonArgs, approval, directory, '--no-build', '--max-frames', '24'])
      const approvalHtml = join(directory, 'build/approval.html')
      await run('uv', [...pythonArgs, approval, directory, '--mark-approved'])
      const html = readFileSync(join(directory, 'index.html'), 'utf8')
      const seconds = Number(html.match(/data-composition-id=["'][^"']+["'][^>]*data-duration=["']([\d.]+)["']/)?.[1])
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 65) throw new Error('Recipe tạo thời lượng không hợp lệ.')
      const finals = join(root, 'ghost-editor/scripts/finals.py')
      const finalsDir = join(directory, 'build/finals')
      const manifest = join(directory, 'build/finals-manifest.json')
      writeFileSync(manifest, JSON.stringify({ reels: [{ project: directory, out: finalsDir, name: 'reel', workers: 1, recipe: recipe.id, profile: recipe.id === 'seoul-list' ? 'broll-led' : 'talking-head', no_music: false, normalize_loudness: true }] }), 'utf8')
      job.stage = `Render preview · vòng ${round + 1}/3`; job.progress = 75
      await run('uv', [...pythonArgs, finals, 'preview', '--batch', manifest])
      const preview = join(finalsDir, 'reel (preview).mp4')
      if (!existsSync(preview)) throw new Error('Ghost Editor không tạo được preview.')
      job.stage = 'Preview tự động được duyệt'; job.progress = 82
      job.stage = `Render MP4 · vòng ${round + 1}/3`; job.progress = 84
      await run('uv', [...pythonArgs, finals, 'render', '--batch', manifest, '--no-nomusic'])
      const final = join(finalsDir, 'reel.mp4')
      if (!existsSync(final)) throw new Error('Ghost Editor không tạo được bản xuất cuối.')
      copyFileSync(final, output)
      job.stage = 'Kiểm tra hình, âm thanh và recipe'; job.progress = 94
      const report = join(directory, 'build', `render-report-${round}.json`)
      let technicalFailure = ''
      try {
        await run('uv', [...pythonArgs, join(root, 'server/recipe-audio.py'), directory])
        await run('uv', [...pythonArgs, join(root, 'ghost-editor/scripts/render_report.py'), directory, output, '--style', recipe.id, '--stem', join(directory, 'build/sfx-stem.wav'), '--out', report, '--no-html', ...(recipe.id === 'seoul-list' ? ['--broll-profile', 'broll-led'] : [])])
      } catch (error) { technicalFailure = error instanceof Error ? error.message : String(error) }
      if (!existsSync(report)) throw new Error(`Không tạo được báo cáo QA: ${technicalFailure}`)
      const reportText = readFileSync(report, 'utf8')
      job.qa = reportText.slice(-12000)
      const qa = JSON.parse(reportText) as { summary?: { status?: string }; checks?: Array<{ id?: string; status?: string; value?: string | number }> }
      const technicalPassed = !technicalFailure && ['pass', 'warn'].includes(qa.summary?.status || '')
      job.review = undefined
      writeFileSync(join(directory, 'build/quality.json'), JSON.stringify({ round: round + 1, technicalPassed, recipe: recipe.fingerprint, report, approval: approvalHtml, preview }, null, 2))
      if (technicalPassed) return output
      failureSummary = (qa.checks || []).filter(check => check.status === 'fail').map(check => `${check.id || 'QA'}: ${String(check.value ?? 'không đạt')}`).join('; ') || technicalFailure || 'Báo cáo QA chưa đạt.'
      feedback = `TECHNICAL: ${technicalFailure}\nREPORT: ${reportText}`
    } catch (error) {
      feedback = error instanceof Error ? error.message : String(error)
      failureSummary = feedback.split(/\r?\n/)[0].slice(0, 350)
    }
    writeFileSync(join(directory, 'build', `repair-${round}.txt`), feedback, 'utf8')
  }
  throw new Error(`Chưa đạt kiểm tra sau 3 vòng sửa. ${failureSummary} Bản dựng đã lưu trong thư mục job.`)
}
