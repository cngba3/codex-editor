import { createWriteStream } from 'node:fs'
import { mkdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pipeline } from 'node:stream/promises'

// Only publish a file after a successful transfer. A failed download is retryable.
export async function download(url, destination) {
  await mkdir(dirname(destination), { recursive: true })
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(300_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
      await pipeline(response.body, createWriteStream(`${destination}.partial`))
      await rename(`${destination}.partial`, destination)
      return
    } catch (error) {
      if (attempt === 3) throw error
      console.log(`Download retry ${attempt}/3: ${url}`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}
