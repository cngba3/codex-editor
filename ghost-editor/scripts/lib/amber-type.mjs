// Amber Talk's hierarchy comes from the reference: a detached opener when the
// sentence calls for it, then mixed-size spoken phrases over the speaker's chest.
// Every run reserves its final space before its word-timed reveal.
export function amberType({ parts, layout, placement, head, id, t0, t1, E, esc, tl, accent }) {
  const roleSize = { serif: 48, support: 76, hero: 124, connector: 88 };
  const rows = [];
  for (const [index, part] of parts.entries()) {
    let row = rows.at(-1);
    if (!row || row.key !== part.row) rows.push(row = { key: part.row, parts: [] });
    row.parts.push({ ...part, index });
  }
  const estimatedWidth = p => [...p.text].length * roleSize[p.role] * (p.role === 'serif' ? .47 : .55) + 18;
  // Break only between semantic runs. Fit the whole row so the bridge and hero
  // keep their different sizes.
  const lines = [];
  for (const row of rows) {
    let line = [], width = 0;
    for (const p of row.parts) {
      const next = estimatedWidth(p);
      if (line.length && width + next > 900) { lines.push(line); line = []; width = 0; }
      line.push(p); width += next;
    }
    if (line.length) lines.push(line);
  }
  const forehead = head?.seen ? Math.max(head.top, head.eyes - 190) : 650;
  const below = head?.seen ? Math.max(1010, head.mouth + 145) : 1090;
  const opener = lines[0]?.every(p => p.role === 'connector');
  const split = lines.length > 1 && (layout === 'split' || opener) && forehead >= 210;
  const mainLines = split ? lines.slice(1) : lines;
  const staggered = mainLines.length >= 3;
  const rowGap = staggered ? 24 : 8;
  const lineScale = line => Math.min(1, 850 / Math.max(1, line.reduce((sum, p) => sum + estimatedWidth(p), 0)));
  const height = line => Math.max(...line.map(p => roleSize[p.role])) * lineScale(line) * 1.03 + 6;
  const mainHeight = mainLines.reduce((sum, line) => sum + height(line), 0);
  const gaps = Math.max(0, mainLines.length - 1) * rowGap;
  const upper = !split && placement?.startsWith('upper') && mainHeight + gaps < forehead - 175;
  const blockScale = Math.min(1, Math.max(220, 1680 - below - gaps) / Math.max(1, mainHeight));
  const blockY = upper ? Math.max(130, forehead - mainHeight - gaps - 55) : below;
  let offset = 0;
  const html = lines.map((line, n) => {
    const detached = split && n === 0;
    const scale = lineScale(line) * (detached || upper ? 1 : blockScale);
    const lineHeight = height(line) * (detached || upper ? 1 : blockScale);
    const y = detached ? Math.max(110, forehead - lineHeight - 18) : blockY + offset;
    if (!detached) offset += lineHeight + rowGap;
    const mainIndex = split ? n - 1 : n;
    const shift = staggered && !detached ? [-90, 0, 110][Math.min(mainIndex, 2)] : 0;
    const runs = line.map(p => {
      const serif = p.role === 'serif';
      const emphasis = p.role === 'hero' || p.role === 'connector';
      const footer = serif && n === lines.length - 1 && lines.slice(0, n).some(previous => previous.some(item => item.role === 'hero'));
      const size = Math.round((footer ? 38 : roleSize[p.role]) * scale);
      const at = Math.max(t0, Math.min(t1 - .07, E(p.at, 'amber semantic run')));
      tl.push(`ft("#${id}-p${p.index}", { autoAlpha: 0, y: 11 }, { autoAlpha: 1, y: 0, duration: .16, ease: "power2.out" }, ${at});`);
      return `<span id="${id}-p${p.index}" style="display:block;flex:0 1 auto;max-width:850px;font-family:'${serif ? 'Playfair Display' : 'Inter Tight'}',sans-serif;font-size:${size}px;font-weight:${serif ? 500 : 800};font-style:${serif ? 'normal' : 'italic'};line-height:1.04;letter-spacing:${serif ? 0 : -1}px;color:${emphasis ? accent : '#fff'};text-shadow:0 3px 12px rgba(0,0,0,.55)">${esc(p.text)}</span>`;
    }).join('');
    return `<div id="${id}-row${n}" style="position:absolute;left:90px;top:${y}px;width:900px;display:flex;align-items:baseline;justify-content:center;gap:14px;white-space:nowrap;transform:translateX(${shift}px)">${runs}</div>`;
  }).join('');
  return `<div id="${id}-in" class="ov" style="inset:0;z-index:4">${html}</div>`;
}
