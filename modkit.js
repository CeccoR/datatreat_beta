import { esc, buildAlertsHtml, includedOf, setIncluded, removeFileAt, moveFileTo, renderUnifiedFileList, setTabLoaded, setupDropzone, registerHistory, registerTabRedraw, registerCsvExport, csvLine, nextColor } from './utils.js';
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
     redraw(what)      a file's 'label' or 'color' changed: what is drawn again
     cleared()         every file removed: the module empties what it keeps per sample
     snapshot()        the module's own state, beside its files
     restore(s)        the module's own state put back (its files are in place)
     redrawTab()       the tab shown or resized
     csv()             the CSV export's files, [{ name, text }]
   } */
export function moduleKit(mod, o){
  const all = [], files = [], $ = id => document.getElementById(id);
  const parts = Object.fromEntries(['invalid', 'upload', ...(o.parts || [])].map(k=> [k, '']));
  const slots = ()=> o.slots ? o.slots() : [];
  const kit = { all, files, alerts: parts };

  /* ---- Alerts: each dismiss button (data-action "<mod>-dismiss-<part>") empties its part,
     or does what o.dismiss says. ---- */
  const tab = $('tab-' + mod), pre = mod + '-dismiss-';
  kit.drawAlerts = ()=> o.alerts(parts);
  const clearAlerts = ()=>{ for (const k in parts) parts[k] = ''; };
  tab.addEventListener('click', e=>{
    const btn = e.target.closest('[data-action]'), act = btn && tab.contains(btn) ? btn.dataset.action : '';
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
    setTabLoaded(mod, all.length);
    renderUnifiedFileList(mod + 'FileTableWrap', all, cb);
    kit.drawAlerts();
  };
  // A file read: last in the list and among the included, with its entry in every
  // per-sample array.
  kit.add = f =>{ all.push(f); files.push(f); slots().forEach(s=> s.arr.push(s.make(undefined, f))); };
  /* Text files dropped on the module: each decoded (textdata.js) and read by `read(text)`,
     which gives what the file holds, or null when it cannot (a reader that throws leaves
     out that file, not the rest of the drop). A name already loaded is not loaded again. Each
     record is { name, label, ...what it holds, color, rawBytes } (the file as it came, for
     its download); then `done(had)`, `had` the files there were. */
  kit.dropText = (read, done)=> setupDropzone(mod + 'Dropzone', mod + 'Files', async list=>{
    const had = all.length, names = new Set(all.map(f=> f.name)), bad = [], dup = [];
    for (const f of list){
      if (names.has(f.name)){ dup.push(f.name); continue; }
      names.add(f.name);
      const rawBytes = new Uint8Array(await f.arrayBuffer());
      let data = null;
      try { data = read(decodeText(rawBytes)); } catch(e){ data = null; }
      if (!data){ bad.push(f.name); continue; }
      kit.add({ name: f.name, label: f.name.replace(/\.[^.]+$/, ''), ...data, color: nextColor(all), rawBytes });
    }
    kit.said(bad, dup);
    done(had);
  });

  /* ---- The undo history: every file's record (its data shared, not copied) and the
     module's own state. A state restored puts its files in place, has the module put its
     own back and draw all again, and leaves no alert of an upload: those belong to the
     upload, not to the state (nor to another tab's). ---- */
  const hist = registerHistory(mod, ()=> ({ files: all.map(f=> ({ ...f })), ...o.snapshot() }), s=>{
    all.splice(0, all.length, ...s.files.map(f=> ({ ...f })));
    files.splice(0, files.length, ...includedOf(all));
    o.restore(s);
    o.refresh();
    clearAlerts(); kit.drawAlerts();
  });
  kit.commit = ()=> hist.commit();
  // The cards, in the module's list above its "+" bar; each change a step of the history.
  kit.deck = d => createDeck({ list: $(mod + 'Analyses'), addBar: $(mod + 'AddBar'), addBtn: $(mod + 'AddAn'), commit: kit.commit, ...d });
  if (o.redrawTab) registerTabRedraw(mod, o.redrawTab);
  if (o.csv) registerCsvExport(mod, o.csv);
  return kit;
}

/* A "wide" CSV: each column { h: header, v: [values] } beside the others, padded to the
   longest, so that every sample keeps its own columns (no axis shared). */
export function wideCsv(cols){
  const n = Math.max(0, ...cols.map(c=> c.v.length));
  let t = csvLine(cols.map(c=> c.h));
  for (let i = 0; i < n; i++) t += csvLine(cols.map(c=> i < c.v.length ? c.v[i] : ''));
  return t;
}
