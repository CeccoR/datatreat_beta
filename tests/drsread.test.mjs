/* How DRS reads a file (v510, the user's rule, the way GC reads its own), in order:
   - the standard format, the Cary 5000's export (the sample's name, then "Wavelength (nm)"
     and "%R" or "F(R)" on the second line, the data from the third): its first two
     columns, read with no word;
   - any other file: said ("not a standard format: …"), and read from the columns its
     header names, a wavelength (Wavelength, λ, nm, with or without its unit, "(nm)",
     "[nm]", "/nm", "nm", "in nm", ", nm", "_nm", "nm.") and F(R) or the reflectance in %
     (R%, %R, % R, R (%), R [%], Reflectance (%)…), each by its place in the header,
     whatever the separator (',', ';', a tab, spaces, a header whose names a run of single
     spaces splits, "% R" and "Wavelength nm" among them), the decimal mark and the quotes,
     an empty or another column between them or the two the other way round, a title
     whose words name both above the header, a footer under the data;
   - no such columns, or not one way only: refused ("Invalid file(s)"), the reason said,
     escaped: no header (two bare columns of numbers, to v509 read as F(R); DataTreat's own
     reflectance_FR.csv, its columns named by the sample), no F(R) or %R column, the
     wavelength in another unit ("(eV)", "in eV", its words under spaces too), two columns
     of either kind, two samples side by side, a header split by one separator over data
     split by another.
   A project saved before, holding a file the rule now refuses, opens as it was: its data
   (kept in the project, not read again) and its note. In Node: readTable gives the header
   function the separator, and takes the header's width from it when it says one. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, settle, moduleState, injected, PAYLOAD } from './helpers.mjs';
import { drsCsv, caryCsv } from './fixtures.mjs';
import { textLines, readTable } from '../textdata.js';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const ref = drsCsv({ Eg: 3.2 }).toString('utf8'), D = ref.trim().split('\n').slice(2).map(l=> l.split(','));
// The fixture's F(R) as the reflectance in % (R = 1 + F − √(F² + 2F)), to 6 decimals.
const Rp = F => (100*(1 + F - Math.sqrt(F*F + 2*F))).toFixed(6);
// The fixture's rows, each made by `cells(wavelength, F)`, under `sep`.
const body = (cells, sep = ',')=> D.map(([w, f])=> cells(w, f).join(sep)).join('\n') + '\n';
const dec = s => s.replace('.', ',');
const file = (name, text)=> ({ name, mimeType: 'text/csv', buffer: Buffer.isBuffer(text) ? text : Buffer.from(text) });
async function drop(page, files){
  await page.setInputFiles('#taucFiles', files);
  await page.waitForFunction(()=> document.querySelector('#taucFileTableWrap tr.file-row') && !document.querySelector('.dz-loading'), null, { timeout: 20000 });
  await settle(page);
}
const WARN_R = 'not a standard format: its header names the reflectance in %, read as %R', WARN_F = 'not a standard format: its header names F(R), read as F(R)';

test('the standard format: its first two columns, read with no word', async ()=>{
  const cary = caryCsv();
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    // (the Cary's own export, a row with an empty cell between its numbers among its rows:
    // the Cary writes none, and it is read from its first two columns, as to v509: left out)
    const lines = cary.buffer.toString('utf8').split('\r\n'); lines.splice(3, 0, '799.75,,98.5,');
    await drop(page, [file('cary.csv', cary.buffer), file('ref.csv', ref), file('cary-gap.csv', lines.join('\r\n'))]);
    const st = await moduleState(page, 'tauc', true), by = Object.fromEntries(st.files.map(f=> [f.name, f]));
    assert.equal((await page.locator('#taucAlerts').innerText()).trim(), '', 'no alert');
    assert.deepEqual([by['cary.csv'].read, by['cary.csv'].warn, by['cary.csv'].head, by['cary.csv'].wl], ['R%', false, undefined, cary.wl]);
    by['cary.csv'].FR.forEach((v, i)=>{ const R = cary.R[i]/100; assert.ok(Math.abs(v - (1 - R)**2/(2*R)) <= 1e-12*Math.max(1, v), `F(R) at ${cary.wl[i]} nm`); });
    assert.deepEqual([by['ref.csv'].read, by['ref.csv'].warn, by['ref.csv'].wl, by['ref.csv'].FR], [undefined, false, D.map(r=> +r[0]), D.map(r=> +r[1])]);
    assert.deepEqual([by['cary-gap.csv'].wl, by['cary-gap.csv'].FR, by['cary-gap.csv'].left], [by['cary.csv'].wl, by['cary.csv'].FR, undefined]);
    assert.deepEqual(await page.$$eval('#taucFileTableWrap td.note-cell [title]', s=> s.map(e=> [e.textContent, e.title])), [
      ['%R', 'second column read as the reflectance in %, converted to F(R)'], ['F(R)', 'second column read as F(R)'],
      ['%R', 'second column read as the reflectance in %, converted to F(R)']]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('any other format: said, and read from the columns its header names', async ()=>{
  const cary = caryCsv();
  const R = (w, f)=> [w, Rp(+f)];
  const files = {
    'comma.csv': ['Wavelength (nm),%R\n' + body(R), 'R'],
    'semi.csv': ['Title;x\nnm;R (%)\n' + body((w, f)=> [w, dec(Rp(+f))], ';'), 'R'],
    'tab.txt': ['λ (nm)\tReflectance (%)\n' + body(R, '\t'), 'R'],
    // a header under runs of two spaces, the data under one: the names split as the data are
    'spaces.txt': ['Sample one\nWavelength (nm)  R (%)\n' + body(R, ' '), 'R'],
    'aligned.txt': ['WAVELENGTH [NM]   F(R) (a.u.)\n' + body((w, f)=> [w, f], '    '), 'F'],
    'quoted.csv': ['"Wavelength/nm","R [%]"\n' + body((w, f)=> ['"' + w + '"', '"' + dec(Rp(+f)) + '"']), 'R'],
    'fr.csv': ['wavelength,F(R)\n' + body((w, f)=> [w, f]), 'F'],
    'pct.csv': ['Wavelength,% R\n' + body(R), 'R'],
    // an empty column between them, another column, the two the other way round
    'gap.csv': ['Wavelength,,%R\n' + body((w, f)=> [w, '', Rp(+f)]), 'R'],
    'extra.csv': ['nm,Abs,%R\n' + body((w, f)=> [w, '0.3', Rp(+f)]), 'R'],
    'swapped.csv': ['%R,Wavelength\n' + body((w, f)=> [Rp(+f), w]), 'R'],
    // "% R" under single spaces, and over them under two: one name, its '%' not the
    // wavelength's; "Wavelength nm" one name
    'pct-sp.txt': ['Wavelength (nm) % R\n' + body(R, ' '), 'R'],
    'pct-sp2.txt': ['Wavelength (nm)  % R\n' + body(R, ' '), 'R'],
    'wl-nm-sp.txt': ['Wavelength nm %R\n' + body(R, ' '), 'R'],
    // the wavelength's unit written otherwise (each read at v509 too)
    'wl-comma.csv': ['Wavelength, nm;F(R)\n' + body((w, f)=> [w, f], ';'), 'F'],
    'wl-quoted.csv': ['"Wavelength, nm",F(R)\n' + body((w, f)=> [w, f]), 'F'],
    'wl-in.csv': ['Wavelength in nm,F(R)\n' + body((w, f)=> [w, f]), 'F'],
    'wl-under.csv': ['Wavelength_nm,F(R)\n' + body((w, f)=> [w, f]), 'F'],
    'wl-dot.csv': ['Wavelength (nm.),F(R)\n' + body((w, f)=> [w, f]), 'F'],
    'wl-nmdot.csv': ['"Sample - RawData"\n"Wavelength nm.","R%"\n' + body((w, f)=> ['"' + w + '.0"', '"' + Rp(+f) + '"']), 'R'],
    // a title whose words name both above a table under spaces: the header the line nearest
    // above the data
    'title.txt': ['Kubelka-Munk F(R) vs wavelength\nSample A\nWavelength (nm)   F(R)\n' + body((w, f)=> [w, f], '   '), 'F'],
    'title-sp.txt': ['F(R) spectrum, wavelength scan\nSample A\nWavelength (nm) F(R)\n' + body((w, f)=> [w, f], ' '), 'F'],
  };
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    // The Cary's export with its header on the first line: its footer under the data.
    await drop(page, [...Object.entries(files).map(([n, [t]])=> file(n, t)), file('footer.csv', 'Wavelength (nm),%R,\r\n' + cary.buffer.toString('utf8').split('\r\n').slice(2).join('\r\n'))]);
    const st = await moduleState(page, 'tauc', true), by = Object.fromEntries(st.files.map(f=> [f.name, f]));
    const alerts = await page.locator('#taucAlerts').innerText();
    assert.doesNotMatch(alerts, /Invalid/);
    for (const [n, [, k]] of Object.entries(files)){
      assert.ok(by[n], n + ' not loaded');
      assert.deepEqual([by[n].warn, by[n].read, by[n].head], k === 'R' ? [true, 'R%', undefined] : [true, undefined, true], n);
      assert.deepEqual(by[n].wl, D.map(r=> +r[0]), n + ': wavelengths');
      by[n].FR.forEach((v, i)=>{ const F = +D[i][1]; assert.ok(Math.abs(v - F) < 1e-4*Math.max(1, F), `${n}: F(R) at ${D[i][0]} nm, ${v} for ${F}`); });
      assert.match(alerts, new RegExp('^' + n.replace('.', '\\.') + ': ' + (k === 'R' ? WARN_R : WARN_F).replace(/[()]/g, '\\$&') + '$', 'm'), n);
    }
    assert.deepEqual([by['footer.csv'].wl, by['footer.csv'].read, by['footer.csv'].warn], [cary.wl, 'R%', true]);
    by['footer.csv'].FR.forEach((v, i)=>{ const R = cary.R[i]/100; assert.ok(Math.abs(v - (1 - R)**2/(2*R)) <= 1e-12*Math.max(1, v)); });
    // The note's title: the column its header names, not the second.
    const notes = Object.fromEntries(await page.$$eval('#taucFileTableWrap tr.file-row', rs=> rs.map(r=> [r.querySelector('.file-label').value, r.querySelector('td.note-cell [title]').title])));
    assert.equal(notes.extra, 'the %R column its header names, read as the reflectance in %, converted to F(R); not a standard format');
    assert.equal(notes.fr, 'the F(R) column its header names, read as F(R); not a standard format');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('no columns found, or not one way only: refused, and why said, escaped', async ()=>{
  const cary = caryCsv(), two = caryCsv({ name: 'S2', seed: 5 }).buffer.toString('utf8').split('\r\n');
  const F = (w, f)=> [w, f];
  const files = [
    ['headerless.csv', body(F), 'no header naming its columns: the wavelength in nm, and F(R) or %R'],
    ['abs.csv', 'Wavelength,Abs\n' + body(F), 'its header names no F(R) or %R column'],
    ['ev.csv', 'Wavelength (eV),F(R)\n' + body((w, f)=> [(1239.842/+w).toFixed(4), f]), 'its header names the wavelength in another unit than nm (Wavelength (eV))'],
    ['jasco.csv', 'TITLE,x\nXUNITS,NANOMETERS\nYUNITS,%R\nXYDATA\n' + body((w, f)=> [w, Rp(+f)]), 'its header names no wavelength column in nm'],
    ['both.csv', 'Wavelength (nm),F(R),%R\n' + body((w, f)=> [w, f, Rp(+f)]), 'which columns to read cannot be told: its header names both F(R) and %R'],
    ['two-r.csv', 'Wavelength (nm),%R,R (%)\n' + body((w, f)=> [w, Rp(+f), Rp(+f)]), 'which columns to read cannot be told: its header names 2 %R columns'],
    ['two-wl.csv', 'nm,Wavelength,%R\n' + body((w, f)=> [w, w, Rp(+f)]), 'which columns to read cannot be told: its header names 2 wavelength columns'],
    // the Cary's export of two samples side by side (to v509 refused too, with no reason)
    ['side.csv', cary.buffer.toString('utf8').split('\r\n').map((l, i)=> i < 1203 ? l + two[i] : l).join('\r\n'),
      'which columns to read cannot be told: its header names 2 wavelength columns and 2 %R columns'],
    ['comma.csv', 'Wavelength,%R\n' + body((w, f)=> [dec(w + '.5'), dec(Rp(+f))]), 'no line of data read under its header'],
    // the wavelength "in eV", its words under spaces too: that unit said (not "no data")
    ['ev-in.csv', 'Wavelength in eV,F(R)\n' + body(F), 'its header names the wavelength in another unit than nm (Wavelength in eV)'],
    ['ev-in.txt', 'Wavelength in eV   F(R)\n' + body(F, '   '), 'its header names the wavelength in another unit than nm (Wavelength in eV)'],
    // the header split by ',', the data by ';' (to v509 read as F(R), with no header naming it)
    ['seps.csv', 'Wavelength (nm),F(R)\n' + body((w, f)=> [w, dec(f)], ';'), 'no line of data read under its header'],
    // DataTreat's own reflectance_FR.csv: its columns named by the sample, not F(R) (to v509
    // read as F(R), with no header naming it)
    ['reflectance_FR.csv', 'wavelength_nm_S1,S1\n' + body(F), 'no header naming its columns: the wavelength in nm, and F(R) or %R'],
    ['markup.csv', `Wavelength (${PAYLOAD}),F(R)\n` + body(F), `its header names the wavelength in another unit than nm (Wavelength (${PAYLOAD}))`],
    [PAYLOAD + '.csv', body(F), 'no header naming its columns: the wavelength in nm, and F(R) or %R'],
  ];
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await drop(page, [file('ref.csv', ref), ...files.map(([n, t])=> file(n, t))]);
    assert.deepEqual((await moduleState(page, 'tauc')).files.map(f=> f.name), ['ref.csv']);
    const alerts = await page.locator('#taucAlerts').innerText();
    assert.equal(alerts.trim(), '✕ Invalid file(s):\n' + files.map(([n, , why])=> `${n} (${why})`).join('\n'));
    assert.deepEqual(await injected(page), [], 'no element made from a header or a name');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a project saved before, holding a file read with no header: opened as it was', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await drop(page, [file('ref.csv', ref), file('fr.csv', 'Wavelength,F(R)\n' + body((w, f)=> [w, f]))]);
    // The record v509 made of two bare columns: read as F(R), its warning with no header named;
    // the file's bytes those two columns. Not read again: its data and its note as they were.
    const st = await page.evaluate(async ()=>{ const u = await import('./utils.js'), db = await import('./db.js'); return db.encode(u.getModuleState('tauc')); });
    const f = st.files[1];
    delete f.head; f.name = 'noheader.csv'; f.label = 'noheader';
    f.wl = f.wl.slice(0, 300); f.FR = f.FR.slice(0, 300);
    const r = await page.evaluate(async st=>{
      const u = await import('./utils.js'), db = await import('./db.js');
      try { u.restoreModuleState('tauc', db.decode(st)); } catch(e){ return 'threw: ' + e.message; }
      for (let i = 0; i < 3; i++) await new Promise(r=> requestAnimationFrame(r));
      return 'ok';
    }, st);
    assert.equal(r, 'ok');
    await settle(page);
    const s = await moduleState(page, 'tauc', true);
    assert.deepEqual(s.files.map(f=> [f.name, f.wl.length, f.warn, f.read, f.head]), [['ref.csv', 551, false, undefined, undefined], ['noheader.csv', 300, true, undefined, undefined]]);
    assert.deepEqual(s.files[1].FR, D.slice(0, 300).map(r=> +r[1]));
    assert.match(await page.locator('#taucAlerts').innerText(), /^⚠ Verify how these files were read:\s*noheader\.csv: no header naming the columns F\(R\) or R%: read as F\(R\)\s*$/);
    assert.deepEqual(await page.$$eval('#taucFileTableWrap td.note-cell [title]', s=> s.map(e=> e.title)), ['second column read as F(R)', 'second column read as F(R), with no header naming it']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('readTable: the header function given the separator, the header as wide as it says', ()=>{
  const seen = [];
  // Two names in four fields under single spaces: as wide as the two the data have.
  const head = (f, sep)=>{ seen.push(sep); return f[0] === 'Wavelength' ? { x: 0, y: 1, ...(sep === ' ' ? { n: 2 } : {}) } : null; };
  const t = readTable(textLines('Wavelength (nm) R (%)\n350 50\n351 60\n'), head, (r, c)=> /^\d+$/.test(r[c.x]));
  assert.deepEqual(new Set(seen), new Set([';', '\t', ',', '  ', ' ']));
  assert.deepEqual([t.sep, t.rows], [' ', [['350', '50'], ['351', '60']]]);
  // Without it, the header's fields: four, and the data's two are not the table's.
  assert.equal(readTable(textLines('Wavelength (nm) R (%)\n350 50\n'), f=> f[0] === 'Wavelength' ? { x: 0 } : null, (r, c)=> /^\d+$/.test(r[c.x])), null);
});
