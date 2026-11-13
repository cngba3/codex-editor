import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, delimiter, join, resolve } from 'node:path'
import ffmpeg from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'
import { prepareNative, pythonArgs } from '../server/native-pipeline'
import { saveStyleRecipe } from '../server/recipe-contract'

const root = process.cwd(), source = resolve('jobs/recipe-result-smoke'), project = resolve('.cache/native-whiteboard-smoke')
mkdirSync(join(project, 'assets'), { recursive: true }); mkdirSync(join(project, 'build'), { recursive: true })
copyFileSync(join(source, 'assets/plate.mp4'), join(project, 'assets/talk.mp4'))
copyFileSync(join(source, 'assets/plate.mp4'), join(project, 'source.mp4'))
const data = JSON.parse(readFileSync(join(source, 'build/words.json'), 'utf8'))
const flat = Array.isArray(data) ? data : data.segments ? data.segments.flatMap((s: any) => s.words) : data.words
const words = { segments: [{ start: 0, end: 6, text: '', words: flat.map((w: any) => ({ word: w.word || w.text || w.raw, start: w.start ?? w.s, end: w.end ?? w.e })) }] }
const cli = join(root, 'node_modules/hyperframes/bin/hyperframes.mjs')
const run = (command: string, args: string[], options: { cwd?: string } = {}) => new Promise<string>((yes, no) => {
  const child = spawn(command, args, { cwd: options.cwd || root, windowsHide: true, env: { ...process.env, PYTHONUTF8: '1', PATH: [dirname(ffmpeg!), dirname(ffprobe.path), process.env.PATH].join(delimiter), HYPERFRAMES_CLI_PATH: cli, HYPERFRAMES_FFMPEG_PATH: ffmpeg! } })
  let out = ''; child.stdout.on('data', b => { out += b; process.stdout.write(b) }); child.stderr.on('data', b => { out += b; process.stderr.write(b) }); child.on('error', no); child.on('close', code => code === 0 ? yes(out) : no(new Error(out.slice(-4000)))); child.stdin.end()
})
await prepareNative({ root, directory: project, ffmpeg: ffmpeg!, run, takes: [{ a: 0, b: 6 }], words, title: 'Kiểm tra recipe', recipe: saveStyleRecipe(join(root, 'ghost-editor'), 'whiteboard') })
const call = (target: string, method: string, args: unknown[], kwargs = {}, result = '') => ({ target, method, args_json: JSON.stringify(args), kwargs_json: JSON.stringify(kwargs), result })
const label = flat.slice(0, 3).map((w: any) => w.word || w.text || w.raw).join(' ')
const plan = { rationale: 'Native builder smoke test', options_json: JSON.stringify({ tail: 0 }), build_json: '{}', operations: [call('R', 'page', [0.5]), call('module', 'stick', [300, 350, 1.2], {}, 'shape'), call('R', 'draw', [{ $ref: 'shape' }, 0.7, { $constant: 'INK' }, 8], { shape: 'stick' }), call('R', 'write', [label, 540, 700, 1, 60, { $constant: 'INK' }, 'middle'])] }
writeFileSync(join(project, 'build/native-plan-0.json'), JSON.stringify(plan))
await run('uv', [...pythonArgs, join(root, 'server/native-recipe.py'), 'build', 'whiteboard', project, join(project, 'build/native-plan-0.json')])
await run(process.execPath, [cli, 'lint'], { cwd: project })
await run(process.execPath, [cli, 'render', '--workers', '1', '-o', join(project, 'build/reel.mp4')], { cwd: project })
console.log(`Smoke video: ${project}/build/reel.mp4`)
