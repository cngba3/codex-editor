import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPexelsKey } from './pexels-config'

export type PropertyStock = { file: string; kind: 'video' | 'photo'; page: string; author: string; query: string; license: 'Pexels License' }
type Video = { id: number; duration: number; url: string; user?: { name?: string }; video_files?: { file_type: string; width: number; height: number; link: string }[] }
type Photo = { id: number; url: string; photographer: string; width: number; height: number; alt: string; src: { large2x?: string; large?: string } }

export function describesSubject(query: string, description: string): boolean {
  const q = query.toLowerCase()
  const d = description.toLowerCase().replace(/[-_]/g, ' ')
  if (/\b(bus|bicycle|cyclist|motorcycle|construction site|road construction)\b/.test(d) && !/\b(bus|bicycle|construction)\b/.test(q)) return false
  if (/\b(university|campus|college|school)\b/.test(q)) return /\b(university|campus|college|school)\b/.test(d)
  if (/\b(townhouse|townhome|shophouse|shopfront|storefront|row house)\b/.test(q)) return /\b(townhouse|townhome|shophouse|shopfront|storefront|row houses|terraced houses)\b/.test(d)
  if (/\b(boulevard|road|street|avenue)\b/.test(q)) return /\b(boulevard|road|street|avenue)\b/.test(d) && /\b(house|houses|home|homes|building|buildings|residential|townhouse)\b/.test(d)
  if (/\b(villa|duplex|house|home|mansion)\b/.test(q)) return /\b(villa|duplex|house|home|mansion|residence)\b/.test(d)
  if (/\b(living room|bedroom|kitchen|bathroom|pool|garden)\b/.test(q)) return /\b(living room|bedroom|kitchen|bathroom|pool|garden)\b/.test(d)
  return q.split(/[^a-z]+/).filter(word => word.length >= 5 && !['modern', 'aerial', 'exterior', 'interior', 'distinct', 'bright', 'light', 'color', 'dusk', 'daylight'].includes(word)).some(word => d.includes(word))
}

async function pexelsJson<T>(path: string, query: string, orientation?: 'portrait'): Promise<T> {
  const url = new URL(`https://api.pexels.com/v1/${path}`)
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '12')
  if (orientation) url.searchParams.set('orientation', orientation)
  const response = await fetch(url, { headers: { Authorization: getPexelsKey() }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Pexels HTTP ${response.status}`)
  return await response.json() as T
}

async function download(url: string, file: string, kind: 'video' | 'photo') {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) return false
  const mime = response.headers.get('content-type') || ''
  if (kind === 'video' ? !mime.includes('video') && !mime.includes('octet-stream') : !mime.startsWith('image/')) return false
  const max = kind === 'video' ? 30_000_000 : 12_000_000
  const length = Number(response.headers.get('content-length') || 0)
  if (length > max) return false
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 10_000 || bytes.length > max) return false
  writeFileSync(file, bytes)
  return true
}

export async function downloadPropertyStock(query: string, assets: string, index: number, minimumSeconds: number, preferVideo = true, excludedPages: Set<string> = new Set()): Promise<PropertyStock | null> {
  if (!getPexelsKey() || !query.trim()) return null
  const safeQuery = query.trim().slice(0, 100)
  if (preferVideo) {
    try {
      const portrait = await pexelsJson<{ videos?: Video[] }>('videos/search', safeQuery, 'portrait')
      const general = portrait.videos?.length ? null : await pexelsJson<{ videos?: Video[] }>('videos/search', safeQuery)
      const videos = [...(portrait.videos || []), ...(general?.videos || [])].filter(video => video.duration >= minimumSeconds + .1 && video.video_files?.length && !excludedPages.has(video.url) && describesSubject(safeQuery, video.url))
      for (const video of videos.slice(0, 8)) {
        const files = (video.video_files || []).filter(file => file.file_type === 'video/mp4' && file.width >= 640 && file.height >= 640)
          .sort((a, b) => (Math.abs(a.width - 1080) + Math.abs(a.height - 1920)) - (Math.abs(b.width - 1080) + Math.abs(b.height - 1920)))
        for (const variant of files.slice(0, 2)) {
          const file = join(assets, `property-pexels-${index}.mp4`)
          if (await download(variant.link, file, 'video')) return { file, kind: 'video', page: video.url, author: video.user?.name || '', query: safeQuery, license: 'Pexels License' }
        }
      }
    } catch { /* A matching photo can still illustrate the line. */ }
  }
  try {
    const result = await pexelsJson<{ photos?: Photo[] }>('search', safeQuery)
    const photos = (result.photos || []).filter(photo => photo.width >= 900 && photo.height >= 900 && !/person|people|portrait|render|illustration/i.test(photo.alt) && !excludedPages.has(photo.url) && describesSubject(safeQuery, `${photo.alt} ${photo.url}`))
      .sort((a, b) => (b.height / b.width) - (a.height / a.width))
    for (const photo of photos.slice(0, 8)) {
      const url = photo.src.large2x || photo.src.large
      if (!url) continue
      const file = join(assets, `property-pexels-${index}.jpg`)
      if (await download(url, file, 'photo')) return { file, kind: 'photo', page: photo.url, author: photo.photographer, query: safeQuery, license: 'Pexels License' }
    }
  } catch { /* No suitable Pexels media for this spoken idea. */ }
  return null
}
