type Take = { a: number; b: number }
type Beat = { type?: string; at?: number; to?: number; text?: string; lines?: string[]; items?: unknown[]; parts?: unknown[] }

const textTypes = new Set(['big', 'chips', 'strike', 'quote', 'list', 'behind', 'textfx', 'type-composition', 'type-connector'])
const priority = (beat: Beat) => beat.type === 'textfx' || beat.type === 'type-composition' ? 3 : beat.type === 'big' || beat.type === 'behind' ? 2 : 1

export function limitReferenceTypography<T extends Beat>(beats: T[], takes: Take[]): T[] {
  const duration = takes.reduce((sum, take) => sum + Math.max(0, take.b - take.a), 0)
  const limit = Math.max(1, Math.min(5, Math.ceil(duration / 10)))
  const maxCoverage = duration * .28
  const candidates = beats.filter(beat => textTypes.has(beat.type || '') && Number.isFinite(beat.at) && Number.isFinite(beat.to) && beat.to! > beat.at!)
    .sort((a, b) => priority(b) - priority(a) || a.at! - b.at!)
  const kept = new Set<T>()
  let coverage = 0
  for (const beat of candidates) {
    const length = beat.to! - beat.at!
    if (kept.size >= limit || length > 2.5 || coverage + length > maxCoverage) continue
    if (beat.items && beat.items.length > 2) continue
    if (beat.type === 'big' && [...(beat.text || '')].length > 24) continue
    if (beat.type === 'textfx' && (beat.lines?.length || 0) > 2) continue
    if (beat.type === 'textfx' && beat.lines?.some(line => [...line].length > 30)) continue
    if (beat.type === 'type-composition' && (beat.parts?.length || 0) > 4) continue
    if (Array.from(kept).some(other => beat.at! < other.to! + 2.5 && beat.to! > other.at! - 2.5)) continue
    kept.add(beat)
    coverage += length
  }
  return beats.filter(beat => !textTypes.has(beat.type || '') || kept.has(beat))
}
