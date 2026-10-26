import { esc, buildAlertsHtml, includedOf, setIncluded, removeFileAt, moveFileTo, renderUnifiedFileList, setTabLoaded, setupDropzone, registerHistory, registerTabRedraw, registerCsvExport, csvLine, nextColor, colorOf } from './utils.js';
import { createDeck } from './cards.js';
import { decodeText } from './textdata.js';

/* =========================================================
   MODULE KIT
   What an analysis module (DRS, GC, EPR) is built on, once for all of them:
   - its files: `all`, every file loaded, in list order, and `files`, the included ones,
     which the analysis sees (utils: INCLUDED FILES). Both arrays stay the same objects,
     changed in place, so a module names them once;
   - the file list and its steps (remove, move, include, label, colour, palette, remove
     all), the per-sample arrays (`slots`) kept aligned with the included files;
   - the alerts under the drop zone, each dismissed by its button;
   - text files dropped, decoded and read (textdata.js), and those not readable or
     already loaded said;
   - the undo history: every file's record and the module's own state;
   - the cards (cards.js), the tab's redraw, the CSV export.
   o: {
     alerts(parts)     draws the alerts: parts.invalid, parts.upload and o.parts, each
                       markup or ''
     parts             the module's other alerts, by name
     dismiss           { part: fn } what a part's dismiss button does instead of emptying it
     slots()           the per-sample arrays (utils: INCLUDED FILES)
     listed(op)        the list changed ('remove', 'reorder', 'include', 'palette',
                       'clear'), before refresh: what the module does first
     refresh()         the files changed: the module draws again (it calls showFiles
                       first, and commits)
     redraw(what)      a file's 'label', 'color' or 'note' (noteChange) changed: what is
                       drawn again
     note(f, i)        the file list's note on a file, in the column right of its label
                       (utils renderUnifiedFileList), markup; none: the column left empty
                       (to v501 `cols`, columns of the module's own, a lead one left of
                       the label)
     noteHead          that column's header, plain text (GC: SAMPLE); none: no header
     noteChange(i, v, again)  a select in a file's note changed (GC's Sample): file
                       all[i], `v` its value; the module takes it, then the list is drawn
                       again (the other rows' choices may follow) and redraw('note'), a step
                       of the history. `again`: the same select made the choice before and
                       has kept the focus since (a walk through its options, the arrow keys'
                       each a choice): the module takes it as that walk's first choice
                       changed, from where the walk began
     cleared()         every file removed: the module empties what it keeps per sample
     snapshot()        the module's own state, beside its files
     file(f)           a file's record as a restore reads it (a project read in may hold
                       anything: RESTORED, below): what it holds taken only as what it
                       should be, or null when it holds nothing to show (left out)
     restore(s, gone)  the module's own state put back (its files are in place); `gone`
                       the places among the included of the files left out, whose entries
                       its per-sample arrays drop (without)
     redrawTab()       the tab shown or resized
     csv()             the CSV export's files, [{ name, text }]
     root, key, layer  its instance's (utils.js registerModule): its section, where its
                       elements are found (root-scoped, whether or not it is in the page),
                       the key its registries go by, and its layer (the deck's menu goes
                       there)
   }
   kit.destroy() lets the kit go with its instance: its deck. */
export function moduleKit(mod, o){
  const { root, key } = o;
  const all = [], files = [], $ = id => root.querySelector('#' + id);
  const parts = Object.fromEntries(['invalid', 'upload', ...(o.parts || [])].map(k=> [k, '']));
  const slots = ()=> o.slots ? o.slots() : [];
  const kit = { all, files, alerts: parts };

  /* ---- Alerts: each dismiss button (data-action "<mod>-dismiss-<part>") empties its part,
     or does what o.dismiss says. ---- */
  const pre = mod + '-dismiss-';
  kit.drawAlerts = ()=> o.alerts(parts);
  const clearAlerts = ()=>{ for (const k in parts) parts[k] = ''; };
  root.addEventListener('click', e=>{
    const btn = e.target.closest('[data-action]'), act = btn && root.contains(btn) ? btn.dataset.action : '';
    if (!act.startsWith(pre)) return;
    const part = act.slice(pre.length);
    if (o.dismiss && o.dismiss[part]) o.dismiss[part](); else parts[part] = '';
    kit.drawAlerts();
  });
  // A drop's files that could not be read, and those already loaded (by name).
  kit.said = (bad, dup)=>{
    parts.invalid = bad.length ? buildAlertsHtml(bad.map(esc), [], undefined, pre + 'invalid') : '';
    parts.upload = dup.length ? buildAlertsHtml([], dup.map(esc), 'Already loaded file(s):', '', pre + 'upload') : '';
  };

  /* ---- The file list. With no file left, the alert of the files that could not be read
     goes with them. ---- */
  const changed = op =>{ if (o.listed) o.listed(op); o.refresh(); };
  const cb = {
    onRemove(i){ removeFileAt(all, i, slots()); if (!all.length) parts.invalid = ''; changed('remove'); },
    onReorder(from, to){ moveFileTo(all, from, to, slots()); changed('reorder'); },
    onInclude(i, on){ setIncluded(all, i, on, slots()); changed('include'); },
    onIncludeAll(on){ all.forEach((_, j)=> setIncluded(all, j, on, slots())); changed('include'); },
    onLabelChange(i, v){ all[i].label = v; o.redraw('label'); kit.commit(); },
    onColorChange(i, v){ all[i].color = v; o.redraw('color'); kit.commit(); },
    onPaletteChange(colors){ all.forEach((f, i)=>{ f.color = colors[i % colors.length]; }); changed('palette'); },
    onRemoveAll(){ all.length = 0; clearAlerts(); if (o.cleared) o.cleared(); changed('clear'); },
  };
  // The files changed: the included ones taken again, the list and the alerts drawn. Until
  // then `files` holds the ones included before the change.
  kit.showFiles = ()=>{
    files.splice(0, files.length, ...includedOf(all));
    setTabLoaded(key, all.length);
    renderUnifiedFileList($(mod + 'FileTableWrap'), all, cb, o.note, o.noteHead);
    kit.drawAlerts();
  };
  /* (on the list's box, which stays: the list inside is drawn anew at each change, its
     select given the focus back, which an arrow key changes at once.) `walk`, the select
     given the focus back, until it loses it: a change of its own goes on its walk (a
     change from elsewhere, or after the focus left, is a choice of its own). */
  if (o.noteChange){
    const box = $(mod + 'FileTableWrap');
    let walk = null;
    box.addEventListener('change', e=>{
      const sel = e.target.closest('td.note-cell select[data-i]'), i = sel ? +sel.dataset.i : -1;
      if (!all[i]) return;
      const had = document.activeElement === sel, again = sel === walk;
      walk = null;
      o.noteChange(i, sel.value, again);
      kit.showFiles(); o.redraw('note'); kit.commit();
      const s = had && box.querySelector(`td.note-cell select[data-i="${i}"]`);
      if (s){ s.focus(); walk = s; }
    });
    box.addEventListener('focusout', e=>{ if (e.target === walk) walk = null; });
  }
  // A file read: last in the list and among the included, with its entry in every
  // per-sample array.
  kit.add = f =>{ all.push(f); files.push(f); slots().forEach(s=> s.arr.push(s.make(undefined, f))); };
  /* Text files dropped on the module: each decoded (textdata.js) and read by `read(text)`,
     which gives what the file holds, or null when it cannot, or { error } saying why (a
     reader that throws leaves out that file, not the rest of the drop). A name already
     loaded is not loaded again. Each record is { name, label, ...what it holds, color,
     rawBytes } (the file as it came, for its download); then `done(had)`, `had` the files
     there were. */
  kit.dropText = (read, done)=> setupDropzone($(mod + 'Dropzone'), $(mod + 'Files'), async list=>{
    const had = all.length, names = new Set(all.map(f=> f.name)), bad = [], dup = [];
    for (const f of list){
      if (names.has(f.name)){ dup.push(f.name); continue; }
      names.add(f.name);
      const rawBytes = new Uint8Array(await f.arrayBuffer());
      let data = null;
      try { data = read(decodeText(rawBytes)); } catch(e){ data = null; }
      if (!data || data.error){ bad.push(data ? `${f.name} (${data.error})` : f.name); continue; }
      kit.add({ name: f.name, label: f.name.replace(/\.[^.]+$/, ''), ...data, color: nextColor(all), rawBytes });
    }
    kit.said(bad, dup);
    done(had);
  });

  /* ---- The undo history: every file's record (its data shared, not copied) and the
     module's own state. A state restored puts its files in place, has the module put its
     own back and draw all again, and leaves no alert of an upload: those belong to the
     upload, not to the state (nor to another tab's). A project read in may hold anything:
     the state, its files and each file's record are taken as RESTORED says, a file with
     nothing to show left out with its entries in the per-sample arrays (`gone`), and an
     alert says how many (to v494 a state or a list of files that was no object or array
     threw, and the tab opened empty). ---- */
  const keptFile = (f, i)=>{
    if (!isObj(f)) return null;
    const name = typeof f.name === 'string' && f.name ? f.name : `file ${i + 1}`;
    const g = { ...f, name, label: typeof f.label === 'string' ? f.label : name.replace(/\.[^.]+$/, ''), color: typeof f.color === 'string' ? f.color : colorOf(i) };
    if (f.included !== false){ delete g.included; delete g.held; }
    else if (!isObj(g.held)) g.held = {};
    try { return o.file ? o.file(g) : g; } catch(e){ return null; }
  };
  const hist = registerHistory(key, ()=> ({ files: all.map(f=> ({ ...f })), ...o.snapshot() }), s0=>{
    const s = isObj(s0) ? s0 : {}, raw = Array.isArray(s.files) ? s.files : [], kept = raw.map(keptFile), gone = new Set();
    // (an entry that is no file counts as included: it holds no included:false)
    raw.reduce((j, f, i)=>{ if (isObj(f) && f.included === false) return j; if (!kept[i]) gone.add(j); return j + 1; }, 0);
    all.splice(0, all.length, ...kept.filter(Boolean));
    files.splice(0, files.length, ...includedOf(all));
    o.restore(s, gone);
    o.refresh();
    clearAlerts();
    const lost = raw.length - all.length;
    if (lost) parts.invalid = buildAlertsHtml([], [`${lost} file${lost > 1 ? 's' : ''} in the project with no data to show: left out.`], 'Restored, with a caveat:', '', pre + 'invalid');
    kit.drawAlerts();
  });
  kit.commit = ()=> hist.commit();
  // The cards, in the module's list above its "+" bar; each change a step of the history.
  let deck = null;
  kit.deck = d => (deck = createDeck({ list: $(mod + 'Analyses'), addBar: $(mod + 'AddBar'), addBtn: $(mod + 'AddAn'), commit: kit.commit, layer: o.layer, ...d }));
  if (o.redrawTab) registerTabRedraw(key, o.redrawTab);
  if (o.csv) registerCsvExport(key, o.csv);
  kit.destroy = ()=>{ if (deck) deck.destroy(); };
  return kit;
}

/* ---- RESTORED: a project read in may hold anything (an imported .json), so a restore
   takes what it reads only as what it should be — an object where one is due, arrays
   where arrays are, numbers through Number.isFinite (a string of digits is none), dates
   valid ones, a choice one of its own, an id a whole number in range — and anything else
   as its default. ---- */
export const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
export const isArr = v => Array.isArray(v) || (ArrayBuffer.isView(v) && !(v instanceof DataView));
// A finite number `ok` takes, or the default.
export const num = (v, d, ok = ()=> true)=> Number.isFinite(v) && ok(v) ? v : d;
// A number as an older state may hold it, in a string too (a field's value: '12').
export const numStr = v => typeof v === 'string' && v.trim() ? +v : v;
// One of `opts`, or the first.
export const oneOf = (v, opts)=> opts.includes(v) ? v : opts[0];
// A key of `o`'s own: 'constructor', 'toString' and the like are none.
export const ownKey = (o, k)=> typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
// A date that is one (a Date, or its time in ms), or null.
export const dateOf = v =>{ const d = v instanceof Date ? v : Number.isFinite(v) ? new Date(v) : null; return d && Number.isFinite(d.getTime()) ? d : null; };
// An array of `n` entries, each `item(v, i)` from the array's own (none: undefined).
export const arrOf = (v, n, item)=> Array.from({ length: n }, (_, i)=> item(Array.isArray(v) ? v[i] : undefined, i));
// A per-sample array without the entries of the files a restore left out (their places).
export const without = (a, gone)=> Array.isArray(a) && gone && gone.size ? a.filter((_, i)=> !gone.has(i)) : a;
/* The cards of a state: objects of a kind the module has (none named: its first), or null;
   an id that is no whole number from 1 to 99999 taken off, for the deck to give one (an
   id of 1e308 is an integer, which made element ids no selector reads, and the next id
   the same). */
export const cardList = (v, kinds)=> Array.isArray(v) ? v.filter(c=> isObj(c) && (c.type == null || ownKey(kinds, c.type)))
  .map(c=> Number.isInteger(c.id) && c.id >= 1 && c.id < 1e5 ? c : (({ id, ...r })=> r)(c)) : null;
/* Two arrays of numbers point by point (an x and its y): the same arrays when every point
   is two finite numbers `ok` takes, else those that are, in arrays of their own; null when
   they are not arrays. */
export function finitePairs(xs, ys, ok = ()=> true){
  if (!isArr(xs) || !isArr(ys)) return null;
  const n = Math.min(xs.length, ys.length), good = i => Number.isFinite(xs[i]) && Number.isFinite(ys[i]) && ok(xs[i], ys[i]);
  let all = xs.length === ys.length;
  for (let i = 0; all && i < n; i++) all = good(i);
  if (all) return [xs, ys];
  const x = [], y = [];
  for (let i = 0; i < n; i++) if (good(i)){ x.push(xs[i]); y.push(ys[i]); }
  return [x, y];
}

/* A "wide" CSV: each column { h: header, v: [values] } beside the others, padded to the
   longest, so that every sample keeps its own columns (no axis shared). */
export function wideCsv(cols){
  const n = Math.max(0, ...cols.map(c=> c.v.length));
  let t = csvLine(cols.map(c=> c.h));
  for (let i = 0; i < n; i++) t += csvLine(cols.map(c=> i < c.v.length ? c.v[i] : ''));
  return t;
}
