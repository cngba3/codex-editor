export type TimedWord = { word: string; start: number; end: number }
export type TimedSegment = { start: number; end: number; text: string; words?: TimedWord[] }
export type Take = { a: number; b: number }
export type AmberCandidate = { mode: 'progressive' | 'black'; text: string; at: number; to: number }
export type AmberPart = { text: string; at: number; role: 'serif' | 'hero' | 'support' | 'connector' }
export type AmberBeat = {
  type: 'type-composition' | 'black-flash' | 'type-connector'
  at: number
  to: number
  text: string
  placement?: string
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

function splitParts(words: TimedWord[], variant: number): AmberPart[] {
  const openerCount = connectorLength(words)
  const opener = openerCount ? words.slice(0, openerCount) : []
  const body = words.slice(openerCount)
  const count = body.length
  const groups: TimedWord[][] = count <= 2
    ? body.map(word => [word])
    : count === 3
      ? [body.slice(0, 1), body.slice(1)]
      : count <= 7
        ? [body.slice(0, 1), body.slice(1, Math.min(3, count)), body.slice(Math.min(3, count))].filter(group => group.length)
        : [body.slice(0, 2), body.slice(2, 4), body.slice(4, Math.ceil((count + 4) / 2)), body.slice(Math.ceil((count + 4) / 2))].filter(group => group.length)
  const patterns: AmberPart['role'][][] = [
    ['serif', 'hero', 'support', 'hero'],
    ['support', 'hero', 'serif', 'support'],
    ['hero', 'serif', 'support', 'hero'],
    ['serif', 'support', 'hero', 'support'],
  ]
  const roles = patterns[variant % patterns.length]
  return [
    ...(opener.length ? [{ text: textOf(opener) + (openerCount === 1 ? '...' : ''), at: opener[0].start, role: 'connector' as const }] : []),
    ...groups.map((group, i) => ({ text: textOf(group), at: group[0].start, role: roles[Math.min(i, roles.length - 1)] })),
  ]
}

export function buildAmberBeats(candidates: AmberCandidate[], segments: TimedSegment[], takes: Take[], layouts: string[], illustration?: { at: number; to: number }): AmberBeat[] {
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
  let blackIndex = kept.findIndex(item => item.candidate.mode === 'black')
  if (blackIndex < 0 && kept.length >= 4) blackIndex = Math.floor(kept.length / 2)
  const beats = kept.map((item, i): AmberBeat => {
    const at = Math.max(item.take.a, Math.min(item.candidate.at, item.words[0].start))
    const to = Math.min(item.take.b, Math.max(item.candidate.to, item.words.at(-1)!.end + 0.16))
    const text = textOf(item.words)
    if (i === blackIndex) return { type: 'black-flash', at, to, text }
    const parts = splitParts(item.words, i)
    const placement = parts[0]?.role === 'connector' ? 'connector-split' : parts.length >= 4 ? 'split-safe' : layouts.length ? layouts[i % layouts.length] : 'lower-center'
    return { type: 'type-composition', at, to, text, placement, parts }
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
  return beats.sort((a, b) => a.at - b.at)
}
