const [platform, arch] = process.argv.slice(2)
if (process.platform !== platform || (arch && process.arch !== arch)) {
  throw new Error(`Build this installer on ${platform}${arch ? `/${arch}` : ''}. Current host: ${process.platform}/${process.arch}. Use the macOS GitHub Actions workflow for Mac builds.`)
}
