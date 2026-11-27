import { esc, registerModule, keeper, objId, exactKey, colorOf, isColor, csvNum, flashFieldInvalid, boxStats, meanArr, stdArr, barNames, X_SVG, removeFileAt } from './utils.js';
import { Plot } from './plot.js';
import { cardInfo, fileSafe, nameDownloads } from './cards.js';
import { moduleKit, wideCsv, isObj, ownKey, cardList } from './modkit.js';
import { plotWrap, viewOf, setView, valueBars } from './modcharts.js';
import { snavHtml, snav } from './snav.js';
import * as M from './fig-model.js';
import * as H from './fig-html.js';

/* =========================================================
   CUSTOM MODULE (v527; named Figure to v530: its key, 'fig', and its projects' kept)

   Plots of the user's own tables: CSV and text files of columns, read as DRS and GC read
   theirs (textdata.js: the encoding, the separator, the decimal mark, the quotes and the
   header found from the file). The Data card shows one file's head, the header and its
   first rows, a role over each column (x, y, its errors, or none) as Origin gives them;
   each y is a series, with the x before it and its errors. The Plot cards (cards.js),
   none at first, each an XY plot, a bar chart or a box plot of series of any files, its
   normalisation, each series' scale (and an XY plot's offset), and the plot's figure
   composed (figure.js) kept with the card in the project.
   v529: the Data card as the other modules' analysis cards (the file's arrows, the head on
   the left, the series' names and the roles' box on the right); a file's line of series'
   titles giving its first roles and its names; the Plot cards' series picked in a window
   (Add series), one normalisation a plot (none, local, global) for the per-series one, no
   crop in x.
   v531: the Data card's table whole, in a box of a Plot card's chart's size scrolling both
   ways, under a line of the series' names over their columns; the roles' box on the
   file's line; the lists of series scrolling in their boxes, beside the table or the plot
   from its top to its foot (+ Add series under its list, its bottom on the plot's); a
   series' scale and offset beside its name.
   v532: the trace list (the file list to v531) a row a series, its trace: named as the
   series (one name, the Data card's and the list's), its File the CSV it comes from;
   included, left out and moved there, which the Add series window follows. A file with no
   series has a row of its own (its name), for it to be removed.
   v534: the series' colours back in the trace list (a swatch each, the palette), the plots
   drawing each series in its trace's colour (to v533 by its place in the plot); the Data
   card's list of series gone, the table across the card (as tall as a Plot card's chart)
   and the series named in place in its line over their columns.

   MADE PER TAB, as every module (utils.js registerModule): createFig is the module's
   factory, each open Custom tab that is awake an instance of its own, made of its copy of
   index.html's section (root) and a layer (the kinds' menu). Its elements are found in
   root, a card's in its card, never in the page. It draws only on show, and its redraw
   draws all as it is shown; a tab shown again with nothing changed and at the same width
   draws nothing (its draw key). It has no job that runs on while hidden.

   SPLIT (v562): what it works out that touches no page (a file's table and its roles, the
   series and what they plot, a file and a card as a project holds them, the trace list's
   rows and changes, the plots' series, ranges, bars, boxes and CSVs) in fig-model.js, its
   words and markup in fig-html.js, both tested in Node. Here the page: the instance's
   state (S), the Data card, the Plot cards, the Add series window and their listeners.
   Each is a function at module level of S, not a closure inside createFig (to v561 one of
   552 lines): what a listener holds is what it is handed.
========================================================= */
/* utils.js's and modkit.js's helpers, which need a page to load, as the calculations and the
   markup take them (fig-model.js U, fig-html.js u). A series' values are kept by its column
   (utils.js keeper: fig-model.js dataOf). */
const U = { isObj, ownKey, isColor, colorOf, objId, exactKey, dataKept: keeper('fig-series', 8), csvNum, boxStats, meanArr, stdArr, barNames };
const HU = { esc, X_SVG, plotWrap };
const FIG_INFO = H.figInfo(cardInfo(true, false));
const P = H.P;

/* =========================================================
   THE INSTANCE: its state S, which every function below takes:
     key, root, layer, shown, $  its context (utils.js makeInstance: shown() whether its tab
                          is on show) and its elements by id, in root
     stale, drawnAt       hidden, nothing is drawn: `stale` marks it to be drawn whole as it
                          is shown, `drawnAt` the width it was last drawn whole at (its draw key)
     kit, allFiles        the module (modkit.js) and every file loaded, in list order, { name,
                          label, color, rawBytes, roles (a role a column), names (the series'
                          names typed, by column), colors, out }
     same                 the roles of the file on show go to every file
     shownName, fileNext  the file the Data card shows (and a wake's: showNext)
     order                the trace list's order, by the series' keys (fig-model.js tracesOf)
     fileNav              the Data card's file selector (snav.js)
     pick, pickBody       the Add series window, its files' box
     pickFor, pickFrom    the card it is open for, the element focused before it
     onPickKey            its Escape (a document listener while it is open)
     deck                 the Plot cards (cards.js)
========================================================= */
// A Custom tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }).
function createFig(ctx){
  const S = makeState(ctx);
  S.kit = moduleKit('fig', kitHooks(S));
  S.allFiles = S.kit.all;
  wireDrop(S);
  wireData(S);
  wirePick(S);
  S.deck = S.kit.deck(deckHooks(S));
  // A new project starts with no plot: + adds one, of the kind chosen.
  S.deck.start([]);
  return apiOf(S);
}
function makeState({ key, root, layer, shown }){
  const $ = id => root.querySelector('#' + id);
  // The file selector of the Data card (snav.js), its markup first: found by its ids after.
  $('figFileNav').innerHTML = snavHtml({ prev: 'figFilePrev', idx: 'figFileIdx', next: 'figFileNext', name: 'figFileName', what: 'file', keys: false });
  const S = { key, root, layer, shown, $, stale: false, drawnAt: '', same: false, shownName: null, fileNext: null, order: [],
    kit: null, allFiles: null, fileNav: null, pick: null, pickBody: null, pickFor: null, pickFrom: null, deck: null };
  S.onPickKey = e => onPickKey(S, e);
  return S;
}
// What the module kit is given (modkit.js o).
function kitHooks(S){
  return {
    root: S.root, key: S.key, layer: S.layer,
    traces: cb => traceList(S, cb),
    alerts: p =>{ S.$('figAlerts').innerHTML = p.invalid + p.upload; },
    refresh: ()=> afterFilesChange(S),
    // A label or a colour changed: the Data card's list and the series' files say it anew.
    redraw: ()=>{ renderData(S); S.deck.records.forEach(a=> paintPanel(S, a)); updateAll(S, true); },
    cleared: ()=>{ S.shownName = null; S.order = []; },
    snapshot: ()=> M.stateOf(S.same, S.order, S.deck.records, S.deck.saved),
    // A file as a restore takes it (fig-model.js fileIn).
    file: f => M.fileIn(U, f),
    restore: s => restore(S, s),
    redrawTab: ()=> redrawTab(S),
    // One CSV a plot with series, named after it: what it plots.
    csv: ()=> S.deck.records.map(a=> ({ a, text: cardCsv(S, a) })).filter(c=> c.text).map(({ a, text })=> ({ name: `${fileSafe(a.name)} - fig_plot.csv`, text })),
  };
}
// What the deck is given (cards.js o).
function deckHooks(S){
  return {
    kinds: M.KINDS, title: '', info: ()=> FIG_INFO, body: a => H.cardBody(a, HU), make: ()=> ({ series: [], norm: 'none', fig: null }),
    build: (a, card)=> buildCard(S, a, card), drop: ()=>{}, autoName: a=> `Plot ${a.id}`, named: a => named(S, a),
    added: a=> drawCard(S, a),
    switched: a=>{ paintPanel(S, a); drawCard(S, a); },
    wake: a=> drawCard(S, a, true),
  };
}
// What it gives utils.js and tabs.js.
function apiOf(S){
  return {
    // The file the Data card shows: kept as the tab sleeps and in its record (tabs.js).
    shows(){ return M.showsOf(S.allFiles, S.shownName); },
    showNext(v){ S.fileNext = M.showNextIn(U, v); },
    destroy(){ closePick(S, false); S.pick.remove(); S.kit.destroy(); },
  };
}
// (its tab not on show: not drawn, drawn whole as it is shown)
const drawable = S => S.shown() || !(S.stale = true);
function restore(S, s){
  S.same = s.same === true;
  S.order = M.orderIn(s.order);
  if (S.fileNext){ if (S.allFiles.some(f=> f.name === S.fileNext)) S.shownName = S.fileNext; S.fileNext = null; }
  S.deck.load(cardList(s.cards, M.KINDS) || [], c=> M.cardIn(U, c), a=> paintPanel(S, a));
}
function redrawTab(S){
  const at = String(S.root.clientWidth);
  if (!S.stale && at === S.drawnAt) return;
  S.stale = false; S.drawnAt = at;
  if (S.allFiles.length){ S.deck.fitNames(); updateAll(S, true); }
}

/* ---- The files ---- */
// Files dropped: each read as a table (textdata.js), its roles its titles' or the
// defaults (firstRoles), or the file on show's with `same`; the table kept by the file's bytes.
function wireDrop(S){
  S.kit.dropText(text =>{
    const t = M.readTableText(text);
    return t ? { roles: M.firstRoles(t), names: {}, table: t } : { error: 'no column of numbers found' };
  }, had =>{
    S.allFiles.slice(had).forEach(f=> M.keepTable(f));
    const src = shownFile(S);
    if (S.same && src) M.giveRoles(S.allFiles.slice(had), src);
    afterFilesChange(S);
  });
}
function afterFilesChange(S){
  S.kit.showFiles();
  S.$('figAnalyses').style.display = S.allFiles.length ? 'block' : 'none';
  M.pruneCards(S.allFiles, S.deck.records);
  renderData(S);
  S.deck.records.forEach(a=> paintPanel(S, a));
  updateAll(S);
  S.kit.commit();
}
// The series (fig-model.js seriesOfFile), the trace list's (tracesOf), those included (seriesMapOf).
const traces = S => M.tracesOf(U, S.allFiles, S.order);
const seriesMap = S => M.seriesMapOf(traces(S));
// The trace list (modkit.js o.traces): its rows, and the kit's callbacks (cb) with its own.
function traceList(S, cb){
  const ts = traces(S);
  const rows = M.traceRows(ts);
  return { rows, cb: { ...cb, ...traceCb(S, ts, cb) } };
}
function traceCb(S, ts, cb){
  return {
    onInclude(i, on){ if (ts[i]){ M.setOut(ts[i], on); afterFilesChange(S); } },
    onIncludeAll(on){ ts.forEach(t=> M.setOut(t, on)); afterFilesChange(S); },
    // A series' colour picked, or the palette's given to all in the list's order: the
    // plots' lines, bars and boxes, and their legends, follow (a step).
    onColorChange(i, c){ const t = ts[i]; if (t && t.s && isColor(c)){ M.setColor(t, c); repaint(S); } },
    onPaletteChange(colors){
      const cs = colors.filter(isColor);
      if (!cs.length) return;
      M.setPalette(ts, cs);
      repaint(S);
    },
    onReorder(from, to){ S.order = M.reordered(ts, from, to); afterFilesChange(S); },
    // (a series renamed as in the Data card: empty, or as its header names it, back to that name)
    onLabelChange(i, v){
      const t = ts[i];
      if (!t) return;
      if (!t.s){ t.f.label = v; afterFilesChange(S); return; }
      rename(S, t.f, t.s.col, v, t.s.def);
    },
    onRemove: i => removeTrace(S, ts[i], cb),
  };
}
/* A trace removed: its column, and its error's, no longer used (the Data card's roles,
   —); its file's last, or a file of none, the file removed. */
function removeTrace(S, t, cb){
  if (!t) return;
  if (M.whole(t)){ removeFileAt(S.allFiles, S.allFiles.indexOf(t.f), []); if (!S.allFiles.length) cb.onRemoveAll(); else afterFilesChange(S); return; }
  M.dropSeries(t);
  afterFilesChange(S);
}
/* A series renamed, in the trace list or in place over its columns in the Data card (one
   name). From the Data card (`inPlace`) its fields there take the name and the head is
   not drawn anew, so the focus, gone on to another field, stays there. */
function rename(S, f, col, v0, def, inPlace){
  const { v, names } = M.namesWith(f.names, col, v0, def);
  f.names = names;
  if (inPlace) S.$('figHead').querySelectorAll(`thead input[data-col="${col}"]`).forEach(inp=>{ inp.value = v || def; });
  S.kit.showFiles();
  if (!inPlace) renderData(S);
  S.deck.records.forEach(a=> paintPanel(S, a));
  updateAll(S, true);
  S.kit.commit();
}
// The colours changed: the list, the plots and their legends drawn again, a step.
function repaint(S){
  S.kit.showFiles();
  S.deck.records.forEach(a=> paintPanel(S, a));
  updateAll(S, true);
  S.kit.commit();
}

/* ---- The Data card: the file on show (its arrows, as the other modules' samples: a view,
   no step of the history), the roles of all files alike on its line, and the file's
   table across the card, a role over each column and its series' names over them
   (fig-html.js headHtml, nameCells) ---- */
const shownFile = S => M.shownFileOf(S.allFiles, S.shownName);
function renderData(S){
  const card = S.$('figDataCard');
  card.style.display = S.allFiles.length ? '' : 'none';
  const f = shownFile(S);
  if (!f) return;
  S.shownName = f.name;
  const fi = S.allFiles.indexOf(f), t = M.tableOf(f);
  S.fileNav.update();
  S.$('figSame').checked = S.same;
  const ss = M.seriesOfFile(U, S.allFiles, f, fi);
  paintTable(S, t, H.headHtml(ss, f.roles, t, HU));
  S.$('figWarn').innerHTML = H.warnHtml(M.shortOf(S.allFiles, f, t, S.same), f, t, HU);
}
// The head: the series' names over their columns, the roles, the header. The rows, all
// of them, built once a file shown (its table's), its scroll kept while it stays.
function paintTable(S, t, head){
  const box = S.$('figHead');
  if (box._t === t && box.querySelector('thead')) box.querySelector('thead').innerHTML = head;
  else {
    box._t = t;
    box.innerHTML = H.tableHtml(t, head, HU);
    box.scrollTop = 0; box.scrollLeft = 0;
  }
}
// The roles changed: given to every file (same), the plots' series that are gone let go.
function rolesChanged(S){
  const src = shownFile(S);
  if (S.same && src) M.giveRoles(S.allFiles, src);
  M.pruneCards(S.allFiles, S.deck.records);
  S.kit.showFiles();
  renderData(S);
  S.deck.records.forEach(a=> paintPanel(S, a));
  updateAll(S, true);
  S.kit.commit();
}
// (the file on show: a view, no step)
function stepFile(S, d){ const n = S.allFiles.length, f = shownFile(S); if (n && f){ S.shownName = S.allFiles[(S.allFiles.indexOf(f) + d + n) % n].name; renderData(S); } }
const shownAt = S => Math.max(0, S.allFiles.indexOf(shownFile(S)));
function wireData(S){
  S.$('figFilePrev').addEventListener('click', ()=> stepFile(S, -1));
  S.$('figFileNext').addEventListener('click', ()=> stepFile(S, 1));
  // (its list: any file, straight)
  S.fileNav = snav(S.$('figFileNav').querySelector('.snav'), { count: ()=> S.allFiles.length, index: ()=> shownAt(S),
    label: i=> S.allFiles[i].label, title: i=> S.allFiles[i].name, go: i=> stepFile(S, i - shownAt(S)) });
  S.$('figSame').addEventListener('change', e=>{ S.same = e.target.checked; rolesChanged(S); });
  S.$('figHead').addEventListener('change', e=> onRole(S, e));
  /* A series renamed over its columns, taken as the field is left (or on Enter): empty, or
     as its header names it, it goes back to that name; Escape puts back the one it had. */
  S.$('figHead').addEventListener('focusin', e=>{ if (e.target.matches('input[data-col]')) e.target.dataset.was = e.target.value; });
  S.$('figHead').addEventListener('change', e=> onNameIn(S, e));
  S.$('figHead').addEventListener('keydown', onNameKey);
}
function onRole(S, e){
  const sel = e.target.closest('select[data-col]'), f = shownFile(S);
  if (!sel || !f || !ownKey(M.ROLES, sel.value)) return;
  f.roles = M.setRole(f.roles, +sel.dataset.col, sel.value);
  rolesChanged(S);
}
function onNameIn(S, e){
  const inp = e.target.closest('input[data-col]'), f = shownFile(S);
  if (!inp || !f || inp.value === inp.dataset.was) return;
  inp.dataset.was = inp.value;
  rename(S, f, +inp.dataset.col, inp.value, inp.placeholder, true);
}
function onNameKey(e){
  const inp = e.target.closest('input[data-col]');
  if (!inp) return;
  if (e.key === 'Enter'){ e.preventDefault(); inp.blur(); }
  else if (e.key === 'Escape' && inp.dataset.was != null){ e.preventDefault(); e.stopPropagation(); inp.value = inp.dataset.was; inp.blur(); }
}

/* ---- The Plot cards (cards.js): each its kind, its series (by file and column, each with
   its scale and offset), its normalisation and its figure ---- */
// The card's normalisation and list of series (drawn whether or not on show).
function paintPanel(S, a, card = S.deck.cardOf(a)){
  if (!card) return;
  const list = M.plotted(a, seriesMap(S)), ops = M.OPS[a.type];
  card.querySelector('#' + P(a) + 'Norm').value = a.norm;
  card.querySelector('#' + P(a) + 'Add').disabled = !seriesMap(S).size;
  card.querySelector('#' + P(a) + 'List').innerHTML = H.serListHtml(a, list, ops, HU);
}
function buildCard(S, a, card){
  const list = card.querySelector('#' + P(a) + 'List');
  card.querySelector('#' + P(a) + 'Add').addEventListener('click', ()=> openPick(S, a));
  card.querySelector('#' + P(a) + 'Norm').addEventListener('change', e=> onNorm(S, a, e));
  list.addEventListener('click', e=> onDel(S, a, e));
  list.addEventListener('change', e=> onOp(S, a, e));
  list.addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.matches('input[type="text"]')) e.target.blur(); });
  paintPanel(S, a, card);
}
function onNorm(S, a, e){
  if (!ownKey(M.NORMS, e.target.value) || e.target.value === a.norm) return;
  a.norm = e.target.value;
  drawCard(S, a); S.kit.commit();
}
// The series of a row of the card's list.
const refOf = (a, el)=>{ const row = el.closest('.fig-ser'); return row ? a.series.find(r=> M.keyOf(r.file, r.col) === row.dataset.key) : null; };
function onDel(S, a, e){
  const b = e.target.closest('[data-act="del"]'), r = b && refOf(a, b);
  if (!r) return;
  a.series = a.series.filter(x=> x !== r);
  paintPanel(S, a); drawCard(S, a); S.kit.commit();
}
// An operation taken as it is confirmed: a number; else the field shakes and shows the
// record's value again (fig-model.js opIn).
function onOp(S, a, e){
  const el = e.target.closest('[data-op]'), r = el && refOf(a, el);
  if (!r) return;
  const k = el.dataset.op, v = M.opIn(el.value.trim());
  if (v === null){ flashFieldInvalid(el); el.value = String(r[k]); return; }
  el.value = String(v);
  if (Object.is(r[k], v)) return;
  a.series = a.series.map(x=> x === r ? { ...r, [k]: v } : x);
  drawCard(S, a); S.kit.commit();
}
function named(S, a){
  const card = S.deck.cardOf(a);
  if (card) nameDownloads(card.querySelector('.plot-wrap'), `${fileSafe(a.name)}.svg`, `${fileSafe(a.name)} - fig_plot.csv`);
}

/* ---- Add series: a window of the series of every file included, by file, those of the
   plot ticked; a file's box ticks or clears all its own, and shows a square when some
   are ticked. Done gives the plot those ticked (the ones it had in their places, the new
   after them in the list's order: fig-model.js pickedSeries), a step; Cancel, Escape or a
   click outside, nothing. ---- */
function wirePick(S){
  const pick = S.pick = document.createElement('div');
  pick.className = 'modal-backdrop fig-pick';
  pick.style.display = 'none';
  pick.innerHTML = H.PICK_HTML;
  S.layer.appendChild(pick);
  S.pickBody = pick.querySelector('.fig-pick-body');
  S.pickBody.addEventListener('change', e=>{
    const box = e.target.closest('.fig-pick-file');
    if (!box) return;
    if (e.target.matches('input[data-file]')) box.querySelectorAll('input[data-key]').forEach(c=>{ c.checked = e.target.checked; });
    syncPickFile(box);
  });
  pick.addEventListener('click', e=>{
    if (e.target === pick || e.target.closest('[data-cancel]')) closePick(S, false);
    else if (e.target.closest('[data-done]')) closePick(S, true);
  });
}
function openPick(S, a){
  if (S.pickFor) return;
  S.pickFor = a; S.pickFrom = document.activeElement;
  const on = new Set(a.series.map(r=> M.keyOf(r.file, r.col)));
  S.pick.querySelector('.fig-pick-for').textContent = H.pickFor(a.name);
  // (by file, in the order of the trace list, a file where its first series is)
  S.pickBody.innerHTML = H.pickBodyHtml(M.pickGroups(seriesMap(S)), on, HU);
  S.pickBody.querySelectorAll('.fig-pick-file').forEach(syncPickFile);
  S.pick.style.display = 'flex';
  document.addEventListener('keydown', S.onPickKey, true);
  S.pick.querySelector('.modal-box').focus();
}
// A file's box: ticked with all its series, empty with none, the square with some.
function syncPickFile(box){
  const ss = [...box.querySelectorAll('input[data-key]')], n = ss.filter(c=> c.checked).length, all = box.querySelector('input[data-file]');
  all.checked = n === ss.length;
  all.indeterminate = n > 0 && n < ss.length;
}
function closePick(S, done){
  const a = S.pickFor;
  if (!a) return;
  S.pickFor = null;
  S.pick.style.display = 'none';
  document.removeEventListener('keydown', S.onPickKey, true);
  if (S.pickFrom && S.pickFrom.isConnected) S.pickFrom.focus();
  S.pickFrom = null;
  if (!done || !S.deck.records.includes(a)) return;
  const boxes = ()=> [...S.pickBody.querySelectorAll('input[data-key]')];
  const want = boxes().filter(c=> c.checked).map(c=> c.dataset.key), listed = new Set(boxes().map(c=> c.dataset.key));
  const next = M.pickedSeries(a.series, want, listed, seriesMap(S));
  if (!next) return;
  a.series = next;
  paintPanel(S, a); drawCard(S, a); S.kit.commit();
}
function onPickKey(S, e){ if (e.key === 'Escape' && S.pick.isConnected){ e.stopPropagation(); closePick(S, false); } }

/* ---- The plots ---- */
// Every card unfolded drawn; a folded one as it comes back (wake).
function updateAll(S, preserveView){
  S.deck.records.forEach(a=>{ if (!S.deck.isFolded(a)) drawCard(S, a, preserveView); });
  if (S.shown()){ S.stale = false; S.drawnAt = String(S.root.clientWidth); }
}
// (its tab not on show: not drawn, drawn whole as it is shown)
function drawCard(S, a, preserveView){
  const card = S.deck.cardOf(a);
  if (!card || !drawable(S)) return;
  const list = M.plotted(a, seriesMap(S)), svg = card.querySelector('#' + P(a) + 'Svg'), legend = card.querySelector('#' + P(a) + 'Legend');
  card.querySelector('#' + P(a) + 'Empty').style.display = list.length ? 'none' : '';
  svg.closest('.plot-wrap').style.display = list.length ? '' : 'none';
  if (!list.length){ legend.innerHTML = ''; return; }
  const prev = preserveView ? viewOf(svg._plot) : null;
  const divs = M.divsOf(U, a.type, a.norm, list), data = list.map((e, k)=> M.dataOf(U, a.type, e.s.t, e.s, e.r, divs[k]));
  if (a.type === 'xy') drawXY(svg, list, data, prev, a.norm);
  else if (a.type === 'bar') drawBars(svg, list, data, legend);
  else drawBoxes(svg, list, data);
  if (a.type !== 'bar') legend.innerHTML = H.legendHtml(a.type, list, HU);
  // The composer's figure kept with the card (figure.js recallKept): its closing a step.
  if (svg._plot) svg._plot.figure = {
    load: ()=> a.fig,
    save: snap =>{ if (JSON.stringify(snap) !== JSON.stringify(a.fig)){ a.fig = snap; S.kit.commit(); } },
  };
}
function drawXY(svg, list, data, prev, norm){
  const R = M.xyRange(data);
  const plot = new Plot(svg, { xlabel: M.xTitle(list), ylabel: M.yTitle(list) });
  plot.setRange(R.x0, R.x1, R.y0, R.y1);
  setView(plot, prev, M.viewKey(list, norm));
  plot.drawAxes();
  list.forEach((e, k)=>{
    const d = data[k], E = M.errBars(d);
    if (E.sx.length) plot.segments(E.sx, E.sy, e.color, 1, { label: e.name + ' (errors)', key: e.s.key + '\nerr' });
    plot.line(d.xs, d.ys, e.color, 1.5, undefined, { label: e.name, key: e.s.key });
  });
  plot.attachTools(svg.closest('.plot-wrap'));
}
// Bars (fig-model.js barsOf): a series a colour, side by side in each category.
function drawBars(svg, list, data, legend){
  valueBars(svg, { ...M.barsOf(list, data), yLabel: esc(M.yTitle(list)), legend });
}
// Boxes (fig-model.js boxStatsOf, boxLayout): their names measured in the plot's font.
function drawBoxes(svg, list, data){
  const st = M.boxStatsOf(U, data);
  const mctx = document.createElement('canvas').getContext('2d');
  mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  const L = M.boxLayout(U, list, st, mctx, svg.getBoundingClientRect());
  const plot = new Plot(svg, { xlabel: '', ylabel: M.yTitle(list), noXTickLabels: true, noXGrid: true, yGrid: true, margin: { l: 55, r: 20, t: 15, b: L.bottom } });
  plot.setRange(0, L.n + 1, L.y0, L.y1);
  plot.drawAxes();
  list.forEach((e, k)=>{
    const b = st[k];
    if (b){
      plot.box(k + 1, b, e.color, L.hw, 0, { label: e.name });
      plot.barLabel(k + 1, Math.max(b.hi, ...b.out), M.boxLabel(b), { gap: 6 });
    }
    plot.tickLabel(k + 1, L.fit.labels[k], L.fit.rot, e.name, e.s.key);
  });
  plot.attachTools(svg.closest('.plot-wrap'));
}
// A card's CSV: what it plots, a series' columns beside the others' ('' with none).
function cardCsv(S, a){
  const list = M.plotted(a, seriesMap(S));
  if (!list.length) return '';
  return wideCsv(M.csvCols(U, a, list));
}
registerModule('fig', createFig);
