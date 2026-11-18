type Take = { a: number; b: number }
export type CoreBeat = Record<string, unknown> & { type: string; at: number; to: number }

// The core renderer maps source endpoints separately onto frame-rounded takes.
// Overlays may span cuts; source-dependent cutouts must stay inside one take.
export function validateCoreBeats(value: unknown, takes: Take[], fps = 30): CoreBeat[] {
  if (!Array.isArray(value)) throw new Error('beats_json phải là một mảng JSON.')
  const ranges = takes.map(t => `[${t.a}, ${t.b}]`).join(', ')
  let frames = 0
  const timeline = takes.map(t => {
    const start = frames / fps
    frames += Math.round((t.b - t.a) * fps)
    return { ...t, start }
  })
  return value.map((raw, index) => {
    const fail = (reason: string): never => {
      throw new Error(`Beat #${index + 1} (${raw?.type ?? '?'}): ${reason}. Dùng giây của video gốc, không dùng thời gian video đã cắt. Các đoạn giữ: ${ranges}.`)
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('phải là object')
    if (typeof raw.type !== 'string' || !raw.type) fail('thiếu type')
    const locate = (time: unknown, field: string) => {
      if (typeof time !== 'number' || !Number.isFinite(time)) return fail(`${field}=${JSON.stringify(time)} phải là số hữu hạn`)
      // Match build.mjs's numeric endpoint tolerance, without moving beats
      // from discarded speech or guessing that they use output timestamps.
      const take = timeline.find(t => time >= t.a - 1e-6 && time <= t.b + 1e-6)
      if (!take) return fail(`${field}=${time} nằm ngoài các đoạn được giữ`)
      const source = Math.max(take.a, Math.min(time, take.b))
      return { source, edit: Number((take.start + source - take.a).toFixed(3)), take }
    }
    const start = locate(raw.at, 'at')
    // The documented optional end uses the core's default duration, bounded
    // by this take so an omitted endpoint cannot run past kept footage.
    const end = locate(raw.to === undefined ? Math.min(start.take.b, start.source + (raw.type === 'meme' ? 1.8 : 2.5)) : raw.to, 'to')
    if (end.edit <= start.edit) fail(`at=${raw.at}, to=${raw.to} tạo thời lượng không dương sau khi ghép đoạn`)
    if (['cutout', 'panel', 'behind'].includes(raw.type) && start.take !== end.take) fail(`${raw.type} phải nằm trọn trong một đoạn giữ`)
    return { ...raw, at: start.source, to: end.source } as CoreBeat
  })
}

export function coreTimingInstructions(takes: Take[]): string {
  return `TIMING CONTRACT: at/to are ORIGINAL source seconds, not seconds on the final reel. Kept source intervals in edit order: ${JSON.stringify(takes)}. Every endpoint must be inside a kept interval; never put an endpoint in discarded speech. An overlay may span cuts if its end follows its start in edit order. cutout/panel/behind must fit inside ONE interval. Prefer explicit numeric at and to. Do not change takes to make a beat fit. If a beat is invalid, correct its timing using the transcript or replace it with a supported beat inside a kept interval. Do not repeat a rejected plan unchanged.`
}
