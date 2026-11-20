import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAmberBeats, type AmberCandidate } from '../server/amber-layout'
import { amberType } from '../ghost-editor/scripts/lib/amber-type.mjs'
import { limitReferenceTypography } from '../server/reference-typography'

const words = 'có cần phải giỏi chơi game'.split(' ').map((word, i) => ({ word, start: i * .3, end: i * .3 + .25 }))
const segments = [{ start: 0, end: 2, text: '', words }]
const candidate: AmberCandidate = { mode: 'progressive', text: 'có cần phải giỏi chơi game', at: 0, to: 2, layout: 'compact', parts: [
  { text: 'có cần', role: 'support', row: 0 }, { text: 'phải giỏi', role: 'serif', row: 0 }, { text: 'chơi game', role: 'hero', row: 1 },
] }
test('semantic runs preserve Vietnamese compounds, shared rows and source timing', () => {
  const [beat] = buildAmberBeats([candidate], segments, [{ a: 0, b: 3 }], [])
  assert.deepEqual(beat.parts?.map(p => [p.text, p.at, p.row]), [['có cần', 0, 0], ['phải giỏi', .6, 0], ['chơi game', 1.2, 1]])
  assert.equal(beat.layout, 'compact')
})
test('invented or reordered emphasis cannot silently replace spoken words', () => {
  for (const parts of [[{ text: 'chơi game có cần phải giỏi', role: 'hero' as const }], [{ text: 'có cần thật giỏi chơi game', role: 'hero' as const }]]) {
    assert.equal(buildAmberBeats([{ ...candidate, parts }], segments, [{ a: 0, b: 3 }], []).length, 0)
  }
})
test('four progressive phrases never trigger an automatic black flash', () => {
  const candidates = Array.from({ length: 4 }, (_, i) => ({ ...candidate, at: i * 3, to: i * 3 + 2 }))
  const all = candidates.map((c, i) => ({ start: c.at, end: c.to, text: '', words: words.map(w => ({ ...w, start: w.start + i * 3, end: w.end + i * 3 })) }))
  const beats = buildAmberBeats(candidates, all, [{ a: 0, b: 12 }], [])
  assert.equal(beats.length, 4)
  assert.ok(beats.every(b => b.type === 'type-composition'))
  assert.equal(buildAmberBeats([{ ...candidate, mode: 'black' }], segments, [{ a: 0, b: 3 }], [])[0].type, 'type-composition')
  assert.equal(buildAmberBeats([{ ...candidate, mode: 'black' }], segments, [{ a: 0, b: 3 }], [], undefined, { blackFlash: true })[0].type, 'black-flash')
})
test('Interview keeps adjacent spoken compositions instead of thinning them to generic titles', () => {
  const phrases = ['one two three', 'four five six', 'seven eight nine', 'ten eleven twelve']
  const timed = phrases.flatMap((phrase, index) => phrase.split(' ').map((word, offset) => ({ word, start: index * 2 + offset * .5, end: index * 2 + offset * .5 + .4 })))
  const candidates: AmberCandidate[] = phrases.map((text, index) => ({ mode: 'progressive', text, at: index * 2, to: index * 2 + 2, parts: [{ text: text.split(' ')[0], role: 'hero', row: 0 }, { text: text.split(' ').slice(1).join(' '), role: 'support', row: 1 }] }))
  const takes = [{ a: 0, b: 8 }]
  const beats = buildAmberBeats(candidates, [{ start: 0, end: 8, text: '', words: timed }], takes, [])
  assert.equal(beats.length, 4)
  assert.equal(limitReferenceTypography(beats, takes, 'interview').length, 4)
  assert.ok(limitReferenceTypography(beats, takes).length < 4)
})
test('Interview promotes a spoken support phrase when the planner omits a lime hero', () => {
  const candidateWithoutHero: AmberCandidate = { ...candidate, parts: [
    { text: 'có cần', role: 'connector', row: 0 },
    { text: 'phải giỏi chơi game', role: 'support', row: 1 },
  ] }
  const [beat] = buildAmberBeats([candidateWithoutHero], segments, [{ a: 0, b: 3 }], [], undefined, { ensureHero: true })
  assert.equal(beat.parts?.filter(part => part.role === 'hero').length, 1)
  assert.equal(beat.parts?.find(part => part.role === 'hero')?.text, 'phải giỏi chơi game')
})

test('Amber keeps a detached opener and three distinct chest tiers', () => {
  const timeline: string[] = []
  const html = amberType({
    parts: [
      { text: 'Đã từng', role: 'connector', row: 0, at: 0 },
      { text: 'đứng trên', role: 'support', row: 1, at: .3 },
      { text: 'sân khấu', role: 'hero', row: 2, at: .8 },
      { text: 'dẫn trò chơi', role: 'serif', row: 3, at: 1.3 },
    ], layout: 'split', placement: 'lower-center', head: { seen: true, top: 300, eyes: 500, mouth: 840 },
    id: 'amber', t0: 0, t1: 2, E: (value: number) => value, esc: (value: string) => value,
    tl: timeline, accent: '#F4E7A5',
  })
  const tops = [...html.matchAll(/id="amber-row\d+"[^>]*top:(\d+(?:\.\d+)?)px/g)].map(match => Number(match[1]))
  assert.equal(tops.length, 4)
  assert.ok(tops[0] < 300 && tops[1] >= 1010)
  assert.ok(tops[1] < tops[2] && tops[2] < tops[3])
  assert.match(html, /font-family:'Playfair Display'/)
  assert.match(html, /color:#F4E7A5/)
  assert.match(html, /id="amber-row1"[^>]*translateX\(-90px\)/)
  assert.match(html, /id="amber-row2"[^>]*translateX\(0px\)/)
  assert.match(html, /id="amber-row3"[^>]*translateX\(110px\)/)
  assert.match(html, /font-size:38px/)
  assert.equal(timeline.length, 4)
  const topic = amberType({
    parts: [{ text: 'khách hàng', role: 'support', row: 0, at: 0 }, { text: 'chỉ quan tâm', role: 'serif', row: 1, at: .3 }, { text: '3 điều', role: 'hero', row: 2, at: .8 }],
    layout: 'split', placement: 'lower-center', head: { seen: true, top: 226, eyes: 387, mouth: 704 },
    id: 'topic', t0: 0, t1: 2, E: (value: number) => value, esc: (value: string) => value,
    tl: [], accent: '#F4E7A5',
  })
  const topicTops = [...topic.matchAll(/id="topic-row\d+"[^>]*top:(\d+(?:\.\d+)?)px/g)].map(match => Number(match[1]))
  assert.ok(topicTops[0] < 226 && topicTops[1] >= 1010)
})

test('Amber can separate a spoken “Có thể” connector without inventing words', () => {
  const words = ['Có', 'thể', 'thử', 'cách', 'mới'].map((word, index) => ({ word, start: index * .3, end: index * .3 + .25 }))
  const [beat] = buildAmberBeats([{ mode: 'progressive', text: 'Có thể thử cách mới', at: 0, to: 1.5 }],
    [{ start: 0, end: 1.5, text: '', words }], [{ a: 0, b: 2 }], [], undefined, { splitConnectors: true })
  assert.equal(beat.layout, 'split')
  assert.deepEqual(beat.parts?.map(part => [part.text, part.role, part.row]),
    [['Có thể', 'connector', 0], ['thử cách mới', 'hero', 1]])
})
