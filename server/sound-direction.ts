import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type Track = { styles?: string[]; mood?: string[]; duration?: number }
type Take = { a: number; b: number }

export function chooseMusic(ghost: string, style: string, context: string, takes: Take[], recentMusic: string[] = []) {
  const manifest = JSON.parse(readFileSync(join(ghost, 'library/music/manifest.json'), 'utf8')) as Record<string, Track>
  const text = context.toLocaleLowerCase()
  const moodTerms: Record<string, string[]> = {
    warm: ['ấm', 'nhẹ', 'warm', 'thân mật'], calm: ['bình tĩnh', 'êm', 'calm'],
    tense: ['căng', 'hồi hộp', 'tense'], happy: ['vui', 'tươi', 'happy'],
    tech: ['công nghệ', 'tech', 'phần mềm'], cinematic: ['điện ảnh', 'cinematic'],
    minimal: ['tối giản', 'minimal'], driving: ['nhanh', 'mạnh', 'driving'],
  }
  const desired = Object.entries(moodTerms).filter(([, words]) => words.some(word => text.includes(word))).map(([mood]) => mood)
  const options = Object.entries(manifest).filter(([, track]) => !track.duration || track.duration >= takes.reduce((n, take) => n + take.b - take.a, 0))
  if (!options.length) return null
  options.sort(([aId, a], [bId, b]) => {
    const score = (id: string, track: Track) => (track.styles?.includes(style) ? 6 : 0) + desired.filter(mood => track.mood?.includes(mood)).length * 3 + (track.mood?.includes('subtle') ? 1 : 0) - (/comical|funny/i.test(id) && !desired.includes('happy') ? 4 : 0) - (recentMusic.includes(id) ? 5 : 0)
    return score(bId, b) - score(aId, a) || aId.localeCompare(bId)
  })
  const [id, track] = options[0]
  const score = (track.styles?.includes(style) ? 6 : 0) + desired.filter(mood => track.mood?.includes(mood)).length * 3
  if (score < 3) return null
  const total = takes.reduce((n, take) => n + take.b - take.a, 0)
  return { id, db: -18, fadeIn: Math.min(0.5, total / 8), fadeOut: Math.min(1, total / 6), duck: [{ from: 0, to: total, db: -5 }] }
}
