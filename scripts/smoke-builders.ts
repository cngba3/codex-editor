import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, delimiter, join, resolve } from 'node:path'
import ffmpeg from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'
import { pythonArgs } from '../server/native-pipeline'

const root = process.cwd(), fixture = resolve('.cache/native-whiteboard-smoke')
const cli = join(root, 'node_modules/hyperframes/bin/hyperframes.mjs')
const env = { ...process.env, PYTHONUTF8: '1', PATH: [dirname(ffmpeg!), dirname(ffprobe.path), process.env.PATH].join(delimiter), HYPERFRAMES_CLI_PATH: cli, HYPERFRAMES_FFMPEG_PATH: ffmpeg! }
const words = JSON.parse(readFileSync(join(fixture, 'build/words.cut.json'), 'utf8')).segments.flatMap((s: any) => s.words)
for (const id of ['caption-news', 'seoul-list']) {
  const project = resolve(`.cache/native-${id}-smoke`)
  mkdirSync(join(project, 'build'), { recursive: true })
  cpSync(join(fixture, 'assets'), join(project, 'assets'), { recursive: true })
  for (const file of ['words.cut.json', 'words.json', 'face.json', 'native-context.json']) cpSync(join(fixture, 'build', file), join(project, 'build', file))
  const call = (method: string, args: unknown[], kwargs = {}) => ({ target: 'R', method, args_json: JSON.stringify(args), kwargs_json: JSON.stringify(kwargs), result: '' })
  const operations = id === 'seoul-list'
    ? [call('compose', [{ title: 'Smoke', fps: 30, tail: 0, clips: 'clips', sfx: 'none', shots: [{ at: 0, clip: 'face', in: 0 }], beats: [{ type: 'word', at: 0, to: 1.4, big: words.slice(0, 3).map((w: any) => w.word).join(' ') }] }])]
    : [call('plates', [[[0, 't']]]), ...Array.from({ length: Math.ceil(words.length / 4) }, (_, i) => {
      const group = words.slice(i * 4, i * 4 + 4)
      return call('cap', [group[0].start, Math.min(6, group.at(-1).end + .05), [group.map((w: any) => [w.word.trim(), w.start])]], { hook: i === 0 })
    })]
  const plan = { rationale: 'Builder smoke test', options_json: JSON.stringify(id === 'seoul-list' ? {} : { dur: 6, title: 'Smoke', lang: 'vi' }), build_json: '{}', operations }
  const path = join(project, 'build/native-plan-0.json'); writeFileSync(path, JSON.stringify(plan))
  const built = spawnSync('uv', [...pythonArgs, join(root, 'server/native-recipe.py'), 'build', id, project, path], { cwd: root, env, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 })
  console.log(id, built.stdout, built.stderr)
  if (built.status !== 0) process.exit(built.status || 1)
  const lint = spawnSync(process.execPath, [cli, 'lint'], { cwd: project, env, encoding: 'utf8', windowsHide: true })
  console.log(lint.stdout, lint.stderr)
  if (lint.status !== 0) process.exit(lint.status || 1)
}
