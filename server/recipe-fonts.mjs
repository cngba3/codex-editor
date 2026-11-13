import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const project = path.resolve(process.argv[2])
const cache = path.resolve('.cache/recipe-fonts')
fs.mkdirSync(cache, { recursive: true })
fs.mkdirSync(path.join(project, 'assets/fonts'), { recursive: true })
const faces = [['Inter', '100..900'], ['Inter Tight', '100..900'], ['Caveat', '400..700'], ['Playfair Display', '400..900'], ['Montserrat', '100..900'], ['Oswald', '200..700'], ['JetBrains Mono', '100..800']]
const ua = 'Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'
const output = []
for (const [family, weights] of faces) {
  const key = family.toLowerCase().replaceAll(' ', '-')
  const file = path.join(cache, `${key}.css`)
  let css
  if (fs.existsSync(file)) css = fs.readFileSync(file, 'utf8')
  else {
    const response = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights}&display=swap`, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`Vietnamese font ${family}: HTTP ${response.status}`)
    css = await response.text()
    fs.writeFileSync(file, css)
  }
  for (const block of css.matchAll(/\/\*\s*(vietnamese|latin-ext)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)) {
    let face = block[2]
    const url = face.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1]
    if (!url) continue
    const name = `${key}-${createHash('sha256').update(url).digest('hex').slice(0, 12)}.woff2`
    const frozen = path.join(cache, name)
    if (!fs.existsSync(frozen)) {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (!response.ok) throw new Error(`Font download HTTP ${response.status}`)
      fs.writeFileSync(frozen, Buffer.from(await response.arrayBuffer()))
    }
    fs.copyFileSync(frozen, path.join(project, 'assets/fonts', name))
    face = face.replace(url, `assets/fonts/${name}`)
    output.push(face)
  }
}
fs.writeFileSync(path.join(project, 'assets/vietnamese-fonts.css'), output.join('\n'))
const gsap = path.join(cache, 'gsap-3.14.2.min.js')
if (!fs.existsSync(gsap)) {
  const response = await fetch('https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js', { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`GSAP download HTTP ${response.status}`)
  fs.writeFileSync(gsap, await response.text())
}
fs.copyFileSync(gsap, path.join(project, 'assets/gsap.min.js'))
console.log(`Frozen ${output.length} Vietnamese/Latin extended font faces and GSAP in project`)
