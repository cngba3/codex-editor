import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { pythonArgs, type Runner } from './native-pipeline'

function logTail(file: string) {
  if (!existsSync(file)) return ''
  const fd = openSync(file, 'r')
  try {
    const size = statSync(file).size, buffer = Buffer.alloc(Math.min(size, 4000))
    readSync(fd, buffer, 0, buffer.length, Math.max(0, size - buffer.length))
    return buffer.toString('utf8').trim()
  } finally { closeSync(fd) }
}

export async function runFinalsStage(input: { root: string; directory: string; manifest: string; stage: 'preview' | 'render'; run: Runner }) {
  const { root, directory, manifest, stage, run } = input
  const name = stage === 'preview' ? 'reel (preview)' : 'reel'
  let output = join(directory, 'build/finals', `${name}.mp4`)
  const log = join(directory, 'build/finals', `${name}.log`)
  let stdout = ''
  try {
    stdout = await run('uv', [...pythonArgs, join(root, 'ghost-editor/scripts/finals.py'), stage, '--batch', manifest, ...(stage === 'render' ? ['--no-nomusic'] : [])])
    if (stage === 'preview') {
      const reported = stdout.match(/^PREVIEW_OUTPUT\t([^\r\n]+)$/m)?.[1]
      if (reported && basename(reported) === reported) output = join(dirname(output), reported)
    }
    // Older finals.py versions can print FAILED while returning zero.
    if (/^(?:FAILED|HELD)\b/m.test(stdout)) throw new Error(stdout.trim())
    if (!existsSync(output) || statSync(output).size === 0) throw new Error(`Không tạo được file ${name}.mp4. ${stdout.trim()}`)
    if (statSync(output).mtimeMs < statSync(join(directory, 'index.html')).mtimeMs) throw new Error(`${name}.mp4 thuộc bản dựng cũ; chưa tạo được file cho lần chạy này.`)
    return output
  } catch (error) {
    if (error instanceof Error && error.name === 'JobCancelledError') throw error
    const cause = error instanceof Error ? error.message : String(error)
    let tail = ''
    try { tail = logTail(log) } catch { /* Keep the subprocess cause if its log cannot be read. */ }
    throw new Error(`Xuất ${stage === 'preview' ? 'preview' : 'MP4 cuối'} thất bại. ${cause}\nLog: ${log}${tail ? `\n${tail}` : ''}`)
  }
}
