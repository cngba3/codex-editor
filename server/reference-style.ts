import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { saveStyleRecipe } from './recipe-contract'

export type ReferenceStudy = {
  name: string; about: string; basePreset: string; accent: string
  captionStyle: string; captionFont: string; captionSize: number; captionGroup: number; captionY: number; captionBackground: string
  headlineMode: 'stepped' | 'big' | 'scene' | 'none'; headlineFont: string; headlineColor: string; supportColor: string; serifColor: string; mixedFonts: boolean; headlineSize: number; headlineStep: number; headlineSlant: number
  transition: 'cut' | 'dissolve' | 'blur' | 'wipe'; zoom: 'none' | 'subtle' | 'punch'; blackFlash: boolean; needsMatte: boolean
  visualRules: string; motionRules: string; soundRules: string; limitations: string
  editRules?: string; assetRules?: string; recipeChecks?: string[]; visualMotifs?: string[]
}

export type StoredReferenceStyle = { id: string; name: string; about: string; basePreset: string; study: ReferenceStudy }

type Run = (command: string, args: string[], options?: { cwd?: string; input?: string }) => Promise<string>
const fonts = new Set(['Inter', 'Inter Tight', 'Montserrat', 'Oswald', 'Playfair Display', 'Unbounded', 'Geist'])
const captionStyles = new Set(['clean', 'editorial', 'hype', 'explosive', 'line-focus', 'neo-minimal', 'karaoke-fill', 'highlighter', 'mini'])
const bases = new Set(['clean', 'editorial', 'meme', 'cinematic', 'launch', 'kinetic', 'pop', 'amber-talk'])
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, Number.isFinite(value) ? value : low))
const color = (value: string, fallback: string) => /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
const safeBackground = (value: string) => /^(rgba?\([\d\s,.%]+\)|#[0-9a-fA-F]{6}|transparent)$/.test(value) ? value : 'rgba(11,14,18,0.62)'

export function loadReferenceStyle(stylesDir: string, id: string): StoredReferenceStyle | null {
  if (!/^ref-[a-f0-9]{8}$/.test(id)) return null
  const path = join(stylesDir, `${id}.json`)
  if (!existsSync(path)) return null
  try {
    const preset = JSON.parse(readFileSync(path, 'utf8')) as { _reference?: StoredReferenceStyle }
    return preset._reference?.id === id ? preset._reference : null
  } catch { return null }
}

export function listReferenceStyles(stylesDir: string): StoredReferenceStyle[] {
  if (!existsSync(stylesDir)) return []
  return readdirSync(stylesDir).filter(name => /^ref-[a-f0-9]{8}\.json$/.test(name))
    .map(name => loadReferenceStyle(stylesDir, name.slice(0, -5))).filter((style): style is StoredReferenceStyle => !!style)
}

export async function studyReference(input: {
  reference: string; directory: string; duration: number; styleId: string
  ffmpeg: string; codex: string; schema: string; ghost: string; run: Run
  onProgress?: (stage: string, progress: number) => void
}): Promise<StoredReferenceStyle> {
  const { reference, directory, duration, styleId, ffmpeg, codex, schema, ghost, run, onProgress } = input
  const studyDir = join(directory, 'reference-study')
  const frameDir = join(studyDir, 'frames')
  mkdirSync(frameDir, { recursive: true })
  const transcriptPath = join(studyDir, 'words.reference.json')
  onProgress?.('Chép lời video mẫu', 7)
  if (!existsSync(transcriptPath)) await run('uv', ['run', '--no-project', '--python', '3.11', '--with', 'faster-whisper', 'python', join(directory, '..', '..', 'server', 'transcribe.py'), reference, transcriptPath])
  const transcript = JSON.parse(readFileSync(transcriptPath, 'utf8')) as { segments: { start: number; end: number; text: string }[] }
  const framePattern = join(frameDir, 'frame-%04d.jpg')
  onProgress?.('Trích khung hình video mẫu', 10)
  if (readdirSync(frameDir).filter(name => /^frame-\d+\.jpg$/.test(name)).length < Math.max(2, Math.floor(duration) - 2)) {
    await run(ffmpeg, ['-v', 'error', '-y', '-i', reference, '-vf', 'fps=1,scale=720:-2', '-q:v', '4', framePattern])
  }
  const frames = readdirSync(frameDir).filter(name => /^frame-\d+\.jpg$/.test(name)).sort().map(name => join(frameDir, name))
  if (frames.length < 2) throw new Error('Không trích đủ khung hình từ video mẫu.')
  const originalPrompt = readFileSync(join(ghost, 'references', 'reference-study-prompt.md'), 'utf8')
  const chunks: string[] = []
  for (let i = 0; i < frames.length; i += 8) {
    onProgress?.(`Codex phân tích mẫu ${Math.floor(i / 8) + 1}/${Math.ceil(frames.length / 8)}`, 12 + Math.round(17 * i / frames.length))
    const group = frames.slice(i, i + 8)
    const from = i, to = Math.min(duration, i + group.length)
    const words = transcript.segments.filter(s => s.start < to + 0.5 && s.end > from - 0.5).map(s => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join('\n')
    const chunkPath = join(studyDir, `edit-log-${String(i / 8 + 1).padStart(2, '0')}.md`)
    if (!existsSync(chunkPath)) {
      const prompt = `${originalPrompt}\n\nAnalyse only seconds ${from.toFixed(1)}-${to.toFixed(1)} of this reference. The attached frames are one second apart and ordered from ${from.toFixed(1)}s. Audio transcript for this interval:\n${words || '(no speech detected)'}\n\nState positions in 1080x1920 coordinates, text size relative to width, and when text appears/disappears. Infer motion only where adjacent frames support it; otherwise mark unknown. Describe the actual style, not the closest built-in preset. Return a detailed edit-log table in Vietnamese. No tools.`
      await run(codex, ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', directory, ...group.flatMap(frame => ['-i', frame]), '-o', chunkPath, '-'], { input: prompt })
    }
    chunks.push(readFileSync(chunkPath, 'utf8'))
  }
  const log = `# Reference study: ${basename(reference)}\n\n- ${duration.toFixed(1)} seconds, ${frames.length} sampled frames, audio transcript\n- Motion and font names are estimates unless visible across frames.\n\n${chunks.join('\n\n')}`
  writeFileSync(join(studyDir, 'edit-log.md'), log, 'utf8')
  const output = join(studyDir, 'style-study.json')
  onProgress?.('Codex tổng hợp công thức style', 29)
  if (!existsSync(output)) {
    const prompt = `Create ONE reusable ghost-editor style from this reference study. Return JSON matching the schema. Write the name, about, visualRules, motionRules, soundRules, limitations, editRules, assetRules, recipeChecks and visualMotifs in natural Vietnamese with full diacritics. Keep only schema enum values, font names, color codes and technical identifiers in English. The name must be a short Vietnamese description of the visible look, not an English marketing title. Do not simply select a preset: basePreset is only the nearest render foundation, while all style-specific choices must come from the edit log. Preserve recurring typography, caption position and grouping, pacing, transition and sound language. visualMotifs must describe concrete observed actions with their speech trigger and timing; an empty array is correct when the sample does not reveal them. Use only fonts listed in the schema; if the exact font is unavailable choose the closest and say so in limitations. headlineMode stepped means multi-line mixed-size staggered display text; big means one large headline; scene means full-screen cards; none means captions only. Pixel sizes refer to 1080x1920. Keep text readable on phones: captions >=40, headlines >=68. headlineStep is horizontal staircase shift in pixels. headlineSlant is degrees between -8 and 8. captionBackground must be CSS rgba(), #RRGGBB or transparent. mixedFonts is true only if text appears behind the cut-out speaker. Do not invent elements absent from the study. Do not use tools.\n\n${log.slice(0, 85000)}`
    await run(codex, ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', directory, '--output-schema', schema, '-o', output, '-'], { input: prompt })
  }
  const raw = JSON.parse(readFileSync(output, 'utf8')) as ReferenceStudy
  if (!/[à-ỹđ]/i.test(`${raw.name} ${raw.about}`)) {
    try {
      const translatedPath = join(studyDir, 'style-display-vi.json')
      if (!existsSync(translatedPath)) {
        const prompt = `Translate this copied video style's name and short description into natural Vietnamese with full diacritics. Keep the visual meaning specific. Return only JSON with name and about. Name: ${raw.name}. Description: ${raw.about}. Do not translate font names or change the technical style data. No tools.`
        await run(codex, ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', directory, '--output-schema', join(dirname(schema), 'reference-style-display-schema.json'), '-o', translatedPath, '-'], { input: prompt })
      }
      const localized = JSON.parse(readFileSync(translatedPath, 'utf8')) as { name: string; about: string }
      if (localized.name?.trim() && localized.about?.trim() && /[à-ỹđ]/i.test(`${localized.name} ${localized.about}`)) {
        raw.name = localized.name.trim()
        raw.about = localized.about.trim()
      }
    } catch { /* Keep rendering if the optional translation request fails. */ }
    if (!/[à-ỹđ]/i.test(`${raw.name} ${raw.about}`)) {
      raw.name = `Phong cách video mẫu ${styleId.slice(-4)}`
      raw.about = 'Phong cách được học từ video mẫu, gồm cách đặt chữ, màu sắc và nhịp dựng.'
    }
  }
  const study: ReferenceStudy = {
    ...raw,
    name: String(raw.name || `Style ${styleId}`).slice(0, 80), about: String(raw.about || '').slice(0, 500),
    basePreset: bases.has(raw.basePreset) ? raw.basePreset : 'editorial',
    accent: color(raw.accent, '#F4E7A5'),
    captionStyle: captionStyles.has(raw.captionStyle) ? raw.captionStyle : 'mini',
    captionFont: fonts.has(raw.captionFont) ? raw.captionFont : 'Inter Tight',
    captionSize: clamp(raw.captionSize, 40, 96), captionGroup: Math.round(clamp(raw.captionGroup, 1, 10)), captionY: clamp(raw.captionY, 180, 1550), captionBackground: safeBackground(raw.captionBackground),
    headlineMode: ['stepped', 'big', 'scene', 'none'].includes(raw.headlineMode) ? raw.headlineMode : 'big',
    headlineFont: fonts.has(raw.headlineFont) ? raw.headlineFont : 'Inter Tight', headlineColor: color(raw.headlineColor, raw.accent), supportColor: color(raw.supportColor, '#FFFFFF'), serifColor: color(raw.serifColor, '#FFFFFF'), mixedFonts: !!raw.mixedFonts,
    headlineSize: clamp(raw.headlineSize, 68, 180), headlineStep: clamp(raw.headlineStep, 0, 140), headlineSlant: clamp(raw.headlineSlant, -8, 8),
    transition: ['cut', 'dissolve', 'blur', 'wipe'].includes(raw.transition) ? raw.transition : 'cut',
    zoom: ['none', 'subtle', 'punch'].includes(raw.zoom) ? raw.zoom : 'subtle', blackFlash: !!raw.blackFlash, needsMatte: !!raw.needsMatte,
    visualRules: String(raw.visualRules || '').slice(0, 3000), motionRules: String(raw.motionRules || '').slice(0, 3000), soundRules: String(raw.soundRules || '').slice(0, 3000), limitations: String(raw.limitations || '').slice(0, 2000),
    editRules: String(raw.editRules || '').slice(0, 3000), assetRules: String(raw.assetRules || '').slice(0, 3000), recipeChecks: Array.isArray(raw.recipeChecks) ? raw.recipeChecks.slice(0, 12).map(item => String(item).slice(0, 500)) : [], visualMotifs: Array.isArray(raw.visualMotifs) ? raw.visualMotifs.slice(0, 6).map(item => String(item).slice(0, 500)) : [],
  }
  return { id: styleId, name: study.name, about: study.about, basePreset: study.basePreset, study }
}

export function saveReferenceStyle(stylesDir: string, stored: StoredReferenceStyle) {
  const basePath = join(stylesDir, `${stored.basePreset}.json`)
  const base = JSON.parse(readFileSync(basePath, 'utf8')) as Record<string, unknown>
  const { study } = stored
  const preset = {
    ...base,
    _about: study.about,
    _reference: stored,
    brand: { ...((base.brand || {}) as object), accent: study.accent, font: study.captionFont, capSize: study.captionSize },
    captions: { ...((base.captions || {}) as object), style: study.captionStyle, font: study.captionFont, size: study.captionSize, group: study.captionGroup, y: study.captionY, background: study.captionBackground },
    composition: { font: study.headlineFont, color: study.headlineColor, supportColor: study.supportColor, serifColor: study.serifColor, mixedFonts: study.mixedFonts, size: study.headlineSize, step: study.headlineStep, slant: study.headlineSlant },
    matte: study.needsMatte,
    sfxProfile: /rich|many|dense|dày|nhiều/i.test(study.soundRules) ? 'standard' : 'restrained',
  }
  writeFileSync(join(stylesDir, `${stored.id}.json`), JSON.stringify(preset, null, 2), 'utf8')
  saveStyleRecipe(dirname(stylesDir), stored.id)
}

export function saveReferencePreview(stylesDir: string, styleId: string, directory: string) {
  const frameDir = join(directory, 'reference-study', 'frames')
  if (!existsSync(frameDir)) return false
  const frames = readdirSync(frameDir).filter(name => /^frame-\d+\.jpg$/.test(name)).sort()
  if (!frames.length) return false
  const previewDir = join(stylesDir, 'previews')
  mkdirSync(previewDir, { recursive: true })
  copyFileSync(join(frameDir, frames[Math.floor(frames.length * .4)]), join(previewDir, `${styleId}.jpg`))
  return true
}
