/* =========================================================
   XRPD — the crystallites' shape in 3D.
   A small view of the solid a free-shape refinement gives (ellipsoid, spheroid,
   cylinder, elliptic cylinder, box or square-based box, in nm) with up to three crystal directions
   drawn through it, each with its 1σ angular uncertainty as a translucent cone, and
   the cell's a, b, c as a small triad in a corner, turned with it (drawTriad: the unit
   cell's view draws the same).
   Software 3D on a 2D canvas: no WebGL, no library. The solid is drawn axis-aligned
   in its own body frame and the directions are brought into that frame, so only the
   camera moves: a drag (mouse, pen or touch) or the arrow keys rotate it, a double
   click or tap (or Home) resets it. Nothing runs while the view is idle. The camera
   can be read and put back (getView / setView), so a card can keep a user's turn
   across a re-render.

   The solid is convex, which makes a translucent one easy to draw right without
   sorting its faces: only its front faces are painted, opaque, on a layer of
   their own (no two of them overlap), and that layer is laid over the scene at a
   fixed alpha. Every bit of line or cone is classed by a ray test against the exact
   solid as hidden (inside it, or behind it from the viewer) or not: the hidden bits
   go under the solid's layer and show through it dimmed, the others on top.

   What is drawn, and where (the solid's model and mesh, the projection, the shading, the
   fade mask, the lines and cones cut where the solid hides them, the edges, the labels'
   words and places, the colours, the camera kept), is worked out by plain functions in
   xrd-shape3d-model.js (v554, out of shapeView); this file holds the canvases, the
   events and what follows the page.
========================================================= */
import {
  HOME_AZ, HOME_EL, SIZE_MAX, viewAt, turned, keyTurn, doubleTap, luma, themeFrom, pngThemeOf, buildModel, solidKey,
  projection, frontFaces, solidBox, shadeSteps, shadeColour, addPoly, fadeMask, dirLines, dashOffset, arrowHead, splitCone,
  coneGroups, edgeLists, rgba, labelTexts, labelItem, labelObstacles, marksOf, placeLabels, labelOffset, labelAlign,
  triadAxes, viewSize, viewState, viewFromState, describeSolid,
} from './xrd-shape3d-model.js';

const SOLID_ALPHA = 0.66;    // the solid over what it hides: the lines through it stay readable
const CONE_ALPHA = 0.16;     // the uncertainty cones: there, but not in the way
// The offscreen layers at 2 pixels per CSS pixel at most (the solid), or 1.5 on screen
// (the cones, faint and soft): they are fills under crisp edges and lines drawn at full
// resolution, and on a 3x screen the full ratio would more than double their cost for
// nothing one can see. A PNG takes the cones at 2 as well.
const LAYER_MAX = 2, CONE_LAYER_MAX = 1.5;

/* ---------- colours ---------- */
let probeCtx = null;
const rgbCache = new Map();
// Any CSS colour → [r, g, b, a], through a canvas, which normalises what it is given.
function rgbOf(str){
  str = String(str || '').trim();
  if (rgbCache.has(str)) return rgbCache.get(str);
  if (!probeCtx) probeCtx = document.createElement('canvas').getContext('2d');
  probeCtx.fillStyle = '#000';
  probeCtx.fillStyle = str;
  const s = probeCtx.fillStyle;
  let out = null;
  if (s[0] === '#') out = [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
  else { const m = s.match(/[\d.]+/g); if (m) out = [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1]; }
  // '#000' back for something that is not black means the string was no colour.
  if (out && !out[0] && !out[1] && !out[2] && !/^(#0{3,8}|black|rgba?\(\s*0[\s,]+0[\s,]+0\b)/i.test(str)) out = null;
  if (rgbCache.size > 200) rgbCache.clear();
  rgbCache.set(str, out);
  return out;
}

// The theme, read from the tokens (themeFrom makes it of them). The view keeps what this
// gives until the theme changes (getComputedStyle at every frame of a drag is not free).
export function readTheme(el, colorOpt){
  const cs = getComputedStyle(el);
  const tok = (n, f) => cs.getPropertyValue(n).trim() || f;
  const bg = rgbOf(tok('--bg', '#0e1316')) || [14, 19, 22, 1];
  const light = luma(bg) > 0.5;
  // What the canvas sits on: the first ancestor with a background of its own.
  let under = null;
  for (let e = el; e && e.nodeType === 1; e = e.parentElement){
    const c = rgbOf(getComputedStyle(e).backgroundColor);
    if (c && c[3] > 0.5){ under = c; break; }
  }
  // The solid's colour given: a token, var(--x) with or without its fallback (taken where the
  // token has no value, as CSS takes it; v568, to v567 left out), or a colour.
  const colorIn = c => { const v = /^var\(\s*(--[^,\s)]+)\s*(?:,([\s\S]*))?\)$/.exec(c);
    return v ? tok(v[1], '') || colorIn(String(v[2] ?? '').trim()) : c.startsWith('--') ? tok(c, '') : c; };
  let solid = null;
  const co = String(colorOpt || '').trim();
  if (co) solid = rgbOf(colorIn(co));
  if (!solid) solid = rgbOf(tok('--accent', '#ffb454')) || [255, 180, 84, 1];
  const text = rgbOf(tok('--text', light ? '#1a2327' : '#dfe8ea')) || [223, 232, 234, 1];
  return themeFrom({ light, text, muted: tok('--muted', light ? '#56676f' : '#7f97a0'), under, bg, solid, font: cs.fontFamily || 'sans-serif' });
}

/* The cell's a, b, c as a small triad, the same in both 3D views (the crystallites'
   shape, here; the unit cell, xrd-cell3d.js): from a point in a corner (at: x, y and the
   arrows' length L), each axis an arrow in its colour, a red, b green, c blue as
   crystallographic programs draw them, named in italics past its tip; the far ones
   first, and dimmed. axes: the three unit vectors, in the frame R turns. */
const AXIS_COLORS = ['#e8453c', '#3fb950', '#4f8ff7'];
export function drawTriad(g, R, axes, at, T, fs){
  const ax = triadAxes(R, axes);
  g.save();
  g.lineCap = 'round';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `italic 600 ${fs}px ${T.font}`;
  for (const a of ax){
    const col = AXIS_COLORS[a.i];
    g.globalAlpha = a.z < -0.05 ? 0.5 : 1;
    const ex = at.x + at.L*a.sx, ey = at.y + at.L*a.sy, n = Math.hypot(a.sx, a.sy);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(at.x, at.y); g.lineTo(ex, ey); g.stroke();
    // a small head where the axis is seen side-on enough to show one
    if (n > 0.3){ const ux = a.sx/n, uy = a.sy/n;
      g.beginPath(); g.moveTo(ex + 2*ux, ey + 2*uy); g.lineTo(ex - 4*ux - 2.6*uy, ey - 4*uy + 2.6*ux); g.lineTo(ex - 4*ux + 2.6*uy, ey - 4*uy - 2.6*ux); g.fill(); }
    // the label past the tip, along the axis as seen (an axis end-on: just off it)
    const ux = n > 1e-3 ? a.sx/n : 0.7, uy = n > 1e-3 ? a.sy/n : -0.7, t = 'abc'[a.i];
    const lx = ex + 8*ux, ly = ey + 8*uy;
    g.lineWidth = 3; g.strokeStyle = T.halo; g.strokeText(t, lx, ly);
    g.fillText(t, lx, ly);
  }
  g.restore();
}

/* ---------- the layers and the stages of a frame ---------- */
/* A view's offscreen canvases: its layers (the solid, the hidden cones, the visible cones)
   and the open ends' fade mask. */
function layerSet(){
  const layers = [];
  let mask = null;                      // the open ends' fade mask (small)
  return {
    // Exactly the mask's size: scaled up, a larger canvas's stale pixels past its edge
    // could bleed into it.
    mask(w, h){
      if (!mask) mask = document.createElement('canvas');
      if (mask.width !== w || mask.height !== h){ mask.width = w; mask.height = h; }
      return mask;
    },
    /* An offscreen layer at lr pixels per CSS pixel. Only the box is drawn in and copied
       out, so a narrow solid (a rod) costs a narrow strip, not the whole square. It is
       cleared over that box and over the last frame's, a little grown: a scaled copy of
       part of a canvas may sample a pixel or two outside it, which must be empty there,
       not what an earlier frame left (the same view must always give the same pixels). */
    layer(i, Wd, Ht, lr, box){
      let c = layers[i];
      if (!c){ c = document.createElement('canvas'); layers[i] = c; }
      const W = Math.round(Wd * lr), H = Math.round(Ht * lr);
      if (c.width !== W || c.height !== H){ c.width = W; c.height = H; c.lastBox = null; }
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      for (const b of [c.lastBox, [box.x * lr, box.y * lr, box.w * lr, box.h * lr]]) if (b) g.clearRect(b[0] - 2, b[1] - 2, b[2] + 4, b[3] + 4);
      c.lastBox = [box.x * lr, box.y * lr, box.w * lr, box.h * lr];
      g.setTransform(lr, 0, 0, lr, 0, 0);
      return g;
    },
    blit(g, i, lr, box, alpha){
      if (!(box.w > 0 && box.h > 0)) return;
      g.globalAlpha = alpha;
      g.drawImage(layers[i], box.x * lr, box.y * lr, box.w * lr, box.h * lr, box.x, box.y, box.w, box.h);
      g.globalAlpha = 1;
    },
    clear(){ layers.length = 0; },
  };
}

/* The stages of a frame (shapeView's paint), each drawing one part of it on fr.g: fr holds
   the frame (g, its Wd × Ht box in CSS pixels, the model m, the projection pj, the theme
   T, the layers' pixel ratios lr and cr, fast), lay the view's layers (layerSet). */

/* The solid's front faces, opaque, on their own layer (0), over the box they cover;
   faded towards an open end by fadeMask's mask. Its projected vertices (Q), the faces
   turned to the viewer and the box, for the edges and the blit. */
function paintSolid(fr, lay){
  const { m, pj, T, Wd, Ht, lr } = fr, { V, F } = m.mesh;
  const Q = V.map(pj.P);
  const front = frontFaces(F, pj.r2);
  const box = solidBox(Q, lr, Wd, Ht);
  const gs = lay.layer(0, Wd, Ht, lr, box);
  // Inside one shade the triangles are one path, filled as a union: no seams. Where
  // one shade meets the next, the anti-aliasing of both leaves a hairline not quite
  // covered (a faint wireframe once the layer is translucent). Filling every shade a
  // second time takes such a pixel from 75 % to 94 % covered, in the colours of its
  // two neighbours only: invisible, and far cheaper than stroking every face.
  // (Growing each triangle by a pixel instead trips the rasteriser: near-coincident
  // overlapping edges in one path come out with a seam of their own.)
  const shadePaths = [...shadeSteps(F, front, pj)].map(([lv, list]) => {
    const path = new Path2D();
    for (const f of list) addPoly(path, f.v.map(i => Q[i]));
    return [shadeColour(T.solid, lv), path];
  });
  for (let pass = 0; pass < 2; pass++) for (const [col, path] of shadePaths){ gs.fillStyle = col; gs.fill(path); }
  // The layer's alpha multiplied by the mask, smoothed up as it is drawn.
  const fm = fadeMask(m, pj, box, fr.fast);
  if (fm){
    const mc = lay.mask(fm.Mw, fm.Mh), mg = mc.getContext('2d');
    const img = mg.createImageData(fm.Mw, fm.Mh);
    img.data.set(fm.px);
    mg.putImageData(img, 0, 0);
    gs.save();
    gs.globalCompositeOperation = 'destination-in';
    gs.imageSmoothingEnabled = true;
    gs.imageSmoothingQuality = 'low';     // bilinear: all a smooth ramp needs, and far cheaper than 'high'
    gs.drawImage(mc, fm.i0 * fm.cs, fm.j0 * fm.cs, fm.Mw * fm.cs, fm.Mh * fm.cs);
    gs.restore();
  }
  return { Q, front, box };
}

/* The directions' lines (dirLines' runs) on one side of the solid, the dashed ones (not
   determined) with their dashes running on from run to run, and their arrowheads. */
function paintLines({ g, pj }, { runs, heads }, hid){
  g.lineCap = 'round';
  for (const rn of runs){
    if (rn.hid !== hid) continue;
    g.strokeStyle = rn.col;
    g.lineWidth = 2;
    if (rn.d.det) g.setLineDash([]);
    else { g.setLineDash([5, 4]); g.lineDashOffset = dashOffset(rn, pj); }
    g.beginPath(); g.moveTo(rn.p0[0], rn.p0[1]); g.lineTo(rn.p1[0], rn.p1[1]); g.stroke();
  }
  g.setLineDash([]);
  for (const h of heads){
    if (h.hid !== hid) continue;
    const a = arrowHead(h);
    g.fillStyle = h.col;
    // Pointing (almost) straight at the viewer or away: a dot, not a squashed arrow.
    if (!a){ g.beginPath(); g.arc(h.tip[0], h.tip[1], 3.5, 0, 2*Math.PI); g.fill(); continue; }
    g.beginPath();
    g.moveTo(a[0][0], a[0][1]);
    g.lineTo(a[1][0], a[1][1]);
    g.lineTo(a[2][0], a[2][1]);
    g.closePath(); g.fill();
  }
}

/* The cones on one side of the solid (splitCone's polygons, coneParts), painted opaque on
   a layer of their own (li; so overlaps of a cone with itself do not darken), the layer
   laid on at one low alpha; then their rims. */
function paintCones(fr, lay, coneParts, hid, li){
  const { g, m, pj, T, Wd, Ht, cr } = fr;
  const { groups, box } = coneGroups(m, coneParts, hid, pj, T.dirs, cr, Wd, Ht);
  if (box){
    const gc = lay.layer(li, Wd, Ht, cr, box);
    for (const gr of groups){
      gc.fillStyle = gr.col;
      gc.beginPath();
      for (const pts of gr.polys) addPoly(gc, pts);
      gc.fill();
    }
    lay.blit(g, li, cr, box, CONE_ALPHA);
  }
  g.globalAlpha = 0.5;
  g.lineWidth = 1;
  g.lineCap = 'butt';
  g.lineJoin = 'round';
  for (const d of m.dirs) for (const cn of d.cones){
    g.strokeStyle = T.dirs[d.slot % T.dirs.length];
    g.beginPath();
    for (const rn of coneParts.get(cn).rim){
      if (rn.hid !== hid) continue;
      g.moveTo(rn.pts[0][0], rn.pts[0][1]);
      for (let i = 1; i < rn.pts.length; i++) g.lineTo(rn.pts[i][0], rn.pts[i][1]);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

/* The solid's edges on one side of it (edgeLists; sol: paintSolid's): hidden creases
   dashed, under the solid. */
function paintEdges({ g, m, T }, { Q, front }, hid){
  const vf = m.mesh.vf, { lines, faded } = edgeLists(m.mesh, front, hid);
  g.lineCap = 'round';
  g.lineWidth = hid ? 0.9 : 1.1;
  g.setLineDash(hid ? [3, 3] : []);
  g.globalAlpha = hid ? 0.7 : 1;
  g.strokeStyle = T.edge;
  g.beginPath();
  for (const ed of lines){
    const p = Q[ed.i], q = Q[ed.j];
    g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]);
  }
  g.stroke();
  // Edges running into an open end fade along their length, as the faces do.
  g.lineCap = 'butt';
  for (const ed of faded){
    const p = Q[ed.i], q = Q[ed.j];
    const gr = g.createLinearGradient(p[0], p[1], q[0], q[1]);
    // Squared: a line shows more than a translucent face, so it goes sooner.
    gr.addColorStop(0, rgba(T.edgeRgb, vf[ed.i] ** 2));
    gr.addColorStop(1, rgba(T.edgeRgb, vf[ed.j] ** 2));
    g.strokeStyle = gr;
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
  }
  g.globalAlpha = 1;
  g.setLineDash([]);
}

/* Labels at the + ends (heads: dirLines'), measured, then placed clear of the lines, the
   scale bar and the triad (placeLabels, from where they sat in the last frame, was; where
   they sit now kept in it when keep, a PNG taking the screen's places as they are); then
   the cell's a, b, c and the scale bar. */
function paintMarks({ g, m, pj, T, Wd, Ht }, heads, was, keep){
  const { f1, f2, bar, triad, fixed } = marksOf(m, pj, Wd, Ht);
  const items = heads.map(h => {
    const t = labelTexts(h.d);
    g.font = `600 ${f1}px ${T.font}`;
    t.runsL.forEach(rn => { rn.w = g.measureText(rn.s).width; });
    g.font = `400 ${f1}px ${T.font}`;
    const tw = g.measureText(t.tail).width;
    g.font = `400 ${f2}px ${T.font}`;
    const sw = t.sub ? g.measureText(t.sub).width : 0;
    return labelItem(h, t, tw, sw, f1, f2, pj);
  });
  if (items.length){
    placeLabels(items, labelObstacles(heads), fixed, Wd, Ht, was);
    if (keep){ was.clear(); for (const it of items) was.set(it.slot, labelOffset(it)); }
  }
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  for (const b of items){
    const col = b.h.col, al = labelAlign(b);
    let x = b.x + (b.w - b.w1) * al;
    const y = b.y + f1 * 0.95;
    g.lineWidth = 3;
    g.strokeStyle = T.halo;
    g.fillStyle = col;
    g.font = `600 ${f1}px ${T.font}`;
    for (const rn of b.runsL){
      g.strokeText(rn.s, x, y);
      g.fillText(rn.s, x, y);
      if (rn.bar){
        const yb = y - f1 * 0.80;
        g.lineWidth = 3.4; g.beginPath(); g.moveTo(x + 0.5, yb); g.lineTo(x + rn.w - 0.5, yb); g.stroke();
        g.strokeStyle = col; g.lineWidth = 1.1; g.stroke();
        g.strokeStyle = T.halo; g.lineWidth = 3;
      }
      x += rn.w;
    }
    g.font = `400 ${f1}px ${T.font}`;
    g.strokeText(b.tail, x, y);
    g.fillText(b.tail, x, y);
    if (b.sub){
      g.font = `400 ${f2}px ${T.font}`;
      const xs = b.x + (b.w - b.sw) * al;
      g.fillStyle = T.muted;
      g.strokeText(b.sub, xs, y + f2 * 1.25);
      g.fillText(b.sub, xs, y + f2 * 1.25);
    }
  }
  if (triad) drawTriad(g, pj.R, m.cell, triad, T, f1);
  if (bar){
    g.strokeStyle = T.muted;
    g.lineWidth = 1.5;
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(bar.x, bar.y - 4); g.lineTo(bar.x, bar.y); g.lineTo(bar.x + bar.px, bar.y); g.lineTo(bar.x + bar.px, bar.y - 4);
    g.stroke();
    g.font = `400 ${f2}px ${T.font}`;
    g.fillStyle = T.muted;
    g.textAlign = 'center';
    g.fillText(bar.text, bar.x + bar.px / 2, bar.y - 5);
    g.textAlign = 'start';
  }
}

/* ---------- the view ---------- */
/* The view, a state object V that the functions below take (v564, no longer one closure):
   its elements (wrap, canvas, cap, ctx), the solid's model and key (sig), its caption, the
   camera R, the canvas's size (S its width, H its height) and pixel ratio, the frame asked
   for (raf), the theme readTheme gave, labelsWere (slot → where its label's centre sat in
   the last frame, relative to its tip: labels keep their places as the solid turns;
   forgotten on a reset and with a new solid, so the home view always looks the same; kept
   in getView), the layers, the drag, the last tap and a key held, and what follows the
   page. */
export function shapeView(container, opts = {}){
  const V = { container, opts, model: null, sig: '', caption: '', keepView: false, R: viewAt(HOME_AZ, HOME_EL),
    S: 0, H: 0, ratio: 1, raf: 0, dead: false, theme: null, labelsWere: new Map(), lay: layerSet(),
    drag: null, lastTap: null, keyHeld: false, seenW: -1, dprMql: null };
  makeElements(V);
  V.request = () => request(V);
  wireCanvas(V);
  followPage(V);
  return apiOf(V);
}

function makeElements(V){
  const wrap = V.wrap = document.createElement('div');
  wrap.className = 'shape3d';
  wrap.hidden = true;
  const canvas = V.canvas = document.createElement('canvas');
  canvas.className = 'shape3d-canvas';
  canvas.tabIndex = 0;
  // A widget with keys of its own (the arrows turn it): as an application a screen reader
  // passes them through, and the role description says what it is.
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-roledescription', '3D view');
  canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
  canvas.style.touchAction = 'none';    // the drag is the view's, not the page's scroll (also in the CSS)
  const cap = V.cap = document.createElement('div');
  cap.className = 'shape3d-cap';
  wrap.append(canvas, cap);
  V.container.appendChild(wrap);
  V.ctx = canvas.getContext('2d');
}
// readTheme's answer, until the theme changes; the PNG's made of it.
const themeOf = V => V.theme || (V.theme = readTheme(V.container, V.opts.color));
const pngTheme = V => pngThemeOf(themeOf(V));

/* Everything, in CSS pixels on a Wd × Ht box (g already scaled by r): the solid fits
   the shorter side, centred. A fast
   paint (during a drag, or while an arrow key is held) coarsens what costs most and
   shows least while the solid moves: the open ends' fade mask and the cones' fine cut
   at the solid's surface. The frame after it is let go is a full one. */
function paint(V, g, Wd, Ht, r, fast, forPng = false){
  const m = V.model, T = forPng ? pngTheme(V) : themeOf(V), pj = projection(m, V.R, Wd, Ht), lay = V.lay;
  const fr = { g, Wd, Ht, m, pj, T, fast, lr: Math.min(r, LAYER_MAX), cr: Math.min(r, forPng ? LAYER_MAX : CONE_LAYER_MAX) };
  const sol = paintSolid(fr, lay);
  const lines = dirLines(m, pj, T.dirs);
  const coneParts = new Map();          // cone → { out: [hidden polygons, visible polygons], rim }
  for (const d of m.dirs) for (const cn of d.cones) coneParts.set(cn, splitCone(cn, pj, fast));
  // Under the solid: what it hides.
  paintCones(fr, lay, coneParts, true, 1);
  paintEdges(fr, sol, true);
  paintLines(fr, lines, true);
  // The solid.
  lay.blit(g, 0, fr.lr, sol.box, SOLID_ALPHA);
  paintEdges(fr, sol, false);
  // On top: what is in front of it or beside it.
  paintCones(fr, lay, coneParts, false, 2);
  paintLines(fr, lines, false);
  paintMarks(fr, lines.heads, V.labelsWere, !forPng);
}

// The canvas's size in CSS pixels (viewSize), from the container's inner width and
// opts.height (a number or a function); null while the container has no width.
function measure({ container, opts }){
  const cs = getComputedStyle(container);
  const w = container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  if (!(w > 0)) return null;
  return viewSize(w, typeof opts.height === 'function' ? opts.height() : opts.height);
}
function draw(V, fast = false){
  if (V.dead || !V.model) return;
  const [w, h] = measure(V) || [V.S, V.H];
  if (!w) return;
  const { canvas, ctx } = V, r = window.devicePixelRatio || 1;
  if (w !== V.S || h !== V.H || r !== V.ratio){
    V.S = w; V.H = h; V.ratio = r;
    canvas.style.width = V.S + 'px'; canvas.style.height = V.H + 'px';
    canvas.width = Math.round(V.S * V.ratio); canvas.height = Math.round(V.H * V.ratio);
    V.cap.style.maxWidth = V.S + 'px';
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Every frame from the context's defaults: a line join or dash left by the last one
  // would make the same view come out different from one frame to the next.
  ctx.save();
  ctx.setTransform(V.ratio, 0, 0, V.ratio, 0, 0);
  paint(V, ctx, V.S, V.H, V.ratio, fast);
  ctx.restore();
}
// A frame is fast while the solid is being turned continuously (a drag, a held key).
const busy = V => !!(V.drag && V.drag.moved) || V.keyHeld;
function request(V){ if (!V.raf && !V.dead) V.raf = requestAnimationFrame(() => { V.raf = 0; draw(V, busy(V)); }); }

/* ---------- interaction ---------- */
function rotate(V, dx, dy){             // screen pixels → a turn about the axis normal to the drag
  const t = turned(V.R, dx, dy, Math.min(V.S, V.H));
  if (!t) return;
  V.R = t;
  request(V);
}
function reset(V){ V.R = V.model ? V.model.home.slice() : viewAt(HOME_AZ, HOME_EL); V.labelsWere.clear(); request(V); }
function wireCanvas(V){
  const { canvas } = V, onUp = e => pointerUp(V, e), onKeyUp = () => keyUp(V);
  canvas.addEventListener('pointerdown', e => pointerDown(V, e));
  canvas.addEventListener('pointermove', e => pointerMove(V, e));
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);
  canvas.addEventListener('dblclick', e => { if (V.model){ e.preventDefault(); reset(V); } });
  canvas.addEventListener('keydown', e => keyDown(V, e));
  canvas.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('blur', onKeyUp);
}
function pointerDown(V, e){
  const { canvas } = V;
  // (the primary button of any pointer, a pen's barrel button or eraser not: v571)
  if (!V.model || V.drag || e.button !== 0) return;
  V.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false };
  try { canvas.setPointerCapture(e.pointerId); } catch(_){}
  canvas.classList.add('is-grabbing');
  e.preventDefault();
  // Keys work after a drag too; but a ring drawn on a mouse or touch focus is noise.
  canvas.focus({ preventScroll: true, focusVisible: false });
}
function pointerMove(V, e){
  const { drag } = V;
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4) drag.moved = true;
  rotate(V, dx, dy);
}
function pointerUp(V, e){
  const d = V.drag;
  if (!d || e.pointerId !== d.id) return;
  V.drag = null;
  V.canvas.classList.remove('is-grabbing');
  try { V.canvas.releasePointerCapture(e.pointerId); } catch(_){}
  // The drag's frames were fast ones: the view where it was left, at full quality.
  if (d.moved) request(V);
  // A double tap resets (touch and pen; a mouse has dblclick). Taps only, not drags.
  if (e.type !== 'pointerup' || d.moved || e.pointerType === 'mouse') return;
  const now = performance.now();
  if (doubleTap(V.lastTap, now, e.clientX, e.clientY)){ V.lastTap = null; reset(V); }
  else V.lastTap = { t: now, x: e.clientX, y: e.clientY };
}
function keyDown(V, e){
  if (!V.model || e.altKey || e.ctrlKey || e.metaKey) return;
  const mv = keyTurn(e.key, e.shiftKey, Math.min(V.S, V.H));
  if (!mv && e.key !== 'Home') return;
  // The key is the view's: no page scroll, and no document-level handler (← / → step
  // through the samples there) may act on it too.
  e.preventDefault();
  e.stopPropagation();
  if (!mv){ reset(V); return; }
  // A held key repeats: fast frames, as a drag, until it is let go.
  if (e.repeat) V.keyHeld = true;
  rotate(V, mv[0], mv[1]);
}
function keyUp(V){ if (V.keyHeld){ V.keyHeld = false; request(V); } }

/* ---------- follow the container, the theme and the screen ---------- */
function followPage(V){
  // Only the container's width sets the view's size (its height follows the canvas).
  // The draw waits for the next frame: resizing the canvas inside the observer's own
  // delivery changes the layout it is observing, which the browser reports as a loop.
  V.ro = new ResizeObserver(entries => {
    const w = Math.round(entries[entries.length - 1].contentRect.width);
    if (w === V.seenW) return;
    V.seenW = w;
    if (V.model) request(V);
  });
  V.ro.observe(V.container);
  V.onTheme = () => { V.theme = null; request(V); };
  V.mo = new MutationObserver(V.onTheme);
  V.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  V.mql = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  if (V.mql) V.mql.addEventListener('change', V.onTheme);
  // A window moved to a screen of another pixel ratio: redraw sharp there.
  V.onDpr = () => { watchDpr(V); request(V); };
  watchDpr(V);
  // The labels are text in the app's web font: drawn before it has loaded, they would
  // keep the fallback face until the next redraw.
  const fonts = V.fonts = document.fonts;
  if (fonts){
    fonts.addEventListener('loadingdone', V.request);
    fonts.ready.then(() => { if (V.model) request(V); });
  }
}
function watchDpr(V){
  if (V.dprMql) V.dprMql.removeEventListener('change', V.onDpr);
  V.dprMql = window.matchMedia ? matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`) : null;
  if (V.dprMql) V.dprMql.addEventListener('change', V.onDpr);
}

function apiOf(V){
  return {
    set: solid => setSolid(V, solid),
    // The camera, as plain numbers (JSON-safe), with where the labels sat: give it back
    // to setView to see the solid turned the same way again, labelled the same way.
    getView: () => viewState(V.R, V.labelsWere),
    setView: state => putView(V, state),
    destroy: () => destroyView(V),
    // The view as a PNG (labels and caption in), at twice the CSS size at least.
    png: () => viewPng(V),
  };
}
function setSolid(V, solid){
  if (V.dead) return;
  if (!solid){ clearSolid(V); return; }
  V.model = buildModel(solid);
  V.theme = null;                       // the container may have moved since
  // The same solid again (a re-render) keeps the user's view; another one starts
  // from its home view (unless a view was put in for it before it came).
  const s = solidKey(V.model, solid);
  if (s !== V.sig){ V.sig = s; if (!V.keepView){ V.R = V.model.home.slice(); V.labelsWere.clear(); } }
  V.keepView = false;
  V.caption = solid.caption ? String(solid.caption) : '';
  V.cap.textContent = V.caption;
  V.cap.hidden = !V.caption;
  V.canvas.setAttribute('aria-label', describeSolid(V.model, V.caption));
  V.wrap.hidden = false;
  draw(V);
}
function clearSolid(V){
  const { canvas, ctx } = V;
  V.model = null; V.sig = ''; V.caption = '';
  V.wrap.hidden = true;
  V.cap.textContent = '';
  canvas.removeAttribute('aria-label');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
function putView(V, state){
  if (V.dead) return false;
  const v = viewFromState(state);
  if (!v) return false;
  V.R = v.R;
  V.labelsWere.clear();
  for (const [slot, o] of v.labels) V.labelsWere.set(slot, o);
  if (V.model) draw(V); else V.keepView = true;
  return true;
}
function destroyView(V){
  if (V.dead) return;
  V.dead = true;
  if (V.raf) cancelAnimationFrame(V.raf);
  V.ro.disconnect(); V.mo.disconnect();
  if (V.mql) V.mql.removeEventListener('change', V.onTheme);
  if (V.dprMql) V.dprMql.removeEventListener('change', V.onDpr);
  if (V.fonts) V.fonts.removeEventListener('loadingdone', V.request);
  V.wrap.remove();
  V.lay.clear();
  V.model = null;
}
function viewPng(V){
  if (V.dead || !V.model) return null;
  const [Wd, Ht] = V.S ? [V.S, V.H] : measure(V) || [SIZE_MAX, SIZE_MAX], r = Math.max(2, window.devicePixelRatio || 1);
  const T = pngTheme(V);
  const capH = V.caption ? 24 : 0;
  const c = document.createElement('canvas');
  c.width = Math.round(Wd * r); c.height = Math.round((Ht + capH) * r);
  const g = c.getContext('2d');
  g.setTransform(r, 0, 0, r, 0, 0);
  // (no background: transparent)
  paint(V, g, Wd, Ht, r, false, true);
  if (V.caption){
    g.font = `400 12px ${T.font}`;
    g.fillStyle = T.muted;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(V.caption, Wd / 2, Ht + capH / 2 - 2, Wd - 12);
  }
  return c.toDataURL('image/png');
}
