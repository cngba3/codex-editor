import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAmberBeats, type AmberCandidate } from '../server/amber-layout'

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
