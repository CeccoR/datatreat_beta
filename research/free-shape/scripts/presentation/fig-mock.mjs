#!/usr/bin/env node
/* node fig-mock.mjs [--cases id-seed,id-seed,id-seed] [--out figs/mock]
   Mock of the proposed Results entry and 3D view for a few runs: the card's lines (from
   oneresult.mjs) beside the solid drawn (the simplest of the 95 % set) at its estimates,
   the lateral (or section) range as dashed envelopes at its limits, the principal axis
   with its 95 % cone, and either the in-plane axes (resolved) or a dashed ring "free about
   the normal". SVG, and PNG through ../harness/svg2png.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadRun, HERE } from './plib.mjs';
import { oneResult } from './oneresult.mjs';
import { C, svgDoc, text, esc, view, mesh, draw, outline, arrow } from './svg.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const picks = (opt.cases || 'box-plate110-1,sph-prolate111-1,u09-1,iso-7-1').split(',').map(s=> { const m = s.match(/^(.*)-(\d+)$/); return [m[1], +m[2]]; });
const out = path.join(HERE, opt.out || 'figs/mock');
fs.mkdirSync(path.dirname(out), { recursive: true });
const wrap = (s, n) => { const w = s.split(' '), L = []; let cur = ''; for (const x of w){ if ((cur + ' ' + x).trim().length > n){ L.push(cur.trim()); cur = x; } else cur += ' ' + x; } if (cur.trim()) L.push(cur.trim()); return L; };
const PW = 860, body = [];
const SY = fs.existsSync(path.join(HERE, 'results', 'sys-sample.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'sys-sample.json'), 'utf8')) : null;
let yCur = 56;
picks.forEach(([id, seed], k)=> {
  const R = loadRun(id, seed), sys = SY && SY.rows.find(r=> r.id === id && r.seed === seed) || null, o = oneResult(R, { sys, misfit: 'flag' });
  const nL = o.lines.reduce((t, ln)=> t + wrap(ln, 74).length, 0), PH = Math.max(250, 104 + 16*nL + 3*o.lines.length), y0 = yCur; yCur += PH + 14;
  body.push(`<rect x="12" y="${y0}" width="${PW - 24}" height="${PH}" rx="8" fill="${C.card}" stroke="${C.line}"/>`);
  const truth = R.truth ? `${R.truth.type} ${R.truth.dims.join(' × ')} nm` : R.c.D ? `sphere ${R.c.D} nm` : '';
  body.push(text(28, y0 + 24, `${id} (seed ${seed})`, { col: C.ink, weight: 600, size: 12 }), text(28, y0 + 40, `truth: ${truth}`, { col: C.ink2, italic: true }));
  // the resolution chip: text and a glyph, never colour alone
  const lab = o.status === 'isotropic' ? 'one size' : o.label;
  const lv = o.status === 'isotropic' ? 0 : o.level, glyph = '●'.repeat(lv) + '○'.repeat(3 - lv);
  body.push(`<rect x="28" y="${y0 + 50}" width="${16 + 7*(lab.length + 4)}" height="20" rx="10" fill="${C.surface}" stroke="${C.ink2}"/>`, text(38, y0 + 64, `${glyph} ${lab}`, { col: C.ink, weight: 600 }));
  let yy = y0 + 92;
  for (const ln of o.lines){ for (const w of wrap(ln, 74)){ body.push(text(28, yy, w, { col: C.ink })); yy += 15; } yy += 3; }
  // the 3D view
  const ox = 680, oy = y0 + PH/2 + 4;
  if (o.status !== 'shape'){
    const r = 34;
    body.push(`<circle cx="${ox}" cy="${oy}" r="${r}" fill="${C.s1}" fill-opacity="0.5" stroke="${C.ink2}"/>`, text(ox, oy + r + 18, 'one size: no axes', { anchor: 'middle' }));
    return;
  }
  const V = view(38, 28);
  const q = o.q, needle = o.habit === 'needle';
  // drawing frame: principal axis up (z), the other two on x, y
  const P = needle ? q.long : q.thin, S = needle ? [q.thin, q.mid] : [q.mid, q.long];
  const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const type = o.solid.type, open = x => !Number.isFinite(x);
  const est = [S[0].est, S[1].est, P.est].map((x, i)=> open(x) ? 3*Math.max(...[S[0].est, S[1].est, P.est].filter(Number.isFinite)) : x);
  // body dims of the drawn solid from column lengths (the class factor: a ball 0.75, a round section 0.849)
  const fac = i => ['ellipsoid', 'spheroid'].includes(type) ? 0.75 : ['cylinder', 'ellcyl'].includes(type) && i < 2 ? 8/(3*Math.PI) : 1;
  const dims = est.map((x, i)=> x/fac(i));
  const big = Math.max(...dims), s = 130/big;
  const loL = Math.min(S[0].iv[0], S[1].iv[0]), hiL = Math.max(S[0].iv[1], S[1].iv[1]);
  const inner = [loL/fac(0), loL/fac(1), dims[2]], outer = [Math.min(hiL, 1.6*Math.max(est[0], est[1]))/fac(0), Math.min(hiL, 1.6*Math.max(est[0], est[1]))/fac(1), dims[2]];
  const resolvedIn = o.inplane.apart && o.inplane.directions;
  const typeIn = resolvedIn ? type : (type === 'box' || type === 'sqbox' ? 'sqbox' : 'cylinder');
  if (!resolvedIn){
    body.push(...outline(mesh(typeIn === 'sqbox' ? 'cylinder' : typeIn, outer, ax), V, { ox, oy, s, col: C.s2, dash: open(hiL) ? '2 4' : '6 4' }));
  }
  body.push(...draw(mesh(type, dims, ax), V, { ox, oy, s, fill: C.s1, op: 0.62 }));
  if (!resolvedIn) body.push(...outline(mesh('cylinder', inner, ax), V, { ox, oy, s, col: C.s2, dash: '6 4' }));
  // the principal axis and its cone
  const len = Math.max(dims[2]/2 + 0.35*big, 0.45*big);
  const pc = P.cone < 180 ? P.cone : 0;
  body.push(...arrow([0, 0, 1], len, V, { ox, oy, s, col: C.ink, cone: pc, label: `${P.name.label}${P.cone < 180 ? ` ±${P.cone.toFixed(P.cone < 10 ? 1 : 0)}°` : ' (not determined)'}` }));
  if (resolvedIn){
    S.forEach((q, i)=> { const e = i ? [0, 1, 0] : [1, 0, 0]; body.push(...arrow(e, dims[i]/2 + 0.25*big, V, { ox, oy, s, col: C.ink2, cone: q.cone < 180 ? q.cone : 0, label: q.name.label, lcol: C.ink2, w: 1.4 })); });
  } else {
    // a ring about the axis: the turn about it is free
    const rr = needle ? 1.5*Math.max(dims[0], dims[1]) : 0.62*big, pts = Array.from({ length: 60 }, (_, i)=> { const t = 2*Math.PI*i/60; const [x, y] = V.P([rr*Math.cos(t), rr*Math.sin(t), dims[2]/2 + 0.02*big]); return `${(ox + s*x).toFixed(1)},${(oy + s*y).toFixed(1)}`; });
    body.push(`<polygon points="${pts.join(' ')}" fill="none" stroke="${C.ink2}" stroke-width="1" stroke-dasharray="3 3"/>`);
    const [lx, ly] = V.P([rr, 0, 0]);
    body.push(needle ? text(ox - 0.06*s*big - 12, oy + 0.18*s*big, 'section: free about the axis', { col: C.ink2, italic: true, anchor: 'end' }) : text(ox + s*lx + 6, oy + s*ly + 16, 'free about the normal', { col: C.ink2, italic: true }));
  }
  body.push(text(ox, y0 + PH - 14, resolvedIn ? 'solid at its estimates' : `solid at its estimates; dashed: ${needle ? 'section' : 'lateral'} ${Number.isFinite(hiL) ? 'range' : 'lower limit (open above)'}`, { anchor: 'middle', col: C.ink2 }));
});
const W = PW, H = yCur + 4;
const svg = svgDoc(W, H, body, 'One result with its resolution (mock of the Results entry and the 3D view)', 'From the runs by oneresult.mjs. Glyphs: resolution level. Blue: the solid at its values; orange dashed: the lateral range; cones 95 %.');
fs.writeFileSync(out + '.svg', svg);
execFileSync('/opt/node22/bin/node', [path.join(HERE, '..', 'harness', 'svg2png.mjs'), out + '.svg', out + '.png']);
console.log('wrote', out + '.svg', out + '.png');
