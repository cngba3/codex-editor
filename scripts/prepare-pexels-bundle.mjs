import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const envFile = join(process.cwd(), '.env.local')
const key = process.env.PEXELS_API_KEY?.trim() || (existsSync(envFile) ? readFileSync(envFile, 'utf8').match(/^PEXELS_API_KEY=(.+)$/m)?.[1]?.trim() : '') || ''
const bundleDir = join(process.cwd(), '.runtime')
mkdirSync(bundleDir, { recursive: true })
writeFileSync(join(bundleDir, 'pexels-key'), key, { encoding: 'utf8', mode: 0o600 })
console.log(key ? 'Pexels key prepared for desktop bundle.' : 'No Pexels key found; desktop bundle will use Settings.')
