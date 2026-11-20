import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReviewBdsBeats } from '../server/review-bds-layout'
import { describesSubject } from '../server/stock-property'

const segments = [{ start: 10, end: 13, text: 'chỉ với 50 triệu', words: [
  { word: 'chỉ', start: 10.1, end: 10.3 }, { word: 'với', start: 10.32, end: 10.5 },
  { word: '50', start: 10.55, end: 10.8 }, { word: 'triệu', start: 10.82, end: 11.1 },
] }]
const takes = [{ a: 10, b: 12 }]

test('Review BĐS keeps display words and numbers aligned to real source speech', () => {
  const valid = { kind: 'display' as const, placement: 'center' as const, text: 'chỉ với 50 triệu', at: 10.1, to: 11.4, parts: [
    { text: 'chỉ với', role: 'white' as const, row: 0 }, { text: '50', role: 'yellow' as const, row: 1 },
    { text: 'triệu', role: 'script' as const, row: 2 },
  ] }
  const beats = buildReviewBdsBeats([valid], segments, takes)
  assert.equal(beats.length, 1)
  assert.deepEqual(beats[0].parts.map(part => part.at), [10.1, 10.55, 10.82])
  assert.deepEqual(beats[0].parts.map(part => part.motion), ['rise', 'slam', 'wipe'])
  assert.deepEqual(beats[0].parts[0].words.map(word => word.at), [10.1, 10.32])
  assert.equal(buildReviewBdsBeats([{ ...valid, parts: valid.parts.map(part => part.role === 'yellow' ? { ...part, text: '500' } : part) }], segments, takes).length, 0)
  assert.equal(buildReviewBdsBeats([{ ...valid, text: 'chỉ với 500 triệu' }], segments, takes).length, 0)
})

test('Review BĐS limits glitch accents to one per spoken phrase', () => {
  const base = { kind: 'display' as const, placement: 'center' as const, text: 'chỉ với 50 triệu', at: 10.1, to: 11.4 }
  const parts = [
    { text: 'chỉ với', role: 'white' as const, row: 0, motion: 'flicker' as const },
    { text: '50', role: 'yellow' as const, row: 1, motion: 'jitter' as const },
    { text: 'triệu', role: 'script' as const, row: 2, motion: 'wipe' as const },
  ]
  assert.equal(buildReviewBdsBeats([{ ...base, parts }], segments, takes).length, 0)
  assert.equal(buildReviewBdsBeats([{ ...base, parts: [{ ...parts[0], motion: 'rise' as const }, ...parts.slice(1)] }], segments, takes).length, 1)
})

test('Review BĐS keeps adjacent accents when only the optional text hold overlaps', () => {
  const beats = buildReviewBdsBeats([
    { kind: 'talk', placement: 'upper', text: 'chỉ với', at: 10.1, to: 10.5,
      parts: [{ text: 'chỉ với', role: 'white', row: 0, motion: 'rise' }] },
    { kind: 'talk', placement: 'upper', text: '50 triệu', at: 10.55, to: 11.1,
      parts: [{ text: '50 triệu', role: 'yellow', row: 1, motion: 'flash' }] },
  ], segments, takes)
  assert.equal(beats.length, 2)
  assert.equal(beats[0].to, beats[1].at)
  assert.equal(beats[1].parts[0].motion, 'flash')
})

test('Review BĐS rejects irrelevant Pexels subjects instead of filling a cutaway', () => {
  assert.equal(describesSubject('modern university campus buildings aerial view', 'aerial-view-on-road-near-building-on-lakeshore'), false)
  assert.equal(describesSubject('modern villa exterior with front gate', 'road-construction-in-front-of-a-house'), false)
  assert.equal(describesSubject('modern row of townhouse storefronts at dusk', 'evening-city-street-with-passing-bus'), false)
  assert.equal(describesSubject('distinct modern duplex and detached villa exteriors', 'a-large-white-house-on-the-water'), true)
})
