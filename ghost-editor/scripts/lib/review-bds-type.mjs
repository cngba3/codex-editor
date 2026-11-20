// Typography, liquid glossy shimmer gradients, asymmetric editorial lockups,
// cluster-expand entrances, wind-blow mist exits and silky media grammar
// reverse-engineered from the EDITED inner video of @editortapsu78 (TikTok 7632750597493591314).
// Source words are supplied by review-bds-layout.ts.
export const REVIEW_BDS_CSS = `
@font-face { font-family:'Dancing Script'; src:url(assets/fonts/dancing-script.ttf) format('truetype'); font-weight:700; }
.rb-type { position:absolute; inset:0; pointer-events:none; z-index:4; }
.rb-stack { position:absolute; left:58px; right:58px; display:flex; flex-direction:column; gap:6px; }
.rb-type.align-center .rb-stack { align-items:center; text-align:center; }
.rb-type.align-left .rb-stack { align-items:flex-start; text-align:left; }
.rb-type.align-right .rb-stack { align-items:flex-end; text-align:right; }
.rb-type.pos-upper .rb-stack { top:176px; }
.rb-type.pos-upper-left .rb-stack { top:188px; left:64px; right:140px; }
.rb-type.pos-upper-right .rb-stack { top:188px; left:140px; right:64px; }
.rb-type.pos-center .rb-stack { top:50%; transform:translateY(-50%); }
.rb-type.pos-mid-left .rb-stack { top:46%; transform:translateY(-50%); left:64px; right:160px; }
.rb-type.pos-mid-right .rb-stack { top:46%; transform:translateY(-50%); left:160px; right:64px; }
.rb-type.pos-lower-left .rb-stack { bottom:330px; left:64px; right:150px; }
.rb-type.talk.depth-behind .rb-stack { top:var(--rb-depth-y,640px); transform:none; }
.rb-row { width:100%; display:flex; align-items:baseline; gap:14px; min-width:0; flex-wrap:wrap; }
.rb-type.align-center .rb-row { justify-content:center; text-align:center; }
.rb-type.align-left .rb-row { justify-content:flex-start; text-align:left; }
.rb-type.align-right .rb-row { justify-content:flex-end; text-align:right; }
.rb-row.rb-row-lead-kiss { margin-bottom:-20px; z-index:2; }
.rb-type.align-center .rb-row.rb-row-lead-kiss { justify-content:flex-start; padding-left:4%; }
.rb-row.rb-row-script-overlap { margin-top:-66px; z-index:3; }
.rb-type.align-center .rb-row.rb-row-script-overlap { justify-content:flex-end; padding-right:4%; }
.rb-type.align-left .rb-row.rb-row-script-overlap { padding-left:18%; }
.rb-row.rb-row-tight-sub { margin-top:-22px; z-index:2; }
.rb-type.align-center .rb-row.rb-row-tight-sub { justify-content:flex-end; padding-right:4%; }
.rb-depth-layer { z-index:1; }
#pip .matte { z-index:2; }
.rb-clone { position:absolute; right:18px; bottom:155px; width:380px; height:675px; object-fit:fill; pointer-events:none; filter:grayscale(1) contrast(1.18) brightness(1.04); z-index:7; transform-origin:70% 100%; }
.rb-clone video,.rb-clone img { display:block; width:100%; height:100%; object-fit:fill; }
.rb-clone img { -webkit-mask-image:linear-gradient(to bottom,#000 66%,transparent 100%); mask-image:linear-gradient(to bottom,#000 66%,transparent 100%); }
.rb-part { display:inline-block; max-width:100%; line-height:1.02; overflow-wrap:anywhere; will-change:transform,opacity,filter; }
.rb-word { display:inline-block; margin-right:.14em; will-change:transform,opacity,filter,background-position; }
.rb-word:last-child { margin-right:0; }
.rb-white { font:700 76px/1.12 'Inter Tight',Inter,sans-serif; color:#fff; letter-spacing:-.03em; text-shadow:0 4px 16px rgba(0,0,0,.62),0 1px 3px rgba(0,0,0,.82); }
.rb-dark { font:700 76px/1.12 'Inter Tight',Inter,sans-serif; color:#181b1e; letter-spacing:-.03em; text-shadow:0 2px 14px rgba(255,255,255,.72); }
.rb-muted { font:500 58px/1.12 'Inter Tight',Inter,sans-serif; color:#f6f7f8; letter-spacing:-.015em; text-shadow:0 3px 12px rgba(0,0,0,.64); }
.rb-serif { font:italic 700 84px/1.1 'Playfair Display',Georgia,serif; color:#fff; letter-spacing:-.015em; text-shadow:0 4px 16px rgba(0,0,0,.6); }
.rb-ghost { font:700 172px/1.06 'Inter Tight',Inter,sans-serif; color:rgba(235,240,240,.72); letter-spacing:-.055em; text-shadow:0 4px 18px rgba(0,0,0,.22); }
.rb-magenta,.rb-teal,.rb-coral { font:700 158px/1.14 Oswald,'Inter Tight',sans-serif; text-transform:uppercase; letter-spacing:-.02em; }
.rb-magenta { filter:drop-shadow(0 5px 0 #7a0d66) drop-shadow(0 12px 24px rgba(255,76,216,.44)); }
.rb-magenta .rb-word { background:linear-gradient(115deg,#d61bb5 0%,#ff4cd8 28%,#ffc6fa 46%,#ff59df 64%,#b8149c 100%); background-size:240% 180%; -webkit-background-clip:text; background-clip:text; color:transparent; padding:.22em .09em .24em; margin-top:-.18em; margin-bottom:-.20em; }
.rb-coral { font-size:142px; filter:drop-shadow(0 4px 0 #701031) drop-shadow(0 10px 20px rgba(0,0,0,.48)); }
.rb-coral .rb-word { background:linear-gradient(115deg,#cc1f52 0%,#ff4676 30%,#ffb3c8 48%,#ff5884 66%,#a81542 100%); background-size:240% 180%; -webkit-background-clip:text; background-clip:text; color:transparent; padding:.22em .09em .24em; margin-top:-.18em; margin-bottom:-.20em; }
.rb-teal { filter:drop-shadow(0 0 18px rgba(64,238,227,.32)); }
.rb-teal .rb-word { background:linear-gradient(125deg,#18b8b2 0%,#4bf6ec 30%,#c8fffc 48%,#2de0d5 68%,#0c7d7c 100%); background-size:240% 180%; -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-mask-image:linear-gradient(180deg,#000 44%,rgba(0,0,0,.48) 76%,rgba(0,0,0,.05) 100%); mask-image:linear-gradient(180deg,#000 44%,rgba(0,0,0,.48) 76%,rgba(0,0,0,.05) 100%); padding:.22em .09em .24em; margin-top:-.18em; margin-bottom:-.20em; }
.rb-yellow { font:800 172px/1.16 'Inter Tight',Inter,sans-serif; letter-spacing:-.05em; filter:drop-shadow(0 6px 18px rgba(0,0,0,.46)); }
.rb-yellow .rb-word { background:linear-gradient(115deg,#c28d18 0%,#ffe168 30%,#fff9d6 48%,#ffd84d 66%,#a97812 100%); background-size:240% 180%; -webkit-background-clip:text; background-clip:text; color:transparent; padding:.22em .09em .26em; margin-top:-.18em; margin-bottom:-.22em; }
.rb-navy { font:800 170px/1.16 'Inter Tight',Inter,sans-serif; letter-spacing:-.055em; mix-blend-mode:multiply; }
.rb-navy .rb-word { background:linear-gradient(118deg,#071636 0%,#163c82 32%,#3b6ec7 48%,#0e2c66 66%,#061430 100%); background-size:240% 180%; -webkit-background-clip:text; background-clip:text; color:transparent; padding:.22em .09em .26em; margin-top:-.18em; margin-bottom:-.22em; }
.rb-peach { font:800 160px/1.16 'Inter Tight',Inter,sans-serif; letter-spacing:-.045em; filter:drop-shadow(0 6px 16px rgba(52,21,10,.48)); }
.rb-peach .rb-word { background:linear-gradient(115deg,#e27c4d 0%,#f79d72 30%,#ffece0 48%,#f5986b 66%,#cc683b 100%); background-size:240% 180%; -webkit-background-clip:text; background-clip:text; color:transparent; padding:.22em .09em .26em; margin-top:-.18em; margin-bottom:-.22em; }
.rb-plum { font:800 168px/1.16 'Inter Tight',Inter,sans-serif; letter-spacing:-.05em; mix-blend-mode:multiply; }
.rb-plum .rb-word { background:linear-gradient(118deg,#321a2d 0%,#5b3a54 32%,#a882a0 48%,#4a2c44 66%,#2a1426 100%); background-size:240% 180%; -webkit-background-clip:text; background-clip:text; color:transparent; padding:.22em .09em .26em; margin-top:-.18em; margin-bottom:-.22em; }
.rb-script { font:700 120px/1.2 'Dancing Script',cursive; color:#86f9be; letter-spacing:-.02em; transform:rotate(-5deg); padding:.1em .06em .18em; filter:drop-shadow(0 4px 10px rgba(0,0,0,.78)) drop-shadow(0 0 16px rgba(134,249,190,.34)); }
.rb-type.display .rb-white,.rb-type.display .rb-muted { color:#fff; }
.rb-media { position:absolute; inset:0; overflow:hidden; background:#142624; }
.rb-media > img,.rb-media > video { width:100%; height:100%; object-fit:cover; display:block; }
.rb-media.card .rb-media-bg,.rb-media.gallery .rb-media-bg { position:absolute; inset:-40px; width:calc(100% + 80px); height:calc(100% + 80px); background-size:cover; background-position:center; filter:blur(18px) brightness(.64) saturate(1.16); transform:scale(1.06); }
.rb-media.card::after { content:''; position:absolute; inset:0; pointer-events:none; background:linear-gradient(180deg,rgba(0,0,0,.36) 0%,rgba(0,0,0,.08) 42%,rgba(0,0,0,.08) 72%,rgba(0,0,0,.4) 100%); }
.rb-media.card .rb-media-card { position:absolute; left:6.5%; top:41%; width:87%; height:34%; border-radius:28px; object-fit:cover; box-shadow:0 22px 56px rgba(0,0,0,.55); z-index:1; }
.rb-media.gallery { background:radial-gradient(circle at 20% 25%, #23c7aa 0%, #0d9c84 55%, #076c5d 100%); perspective:1150px; }
.rb-media.gallery .rb-media-bg { display:none; }
.rb-media.gallery::after { content:''; position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 18% 34%,rgba(190,255,220,.32) 0,transparent 14%),radial-gradient(circle at 84% 66%,rgba(190,255,220,.26) 0,transparent 16%),radial-gradient(circle at 74% 18%,rgba(160,255,215,.22) 0,transparent 12%); mix-blend-mode:screen; }
.rb-media.gallery .rb-gallery { position:absolute; inset:9% 6.5% 9%; display:grid; grid-template-rows:repeat(3,1fr); gap:22px; padding:20px; background:rgba(18,165,140,.92); border-radius:32px; box-shadow:0 20px 56px rgba(0,0,0,.5); backface-visibility:hidden; }
.rb-media.gallery .rb-gallery img { width:100%; height:100%; min-height:0; object-fit:cover; border-radius:20px; box-shadow:0 8px 18px rgba(0,0,0,.28); }
.rb-flare { position:absolute; inset:0; pointer-events:none; z-index:2; background:radial-gradient(circle at 24% 84%,rgba(255,112,38,.88) 0%,rgba(255,168,76,.62) 34%,rgba(255,220,140,.22) 60%,rgba(255,140,60,0) 82%),linear-gradient(125deg,rgba(255,180,90,.42),rgba(255,95,30,.28) 45%,transparent 78%); mix-blend-mode:screen; }
.rb-flash { position:absolute; inset:0; pointer-events:none; z-index:5; background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.95),rgba(255,255,255,.72) 60%,rgba(255,255,255,.45) 100%); mix-blend-mode:screen; }
.rb-stock-note { position:absolute; left:38px; bottom:95px; padding:5px 10px; font:500 25px 'Inter Tight',sans-serif; color:#fff; background:rgba(0,0,0,.46); border-radius:4px; }
`;

const VALID_ROLES = new Set(['white','dark','magenta','coral','teal','yellow','navy','peach','plum','script','serif','muted','ghost']);
const HERO_ROLES = new Set(['magenta', 'coral', 'teal', 'yellow', 'navy', 'peach', 'plum', 'ghost']);
const SHIMMER_ROLES = new Set(['magenta', 'coral', 'teal', 'yellow', 'navy', 'peach', 'plum']);
const VALID_PLACEMENTS = new Set(['upper','upper-left','upper-right','center','mid-left','mid-right','lower-left']);
const VALID_ALIGNS = new Set(['left','center','right']);

export function reviewBdsType({ beat, id, t0, t1, E, esc, tl, faceTop }) {
  const parts = Array.isArray(beat.parts) ? beat.parts : [];
  const byRow = new Map();
  const rowRoles = new Map();
  const allWordSelectors = [];
  parts.forEach((part, index) => {
    const at = Math.max(t0, Math.min(t1 - .06, E(part.at, 'Review BDS part')));
    const role = VALID_ROLES.has(part.role) ? part.role : 'white';
    const motion = ['rise','spread','slam','flicker','jitter','flash','wipe','drift','cut'].includes(part.motion) ? part.motion
      : role === 'script' ? 'wipe' : role === 'ghost' ? 'drift' : HERO_ROLES.has(role) ? 'slam' : 'rise';
    const row = Math.max(0, Math.min(3, Number(part.row) || 0));
    const spoken = Array.isArray(part.words) && part.words.length ? part.words : [{ text: part.text, at: part.at }];
    byRow.set(row, (byRow.get(row) || '') + `<span id="${id}-p${index}" class="rb-part rb-${role}">${spoken.map((word, wi) => `<span id="${id}-p${index}-w${wi}" class="rb-word">${esc(word.text)}</span>`).join('')}</span>`);
    rowRoles.set(row, [...(rowRoles.get(row) || []), role]);
    spoken.forEach((word, wi) => {
      const wordAt = Math.max(t0, Math.min(t1 - .03, E(word.at, 'Review BDS word')));
      const wordSel = `#${id}-p${index}-w${wi}`;
      allWordSelectors.push(wordSel);
      if (motion === 'spread') {
        const spreadX = Math.round((wi - (spoken.length - 1) / 2) * -38);
        tl.push(`ft("${wordSel}",{autoAlpha:0,x:${spreadX},scale:.82,filter:"blur(8px)"},{autoAlpha:1,x:0,scale:1,filter:"blur(0px)",duration:.36,ease:"expo.out"},${wordAt});`);
      } else {
        const wordFrom = wi === 0 ? '{autoAlpha:0}' : role === 'script' ? '{autoAlpha:0,x:-14,filter:"blur(3px)"}' : '{autoAlpha:0,y:15,scale:.94,filter:"blur(5px)"}';
        const wordMotion = wi === 0 ? '{autoAlpha:1,duration:.025,ease:"none"}'
          : role === 'script' ? '{autoAlpha:1,x:0,filter:"blur(0px)",duration:.2,ease:"expo.out"}'
          : '{autoAlpha:1,y:0,scale:1,filter:"blur(0px)",duration:.22,ease:"expo.out"}';
        tl.push(`ft("${wordSel}",${wordFrom},${wordMotion},${wordAt});`);
      }
      if (SHIMMER_ROLES.has(role) && t1 - wordAt > .35) {
        const sweepDur = Math.max(.35, Math.min(2.6, t1 - wordAt - .12));
        tl.push(`ft("${wordSel}",{backgroundPosition:"0% 10%"},{backgroundPosition:"100% 60%",duration:${sweepDur.toFixed(3)},ease:"sine.inOut"},${wordAt});`);
      }
    });
    const sel = `#${id}-p${index}`;
    if (motion === 'cut') tl.push(`ft("${sel}", {autoAlpha:0}, {autoAlpha:1,duration:.03,ease:"none"}, ${at});`);
    else if (motion === 'spread') tl.push(`ft("${sel}", {autoAlpha:0,scale:.84,filter:"blur(10px)"}, {autoAlpha:1,scale:1,filter:"blur(0px)",duration:.4,ease:"expo.out"}, ${at});`);
    else if (motion === 'wipe') tl.push(`ft("${sel}", {autoAlpha:0,x:-26,clipPath:"inset(0 100% 0 0)"}, {autoAlpha:1,x:0,clipPath:"inset(0 0% 0 0)",duration:.38,ease:"expo.out"}, ${at});`);
    else if (motion === 'drift') tl.push(`ft("${sel}", {autoAlpha:0,x:-44,scale:1.18,filter:"blur(10px)"}, {autoAlpha:1,x:0,scale:1,filter:"blur(0px)",duration:.42,ease:"expo.out"}, ${at});`);
    else if (motion === 'flicker') {
      tl.push(`ft("${sel}", {autoAlpha:0,scale:1.18,filter:"blur(7px)"}, {autoAlpha:1,scale:1,filter:"blur(0px)",duration:.05,ease:"none"}, ${at});`);
      tl.push(`tl.set("${sel}",{autoAlpha:.12,x:-6},${(at+.055).toFixed(3)});tl.set("${sel}",{autoAlpha:1,x:6,scale:1.05},${(at+.105).toFixed(3)});tl.set("${sel}",{autoAlpha:.22,x:-4},${(at+.15).toFixed(3)});tl.to("${sel}",{autoAlpha:1,x:0,scale:1,duration:.08,ease:"expo.out"},${(at+.195).toFixed(3)});`);
    } else if (motion === 'jitter') {
      tl.push(`ft("${sel}", {autoAlpha:0,x:-28,y:16,rotation:-2.2,scale:1.2,filter:"blur(8px)"}, {autoAlpha:1,x:16,y:-7,rotation:1.6,scale:1.04,filter:"blur(0px)",duration:.06,ease:"none"}, ${at});`);
      tl.push(`tl.to("${sel}",{x:-12,y:5,rotation:-1.1,scale:.98,duration:.05,ease:"none"},${(at+.06).toFixed(3)});tl.to("${sel}",{x:6,y:-3,rotation:.5,scale:1.01,duration:.045,ease:"none"},${(at+.11).toFixed(3)});tl.to("${sel}",{x:0,y:0,rotation:0,scale:1,duration:.1,ease:"expo.out"},${(at+.155).toFixed(3)});`);
    } else if (motion === 'slam' || motion === 'flash') {
      tl.push(`ft("${sel}", {autoAlpha:0,y:${['yellow','navy','peach','plum'].includes(role) ? 40 : -40},scale:1.28,filter:"blur(10px)"}, {autoAlpha:1,y:0,scale:1,filter:"blur(0px)",duration:.26,ease:"expo.out"}, ${at});`);
      if (motion === 'flash') {
        // Double exposure-flash pulse + snappy micro-shake matching @editortapsu78's chớp giật.
        tl.push(`ft("#${id}-flash", {autoAlpha:0}, {autoAlpha:.78,duration:.025,ease:"none"}, ${at});tl.to("#${id}-flash",{autoAlpha:.12,duration:.055,ease:"power2.out"},${(at+.025).toFixed(3)});tl.to("#${id}-flash",{autoAlpha:.52,duration:.025,ease:"none"},${(at+.08).toFixed(3)});tl.to("#${id}-flash",{autoAlpha:0,duration:.11,ease:"power2.out"},${(at+.105).toFixed(3)});`);
        tl.push(`tl.to("#${id}-in .rb-row",{x:-12,y:6,scale:1.04,duration:.04,ease:"none"},${at});tl.to("#${id}-in .rb-row",{x:10,y:-5,scale:.99,duration:.04,ease:"none"},${(at+.04).toFixed(3)});tl.to("#${id}-in .rb-row",{x:-5,y:3,scale:1.01,duration:.04,ease:"none"},${(at+.08).toFixed(3)});tl.to("#${id}-in .rb-row",{x:0,y:0,scale:1,duration:.08,ease:"expo.out"},${(at+.12).toFixed(3)});`);
      }
    } else tl.push(`ft("${sel}", {autoAlpha:0,y:18,scale:.95,filter:"blur(6px)"}, {autoAlpha:1,y:0,scale:1,filter:"blur(0px)",duration:.24,ease:"expo.out"}, ${at});`);
  });

  // Wind-blow / mist-drift exit: words drift gently sideways & dissolve into soft blur before t1.
  const exitDur = Math.min(.24, Math.max(.12, (t1 - t0) * .22));
  const exitStart = Math.max(t0 + .16, t1 - exitDur);
  if (allWordSelectors.length && exitStart < t1 - .04) {
    const staggerStep = allWordSelectors.length > 1 ? Math.min(.022, (exitDur * .35) / (allWordSelectors.length - 1)) : 0;
    allWordSelectors.forEach((wordSel, wi) => {
      const startAt = (exitStart + wi * staggerStep).toFixed(3);
      const dur = Math.max(.1, exitDur - wi * staggerStep).toFixed(3);
      tl.push(`tl.to("${wordSel}",{autoAlpha:0,x:32,y:-10,scale:1.04,filter:"blur(10px)",duration:${dur},ease:"power2.in"},${startAt});`);
    });
  }

  const orderedRows = [...byRow.entries()].sort((a, b) => a[0] - b[0]);
  const rows = orderedRows.map(([row, content], idx) => {
    const roles = rowRoles.get(row) || [];
    const prevRoles = idx > 0 ? (rowRoles.get(orderedRows[idx - 1][0]) || []) : [];
    const nextRoles = idx + 1 < orderedRows.length ? (rowRoles.get(orderedRows[idx + 1][0]) || []) : [];
    const leadKiss = roles.every(r => r === 'white' || r === 'muted' || r === 'dark') && nextRoles.some(r => HERO_ROLES.has(r));
    const overlapScript = roles.length === 1 && roles[0] === 'script' && prevRoles.some(r => HERO_ROLES.has(r) || r === 'white' || r === 'dark');
    const tightSub = !overlapScript && idx > 0 && roles.every(r => r === 'white' || r === 'muted' || r === 'dark') && prevRoles.some(r => HERO_ROLES.has(r));
    const cls = `rb-row r${row}${leadKiss ? ' rb-row-lead-kiss' : ''}${overlapScript ? ' rb-row-script-overlap' : ''}${tightSub ? ' rb-row-tight-sub' : ''}`;
    return `<div class="${cls}">${content}</div>`;
  }).join('');
  const placement = VALID_PLACEMENTS.has(beat.placement) ? beat.placement : 'upper';
  const align = VALID_ALIGNS.has(beat.align) ? beat.align : (placement.endsWith('left') ? 'left' : placement.endsWith('right') ? 'right' : 'center');
  const depth = beat.depth === 'behind' ? 'depth-behind' : '';
  const depthY = Number.isFinite(faceTop) ? Math.max(380, Math.min(1040, Math.round(faceTop - 20))) : 640;
  return { html: `<div id="${id}-in" class="rb-type ${beat.kind === 'display' ? 'display' : 'talk'} pos-${placement} align-${align} ${depth}" style="--rb-depth-y:${depthY}px"${depth ? ' data-layout-allow-occlusion' : ''}><div class="rb-stack">${rows}</div>${parts.some(part => part.motion === 'flash') ? `<div id="${id}-flash" class="rb-flash"></div>` : ''}</div>` };
}
