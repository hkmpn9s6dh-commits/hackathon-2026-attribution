// Figures for the report. Every number is read from out/results.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { svg, text, line, rect, path, circle, axes, INK, MUTED, RULE, SANS } from './svg.mjs';

const R = JSON.parse(readFileSync('out/results.json', 'utf8'));
const ORDER = R.meta.class_order;
const SHORT = {
  rogue: 'A rogue',
  tight_nonbenign: 'B close',
  loose_nonbenign: 'C loose',
  vloose_benign: 'D v.loose',
  loose_benign: 'E loose+',
};
const C_TIMING = '#b45309';
const C_TARGET = '#1d4ed8';
const C_BOTH = '#111827';
const C_CHANCE = '#9ca3af';

mkdirSync('out/figures', { recursive: true });

function save(name, content) {
  writeFileSync(`out/figures/${name}`, content);
  console.log('wrote', name);
}

// ---------------------------------------------------------------- fig 1: testbed
{
  const W = 640, H = 260;
  const o = [];
  o.push(text(0, 14, 'A. The observable problem', { size: 12, weight: 'bold' }));
  o.push(text(0, 32, 'Five actor types, one ordinal axis (how tightly a human is in the loop), and two channels a responder can actually read.', { size: 9.5, fill: MUTED }));

  const x0 = 70, x1 = 560, y = 132;
  o.push(line(x0, y, x1, y, { stroke: INK, width: 1.2 }));
  for (let l = 0; l <= 3; l++) {
    const x = x0 + ((x1 - x0) * l) / 3;
    o.push(line(x, y - 4, x, y + 4, { stroke: INK }));
    o.push(text(x, y + 20, ['nobody steering', 'very loose', 'loose', 'tight'][l], { size: 8.5, fill: MUTED, anchor: 'middle' }));
  }
  const pos = { rogue: [0, -1], vloose_benign: [1, 1], loose_nonbenign: [2, -1], loose_benign: [2, 1], tight_nonbenign: [3, 1] };
  for (const k of Object.keys(pos)) {
    const [lvl, side] = pos[k];
    const x = x0 + ((x1 - x0) * lvl) / 3 + (lvl === 2 ? (k === 'loose_nonbenign' ? -18 : 18) : 0);
    const cy = y - 26 + (side < 0 ? -6 : 0);
    o.push(circle(x, cy - (side > 0 ? 18 : 0), 7, { fill: side > 0 ? '#ffffff' : INK, stroke: INK, width: 1.2 }));
    o.push(text(x, cy - (side > 0 ? 18 : 0) + 3.2, k === 'rogue' ? 'A' : k === 'tight_nonbenign' ? 'B' : k === 'loose_nonbenign' ? 'C' : k === 'vloose_benign' ? 'D' : 'E', { size: 8, fill: side > 0 ? INK : '#ffffff', anchor: 'middle', weight: 'bold' }));
    o.push(text(x, cy - (side > 0 ? 18 : 0) + (side > 0 ? -13 : 20), SHORT[k], { size: 8.5, fill: MUTED, anchor: 'middle' }));
  }

  // channels
  o.push(rect(70, 176, 232, 54, { fill: '#f9fafb', stroke: RULE }));
  o.push(text(82, 194, 'Channel 1 — when', { size: 9.5, weight: 'bold' }));
  o.push(text(82, 210, 'tick alignment, reply latency after a', { size: 8.5, fill: MUTED }));
  o.push(text(82, 222, 'message, burstiness, actions per hour', { size: 8.5, fill: MUTED }));

  o.push(rect(318, 176, 242, 54, { fill: '#f9fafb', stroke: RULE }));
  o.push(text(330, 194, 'Channel 2 — what', { size: 9.5, weight: 'bold' }));
  o.push(text(330, 210, 'targets, tools, shell chain length,', { size: 8.5, fill: MUTED }));
  o.push(text(330, 222, 'share of actions on sensitive paths', { size: 8.5, fill: MUTED }));

  o.push(text(70, 252, 'Latent (never observed): who the human is, and what they intend.', { size: 8.5, fill: MUTED, style: 'font-style="italic"' }));
  save('fig1_testbed.svg', svg(W, H, o.join('\n')));
}

// ---------------------------------------------------------------- fig 2: confusion
{
  const raw = R.main.results['both/gbm'].five.confusion;
  const display = ['rogue', 'tight_nonbenign', 'loose_nonbenign', 'vloose_benign', 'loose_benign'];
  const idx = display.map((k) => ORDER.indexOf(k));
  const m = idx.map((i) => idx.map((j) => raw[i][j]));
  const W = 330, H = 320, left = 92, top = 62, cell = 40;
  const o = [];
  o.push(text(0, 14, 'B. Five-way confusion, L0', { size: 12, weight: 'bold' }));
  o.push(text(0, 30, `macro-F1 ${R.main.results['both/gbm'].five.macroF1.toFixed(2)} · rows = truth, columns = prediction`, { size: 9, fill: MUTED }));
  let maxV = 0;
  for (const row of m) for (const v of row) maxV = Math.max(maxV, v);
  for (let i = 0; i < m.length; i++) {
    o.push(text(left - 8, top + i * cell + 24, SHORT[display[i]], { size: 8.5, fill: MUTED, anchor: 'end' }));
    for (let j = 0; j < m[i].length; j++) {
      const v = m[i][j] / maxV;
      const fill = `rgba(17,24,39,${(0.06 + v * 0.9).toFixed(3)})`;
      o.push(rect(left + j * cell, top + i * cell, cell - 2, cell - 2, { fill }));
      const txt = String(m[i][j]);
      o.push(text(left + j * cell + (cell - 2) / 2, top + i * cell + 24, txt, {
        size: 9, fill: v > 0.45 ? '#ffffff' : INK, anchor: 'middle',
      }));
    }
  }
  for (let j = 0; j < m.length; j++) {
    o.push(text(left + j * cell + (cell - 2) / 2, top - 8, 'ABCDE'[j], { size: 9, fill: MUTED, anchor: 'middle' }));
  }
  o.push(text(left + 2 * cell - 1, top - 30, 'predicted', { size: 8, fill: MUTED, anchor: 'middle' }));
  save('fig2_confusion.svg', svg(W, H, o.join('\n')));
}

// ---------------------------------------------------------------- fig 3: channels
{
  const W = 640, H = 260;
  const o = [];
  o.push(text(0, 14, 'C. Two channels, three questions', { size: 12, weight: 'bold' }));
  o.push(text(0, 30, 'Bars are the same models on the same folds. Panel B is the trap: it looks like an intent classifier but it is reading the leash.', { size: 9, fill: MUTED }));

  const T = R.summary;
  const panels = [
    { x: 16, title: 'A. Does it know the leash?', unit: 'Spearman ρ · chance = 0', chance: 0, bars: [['timing', T.control_rho_timing_L0, C_TIMING], ['targets', T.control_rho_target_L0, C_TARGET]] },
    { x: 224, title: 'B. Intent, all five classes', unit: 'AUC · dashed = chance', chance: 0.5, bars: [['timing', T.intent_auc_timing_L0, C_TIMING], ['targets', T.intent_auc_target_L0, C_TARGET]] },
    { x: 432, title: 'C. Intent, leash held fixed', unit: 'AUC · dashed = chance', chance: 0.5, bars: [['timing', T.intent_auc_matched_timing, C_TIMING], ['targets', T.intent_auc_matched_target, C_TARGET]] },
  ];
  for (const p of panels) {
    const w = 176, h = 118, y = 76;
    const lo = p.chance === 0 ? 0 : 0.4, hi = 1;
    o.push(text(p.x, 56, p.title, { size: 9, weight: 'bold' }));
    o.push(text(p.x, 68, p.unit, { size: 8, fill: MUTED }));
    o.push(line(p.x + 6, y + h, p.x + w, y + h, { stroke: INK }));
    if (p.chance > 0) {
      const cy = y + h - ((p.chance - lo) / (hi - lo)) * h;
      o.push(line(p.x + 6, cy, p.x + w, cy, { stroke: C_CHANCE, dash: '3 3' }));
    }
    p.bars.forEach(([label, v, color], i) => {
      const bh = Math.max(1, ((v - lo) / (hi - lo)) * h);
      const bx = p.x + 22 + i * 78;
      o.push(rect(bx, y + h - bh, 56, bh, { fill: color, opacity: 0.88 }));
      o.push(text(bx + 28, y + h - bh - 6, v.toFixed(2), { size: 10, anchor: 'middle', weight: 'bold' }));
      o.push(text(bx + 28, y + h + 14, label, { size: 8.5, fill: MUTED, anchor: 'middle' }));
    });
  }
  o.push(text(16, 244, 'A is what the clock knows; C is what the file paths know; B is what a model reports when nobody holds the leash fixed.', { size: 9, fill: MUTED, style: 'font-style="italic"' }));
  save('fig3_channels.svg', svg(W, H, o.join('\n')));
}

// ---------------------------------------------------------------- fig 4: ladder
{
  const W = 640, H = 330;
  const o = [];
  o.push(text(0, 14, 'D. The evasion ladder', { size: 12, weight: 'bold' }));
  o.push(text(0, 30, 'Retrained at each level (solid) versus a detector frozen at L0 (dashed). Negative ρ means the ranking is inverted.', { size: 9, fill: MUTED }));

  const x0 = 56, y0 = 62, w = 540, h = 180;
  const ticks = [0, 1, 2, 3, 4].map((i) => ({ v: i, label: `L${i}` }));
  o.push(axes(x0, y0, w, h, {
    xTicks: ticks, yTicks: [-1, -0.5, 0, 0.5, 1], yMin: -1, yMax: 1,
    fmt: (v) => v.toFixed(1),
  }));

  const sx = (i) => x0 + (i / 4) * w;
  const sy = (v) => y0 + h - ((Math.max(-1, Math.min(1, v)) + 1) / 2) * h;
  const series = [
    { key: 'timing/gbm', pick: (r) => r.control.rho, color: C_TIMING, label: 'timing → control ρ' },
    { key: 'target/gbm', pick: (r) => r.control.rho, color: C_TARGET, label: 'targets → control ρ' },
    { key: 'both/gbm', pick: (r) => r.intent.auc, color: C_TARGET, label: 'targets → intent AUC', dash: '4 3' },
    { key: 'both/gbm', pick: (r) => r.control.rho, color: C_BOTH, label: 'both → control ρ' },
  ];
  for (const s of series) {
    const pts = [0, 1, 2, 3, 4].map((i) => [sx(i), sy(s.pick(R.ladder[`L${i}`][s.key]))]);
    o.push(path(pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), { stroke: s.color, width: 2, dash: s.dash ?? '' }));
    for (const p of pts) o.push(circle(p[0], p[1], 2.6, { fill: s.color }));
  }
  const tr = [0, 1, 2, 3, 4].map((i) => [sx(i), sy(Math.max(-1, Math.min(1, R.ladder[`L${i}`].transfer_both.control.rho)))]);
  o.push(path(tr.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), { stroke: '#6b7280', width: 1.6, dash: '2 3' }));

  const legend = [
    ['timing → control ρ', C_TIMING, ''],
    ['targets → control ρ', C_TARGET, ''],
    ['both → control ρ', C_BOTH, ''],
    ['targets → intent AUC', C_TARGET, '4 3'],
    ['frozen L0 detector, transferred', '#6b7280', '2 3'],
  ];
  legend.forEach(([label, color, dash], i) => {
    const ly = 276 + Math.floor(i / 3) * 16;
    const lx = 56 + (i % 3) * 190;
    o.push(line(lx, ly - 3, lx + 18, ly - 3, { stroke: color, width: 2, dash }));
    o.push(text(lx + 24, ly, label, { size: 8.5, fill: MUTED }));
  });
  save('fig4_ladder.svg', svg(W, H, o.join('\n')));
}

// ---------------------------------------------------------------- fig 5: curve
{
  const W = 640, H = 250;
  const o = [];
  o.push(text(0, 14, 'E. How long before you can say anything?', { size: 12, weight: 'bold' }));
  o.push(text(0, 30, 'Discrimination against the number of actions observed, for the honest (L0) and disguised (L3) fleet.', { size: 9, fill: MUTED }));

  const panels = [
    { x: 40, key: 'control_rho', title: 'control ρ', min: 0, max: 1 },
    { x: 350, key: 'intent_auc', title: 'intent AUC', min: 0.4, max: 1 },
  ];
  for (const p of panels) {
    const w = 230, h = 140, y = 66;
    const counts = R.curve.L0.map((r) => r.actions);
    const lx = (i) => p.x + (i / (counts.length - 1)) * w;
    const ly = (v) => y + h - ((v - p.min) / (p.max - p.min)) * h;
    o.push(text(p.x, 54, p.title, { size: 9.5, weight: 'bold' }));
    for (let g = 0; g <= 4; g++) {
      const gv = p.min + ((p.max - p.min) * g) / 4;
      o.push(line(p.x, ly(gv), p.x + w, ly(gv), { stroke: RULE, width: 0.5, dash: '2 3' }));
      o.push(text(p.x - 4, ly(gv) + 3, gv.toFixed(1), { size: 7.5, fill: MUTED, anchor: 'end' }));
    }
    o.push(line(p.x, y + h, p.x + w, y + h, { stroke: INK }));
    o.push(line(p.x, y, p.x, y + h, { stroke: INK }));
    for (let i = 0; i < counts.length; i++) {
      o.push(text(lx(i), y + h + 14, String(counts[i]), { size: 8, fill: MUTED, anchor: 'middle' }));
    }
    o.push(text(p.x + w / 2, y + h + 30, 'actions observed', { size: 8, fill: MUTED, anchor: 'middle' }));
    o.push(text(p.x, y - 6, p.max.toFixed(1), { size: 7.5, fill: MUTED }));
    o.push(text(p.x, y + h + 2, p.min.toFixed(1), { size: 7.5, fill: MUTED, anchor: 'end' }));

    for (const [level, color, dash] of [['L0', '#111827', ''], ['L3', '#b45309', '4 3']]) {
      const pts = R.curve[level].map((r, i) => [lx(i), ly(Math.max(p.min, Math.min(p.max, r[p.key])))]);
      o.push(path(pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' '), { stroke: color, width: 1.8, dash }));
      for (const q of pts) o.push(circle(q[0], q[1], 2.4, { fill: color }));
    }
  }
  o.push(line(40, 236, 58, 236, { stroke: '#111827', width: 2 }));
  o.push(text(64, 239, 'L0 honest fleet', { size: 8.5, fill: MUTED }));
  o.push(line(180, 236, 198, 236, { stroke: '#b45309', width: 2, dash: '4 3' }));
  o.push(text(204, 239, 'L3 disguised fleet', { size: 8.5, fill: MUTED }));
  save('fig5_curve.svg', svg(W, H, o.join('\n')));
}
