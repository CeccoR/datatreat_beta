/* =========================================================
   XRPD — a phase's unit cell in 3D.
   The atoms of the cell (those on its faces, edges and corners in every place they
   reach: a corner atom at all eight corners), as shaded spheres in their elements'
   colours, inside the cell's edges; a, b and c as a triad in the top right corner,
   turned with the cell: the crystallites' shape's (drawTriad), a red, b green, c blue.
   Software 3D on a 2D canvas, as the crystallites' shape (xrd-shape3d.js): a
   drag (mouse, pen or touch) or the arrow keys turn it about the cell's centre, a
   double click or tap (or Home) puts it back. Nothing runs while it is idle.
   What it draws, and where (the cell's model, the projection, the edges behind and in
   front, the spheres back to front and their shading, the view kept), is worked out by
   plain functions in xrd-cell3d-model.js (v564, out of cellView); this file holds the
   canvas, the events and what follows the page, the view a state object V that the
   functions below take.
========================================================= */
import { turned, keyTurn, doubleTap } from './xrd-shape3d-model.js';
import { homeView, buildModel, frameOf, edgesOf, ballsInOrder, ballLook, triadOf, sideOf, describeCell, viewOf, rotationIn } from './xrd-cell3d-model.js';
import { readTheme, drawTriad } from './xrd-shape3d.js';

export { elementColor } from './xrd-cell3d-model.js';

export function cellView(container, opts = {}){
  const V = { container, opts, model: null, name: '', R: homeView(), S: 0, ratio: 1, raf: 0, dead: false, theme: null, drag: null, lastTap: null, seenW: -1 };
  V.canvas = makeCanvas(container);
  V.ctx = V.canvas.getContext('2d');
  V.request = () => request(V);
  wireCanvas(V);
  followPage(V);
  return apiOf(V);
}

function makeCanvas(container){
  const canvas = document.createElement('canvas');
  canvas.className = 'cell3d-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-roledescription', '3D view');
  canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);
  return canvas;
}
// (the shape's: the triad's labels have its halo, the colour the canvas sits on)
const themeOf = V => V.theme || (V.theme = readTheme(V.container));

// The edges behind the cell's centre first, the atoms back to front, the edges in front
// over them; a, b, c where and as large as the crystallites' shape has them.
function paint(V, g, Sz){
  const T = themeOf(V), m = V.model, { k, P, C } = frameOf(m, V.R, Sz);
  g.lineCap = 'round';
  paintEdges(g, C, edgesOf(C, false), T);
  for (const { b, q } of ballsInOrder(m, P)) paintBall(g, b, q, k);
  paintEdges(g, C, edgesOf(C, true), T);
  const { at, fs } = triadOf(Sz);
  drawTriad(g, V.R, m.axes, at, T, fs);
}
function paintEdges(g, C, edges, T){
  for (const e of edges){
    const [p, q] = [C[e[0]], C[e[1]]];
    g.strokeStyle = T.muted; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
  }
}
function paintBall(g, b, q, k){
  const { rr, grad, stops, alpha } = ballLook(b, q, k);
  const grd = g.createRadialGradient(...grad);
  for (const [at, col] of stops) grd.addColorStop(at, col);
  g.globalAlpha = alpha;
  g.fillStyle = grd;
  g.beginPath(); g.arc(q[0], q[1], rr, 0, 2*Math.PI); g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.6; g.stroke();
}

// The square's side: the container's width, or the side its card gives (opts.side).
function measure({ container, opts }){
  const cs = getComputedStyle(container);
  const w = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  return sideOf(opts.side ? opts.side() : w);
}
function draw(V){
  if (V.dead || !V.model) return;
  const s = measure(V) || V.S;
  if (!s) return;
  const { canvas, ctx } = V, r = window.devicePixelRatio || 1;
  if (s !== V.S || r !== V.ratio){
    V.S = s; V.ratio = r;
    canvas.style.width = canvas.style.height = V.S + 'px';
    canvas.width = canvas.height = Math.round(V.S*V.ratio);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.setTransform(V.ratio, 0, 0, V.ratio, 0, 0);
  paint(V, ctx, V.S);
  ctx.restore();
}
function request(V){ if (!V.raf && !V.dead) V.raf = requestAnimationFrame(() => { V.raf = 0; draw(V); }); }

/* ---------- interaction, as the crystallites' shape's ---------- */
function rotate(V, dx, dy){
  const t = turned(V.R, dx, dy, V.S);
  if (!t) return;
  V.R = t;
  request(V);
}
function reset(V){ V.R = homeView(); request(V); }
function wireCanvas(V){
  const { canvas } = V, up = e => onUp(V, e);
  canvas.addEventListener('pointerdown', e => onDown(V, e));
  canvas.addEventListener('pointermove', e => onMove(V, e));
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('dblclick', e => { if (V.model){ e.preventDefault(); reset(V); } });
  canvas.addEventListener('keydown', e => onKey(V, e));
}
function onDown(V, e){
  const { canvas } = V;
  if (!V.model || V.drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
  V.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false };
  try { canvas.setPointerCapture(e.pointerId); } catch(_){}
  canvas.classList.add('is-grabbing');
  e.preventDefault();
  canvas.focus({ preventScroll: true, focusVisible: false });
}
function onMove(V, e){
  const { drag } = V;
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4) drag.moved = true;
  rotate(V, dx, dy);
}
function onUp(V, e){
  const d = V.drag;
  if (!d || e.pointerId !== d.id) return;
  V.drag = null;
  V.canvas.classList.remove('is-grabbing');
  try { V.canvas.releasePointerCapture(e.pointerId); } catch(_){}
  // A double tap resets (touch and pen; a mouse has dblclick). Taps only, not drags.
  if (e.type !== 'pointerup' || d.moved || e.pointerType === 'mouse') return;
  const now = performance.now();
  if (doubleTap(V.lastTap, now, e.clientX, e.clientY)){ V.lastTap = null; reset(V); }
  else V.lastTap = { t: now, x: e.clientX, y: e.clientY };
}
function onKey(V, e){
  if (!V.model || e.altKey || e.ctrlKey || e.metaKey) return;
  const mv = keyTurn(e.key, e.shiftKey, V.S);
  if (!mv && e.key !== 'Home') return;
  // The key is the view's: no page scroll, and no step through the samples.
  e.preventDefault(); e.stopPropagation();
  if (!mv){ reset(V); return; }
  rotate(V, mv[0], mv[1]);
}

// The canvas follows its container's width (the height is the same: a square), and the theme.
function followPage(V){
  V.ro = new ResizeObserver(entries => {
    const w = Math.round(entries[entries.length - 1].contentRect.width);
    if (w === V.seenW) return;
    V.seenW = w;
    if (V.model) request(V);
  });
  V.ro.observe(V.container);
  const onTheme = () => { V.theme = null; request(V); };
  V.mo = new MutationObserver(onTheme);
  V.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

function apiOf(V){
  return {
    /* A phase (its cell and atoms), or null for none. Another phase starts from the home
       view. None: the canvas cleared and out of the layout, by its style (to v498 by its
       hidden attribute alone, which the class's display: block overrode: the cell drawn
       last stayed on show where there was no phase, another project's, a phase removed or
       undone). */
    set: ph => setPhase(V, ph),
    redraw: V.request,
    /* How the cell is turned, as plain numbers (JSON-safe), null at the home view; setView
       puts one back on the phase on show (what the Rietveld card shows, kept as its tab
       sleeps and in its record: xrd-rv.js shows). A rotation, or near enough to be put
       right; anything else (a mirror, a squashed matrix) is not a view and is ignored. */
    getView: () => !V.model ? null : viewOf(V.R),
    setView: v => putView(V, v),
    png: () => cellPng(V),
    destroy: () => destroyView(V),
  };
}
function setPhase(V, ph){
  if (V.dead) return;
  const { canvas, ctx } = V;
  if (!ph){
    V.model = null; V.name = '';
    canvas.hidden = true; canvas.style.display = 'none'; canvas.removeAttribute('aria-label');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (ph.name !== V.name) V.R = homeView();
  V.name = ph.name;
  V.model = buildModel(ph);
  canvas.hidden = false; canvas.style.display = '';
  canvas.setAttribute('aria-label', describeCell(ph));
  V.theme = null;
  draw(V);
}
function putView(V, v){
  if (V.dead || !V.model) return false;
  const R = rotationIn(v);
  if (!R) return false;
  V.R = R;
  request(V);
  return true;
}
function cellPng(V){
  if (V.dead || !V.model) return null;
  const Sz = V.S || 260, r = Math.max(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(Sz*r);
  const g = c.getContext('2d');
  g.setTransform(r, 0, 0, r, 0, 0);
  paint(V, g, Sz);
  return c.toDataURL('image/png');
}
function destroyView(V){ if (V.dead) return; V.dead = true; if (V.raf) cancelAnimationFrame(V.raf); V.ro.disconnect(); V.mo.disconnect(); V.canvas.remove(); V.model = null; }
