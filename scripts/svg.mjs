// Minimal SVG helpers for print figures: no dependencies, deterministic output.
export const INK = '#16181d';
export const MUTED = '#6b7280';
export const RULE = '#d1d5db';
export const SERIF = 'Georgia, "Times New Roman", serif';
export const SANS = '"Helvetica Neue", Arial, sans-serif';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function svg(w, h, body, { bg = '#ffffff' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family='${SANS}'>
<rect width="${w}" height="${h}" fill="${bg}"/>
${body}
</svg>`;
}

export function text(x, y, s, { size = 11, fill = INK, anchor = 'start', weight = 'normal', font = SANS, style = '' } = {}) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}" font-family='${font}' ${style}>${esc(s)}</text>`;
}

export function line(x1, y1, x2, y2, { stroke = INK, width = 1, dash = '' } = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
}

export function rect(x, y, w, h, { fill = 'none', stroke = 'none', width = 1, rx = 0, opacity = 1 } = {}) {
  return `<rect x="${x}" y="${y}" width="${Math.max(w, 0)}" height="${Math.max(h, 0)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" rx="${rx}" opacity="${opacity}"/>`;
}

export function path(d, { fill = 'none', stroke = INK, width = 1.5, dash = '', opacity = 1 } = {}) {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''} opacity="${opacity}"/>`;
}

export function circle(cx, cy, r, { fill = INK, stroke = 'none', width = 1 } = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
}

export function axes(x, y, w, h, { xTicks = [], yTicks = [], yLabel = '', xLabel = '', yMin = 0, yMax = 1, fmt = (v) => v.toFixed(1) } = {}) {
  const out = [];
  out.push(line(x, y + h, x + w, y + h, { stroke: INK, width: 1 }));
  out.push(line(x, y, x, y + h, { stroke: INK, width: 1 }));
  const sy = (v) => y + h - ((v - yMin) / (yMax - yMin)) * h;
  for (const t of yTicks) {
    out.push(line(x - 3, sy(t), x, sy(t), { stroke: INK }));
    out.push(text(x - 6, sy(t) + 3.5, fmt(t), { size: 9, fill: MUTED, anchor: 'end' }));
    out.push(line(x, sy(t), x + w, sy(t), { stroke: RULE, width: 0.5, dash: '2 3' }));
  }
  for (const t of xTicks) {
    const sx = x + ((t.v - xMinOf(xTicks)) / (xMaxOf(xTicks) - xMinOf(xTicks) || 1)) * w;
    out.push(line(sx, y + h, sx, y + h + 3, { stroke: INK }));
    out.push(text(sx, y + h + 15, t.label, { size: 9, fill: MUTED, anchor: 'middle' }));
  }
  if (yLabel) out.push(text(x, y - 10, yLabel, { size: 10, fill: INK }));
  if (xLabel) out.push(text(x + w, y + h + 30, xLabel, { size: 10, fill: MUTED, anchor: 'end' }));
  return out.join('\n');
}

function xMinOf(ticks) { return Math.min(...ticks.map((t) => t.v)); }
function xMaxOf(ticks) { return Math.max(...ticks.map((t) => t.v)); }
