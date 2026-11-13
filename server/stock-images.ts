import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type ImageInfo = {
  url?: string
  thumburl?: string
  width?: number
  height?: number
  mime?: string
  extmetadata?: Record<string, { value?: string }>
  metadata?: { name: string; value: string }[]
}

export type StockImage = { file: string; title: string; source: string; license: string; author: string; search: 'Pexels' | 'Google Images' | 'Wikimedia Commons' }

type PexelsPhoto = { id: number; width: number; height: number; url: string; photographer: string; alt: string; src: { large2x?: string; large?: string; original?: string } }

const userAgent = 'CodexEditor/0.1 (local video editor; image attribution stored with project)'
const chrome = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find(path => path && existsSync(path))

function pexelsKey() {
  if (process.env.PEXELS_API_KEY?.trim()) return process.env.PEXELS_API_KEY.trim()
  const file = join(process.cwd(), '.env.local')
  if (!existsSync(file)) return ''
  return readFileSync(file, 'utf8').match(/^PEXELS_API_KEY=(.+)$/m)?.[1]?.trim() || ''
}

function photoScore(photo: PexelsPhoto, prompt: string) {
  const text = photo.alt.toLowerCase()
  let score = 0
  if (/vietnam|vietnamese/i.test(prompt)) score += /vietnam|việt nam|lạng sơn|hà nội|hanoi|saigon|hồ chí minh/i.test(text) ? 6 : -2
  if (/modern|contemporary/i.test(prompt)) score += /modern|contemporary/i.test(text) ? 3 : 0
  if (/townhouse|shophouse|villa|property|real estate/i.test(prompt)) score += /townhouse|shophouse|villa|residential|house|building/i.test(text) ? 4 : -4
  if (/shop|store/i.test(prompt)) score += /shop|store|commercial|ground.floor/i.test(text) ? 2 : 0
  if (/historic|traditional|temple|church|pagoda|illustration|render|aerial/i.test(text)) score -= 7
  if (/modern|contemporary/i.test(prompt) && /hội an|hoi an|old quarter|ancient|colonial/i.test(text)) score -= 8
  if (/apartment|skyscraper/i.test(text) && /townhouse|shophouse/i.test(prompt)) score -= 3
  if (/singapore|penang|bangkok|berlin|london|netherlands|dutch/i.test(text) && /vietnam/i.test(prompt)) score -= 8
  return score
}

async function pexelsIllustration(prompt: string, assets: string): Promise<StockImage | null> {
  const key = pexelsKey()
  if (!key) return null
  const realEstate = /townhouse|shophouse|villa|property|real estate|ground.floor shop/i.test(prompt)
  const queries = realEstate ? ['modern townhouse exterior Vietnam', 'modern residential buildings Vietnam', 'modern townhouse exterior'] : searchTerms(prompt).slice(0, 2)
  const candidates = new Map<number, PexelsPhoto>()
  for (const query of queries) {
    const api = new URL('https://api.pexels.com/v1/search')
    Object.entries({ query, per_page: '24' }).forEach(([name, value]) => api.searchParams.set(name, value))
    const response = await fetch(api, { headers: { Authorization: key }, signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`Pexels search HTTP ${response.status}`)
    const result = await response.json() as { photos?: PexelsPhoto[] }
    for (const photo of result.photos || []) if (photo.width >= 900 && photo.height >= 500 && photo.alt) candidates.set(photo.id, photo)
  }
  const photos = [...candidates.values()].sort((a, b) => photoScore(b, prompt) - photoScore(a, prompt))
  for (const photo of photos.slice(0, 12)) {
      if (photoScore(photo, prompt) < 3) break
      const url = photo.src.large2x || photo.src.large || photo.src.original
      if (!url) continue
      try {
        const image = await fetch(url, { signal: AbortSignal.timeout(20000) })
        if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) continue
        const bytes = Buffer.from(await image.arrayBuffer())
        if (bytes.length < 10000 || bytes.length > 12_000_000) continue
        const ext = image.headers.get('content-type')?.includes('png') ? 'png' : 'jpg'
        const file = join(assets, `illustration-pexels.${ext}`)
        writeFileSync(file, bytes)
        return { file, title: photo.alt, source: photo.url, license: 'Pexels License', author: photo.photographer, search: 'Pexels' }
      } catch { /* Try another photo. */ }
  }
  return null
}

function searchTerms(prompt: string) {
  if (/townhouse|shophouse|villa|real estate|property|ground-floor shop/i.test(prompt)) return ['Vietnam modern townhouse shophouse', 'Vinhomes shophouse', 'Vietnam shophouse']
  const words = prompt.split(',')[0].replace(/\b(photorealistic|photograph|photo|realistic|no people|no text|no logos?)\b/gi, '').trim().split(/\s+/)
  return [words.slice(0, 9).join(' '), words.slice(0, 5).join(' ')].filter(Boolean)
}

function commonsTitle(link: string) {
  try {
    const u = new URL(link, 'https://www.google.com')
    const target = u.searchParams.get('imgrefurl') || u.searchParams.get('url') || link
    const imagePage = new URL(target, 'https://www.google.com')
    if (imagePage.hostname !== 'commons.wikimedia.org') return null
    const title = decodeURIComponent(imagePage.pathname.split('/wiki/')[1] || '').replaceAll('_', ' ')
    return title.startsWith('File:') ? title : null
  } catch { return null }
}

async function googleImageTitles(query: string) {
  if (!chrome) return []
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-first-run', '--no-default-browser-check'] })
  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
    const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${query} site:commons.wikimedia.org/wiki/File:`)}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    const links = await page.$$eval('a[href]', anchors => anchors.map(anchor => (anchor as HTMLAnchorElement).href))
    return [...new Set(links.map(commonsTitle).filter((title): title is string => Boolean(title)))].slice(0, 16)
  } finally { await browser.close() }
}

async function commonsSearchTitles(query: string) {
  const api = new URL('https://commons.wikimedia.org/w/api.php')
  Object.entries({ action: 'query', generator: 'search', gsrsearch: query, gsrnamespace: '6', gsrlimit: '12', format: 'json' }).forEach(([key, value]) => api.searchParams.set(key, value))
  const response = await fetch(api, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Wikimedia search HTTP ${response.status}`)
  const result = await response.json() as { query?: { pages?: Record<string, { title: string }> } }
  return Object.values(result.query?.pages || {}).map(page => page.title)
}

async function imageInfo(title: string) {
  const api = new URL('https://commons.wikimedia.org/w/api.php')
  Object.entries({ action: 'query', titles: title, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata|metadata', iiurlwidth: '1400', format: 'json' }).forEach(([key, value]) => api.searchParams.set(key, value))
  const response = await fetch(api, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Wikimedia image HTTP ${response.status}`)
  const result = await response.json() as { query?: { pages?: Record<string, { imageinfo?: ImageInfo[] }> } }
  return Object.values(result.query?.pages || {})[0]?.imageinfo?.[0]
}

function plain(value: string) { return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim() }

export async function downloadStockIllustration(prompt: string, assets: string): Promise<StockImage | null> {
  try {
    const pexels = await pexelsIllustration(prompt, assets)
    if (pexels) return pexels
  } catch { /* Missing access or a temporary API error falls through to other sources. */ }
  const queries = searchTerms(prompt)
  if (!queries.length) return null
  let googleTitles: string[] = []
  try { googleTitles = await googleImageTitles(queries[0]) } catch { /* Chrome/Google may be unavailable; use the source catalog. */ }
  const searches: { titles: string[]; search: StockImage['search'] }[] = [{ titles: googleTitles, search: 'Google Images' }]
  for (const query of queries) {
    try { searches.push({ titles: await commonsSearchTitles(query), search: 'Wikimedia Commons' }) } catch { /* Try a shorter query. */ }
  }
  for (const { titles, search } of searches) for (const title of titles) {
    try {
      const info = await imageInfo(title)
      const license = plain(info?.extmetadata?.LicenseShortName?.value || '')
      if (!info || !/image\/(jpeg|png|webp)/.test(info.mime || '') || (info.width || 0) < 800 || (info.height || 0) < 450 || !/CC|public domain|PD/i.test(license)) continue
      // A camera EXIF marker keeps architectural renders and AI pictures out
      // of a style that calls for real photographic cutaways.
      if (!info.metadata?.some(tag => /^(Make|Model|ExposureTime|DateTimeOriginal)$/.test(tag.name))) continue
      if (/\bmodern\b/i.test(prompt) && /Hoi An|ancient|traditional|colonial/i.test(title)) continue
      const url = info.thumburl || info.url
      if (!url) continue
      const response = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(20000) })
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) continue
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length < 10000 || bytes.length > 12_000_000) continue
      const ext = info.mime === 'image/png' ? 'png' : info.mime === 'image/webp' ? 'webp' : 'jpg'
      const file = join(assets, `illustration-stock.${ext}`)
      writeFileSync(file, bytes)
      return { file, title, source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title).replaceAll('%3A', ':')}`, license, author: plain(info.extmetadata?.Artist?.value || ''), search }
    } catch { /* Try the next Google image result. */ }
  }
  return null
}
