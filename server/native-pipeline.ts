import { copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { nativeRecipe, recipePrompt, type Recipe } from './recipe-contract'

export type Word = { word: string; start: number; end: number }
type Transcript = { segments: { start: number; end: number; text: string; words?: Word[] }[] }
export type Runner = (command: string, args: string[], options?: { cwd?: string; input?: string }) => Promise<string>
export const pythonArgs = ['run', '--no-project', '--python', '3.11', '--with', 'numpy', '--with', 'opencv-python-headless', '--with', 'Pillow', '--with', 'fonttools', '--with', 'brotli', 'python']

export function cutWords(words: Transcript, takes: { a: number; b: number }[]) {
  let cursor = 0
  const segments = takes.map(take => {
    const duration = Math.round((take.b - take.a) * 30) / 30
    const mapped = words.segments.flatMap(s => s.words || []).filter(w => w.end > take.a && w.start < take.b)
      .map(w => ({ word: w.word, start: cursor + Math.max(0, w.start - take.a), end: cursor + Math.min(duration, w.end - take.a) }))
      .filter(w => w.end > w.start)
    const segment = { start: cursor, end: cursor + duration, text: mapped.map(w => w.word.trim()).join(' '), words: mapped }
    cursor += duration
    return segment
  })
  if (!segments.some(s => s.words.length)) throw new Error('Recipe cần timestamp từng từ; hãy chạy lại nhận dạng lời nói.')
  return { language: 'vi', segments }
}

const alias = (source: string, target: string) => { if (!existsSync(target)) { try { linkSync(source, target) } catch { copyFileSync(source, target) } } }

export async function prepareNative(input: { root: string; directory: string; ffmpeg: string; run: Runner; takes: { a: number; b: number }[]; words: Transcript; title: string; recipe: Recipe }) {
  const { root, directory, ffmpeg, run, takes, words, title, recipe } = input
  const assets = join(directory, 'assets'), build = join(directory, 'build'), ghost = join(root, 'ghost-editor')
  const native = nativeRecipe(recipe.id)!
  const sources = [join(ghost, 'recipes', native.folder, `${native.module}.py`), join(ghost, 'recipes', native.folder, 'house.json')].filter(existsSync).map(path => readFileSync(path, 'utf8')).join('\n')
  const sfx = JSON.parse(readFileSync(join(ghost, 'library/sfx/manifest.json'), 'utf8'))
  const music = JSON.parse(readFileSync(join(ghost, 'library/music/manifest.json'), 'utf8'))
  const required = [...Object.keys(sfx), ...Object.keys(music)].filter(id => sources.includes(`"${id}"`) || sources.includes(`'${id}'`))
  if (required.length) await run(process.execPath, [join(root, 'server/restore-media.mjs'), ...required])
  await run(process.execPath, [join(root, 'server/recipe-fonts.mjs'), directory])
  const plate = join(assets, 'plate.mp4'), voice = join(assets, 'voice.wav')
  const filters = takes.flatMap((t, i) => {
    const frames = Math.round((t.b - t.a) * 30), duration = frames / 30
    return [`[0:v]trim=start=${t.a}:end=${t.b},setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=0.05,trim=end_frame=${frames}[v${i}]`, `[0:a]atrim=start=${t.a}:end=${t.b},asetpts=PTS-STARTPTS,apad,atrim=duration=${duration}[a${i}]`]
  })
  filters.push(takes.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${takes.length}:v=1:a=1[v][a]`)
  const filterPath = join(build, 'native-cut.ffscript')
  writeFileSync(filterPath, filters.join(';\n'), 'utf8')
  if (!existsSync(plate) || !existsSync(voice)) await run(ffmpeg, ['-v', 'error', '-y', '-i', join(assets, 'talk.mp4'), '-filter_complex_script', filterPath, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-g', '30', '-pix_fmt', 'yuv420p', plate, '-map', '[a]', '-vn', '-c:a', 'pcm_s16le', '-ar', '48000', voice])
  for (const name of ['wide.mp4', 'tight.mp4', 'alt.mp4', 'plate_wide.mp4', 'plate_alt.mp4']) alias(plate, join(assets, name))
  if (recipe.id === 'seoul-list') {
    mkdirSync(join(directory, 'clips'), { recursive: true })
    for (const file of readdirSync(assets).filter(name => /^support-\d+\.mp4$/.test(name))) {
      const out = join(directory, 'clips', file)
      if (!existsSync(out)) await run(ffmpeg, ['-v', 'error', '-y', '-i', join(assets, file), '-an', '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2', '-r', '30', '-c:v', 'libx264', '-g', '30', '-crf', '18', '-preset', 'veryfast', out])
    }
  }
  const mapped = cutWords(words, takes)
  for (const name of ['words.json', 'words.cut.json', 'words.edit.json']) writeFileSync(join(build, name), JSON.stringify(mapped), 'utf8')
  writeFileSync(join(build, 'native-context.json'), JSON.stringify({ title, duration: mapped.segments.at(-1)!.end, recipe: recipe.id }), 'utf8')
  // face.json must use edit time, not original source time.
  if (!existsSync(join(build, 'native-face.ready'))) {
    await run('uv', [...pythonArgs, join(ghost, 'scripts/face_track.py'), plate, '--out', join(build, 'face.json')])
    writeFileSync(join(build, 'native-face.ready'), recipe.fingerprint)
  }
  for (const name of ['face-wide.json', 'face-tight.json', 'face-alt.json']) copyFileSync(join(build, 'face.json'), join(build, name))
  await run(ffmpeg, ['-v', 'error', '-y', '-i', plate, '-vf', 'fps=1/3,scale=216:384,tile=4x2:nb_frames=8:padding=3:color=white', '-frames:v', '1', '-update', '1', join(build, 'source-sheet.jpg')])
  if (nativeRecipe(recipe.id)?.matte) {
    const matte = join(assets, 'plate-matte.webm')
    if (!existsSync(matte)) await run('uv', ['run', '--no-project', '--python', '3.11', '--with', 'rembg[cpu]', '--with', 'opencv-python-headless', 'python', join(ghost, 'scripts/matte.py'), plate, '-o', matte, '--backend', 'ort', '--provider', 'cpu'])
    for (const name of ['wide-matte.webm', 'tight-matte.webm', 'alt-matte.webm', 'alt_matte.webm']) alias(matte, join(assets, name))
  }
  const gsapCandidates = [join(root, 'node_modules/gsap/dist/gsap.min.js'), join(ghost, 'templates/gsap.min.js')]
  const gsap = gsapCandidates.find(existsSync)
  if (gsap) copyFileSync(gsap, join(assets, 'gsap.min.js'))
}

export async function buildNative(input: { root: string; directory: string; recipe: Recipe; codex: string; run: Runner; feedback?: string; round: number }) {
  const { root, directory, recipe, codex, run, round, feedback = '' } = input
  const driver = join(root, 'server/native-recipe.py')
  const api = await run('uv', [...pythonArgs, driver, 'api', recipe.id])
  const components = await run('uv', [...pythonArgs, join(root, 'ghost-editor/scripts/components.py'), 'plan', '--style', nativeRecipe(recipe.id)!.folder]).catch(() => 'No component history available for this recipe yet.')
  const build = join(directory, 'build'), output = join(build, `native-plan-${round}.json`)
  const previous = round > 0 && existsSync(join(build, `native-plan-${round - 1}.json`)) ? readFileSync(join(build, `native-plan-${round - 1}.json`), 'utf8') : ''
  const assets = readdirSync(join(directory, 'assets')).filter(name => /\.(mp4|webm|png|jpg|wav)$/.test(name))
  const prompt = `You are directing a Vietnamese reel using the ORIGINAL Ghost Editor recipe builder. Return a declarative plan, not Python or shell commands.\n${recipePrompt(recipe)}
API (actual source signatures; do not invent methods):\n${api}
COMPONENT HISTORY AND OPEN SLOTS: ${components}
CONTEXT: ${readFileSync(join(build, 'native-context.json'), 'utf8')}
WORDS IN EDIT SECONDS: ${readFileSync(join(build, 'words.cut.json'), 'utf8')}
AVAILABLE ASSETS: ${JSON.stringify(assets)}
FACE GEOMETRY IN EDIT SECONDS: ${readFileSync(join(build, 'face.json'), 'utf8')}
Build only from the supplied API and data. Do not call tools or inspect files; all required context is included. For Seoul List the provided B-roll is in clips/support-N.mp4 (clip id support-N), with the speaker in clips/face.mp4 after setup.
options_json is a JSON object for ${nativeRecipe(recipe.id)!.builder}(project, **options). The driver supplies project. Supply dur and title when required. Strings "$duration" and "$title" resolve to the context values. Use tail=0 where the constructor accepts it. Plates are the same original shot, not independent camera angles. Keep all spoken words captioned. For language options use vi. Do not invent source tags or chart numbers.
build_json is a JSON object of keyword arguments to the final build() call, e.g. BIG/SCRIPT/css for FaceResult or special/css/music for CleanOS; consult actual signatures. Do not disable checks. operations contains calls in execution order. target="R" calls the builder; target="kit" or target="props" can call helpers from kit.py/props.py when those files appear in the API. target="module" calls a public helper or value constructor declared in the selected recipe module (e.g. stick/arrow/Strap). Save a returned scene/path/object with result="name", then target="name" calls it; args can reference it as {"$ref":"name"}. Constants use {"$constant":"INK"}. args_json is a JSON array; kwargs_json a JSON object; result="" if unused. Use numerical edit timestamps from the words or call R.t and save its result. Never call build: the driver calls it after your operations. Private methods, js, write_page, emit, exec, eval, raw scripts and absolute paths are forbidden. Use real recipe calls and helpers, not screenshots of the example reel. All assets use assets/... paths. No new asset files can be created by this plan; use only available assets. For Whiteboard call page, module drawing helpers, draw/write timed to each thought. For Caption News call plates and cap covering ALL words, with true word onsets; emphasize one word per phrase. For FaceResult call its own captions/overlays methods. Respect face guards and budgets; don't disable checks.
Plan an opening hook, progression, at least two distinct meaningful visual beats, and a clean finish. The rationale explains decisions, missing assets, and any source limitations.
PREVIOUS PLAN: ${previous}
FIX THESE OBSERVED ERRORS WITHOUT WEAKENING CHECKS: ${feedback.slice(-16000)}
Return the complete replacement plan.`
  const images = [join(build, 'source-sheet.jpg'), ...assets.filter(name => /\.(png|jpg)$/.test(name) && !/grain|texture|ground/.test(name)).slice(0, 2).map(name => join(directory, 'assets', name))].filter(existsSync)
  await run(codex, ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', directory, ...images.flatMap(path => ['-i', path]), '--output-schema', join(root, 'server/native-plan-schema.json'), '-o', output, '-'], { input: prompt })
  const plan = JSON.parse(readFileSync(output, 'utf8'))
  writeFileSync(join(build, 'creative-decisions.txt'), plan.rationale, 'utf8')
  await run('uv', [...pythonArgs, driver, 'build', recipe.id, directory, output])
}
