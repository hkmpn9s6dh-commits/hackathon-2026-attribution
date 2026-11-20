// Figures for the report. Every number is read from out/results.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { svg, text, line, rect, path, circle, axes, INK, MUTED, RULE } from './svg.mjs';

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
const NL = String.fromCharCode(10);

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
    const x = x0 + ((x1 - x0) * lvl) / 3 + (lvl === 2 ? (k === 'loose_nonbenign' ? -20 : 20) : 0);
    const cy = y - 34;
    o.push(circle(x, cy - (side > 0 ? 18 : 0), 7, { fill: side > 0 ? '#ffffff' : INK, stroke: INK, width: 1.2 }));
    const letter = k === 'rogue' ? 'A' : k === 'tight_nonbenign' ? 'B' : k === 'loose_nonbenign' ? 'C' : k === 'vloose_benign' ? 'D' : 'E';
    o.push(text(x, cy - (side > 0 ? 18 : 0) + 3.2, letter, { size: 8, fill: side > 0 ? INK : '#ffffff', anchor: 'middle', weight: 'bold' }));
    o.push(text(x, cy - (side > 0 ? 18 : 0) + (side > 0 ? -13 : 20), SHORT[k], { size: 8.5, fill: MUTED, anchor: 'middle' }));
  }

  o.push(rect(70, 176, 232, 54, { fill: '#f9fafb', stroke: RULE }));
  o.push(text(82, 194, 'Channel 1 — when', { size: 9.5, weight: 'bold' }));
  o.push(text(82, 210, 'tick alignment, reply latency after a', { size: 8.5, fill: MUTED }));
  o.push(text(82, 222, 'message, burstiness, actions per hour', { size: 8.5, fill: MUTED }));

  o.push(rect(318, 176, 242, 54, { fill: '#f9fafb', stroke: RULE }));
  o.push(text(330, 194, 'Channel 2 — what', { size: 9.5, weight: 'bold' }));
  o.push(text(330, 210, 'targets, tools, shell chain length,', { size: 8.5, fill: MUTED }));
  o.push(text(330, 222, 'share of actions on sensitive paths', { size: 8.5, fill: MUTED }));

  o.push(text(70, 252, 'Latent (never observed): who the human is, and what they intend.', { size: 8.5, fill: MUTED }));
  save('fig1_testbed.svg', svg(W, H, o.join(NL)));
}

// ---------------------------------------------------------------- fig 2: confusion
{
  const raw = R.main.results['both/gbm'].five.confusion;
  const display = ['rogue', 'tight_nonbenign', 'loose_nonbenign', 'vloose_benign', 'loose_benign'];
  const idx = display.map((k) => ORDER.indexOf(k));
  const m = idx.map((i) => idx.map((j) => raw[i][j]));
  const W = 340, H = 330, left = 96, top = 70, cell = 40;
  const o = [];
  o.push(text(0, 14, 'B. Five-way confusion, L0', { size: 12, weight: 'bold' }));
  o.push(text(0, 32, `macro-F1 ${R.main.results['both/gbm'].five.macroF1.toFixed(2)} · rows = truth, columns = prediction`, { size: 9, fill: MUTED }));
  let maxV = 0;
  for (const row of m) for (const v of row) maxV = Math.max(maxV, v);
  for (let i = 0; i < m.length; i++) {
    o.push(text(left - 8, top + i * cell + 24, SHORT[display[i]], { size: 8.5, fill: MUTED, anchor: 'end' }));
    for (let j = 0; j < m[i].length; j++) {
      const v = m[i][j] / maxV;
      o.push(rect(left + j * cell, top + i * cell, cell - 2, cell - 2, { fill: `rgba(17,24,39,${(0.06 + v * 0.9).toFixed(3)})` }));
      o.push(text(left + j * cell + (cell - 2) / 2, top + i * cell + 24, String(m[i][j]), {
        size: 9, fill: v > 0.45 ? '#ffffff' : INK, anchor: 'middle',
      }));
    }
  }
  for (let j = 0; j < m.length; j++) {
    o.push(text(left + j * cell + (cell - 2) / 2, top - 10, 'ABCDE'[j], { size: 9, fill: MUTED, anchor: 'middle' }));
  }
  o.push(text(left + 2 * cell - 1, top - 28, 'predicted', { size: 8, fill: MUTED, anchor: 'middle' }));
  save('fig2_confusion.svg', svg(W, H, o.join(NL)));
}

// ---------------------------------------------------------------- fig 3: channels
{
  const W = 640, H = 268;
  const o = [];
  o.push(text(0, 14, 'C. Two channels, three questions', { size: 12, weight: 'bold' }));
  o.push(text(0, 30, 'Same models, same folds. Panel (ii) is the trap: it looks like an intent classifier but it is reading the leash.', { size: 9, fill: MUTED }));

  const T = R.summary;
  const panels = [
    { x: 16, title: '(i) Does it know the leash?', unit: 'Spearman ρ · chance = 0', chance: 0, bars: [['timing', T.control_rho_timing_L0, C_TIMING], ['targets', T.control_rho_target_L0, C_TARGET]] },
    { x: 224, title: '(ii) Intent, all five classes', unit: 'AUC · dashed = chance', chance: 0.5, bars: [['timing', T.intent_auc_timing_L0, C_TIMING], ['targets', T.intent_auc_target_L0, C_TARGET]] },
    { x: 432, title: '(iii) Intent, leash held fixed', unit: 'AUC · dashed = chance', chance: 0.5, bars: [['timing', T.intent_auc_matched_timing, C_TIMING], ['targets', T.intent_auc_matched_target, C_TARGET]] },
  ];
  for (const p of panels) {
    const w = 176, h = 108, y = 96;
    const lo = p.chance === 0 ? 0 : 0.4, hi = 1;
    o.push(text(p.x, 54, p.title, { size: 9, weight: 'bold' }));
    o.push(text(p.x, 68, p.unit, { size: 8, fill: MUTED }));
    o.push(line(p.x + 6, y + h, p.x + w, y + h, { stroke: INK }));
    if (p.chance > 0) {
      const cy = y + h - ((p.chance - lo) / (hi - lo)) * h;
      o.push(line(p.x + 6, cy, p.x + w, cy, { stroke: C_CHANCE, dash: '3 3' }));
    }
    p.bars.forEach(([label, v, color], i) => {
      const bh = Math.max(1, ((v - lo) / (hi - lo)) * (h - 18));
      const bx = p.x + 22 + i * 78;
      o.push(rect(bx, y + h - bh, 56, bh, { fill: color, opacity: 0.88 }));
      o.push(text(bx + 28, y + h - bh - 6, v.toFixed(2), { size: 10, anchor: 'middle', weight: 'bold' }));
      o.push(text(bx + 28, y + h + 14, label, { size: 8.5, fill: MUTED, anchor: 'middle' }));
    });
  }
  o.push(text(16, 252, '(i) is what the clock knows; (iii) is what the file paths know; (ii) is what a model reports when nobody holds the leash fixed.', { size: 9, fill: MUTED }));
  save('fig3_channels.svg', svg(W, H, o.join(NL)));
}

// ---------------------------------------------------------------- fig 4: ladder
{
  const W = 640, H = 404;
  const o = [];
  o.push(text(0, 14, 'D. The evasion ladder', { size: 12, weight: 'bold' }));
  o.push(text(0, 30, 'Retrained at each level (solid) versus a detector frozen at L0 (dashed). Lower panel: intent from targets only.', { size: 9, fill: MUTED }));

  const x0 = 66, w = 524;
  const topY = 58, topH = 128, botY = 238, botH = 108;
  const sx = (i) => x0 + (i / 4) * w;
  const syTop = (v) => topY + topH - ((Math.max(-1, Math.min(1, v)) + 1) / 2) * topH;
  const syBot = (v) => botY + botH - ((Math.max(0.4, Math.min(1, v)) - 0.4) / 0.6) * botH;

  o.push(text(x0, 50, 'leash ρ', { size: 8.5, fill: MUTED }));
  o.push(axes(x0, topY, w, topH, {
    xTicks: [0, 1, 2, 3, 4].map((i) => ({ v: i, label: `L${i}` })),
    yTicks: [-1, -0.5, 0, 0.5, 1], yMin: -1, yMax: 1, fmt: (v) => v.toFixed(1),
  }));

  o.push(text(x0, 230, 'intent AUC', { size: 8.5, fill: MUTED }));
  o.push(axes(x0, botY, w, botH, {
    xTicks: [], yTicks: [0.4, 0.6, 0.8, 1], yMin: 0.4, yMax: 1, fmt: (v) => v.toFixed(1),
  }));
  o.push(line(x0, syBot(0.5), x0 + w, syBot(0.5), { stroke: C_CHANCE, dash: '3 3' }));
  o.push(text(x0 + 4, syBot(0.5) - 3, 'chance', { size: 7.5, fill: C_CHANCE }));
  for (let i = 0; i <= 4; i++) o.push(text(sx(i), botY + botH + 15, `L${i}`, { size: 9, fill: MUTED, anchor: 'middle' }));

  const series = (pick, color, dash, sy) => {
    const pts = [0, 1, 2, 3, 4].map((i) => [sx(i), sy(pick(R.ladder[`L${i}`]))]);
    o.push(path(pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' '), { stroke: color, width: 2, dash: dash || '' }));
    for (const q of pts) o.push(circle(q[0], q[1], 2.6, { fill: color }));
  };
  series((r) => r['both/gbm'].control.rho, C_BOTH, '', syTop);
  series((r) => r['timing/gbm'].control.rho, C_TIMING, '', syTop);
  series((r) => r['target/gbm'].control.rho, C_TARGET, '', syTop);
  series((r) => r.transfer_both.control.rho, '#6b7280', '2 3', syTop);
  series((r) => r['target/gbm'].intent.auc, C_TARGET, '', syBot);
  series((r) => r['both/gbm'].intent.auc, C_BOTH, '5 3', syBot);

  const legend = [
    ['leash ρ, timing', C_TIMING, ''],
    ['leash ρ, targets', C_TARGET, ''],
    ['leash ρ, both', C_BOTH, ''],
    ['frozen L0 detector', '#6b7280', '2 3'],
    ['intent AUC, targets', C_TARGET, ''],
    ['intent AUC, both', C_BOTH, '5 3'],
  ];
  legend.forEach(([label, color, dash], i) => {
    const ly = 380 + Math.floor(i / 3) * 13;
    const lx = x0 + (i % 3) * 174;
    o.push(line(lx, ly - 3, lx + 16, ly - 3, { stroke: color, width: 2, dash }));
    o.push(text(lx + 21, ly, label, { size: 8, fill: MUTED }));
  });
  save('fig4_ladder.svg', svg(W, H, o.join(NL)));
}

// ---------------------------------------------------------------- fig 5: curve
{
  const W = 640, H = 250;
  const o = [];
  o.push(text(0, 14, 'E. How long before you can say anything?', { size: 12, weight: 'bold' }));
  o.push(text(0, 30, 'Discrimination against the number of actions observed, for the honest (L0) and disguised (L3) fleet.', { size: 9, fill: MUTED }));

  const panels = [
    { x: 50, key: 'control_rho', title: 'leash ρ', min: 0, max: 1 },
    { x: 352, key: 'intent_auc', title: 'intent AUC (targets)', min: 0.4, max: 1 },
  ];
  for (const p of panels) {
    const w = 236, h = 130, y = 76;
    const counts = R.curve.L0.map((r) => r.actions);
    const lx = (i) => p.x + (i / (counts.length - 1)) * w;
    const ly = (v) => y + h - ((v - p.min) / (p.max - p.min)) * h;
    o.push(text(p.x, 58, p.title, { size: 9.5, weight: 'bold' }));
    for (let g = 0; g <= 4; g++) {
      const gv = p.min + ((p.max - p.min) * g) / 4;
      o.push(line(p.x, ly(gv), p.x + w, ly(gv), { stroke: RULE, width: 0.5, dash: '2 3' }));
      o.push(text(p.x - 5, ly(gv) + 3, gv.toFixed(2), { size: 7.5, fill: MUTED, anchor: 'end' }));
    }
    o.push(line(p.x, y + h, p.x + w, y + h, { stroke: INK }));
    o.push(line(p.x, y, p.x, y + h, { stroke: INK }));
    for (let i = 0; i < counts.length; i++) {
      o.push(text(lx(i), y + h + 14, String(counts[i]), { size: 8, fill: MUTED, anchor: 'middle' }));
    }
    o.push(text(p.x + w / 2, y + h + 29, 'actions observed', { size: 8, fill: MUTED, anchor: 'middle' }));
    for (const [level, color, dash] of [['L0', '#111827', ''], ['L3', '#b45309', '4 3']]) {
      const pts = R.curve[level].map((r, i) => [lx(i), ly(Math.max(p.min, Math.min(p.max, r[p.key])))]);
      o.push(path(pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' '), { stroke: color, width: 1.8, dash }));
      for (const q of pts) o.push(circle(q[0], q[1], 2.4, { fill: color }));
    }
  }
  o.push(line(50, 242, 66, 242, { stroke: '#111827', width: 2 }));
  o.push(text(72, 245, 'L0 honest fleet', { size: 8.5, fill: MUTED }));
  o.push(line(176, 242, 192, 242, { stroke: '#b45309', width: 2, dash: '4 3' }));
  o.push(text(198, 245, 'L3 disguised fleet', { size: 8.5, fill: MUTED }));
  save('fig5_curve.svg', svg(W, H, o.join(NL)));
}
