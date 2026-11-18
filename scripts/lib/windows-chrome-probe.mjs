// Windows GUI Chrome builds do not reliably exit on --version. Check the
// actual headless/CDP path used by renders, with an isolated temporary profile.
export async function probeWindowsChrome(executablePath, signal) {
  signal?.throwIfAborted()
  const { default: puppeteer } = await import('puppeteer-core')
  const browser = await puppeteer.launch({ executablePath, headless: true, timeout: 60000, signal })
  try {
    signal?.throwIfAborted()
    return await browser.version()
  } finally {
    await browser.close()
  }
}
