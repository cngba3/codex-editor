import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCoreBeats, coreTimingInstructions } from '../server/core-beats'

const takes = [{ a: 10, b: 13 }, { a: 20, b: 24 }]
test('overlay endpoints may span a source cut without being rejected', () => {
  const beats = [{ type: 'scene', kind: 'vector', at: 12, to: 21, text: 'Test' }]
  assert.deepEqual(validateCoreBeats(beats, takes), beats)
})
test('source-bound effects cannot cross a cut', () => {
  for (const type of ['cutout', 'panel', 'behind']) {
    assert.throws(() => validateCoreBeats([{ type, at: 12, to: 21 }], takes), /trọn trong một đoạn/)
  }
})
test('optional to uses a bounded default without mutating the input', () => {
  const beats = [{ type: 'big', at: 12 }, { type: 'meme', at: 20 }]
  assert.deepEqual(validateCoreBeats(beats, takes).map(b => b.to), [13, 21.8])
  assert.equal('to' in beats[0], false)
})
test('discarded and output-relative times are rejected with actionable details', () => {
  for (const [at, to] of [[0, 2], [12, 15], [15, 21]]) {
    assert.throws(() => validateCoreBeats([{ type: 'scene', at, to }], takes), error => {
      assert.match(String(error), /Beat #1 \(scene\)/)
      assert.match(String(error), /\[10, 13\], \[20, 24\]/)
      assert.match(String(error), /giây của video gốc/)
      return true
    })
  }
})
test('times follow edit order rather than source sort order', () => {
  const reordered = [takes[1], takes[0]]
  assert.equal(validateCoreBeats([{ type: 'scene', at: 23, to: 11 }], reordered).length, 1)
  assert.throws(() => validateCoreBeats([{ type: 'scene', at: 11, to: 23 }], reordered), /không dương/)
})
test('malformed beats, nonnumeric endpoints and empty durations fail clearly', () => {
  for (const value of [null, {}, [null], [3], [{ at: 11, to: 12 }], [{ type: 'big', at: '11', to: 12 }], [{ type: 'big', at: 11, to: null }], [{ type: 'big', at: NaN, to: 12 }], [{ type: 'big', at: 12, to: 12 }]]) {
    assert.throws(() => validateCoreBeats(value, takes))
  }
  assert.deepEqual(validateCoreBeats([], takes), [])
})
test('only renderer epsilon is tolerated, larger timing errors need repair', () => {
  assert.equal(validateCoreBeats([{ type: 'big', at: 10 - 1e-7, to: 12 }], takes)[0].at, 10)
  assert.throws(() => validateCoreBeats([{ type: 'big', at: 9.99, to: 12 }], takes), /ngoài/)
  assert.match(coreTimingInstructions(takes), /ORIGINAL source seconds/)
})
