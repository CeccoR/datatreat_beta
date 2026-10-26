/* A few SVG helpers for the figures: a plot frame with linear or log axes, recessive grid,
   ticks and labels; marks drawn by the caller in data coordinates. Light surface; the
   series colours are the reference palette's first slots (blue, orange, aqua), muted gray
   for context. */
export const C = { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#8a8984', grid: '#e4e3df', s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', gray: '#a8a7a2' };
export const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function frame({ x0, y0, w, h, xr, yr, xlog = false, ylog = false, xlabel = '', ylabel = '', xticks, yticks, xfmt = String, yfmt = String }){
  const tx = v => { const a = xlog ? Math.log10(v) : v, lo = xlog ? Math.log10(xr[0]) : xr[0], hi = xlog ? Math.log10(xr[1]) : xr[1]; return x0 + (a - lo)/(hi - lo)*w; };
  const ty = v => { const a = ylog ? Math.log10(v) : v, lo = ylog ? Math.log10(yr[0]) : yr[0], hi = ylog ? Math.log10(yr[1]) : yr[1]; return y0 + h - (a - lo)/(hi - lo)*h; };
  const out = [];
  for (const t of yticks || []){ const y = ty(t); out.push(`<line x1="${x0}" x2="${x0 + w}" y1="${y}" y2="${y}" stroke="${C.grid}" stroke-width="1"/>`, `<text x="${x0 - 6}" y="${y + 4}" font-size="11" text-anchor="end" fill="${C.ink2}">${esc(yfmt(t))}</text>`); }
  for (const t of xticks || []){ const x = tx(t); out.push(`<line x1="${x}" x2="${x}" y1="${y0}" y2="${y0 + h}" stroke="${C.grid}" stroke-width="1"/>`, `<text x="${x}" y="${y0 + h + 16}" font-size="11" text-anchor="middle" fill="${C.ink2}">${esc(xfmt(t))}</text>`); }
  out.push(`<line x1="${x0}" x2="${x0 + w}" y1="${y0 + h}" y2="${y0 + h}" stroke="${C.muted}" stroke-width="1"/>`);
  if (xlabel) out.push(`<text x="${x0 + w/2}" y="${y0 + h + 34}" font-size="12" text-anchor="middle" fill="${C.ink}">${esc(xlabel)}</text>`);
  if (ylabel) out.push(`<text transform="translate(${x0 - 44},${y0 + h/2}) rotate(-90)" font-size="12" text-anchor="middle" fill="${C.ink}">${esc(ylabel)}</text>`);
  return { tx, ty, svg: out.join('\n') };
}
export const doc = (W, H, body, title = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, Helvetica, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="${C.surface}"/>
${title ? `<text x="16" y="24" font-size="14" font-weight="600" fill="${C.ink}">${esc(title)}</text>` : ''}
${body}
</svg>
`;
