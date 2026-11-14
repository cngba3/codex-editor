// Semantic mixed-type rows. Hidden runs keep their space, so progressive
// reveals never move words that the viewer is already reading.
export function amberType({ parts, layout, placement, head, id, t0, t1, E, esc, tl, accent }) {
  const rows = [];
  for (const [index, part] of parts.entries()) {
    let row = rows.at(-1);
    if (!row || row.key !== part.row) rows.push(row = { key: part.row, parts: [] });
    row.parts.push({ ...part, index });
  }
  const size = p => p.role === 'serif' ? 50 : p.role === 'hero' ? 124 : p.role === 'connector' ? 96 : 94;
  // Keep phrases intact. If a mixed row is too wide, break between semantic
  // runs, never at an arbitrary Vietnamese syllable or by shrinking to dust.
  const lines = [];
  for (const row of rows) {
    let line = [], width = 0;
    for (const p of row.parts) {
      const estimated = [...p.text].length * size(p) * .54 + 18;
      if (line.length && width + estimated > 880) { lines.push(line); line = []; width = 0; }
      line.push(p); width += estimated;
    }
    if (line.length) lines.push(line);
  }
  const heights = lines.map(line => Math.max(...line.map(size)) * 1.18 + 8);
  const total = heights.reduce((a, b) => a + b, 0);
  const forehead = head?.seen ? Math.max(head.top, head.eyes - 190) : 650;
  const below = head?.seen ? Math.max(1020, head.mouth + 145) : 1090;
  const aboveFits = total <= forehead - 160;
  const upper = placement?.startsWith('upper') && aboveFits;
  const split = layout === 'split' && lines.length > 1 && heights[0] <= forehead - 160;
  const mainTotal = split ? total - heights[0] : total;
  const sequential = !upper && below + mainTotal > 1720;
  let offset = 0;
  const html = lines.map((line, n) => {
    const inTop = split && n === 0;
    const y = inTop ? Math.max(120, forehead - heights[0] - 60)
      : upper ? Math.max(120, forehead - total - 60) + offset : below + (sequential ? 0 : offset);
    if (!inTop) offset += heights[n];
    const align = layout === 'stepped' ? ['flex-start', 'center', 'flex-end'][n % 3] : 'center';
    const runs = line.map(p => {
      const serif = p.role === 'serif';
      const color = p.role === 'hero' || p.role === 'connector' ? accent : '#fff';
      const at = Math.max(t0, Math.min(t1 - .07, E(p.at, 'amber semantic run')));
      tl.push(`ft("#${id}-p${p.index}", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .16, ease: "power2.out" }, ${at});`);
      return `<span id="${id}-p${p.index}" style="display:block;max-width:880px;font-family:'${serif ? 'Playfair Display' : 'Inter Tight'}',sans-serif;font-size:${size(p)}px;font-weight:${serif ? 500 : 800};font-style:${serif ? 'normal' : 'italic'};line-height:1.18;letter-spacing:${serif ? 0 : -1}px;color:${color};text-shadow:0 3px 12px rgba(0,0,0,.5)">${esc(p.text)}</span>`;
    }).join('');
    if (sequential && !inTop && n < lines.length - 1) {
      const next = Math.max(t0, E(lines[n + 1][0].at, 'amber next row'));
      tl.push(`tl.to("#${id}-row${n}", { autoAlpha: 0, duration: .08 }, ${Math.max(t0, next - .08)});`);
    }
    return `<div id="${id}-row${n}" style="position:absolute;left:90px;top:${y}px;width:900px;display:flex;align-items:baseline;justify-content:${align};gap:18px">${runs}</div>`;
  }).join('');
  return `<div id="${id}-in" class="ov" style="inset:0;z-index:4">${html}</div>`;
}
