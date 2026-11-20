import type { Take, TimedSegment, TimedWord } from './amber-layout'

export type ReviewRole = 'white' | 'dark' | 'magenta' | 'coral' | 'teal' | 'yellow' | 'navy' | 'peach' | 'plum' | 'script' | 'serif' | 'muted' | 'ghost'
export type ReviewPlacement = 'upper' | 'upper-left' | 'upper-right' | 'center' | 'mid-left' | 'mid-right' | 'lower-left'
export type ReviewAlign = 'left' | 'center' | 'right'
export type ReviewMotion = 'rise' | 'spread' | 'slam' | 'flicker' | 'jitter' | 'flash' | 'wipe' | 'drift' | 'cut'
export type ReviewPart = { text: string; role: ReviewRole; row: number; at: number; motion: ReviewMotion; words: { text: string; at: number }[] }
export type ReviewCandidate = { kind: 'talk' | 'display'; placement: ReviewPlacement; align?: ReviewAlign; text: string; at: number; to: number; parts: (Omit<ReviewPart, 'at' | 'motion' | 'words'> & { motion?: ReviewMotion })[] }
export type ReviewBeat = { type: 'review-bds-type'; kind: ReviewCandidate['kind']; placement: ReviewPlacement; align: ReviewAlign; text: string; at: number; to: number; parts: ReviewPart[] }

const token = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '')
const spokenText = (words: TimedWord[]) => words.map(word => word.word.trim()).join(' ').replace(/\s+([,.;?!])/g, '$1')
const roles = new Set<ReviewRole>(['white', 'dark', 'magenta', 'coral', 'teal', 'yellow', 'navy', 'peach', 'plum', 'script', 'serif', 'muted', 'ghost'])
const placements = new Set<ReviewPlacement>(['upper', 'upper-left', 'upper-right', 'center', 'mid-left', 'mid-right', 'lower-left'])
const aligns = new Set<ReviewAlign>(['left', 'center', 'right'])
const motions = new Set<ReviewMotion>(['rise', 'spread', 'slam', 'flicker', 'jitter', 'flash', 'wipe', 'drift', 'cut'])
const defaultMotion = (role: ReviewRole): ReviewMotion => role === 'script' ? 'wipe' : role === 'ghost' ? 'drift' : ['magenta', 'coral', 'teal', 'yellow', 'navy', 'peach', 'plum'].includes(role) ? 'slam' : 'rise'
const defaultAlign = (placement: ReviewPlacement): ReviewAlign => placement.endsWith('left') ? 'left' : placement.endsWith('right') ? 'right' : 'center'

export function buildReviewBdsBeats(candidates: ReviewCandidate[], segments: TimedSegment[], takes: Take[]): ReviewBeat[] {
  const source = segments.flatMap(segment => segment.words || [])
  const output: ReviewBeat[] = []
  let lastFlash = -Infinity
  let lastGlitch = -Infinity
  let lastWordEnd = -Infinity
  for (const candidate of [...candidates].sort((a, b) => a.at - b.at)) {
    if (!['talk', 'display'].includes(candidate.kind) || !placements.has(candidate.placement) || !Number.isFinite(candidate.at) || !Number.isFinite(candidate.to) || candidate.to - candidate.at < .4 || candidate.to - candidate.at > 4.5) continue
    const take = takes.find(item => candidate.at >= item.a - .05 && candidate.to <= item.b + .05)
    if (!take) continue
    const wanted = candidate.text.trim().split(/\s+/).map(token).filter(Boolean)
    if (!wanted.length || wanted.length > 16 || !candidate.parts?.length || candidate.parts.length > 6) continue
    const nearby = source.filter(word => word.start >= Math.max(take.a, candidate.at - .5) && word.end <= Math.min(take.b, candidate.to + .5))
    const start = nearby.findIndex((_, index) => wanted.every((value, offset) => value === token(nearby[index + offset]?.word || '')))
    if (start < 0) continue
    const matched = nearby.slice(start, start + wanted.length)
    let cursor = 0
    const parts: ReviewPart[] = []
    for (const part of candidate.parts) {
      const tokens = part.text.trim().split(/\s+/).map(token).filter(Boolean)
      if (!tokens.length || !roles.has(part.role) || !Number.isInteger(part.row) || part.row < 0 || part.row > 3 || part.row < (parts.at(-1)?.row ?? 0) || !tokens.every((value, offset) => value === token(matched[cursor + offset]?.word || ''))) { parts.length = 0; break }
      const group = matched.slice(cursor, cursor + tokens.length)
      let motion = part.motion && motions.has(part.motion) ? part.motion : defaultMotion(part.role)
      if (motion === 'flash' && group[0].start - lastFlash < 12) motion = 'slam'
      if (['flicker', 'jitter'].includes(motion) && group[0].start - lastGlitch < 4) motion = 'slam'
      // Fast glitch treatments belong to one meaningful accent, not every word.
      if (['flicker', 'jitter', 'flash'].includes(motion) && parts.some(previous => ['flicker', 'jitter', 'flash'].includes(previous.motion))) { parts.length = 0; break }
      parts.push({ text: spokenText(group), role: part.role, row: part.row, at: group[0].start, motion, words: group.map(word => ({ text: word.word.trim(), at: word.start })) })
      cursor += tokens.length
    }
    if (!parts.length || cursor !== matched.length) continue
    const at = Math.max(take.a, matched[0].start)
    const to = Math.min(take.b, Math.max(candidate.to, matched.at(-1)!.end + .16))
    const previous = output.at(-1)
    if (previous && at < previous.to - .02) {
      // A spoken word can start exactly as the previous word ends. Trim only
      // the optional hold; never trim a word that is still being spoken.
      if (previous.to - at > .35 || lastWordEnd > at + .02) continue
      previous.to = at
    }
    const placement = candidate.kind === 'talk' && !['upper', 'upper-left', 'upper-right'].includes(candidate.placement) ? 'upper' : candidate.placement
    const align = candidate.align && aligns.has(candidate.align) ? candidate.align : defaultAlign(placement)
    output.push({ type: 'review-bds-type', kind: candidate.kind, placement, align, text: spokenText(matched), at, to, parts })
    lastWordEnd = matched.at(-1)!.end
    for (const part of parts) {
      if (part.motion === 'flash') lastFlash = part.at
      if (['flicker', 'jitter'].includes(part.motion)) lastGlitch = part.at
    }
    if (output.length >= 30) break
  }
  return output
}
