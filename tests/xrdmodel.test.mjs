/* The XRPD host's calculations (xrd-model.js) and its words and markup that need no page
   (xrd-html.js), in Node: no browser (v563, out of v562's xrd.js). A file's scans made
   patterns (one, several named by scan and labelled by the sample, 2θ running down turned
   round, variance factors, a scan not read, none read), their arrays made once and shared;
   a file of a project read again from its bytes (kept by them: read once), as it was with no
   bytes (its lowest point 0 said), its data moved (points dropped up to v484, a minimum
   subtracted up to v262), its scan out of range; a file as a restore takes it (no object, no
   name, no arrays, variance factors of another length); a project from before the cards
   migrated (the standard among the samples, left out, the sample on show); a kind's
   settings and the entries of the files left out; the files read, those lost and their
   places, the sample on show; the cards' records and their settings by kind; the slots, a
   held entry read; a run's results and instruments patched into a state (a card's, the
   standard's, nothing new); what it shows and is given back; the patterns a drop loads; the
   markup escaped. Then 40 cases (random files of synthetic scans dropped twice, a state put
   back as it was, migrated, with no bytes, moved, left out, malformed; a run's results
   patched in) as v562's xrd.js gave them, run from its source on a page of stubs (the panels
   recording stubs): the files and alerts each drop gives, the files, standard, sample on
   show, alerts and cards a restore gives, the state a run's release writes; SHA-256 digests
   in tests/golden/xrdmodel.json (npm run test:update writes them anew after a change meant
   to alter them). utils.js's and modkit.js's helpers, which need a page to load, are taken
   from their source as they stand there; a file's bytes are read as JSON of its scans (the
   page parses XML: xrd-instr.js, tested apart). Under a second. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as M from '../xrd-model.js';
import * as H from '../xrd-html.js';
import { recIn, okId, freeId, saved } from '../cards-model.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/xrdmodel.json', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');

function decl(file, name){
  const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  let i = src.search(new RegExp(`^(export )?function ${name}\\(`, 'm'));
  if (i >= 0){
    let k = src.indexOf(')', i), d = 0;
    for (k = src.indexOf('{', k); k < src.length; k++){ if (src[k] === '{') d++; else if (src[k] === '}' && !--d) break; }
    return src.slice(i, k + 1).replace(/^export /, '');
  }
  i = src.search(new RegExp(`^(export )?const ${name} = `, 'm'));
  assert.ok(i >= 0, name + ' in ' + file);
  const rest = src.slice(i), m = /\n(?=\S)/.exec(rest);
  let end = m ? m.index : rest.length;
  if (m && /^[}\])]/.test(rest.slice(end + 1))) end = rest.indexOf('\n', end + 1);
  return rest.slice(0, end).replace(/^export /, '');
}
const UN = ['COLORS', 'colorOf', 'nextColor', 'esc', 'X_SVG', 'ALERT_ICON', 'markOf', 'seenFor', 'notesFor', 'alertHtml', 'FILE_ALERT', 'fileAlertHtml', 'fileLine', 'notesHtml'];
const IN_ALERTS = new Set(['ALERT_ICON', 'markOf', 'seenFor', 'notesFor']);
export const PAGE = new Function([...UN.map(n=> decl(IN_ALERTS.has(n) ? 'alerts.js' : 'utils.js', n)), decl('modkit.js', 'isObj')].join('\n') + `\nreturn { ${UN.join(', ')}, isObj };`)();
export const dec = b => new TextDecoder().decode(b);
export const enc = s => new TextEncoder().encode(s);
// A file's bytes read (the page's XML, here JSON of its scans: new objects at each reading).
export const read = { n: 0 };
export function scansOf(b){ read.n++; try { return JSON.parse(dec(b instanceof Uint8Array ? b : Uint8Array.from(b))).scans; } catch(e){ return [{ error: 'not well-formed XML' }]; } }
export const sampleOf = b =>{ let j; try { j = JSON.parse(dec(b)); } catch(e){ return ''; } const s = j.sample || {}; const t = k => typeof s[k] === 'string' ? s[k].trim() : ''; return t('name') || t('id'); };
export const U = { isObj: PAGE.isObj, colorOf: PAGE.colorOf, scansOf };
export const HU = { esc: PAGE.esc, X_SVG: PAGE.X_SVG, fileAlertHtml: PAGE.fileAlertHtml, fileLine: PAGE.fileLine };
export const dg = a => a == null ? String(a) : sha(Array.from(a, v=> Object.is(v, -0) ? '-0' : String(v)).join(',')).slice(0, 16);
export const canon = v => JSON.stringify(v, function(k, x){ const o = this[k];
  if (o instanceof Uint8Array){ let h = 0; for (const b of o) h = (Math.imul(h, 31) + b) >>> 0; return 'U8:' + o.length + ':' + h; }
  if (typeof o === 'number') return Object.is(o, -0) ? '#-0' : '#' + o;
  if (typeof o === 'function') return 'fn';
  return x; });
const scan = (x, y, o = {})=> ({ x, y, notes: [], ...o });

test('a file\'s scans made patterns: one, several, running down, not read; their arrays made once', ()=>{
  const b = enc('x'), s1 = scan([3, 2, 1], [30, 20, 10], { varMul: [3, 2, 1], meas: { l: 1 } });
  const one = M.patternsOf('a.xrdml', b, [s1], 'Sample');
  assert.deepEqual(one.pats.map(p=> [p.k, p.f.name, p.f.label, p.f.x, p.f.y, p.f.varMul, p.f.meas, p.f.src, p.f.scan]), [[0, 'a.xrdml', 'Sample', [1, 2, 3], [10, 20, 30], [1, 2, 3], { l: 1 }, undefined, undefined]]);
  assert.equal(one.pats[0].f.rawBytes, b); assert.deepEqual([one.n, one.skipped], [1, []]);
  assert.equal(s1.arrs.x, one.pats[0].f.x, 'made once, on the scan');
  assert.equal(M.patternsOf('a.xrdml', b, [s1]).pats[0].f.x, one.pats[0].f.x);
  const sev = M.patternsOf('s.v1.xrdml', b, [scan([1, 2], [1, 2]), { error: 'not a 2θ scan' }, scan([5, 4], [1, 2], { notes: ['n'] })]);
  assert.deepEqual(sev.pats.map(p=> [p.k, p.f.name, p.f.label, p.f.src, p.f.scan, p.notes]), [[0, 's.v1 (scan 1).xrdml', 's.v1 (scan 1)', 's.v1.xrdml', 0, []], [2, 's.v1 (scan 3).xrdml', 's.v1 (scan 3)', 's.v1.xrdml', 2, ['n']]]);
  assert.deepEqual(sev.skipped, ['scan 2 not read: not a 2θ scan']);
  assert.deepEqual(M.patternsOf('x', b, [{ error: 'e1' }, { error: 'e2' }]), { error: 'scan 1: e1; scan 2: e2' });
  assert.deepEqual(M.patternsOf('x', b, [{ error: 'e1' }]), { error: 'e1' });
  assert.deepEqual(M.ascending({ x: [1], y: [2] }), { x: [1], y: [2] });
  const r = { pats: sev.pats };
  assert.deepEqual(M.freshOf(r, new Set(['s.v1 (scan 3).xrdml'])).map(q=> q.k), [0]);
  assert.deepEqual(M.freshOf({ pats: one.pats }, new Set(['a.xrdml'])).length, 1);
});

test('a file read again: by its bytes (once), as it was, its data moved, points dropped; kept or left out', ()=>{
  const sc = [scan([1, 2, 3], [5, 6, 7], { varMul: [1, 1, 1] }), scan([4, 5, 6], [1, 2, 3], { dropped: 1 })], b = enc(JSON.stringify({ scans: sc }));
  read.n = 0;
  const same = M.readAgain(U, { name: 'a.xrdml', rawBytes: b, x: [1, 2, 3], y: [5, 6, 7], varMul: [1, 1, 1] });
  assert.equal(same.oldData, undefined); assert.deepEqual(same.x, [1, 2, 3]);
  assert.equal(M.readAgain(U, { name: 'a.xrdml', rawBytes: b, x: same.x, y: same.y, varMul: same.varMul }).x, same.x);
  assert.equal(read.n, 1, 'read once');
  // What it found kept with the file (v572: said until its box's ×, xrd-html.js openedNote;
  // v567: no version number in the words, ALERTS-REVIEW.md R4)
  const min = M.readAgain(U, { name: 'a.XML', rawBytes: b, x: [1, 2, 3], y: [4, 5, 6], varMul: [1, 1, 1] }), drop = M.readAgain(U, { name: 'a.xrdml', rawBytes: b, scan: 1, x: [4, 5, 6, 7], y: [1, 2, 3, 4] });
  assert.deepEqual([min.oldData, drop.oldData], [{ minimum: true }, { dropped: 1 }]);
  assert.match(H.openedNote(min), /as an older version had read them, with their minimum subtracted/);
  assert.match(H.openedNote(drop), /1 point whose values are no finite number left out: the project held it, as an older version did/);
  assert.equal(M.readAgain(U, { ...drop, seen: ['opened'] }).oldData, drop.oldData, 'kept as the file is read again (an undo), with its mark');
  assert.equal(M.readAgain(U, { name: 'a.xrdml', rawBytes: b, scan: 7, x: [3, 2], y: [1, 2] }).x.join(), '2,3');
  assert.match(H.openedNote(M.readAgain(U, { name: 'a.txt', y: [0, 1], x: [1, 2] })), /lowest point is exactly 0/);
  assert.equal(H.openedNote(M.readAgain(U, { name: 'a.txt', rawBytes: b, y: [0, 1], x: [1, 2] })), '');
  assert.equal(M.readAgain(U, { name: 'b.xrdml', rawBytes: enc('<no'), y: [1, 1], x: [1, 2] }).oldData, undefined);
  for (const oldData of [{ dropped: 0 }, { dropped: 1.5 }, { dropped: '2' }, { minimum: 'yes' }, 'x', null, 5]) assert.equal(H.openedNote({ oldData, rawBytes: b, y: [0] }), '', 'a project\'s .json: only a whole count, or true');
  const bad = enc('q'); M.keepScans(bad, [{ error: 'x' }]); read.n = 0; M.readAgain(U, { name: 'c.xrdml', rawBytes: bad, x: [1, 2], y: [1, 2] }); assert.equal(read.n, 0);
  // as a restore takes it
  const f2 = { name: 'f2', x: [1, 2], y: [1, 2] };
  assert.equal(M.keptFile(U, 5, 0, '#1'), null);
  const k = M.keptFile(U, { x: [2, 1], y: [1, 2], varMul: [1] }, 3, '#abc');
  assert.deepEqual([k.name, k.label, k.color, k.x, 'varMul' in k], ['file 4', 'file 4', '#abc', [1, 2], false]);
  assert.equal(M.keptFile(U, { name: 'a.b.c', label: 7, x: [1, 2], y: [1, 2] }, 0, '#1').label, 'a.b');
  assert.equal(M.keptFile(U, { name: 'n', x: [1], y: [1] }, 0, '#1'), null);
  assert.equal(M.keptFile(U, { name: 'n', x: 'ab', y: [1, 2] }, 0, '#1'), null);
  // Its marks of what was said seen (v573): those that are one, once each; none, no `seen` (to
  // v572 whatever the project held). The samples' and the standard's alike (readsOf).
  const junk = ['read', 5, null, { check: true }, ['check'], 'read', 'opened:x', 'junk', 'check:', 'checked', '<b>'];
  assert.deepEqual(M.keptFile(U, { ...f2, seen: junk }, 0, '#1').seen, ['read', 'opened:x']);
  for (const seen of ['check', { 0: 'check' }, 7, [1, null], []]) assert.ok(!(M.keptFile(U, { ...f2, seen }, 0, '#1').seen || []).length, 'a mark that is none');
  const kept = ['check', 'read'];
  assert.equal(M.keptFile(U, { ...f2, seen: kept }, 0, '#1').seen, kept, 'clean: as it is');
  const R = M.readsOf(U, { files: [{ ...f2, seen: junk }], std: { ...f2, name: 's', seen: [...junk, 'opened'] } });
  assert.deepEqual([R.reads[0].seen, R.stdRead.seen], [['read', 'opened:x'], ['read', 'opened:x', 'opened']]);
});

test('a project restored: migrated, its files read, those lost, the sample on show, the cards', ()=>{
  const f = n => ({ name: n, x: [1, 2], y: [3, 4] });
  const old = { files: [f('a'), { ...f('std'), included: true, held: {} }, f('b'), { ...f('c'), included: false }], standardName: 'std', curIdx: 2, stdParams: { w: 1 },
    perParams: [{ p: 0 }, { p: 1 }, { p: 2 }], manualPeaks: [[0], [1], [2]], removedPeaks: [[], [], []], shared: { s: 1 }, rv: { std: 1, results: { std: { r: 1 }, a: { r: 2 } } } };
  const m = M.migrate(U, old);
  assert.deepEqual(m.files.map(x=> x.name), ['a', 'b', 'c']); assert.deepEqual(m.std, f('std')); assert.equal(m.curIdx, 1);
  assert.deepEqual(m.stdPeaks.manualPeaks, [[1]]); assert.deepEqual(m.stdRv.results, { std: { r: 1 } });
  assert.deepEqual(m.cards[0].states.scherrer.perParams, [{ p: 0 }, { p: 2 }]); assert.deepEqual(m.cards[1].states.rietveld.results, { a: { r: 2 } });
  assert.equal(M.migrate(U, { files: [f('a')], standardName: 'zz', curIdx: 0 }).std, null);
  assert.equal(M.stateIn(U, { v: 2, files: [] }).v, 2); assert.equal(M.stateIn(U, 5).cards.length, 2);
  assert.deepEqual(M.keptState(U, 'scherrer', { perParams: [1, 2, 3], manualPeaks: 'x', shared: 5 }, new Set([1])), { perParams: [1, 3], manualPeaks: [], removedPeaks: [], shared: {} });
  assert.equal(M.keptState(U, 'rietveld', 5, new Set()), null);
  const s = { files: [f('a'), 5, { ...f('b'), included: false }, { name: 'bad' }, f('c')], std: { name: 'std' }, curIdx: 4 };
  const R = M.readsOf(U, s);
  assert.deepEqual([R.reads.map(r=> r && r.name), R.stdRead, R.lost, [...R.gone]], [['a', null, 'b', null, 'c'], null, 2, [1, 2]]);
  assert.deepEqual(R.reads[4].color, PAGE.colorOf(4));
  assert.equal(M.curIdxOf(s, R.gone, 2), 1); assert.equal(M.curIdxOf({ curIdx: 'x' }, R.gone, 2), 0); assert.equal(M.curIdxOf({ curIdx: 1.9 }, new Set([0]), 3), 0);
  assert.deepEqual(M.cardsIn(U, { cards: [null, { type: 'pie' }, { type: 'constructor' }, { id: 3 }, { type: 'rietveld' }] }), [{ id: 3 }, { type: 'rietveld' }]);
  assert.deepEqual(M.cardIn(U, { states: { scherrer: { perParams: [1, 2] }, rietveld: 5, constructor: {}, x: {} } }, new Set([0])), { states: { scherrer: { perParams: [2], manualPeaks: [], removedPeaks: [], shared: {} } } });
});

test('the cards\' states: slots, a run\'s results patched in, what it shows', ()=>{
  const sl = M.heldAs({ key: 'A1:params', arr: [], make: (v, f)=> ({ v, f: !!f }) });
  assert.deepEqual(sl.make(undefined, { held: { 'kA1:params': 7 } }), { v: 7, f: true }); assert.deepEqual(sl.make(3, { held: {} }), { v: 3, f: true });
  const s = { perParams: [], manualPeaks: [], removedPeaks: [], shared: { w: 2 } }, ks = M.keptSlots('A4', s);
  assert.deepEqual(ks.map(k=> k.key), ['A4:params', 'A4:manual', 'A4:removed']); assert.deepEqual(ks[0].make(), { w: 2 }); assert.deepEqual(ks[1].make([1]), [1]);
  assert.equal(M.prefixOf({ type: 'scherrer', id: 3 }), 'xrdA3'); assert.equal(M.prefixOf({ type: 'rietveld', id: 3 }), 'xrdR3');
  const a = { type: 'rietveld', states: { scherrer: { p: [1] }, rietveld: { q: 1 }, z: null } }, o = M.otherStates(a);
  assert.deepEqual(o, { scherrer: { p: [1] } }); assert.notEqual(o.scherrer, a.states.scherrer);
  const res = Object.freeze({ chi: 1 }), live = [{ name: 'a', rawBytes: 1, instr: { l: 2 } }, { name: 'b', rawBytes: 2 }], std = [{ name: 's', rawBytes: 9, instr: { l: 1 } }];
  const st = { files: [{ name: 'a', rawBytes: 1 }, { name: 'b', rawBytes: 2 }], std: { name: 's', rawBytes: 9 }, stdRv: { results: {} }, cards: [{ id: 2, states: { rietveld: { results: { b: res } } } }] };
  const p = M.runPatch(U, 2, { a: { chi: 5 }, b: res, zz: { chi: 1 } }, live, std)(st);
  assert.deepEqual(p.files[0].instr, { l: 2 }); assert.deepEqual(p.std.instr, { l: 1 }); assert.deepEqual(p.cards[0].states.rietveld.results, { b: res, a: { chi: 5 } });
  assert.deepEqual(M.runPatch(U, null, { s: { chi: 3 } }, [], [])(st).stdRv.results, { s: { chi: 3 } });
  // (an instrument read from another file of that name, other bytes: not this one's)
  assert.equal(M.runPatch(U, 2, { a: { chi: 5 } }, [{ name: 'a', rawBytes: 7, instr: { l: 9 } }], [])(st).files[0].instr, undefined);
  const same = { files: [], std: null, cards: [] };
  assert.equal(M.runPatch(U, 9, { a: 1 }, [], [])(same), same);
  assert.deepEqual(M.withResults({ results: { a: 1 } }, new Set(['a']), { a: 1 }, x=> x), null);
  assert.deepEqual(M.showsOf({ name: 'p' }, {}, { rv: 1 }), { pattern: 'p', std: { rv: 1 } }); assert.equal(M.showsOf(null, {}, {}), null);
  assert.deepEqual(M.showNextIn(U, { pattern: 'p', cards: { 1: {} }, std: 5 }), { cards: { 1: {} }, pattern: 'p', std: null });
  assert.deepEqual(M.showNextIn(U, 'x'), { cards: null, pattern: null, std: null });
  assert.equal(M.isKind('rietveld'), true); assert.equal(M.isKind('toString'), false); assert.equal(M.clone({ a: [1] }).a[0], 1);
});

test('the markup: the standard\'s window and file, its alerts, the drop\'s, a restore\'s, escaped', ()=>{
  const w = H.stdModalHtml('xrdStdPeaks', 'Instrumental <b>standard</b>', 'INFO', HU);
  for (const s of ['aria-labelledby="xrdStdPeaksTitle"', 'id="xrdStdPeaksTitle">Instrumental <b>standard</b>', 'id="xrdStdPeaksDz"', 'id="xrdStdPeaksFiles"', 'class="xrd-std-alerts"', 'class="xrd-std-file"', 'class="xrd-std-body"', '>INFO</div>']) assert.ok(w.includes(s), s);
  assert.equal(H.stdFileHtml(null, HU), '');
  assert.ok(H.stdFileHtml({ name: 'a<b>.xrdml' }, HU).includes('<span class="xrd-std-name">a&lt;b&gt;.xrdml</span>'));
  /* (v567, utils.js FILE ALERTS: a caveat to check a warning; how the file was taken an info.
     v573: worked out from the standard's file, from the scans its bytes were read into, each
     until its box's × marks it seen; the drop's line of the files dropped beside them; to v572
     the drop's words, gone at the next undo or restore.) */
  const bs = enc('std'), bo = enc('one'), sbox = (st, line)=> PAGE.notesHtml(H.stdNotes(st, M.keptScans, HU), w=> 'xrd-std-dismiss-' + w, { read: line ? [line] : [] });
  M.keepScans(bs, [{ error: 'no scan data' }, scan([1, 2], [1, 2], { notes: ['n<', 'counts over unequal counting times: loaded as counts per second'] }), scan([1, 2], [1, 2])]);
  M.keepScans(bo, [scan([1, 2], [1, 2])]);
  const sd = { name: 'f<1> (scan 2).xrdml', src: 'f<1>.xrdml', scan: 1, rawBytes: bs }, SREAD = ['f&lt;1&gt;.xrdml: 3 scans: the standard is scan 2, the first that could be read; the others are not used.',
    'f&lt;1&gt; (scan 2).xrdml: counts over unequal counting times: loaded as counts per second.'], DROP = '2 files dropped: the first, f&lt;1&gt;.xrdml, is the standard; the others are not used.';
  assert.equal(H.stdDropLine(2, 'f<1>.xrdml', HU), DROP);
  assert.equal(sbox(sd, DROP), PAGE.alertHtml('warn', 'Loaded, to check:', ['f&lt;1&gt; (scan 2).xrdml: n&lt;.'], 'xrd-std-dismiss-check') + PAGE.alertHtml('info', 'How these files were read:', [...SREAD, DROP], 'xrd-std-dismiss-read'));
  assert.equal(sbox({ ...sd, seen: ['check'] }, ''), PAGE.alertHtml('info', 'How these files were read:', SREAD, 'xrd-std-dismiss-read'), 'to check, seen');
  assert.equal(sbox({ ...sd, seen: ['read', 'check'] }, ''), '', 'both seen');
  assert.ok(sbox({ ...sd, scan: 0 }, '').includes('the standard is the first; the others'));
  assert.deepEqual([H.stdDropLine(1, 'f', HU), sbox(null, ''), sbox({ ...sd, rawBytes: undefined }, ''), sbox({ name: 'one.xrdml', rawBytes: bo }, '')], ['', '', '', '']);
  assert.equal(H.scansNote('f', 3, 3), 'f: 3 scans, each a pattern of its own.'); assert.equal(H.scansNote('f', 3, 1), 'f: 3 scans, 1 of them loaded, each a pattern of its own.');
  const d = H.dropAlerts(['x: why.'], ['y'], HU);
  assert.equal(d.load, PAGE.alertHtml('bad', 'Not loaded:', ['x: why.'], 'xrd-dismiss-invalid'));
  assert.equal(d.upload, PAGE.alertHtml('info', 'Already loaded, not loaded again:', ['y.'], 'xrd-dismiss-upload'));
  assert.deepEqual(H.dropAlerts([], [], HU), { load: '', upload: '' });
  // What the reading of the files said (v572, ALERTS-REVIEW.md X04: worked out from the
  // patterns in the list, each until its box's × marks it seen; to v571 the drop's and the
  // restore's words, gone at the next undo, left with their file removed): from the scans the
  // bytes were read into, a file's (how many, those not read) and each pattern's; what a project
  // opened found, the standard's too; what it left out beside them.
  const b1 = enc('f'), b2 = enc('g');
  M.keepScans(b1, [scan([1, 2], [1, 2]), { error: 'no scan data' }, scan([1, 2], [1, 2], { notes: ['n<'] })]);
  M.keepScans(b2, [scan([1, 2], [1, 2], { notes: ['intensities in cps with no counting time: 0.5 s per point estimated from the noise, for the weights'] })]);
  assert.equal(M.keptScans({ name: 'f (scan 1).xrdml', rawBytes: b1 }).length, 3);
  assert.deepEqual([M.keptScans({ name: 'f.txt', rawBytes: b1 }), M.keptScans({ name: 'f.xrdml' }), M.keptScans({ name: 'f.xrdml', rawBytes: enc('h') })], [null, null, null]);
  const p1 = { name: 'f (scan 1).xrdml', src: 'f.xrdml', scan: 0, rawBytes: b1, y: [0] }, p3 = { name: 'f (scan 3).xrdml', src: 'f.xrdml', scan: 2, rawBytes: b1 };
  const g = { name: 'g.xrdml', label: 'G', rawBytes: b2, oldData: { dropped: 2 } }, o = { name: 'o', label: 'O<', y: [3, 0, 1] }, std = { name: 's.xrdml', y: [0] };
  const box = (all, st, lost)=> PAGE.notesHtml(H.fileNotes(all, st, M.keptScans, HU), w=> 'xrd-dismiss-' + w, { opened: lost ? [lost] : [] });
  const CHECK = ['f.xrdml: scan 2 not read: no scan data.', 'f (scan 3).xrdml: n&lt;.'], READ = ['f.xrdml: 3 scans, 2 of them loaded, each a pattern of its own.', 'g.xrdml: intensities in cps with no counting time: 0.5 s per point estimated from the noise, for the weights.'];
  const OPENED = ['G: read again from the file itself, 2 points whose values are no finite number left out: the project held them, as an older version did. Results refined before are from those: refine again.',
    'O&lt;: its lowest point is exactly 0 and the project does not hold the file itself: its minimum may have been subtracted, as an older version did, which the Rietveld weights would take for the counts; load the file again.'];
  const STD = 's.xrdml: its lowest point is exactly 0 and the project does not hold the file itself: its minimum may have been subtracted, as an older version did, which the Rietveld weights would take for the counts; load the file again.';
  assert.equal(box([p1, p3, g, o], std, H.leftOutLine(1, true, null, HU)), PAGE.alertHtml('warn', 'Loaded, to check:', CHECK, 'xrd-dismiss-check')
    + PAGE.alertHtml('warn', 'Opened, to check:', [...OPENED, STD, '1 file and the standard left out: no data in the project.'], 'xrd-dismiss-opened') + PAGE.alertHtml('info', 'How these files were read:', READ, 'xrd-dismiss-read'));
  // A file's line goes when all its patterns are seen (or gone), a pattern's with it alone.
  assert.equal(box([{ ...p1, seen: ['check', 'read'] }, p3, g], null, ''), PAGE.alertHtml('warn', 'Loaded, to check:', CHECK, 'xrd-dismiss-check')
    + PAGE.alertHtml('warn', 'Opened, to check:', OPENED.slice(0, 1), 'xrd-dismiss-opened') + PAGE.alertHtml('info', 'How these files were read:', READ, 'xrd-dismiss-read'));
  assert.equal(box([p1, { ...p3, seen: ['check'] }, { ...g, seen: ['opened', 'read'] }], null, ''), PAGE.alertHtml('warn', 'Loaded, to check:', CHECK.slice(0, 1), 'xrd-dismiss-check')
    + PAGE.alertHtml('info', 'How these files were read:', READ.slice(0, 1), 'xrd-dismiss-read'));
  assert.equal(box([p3], null, ''), PAGE.alertHtml('warn', 'Loaded, to check:', CHECK, 'xrd-dismiss-check') + PAGE.alertHtml('info', 'How these files were read:', ['f.xrdml: 3 scans, 1 of them loaded, each a pattern of its own.'], 'xrd-dismiss-read'));
  assert.deepEqual(['the standard', '2 files', '1 file and the standard'].map(t=> t + ' left out: no data in the project.'), [H.leftOutLine(0, true, null, HU), H.leftOutLine(2, false, null, HU), H.leftOutLine(1, true, null, HU)]);
  assert.deepEqual([H.leftOutLine(0, false, null, HU), H.leftOutLine(0, true, std, HU)], ['', '']);
});

/* ---- 40 cases: files dropped twice, a state put back, a run's results patched in ---- */
export function rnd(seed){ let s = seed >>> 0 || 1; return ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function scanSet(r){
  const pick = a => a[Math.floor(r()*a.length)], chance = p => r() < p;
  const scans = Array.from({ length: pick([1, 1, 2, 3]) }, ()=>{
    if (chance(0.12)) return { error: pick(['not a 2θ scan', 'no data <x>']) };
    const n = pick([5, 9, 1]), down = chance(0.3), x0 = 10 + Math.round(r()*50)/10;
    const s = { x: Array.from({ length: n }, (_, i)=> +(x0 + (down ? n - 1 - i : i)*0.05).toFixed(4)), y: Array.from({ length: n }, ()=> Math.round(r()*900)), notes: chance(0.2) ? [pick(['attenuated', 'a <note>'])] : [] };
    if (chance(0.5)) s.varMul = s.x.map(()=> +(1 + r()).toFixed(3));
    if (chance(0.3)) s.meas = { lambda: 1.5406 };
    if (chance(0.15)) s.dropped = 1;
    return s;
  });
  const j = { scans };
  if (chance(0.4)) j.sample = chance(0.6) ? { name: pick(['TiO2 <a>', ' S1 ', '']), id: 'id7' } : { id: 'only id' };
  return chance(0.06) ? '<not json' : JSON.stringify(j);
}
export const EDITS = ['same', 'migrate', 'nobytes', 'moved', 'scan', 'held', 'junk', 'std', 'cards'];
// A state as an earlier version, a hand or a damage left it: from the state s the case's drops gave.
export function edited(s, kind, r){
  const files = s.files.map(f=> ({ ...f }));
  if (kind === 'migrate'){ const std = files[Math.floor(r()*files.length)]; return { files, standardName: std && std.name, curIdx: 1, stdParams: { w: 1 }, perParams: files.map((_, i)=> ({ i })), manualPeaks: files.map((_, i)=> [i]), removedPeaks: files.map(()=> []), shared: { s: 2 }, rv: { results: Object.fromEntries(files.map(f=> [f.name, { chi: 1 }])) } }; }
  if (kind === 'nobytes') files.forEach(f=>{ delete f.rawBytes; f.y = Array.from(f.y, (v, i)=> i ? v : 0); });
  if (kind === 'moved') files.forEach(f=>{ f.y = Array.from(f.y, v=> v + 1); });
  if (kind === 'scan') files.forEach((f, i)=>{ f.scan = [7, -1, 'a'][i % 3]; f.name = i % 2 ? 'plain.txt' : f.name; });
  if (kind === 'held' && files.length) files[0] = { ...files[0], included: false, held: { kA1: { w: 3 } } };
  if (kind === 'junk') return { ...s, files: [5, ...files.slice(1), { name: 'x.xrdml', x: [1], y: [2] }, null], curIdx: 'x' };
  if (kind === 'std') return { ...s, files: files.slice(1), std: files[0] ? { ...files[0], color: undefined } : { name: 'none' }, curIdx: 9 };
  if (kind === 'cards') return { ...s, files, cards: [null, { type: 'pie' }, { id: 'x', type: 'scherrer', states: 5 }, { id: 4, type: 'rietveld', states: { rietveld: { q: 1 }, scherrer: { perParams: [1, 2], shared: 5 }, constructor: {} } }, { id: 4, type: 'scherrer' }], curIdx: -2 };
  return { ...s, files };
}
export function caseOf(seed){
  const r = rnd(seed*7919 + 41), pick = a => a[Math.floor(r()*a.length)], chance = p => r() < p;
  const files = Array.from({ length: 1 + Math.floor(r()*4) }, (_, i)=> ({ name: `p${i + 1}.xrdml`, text: scanSet(r) }));
  const drops = [files.slice(0, Math.max(1, files.length - 1)).map(f=> f.name), files.slice(-2).map(f=> f.name)];
  const edit = pick(EDITS), er = Math.floor(r()*1000);
  const run = { card: pick([1, null, 0, 2]), names: [1, 2, 3].filter(()=> chance(0.6)), instr: chance(0.5) };
  return { files, drops, edit, er, run };
}

/* ---- xrd.js's wiring, in short ---- */
// A drop: each file read (its scans kept by its bytes), its patterns loaded unless loaded, each
// its colour; the alerts' markup as the page puts it under the drop zone.
function dropCase(S, c, names){
  const existing = new Set(S.all.map(f=> f.name)), already = [], invalid = [];
  for (const name of names){
    const file = c.files.find(f=> f.name === name);
    if (existing.has(name)){ already.push(PAGE.esc(name)); continue; }
    const b = S.bytes.get(name) || S.bytes.set(name, enc(file.text)).get(name), scans = scansOf(b);
    M.keepScans(b, scans);
    const rr = M.patternsOf(name, b, scans, sampleOf(b));
    if (rr.error){ invalid.push(PAGE.esc(PAGE.fileLine(name, rr.error))); continue; }
    const fresh = M.freshOf(rr, existing);
    if (!fresh.length){ already.push(PAGE.esc(name)); continue; }
    existing.add(name);
    for (const q of rr.pats) if (!fresh.includes(q)) already.push(PAGE.esc(q.f.name));
    for (const { f: p } of fresh){ p.color = PAGE.nextColor(S.all); existing.add(p.name); S.all.push(p); }
  }
  const A = H.dropAlerts(invalid, already, HU);
  S.alerts = A.load + notesOf(S, '') + A.upload;
}
// What the reading of the files in the list said (xrd.js rebuildXrdAlerts), a project opened's
// line beside it.
const notesOf = (S, lost)=> PAGE.notesHtml(H.fileNotes(S.all, S.std, M.keptScans, HU), w=> 'xrd-dismiss-' + w, { opened: lost ? [lost] : [] });
const fileOut = f => f && [f.name, f.label, f.color, dg(f.x), dg(f.y), f.varMul ? dg(f.varMul) : null, f.src, f.scan, f.meas, f.included, f.held, f.rawBytes];
// The state the module saves (its cards with their kinds' settings: a panel's its own as restored).
const stateOf = S => ({ v: 2, files: S.all.map(f=> ({ ...f })), std: S.std ? { ...S.std } : null, stdRv: S.stdRv, curIdx: S.curIdx, cards: S.cards.map(a=>{ const st = M.otherStates(a); st[a.type] = M.clone(a.own); return { ...saved(a), states: st }; }) });
function restoreCase(S, s0){
  const s = M.stateIn(U, s0), R = M.readsOf(U, s);
  S.all = R.reads.filter(Boolean);
  S.std = R.stdRead;
  S.curIdx = M.curIdxOf(s, R.gone, S.all.filter(f=> f.included !== false).length);
  S.stdRv = U.isObj(s.stdRv) ? s.stdRv : {};
  const list = M.cardsIn(U, s), free = { n: freeId(list) }, seen = new Set();
  S.cards = list.map(src=>{ const a = recIn(src, x=> M.cardIn(U, x, R.gone), M.KINDS, Object.keys(M.KINDS)); if (!okId(a.id) || seen.has(a.id)) a.id = free.n++; seen.add(a.id); a.own = a.states[a.type] || {}; return a; });
  S.alerts = notesOf(S, H.leftOutLine(R.lost, !!s.std, R.stdRead, HU));
}
export function runCase(c){
  const S = { all: [], std: null, curIdx: 0, stdRv: {}, bytes: new Map(),
    cards: [{ id: 1, type: 'scherrer', base: '', nameAuto: true, name: '', collapsed: false, states: {}, own: {} }, { id: 2, type: 'rietveld', base: '', nameAuto: true, name: '', collapsed: false, states: {}, own: {} }] };
  const out = [];
  for (const d of c.drops){ dropCase(S, c, d); out.push([S.all.map(fileOut), S.alerts]); }
  const s1 = stateOf(S), s = edited(s1, c.edit, rnd(c.er));
  restoreCase(S, s);
  const st = stateOf(S);
  out.push([S.all.map(fileOut), fileOut(S.std), S.curIdx, S.alerts, sha(canon(st.cards))]);
  // a run's end: what it wrote, the live files' instruments read meanwhile (the standard's too)
  if (c.run.instr) [...S.all, ...(S.std ? [S.std] : [])].forEach((f, i)=>{ if (i % 2 === 0) f.instr = { l: i }; });
  const wrote = Object.fromEntries(c.run.names.map(k=> [S.all[k - 1] ? S.all[k - 1].name : S.std && k === 3 ? S.std.name : `p${k}.xrdml`, { chi: k }]));
  // (by a card of the state's, by its place: its id; none, or no card, the standard's)
  const ids = S.cards.map(a=> a.id), id = c.run.card == null || !ids.length ? null : ids[c.run.card % ids.length];
  out.push(Object.keys(wrote).length ? sha(canon(M.runPatch(U, id, wrote, S.all, S.std ? [S.std] : [])(st))) : 'none');
  return canon(out);
}
export const CASES = 40;

test('40 cases as v562\'s xrd.js gave them (golden digests)', ()=>{
  const got = { cases: Array.from({ length: CASES }, (_, i)=> sha(runCase(caseOf(i + 1)))) };
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
