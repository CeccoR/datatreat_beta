/* Text files loaded into the modules that read them (DRS, GC), in every encoding and
   dialect the reader takes (textdata.js): UTF-16 LE and BE with and without the byte-order
   mark, ';' fields with ',' decimals, ',' fields with '.' decimals, a tab, runs of spaces,
   fields in quotes (a GC export quoting its ',' decimals: BACKLOG "CSV fields in quotes"),
   a header with units, a table aligned in columns. Each variant of the fixture loads, in
   one drop beside the fixture itself, to the same numbers; a file that is not a table of
   the module's, or not one way only (a GC export with ',' as both separator and decimal
   mark, one aligned in columns with a blank cell), is refused and said. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, settle, moduleState } from './helpers.mjs';
import { drsCsv, gcCsv } from './fixtures.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const utf16 = (s, be, bom)=>{
  const b = Buffer.from(s, 'utf16le');
  if (be) for (let i = 0; i < b.length; i += 2){ const t = b[i]; b[i] = b[i + 1]; b[i + 1] = t; }
  return Buffer.concat([bom ? Buffer.from(be ? [0xfe, 0xff] : [0xff, 0xfe]) : Buffer.alloc(0), b]);
};
const rows = text => text.trim().split('\n').map(l=> l.split(','));
const write = (rs, sep, dec, q = false)=> rs.map(r=> r.map(c=>{
  const v = /^-?\d+\.\d+$/.test(c) ? c.replace('.', dec) : c;
  return q ? '"' + v.replace(/"/g, '""') + '"' : v;
}).join(sep)).join('\r\n') + '\r\n';
// The same, aligned in columns: each padded with spaces to 3 past its widest cell.
const align = rs => rs.map(r=> r.map((c, j)=> j < r.length - 1 ? c.padEnd(Math.max(...rs.map(x=> (x[j] || '').length)) + 3) : c).join('')).join('\n') + '\n';
// Every variant of a fixture's text, by file name.
function variants(text, extra){
  const R = rows(text);
  return {
    'u16le.csv': utf16(text, false, false), 'u16le-bom.csv': utf16(text, false, true),
    'u16be.csv': utf16(text, true, false), 'u16be-bom.csv': utf16(text, true, true),
    'semi-comma.csv': Buffer.from(write(R, ';', ',')), 'comma-dot.csv': Buffer.from(write(R, ',', '.')),
    'tab.csv': Buffer.from(write(R, '\t', '.')), 'tab-comma.csv': Buffer.from(write(R, '\t', ',')),
    'quoted.csv': Buffer.from(write(R, ',', ',', true)),
    ...extra(R),
  };
}
const file = (name, buffer)=> ({ name, mimeType: 'text/csv', buffer });
// Drop the files, then wait for the list to hold `n` rows.
async function drop(page, mod, files, n){
  await page.setInputFiles(`#${mod}Files`, files);
  await page.waitForFunction(([sel, n])=> document.querySelectorAll(sel).length >= n && !document.querySelector('.dz-loading'), [`#${mod}FileTableWrap tr.file-row`, n], { timeout: 20000 });
  await settle(page);
}

test('DRS: every encoding and dialect loads to the numbers of the fixture', async ()=>{
  const ref = drsCsv({ Eg: 3.2 }).toString('utf8');
  const vs = variants(ref, R=>{ const data = R.slice(2);
    return {
      'spaces.txt': Buffer.from('Sample\n  Wavelength (nm)   F(R)\n' + data.map(r=> '  ' + r[0] + '   ' + r[1]).join('\n')),
      'aligned.txt': Buffer.from(align(R)),
      'spaces-comma.txt': Buffer.from(data.map(r=> r[0] + ' ' + r[1].replace('.', ',')).join('\n')),
      'units.csv': Buffer.from('Spectrum 1;\nWavelength (nm);F(R) (a.u.);\n\n' + data.map(r=> r[0] + ';' + r[1].replace('.', ',') + ';').join('\n\n')),
    }; });
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    const names = Object.keys(vs);
    await drop(page, 'tauc', [file('ref.csv', Buffer.from(ref)), ...names.map(n=> file(n, vs[n])),
      file('three.csv', Buffer.from('Sample,\nWavelength (nm),R%,F(R)\n250,10,0.5\n251,11,0.6\n'))], 1 + names.length);
    const st = await moduleState(page, 'tauc', true), by = Object.fromEntries(st.files.map(f=> [f.name, f]));
    assert.equal(by['ref.csv'].wl.length, 551);
    for (const n of names){
      assert.ok(by[n], n + ' not loaded');
      assert.deepEqual(by[n].wl, by['ref.csv'].wl, n + ': wavelengths');
      assert.deepEqual(by[n].FR, by['ref.csv'].FR, n + ': F(R)');
      // The standard header (title, then "Wavelength (nm)" and "F(R)") whatever the dialect.
      assert.equal(by[n].warn, n === 'spaces-comma.txt', n + ': the non-standard-format warning');
    }
    const alerts = await page.locator('#taucAlerts').textContent();
    assert.match(alerts, /Invalid file\(s\):\s*three\.csv/, 'three columns refused, and said');
    // (how it was read said: no header, F(R); the standard ones need no word)
    assert.match(alerts, /Verify how these files were read:\s*spaces-comma\.txt: no header naming the columns F\(R\) or R%: read as F\(R\)\s*$/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('GC: every encoding and dialect loads to the numbers of the fixture, quoted decimals too', async ()=>{
  const ref = gcCsv({ h2: [0.05, 0.12], o2: [0.02, 0.05], seed: 7 }).toString('utf8');
  const vs = variants(ref, R=> ({
    'title.csv': Buffer.from('Run 12, photocatalysis\r\n' + ref),
    'aligned.txt': Buffer.from(align(R)),
    'units.csv': Buffer.from(ref.replace('Injection date,H2 (B) [%Mol],O2 (A) [%Mol]', 'Injection date (local);H2 (B) [%Mol];O2 (A) [%Mol]').replace(/,/g, ';')),
  }));
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    const names = Object.keys(vs);
    await drop(page, 'gc', [file('ref.csv', Buffer.from(ref)), ...names.map(n=> file(n, vs[n])),
      file('nodate.csv', Buffer.from('Time,H2 (B) [%Mol]\n1,0.5\n')),
      file('comma-both.csv', Buffer.from(write(rows(ref), ',', ','))),
      file('aligned-blank.txt', Buffer.from(align(rows(ref).map((r, i)=> i === 3 ? [r[0], '', r[2]] : r))))], 1 + names.length);
    const st = await moduleState(page, 'gc', true), by = Object.fromEntries(st.files.map(f=> [f.name, f]));
    assert.equal(by['ref.csv'].injDates.length, 24);
    assert.deepEqual(Object.keys(by['ref.csv'].gas), ['h2', 'o2']);
    for (const n of names){
      assert.ok(by[n], n + ' not loaded');
      assert.deepEqual(by[n].injDates, by['ref.csv'].injDates, n + ': injection dates');
      assert.deepEqual(by[n].gas, by['ref.csv'].gas, n + ': H2 and O2');
      assert.equal(by[n].emptyRows, 0, n);
    }
    assert.match(await page.locator('#gcAlerts').textContent(), /Invalid file\(s\):\s*nodate\.csv\s*comma-both\.csv\s*aligned-blank\.txt/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a name already loaded is said and not loaded again; dismissed, the alert goes', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await drop(page, 'gc', env.fx.files.gc, 2);
    await page.setInputFiles('#gcFiles', env.fx.files.gc[0]);
    await settle(page);
    assert.equal(await page.locator('#gcFileTableWrap tr.file-row').count(), 2);
    assert.match(await page.locator('#gcAlerts').textContent(), /Already loaded file\(s\):\s*alpha\.csv/);
    await page.click('#gcAlerts [data-action="gc-dismiss-upload"]');
    assert.doesNotMatch(await page.locator('#gcAlerts').textContent(), /Already loaded/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
