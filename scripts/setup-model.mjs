import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const model = ['tiny', 'small', 'medium'].includes(process.argv[2]) ? process.argv[2] : 'small'
const directory = join(process.cwd(), '.cache', `faster-whisper-${model}`)
mkdirSync(directory, { recursive: true })
for (const file of ['config.json', 'tokenizer.json', 'vocabulary.txt', 'model.bin']) {
  const target = join(directory, file)
  const minimum = file === 'model.bin' ? ({ tiny: 70_000_000, small: 400_000_000, medium: 1_400_000_000 })[model] : 100
  if (existsSync(target) && statSync(target).size > minimum) continue
  const url = `https://huggingface.co/Systran/faster-whisper-${model}/resolve/main/${file}`
  const result = spawnSync('curl.exe', ['-fLsS', '--retry', '10', '--retry-all-errors', '--retry-delay', '2', '-C', '-', '-o', target, url], { stdio: 'inherit', windowsHide: true })
  if (result.status !== 0 || !existsSync(target) || statSync(target).size < minimum) throw new Error(`Không tải được ${file}`)
  console.log(`${file}: ready`)
}
console.log(`Model ${model} đã sẵn sàng tại ${directory}`)
