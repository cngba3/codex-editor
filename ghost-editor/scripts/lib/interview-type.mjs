// The Interview reference uses compact mixed-size lines over the speaker's
// chest: small white clauses frame one much larger lime concept. Keep each
// spoken run in place while later runs appear, rather than stacking equally
// large words or replacing the whole phrase.
export function interviewType({ parts, head, id, t0, t1, E, esc, tl, accent, placement, effect = 'none' }) {
  const rows = [];
  for (const [index, part] of parts.entries()) {
    let row = rows.at(-1);
    if (!row || row.key !== part.row) rows.push(row = { key: part.row, parts: [] });
    row.parts.push({ ...part, index });
  }
  const baseSize = part => part.role === 'hero' ? 154 : part.role === 'connector' ? 72 : part.role === 'serif' ? 56 : 60;
  const size = part => Math.max(part.role === 'hero' ? 76 : 42,
    Math.min(baseSize(part), Math.floor(850 / Math.max(1, [...part.text].length * .52))));
  const estimated = part => [...part.text].length * size(part) * .52 + 14;
  const lines = [];
  for (const row of rows) {
    let line = [], width = 0;
    for (const part of row.parts) {
      const next = estimated(part);
      if (line.length && width + next > 850) { lines.push(line); line = []; width = 0; }
      line.push(part); width += next;
    }
    if (line.length) lines.push(line);
  }
  const heights = lines.map(line => Math.max(...line.map(size)) * .98);
  const heroLine = lines.findIndex(line => line.some(part => part.role === 'hero'));
  const negativeIndex = parts.findIndex(part => /\b(không|chưa|sai|thiếu|fail|wrong|bad)\b/i.test(part.text));
  const heroIndex = parts.findIndex(part => part.role === 'hero');
  const markIndex = effect === 'strike' && negativeIndex >= 0 ? negativeIndex : heroIndex;
  const total = heights.reduce((sum, height) => sum + height, 0);
  const upper = placement?.startsWith('upper') && (!head?.seen || (head.top ?? 500) > total + 210);
  const chest = head?.seen ? Math.max(900, head.mouth + 105) : 960;
  const start = upper ? Math.max(165, Math.min(380, (head?.top ?? 700) - total - 70))
    : Math.min(Math.max(830, chest - total * .18), 1530 - total);
  let offset = 0;
  const html = lines.map((line, rowIndex) => {
    const top = Math.round(start + offset);
    offset += heights[rowIndex];
    const spans = line.map(part => {
      const hero = part.role === 'hero';
      const serif = part.role === 'serif';
      const at = Math.max(t0, Math.min(t1 - .07, E(part.at, 'interview spoken run')));
      tl.push(`ft("#${id}-p${part.index}", { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: "power2.out" }, ${at});`);
      const brush = part.index === markIndex && effect === 'brush';
      const strike = part.index === markIndex && effect === 'strike';
      if (brush || strike) tl.push(`ft("#${id}-mark${part.index}", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: ${brush ? .28 : .2}, ease: "power2.out" }, ${Math.min(t1 - .08, at + .18)});`);
      const mark = brush
        ? `<span id="${id}-mark${part.index}" style="position:absolute;left:-2%;right:-2%;top:48%;height:46%;background:#687633;clip-path:polygon(0 22%,98% 0,100% 64%,4% 100%);z-index:0"></span>`
        : strike
          ? `<span style="position:absolute;left:-3%;right:-3%;top:48%;height:12px;transform:rotate(-6deg);z-index:2"><span id="${id}-mark${part.index}" style="display:block;width:100%;height:100%;background:#B93026;clip-path:inset(0 100% 0 0)"></span></span>`
          : '';
      return `<span id="${id}-p${part.index}" style="position:relative;display:inline-block;white-space:nowrap;font-family:'Inter Tight',Inter,sans-serif;font-size:${size(part)}px;font-weight:${hero ? 850 : serif ? 600 : 760};line-height:.95;letter-spacing:${hero ? -5 : -1.5}px;color:${hero ? accent : '#F5F4EE'};text-shadow:0 3px 14px rgba(0,0,0,.68)">${mark}<span style="position:relative;z-index:1">${esc(part.text)}</span></span>`;
    }).join('');
    const align = rowIndex < heroLine ? 'flex-start' : rowIndex > heroLine ? 'flex-end' : 'center';
    return `<div style="position:absolute;left:110px;top:${top}px;width:860px;height:${Math.ceil(heights[rowIndex])}px;display:flex;align-items:baseline;justify-content:${align};gap:14px">${spans}</div>`;
  }).join('');
  const scanlines = effect === 'strike'
    ? `<div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(240,240,240,.28) 0 2px,transparent 2px 11px);pointer-events:none"></div>` : '';
  const rec = effect === 'rec'
    ? `<div style="position:absolute;inset:95px 65px;border:2px solid rgba(245,244,238,.75);clip-path:polygon(0 0,12% 0,12% 2px,88% 2px,88% 0,100% 0,100% 12%,calc(100% - 2px) 12%,calc(100% - 2px) 88%,100% 88%,100% 100%,88% 100%,88% calc(100% - 2px),12% calc(100% - 2px),12% 100%,0 100%,0 88%,2px 88%,2px 12%,0 12%)"></div><div style="position:absolute;left:87px;top:111px;color:#F5F4EE;font:700 30px Inter,sans-serif"><span style="color:#B93026">●</span> REC</div>` : '';
  return `<div id="${id}-in" class="ov" style="inset:0;z-index:4">${scanlines}${rec}${html}</div>`;
}
