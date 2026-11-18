import { basename } from 'node:path'

// Production Python dependencies are installed once during desktop setup.
// Development keeps the existing uv run behavior.
export function runtimeCommand(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  if (/^uv(?:\.exe)?$/i.test(basename(command)) && env.AI_EDITOR_PYTHON) {
    const pythonIndex = args.indexOf('python')
    if (args[0] !== 'run' || pythonIndex < 1) throw new Error('Unsupported managed Python command')
    return { command: env.AI_EDITOR_PYTHON, args: args.slice(pythonIndex + 1) }
  }
  if (command === process.execPath && env.AI_EDITOR_NODE) return { command: env.AI_EDITOR_NODE, args }
  return { command, args }
}
