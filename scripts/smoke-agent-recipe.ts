import { spawn } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, delimiter, join, resolve } from 'node:path'
import ffmpeg from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'
import { buildNative } from '../server/native-pipeline'
import { finishRecipe } from '../server/recipe-quality'
import { saveStyleRecipe } from '../server/recipe-contract'

const root = process.cwd(), id = process.argv[2] || 'face-result'
const directory = resolve(`.cache/agent-${id}-smoke`), fixture = resolve('.cache/native-whiteboard-smoke')
mkdirSync(join(directory, 'build'), { recursive: true })
cpSync(join(fixture, 'assets'), join(directory, 'assets'), { recursive: true })
for (const name of ['words.cut.json', 'words.json', 'words.edit.json', 'face.json', 'native-context.json']) cpSync(join(fixture, 'build', name), join(directory, 'build', name))
const cli = join(root, 'node_modules/hyperframes/bin/hyperframes.mjs')
const executable = join(process.env.LOCALAPPDATA || '', 'Programs/OpenAI/Codex/bin/codex.exe')
const codex = existsSync(executable) ? executable : 'codex.exe'
const job = { stage: '', progress: 0 }
const run = (command: string, args: string[], options: { cwd?: string; input?: string } = {}) => new Promise<string>((yes, no) => {
  const child = spawn(command, args, { cwd: options.cwd || root, windowsHide: true, env: { ...process.env, PYTHONUTF8: '1', PATH: [dirname(ffmpeg!), dirname(ffprobe.path), process.env.PATH].join(delimiter), HYPERFRAMES_CLI_PATH: cli, HYPERFRAMES_FFMPEG_PATH: ffmpeg! } })
  let out = ''; const consume = (b: Buffer) => { out += b; appendFileSync(join(directory, 'build/run.log'), b) }
  child.stdout.on('data', consume); child.stderr.on('data', consume); child.on('error', no); child.on('close', code => code === 0 ? yes(out) : no(new Error(out.slice(-8000)))); child.stdin.end(options.input || '')
})
const recipe = saveStyleRecipe(join(root, 'ghost-editor'), id)
const heartbeat = setInterval(() => { writeFileSync(join(directory, 'build/status.json'), JSON.stringify(job)); console.log(job.stage, job.progress) }, 30000)
try {
  const output = await finishRecipe({ root, directory, recipe, run, ffmpeg: ffmpeg!, codex, job, build: (round, feedback) => buildNative({ root, directory, recipe, run, codex, round, feedback }) })
  console.log('PASS', output)
} finally { clearInterval(heartbeat); writeFileSync(join(directory, 'build/status.json'), JSON.stringify(job)) }
