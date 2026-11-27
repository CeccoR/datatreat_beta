import { esc, csvLine, fmtNum, alertHtml, fileAlertHtml, fileLine, NOT_READ, bytesOf, setupDropzone, X_SVG, bytesKey, exactKey, objId, guardNumericInput, flashFieldInvalid, kept } from './utils.js';
import { Plot, svgEl, linkX, niceTicks } from './plot.js';
import { plotWrap, chipRow, viewOf, setView, PLOT_DL_ICON } from './modcharts.js';
import { cardInfo, fileSafe, nameDownloads } from './cards.js';
import { isObj, oneOf, num } from './modkit.js';
import { integrateMany } from './gc-tcd-pool.js';
import { snavHtml, snav } from './snav.js';
import * as M from './gc-integ-model.js';
import * as H from './gc-integ-html.js';

/* =========================================================
   GC: THE INTEGRATION CARD (v544; laid out as a DRS card from v545; the calibration's
   standards a GC table and its raw chromatograms from v549)
   The raw chromatograms (TCD) of a GC card integrated again by the engine (gc-tcd.js):
   each injection's H₂ and O₂ peaks fitted with a model of the window they sit in, turned
   into concentrations by a calibration of standards or by the GC software's own scale, and
   handed to the Production Rate cards below it (gc.js).

   createInteg(ctx) is the instance's (one per GC tab), shared by its Integration cards:
   - the raw chromatograms read from their bytes (kept by them: readTcd once per file);
   - the results, by the file's bytes and the method (`store`: a key `bytes|method` → a result
     per chromatogram, null where none yet): a pure function of the two, so they are written
     into every state of the history that holds the file (kit.patch) as they come, no step
     of their own, and saved with the project (the module state's `integ`, the keys its cards
     use), so that a project reopened, a tab woken or an undo never fits again;
   - the job: what no result is held for, integrated in the background (gc-tcd-pool.js), one
     file after another, with its progress and Stop on every Integration card. It is not
     the module's `busy` (utils.js registerBusy): undo works while it runs, and a tab put to
     sleep or closed during a run lets it go, the files done kept, the rest integrated as the
     tab wakes or the project reopens.
   ctx: { kit, all (every record, in list order), gases (gc.js GASES: each gas's key, label,
   txt, csv and colour), cards() (the deck's records), inst(id), drawable(), shown(),
   folded(rec), layer, isTcd(rec), readTable(text) (a GC table read as gc.js reads one, its
   injections' names with it), changed() (results came in: the cards below follow) }.

   SPLIT (v560): what the cards work out (the method, the results' keys and store, what the
   job integrates, the entries, the concentrations, the suspicious rule, what the plots draw,
   the status and the alerts' facts, the CSVs, the calibration's files paired and its lines,
   the card's state) in gc-integ-model.js (plain functions, tested in Node); their words and
   markup in gc-integ-html.js; here the page: the instance's state (S), each card's (C) and
   its calibration window's (W), their fields, plots and listeners, the job's run. Each is a
   function at module level of S (and of a card's C, its window's W), not a closure inside
   createInteg: what a listener holds is what it is handed.
========================================================= */
// utils.js's, modkit.js's and plot.js's helpers the model takes (gc-integ-model.js U), and
// what the markup takes (gc-integ-html.js u).
const U = { isObj, oneOf, num, esc, exactKey, bytesKey, objId, fmtNum, csvLine, niceTicks };
const HU = { esc, alertHtml, fileAlertHtml, X_SVG, snavHtml, plotWrap, chipRow, PLOT_DL_ICON };
export const INTEG_INFO = H.integInfo(cardInfo(false, false));

/* =========================================================
   THE INSTANCE (createInteg): its state S, which every function below takes:
     ctx, kit              its context (above) and the module's kit
     GAS, gasOf, C_FIT     the gases by key, a gas's words (another's drawn so), the fits' colour
     read, tabs            the raw chromatograms read and the calibrations' tables, by their
                           bytes (gc-integ-model.js dataOf, tableOf)
     store                 the results: a key `bytes|method` → a result per chromatogram
     job, halted, soon, failed   the file being integrated ({ key, ac, work, total, done,
                           doneHere, name }), a Stop, the method's change waiting (its
                           timer), why the last run failed
     dead                  its instance let go, a tab asleep or closed: a job's end writes nothing
     painting, paintAll    the frame every card's status waits for, and whether its plots too
========================================================= */
export function createInteg(ctx){
  const S = {
    ctx, kit: ctx.kit, ...M.gasTable(U, ctx.gases), read: new WeakMap(), tabs: new WeakMap(),
    store: new Map(), job: null, halted: false, soon: 0, failed: '', dead: false, painting: 0, paintAll: false,
  };
  return {
    card: (a, el)=> makeCard(S, a, el),
    saved: ()=> M.savedResults(U, S),
    load: obj => M.loadResults(U, S.store, obj),
    ensure: force => ensure(S, force),
    prime: (bytes, d)=> M.prime(S, bytes, d),
    destroy(){ S.dead = true; stop(S); clearTimeout(S.soon); cancelAnimationFrame(S.painting); },
  };
}
// A file's results written: the store's, and every state of the history that holds the file.
function write(S, key, arr){
  S.store.set(key, arr);
  const fk = key.slice(0, key.indexOf('|'));
  S.kit.patch(s=> M.withResult(U, s, fk, key, arr));
}

/* ---- The job: every (file, method) a card uses with a chromatogram not integrated ---- */
// Run what is wanted (`force`: Re-integrate, after a Stop); a job on a file still wanted
// goes on, one on a file no longer wanted (its method changed) gives way.
function ensure(S, force){
  clearTimeout(S.soon); S.soon = 0;
  if (force){ S.halted = false; S.failed = ''; }
  if (S.halted){ paint(S); return; }
  const w = M.wanted(U, S);
  if (S.job){
    if (w.some(g=> g.key === S.job.key)){ S.job.total = S.job.done + M.missing(w) - S.job.doneHere; paint(S); return; }
    S.job.ac.abort(); S.job = null;
  }
  if (!w.length){ paint(S); return; }
  run(S, w[0], M.missing(w), 0);
}
// A method changed: run after the edits settle (a second without another).
function later(S){ clearTimeout(S.soon); S.soon = setTimeout(()=>{ S.soon = 0; ensure(S); }, 1200); paint(S); }
function run(S, g, total, done){
  const ac = new AbortController();
  const work = M.workOf(S, g);
  const j = S.job = { key: g.key, ac, work, total, done, doneHere: 0, name: g.rec.name };
  let last = performance.now();
  integrateMany(g.d.t, g.miss.map(c=> g.d.cols[c]), {
    method: g.method, signal: ac.signal,
    onProgress: (_done, _n, i, r)=>{
      if (S.job !== j) return;
      work[g.miss[i]] = M.resultIn(U, r);
      j.done++; j.doneHere++;
      // (counted for the tests, as utils.js kept counts what is worked out: a project reopened fits none)
      kept.made['gc-tcd'] = (kept.made['gc-tcd'] || 0) + 1;
      // (what came in, shown every half second; written at the file's end)
      if (performance.now() - last > 500){ last = performance.now(); paint(S, true); }
    },
  }).then(()=> ran(S, j, g, work), e=> runFailed(S, j, g, work, e));
  paint(S);
}
// A file's run ended: its results written, the cards below told, the next file run.
function ran(S, j, g, work){
  if (S.job !== j || S.dead) return;
  S.job = null;
  write(S, g.key, work.slice());
  S.ctx.changed();
  const next = S.halted ? [] : M.wanted(U, S);
  if (next.length) run(S, next[0], j.done + M.missing(next), j.done);
  else paint(S, true);
}
// Stopped (what is done kept), or failed (said, and halted).
function runFailed(S, j, g, work, e){
  if (S.job === j) S.job = null;
  if (S.dead) return;
  if (work.some(Boolean)) write(S, g.key, work.slice());
  if (!e || e.name !== 'AbortError'){ S.failed = String(e && e.message || e); S.halted = true; }
  S.ctx.changed();
  paint(S, true);
}
function stop(S){ S.halted = true; clearTimeout(S.soon); S.soon = 0; if (S.job){ S.job.ac.abort(); } paint(S); }
// Every card's status (and, with `all`, its plots: results came in).
function paint(S, all){
  S.paintAll = S.paintAll || !!all;
  if (S.painting || S.dead) return;
  S.painting = requestAnimationFrame(()=>{ const a = S.paintAll; S.painting = 0; S.paintAll = false; if (!S.dead) M.integCards(S).forEach(c=> c.paintStatus(a)); });
}

/* =========================================================
   A CARD: `a` its record (cards.js), `el` its element; its state C:
     a, el, p, $(id)        its record, its element, its ids' prefix, an element of it by its id's end
     method, wasMethod      its method, and the one before it (whose results are shown, said
                           stale, until the file is integrated again)
     cal                    its calibration (gc-integ-model.js calIn)
     ovGas, ovY             the run overview's gas and y (view keys of the state)
     selName, selK          what it shows (no state): the file, by its name, and its chromatogram
     chrom, resid, over     its plots: the chromatogram, its residuals, the run overview
     drawn                  what the chromatogram's CSV gives: { e, k, t, y, curves, stale }
     drag                   a window's edge being dragged: { m } the method as it would be
     ovPts, ovLook, hovK    the overview's points, what a point says, the one hovered (−1: none)
     shownJ                 the judge of the entry on show (renderSel)
     fileNav, injNav        its selectors (snav.js): the file's, the chromatogram's
     calSel, calPlots, calDrawn   the calibration window's standard on show (its row), its
                           plots, what it drew (for its CSV)
     valuesKept             Analysis's values, kept while nothing changes (valuesFor)
     W                      its calibration's window (calWindow)
   It gives gc.js what every card of the deck gives (cardApi).
========================================================= */
function makeCard(S, a, el){
  const p = 'gc' + a.id;
  const C = {
    a, el, p, $: id => el.querySelector('#' + p + id),
    method: M.methodIn(U, null), cal: M.calIn(U, null), ovGas: 'h2', ovY: 'conc',
    selName: null, selK: 0, wasMethod: null, chrom: null, resid: null, over: null, ovPts: [],
    calSel: 0, calPlots: { chrom: null, resid: null }, calDrawn: null,
    W: null, valuesKept: new Map(), shownJ: null, fileNav: null, injNav: null, drawn: null, drag: null, hovK: -1, ovLook: null,
  };
  C.W = calWindow(S, C);
  el.querySelector('.gci-body').innerHTML = H.cardHtml(HU, p);
  wireNav(S, C);
  wireCard(S, C);
  return cardApi(S, C);
}
/* ---- The selectors (snav.js): the file (over the chromatogram), and its chromatogram
   (over the run overview); a suspicious one's name red, in the list too ---- */
function wireNav(S, C){
  const { el } = C, es = ()=> M.entriesOf(S);
  C.fileNav = snav(el.querySelector('.gci-fsel'), {
    count: ()=> es().length, index: ()=>{ const c = M.curOf(S, C); return c ? es().findIndex(x=> x.name === c.name) : 0; },
    label: i => M.fileLabel(es()[i]),
    title: i => M.fileTitle(es()[i]),
    go: i =>{ const x = es()[i]; if (x){ C.selName = x.name; C.selK = 0; draw(S, C); } },
  });
  C.injNav = snav(el.querySelector('.gci-ksel'), {
    count: ()=>{ const e = M.curOf(S, C); return e ? e.n : 0; }, index: ()=> C.selK,
    label: k => M.injShort(M.curOf(S, C), k),
    title: k =>{ const e = M.curOf(S, C); return `${M.injName(e, k)}${e ? ` of ${e.n}` : ''}${C.shownJ && C.shownJ.bad(k) ? ' (suspicious)' : ''}`; },
    bad: k => !!(C.shownJ && C.shownJ.bad(k)),
    go: k =>{ C.selK = k; draw(S, C); },
  });
  const on = (sel, fn)=> el.querySelector(sel).addEventListener('click', fn);
  on('.gci-fprev', ()=>{ if (M.stepFile(S, C, -1)) draw(S, C); });
  on('.gci-fnext', ()=>{ if (M.stepFile(S, C, 1)) draw(S, C); });
  on('.gci-kprev', ()=>{ if (M.stepK(S, C, -1)) draw(S, C); });
  on('.gci-knext', ()=>{ if (M.stepK(S, C, 1)) draw(S, C); });
}
// Its buttons, Default, the run overview's pointer and its chips.
function wireCard(S, C){
  const { el, $ } = C;
  $('Run').addEventListener('click', ()=> ensure(S, true));
  $('Stop').addEventListener('click', ()=> stop(S));
  $('Cal').addEventListener('click', ()=> openCal(S, C, C.W));
  el.querySelector('.gci-reset').addEventListener('click', ()=> setMethod(S, C, M.methodIn(U, null)));
  $('Over').addEventListener('pointermove', ev=>{ const k = ovAt(C, ev); if (k !== C.hovK){ C.hovK = k; paintHl(C); } });
  $('Over').addEventListener('pointerleave', ()=>{ if (C.hovK >= 0){ C.hovK = -1; paintHl(C); } });
  $('Over').addEventListener('click', ev=> onOverClick(S, C, ev));
  el.addEventListener('click', ev=> onChip(S, C, ev));
}
// What gc.js asks of every card of the deck, and what the instance asks of an Integration card.
function cardApi(S, C){
  return {
    method: ()=> C.method,
    tcdRecs: ()=> M.tcdRecs(S, C),
    valuesFor: f => M.valuesFor(U, S, C, f),
    // (a change of its that the cards below read: their sources' key)
    sig: ()=> exactKey([M.methodKey(U, C.method), M.calKey(U, C)]),
    paintStatus(all){ paintStatus(S, C, all); if (C.W.isOpen) paintWindow(S, C, C.W); },
    // (what gc.js asks of every card: no per-sample arrays, no sample picked, no bars, no Results)
    slots: ()=> [],
    clear(){ C.selName = null; C.selK = 0; },
    unselect(){},
    shows: ()=> M.showsOf(S, C),
    showNext: v => M.showNext(U, C, v),
    bars(){},
    renderTable(){ renderSel(S, C); paintAlerts(S, C); paintStatus(S, C); },
    compute(keep){ draw(S, C, keep); },
    computeQuiet(){ renderSel(S, C); paintAlerts(S, C); paintStatus(S, C); },
    hasResults: ()=> false,
    exportEntries: n => exportEntries(S, C, n),
    snapshot: ()=> M.snapshotOf(C),
    restore(s0){ M.restoreCard(U, S, C, s0); if (C.W.isOpen) paintWindow(S, C, C.W); },
    destroy(){ destroyCal(C.W); C.fileNav.close(); C.injNav.close(); },
  };
}

/* ---- What it draws ---- */
function draw(S, C, keep){
  renderSel(S, C);
  paintStatus(S, C);
  paintAlerts(S, C);
  if (!S.ctx.drawable() || S.ctx.folded(C.a)) return;
  const e = M.curOf(S, C);
  drawChrom(S, C, e, keep); drawOverview(S, C, e); paintValues(S, C, e); paintMethod(S, C);
}
function renderSel(S, C){
  const e = M.curOf(S, C);
  if (e){ C.selName = e.name; if (C.selK >= e.n) C.selK = Math.max(0, e.n - 1); }
  C.shownJ = e && !e.d.error ? M.judge(S, e, M.resOf(U, S, C, e.tcd).res) : null;
  C.fileNav.update(); C.injNav.update();
}
/* The chromatogram on show: one plot of two panels that share the retention time
   (plot.js linkX), the chromatogram over its residuals, a Tauc plot's size together,
   three to one. The whole chromatogram is drawn; the view opens (and a reset comes back)
   on the H₂/O₂ zone, the y on the windows' own data. Only the residuals' axis carries
   the time's numbers and title. */
function drawChrom(S, C, e, keep){
  const o = drawPair(S, C, { svg: C.$('Chrom'), rs: C.$('Resid'), leg: C.$('ChromLegend'), wrap: C.el.querySelector('.gci-pair'), keep, was: { chrom: C.chrom, resid: C.resid },
    d: e ? e.d : null, k: C.selK, R: e && !e.d.error ? M.resOf(U, S, C, e.tcd) : null, key: e ? e.name + '#' + C.selK : '',
    file: e ? e.tcd.name : '', what: e ? `${e.label}, chromatogram ${C.selK + 1}` : '', overlay: P => overlayOn(S, C, P, C.drag ? C.drag.m : C.method, true) });
  C.chrom = o.chrom; C.resid = o.resid;
  C.drawn = o.drawn ? { e, ...o.drawn } : null;
  C.$('Notice').innerHTML = o.notice;
}
/* One chromatogram over its residuals, drawn into a pair of svgs: the card's (the
   chromatogram on show) or the calibration window's (the standard chosen), alike.
   o: { svg, rs (the residuals' svg), leg, wrap (their plot-wrap), keep, was ({ chrom,
   resid }: the plots before, their zoom kept with `keep` on the same data), d (readTcd's
   read), k (its chromatogram), R (resOf's), key (the data's, for the zoom), file, what
   (the notices' names), overlay(P) (drawn over the chromatogram, again at each zoom) }.
   → { chrom, resid, drawn ({ k, t, y, curves, stale }, the CSV's; null: nothing drawn),
   notice (an alert's markup, or '') }. */
function drawPair(S, C, o){
  const vc = o.keep && o.was.chrom ? viewOf(o.was.chrom) : null, vr = o.keep && o.was.resid ? viewOf(o.was.resid) : null;
  const chrom = new Plot(o.svg, { xlabel: 'Retention time (s)', ylabel: 'TCD signal', noXTickLabels: true, noXTitle: true, xTickMarks: true, margin: { l: 58, r: 20, t: 15, b: 0 } });
  const resid = new Plot(o.rs, { xlabel: 'Retention time (s)', ylabel: 'Residual', xTickMarks: true, margin: { l: 58, r: 20, t: 0, b: 40 } });
  linkX([chrom, resid]);
  const tools = { group: [chrom, resid] }, out = { chrom, resid, drawn: null, notice: '' };
  o.leg.innerHTML = '';
  const D = M.chromOf(U, o, C.method);
  if (D.fail){ chrom.attachTools(o.wrap, tools); out.notice = H.pairNotice(HU, o, D); return out; }
  out.drawn = { k: D.k, t: D.tt, y: D.yy, curves: D.curves, stale: D.R.stale };
  o.leg.innerHTML = H.chromLegendHtml(HU, drawChromPanel(S, chrom, D, vc, o.key));
  // The windows' edges, the peaks' places and the neighbours, drawn over the data, again
  // at each zoom.
  chrom._onView = ()=> o.overlay(chrom);
  o.overlay(chrom);
  drawResidPanel(resid, chrom, D, vr, o.key);
  chrom.attachTools(o.wrap, tools);
  out.notice = H.pairNotice(HU, o, D);
  return out;
}
// The chromatogram's panel: the glitch zones, the raw data, each window's baseline, model
// and peaks, the points left out. → the legend's entries.
function drawChromPanel(S, chrom, D, vc, key){
  chrom.setRange(D.lo, D.hi, D.c0, D.c1);
  setView(chrom, vc, key);
  chrom.drawAxes(); chrom.clearData();
  // The glitch zones left out of the fit, behind the curves.
  M.bandsOf(D.curves).forEach(z=> chrom.vband(z[0], z[1], M.C_BAD, 0.14));
  chrom.line(D.tt, D.yy, M.C_RAW, 1.2, undefined, { label: 'raw', key: 'raw' });
  const items = [[M.C_RAW, 'raw', '']], pc = { ci: 0 };
  D.curves.forEach(({ wr, c })=>{
    if (c.base){ chrom.line(c.t, c.base, M.C_BASE, 1.1, '5,4', { label: `baseline (${wr.key})`, key: 'base ' + wr.key }); }
    // (the model under its peaks: each peak, on the baseline, drawn over it)
    if (c.model) chrom.line(c.t, c.model, M.C_MODEL, 1.4, undefined, { label: `model (${wr.key})`, key: 'model ' + wr.key });
    M.peakLines(S, wr, c, items, pc).forEach(l=> chrom.line(c.t, l.y, l.col, 1.3, l.dash, { label: l.name, key: 'peak ' + l.name }));
  });
  const dr = M.droppedOf(D.curves);
  if (dr.sp.x.length) chrom.points(dr.sp.x, dr.sp.y, M.C_BAD, 4, { shape: 'cross', width: 1.6, label: 'spikes' });
  if (dr.ex.x.length) chrom.points(dr.ex.x, dr.ex.y, M.C_BAD, 2.2, { label: 'glitch' });
  return M.legendItems(items, D.curves, dr);
}
// The residuals' panel, inside the fit window only (blank outside it), on the same time.
function drawResidPanel(resid, chrom, D, vr, key){
  const { rx, ry, r0, r1 } = M.residOf(U, D.curves);
  resid.setRange(D.lo, D.hi, r0, r1);
  setView(resid, vr, key);
  resid.xmin = chrom.xmin; resid.xmax = chrom.xmax;
  resid.drawAxes(); resid.clearData();
  M.bandsOf(D.curves).forEach(z=> resid.vband(z[0], z[1], M.C_BAD, 0.14));
  if (rx.length){
    resid.line([rx[0], rx[rx.length - 1]], [0, 0], M.C_TABLE, 1, '3,3', { label: 'zero', key: 'zero' });
    resid.line(rx, ry, M.C_MODEL, 1, undefined, { label: 'residual', key: 'residual' });
  }
}
// (dragging: the method as it would be, its lines where they are being taken)
const overlay = (S, C)=>{ if (C.chrom) overlayOn(S, C, C.chrom, C.drag ? C.drag.m : C.method, true); };
/* Over the chromatogram of plot P, method meth's: the neighbours, the peaks' places, the
   windows' edges (dragged, `edit`: the card's; fixed in the calibration's window). */
function overlayOn(S, C, P, meth, edit){
  const g = P.gOverlay, { w: W, h } = P.size(), m = P.margin;
  // (the overlay is this card's alone: its lines drawn anew, the plot's copies of them too)
  g.innerHTML = '';
  P._stored = P._stored.filter(x=> x.type !== 'vline');
  const add = (tag, at, text)=>{ const node = svgEl(tag, { 'pointer-events': 'none', class: 'gci-ov', ...at }); if (text) node.textContent = text; g.appendChild(node); return node; };
  // The neighbours the model has no peak for: a grey zone each, named.
  M.NEIGHBOURS.forEach(z=>{
    const x0 = P.px(z.from), x1 = P.px(z.to);
    if (x1 < m.l || x0 > W - m.r) return;
    add('rect', { x: x0, y: m.t, width: Math.max(0, x1 - x0), height: Math.max(0, h - m.t - m.b), class: 'gci-ov gci-nb' });
    add('text', { x: (x0 + x1)/2, y: m.t + 14, 'font-size': 10, 'text-anchor': 'middle', class: 'gci-ov gci-nb-lb' }, z.name);
  });
  // The peaks' places: a thin dotted line each, named at the top.
  meth.windows.forEach(w=> (w.peaks || []).forEach((pk, i)=>{
    if (!M.fin(pk.t) || pk.t < P.xmin || pk.t > P.xmax) return;
    const x = P.px(pk.t), col = pk.gas ? S.gasOf(pk.gas).color : M.PEAK_COLORS[i % M.PEAK_COLORS.length];
    add('line', { x1: x, x2: x, y1: m.t, y2: h - m.b, stroke: col, 'stroke-width': 1, 'stroke-dasharray': '1,3' });
    add('text', { x: x + 3, y: m.t + 30 + 11*(i % 3), 'font-size': 10, fill: col }, pk.name);
  }));
  // The edges, dragged.
  meth.windows.forEach((w, wi)=> ['from', 'to'].forEach(side=>{
    if (edit) P.vline(w[side], M.C_EDGE, true, v=> onDrag(S, C, wi, side, v), v=> onDrop(S, C, wi, side, v));
    else P.vline(w[side], M.C_EDGE, false);
  }));
}
// A line dragged snaps to the data's grid (0.2 s) and writes into its field.
function onDrag(S, C, wi, side, v){
  if (!C.drag) C.drag = { m: M.clone(C.method) };
  C.drag.m.windows[wi][side] = M.edgeAt(v);
  overlay(S, C);
  paintMethod(S, C, C.drag.m);
}
function onDrop(S, C, wi, side, v){
  const m = C.drag ? C.drag.m : M.clone(C.method);
  C.drag = null;
  m.windows[wi][side] = M.edgeAt(v);
  setMethod(S, C, m);
}
// A method set (a step): its results looked for, else integrated a little later.
function setMethod(S, C, m){
  const w = M.tooShort(m);
  if (w){ draw(S, C, true); C.$('Notice').innerHTML = H.notTakenHtml(HU, `The ${w.key} window must start at least 5 s before it ends.`); return; }
  if (M.methodKey(U, m) === M.methodKey(U, C.method)){ draw(S, C, true); return; }
  M.takeMethod(U, C, m);
  draw(S, C, true);
  S.kit.commit();
  S.ctx.changed();
  later(S);
}

/* ---- Windows: the fit windows' edges (their lines on the chromatogram an aid), each a
   step, with the peaks' nominal places ---- */
function paintMethod(S, C, m = C.method){
  const box = C.$('Method'), reset = C.el.querySelector('.gci-reset');
  const focus = document.activeElement && box.contains(document.activeElement) ? document.activeElement.dataset.k : null;
  const warn = M.intrusions(m);
  reset.hidden = M.isDefault(U, m);
  box.innerHTML = H.methodHtml(HU, m, warn);
  box.querySelectorAll('input').forEach(inp=> wireEdge(S, C, inp));
  if (focus){ const f = box.querySelector(`input[data-k="${focus}"]`); if (f) f.focus(); }
}
// A window's edge typed: a number (either decimal mark), else refused and put back.
function wireEdge(S, C, inp){
  guardNumericInput(inp, {});
  const [wi, side] = inp.dataset.k.slice(1).split(':');
  inp.addEventListener('change', ()=>{
    const v = +String(inp.value).replace(',', '.'), n = M.clone(C.method);
    if (!M.fin(v)){ flashFieldInvalid(inp); inp.value = C.method.windows[+wi][side]; return; }
    n.windows[+wi][side] = v;
    setMethod(S, C, n);
  });
  inp.addEventListener('keydown', e=>{ if (e.key === 'Enter') inp.blur(); });
}
/* ---- Peaks: the values of the chromatogram on show ---- */
function paintValues(S, C, e){ C.$('Values').innerHTML = H.valuesHtml(HU, S.gasOf, M.peaksOf(U, S, C, e)); }

/* ---- The run overview: one gas at a time, every injection's fit (blue
   whatever the gas, red where it is suspicious for that gas) and the GC table's value
   (a small grey cross; as area, times the run's k); a point hovered drawn lighter and
   half again as large, and says what it is, the chromatogram on show's as well; a click
   shows its chromatogram ---- */
function drawOverview(S, C, e){
  const svg = C.$('Over'), leg = C.$('OverLegend');
  const over = C.over = new Plot(svg, { xlabel: M.aligned(e) ? 'Time from the first injection (h)' : 'Injection', ylabel: '' });
  // (its points answer the pointer themselves: no trace picked, no crosshair)
  svg._noPick = true; svg._suppressReadout = true;
  C.ovPts = []; C.ovLook = null;
  const gasBox = C.el.querySelector('.gci-ov-gas'), yBox = C.el.querySelector('.gci-ov-y');
  if (!e || e.d.error || !e.n){ gasBox.innerHTML = ''; yBox.innerHTML = ''; leg.innerHTML = ''; over.attachTools(svg.closest('.plot-wrap')); return; }
  const O = M.overviewOf(U, S, C, e);
  gasBox.innerHTML = H.ovGasHtml(S.gasOf, Object.keys(S.GAS), O.g);
  yBox.innerHTML = H.ovYHtml(HU, O);
  over.ylabel = O.ylabel;
  over.setRange(O.xr[0], O.xr[1], O.yr[0], O.yr[1]);
  over.drawAxes(); over.clearData();
  // (the crosses under the fits' dots, which cover them where the two agree; the fits one
  // colour whatever the gas, the suspicious red)
  const { G, xs, fit, bad, g } = O;
  if (O.table) over.points(xs, O.table, M.C_TABLE, M.OV_CROSS, { shape: 'cross', width: 1.4, label: O.mode === 'conc' ? `${G.txt} GC table` : `${G.txt} GC table × k`, key: g + ' table' });
  over.points(xs, fit.map((v, k)=> bad[k] ? NaN : v), S.C_FIT, M.OV_R, { fill: true, label: `${G.txt} fit`, key: g + ' fit' });
  if (bad.some(Boolean)) over.points(xs, fit.map((v, k)=> bad[k] ? v : NaN), M.C_BAD, M.OV_R, { fill: true, label: `${G.txt} fit, suspicious`, key: g + ' suspicious' });
  C.ovPts = O.pts; C.ovLook = O.look;
  leg.innerHTML = H.overLegendHtml(O, S.C_FIT, M.C_BAD);
  over._onView = ()=> paintHl(C);
  paintHl(C);
  over.attachTools(svg.closest('.plot-wrap'));
}
/* The points brightened: the chromatogram on show's, and the one under the pointer with
   its label (in the overlay: drawn again at each zoom, never exported). The point alone,
   drawn again in a lighter shade of its colour and half again as large as the dot as
   seen, with no stroke: (OV_R + 0.5)·OV_HL_R, the 0.5 half the dot's 1 px ring. */
function paintHl(C){
  const over = C.over;
  if (!over) return;
  const old = over.gOverlay.querySelector('.gci-hl');
  if (old) old.remove();
  const g = svgEl('g', { class: 'gci-hl', 'pointer-events': 'none' });
  over.gOverlay.appendChild(g);
  const mark = q =>{
    const x = over.px(q.x), y = over.py(q.y);
    g.appendChild(svgEl('circle', { cx: x, cy: y, r: +((M.OV_R + 0.5)*M.OV_HL_R).toFixed(3), fill: M.tint(q.color, M.OV_HL_TINT), stroke: 'none', class: 'gci-hl-pt' }));
    return [x, y];
  };
  const sel = C.ovPts.find(q=> q.k === C.selK);
  if (sel) mark(sel);
  const hov = C.hovK >= 0 ? C.ovPts.find(q=> q.k === C.hovK) : null;
  if (hov){ const [x, y] = hov === sel ? [over.px(hov.x), over.py(hov.y)] : mark(hov); if (C.ovLook) over.tagAt(g, x, y, C.ovLook(hov.k), hov.color); }
  g.dataset.sel = sel ? String(sel.k) : '';
  g.dataset.hov = hov ? String(hov.k) : '';
}
// The injection nearest the pointer on screen, within 14 px (−1: none).
function ovAt(C, ev){
  if (!C.over || !C.ovPts.length) return -1;
  const b = C.$('Over').getBoundingClientRect();
  return M.nearest(C.over, C.ovPts, ev.clientX - b.left, ev.clientY - b.top);
}
function onOverClick(S, C, ev){
  if (!C.over || C.over._mode) return;
  const k = ovAt(C, ev);
  if (k >= 0 && k !== C.selK){ C.selK = k; draw(S, C); }
}
// The overview's chips: its gas, its y (view keys: a step).
function onChip(S, C, ev){
  const gc = ev.target.closest('.gci-ov-chip'), yc = ev.target.closest('.gci-ovy-chip');
  if (gc && !gc.disabled && S.GAS[gc.dataset.g] && gc.dataset.g !== C.ovGas){ C.ovGas = gc.dataset.g; draw(S, C, true); S.kit.commit(); }
  if (yc && !yc.disabled && yc.dataset.y !== C.ovY){ C.ovY = oneOf(yc.dataset.y, ['conc', 'area']); draw(S, C, true); S.kit.commit(); }
}

/* ---- The status, the card's alerts ---- */
function paintStatus(S, C, all){
  const box = C.$('Status'), x = M.progressOf(U, S, C), html = H.statusHtml(HU, x);
  box.innerHTML = html;
  box.dataset.state = x.state;
  C.$('Bar').hidden = !html;
  C.$('Stop').style.display = x.st.job ? '' : 'none';
  C.$('Run').style.display = !x.st.job && x.left ? '' : 'none';
  if (all){ C.valuesKept.clear(); if (S.ctx.drawable()) draw(S, C, true); }
}
function paintAlerts(S, C){ C.$('Alerts').innerHTML = H.alertsHtml(HU, S.gasOf, M.alertFacts(U, S, C)); }

/* ---- Its CSVs: every chromatogram's values (integration.csv, the run overview's); the
   chromatogram on show, its model and parts and its residuals (chromatogram.csv, the
   chromatogram's plot's: the whole chromatogram, the model's columns blank outside the
   fit window) ---- */
function exportEntries(S, C, n){
  const es = M.entriesOf(S), W = C.W;
  if (!es.length) return W.isOpen && C.calDrawn ? [{ name: `${n} - standard_chromatogram.csv`, text: M.chromCsv(U, C.calDrawn) }] : [];
  const out = [{ name: `${n} - integration.csv`, text: M.integrationCsv(U, S, C, es) }];
  const d = C.drawn;
  if (d && d.e && es.some(x=> x.name === d.e.name)) out.push({ name: `${n} - chromatogram.csv`, text: M.chromCsv(U, d) });
  // (the standard on show in the calibration's window, while it is open: its plot's)
  if (W.isOpen && C.calDrawn) out.push({ name: `${n} - standard_chromatogram.csv`, text: M.chromCsv(U, C.calDrawn) });
  return out;
}

/* =========================================================
   THE CALIBRATION'S WINDOW (a card's): a table and its raw chromatograms, both needed, the
   standards named by the table; the standard chosen drawn as the card's chromatogram, over
   its residuals, at the left of the standards' table, CLAUDE.md's tops aligned. Its state W:
     m, q(sel)             its backdrop in the layer, an element of it
     isOpen, from          whether open, what had the focus before it opened
     rowsNow               the standards' rows as last drawn (gc-integ-model.js calRows)
     held                  the files dropped waiting for their partner (not in the project),
                           let go as it closes
     stdNav, onKey         the standards' selector (snav.js), its keys' listener (while open)
========================================================= */
function calWindow(S, C){
  const m = document.createElement('div');
  m.className = 'modal-backdrop xrd-std-modal gci-cal-modal';
  m.style.display = 'none';
  m.innerHTML = H.calHtml(HU, C.p);
  S.ctx.layer.appendChild(m);
  const W = { m, q: s => m.querySelector(s), from: null, isOpen: false, rowsNow: [], held: [], stdNav: null, onKey: null };
  W.onKey = e => onCalKey(S, C, W, e);
  const info = W.q('.instr-info'), instr = W.q('.xrd-std-instr');
  info.addEventListener('click', ()=>{ const o = instr.style.display === 'none'; instr.style.display = o ? '' : 'none'; info.classList.toggle('is-on', o); info.setAttribute('aria-expanded', String(o)); });
  m.addEventListener('click', e=>{ if (e.target === m || e.target.closest('.xrd-std-x')) closeCal(W); });
  setupDropzone(W.q('.gci-cal-dz'), W.q('.gci-cal-in'), list => onCalDrop(S, C, W, list));
  wireCalEdits(S, C, W);
  wireCalNav(S, C, W);
  return W;
}
/* ← → step the standards, as the card's chromatograms (utils.js SAMPLE_NAV leaves the
   keys to a window over the page): not from a field, nor under a window over this one
   (the figure composer's); Escape closes it. */
const above = W => [...document.querySelectorAll('.modal-backdrop, .fig-backdrop')].some(x=> x !== W.m && x.getClientRects().length > 0);
function onCalKey(S, C, W, e){
  if (e.key === 'Escape' && S.ctx.shown()){ e.stopPropagation(); closeCal(W); return; }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.ctrlKey && !e.metaKey && !e.altKey && S.ctx.shown() && !above(W)){
    const t = document.activeElement && document.activeElement.tagName;
    if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
    e.preventDefault();
    stepStd(S, C, W, e.key === 'ArrowLeft' ? -1 : 1);
  }
}
function openCal(S, C, W){ if (W.isOpen) return; W.isOpen = true; W.from = document.activeElement; W.m.style.display = 'flex'; document.addEventListener('keydown', W.onKey); paintWindow(S, C, W); ensure(S); W.q('.gci-cal-box').focus({ preventScroll: true }); }
// (the files waiting for their partner, and what was said of them, let go)
function closeCal(W){ if (!W.isOpen) return; W.isOpen = false; W.held = []; W.q('.gci-cal-alerts').innerHTML = ''; W.stdNav.close(); W.m.style.display = 'none'; document.removeEventListener('keydown', W.onKey); if (W.from && W.from.isConnected) W.from.focus({ preventScroll: true }); W.from = null; }
function destroyCal(W){ closeCal(W); W.stdNav.close(); W.m.remove(); }
// A change: the card's, a step; the cards below follow.
// (`levels`: a level typed or ticked, its field kept as it is: the fits drawn again, not the table)
function calChanged(S, C, W, levels){ C.valuesKept.clear(); draw(S, C, true); if (levels) paintFits(S, C, W); else paintWindow(S, C, W); S.kit.commit(); S.ctx.changed(); }

/* The files dropped (v549), each told by what it holds and paired (gc-integ-model.js
   takeDropped, pairDropped): a pair loaded when its table has as many injections as there
   are chromatograms; a file whose partner is not there waits (W.held) until it is dropped;
   a table whose partner is a calibration file of v544–v548's names its standards. A file
   whose bytes cannot be read (gone from the disk: utils.js NOT_READ) is said and left out,
   not the rest of the drop (to v566 it ended the drop with no word). Each drop's alerts
   replace the last's. */
async function onCalDrop(S, C, W, list){
  const bad = [], got = [];
  for (const f of list){
    const b = await bytesOf(f);
    if (!b){ bad.push(fileLine(f.name, NOT_READ)); continue; }
    const x = M.takeDropped(S, f.name, b);
    if (x.bad) bad.push(x.bad); else got.push(x);
  }
  const P = M.pairDropped(S, C.cal, W.held, got, bad);
  W.held = P.held;
  W.q('.gci-cal-alerts').innerHTML = H.dropAlertHtml(HU, bad, P.dup);
  if (!P.add.length && !P.named.length) return;
  if (P.add.length) C.calSel = M.calRows(U, S, C).length;
  C.cal = M.calWith(C.cal, P.add, P.named);
  calChanged(S, C, W);
  ensure(S);
}
// Its files removed, its unit, the levels typed or ticked, a row picked, an intercept's chip.
function wireCalEdits(S, C, W){
  const q = W.q;
  q('.gci-cal-files').addEventListener('click', e=>{
    const b = e.target.closest('[data-cal-del]');
    if (!b) return;
    const c = M.calCopy(C.cal); c.files.splice(+b.dataset.calDel, 1); C.cal = c; calChanged(S, C, W);
  });
  q('.gci-cal-unit-in').addEventListener('change', e=>{ const c = M.calCopy(C.cal); c.unit = oneOf(e.target.value, M.UNITS); C.cal = c; calChanged(S, C, W); });
  q('.gci-cal-levels').addEventListener('change', e=> onLevel(S, C, W, e));
  q('.gci-cal-levels').addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.matches('input[type="text"]')) e.target.blur(); });
  // A row clicked, or a field of it taken (Tab), shows its standard.
  const pickRow = e =>{ const tr = e.target.closest('tr[data-row]'); if (tr && +tr.dataset.row !== C.calSel){ C.calSel = +tr.dataset.row; selPaint(S, C, W, false); } };
  q('.gci-cal-levels').addEventListener('click', pickRow);
  q('.gci-cal-levels').addEventListener('focusin', pickRow);
  q('.gci-cal-fits').addEventListener('click', e=>{
    const b = e.target.closest('[data-zero]');
    if (!b) return;
    const c = M.calCopy(C.cal), g = b.dataset.g, z = b.dataset.zero === '1';
    if (c.zero[g] === z) return;
    c.zero[g] = z; C.cal = c; calChanged(S, C, W);
  });
}
// A level typed (blank: none; a number at least 0, else refused and put back) or a row ticked.
function onLevel(S, C, W, e){
  const inp = e.target.closest('input[data-fi]');
  if (!inp) return;
  const c = M.calCopy(C.cal), f = c.files[+inp.dataset.fi], j = +inp.dataset.j;
  if (!f) return;
  while (f.levels.length <= j) f.levels.push(M.blankLevel());
  if (inp.type === 'checkbox'){ f.levels[j].on = inp.checked; inp.closest('tr').classList.toggle('is-excluded', !inp.checked); }
  else {
    const v = M.levelIn(inp.value);
    if (Number.isNaN(v)){ flashFieldInvalid(inp); inp.value = f.levels[j][inp.dataset.g] == null ? '' : String(f.levels[j][inp.dataset.g]); return; }
    f.levels[j][inp.dataset.g] = v;
  }
  C.cal = c; calChanged(S, C, W, true);
}

/* The standard on show: its selector (snav.js: its name, the table's; red where its
   fit is suspicious), its arrows and ← →, a click on its row. */
function wireCalNav(S, C, W){
  W.stdNav = snav(W.q('.gci-csel'), {
    count: ()=> W.rowsNow.length, index: ()=> C.calSel,
    label: i => W.rowsNow[i] ? W.rowsNow[i].name : '',
    title: i => W.rowsNow[i] ? M.fullName(W.rowsNow[i]) : '',
    bad: i => !!(W.rowsNow[i] && M.fitMarks(W.rowsNow[i].r).length),
    go: i =>{ C.calSel = i; selPaint(S, C, W, true); },
  });
  W.q('.gci-cprev').addEventListener('click', ()=> stepStd(S, C, W, -1));
  W.q('.gci-cnext').addEventListener('click', ()=> stepStd(S, C, W, 1));
}
function stepStd(S, C, W, d){ const n = W.rowsNow.length; if (n < 2) return; C.calSel = (C.calSel + d + n) % n; selPaint(S, C, W, true); }
// (`scroll`: chosen elsewhere than in the table, its row brought into the table's view)
function selPaint(S, C, W, scroll){
  const trs = [...W.m.querySelectorAll('.gci-cal-levels tr[data-row]')];
  trs.forEach(tr=> tr.classList.toggle('selected', +tr.dataset.row === C.calSel));
  W.stdNav.update();
  drawStd(S, C, W, false);
  const tr = trs[C.calSel], box = W.q('.gci-cal-table');
  if (scroll && tr && box.scrollHeight > box.clientHeight) rowInView(box, tr);
}
function rowInView(box, tr){
  const b = box.getBoundingClientRect(), r = tr.getBoundingClientRect(), hd = box.querySelector('thead').getBoundingClientRect().height;
  if (r.top < b.top + hd) box.scrollTop -= b.top + hd - r.top;
  else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
}
// Its chromatogram over its residuals, as the card's (drawPair), the windows' edges fixed.
function drawStd(S, C, W, keep){
  const x = W.rowsNow[C.calSel] || null;
  W.q('.gci-cal-pside').classList.toggle('is-empty', !x);
  if (!W.isOpen) return;
  const o = drawPair(S, C, { svg: W.q('svg.gci-chrom'), rs: W.q('svg.gci-resid'), leg: W.q('.gci-cal-legend'), wrap: W.q('.gci-cal-pair'), keep, was: C.calPlots,
    d: x ? x.d : null, k: x ? x.j : 0, R: x ? M.resOf(U, S, C, x.f) : null, key: x ? M.fileKey(U, x.f) + '#' + x.j : '', file: x ? x.f.name : '', what: x ? x.name : '', overlay: P => overlayOn(S, C, P, C.method, false) });
  C.calPlots = { chrom: o.chrom, resid: o.resid };
  C.calDrawn = x && o.drawn ? { x, ...o.drawn } : null;
  W.q('.gci-cal-notice').innerHTML = o.notice;
  // (its fit in a line under the plot: each gas's area and χ²ᵣ, what makes it suspicious)
  W.q('.gci-cal-fit').innerHTML = H.calFitHtml(HU, S.gasOf, Object.keys(S.GAS), x);
  const n = fileSafe(C.a.name);
  nameDownloads(W.q('.gci-cal-pair'), `${n} - GC_standard_chromatogram.svg`, `${n} - standard_chromatogram.csv`);
}
// (drawn anew while the standards are integrated: the field typed in keeps the focus)
function paintWindow(S, C, W){
  if (!W.isOpen) return;
  const was = focusedLevel(W), box = W.q('.gci-cal-table'), top = box.scrollTop;
  W.q('.gci-cal-files').innerHTML = H.calFilesHtml(HU, C.cal.files);
  paintCalWarn(C, W);
  W.q('.gci-cal-unit-in').value = C.cal.unit;
  W.m.querySelectorAll('.gci-u').forEach(s=>{ s.textContent = `(${C.cal.unit})`; });
  const rows = W.rowsNow = M.calRows(U, S, C), left = M.stdsLeft(U, S, C);
  if (C.calSel >= rows.length) C.calSel = Math.max(0, rows.length - 1);
  W.q('.gci-cal-status').textContent = H.calStatusText(C.cal.files, left, rows.length);
  const [lo, hi] = M.range(C.method);
  W.q('.gci-cal-levels tbody').innerHTML = H.levelRowsHtml(HU, rows, C.calSel, lo, hi);
  box.scrollTop = top;
  if (was) refocus(W, was);
  W.stdNav.update();
  drawStd(S, C, W, true);
  paintFits(S, C, W);
}
// The level's field that has the focus: its key, value and caret (null: none).
function focusedLevel(W){
  const act = document.activeElement;
  return act && W.m.contains(act) && act.matches('input[data-fi]') ? { k: `[data-fi="${act.dataset.fi}"][data-j="${act.dataset.j}"][data-g="${act.dataset.g}"]`, v: act.value, s: act.type === 'text' ? act.selectionStart : null } : null;
}
function refocus(W, was){
  const f = W.m.querySelector('input' + was.k);
  if (f){ if (f.type === 'text'){ f.value = was.v; } f.focus({ preventScroll: true }); if (was.s != null) try { f.setSelectionRange(was.s, was.s); } catch(e){ /* not a text field */ } }
}
/* A calibration of v544–v548's, its raw chromatograms alone: said, its standards named
   by column, until its table is dropped (an alert dismissed stays so while the same
   files lack theirs). */
function paintCalWarn(C, W){
  const old = C.cal.files.filter(f=> !f.table), wk = old.map(f=> f.name).join('\n'), warn = W.q('.gci-cal-warn');
  if (warn.dataset.k !== wk){ warn.dataset.k = wk; warn.innerHTML = H.calWarnHtml(HU, old); }
}
function paintFits(S, C, W){
  const fits = W.q('.gci-cal-fits');
  fits.innerHTML = H.calFitsHtml(HU, S.gasOf, Object.keys(S.GAS), C.p, C.cal.zero);
  Object.keys(S.GAS).forEach(g=> drawCalGas(S, C, g, fits.querySelector(`.gci-cal-gas[data-g="${g}"]`)));
}
function drawCalGas(S, C, g, box){
  const G = M.calGasOf(U, S, C, g), stats = box.querySelector('.gci-cal-stats'), svg = box.querySelector('svg.plot');
  const P = new Plot(svg, { xlabel: `${S.gasOf(g).txt} (${C.cal.unit})`, ylabel: 'Area' });
  if (G.pts.length){
    P.setRange(0, G.xmax*1.08, G.ylo, G.ymax*1.08);
    P.drawAxes(); P.clearData();
    if (G.L) P.line([0, G.xmax*1.08], [G.L.intercept, G.L.slope*G.xmax*1.08 + G.L.intercept], M.C_MODEL, 1.3, undefined, { label: 'fit', key: 'fit' });
    P.points(G.xs, G.ys, S.gasOf(g).color, 3.5, { fill: true, label: 'standards', key: 'standards' });
  }
  P.attachTools(svg.closest('.plot-wrap'));
  stats.innerHTML = H.calStatsHtml(HU, S.gasOf, g, G, C.cal.unit, C.cal.zero[g]);
}
