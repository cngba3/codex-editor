import type { TimedSegment } from './amber-layout'

type Word = { word: string; start: number; end: number }
const normalize = (value: string) => value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export function speechCandidates(segments: TimedSegment[]) {
  const units: { a: number; b: number; text: string; quality: number; confidence: number | null; words: Word[] }[] = []
  for (const segment of segments) {
    const source = (segment.words || []).filter(word => Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start)
    const confidence = Number.isFinite(segment.avg_logprob) ? Math.round(Math.exp(segment.avg_logprob!) * 100) / 100 : null
    if (!source.length) { units.push({ a: segment.start, b: segment.end, text: segment.text, quality: 0, confidence, words: [] }); continue }
    let group: Word[] = []
    const flush = () => {
      if (!group.length) return
      const text = group.map(word => word.word.trim()).join(' ').replace(/\s+/g, ' ').trim()
      const span = group.at(-1)!.end - group[0].start
      const filled = group.reduce((n, word) => n + word.end - word.start, 0)
      units.push({ a: group[0].start, b: group.at(-1)!.end, text, quality: Math.round((filled / Math.max(span, .01)) * 100) / 100, confidence, words: group })
      group = []
    }
    for (const word of source) {
      const previous = group.at(-1)
      if (previous && (word.start - previous.end > .65 || /[.!?…]$/.test(previous.word.trim()))) flush()
      group.push(word)
    }
    flush()
  }
  const duplicates: number[][] = []
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = normalize(units[i].text).split(' ').filter(Boolean)
    const b = normalize(units[j].text).split(' ').filter(Boolean)
    if (Math.min(a.length, b.length) < 3) continue
    const overlap = a.filter(word => b.includes(word)).length / Math.max(a.length, b.length)
    if (overlap >= .72) duplicates.push([i, j])
  }
  return { units: units.map(({ words: _words, ...unit }) => unit), duplicates }
}

export function alignTakeEdges(takes: { a: number; b: number }[], segments: TimedSegment[]) {
  const words = segments.flatMap(segment => segment.words || []).filter(word => word.end > word.start)
  return takes.map(take => {
    let { a, b } = take
    for (const word of words) {
      if (a > word.start + .03 && a < word.end - .03) a = word.start
      if (b > word.start + .03 && b < word.end - .03) b = word.end
    }
    return { a: Math.round(a * 1000) / 1000, b: Math.round(b * 1000) / 1000 }
  })
}
