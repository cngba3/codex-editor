import type { TimedSegment, TimedWord, Take } from './amber-layout'

export type PopCandidate = { text: string; at: number; to: number; kicker: string }
export type PopBeat = { type: 'title'; popStyle: true; at: number; to: number; text: string; kicker: string; kickerAt: number; words: { text: string; at: number }[]; color: string; sfx: string }

const token = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '')
const textOf = (words: TimedWord[]) => words.map(word => word.word.trim()).join(' ').replace(/\s+([,.;?!])/g, '$1')

export function buildPopBeats(candidates: PopCandidate[], segments: TimedSegment[], takes: Take[]): PopBeat[] {
  const source = segments.flatMap(segment => segment.words || [])
  const beats: PopBeat[] = []
  for (const candidate of [...candidates].sort((a, b) => a.at - b.at)) {
    if (!Number.isFinite(candidate.at) || !Number.isFinite(candidate.to) || candidate.to - candidate.at < 0.6 || candidate.to - candidate.at > 4.5) continue
    const take = takes.find(item => candidate.at >= item.a - 0.1 && candidate.to <= item.b + 0.1)
    if (!take || beats.some(beat => candidate.at < beat.to + 0.15 && candidate.to > beat.at - 0.15)) continue
    const wanted = candidate.text.trim().split(/\s+/).map(token).filter(Boolean)
    if (wanted.length < 1 || wanted.length > 11) continue
    const nearby = source.filter(word => word.start >= Math.max(take.a, candidate.at - 0.5) && word.end <= Math.min(take.b, candidate.to + 0.5))
    const start = nearby.findIndex((_, index) => wanted.every((value, offset) => value === token(nearby[index + offset]?.word || '')))
    if (start < 0) continue
    const matched = nearby.slice(start, start + wanted.length)
    const kickerTokens = candidate.kicker.trim().split(/\s+/).map(token).filter(Boolean)
    const kickerCount = kickerTokens.length <= 3 && kickerTokens.every((value, index) => value === token(matched[index]?.word || '')) ? kickerTokens.length : 0
    const body = matched.slice(kickerCount)
    if (!body.length || textOf(body).length > 52) continue
    const at = Math.max(take.a, matched[0].start)
    const to = Math.min(take.b, Math.max(candidate.to, matched.at(-1)!.end + 0.25))
    if (to - at > 4.5) continue
    beats.push({ type: 'title', popStyle: true, at, to, text: textOf(body), kicker: textOf(matched.slice(0, kickerCount)), kickerAt: at,
      words: body.map(word => ({ text: word.word.trim(), at: word.start })), color: '#FFE34A', sfx: 'pop-1' })
    if (beats.length >= 10) break
  }
  const firstTake = takes[0]
  if (firstTake && !beats.some(beat => beat.at <= firstTake.a + 2.7)) {
    const opening = source.filter(word => word.start >= firstTake.a - 0.05 && word.end <= Math.min(firstTake.b, firstTake.a + 2.8)).slice(0, 7)
    if (opening.length >= 3) {
      const limit = Math.min(firstTake.b, beats[0]?.at ? beats[0].at - 0.16 : Infinity)
      const available = opening.filter(word => word.end < limit)
      if (available.length >= 3) {
        const kickerCount = available.length >= 5 ? 2 : 0
        const body = available.slice(kickerCount)
        beats.unshift({ type: 'title', popStyle: true, at: available[0].start, to: Math.min(limit, available.at(-1)!.end + 0.26),
          text: textOf(body), kicker: textOf(available.slice(0, kickerCount)), kickerAt: available[0].start,
          words: body.map(word => ({ text: word.word.trim(), at: word.start })), color: '#FFE34A', sfx: 'pop-1' })
      }
    }
  }
  return beats
}
