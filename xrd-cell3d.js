/* =========================================================
   XRPD — a phase's unit cell in 3D.
   The atoms of the cell (those on its faces, edges and corners in every place they
   reach: a corner atom at all eight corners), as shaded spheres in their elements'
   colours, inside the cell's edges; a, b and c as a triad in the top right corner,
   turned with the cell: the crystallites' shape's (drawTriad), a red, b green, c blue.
   Software 3D on a 2D canvas, as the crystallites' shape (xrd-shape3d.js): a
   drag (mouse, pen or touch) or the arrow keys turn it about the cell's centre, a
   double click or tap (or Home) puts it back. Nothing runs while it is idle.
========================================================= */
import { matMul, axisAngle, reortho, viewAt, readTheme, drawTriad } from './xrd-shape3d.js';

const DEG = Math.PI / 180;
const HOME_AZ = -62 * DEG, HOME_EL = 18 * DEG;

// Jmol's element colours.
const COLORS = { H:'#FFFFFF', He:'#D9FFFF', Li:'#CC80FF', Be:'#C2FF00', B:'#FFB5B5', C:'#909090', N:'#3050F8', O:'#FF0D0D', F:'#90E050', Ne:'#B3E3F5',
  Na:'#AB5CF2', Mg:'#8AFF00', Al:'#BFA6A6', Si:'#F0C8A0', P:'#FF8000', S:'#FFFF30', Cl:'#1FF01F', Ar:'#80D1E3', K:'#8F40D4', Ca:'#3DFF00',
  Sc:'#E6E6E6', Ti:'#BFC2C7', V:'#A6A6AB', Cr:'#8A99C7', Mn:'#9C7AC7', Fe:'#E06633', Co:'#F090A0', Ni:'#50D050', Cu:'#C88033', Zn:'#7D80B0',
  Ga:'#C28F8F', Ge:'#668F8F', As:'#BD80E3', Se:'#FFA100', Br:'#A62929', Kr:'#5CB8D1', Rb:'#702EB0', Sr:'#00FF00', Y:'#94FFFF', Zr:'#94E0E0',
  Nb:'#73C2C9', Mo:'#54B5B5', Tc:'#3B9E9E', Ru:'#248F8F', Rh:'#0A7D8C', Pd:'#006985', Ag:'#C0C0C0', Cd:'#FFD98F', In:'#A67573', Sn:'#668080',
  Sb:'#9E63B5', Te:'#D47A00', I:'#940094', Xe:'#429EB0', Cs:'#57178F', Ba:'#00C900', La:'#70D4FF', Ce:'#FFFFC7', Pr:'#D9FFC7', Nd:'#C7FFC7',
  Pm:'#A3FFC7', Sm:'#8FFFC7', Eu:'#61FFC7', Gd:'#45FFC7', Tb:'#30FFC7', Dy:'#1FFFC7', Ho:'#00FF9C', Er:'#00E675', Tm:'#00D452', Yb:'#00BF38',
  Lu:'#00AB24', Hf:'#4DC2FF', Ta:'#4DA6FF', W:'#2194D6', Re:'#267DAB', Os:'#266696', Ir:'#175487', Pt:'#D0D0E0', Au:'#FFD123', Hg:'#B8B8D0',
  Tl:'#A6544D', Pb:'#575961', Bi:'#9E4FB5', Th:'#00BAFF', U:'#008FFF' };
// Covalent radii (Å), for the spheres' sizes.
const RADII = { H:.31, Li:1.28, Be:.96, B:.84, C:.76, N:.71, O:.66, F:.57, Na:1.66, Mg:1.41, Al:1.21, Si:1.11, P:1.07, S:1.05, Cl:1.02,
  K:2.03, Ca:1.76, Sc:1.70, Ti:1.60, V:1.53, Cr:1.39, Mn:1.39, Fe:1.32, Co:1.26, Ni:1.24, Cu:1.32, Zn:1.22, Ga:1.22, Ge:1.20, As:1.19,
  Se:1.20, Br:1.20, Rb:2.20, Sr:1.95, Y:1.90, Zr:1.75, Nb:1.64, Mo:1.54, Ru:1.46, Rh:1.42, Pd:1.39, Ag:1.45, Cd:1.44, In:1.42, Sn:1.39,
  Sb:1.39, Te:1.38, I:1.39, Cs:2.44, Ba:2.15, La:2.07, Ce:2.04, Pr:2.03, Nd:2.01, Sm:1.98, Eu:1.98, Gd:1.96, Tb:1.94, Dy:1.92, Ho:1.92,
  Er:1.89, Tm:1.90, Yb:1.87, Lu:1.87, Hf:1.75, Ta:1.70, W:1.62, Re:1.51, Os:1.44, Ir:1.41, Pt:1.36, Au:1.36, Hg:1.32, Tl:1.45, Pb:1.46,
  Bi:1.48, Th:2.06, U:1.96 };
// The spheres at this share of the covalent radius: big enough to tell the atoms
// apart, small enough to see through the cell.
const BALL = 0.42;
export const elementColor = el => COLORS[el] || '#ff66cc';

// The cell's axes in Cartesian coordinates (a along x, b in the xy plane): rows a, b, c.
function axesOf(c){
  const r = DEG, ca = Math.cos(c.alpha*r), cb = Math.cos(c.beta*r), cg = Math.cos(c.gamma*r), sg = Math.sin(c.gamma*r);
  const cx = c.c*cb, cy = c.c*(ca - cb*cg)/sg, cz = Math.sqrt(Math.max(0, c.c*c.c - cx*cx - cy*cy));
  return [[c.a, 0, 0], [c.b*cg, c.b*sg, 0], [cx, cy, cz]];
}
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const css = (c, k = 1) => `rgb(${Math.round(Math.min(255, c[0]*k))},${Math.round(Math.min(255, c[1]*k))},${Math.round(Math.min(255, c[2]*k))})`;

/* The model of a phase: { cell, atoms: [{ element, x, y, z, occ }] } (fractions of the
   cell) → the spheres (every image of an atom within the cell's closed box), the eight
   corners, and the radius that holds it all, about the cell's centre. */
function buildModel(ph){
  const A = axesOf(ph.cell), at = (f) => [0, 1, 2].map(j => f[0]*A[0][j] + f[1]*A[1][j] + f[2]*A[2][j]);
  const ctr = at([0.5, 0.5, 0.5]);
  const rel = p => [p[0] - ctr[0], p[1] - ctr[1], p[2] - ctr[2]];
  const E = 1e-3, balls = [];
  for (const a of ph.atoms){
    const f = [a.x, a.y, a.z].map(v => { const w = v - Math.floor(v); return w > 1 - E ? 0 : w; });
    const rng = v => v < E ? [0, 1] : [0];
    for (const i of rng(f[0])) for (const j of rng(f[1])) for (const k of rng(f[2])){
      const el = a.element || 'X';
      balls.push({ el, p: rel(at([f[0] + i, f[1] + j, f[2] + k])), r: BALL*(RADII[el] || 1.5), occ: a.occ == null ? 1 : Math.min(1, a.occ), col: rgb(elementColor(el)) });
    }
  }
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push(rel(at([i & 1, (i >> 1) & 1, (i >> 2) & 1])));
  let Rb = 0;
  for (const c of corners) Rb = Math.max(Rb, Math.hypot(...c));
  for (const b of balls) Rb = Math.max(Rb, Math.hypot(...b.p) + b.r);
  // a, b, c as unit vectors, for the triad
  const axes = A.map(v => { const n = Math.hypot(...v) || 1; return v.map(x => x/n); });
  return { balls, corners, Rb, axes };
}
// The cell's twelve edges, as corner pairs.
const EDGES = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [4, 5], [4, 6], [3, 7], [5, 7], [6, 7]];

export function cellView(container, opts = {}){
  const canvas = document.createElement('canvas');
  canvas.className = 'cell3d-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-roledescription', '3D view');
  canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let model = null, name = '', R = viewAt(HOME_AZ, HOME_EL), S = 0, ratio = 1, raf = 0, dead = false, theme = null;
  // (the shape's: the triad's labels have its halo, the colour the canvas sits on)
  const themeOf = () => theme || (theme = readTheme(container));

  function paint(g, Sz){
    const T = themeOf(), m = model;
    const pad = 14 + 0.04*Sz, k = (Sz/2 - pad)/m.Rb, cx = Sz/2, cy = Sz/2;
    const [r00, r01, r02, r10, r11, r12, r20, r21, r22] = R;
    const P = p => [cx + k*(r00*p[0] + r01*p[1] + r02*p[2]), cy - k*(r10*p[0] + r11*p[1] + r12*p[2]), r20*p[0] + r21*p[1] + r22*p[2]];
    const C = m.corners.map(P);
    // The edges behind the cell's centre first, the atoms back to front, the edges in
    // front over them.
    const edge = e => {
      const [p, q] = [C[e[0]], C[e[1]]];
      g.strokeStyle = T.muted; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    };
    const depth = e => (C[e[0]][2] + C[e[1]][2])/2;
    g.lineCap = 'round';
    EDGES.forEach(e => { if (depth(e) < 0) edge(e); });
    const balls = m.balls.map(b => ({ b, q: P(b.p) })).sort((u, v) => u.q[2] - v.q[2]);
    for (const { b, q } of balls){
      const rr = Math.max(1.5, b.r*k);
      const grd = g.createRadialGradient(q[0] - rr*0.35, q[1] - rr*0.35, rr*0.1, q[0], q[1], rr);
      grd.addColorStop(0, css(b.col, 1.25)); grd.addColorStop(0.55, css(b.col)); grd.addColorStop(1, css(b.col, 0.45));
      g.globalAlpha = 0.45 + 0.55*b.occ;
      g.fillStyle = grd;
      g.beginPath(); g.arc(q[0], q[1], rr, 0, 2*Math.PI); g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.6; g.stroke();
    }
    EDGES.forEach(e => { if (depth(e) >= 0) edge(e); });
    // a, b, c: where and as large as the crystallites' shape has them
    drawTriad(g, R, m.axes, { x: Sz - 30, y: 30, L: 18 }, T, Sz >= 280 ? 12 : 11);
  }

  // The square's side: the container's width, or the side its card gives (opts.side).
  function measure(){
    const cs = getComputedStyle(container);
    const w = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const s = opts.side ? opts.side() : w;
    return s > 0 ? Math.round(s) : 0;
  }
  function draw(){
    if (dead || !model) return;
    const s = measure() || S;
    if (!s) return;
    const r = window.devicePixelRatio || 1;
    if (s !== S || r !== ratio){
      S = s; ratio = r;
      canvas.style.width = canvas.style.height = S + 'px';
      canvas.width = canvas.height = Math.round(S*ratio);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(ctx, S);
    ctx.restore();
  }
  const request = () => { if (!raf && !dead) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };

  /* ---------- interaction, as the crystallites' shape's ---------- */
  let drag = null, lastTap = null;
  const rotate = (dx, dy) => {
    const n = Math.hypot(dx, dy);
    if (!n) return;
    R = reortho(matMul(axisAngle([dy/n, dx/n, 0], n*1.2*Math.PI/(S || 260)), R));
    request();
  };
  const reset = () => { R = viewAt(HOME_AZ, HOME_EL); request(); };
  canvas.addEventListener('pointerdown', e => {
    if (!model || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch(_){}
    canvas.classList.add('is-grabbing');
    e.preventDefault();
    canvas.focus({ preventScroll: true, focusVisible: false });
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4) drag.moved = true;
    rotate(dx, dy);
  });
  const up = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    canvas.classList.remove('is-grabbing');
    try { canvas.releasePointerCapture(e.pointerId); } catch(_){}
    // A double tap resets (touch and pen; a mouse has dblclick). Taps only, not drags.
    if (e.type !== 'pointerup' || d.moved || e.pointerType === 'mouse') return;
    const now = performance.now();
    if (lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24){ lastTap = null; reset(); }
    else lastTap = { t: now, x: e.clientX, y: e.clientY };
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('dblclick', e => { if (model){ e.preventDefault(); reset(); } });
  canvas.addEventListener('keydown', e => {
    if (!model || e.altKey || e.ctrlKey || e.metaKey) return;
    const st = e.shiftKey ? 2 : 10, px = st*DEG*(S || 260)/(1.2*Math.PI);
    const mv = { ArrowLeft: [-px, 0], ArrowRight: [px, 0], ArrowUp: [0, -px], ArrowDown: [0, px] }[e.key];
    if (!mv && e.key !== 'Home') return;
    // The key is the view's: no page scroll, and no step through the samples.
    e.preventDefault(); e.stopPropagation();
    if (!mv){ reset(); return; }
    rotate(mv[0], mv[1]);
  });
  // The canvas follows its container's width (the height is the same: a square).
  let seenW = -1;
  const ro = new ResizeObserver(entries => {
    const w = Math.round(entries[entries.length - 1].contentRect.width);
    if (w === seenW) return;
    seenW = w;
    if (model) request();
  });
  ro.observe(container);
  const onTheme = () => { theme = null; request(); };
  const mo = new MutationObserver(onTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return {
    /* A phase (its cell and atoms), or null for none. Another phase starts from the home
       view. None: the canvas cleared and out of the layout, by its style (to v498 by its
       hidden attribute alone, which the class's display: block overrode: the cell drawn
       last stayed on show where there was no phase, another project's, a phase removed or
       undone). */
    set(ph){
      if (dead) return;
      if (!ph){
        model = null; name = '';
        canvas.hidden = true; canvas.style.display = 'none'; canvas.removeAttribute('aria-label');
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      if (ph.name !== name) R = viewAt(HOME_AZ, HOME_EL);
      name = ph.name;
      model = buildModel(ph);
      canvas.hidden = false; canvas.style.display = '';
      canvas.setAttribute('aria-label', `The unit cell of ${ph.name} in 3D: ${ph.atoms.length} atoms. Drag or use the arrow keys to rotate, Home to reset.`);
      theme = null;
      draw();
    },
    redraw: request,
    /* How the cell is turned, as plain numbers (JSON-safe), null at the home view; setView
       puts one back on the phase on show (what the Rietveld card shows, kept as its tab
       sleeps and in its record: xrd-rv.js shows). A rotation, or near enough to be put
       right; anything else (a mirror, a squashed matrix) is not a view and is ignored. */
    getView(){
      const H = viewAt(HOME_AZ, HOME_EL);
      return !model || R.every((x, i) => x === H[i]) ? null : { R: R.slice() };
    },
    setView(v){
      if (dead || !model || !v || !Array.isArray(v.R) || v.R.length !== 9) return false;
      const M = v.R.map(Number);
      if (!M.every(Number.isFinite)) return false;
      const [a, b, c] = [M.slice(0, 3), M.slice(3, 6), M.slice(6, 9)], dot = (u, w) => u[0]*w[0] + u[1]*w[1] + u[2]*w[2];
      const err = Math.max(...[a, b, c].map(u => Math.abs(dot(u, u) - 1)), Math.abs(dot(a, b)), Math.abs(dot(b, c)), Math.abs(dot(a, c)));
      const det = dot(a, [b[1]*c[2] - b[2]*c[1], b[2]*c[0] - b[0]*c[2], b[0]*c[1] - b[1]*c[0]]);
      if (err > 1e-3 || det < 0.5) return false;
      R = err < 1e-12 ? M : reortho(M);
      request();
      return true;
    },
    png(){
      if (dead || !model) return null;
      const Sz = S || 260, r = Math.max(2, window.devicePixelRatio || 1);
      const c = document.createElement('canvas');
      c.width = c.height = Math.round(Sz*r);
      const g = c.getContext('2d');
      g.setTransform(r, 0, 0, r, 0, 0);
      paint(g, Sz);
      return c.toDataURL('image/png');
    },
    destroy(){ if (dead) return; dead = true; if (raf) cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); canvas.remove(); model = null; },
  };
}
