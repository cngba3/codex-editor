export type TimedWord = { word: string; start: number; end: number }
export type TimedSegment = { start: number; end: number; text: string; words?: TimedWord[]; avg_logprob?: number }
export type Take = { a: number; b: number }
export type AmberCandidate = { mode: 'progressive' | 'black'; text: string; at: number; to: number; layout?: 'compact' | 'stepped' | 'split'; placement?: 'upper-center' | 'lower-center'; parts?: { text: string; role: AmberPart['role']; row?: number }[] }
export type AmberPart = { text: string; at: number; role: 'serif' | 'hero' | 'support' | 'connector'; row?: number }
export type AmberBeat = {
  type: 'type-composition' | 'black-flash' | 'type-connector'
  at: number
  to: number
  text: string
  placement?: string
  layout?: 'compact' | 'stepped' | 'split'
  parts?: AmberPart[]
}

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u0111\u0110]/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '')
const token = (value: string) => normalized(value)
const textOf = (words: TimedWord[]) => words.map(word => word.word.trim()).join(' ').replace(/\s+([,.;?!])/g, '$1')

function matchWords(candidate: AmberCandidate, source: TimedWord[]) {
  const wanted = candidate.text.trim().split(/\s+/).map(token).filter(Boolean)
  const nearby = source.filter(word => word.start >= candidate.at - 0.55 && word.start < candidate.to + 0.45)
  if (!nearby.length) return []
  if (wanted.length) {
    for (let i = 0; i <= nearby.length - wanted.length; i++) {
      if (wanted.every((value, offset) => value === token(nearby[i + offset].word))) return nearby.slice(i, i + wanted.length)
    }
  }
  // ASR and Codex may punctuate a phrase differently. Keep the text that was
  // actually transcribed in the chosen time window so the onset stays true.
  const inside = nearby.filter(word => word.start >= candidate.at - 0.12 && word.start < candidate.to + 0.12)
  return (inside.length ? inside : nearby).slice(0, 16)
}

function connectorLength(words: TimedWord[]) {
  const first = token(words[0]?.word || '')
  const second = token(words[1]?.word || '')
  if ((first === 'co' && second === 'le') || (first === 'da' && second === 'tung')) return 2
  return new Set(['nhung', 'tuy', 'con', 'roi', 'vay']).has(first) ? 1 : 0
}

function splitParts(words: TimedWord[], planned: AmberCandidate['parts']): AmberPart[] {
  // The planner supplies semantic phrases, never coordinates or invented times.
  // Require a complete, ordered match before applying its emphasis choices.
  if (planned?.length && planned.length <= 6) {
    let cursor = 0
    const result: AmberPart[] = []
    for (const part of planned) {
      const wanted = part.text.trim().split(/\s+/).map(token).filter(Boolean)
      if (!['serif', 'hero', 'support', 'connector'].includes(part.role) || !wanted.length ||
          !wanted.every((value, i) => value === token(words[cursor + i]?.word || ''))) return []
      const group = words.slice(cursor, cursor + wanted.length)
      if (part.row !== undefined && (!Number.isInteger(part.row) || part.row < 0 || part.row > 5 || part.row < (result.at(-1)?.row ?? 0))) return []
      result.push({ text: textOf(group), at: group[0].start, role: part.role, ...(part.row !== undefined ? { row: part.row } : {}) })
      cursor += wanted.length
    }
    return cursor === words.length ? result : []
  }
  // Legacy/cached plans have no semantic groups. A short intact phrase is
  // safer than highlighting arbitrary syllables; long phrases stay subtitles.
  const openerCount = connectorLength(words)
  const opener = openerCount ? words.slice(0, openerCount) : []
  const body = words.slice(openerCount)
  if (!body.length || body.length > 6) return []
  return [
    ...(opener.length ? [{ text: textOf(opener) + (openerCount === 1 ? '...' : ''), at: opener[0].start, role: 'connector' as const }] : []),
    { text: textOf(body), at: body[0].start, role: 'hero' },
  ]
}

export function buildAmberBeats(candidates: AmberCandidate[], segments: TimedSegment[], takes: Take[], layouts: string[], illustration?: { at: number; to: number }, options: { blackFlash?: boolean } = {}): AmberBeat[] {
  const source = segments.flatMap(segment => segment.words || []).filter(word => takes.some(take => word.start >= take.a - 0.05 && word.end <= take.b + 0.05))
  const kept: { candidate: AmberCandidate; words: TimedWord[]; take: Take }[] = []
  for (const candidate of [...candidates].sort((a, b) => a.at - b.at)) {
    if (!Number.isFinite(candidate.at) || !Number.isFinite(candidate.to) || candidate.to - candidate.at < 0.5 || candidate.to - candidate.at > 4.8) continue
    const take = takes.find(item => candidate.at >= item.a - 0.05 && candidate.to <= item.b + 0.05)
    if (!take || kept.some(item => candidate.at < item.candidate.to + 0.18 && candidate.to > item.candidate.at - 0.18)) continue
    if (illustration && candidate.at < illustration.to + 0.1 && candidate.to > illustration.at - 0.1) continue
    const words = matchWords(candidate, source).filter(word => word.start >= take.a - 0.05 && word.end <= take.b + 0.05).slice(0, 16)
    if (!words.length) continue
    kept.push({ candidate, words, take })
    if (kept.length >= 8) break
  }
  if (!kept.length) return []
  const blackIndex = options.blackFlash === true ? kept.findIndex(item => item.candidate.mode === 'black') : -1
  const beats = kept.map((item, i): AmberBeat => {
    const at = Math.max(item.take.a, Math.min(item.candidate.at, item.words[0].start))
    const to = Math.min(item.take.b, Math.max(item.candidate.to, item.words.at(-1)!.end + 0.16))
    const text = textOf(item.words)
    if (i === blackIndex) return { type: 'black-flash', at, to, text }
    const parts = splitParts(item.words, item.candidate.parts)
    const placement = parts[0]?.role === 'connector' ? 'connector-split' : layouts.length ? layouts[i % layouts.length] : 'lower-center'
    return { type: 'type-composition', at, to, text, placement: item.candidate.placement || placement, layout: item.candidate.layout || 'compact', parts }
  })
  // A discourse opener at a take boundary can be its own short top accent,
  // even when the planner did not choose the surrounding sentence.
  for (const take of takes.slice(1)) {
    const opening = source.filter(word => word.start >= take.a - .05 && word.start < take.a + .3).slice(0, 2)
    const length = connectorLength(opening)
    if (!length) continue
    const at = opening[0].start
    const to = Math.min(take.b, at + 1.1, illustration && illustration.at > at ? illustration.at : Infinity, ...beats.filter(beat => beat.at > at).map(beat => beat.at))
    if (to - at < .45 || beats.some(beat => at < beat.to && to > beat.at)) continue
    beats.push({ type: 'type-connector', at, to, text: textOf(opening.slice(0, length)) + (length === 1 ? '...' : '') })
  }
  return beats.filter(beat => beat.type !== 'type-composition' || beat.parts?.length).sort((a, b) => a.at - b.at)
}
