/* Step 2's profiling engine: eng/ copied to prof/engp/ with timers (performance.now) around
   WPPM's parts, no arithmetic change: in wppmLine the common factor (instrument, strain), the
   size coefficients (o.size: every member's A(L)), the divergence's nodes and the fill, the FFT,
   the read-out; in wppmLineOf the members' setup and lineNodes; in phasePattern shapeTs and the
   whole; the Soller cells' misses and every lineNodes call; each Jacobian column (by parameter).
   Counters in globalThis.__P. node prof/make-prof.mjs [engine dir (eng)] [out dir (prof/engp)]:
   eng0 → prof/engp0 for step 1's engine. The anchors of both engines are tried (optional ones
   skipped). */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), SRC = path.resolve(process.argv[2] || path.join(HERE, '..', 'eng')), DST = path.resolve(process.argv[3] || path.join(HERE, 'engp'));
fs.mkdirSync(DST, { recursive: true });
for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
const edit = (file, pairs) => { const p = path.join(DST, file); let s = fs.readFileSync(p, 'utf8');
  for (const [a, b, opt] of pairs){ const i = s.indexOf(a); if (i < 0 && opt) continue; if (i < 0 || s.indexOf(a, i + 1) >= 0) throw new Error(file + ': anchor ' + a.slice(0, 50)); s = s.replace(a, b); }
  fs.writeFileSync(p, s); };
const HDR = `const __P = globalThis.__P || (globalThis.__P = { t: {}, n: {}, N: {}, nL: 0, lines: 0, members: 0, nodes: 0, read: 0, evals: 0 });
const __now = ()=> performance.now();
const __add = (k, t0)=> { const t = __now(); __P.t[k] = (__P.t[k] || 0) + t - t0; return t; };
`;
edit('xrd-broad.js', [
  ["import { gaussLegendre, lowerBound, inv3n } from './xrd-math.js';", "import { gaussLegendre, lowerBound, inv3n } from './xrd-math.js';\n" + HDR],
  ["  const { x, out, tt, lam, I } = o;\n", "  const { x, out, tt, lam, I } = o;\n  let __t = __now(); __P.lines++;\n"],
  ["  const size = new Float64Array(nL + 1);\n", "  __t = __add('com', __t); __P.N[N] = (__P.N[N] || 0) + 1; __P.nL += nL;\n  const size = new Float64Array(nL + 1);\n"],
  ["  if (o.size) o.size(size, nL + 1, dL); else size.fill(1);\n", "  if (o.size) o.size(size, nL + 1, dL); else size.fill(1);\n  __t = __add('size', __t); __P.nodes += nodes ? nodes.length : 0;\n"],
  ["  fftPlus(p);\n  // re[m]: the profile", "  __t = __add('fill', __t);\n  fftPlus(p);\n  __t = __add('fft', __t);\n  // re[m]: the profile"],
  ["  // o.fwhm, when given, collects", "  __P.read += i - __i0; __t = __add('read', __t);\n  // o.fwhm, when given, collects"],
  ["    Object.assign(o.fwhm, { s0, lam, c1 });\n  }\n", "    Object.assign(o.fwhm, { s0, lam, c1 });\n  }\n  __add('fwhm', __t);\n"],
  ["  let i = lowerBound(x, xLo);\n", "  let i = lowerBound(x, xLo); const __i0 = i;\n"],
  ["function addMemberCoef(out, n, dL, base, a, b, c, scale, sigma, weight){\n", "function addMemberCoef(out, n, dL, base, a, b, c, scale, sigma, weight){\n  __P.members++;\n"],
]);
edit('xrd-rietveld.js', [
  ["const FS = { evals: 0, log: null, k: -1, t0: 0 };", "const FS = { evals: 0, log: null, k: -1, t0: 0 };\n" + HDR],
  ["function wppmLineOf(model, k, r, j, th, tt, I, inst, ext, out, ticks, S, f2, d, ts, tw){\n", "function wppmLineOf(model, k, r, j, th, tt, I, inst, ext, out, ticks, S, f2, d, ts, tw){\n  const __t0 = __now(); try { return wppmLineOf_(model, k, r, j, th, tt, I, inst, ext, out, ticks, S, f2, d, ts, tw); } finally { __add('lineOf', __t0); }\n}\nfunction wppmLineOf_(model, k, r, j, th, tt, I, inst, ext, out, ticks, S, f2, d, ts, tw){\n", true],
  ["function wppmLineOf(model, k, r, j, th, tt, I, inst, ext, out, ticks, S, f2, d, ts, tw, pend){\n", "function wppmLineOf(model, k, r, j, th, tt, I, inst, ext, out, ticks, S, f2, d, ts, tw, pend){\n  const __t0 = __now(); try { return wppmLineOf_(model, k, r, j, th, tt, I, inst, ext, out, ticks, S, f2, d, ts, tw, pend); } finally { __add('lineOf', __t0); }\n}\nfunction wppmLineOf_(model, k, r, j, th, tt, I, inst, ext, out, ticks, S, f2, d, ts, tw, pend){\n", true],
  ["if (pend.length === 2) wppmPair(pend[0], pend[1]); else wppmLine(pend[0]);", "const __tp = __now(); if (pend.length === 2) wppmPair(pend[0], pend[1]); else wppmLine(pend[0]); __add('pair', __tp);", true],
  ["  const nodes = axialOn(A) ? lineNodes(model, (k*model.rStride + r)*4 + j, th, A, Hmin, sollerTol(model, S*I, Hmin, tq.eta)) : null;\n  const spread", "  const __tn = __now();\n  const nodes = axialOn(A) ? lineNodes(model, (k*model.rStride + r)*4 + j, th, A, Hmin, sollerTol(model, S*I, Hmin, tq.eta)) : null;\n  __add('lineNodes', __tn);\n  const spread", true],
  ["  const nodes = axialOn(A) ? lineNodes(model, (k*model.rStride + r)*4 + j, th, A, Hmin, sollerTol(model, S*I, Hmin, tq.eta), WPPM_OPT.axial) : null;\n  const spread", "  const __tn = __now();\n  const nodes = axialOn(A) ? lineNodes(model, (k*model.rStride + r)*4 + j, th, A, Hmin, sollerTol(model, S*I, Hmin, tq.eta), WPPM_OPT.axial) : null;\n  __add('lineNodes', __tn);\n  const spread", true],
  ["function phasePattern_(model, v, k, out, ticks){\n", "function phasePattern_(model, v, k, out, ticks){\n  const __t0 = __now(); __P.evals++; try { return phasePattern__(model, v, k, out, ticks); } finally { __add('phase', __t0); }\n}\nfunction phasePattern__(model, v, k, out, ticks){\n"],
  ["    const vu = v.slice(), vd = v.slice(); vu[j] = up; vd[j] = dn;\n", "    const vu = v.slice(), vd = v.slice(); vu[j] = up; vd[j] = dn;\n    const __tc = __now(); try {\n"],
  ["      for (let i = 0; i < n; i++) col[i] += f*(pu[i] - pd[i]);\n    }\n", "      for (let i = 0; i < n; i++) col[i] += f*(pu[i] - pd[i]);\n    }\n    } finally { const nm = 'col:' + p.name.replace(/^p1\\./, ''); __add(nm, __tc); __P.n[nm] = (__P.n[nm] || 0) + 1; }\n"],
  ["  const G = sollerGrid(g);\n  const tt = 2*th, c2 = Math.cos(tt), s2 = Math.sin(tt);\n", "  const G = sollerGrid(g);\n  const tt = 2*th, c2 = Math.cos(tt), s2 = Math.sin(tt);\n  __P.n.scMiss = (__P.n.scMiss || 0) + 1; const __sc = __now();\n"],
  ["  if (SOLLER_LINES.size >= SOLLER_LINES_MAX)", "  __add('sollerMiss', __sc);\n  if (SOLLER_LINES.size >= SOLLER_LINES_MAX)"],
  ["function lineNodes(model, key, th, A, H, tol){\n", "function lineNodes(model, key, th, A, H, tol){\n  const __t0 = __now(); __P.n.ln = (__P.n.ln || 0) + 1; try { return lineNodes_(model, key, th, A, H, tol); } finally { __add('lineNodesAll', __t0); }\n}\nfunction lineNodes_(model, key, th, A, H, tol){\n", true],
  ["function lineNodes(model, key, th, A, H, tol, interp){\n", "function lineNodes(model, key, th, A, H, tol, interp){\n  const __t0 = __now(); __P.n.ln = (__P.n.ln || 0) + 1; try { return lineNodes_(model, key, th, A, H, tol, interp); } finally { __add('lineNodesAll', __t0); }\n}\nfunction lineNodes_(model, key, th, A, H, tol, interp){\n", true],
  ["  const shp = act && !wppm ? shapeWidths(model, q, v) : null, ts = act && wppm ? shapeTs(model, q, v) : null;\n", "  const __ts = __now();\n  const shp = act && !wppm ? shapeWidths(model, q, v) : null, ts = act && wppm ? shapeTs(model, q, v) : null;\n  __add(wppm ? 'shapeTs' : 'shapeWidths', __ts);\n"],
]);
console.log('prof/engp from eng/');
