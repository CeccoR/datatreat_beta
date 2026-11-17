/* A small SVG kit for the study's figures: panels with axes, ticks, points, lines, text.
   Colours: the reference palette's first three categorical slots, ink and grid tokens. */
export const C = { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', muted: '#a3a29c' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export function svgDoc(W, H, body, title, sub){
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="11">`,
    `<rect width="${W}" height="${H}" fill="${C.surface}"/>`,
    title ? `<text x="12" y="20" font-size="13" font-weight="600" fill="${C.ink}">${esc(title)}</text>` : '',
    sub ? `<text x="12" y="37" fill="${C.ink2}">${esc(sub)}</text>` : '', ...body, '</svg>'].join('\n');
}
/* panel({ x, y, w, h, xr: [lo, hi], yr, xlog, ylog, xticks, yticks, xlabel, ylabel, title }) → { X, Y, out[] } */
export function panel(o){
  const out = [], L = v => Math.log10(v);
  const sx = o.xlog ? v => (L(v) - L(o.xr[0]))/(L(o.xr[1]) - L(o.xr[0])) : v => (v - o.xr[0])/(o.xr[1] - o.xr[0]);
  const sy = o.ylog ? v => (L(v) - L(o.yr[0]))/(L(o.yr[1]) - L(o.yr[0])) : v => (v - o.yr[0])/(o.yr[1] - o.yr[0]);
  const X = v => o.x + o.w*Math.max(0, Math.min(1, sx(v))), Y = v => o.y + o.h*(1 - Math.max(0, Math.min(1, sy(v))));
  if (o.title) out.push(`<text x="${o.x}" y="${o.y - 8}" font-weight="600" fill="${C.ink}">${esc(o.title)}</text>`);
  for (const t of o.xticks || []){ out.push(`<line x1="${X(t)}" x2="${X(t)}" y1="${o.y}" y2="${o.y + o.h}" stroke="${C.grid}"/>`, `<text x="${X(t)}" y="${o.y + o.h + 14}" text-anchor="middle" fill="${C.ink2}">${t}</text>`); }
  for (const t of o.yticks || []){ out.push(`<line x1="${o.x}" x2="${o.x + o.w}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.grid}"/>`, `<text x="${o.x - 5}" y="${Y(t) + 4}" text-anchor="end" fill="${C.ink2}">${t}</text>`); }
  out.push(`<line x1="${o.x}" x2="${o.x + o.w}" y1="${o.y + o.h}" y2="${o.y + o.h}" stroke="${C.ink2}"/>`, `<line x1="${o.x}" x2="${o.x}" y1="${o.y}" y2="${o.y + o.h}" stroke="${C.ink2}"/>`);
  if (o.xlabel) out.push(`<text x="${o.x + o.w/2}" y="${o.y + o.h + 30}" text-anchor="middle" fill="${C.ink2}">${esc(o.xlabel)}</text>`);
  if (o.ylabel) out.push(`<text transform="translate(${o.x - 38},${o.y + o.h/2}) rotate(-90)" text-anchor="middle" fill="${C.ink2}">${esc(o.ylabel)}</text>`);
  return { X, Y, out };
}
export const dot = (x, y, col, tip, { r = 4, hollow = false } = {}) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${hollow ? C.surface : col}" stroke="${hollow ? col : C.surface}" stroke-width="${hollow ? 1.6 : 1}"><title>${esc(tip || '')}</title></circle>`;
export const line = (pts, col, { w = 2, dash = '' } = {}) => `<polyline points="${pts.map(([x, y])=> x.toFixed(1) + ',' + y.toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
export const text = (x, y, s, { col = C.ink2, anchor = 'start', weight = 400, size = 11 } = {}) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-weight="${weight}" font-size="${size}" fill="${col}">${esc(s)}</text>`;
export function legend(x, y, items){ return items.map(([col, label, hollow], i)=> dot(x, y + 16*i, col, label, { hollow }) + text(x + 10, y + 16*i + 4, label, { col: C.ink })).join('\n'); }
