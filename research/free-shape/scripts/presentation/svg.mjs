/* The presentation study's SVG kit: panels, dots, intervals, text (the reference palette's
   first three categorical slots, ink and grid tokens), and a small orthographic renderer of
   a solid (box, cylinder, ellipsoid) with an envelope, a cone and arrows, for the mock 3D view. */
export const C = { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', muted: '#a3a29c', card: '#ffffff', line: '#d6d5d0' };
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function svgDoc(W, H, body, title, sub){
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="11">`,
    `<rect width="${W}" height="${H}" fill="${C.surface}"/>`,
    title ? `<text x="14" y="22" font-size="14" font-weight="600" fill="${C.ink}">${esc(title)}</text>` : '',
    sub ? `<text x="14" y="40" fill="${C.ink2}">${esc(sub)}</text>` : '', ...body, '</svg>'].join('\n');
}
export function panel(o){
  const out = [], L = v => Math.log10(v);
  const sx = o.xlog ? v => (L(v) - L(o.xr[0]))/(L(o.xr[1]) - L(o.xr[0])) : v => (v - o.xr[0])/(o.xr[1] - o.xr[0]);
  const sy = o.ylog ? v => (L(v) - L(o.yr[0]))/(L(o.yr[1]) - L(o.yr[0])) : v => (v - o.yr[0])/(o.yr[1] - o.yr[0]);
  const X = v => o.x + o.w*Math.max(0, Math.min(1, sx(v))), Y = v => o.y + o.h*(1 - Math.max(0, Math.min(1, sy(v))));
  if (o.title) out.push(`<text x="${o.x}" y="${o.y - 10}" font-weight="600" fill="${C.ink}">${esc(o.title)}</text>`);
  for (const t of o.xticks || []){ out.push(`<line x1="${X(t)}" x2="${X(t)}" y1="${o.y}" y2="${o.y + o.h}" stroke="${C.grid}"/>`, `<text x="${X(t)}" y="${o.y + o.h + 14}" text-anchor="middle" fill="${C.ink2}">${t}</text>`); }
  for (const t of o.yticks || []){ out.push(`<line x1="${o.x}" x2="${o.x + o.w}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.grid}"/>`, `<text x="${o.x - 5}" y="${Y(t) + 4}" text-anchor="end" fill="${C.ink2}">${t}</text>`); }
  out.push(`<line x1="${o.x}" x2="${o.x + o.w}" y1="${o.y + o.h}" y2="${o.y + o.h}" stroke="${C.ink2}"/>`, `<line x1="${o.x}" x2="${o.x}" y1="${o.y}" y2="${o.y + o.h}" stroke="${C.ink2}"/>`);
  if (o.xlabel) out.push(`<text x="${o.x + o.w/2}" y="${o.y + o.h + 30}" text-anchor="middle" fill="${C.ink2}">${esc(o.xlabel)}</text>`);
  if (o.ylabel) out.push(`<text transform="translate(${o.x - 40},${o.y + o.h/2}) rotate(-90)" text-anchor="middle" fill="${C.ink2}">${esc(o.ylabel)}</text>`);
  return { X, Y, out };
}
export const dot = (x, y, col, tip, { r = 4.5, hollow = false } = {}) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${hollow ? C.surface : col}" stroke="${hollow ? col : C.surface}" stroke-width="${hollow ? 1.8 : 1.5}"><title>${esc(tip || '')}</title></circle>`;
export const line = (pts, col, { w = 2, dash = '', op = 1 } = {}) => `<polyline points="${pts.map(([x, y])=> x.toFixed(1) + ',' + y.toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}${op < 1 ? ` stroke-opacity="${op}"` : ''}/>`;
export const text = (x, y, s, { col = C.ink2, anchor = 'start', weight = 400, size = 11, italic = false } = {}) => `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" text-anchor="${anchor}" font-weight="${weight}" font-size="${size}"${italic ? ' font-style="italic"' : ''} fill="${col}">${esc(s)}</text>`;
export function legend(x, y, items){ return items.map(([col, label, hollow], i)=> dot(x, y + 16*i, col, label, { hollow }) + text(x + 10, y + 16*i + 4, label, { col: C.ink })).join('\n'); }

/* ---------- a small orthographic renderer ---------- */
const dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sc = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const unit = v => { const n = Math.hypot(...v); return v.map(t=> t/n); };
/* view(az°, el°) → { P(p) → [sx, sy] (screen, y down), depth(p), dir (towards the viewer) } */
export function view(az = 38, el = 24){
  const a = az*Math.PI/180, e = el*Math.PI/180;
  const dir = [Math.cos(e)*Math.cos(a), Math.cos(e)*Math.sin(a), Math.sin(e)];
  const right = unit(cross([0, 0, 1], dir)), up = cross(dir, right);
  return { dir, P: p => [dot3(p, right), -dot3(p, up)], depth: p => dot3(p, dir) };
}
/* mesh of a solid: faces [{ pts (3D), n (outward normal) }]; dims full lengths along the
   body axes ax[0..2] (unit 3D vectors in the drawing's frame). */
export function mesh(type, dims, ax, nSeg = 48){
  const F = [];
  const P = (u, v, w) => add(add(sc(ax[0], u), sc(ax[1], v)), sc(ax[2], w));
  const [a, b, c] = dims.map(d=> d/2);
  if (type === 'box' || type === 'sqbox'){
    const h = [a, b, c];
    for (let k = 0; k < 3; k++) for (const sg of [1, -1]){
      const [i, j] = [0, 1, 2].filter(t=> t !== k), cen = sc(ax[k], sg*h[k]);
      const corner = (si, sj) => add(cen, add(sc(ax[i], si*h[i]), sc(ax[j], sj*h[j])));
      F.push({ pts: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], n: sc(ax[k], sg) });
    }
  } else if (type === 'cylinder' || type === 'ellcyl'){
    const ring = z => Array.from({ length: nSeg }, (_, i)=> { const t = 2*Math.PI*i/nSeg; return P(a*Math.cos(t), b*Math.sin(t), z); });
    const top = ring(c), bot = ring(-c);
    F.push({ pts: top, n: ax[2] }, { pts: bot.slice().reverse(), n: sc(ax[2], -1) });
    for (let i = 0; i < nSeg; i++){ const j = (i + 1) % nSeg, t = 2*Math.PI*(i + 0.5)/nSeg;
      F.push({ pts: [bot[i], bot[j], top[j], top[i]], n: unit(add(sc(ax[0], Math.cos(t)/a), sc(ax[1], Math.sin(t)/b))) }); }
  } else {
    // ellipsoid/spheroid: a UV mesh
    const nu = 32, nv = 20;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++){
      const t0 = 2*Math.PI*i/nu, t1 = 2*Math.PI*(i + 1)/nu, p0 = Math.PI*j/nv - Math.PI/2, p1 = Math.PI*(j + 1)/nv - Math.PI/2;
      const q = (t, p) => P(a*Math.cos(p)*Math.cos(t), b*Math.cos(p)*Math.sin(t), c*Math.sin(p));
      const tm = (t0 + t1)/2, pm = (p0 + p1)/2;
      F.push({ pts: [q(t0, p0), q(t1, p0), q(t1, p1), q(t0, p1)], n: unit(add(add(sc(ax[0], Math.cos(pm)*Math.cos(tm)/a), sc(ax[1], Math.cos(pm)*Math.sin(tm)/b)), sc(ax[2], Math.sin(pm)/c))) });
    }
  }
  return F;
}
/* draw(faces, V, { ox, oy, s, fill, op, stroke, dash, onlyOutline }) → svg strings (visible faces, Lambert-shaded) */
export function draw(F, V, { ox, oy, s, fill = C.s1, op = 0.7, stroke = C.ink2, dash = '', light = [0.4, 0.3, 0.87], shade = true, edges = true } = {}){
  const L = unit(light), out = [];
  const vis = F.filter(f=> dot3(f.n, V.dir) > 1e-6).map(f=> ({ ...f, d: f.pts.reduce((t, p)=> t + V.depth(p), 0)/f.pts.length })).sort((x, y)=> x.d - y.d);
  for (const f of vis){
    const k = shade ? 0.55 + 0.45*Math.max(0, dot3(f.n, L)) : 1;
    const pts = f.pts.map(p=> { const [x, y] = V.P(p); return `${(ox + s*x).toFixed(1)},${(oy + s*y).toFixed(1)}`; }).join(' ');
    out.push(`<polygon points="${pts}" fill="${fill}" fill-opacity="${(op*k).toFixed(3)}" stroke="${edges ? stroke : 'none'}" stroke-width="${edges ? 0.8 : 0}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>`);
  }
  return out;
}
/* the silhouette-ish outline of a solid: every visible face's edges, dashed (an envelope) */
export function outline(F, V, { ox, oy, s, col = C.s2, dash = '5 4', w = 1.2 } = {}){
  const out = [];
  for (const f of F){
    if (dot3(f.n, V.dir) <= 1e-6 && f.pts.length > 4) continue;
    if (f.pts.length > 4){ const pts = f.pts.map(p=> { const [x, y] = V.P(p); return `${(ox + s*x).toFixed(1)},${(oy + s*y).toFixed(1)}`; }).join(' ');
      out.push(`<polygon points="${pts}" fill="none" stroke="${col}" stroke-width="${w}" stroke-dasharray="${dash}"/>`); }
  }
  return out;
}
/* an arrow from the origin along a (3D unit), length len (drawing units), with a cone of half-angle deg */
export function arrow(a, len, V, { ox, oy, s, col = C.ink, dash = '', cone = 0, label = '', lcol = C.ink, w = 1.8 } = {}){
  const out = [], tip = sc(a, len), [tx, ty] = V.P(tip), X = ox + s*tx, Y = oy + s*ty;
  if (cone > 0){
    // the cone's rim: a circle of radius len·tan(cone) about the tip, normal to a
    const t = Math.tan(cone*Math.PI/180)*len, e1 = unit(cross(a, Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), e2 = cross(a, e1);
    const rim = Array.from({ length: 40 }, (_, i)=> { const q = 2*Math.PI*i/40; const p = add(tip, add(sc(e1, t*Math.cos(q)), sc(e2, t*Math.sin(q)))); const [x, y] = V.P(p); return [ox + s*x, oy + s*y]; });
    out.push(`<polygon points="${rim.map(([x, y])=> x.toFixed(1) + ',' + y.toFixed(1)).join(' ')}" fill="${col}" fill-opacity="0.12" stroke="${col}" stroke-opacity="0.6" stroke-width="0.8"/>`);
    // two generators
    const [l1, l2] = [rim[0], rim[20]];
    out.push(`<line x1="${ox}" y1="${oy}" x2="${l1[0].toFixed(1)}" y2="${l1[1].toFixed(1)}" stroke="${col}" stroke-opacity="0.5" stroke-width="0.8"/>`, `<line x1="${ox}" y1="${oy}" x2="${l2[0].toFixed(1)}" y2="${l2[1].toFixed(1)}" stroke="${col}" stroke-opacity="0.5" stroke-width="0.8"/>`);
  }
  out.push(`<line x1="${ox}" y1="${oy}" x2="${X.toFixed(1)}" y2="${Y.toFixed(1)}" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  const ang = Math.atan2(Y - oy, X - ox), h = 7;
  out.push(`<polygon points="${X.toFixed(1)},${Y.toFixed(1)} ${(X - h*Math.cos(ang - 0.4)).toFixed(1)},${(Y - h*Math.sin(ang - 0.4)).toFixed(1)} ${(X - h*Math.cos(ang + 0.4)).toFixed(1)},${(Y - h*Math.sin(ang + 0.4)).toFixed(1)}" fill="${col}"/>`);
  if (label) out.push(text(X + 6*Math.cos(ang), Y + 6*Math.sin(ang) + 4, label, { col: lcol, anchor: Math.cos(ang) < -0.2 ? 'end' : 'start', weight: 600 }));
  return out;
}
