import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import ffmpeg from 'ffmpeg-static'

const root = path.resolve('ghost-editor/library')
const sfx = JSON.parse(fs.readFileSync(path.join(root, 'sfx/manifest.json'), 'utf8'))
const music = JSON.parse(fs.readFileSync(path.join(root, 'music/manifest.json'), 'utf8'))
const ids = process.argv.slice(2)

function command(binary, args) {
  const result = spawnSync(binary, args, { stdio: 'inherit', windowsHide: true })
  if (result.status !== 0) throw new Error(`${binary} failed (${result.status})`)
}

for (const id of ids) {
  if (id === 'face-model') {
    const output = path.join(root, 'models', 'face_detection_yunet_2023mar.onnx')
    fs.mkdirSync(path.dirname(output), { recursive: true })
    if (!fs.existsSync(output)) command('curl.exe', ['-fLsS', '--retry', '10', '--retry-all-errors', '--retry-delay', '2', '-o', output, 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx'])
    console.log('face model ready')
  } else if (sfx[id]) {
    const item = sfx[id]
    const output = path.join(root, 'sfx', item.file)
    if (fs.existsSync(output)) continue
    if (!item.licensed || !item.mixkit_id) throw new Error(`SFX ${id} has no licensed pinned source`)
    const source = output + '.download.mp3'
    const url = `https://assets.mixkit.co/active_storage/sfx/${item.mixkit_id}/${item.mixkit_id}-preview.mp3`
    command('curl.exe', ['-fLsS', '--retry', '10', '--retry-all-errors', '--retry-delay', '2', '-o', source, url])
    command(ffmpeg, ['-v', 'error', '-y', '-i', source, '-t', String(item.duration || 1), '-ar', '48000', '-ac', '2', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', output])
    fs.unlinkSync(source)
    console.log(`restored SFX ${id}`)
  } else if (music[id]) {
    const item = music[id]
    const output = path.join(root, 'music', item.file)
    if (fs.existsSync(output)) continue
    const url = item.url || item.source?.match(/https:\/\/assets\.mixkit\.co\/music\/\d+\/\d+\.mp3/)?.[0]
    if (!url) throw new Error(`Music ${id} has no downloadable source in its manifest`)
    command('curl.exe', ['-fLsS', '--retry', '3', '--retry-all-errors', '--retry-delay', '2', '-o', output, url])
    console.log(`restored music ${id}`)
  } else throw new Error(`Unknown media ${id}`)
}
