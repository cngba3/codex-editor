// Also used by clean-environment smoke checks; no system Node/Python/uv required.
import { resolve } from 'node:path'
import { setupRuntime } from './setup-runtime.mjs'
const appRoot = resolve(import.meta.dirname, '..')
let lastStage
const result = await setupRuntime({ appRoot, toolsRoot: resolve(process.argv[2]), dataRoot: resolve(process.argv[3]),
  report: state => { if (lastStage !== state.stage) { console.log(state.stage); lastStage = state.stage } else console.log(state.detail || '') },
})
console.log(JSON.stringify({ workspace: result.workspace, logFile: result.logFile }))
