import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type CodexModel = { id: string; name: string }

const settingsPath = join(process.cwd(), 'jobs', 'codex-settings.json')
const cachePath = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'models_cache.json')

export function availableModels(): CodexModel[] {
  try {
    const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as { models?: { slug?: unknown; display_name?: unknown; visibility?: unknown }[] }
    return (cache.models || [])
      .filter(model => model.visibility === 'list' && typeof model.slug === 'string' && /^[a-z0-9][a-z0-9.-]*$/.test(model.slug))
      .map(model => ({ id: model.slug as string, name: typeof model.display_name === 'string' ? model.display_name : model.slug as string }))
  } catch { return [] }
}

export function selectedModel(): string {
  try {
    const saved = JSON.parse(readFileSync(settingsPath, 'utf8')) as { model?: unknown }
    return typeof saved.model === 'string' ? saved.model : ''
  } catch { return '' }
}

export function saveSelectedModel(model: string) {
  if (model && !availableModels().some(item => item.id === model)) throw new Error('Model này không có trong danh sách Codex trên máy.')
  mkdirSync(join(process.cwd(), 'jobs'), { recursive: true })
  writeFileSync(settingsPath, JSON.stringify({ model }, null, 2), 'utf8')
}
