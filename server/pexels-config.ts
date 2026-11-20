import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const savedKeyFile = () => join(process.cwd(), '.pexels-key')

export function getPexelsKey(): string {
  if (process.env.PEXELS_API_KEY?.trim()) return process.env.PEXELS_API_KEY.trim()
  const saved = savedKeyFile()
  if (existsSync(saved)) return readFileSync(saved, 'utf8').trim()
  const envFile = join(process.cwd(), '.env.local')
  return existsSync(envFile) ? readFileSync(envFile, 'utf8').match(/^PEXELS_API_KEY=(.+)$/m)?.[1]?.trim() || '' : ''
}

export function savePexelsKey(value: string): void {
  const key = value.trim()
  if (key && (key.length < 20 || key.length > 200 || /\s/.test(key))) throw new Error('Pexels API key không hợp lệ.')
  const file = savedKeyFile()
  if (!key) { if (existsSync(file)) unlinkSync(file); return }
  writeFileSync(file, key, { encoding: 'utf8', mode: 0o600 })
}
