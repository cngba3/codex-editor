import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Feedback = { jobId: string; style: string; liked: boolean; comment: string; createdAt: number }
const pathFor = (jobsRoot: string) => join(jobsRoot, 'taste.json')

export function readTaste(jobsRoot: string) {
  const file = pathFor(jobsRoot)
  if (!existsSync(file)) return { version: 1, rules: [] as Record<string, unknown>[], reels: [] as Record<string, unknown>[] }
  const taste = JSON.parse(readFileSync(file, 'utf8')) as { version: number; rules: Record<string, unknown>[]; reels: Record<string, unknown>[] }
  taste.rules ||= []; taste.reels ||= []
  return taste
}

export function tastePrompt(jobsRoot: string, style: string) {
  const taste = readTaste(jobsRoot)
  const comments = taste.rules.filter(rule => rule.active !== false && (!Array.isArray((rule.when as { style?: string[] })?.style) || (rule.when as { style: string[] }).style.includes(style)))
    .slice(-20).map(rule => `- ${String(rule.say).slice(0, 500)}`)
  const recent = taste.reels.filter(reel => reel.style === style).slice(-5).map(reel => `- ${reel.liked ? 'Liked' : 'Wanted changes'}: music=${reel.music || 'none'}, beats=${Array.isArray(reel.beats) ? reel.beats.join(', ') : 'unknown'}. Use liked patterns where relevant; avoid repeating the same sequence mechanically.`)
  return [...comments, ...recent].join('\n')
}

export function recordFeedback(jobsRoot: string, feedback: Feedback) {
  mkdirSync(jobsRoot, { recursive: true })
  const taste = readTaste(jobsRoot)
  const comment = feedback.comment.trim().slice(0, 500)
  const reelPath = join(jobsRoot, feedback.jobId, 'reel.json')
  const reel = existsSync(reelPath) ? JSON.parse(readFileSync(reelPath, 'utf8')) as { music?: { id?: string }; beats?: { type?: string; kind?: string }[] } : null
  const beats = (reel?.beats || []).slice(0, 12).map(beat => `${beat.type || 'unknown'}${beat.kind ? `:${beat.kind}` : ''}`)
  taste.reels = taste.reels.filter(reel => reel.jobId !== feedback.jobId)
  taste.reels.push({ jobId: feedback.jobId, style: feedback.style, liked: feedback.liked, comment, music: reel?.music?.id || '', beats, createdAt: feedback.createdAt })
  taste.reels = taste.reels.slice(-100)
  if (comment) {
    const id = `feedback-${feedback.jobId}`
    taste.rules = taste.rules.filter(rule => rule.id !== id)
    taste.rules.push({ id, from: 'user', kind: 'note', say: comment, when: { style: [feedback.style] }, active: true, createdAt: feedback.createdAt })
    taste.rules = taste.rules.slice(-100)
  }
  writeFileSync(pathFor(jobsRoot), JSON.stringify(taste, null, 2), 'utf8')
  return { liked: feedback.liked, comment }
}
