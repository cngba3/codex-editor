import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Recipe } from './recipe-contract'
import { pythonArgs, type Runner } from './native-pipeline'

type QualityJob = { stage: string; progress: number; qa?: string; review?: string; recipe?: string; recipeVersion?: string; qualityRound?: number }
export async function finishRecipe(input: {
  root: string; directory: string; recipe: Recipe; run: Runner; ffmpeg: string; codex: string; job: QualityJob
  build: (round: number, feedback: string) => Promise<void>
}) {
  const { root, directory, recipe, run, ffmpeg, codex, job, build } = input
  const cli = join(root, 'node_modules/hyperframes/bin/hyperframes.mjs')
  const output = join(directory, 'build/reel.mp4')
  let feedback = ''
  job.recipe = recipe.name; job.recipeVersion = recipe.fingerprint
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
      job.stage = `Render MP4 · vòng ${round + 1}/3`; job.progress = 75
      await run(process.execPath, [cli, 'render', '--workers', '1', '-o', output], { cwd: directory })
      const normalized = join(directory, 'build/reel-normalized.mp4')
      await run(ffmpeg, ['-v', 'error', '-y', '-i', output, '-t', String(seconds), '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', normalized])
      copyFileSync(normalized, output); unlinkSync(normalized)
      job.stage = 'Kiểm tra hình, âm thanh và recipe'; job.progress = 94
      const sheet = join(directory, 'build', `review-${round}.jpg`)
      await run(ffmpeg, ['-v', 'error', '-y', '-i', output, '-vf', `fps=${12 / seconds},scale=270:480,tile=4x3:padding=3:color=white`, '-frames:v', '1', '-update', '1', sheet])
      const report = join(directory, 'build', `render-report-${round}.json`)
      let technicalFailure = ''
      try {
        await run('uv', [...pythonArgs, join(root, 'server/recipe-audio.py'), directory])
        await run('uv', [...pythonArgs, join(root, 'ghost-editor/scripts/render_report.py'), directory, output, '--style', recipe.id, '--stem', join(directory, 'build/sfx-stem.wav'), '--out', report, '--no-html', ...(recipe.id === 'seoul-list' ? ['--broll-profile', 'broll-led'] : [])])
      } catch (error) { technicalFailure = error instanceof Error ? error.message : String(error) }
      if (!existsSync(report)) throw new Error(`Không tạo được báo cáo QA: ${technicalFailure}`)
      const reportText = readFileSync(report, 'utf8')
      job.qa = reportText.slice(-12000)
      const review = join(directory, 'build', `recipe-review-${round}.json`)
      await run(codex, ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', directory, '-i', sheet, '--output-schema', join(root, 'server/review-schema.json'), '-o', review, '-'], {
        input: `Review this rendered reel contact sheet against its recipe. Images are sampled throughout the video, not proof of motion or audio. Return passed=false for visible unreadable Vietnamese, missing glyphs, face obstruction, irrelevant illustration or clear recipe violations. Do not invent audio/motion defects from stills. Use technical QA for those. Notes in Vietnamese with specific fixes. Recipe: ${JSON.stringify(recipe)}\nTechnical report: ${reportText}\nNo tools.`,
      })
      const verdict = JSON.parse(readFileSync(review, 'utf8')) as { passed: boolean; notes: string }
      job.review = verdict.notes
      writeFileSync(join(directory, 'build/quality.json'), JSON.stringify({ round: round + 1, technicalPassed: !technicalFailure, visualPassed: verdict.passed, recipe: recipe.fingerprint, report, review }, null, 2))
      if (!technicalFailure && verdict.passed) return output
      feedback = `TECHNICAL: ${technicalFailure}\nREPORT: ${reportText}\nVISUAL: ${verdict.notes}`
    } catch (error) {
      feedback = error instanceof Error ? error.message : String(error)
    }
    writeFileSync(join(directory, 'build', `repair-${round}.txt`), feedback, 'utf8')
  }
  throw new Error(`Chưa đạt kiểm tra sau 3 vòng sửa; giữ bản dựng và báo cáo trong thư mục job. ${feedback.slice(-1400)}`)
}
