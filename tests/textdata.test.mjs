/* The text reader (textdata.js), in Node: no browser. The encodings (UTF-8 with and without
   its mark, UTF-16 LE and BE with and without theirs), the lines, the fields (quotes, runs of
   spaces, a trailing separator), the numbers with either decimal mark, and the separator
   found per file: the DRS spectrum and the GC export of the fixtures written in every dialect
   read back to the same numbers as the files the tests load; a GC export with ',' as both
   separator and decimal mark is not read. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textEncoding, decodeText, textLines, splitFields, parseNum, isNum, readXY, readTable } from '../textdata.js';
import { drsCsv, gcCsv } from './fixtures.mjs';

const utf16 = (s, be, bom)=>{
  const b = Buffer.from(s, 'utf16le');
  if (be) for (let i = 0; i < b.length; i += 2){ const t = b[i]; b[i] = b[i + 1]; b[i + 1] = t; }
  return new Uint8Array(Buffer.concat([bom ? Buffer.from(be ? [0xfe, 0xff] : [0xff, 0xfe]) : Buffer.alloc(0), b]));
};
// A table of the fixture's cells written again: `sep` between the fields, `dec` the decimal
// mark of the numbers, every field in quotes with `q`.
const rows = text => text.trim().split('\n').map(l=> l.split(','));
const write = (rs, sep, dec, q = false)=> rs.map(r=> r.map(c=>{
  const v = /^-?\d+\.\d+$/.test(c) ? c.replace('.', dec) : c;
  return q ? '"' + v.replace(/"/g, '""') + '"' : v;
}).join(sep)).join('\r\n') + '\r\n';
// The same, aligned in columns: each padded with spaces to 3 past its widest cell.
const align = rs => rs.map(r=> r.map((c, j)=> j < r.length - 1 ? c.padEnd(Math.max(...rs.map(x=> (x[j] || '').length)) + 3) : c).join('')).join('\n') + '\n';

test('encodings: UTF-8 with or without its mark, UTF-16 LE and BE by the mark or by the NULs', ()=>{
  const s = 'Wavelength (nm),F(R)\n250,0.5\n';
  assert.equal(textEncoding(new Uint8Array(Buffer.from(s))), 'utf-8');
  assert.equal(decodeText(new Uint8Array(Buffer.from('﻿' + s))), s, 'the UTF-8 mark is taken off');
  for (const be of [false, true]) for (const bom of [false, true]){
    const b = utf16(s, be, bom);
    assert.equal(textEncoding(b), be ? 'utf-16be' : 'utf-16le', `be ${be} bom ${bom}`);
    assert.equal(decodeText(b), s, `be ${be} bom ${bom}`);
    assert.equal(decodeText(b.buffer), s, 'an ArrayBuffer too');
  }
  assert.equal(decodeText(new Uint8Array(0)), '');
  // Latin text in UTF-8 has no NUL: not taken for UTF-16.
  assert.equal(textEncoding(new Uint8Array(Buffer.from('µ°±\n1;2\n'))), 'utf-8');
});

test('lines and fields: line ends, blank lines, quotes, runs of spaces, a trailing separator', ()=>{
  assert.deepEqual(textLines('a\r\nb\n\n  \rc\r'), ['a', 'b', 'c']);
  assert.deepEqual(splitFields('"10/20/2026 9:00:00 AM","0,5089",x', ','), ['10/20/2026 9:00:00 AM', '0,5089', 'x']);
  assert.deepEqual(splitFields('"a ""b"", c";d', ';'), ['a "b", c', 'd']);
  assert.deepEqual(splitFields('350;0,5;', ';'), ['350', '0,5', '']);
  assert.deepEqual(splitFields('  350 \t  0.5  ', ' '), ['350', '0.5']);
  assert.deepEqual(splitFields('"Wavelength (nm)"  "F(R)"', ' '), ['Wavelength (nm)', 'F(R)']);
  // A tab or two spaces and more: the single spaces of a name or a date stay in it.
  assert.deepEqual(splitFields('  Injection Date     H2 (B) [%Mol] \t O2\t\t ', '  '), ['Injection Date', 'H2 (B) [%Mol]', 'O2']);
  assert.deepEqual(splitFields('10/20/2026 9:00:00 AM  0.5 \t0.2', '  '), ['10/20/2026 9:00:00 AM', '0.5', '0.2']);
  assert.deepEqual(splitFields('"a  b"   c', '  '), ['a  b', 'c']);
  // A quote that never closes: the line split as it stands, as utils.splitCSVLine did.
  assert.deepEqual(splitFields('"10/20/2026 9:00:00 AM;0,5', ';'), ['10/20/2026 9:00:00 AM', '0,5']);
  assert.deepEqual(splitFields('', ','), ['']);
});

test('numbers: either decimal mark, "." only ever one, what follows a number not read', ()=>{
  assert.equal(parseNum('0,523'), 0.523);
  assert.equal(parseNum(' 350.5 '), 350.5);
  assert.equal(parseNum('1,234.5'), 1234.5);
  assert.equal(parseNum('-1,5e-3'), -0.0015);
  assert.equal(parseNum('350 nm'), 350);
  for (const v of ['', 'F(R)', undefined, null]) assert.ok(Number.isNaN(parseNum(v)), String(v));
  assert.ok(isNum('0,523') && isNum('-.5') && isNum('1e3') && isNum('1,234.5'));
  assert.ok(!isNum('250 37') && !isNum('350 nm') && !isNum('') && !isNum(undefined));
});

test('DRS: two columns of numbers read the same in every dialect', ()=>{
  const ref = decodeText(new Uint8Array(drsCsv({ Eg: 3.2 }))), R = rows(ref);
  const want = readXY(textLines(ref));
  assert.equal(want.sep, ',');
  assert.equal(want.x.length, 551);
  assert.deepEqual([want.x[0], want.y[0]], [250, +R[2][1]]);
  const data = R.slice(2);
  const cases = {
    'UTF-16 LE': decodeText(utf16(ref, false, false)),
    'UTF-16 BE, its mark': decodeText(utf16(ref, true, true)),
    "';' fields, ',' decimals": write(R, ';', ','),
    "',' fields, '.' decimals": write(R, ',', '.'),
    "tab, ',' decimals": write(R, '\t', ','),
    'tab': write(R, '\t', '.'),
    'quoted': write(R, ',', '.', true),
    "quoted ',' decimals, ',' fields": write(R, ',', ',', true),
    'spaces': R.map(r=> r.join('   ')).join('\n'),
    "spaces, ',' decimals": data.map(r=> ' ' + r[0] + ' ' + r[1].replace('.', ',')).join('\n'),
    "a header with units, a trailing ';', blank lines": 'Wavelength (nm);F(R) (a.u.);\n\n' + data.map(r=> r[0] + ';' + r[1].replace('.', ',') + ';').join('\n\n'),
  };
  for (const [what, text] of Object.entries(cases)){
    const t = readXY(textLines(text));
    assert.ok(t, what + ': not read');
    assert.deepEqual(t.x, want.x, what);
    assert.deepEqual(t.y, want.y, what);
  }
  assert.equal(readXY(textLines(cases["';' fields, ',' decimals"])).sep, ';');
  // Runs of three spaces: a tie of the two space separators, the runs of two first.
  assert.equal(readXY(textLines(cases['spaces'])).sep, '  ');
  assert.equal(readXY(textLines(cases["spaces, ',' decimals"])).sep, ' ');
});

test("DRS: a ',' is a decimal mark where another separator splits the fields, or splitting on it breaks the columns", ()=>{
  const one = (text, sep, x, y)=>{ const t = readXY(textLines(text)); assert.equal(t.sep, sep, text); assert.deepEqual([t.x, t.y], [x, y], text); };
  one('350,5;0,523\n351,5;0,529', ';', [350.5, 351.5], [0.523, 0.529]);
  one('350,5\t0,523\n351,5\t0,529', '\t', [350.5, 351.5], [0.523, 0.529]);
  one('350,5 0,523\n351,5 0,529', ' ', [350.5, 351.5], [0.523, 0.529]);
  one('350.5,0.523\n351.5,0.529', ',', [350.5, 351.5], [0.523, 0.529]);
  one('350, 0.5\n351, 0.6', ',', [350, 351], [0.5, 0.6]);   // a tie with the spaces: ',' first
  // Three columns are not a spectrum, and text is not one either.
  assert.equal(readXY(textLines('Sample,\nWavelength (nm),R%,F(R)\n250,10,0.5\n251,11,0.6\n')), null);
  assert.equal(readXY(textLines('hello\nworld\n')), null);
  assert.equal(readXY([]), null);
  // A row with an empty cell between its two numbers gives nothing, as to v483.
  one('Sample,\nWavelength (nm),F(R)\n250,,0.5\n251,0.6\n', ',', [251], [0.6]);
});

// The GC export's header and rows, as gc.js reads them.
const DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i;
const head = f =>{ const lo = f.map(h=> h.toLowerCase()), date = lo.findIndex(h=> h.includes('injection date')), h2 = lo.findIndex(h=> /(^|[^a-z0-9])h2([^a-z0-9]|$)/.test(h) && h.includes('%mol'));
  return date >= 0 && h2 >= 0 && h2 !== date ? { date, h2 } : null; };
const gcRead = text =>{ const t = readTable(textLines(text), head, (r, c)=> DATE.test((r[c.date] || '').trim())); return t && { sep: t.sep, dates: t.rows.map(r=> r[t.cols.date]), h2: t.rows.map(r=> parseNum(r[t.cols.h2])) }; };

test('GC: the columns its header names, read the same in every dialect', ()=>{
  const ref = decodeText(new Uint8Array(gcCsv({ h2: [0.05, 0.12], o2: [0.02, 0.05], seed: 7 }))), R = rows(ref);
  const want = gcRead(ref);
  assert.equal(want.sep, ',');
  assert.equal(want.dates.length, 24);
  const cases = {
    'UTF-16 LE, its mark': decodeText(utf16(ref, false, true)),
    'UTF-16 BE': decodeText(utf16(ref, true, false)),
    "';' fields, ',' decimals": write(R, ';', ','),
    "tab, ',' decimals": write(R, '\t', ','),
    // BACKLOG "CSV fields in quotes": H2 read 0 and O2 took the next column (to v483).
    "',' fields, quoted ',' decimals": write(R, ',', ',', true),
    'a title line above the header': 'Run 12, photocatalysis\n' + ref,
    'aligned in columns': align(R),
    "aligned in columns, ',' decimals": align(R.map(r=> r.map(c=> c.replace(/^(-?\d+)\.(\d+)$/, '$1,$2')))),
    'aligned with tabs': R.map(r=> r.join('\t\t')).join('\n'),
  };
  for (const [what, text] of Object.entries(cases)){
    const t = gcRead(text);
    assert.ok(t, what + ': not read');
    assert.deepEqual(t.dates, want.dates, what);
    assert.deepEqual(t.h2, want.h2, what);
  }
  assert.equal(gcRead('Time,H2 [%Mol]\n1,0.5\n'), null, 'no injection date');
  assert.equal(gcRead(align(R)).sep, '  ');
  // Single spaces cut the header's names and the dates: not a GC table.
  assert.equal(gcRead(R.map(r=> r.join(' ')).join('\n')), null);
  // Aligned, a blank cell leaves no field: the O2 after it would read as H2. Not read.
  const blank = R.map(r=> r.slice()); blank[3][1] = '';
  assert.equal(gcRead(align(blank)), null);
  assert.equal(gcRead(write(blank, '\t', '.')).h2[2], NaN, 'under a tab the blank cell stays');
});

test("GC: ',' as both separator and decimal mark is not read; a column the header does not name reads as before", ()=>{
  const H = 'Injection date,H2 (B) [%Mol],O2 (A) [%Mol]\n';
  // 0,5089 | 0,2011 or 0 | 5089,0 | 2011...: to v483 H2 read 0 and O2 5089.
  assert.equal(gcRead(H + '10/20/2026 9:00:00 AM,0,5089,0,2011\n10/20/2026 9:30:00 AM,0,6100,0,2500\n'), null);
  assert.equal(gcRead(H + '10/20/2026 9:00:00 AM,0.5089,0.2011\n10/20/2026 9:30:00 AM,,0,2500\n'), null, 'one line is enough');
  // In quotes, or under ';', the ',' decimals read.
  assert.deepEqual(gcRead(H + '10/20/2026 9:00:00 AM,"0,5089","0,2011"\n').h2, [0.5089]);
  assert.deepEqual(gcRead(H.replace(/,/g, ';') + '10/20/2026 9:00:00 AM;0,5089;0,2011\n').h2, [0.5089]);
  // Wider than the header with no number cut in two, or with a trailing ',': read.
  assert.deepEqual(gcRead(H + '10/20/2026 9:00:00 AM,0.5089,0.2011,run 3\n10/20/2026 9:30:00 AM,0.61,0.25,\n').h2, [0.5089, 0.61]);
  assert.deepEqual(gcRead(H.replace(/,/g, ';') + '10/20/2026 9:00:00 AM;0,5089;0,2011;7;8\n').h2, [0.5089]);
});
