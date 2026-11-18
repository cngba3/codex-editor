import { build } from 'esbuild'
await build({
  entryPoints: ['server/desktop-api.ts'], outfile: 'dist-server/api.mjs', bundle: true,
  platform: 'node', format: 'esm', packages: 'external', target: 'node22',
})
