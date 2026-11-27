/* The trace list's calculations (filelist-model.js) and markup (filelist-html.js) in Node, no
   browser (v564, out of v563's utils.js renderUnifiedFileList, the list every module shows):
   a trace's original files (its bytes under its file's own name, a pair's files, legacy text,
   none; a file whose bytes are gone), what its download gives (the file, a zip of a pair's,
   or why not), the list's zip (each file once, by its bytes or its name, the ones not
   available left out); where a row dragged lands (the gaps beside it none), a point outside a
   row, which of a row's two files a point is on, a press that moved; the head (the include-all
   box, the palette's button or its place, the note's header escaped), a row (its box, its
   colour or its place, its name's field and tooltip, FILE as its file or its parts with their
   grips and warnings, the note), the line said when every trace is left out. Then 40 cases
   (random lists: names and labels with markup, colours or none, traces left out, a file's own
   name, bytes shared, pairs, legacy text, bytes gone; tips, parts, notes and a header or
   none): the markup, each trace's download and the list's, where a row dragged from each
   place to each gap lands, the include-all box's state and what a press on it asks, as v563's
   utils.js gave them, run from its source on a page of stubs: SHA-256 digests in
   tests/golden/filelistmodel.json (npm run test:update writes them anew after a change meant
   to alter them). utils.js's esc and its icons, which need a page to load, are taken from
   its source as they stand there. Under a second. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as M from '../filelist-model.js';
import * as H from '../filelist-html.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/filelistmodel.json', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');
// A const of utils.js as it stands there: to its line's end.
function constDecl(name){
  const src = fs.readFileSync(new URL('../utils.js', import.meta.url), 'utf8');
  const i = src.search(new RegExp(`^const ${name} = `, 'm'));
  assert.ok(i >= 0, name + ' in utils.js');
  return src.slice(i, src.indexOf('\n', i));
}
const PAGE = new Function(['esc', 'X_SVG', 'DL_SVG'].map(constDecl).join('\n') + '\nreturn { esc, X_SVG, DL_SVG };')();
export const U = { ...PAGE, isIncluded: f => f.included !== false, fileOf: f => typeof f.src === 'string' && f.src ? f.src : f.name };
export const canon = v => JSON.stringify(v, function(k, x){ const o = this[k];
  if (o instanceof Uint8Array){ let h = 0; for (const b of o) h = (Math.imul(h, 31) + b) >>> 0; return 'U8:' + o.length + ':' + h; }
  if (typeof o === 'number') return Object.is(o, -0) ? '#-0' : '#' + o;
  if (typeof o === 'function') return 'fn';
  return x; });
const B = (...a) => Uint8Array.from(a);

test('a trace\'s files, its download, the list\'s zip', ()=>{
  const bytes = B(1, 2, 3);
  assert.deepEqual(M.originalsOf(U, { name: 'a.csv', rawBytes: bytes }), [{ name: 'a.csv', bytes }]);
  assert.deepEqual(M.originalsOf(U, { name: 'Sample (scan 2)', src: 'run.xy', rawBytes: bytes }), [{ name: 'run.xy', bytes }], 'under its file\'s own name');
  assert.deepEqual(M.originalsOf(U, { name: 'a', src: '', raw: 'text' }), [{ name: 'a', text: 'text' }], 'an empty src: its own name');
  const pair = { name: 's', rawFiles: [{ name: 's.dsc', bytes }, { name: 's.dta', data: 'D' }, { name: 's.x', text: 'T' }, { name: 's.gone' }] };
  assert.deepEqual(M.originalsOf(U, pair), [{ name: 's.dsc', bytes }, { name: 's.dta', text: 'D' }, { name: 's.x', text: 'T' }, { name: 's.gone', text: undefined }]);
  assert.deepEqual(M.lostOf(U, pair), ['s.gone']);
  assert.deepEqual([M.originalsOf(U, { name: 'n' }), M.originalsOf(U, { name: 'n', rawFiles: [], rawBytes: null, raw: null })], [[], []]);
  // the download: the file, a zip of several, or why not (the first not available; none: the trace's name)
  assert.deepEqual(M.downloadOf(U, { name: 'a.csv', rawBytes: bytes }), { one: { name: 'a.csv', bytes } });
  assert.deepEqual(M.downloadOf(U, { name: 'a.csv', raw: '' }), { one: { name: 'a.csv', text: '' } });
  assert.deepEqual(M.downloadOf(U, { name: 'p', rawFiles: [{ name: 'p.dsc', bytes }, { name: 'p.dta', bytes }] }), { zip: 'p.zip', entries: [{ name: 'p.dsc', bytes }, { name: 'p.dta', bytes }] });
  assert.deepEqual(M.downloadOf(U, pair), { missing: true, name: 's.gone' });
  assert.deepEqual(M.downloadOf(U, { name: 'n' }), { missing: true, name: 'n' });
  assert.deepEqual(M.downloadOf(U, {}), { missing: true, name: undefined }, 'no name at all: still missing');
  // the zip: each file once (the same bytes, or the same name with text), none of a trace with a file gone
  const other = B(9);
  assert.deepEqual(M.zipEntries(U, [{ name: 'a', rawBytes: bytes }, { name: 'b', src: 'a', rawBytes: bytes }, { name: 'c', rawBytes: other }, pair, { name: 't', raw: 'x' }, { name: 't', raw: 'y' }]),
    [{ name: 'a', bytes }, { name: 'c', bytes: other }, { name: 't', text: 'x' }]);
  assert.deepEqual(M.zipEntries(U, [{ name: 'n' }, pair]), []);
});

test('a row dragged, a file dragged by its grip', ()=>{
  // from row 2 of 5: the gaps 2 and 3 are its own; 0, 1 above it, 4, 5 below
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(g => M.gapFor(g, 2)), [0, 1, null, null, 4, 5]);
  assert.deepEqual([0, 1, 4, 5].map(g => M.landing(g, 2)), [0, 1, 3, 4]);
  assert.deepEqual([M.gapFor(0, 0), M.gapFor(1, 0), M.gapFor(2, 0), M.landing(2, 0)], [null, null, 2, 1]);
  const b = { left: 10, right: 110, top: 50, bottom: 70 };
  assert.deepEqual([[10, 50], [110, 70], [60, 60], [9, 60], [111, 60], [60, 49], [60, 71]].map(([x, y]) => M.outside(b, x, y)), [false, false, false, true, true, true, true]);
  const two = [{ top: 0, bottom: 20 }, { top: 20, bottom: 50 }];
  assert.deepEqual([0, 22.4, 22.5, 40].map(y => M.halfAt(two, y)), [0, 0, 1, 1], 'split between their middles (10 and 35)');
  assert.deepEqual([[0, 0, 3, 3], [0, 0, 4, 0], [0, 0, 3, 4], [5, 5, 5, 0]].map(a => M.movedFrom(...a)), [true, false, true, true], 'more than 4 px');
});

test('the markup: the head, a row, its parts, the list', ()=>{
  const h = H.headHtml(0, false, 'A <&> "b"', U);
  assert.ok(h.startsWith('<div class="table-wrap-box"><table class="file-table"><colgroup>') && h.endsWith('</tr></thead><tbody>'));
  assert.ok(h.includes('<input type="checkbox" class="incl-all" title=') && !h.includes('incl-all" checked'));
  assert.ok(h.includes('<span class="palette-pick-btn swatch-gap" aria-hidden="true"></span>'), 'no colour: the palette\'s place');
  assert.ok(h.includes('<th class="note-cell" title="A &lt;&amp;&gt; &quot;b&quot;">A &lt;&amp;&gt; &quot;b&quot;</th>'));
  const h2 = H.headHtml(2, true, undefined, U);
  assert.ok(h2.includes('class="incl-all" checked') && h2.includes('<button class="palette-pick-btn" title="Apply color palette"></button>') && h2.includes('<th class="note-cell"></th>'));
  assert.ok(h2.includes(PAGE.DL_SVG(15)) && h2.includes(PAGE.X_SVG(15)));
  const f = { name: 'a<b>.csv', label: 'x "y"', color: '#123456', included: false };
  const asked = [];
  const cb = { tip: (t, i) => { asked.push('tip' + i); return 'λ <450>'; }, parts: (t, i) => { asked.push('parts' + i); return null; } };
  const row = H.rowHtml(f, 3, cb, (t, i) => { asked.push('note' + i); return '<b>n</b>'; }, U);
  assert.deepEqual(asked, ['tip3', 'parts3', 'note3'], 'asked in that order');
  assert.ok(row.startsWith('<tr class="file-row is-excluded" data-i="3">') && row.endsWith('</tr>'));
  assert.ok(row.includes('<input type="checkbox" class="file-incl" data-i="3" title="Include in the analysis">'));
  assert.ok(row.includes('<td class="trace-cell" title="λ &lt;450&gt;"><span class="trace-inner"><button class="color-swatch" data-i="3" data-color="#123456" style="background:#123456" title="Pick color"></button><input type="text" class="label-input file-label" data-i="3" value="x &quot;y&quot;" aria-label="Trace name"></span></td>'));
  assert.ok(row.includes('<td class="fname" title="a&lt;b&gt;.csv"><span class="fname-inner"><span class="fname-text">a&lt;b&gt;.csv</span></span></td><td class="note-cell"><b>n</b></td>'));
  const plain = H.rowHtml({ name: 'n', src: 'file.xy', label: '' }, 0, {}, null, U);
  assert.ok(plain.includes('<span class="color-swatch swatch-gap" aria-hidden="true"></span>') && plain.includes('title="file.xy"') && plain.includes('<td class="note-cell"></td>') && plain.includes('class="trace-cell">'));
  const parts = H.partsHtml([{ name: 't.txt' }, { name: 'r<1>', warn: 'two "tables"' }], 4, U);
  assert.ok(parts.startsWith('<td class="fname fname-parts" title="t.txt + r&lt;1&gt;"><span class="fname-inner fparts">'));
  assert.ok(parts.includes('<span class="fpart" data-i="4" data-p="0" title="t.txt"><span class="fpart-grip"') && parts.includes('<span class="fpart is-warn" data-i="4" data-p="1" title="r&lt;1&gt;: two &quot;tables&quot;">'));
  assert.equal((parts.match(/fpart-grip/g) || []).length, 2);
  assert.ok(parts.includes(H.FGRIP));
  assert.ok(H.listHtml([f], {}, null, '', 0, U).endsWith('</tbody></table></div><p class="txt-meta file-none">No trace is included in the analysis.</p>'));
  assert.ok(H.listHtml([{ ...f, included: true }], {}, null, '', 1, U).endsWith('</tbody></table></div>'));
});

/* =========================================================
   40 CASES, as utils.js's list did them: the markup, each trace's download and the list's,
   every row dragged to every gap, the include-all box. Their digests are those of v563's
   utils.js, run from its source on a page of stubs, the downloads and the drops done
   through its buttons and handles.
========================================================= */
function rnd(seed){ let s = seed >>> 0 || 1; return ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
export function caseOf(seed){
  const r = rnd(seed * 7919 + 17), pick = a => a[Math.floor(r()*a.length)], chance = p => r() < p, int = n => Math.floor(r()*n);
  const bytes = () => Uint8Array.from({ length: 1 + int(5) }, () => int(256)), shared = bytes();
  const files = Array.from({ length: 1 + int(5) }, (_, k)=>{
    const f = { name: pick([`f${k}.csv`, 'a<b>.csv', 'same.csv', `s${k}`]), label: pick([`Trace ${k}`, '', 'x <i>&"\'']) };
    if (chance(0.8)) f.color = pick(['#3aa0ff', '#ff7a59', '"><x>', '']);
    if (chance(0.3)) f.included = pick([false, true, 0]);
    if (chance(0.3)) f.src = pick([`src${k}.dat`, '', 'same.csv']);
    const q = r();
    if (q < 0.4) f.rawBytes = chance(0.3) ? shared : bytes();
    else if (q < 0.6) f.rawFiles = Array.from({ length: int(3) }, (_, j)=> pick([{ name: `p${j}.dsc`, bytes: bytes() }, { name: `p${j}.dta`, data: 'txt' }, { name: `p${j}.x`, text: 'T' }, { name: `p${j}.gone` }, { name: 'same.csv', bytes: shared }]));
    else if (q < 0.75) f.raw = pick(['legacy text', '']);
    return f;
  });
  return { files, tip: chance(0.4), parts: chance(0.4), note: chance(0.4), head: chance(0.3) ? pick(['SAMPLE', 'A <&> "b"']) : undefined };
}
// The callbacks a case's list is given (tip, parts, note: what GC and Iodometry give, made up).
export function callbacksOf(c){
  const cb = {};
  if (c.tip) cb.tip = (f, i) => i % 2 ? 'λ = 450 nm <b>' : '';
  if (c.parts) cb.parts = (f, i) => i % 3 === 2 ? null : [{ name: `t${i}.txt` }, ...(i % 2 ? [{ name: `r${i}_TCD.csv`, warn: 'not <b>' }] : [])];
  return { cb, note: c.note ? (f, i) => `<select data-i="${i}"><option>${i}</option></select>` : null };
}
export function runCase(c){
  const { files } = c, n = files.length, { cb, note } = callbacksOf(c), nIn = files.filter(U.isIncluded).length;
  const o = { html: H.listHtml(files, cb, note, c.head, nIn, U), indeterminate: nIn > 0 && nIn < n, includeAll: nIn < n };
  o.dl = files.map(f=>{
    const d = M.downloadOf(U, f);
    if (d.missing) return ['alert', 'The original file for “' + d.name + '” is not available.'];
    if (d.one) return d.one.bytes != null ? ['bytes', d.one.name, d.one.bytes] : ['blob', d.one.name, d.one.text];
    return ['zip', d.zip, d.entries];
  });
  const all = M.zipEntries(U, files);
  o.all = all.length ? ['zip', 'files.zip', all] : ['alert', 'No original files are available to download.'];
  o.drags = files.map((_, from)=> Array.from({ length: n + 1 }, (_, g)=> M.gapFor(g, from) == null ? null : [from, M.landing(g, from)]));
  return canon(o);
}
export const CASES = 40;

test('40 cases as v563\'s utils.js gave them (golden digests)', ()=>{
  const got = { cases: Array.from({ length: CASES }, (_, i)=> sha(runCase(caseOf(i + 1)))) };
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
