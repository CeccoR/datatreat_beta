/* =========================================================
   TEXT DATA
   Reading a table of text as instruments and spreadsheets write it, for every module
   that takes one (DRS, GC):
   - the bytes decoded: UTF-8 with or without its byte-order mark, UTF-16 LE or BE by its
     mark or, without one, by the NUL byte beside each character of ASCII text (as
     xrd-instr.js decodeXml finds an XML file's). Blob.text() decodes UTF-8 alone (Chromium
     honours a UTF-16 mark as well): a UTF-16 file without its mark, in every browser, read
     as characters with a NUL between them and was refused (to v489);
   - the lines, the blank ones left out, whatever ends them (\r\n, \n, \r);
   - each line's fields under a separator, ';', a tab, ',' or a run of spaces (of two or
     more first: a table aligned in columns): a field in double quotes is taken whole
     (RFC 4180: the separator inside it is text, "" a quote);
   - the separator of each file found from its lines: the one under which the most of
     them read as the module expects (DRS two columns of numbers, GC the columns its
     header names), on a tie the first of ';', tab, ',', spaces. A ',' is a decimal mark
     wherever it is not the separator: '350,5;0,523' is two fields, and on ',' it would be
     three, which two columns of numbers are not; a GC line wider than its header, a
     number cut in two (0,5089,0,2011 under three names), is not read on ',' either. Under
     spaces a GC line has all its header's fields (a blank cell leaves none);
   - numbers with either decimal mark: '.' only ever is one (a ',' beside it groups the
     thousands, 1,234.5), and a ',' is one in a number without a '.' (0,523).
   To v489 DRS took ';' if its first two lines had one, else a tab, else ','; GC the first
   of ';', ',', tab in its header line, and took off the quotes at a field's ends but split
   on a separator inside them ("0,5089" in a ','-file); DRS read no quotes; neither read a
   run of spaces.
   No DOM here: the tests run it in Node.
========================================================= */

// The encoding of a text file's bytes.
export function textEncoding(b){
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return 'utf-8';
  if (b[0] === 0xff && b[1] === 0xfe) return 'utf-16le';
  if (b[0] === 0xfe && b[1] === 0xff) return 'utf-16be';
  // No mark: ASCII in UTF-16 has a NUL after each character (LE) or before it (BE), in
  // most pairs of bytes; UTF-8 text has none.
  const n = Math.min(b.length, 4096) >> 1;
  let even = 0, odd = 0;
  for (let i = 0; i < n; i++){ if (!b[2*i]) even++; if (!b[2*i + 1]) odd++; }
  if (odd > n/2 && even < n/8) return 'utf-16le';
  if (even > n/2 && odd < n/8) return 'utf-16be';
  return 'utf-8';
}
// A file's text from its bytes, the mark of its encoding taken off.
export function decodeText(bytes){
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new TextDecoder(textEncoding(b)).decode(b);
}
export const textLines = text => text.split(/\r\n|\r|\n/).filter(l=> l.trim());

/* The separators tried, in the order a tie goes to. '  ' is a tab or a run of two spaces
   or more, as in a table aligned in columns, whose names and dates keep their single
   spaces ('Injection Date', '10/20/2026 9:00:00 AM'); ' ' is any run of spaces or tabs. */
export const SEPS = [';', '\t', ',', '  ', ' '];
const RUN = { '  ': /[ \t]{2,}|\t/y, ' ': /[ \t]+/y };
/* A line's fields under `sep`, each trimmed. A field that opens with a double quote runs
   to the quote that closes it, the separator inside it text and "" a quote; a quote at the
   end of a field without one is dropped, and a line whose quote never closes is split as
   it stands, a quote at either end of a field dropped (as utils.splitCSVLine did, to v491). */
export function splitFields(line, sep){
  const run = RUN[sep], s = run ? line.trim() : line, out = [];
  // Whether a separator starts at i; a run of spaces is gone past (lastIndex).
  const isSep = i => run ? (run.lastIndex = i, run.test(s)) : s[i] === sep;
  let f = '', q = false, quoted = false;
  const push = ()=>{ out.push(quoted ? f.trim() : f.trim().replace(/"$/, '')); f = ''; quoted = false; };
  for (let i = 0; i < s.length; i++){
    const c = s[i];
    if (q){ if (c !== '"') f += c; else if (s[i + 1] === '"'){ f += '"'; i++; } else q = false; }
    else if (c === '"' && !f.trim()){ q = quoted = true; f = ''; }
    else if (isSep(i)){ push(); if (run) i = run.lastIndex - 1; }
    else f += c;
  }
  if (q) return s.split(run ? new RegExp(run.source) : sep).map(x=> x.trim().replace(/^"|"$/g, ''));
  push();
  return out;
}
// A number with either decimal mark ('.' or ','), NaN for none. As parseFloat, what
// follows the number is not read ('350 nm' is 350).
const GROUPED = /^[+-]?\d{1,3}(,\d{3})+\.\d*([eE][+-]?\d+)?$/, NUM = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/;
export function parseNum(s){
  if (s == null) return NaN;
  s = String(s).trim();
  return parseFloat(GROUPED.test(s) ? s.replace(/,/g, '') : s.replace(',', '.'));
}
// A field that is a number and nothing else: what the separators are told apart by
// ('250 37,5' split on ',' gives '250 37', which parseNum would take for 250).
export const isNum = s => s != null && (NUM.test(s = String(s).trim()) || GROUPED.test(s));

/* The separator a file is written with: the one under which `fit(rows, sep)`, its lines
   split into fields, takes the most, on a tie the first of SEPS. `fit` gives { score,
   ...what it read } or null (none, or not this separator). → { sep, rows, ...that } or null. */
export function bestSep(lines, fit){
  let best = null;
  for (const sep of SEPS){
    const rows = lines.map(l=> splitFields(l, sep)), r = fit(rows, sep);
    if (r && r.score > 0 && (!best || r.score > best.score)) best = { sep, rows, ...r };
  }
  return best;
}

/* Two columns of numbers, x and y, under whatever lines come before them (a title, a
   header with units). A line is data when its first two fields that are not empty are
   numbers; a separator under which a data line has a third is not the file's (three
   columns). Numbers there are fields that are nothing else (isNum), so that a ',' that is
   a decimal mark breaks the columns it is split on ('350,5 0,523' on ',': 350 | 5 0 | 523);
   with no line of those under any separator, any field parseNum reads (to v489 the only
   test). Each line gives its first two fields, as they stand (one empty: nothing).
   → { sep, rows, x, y } or null. */
export function readXY(lines){
  const fit = num => rows =>{
    let score = 0;
    for (const r of rows){
      const v = r.filter(c=> c !== '');
      if (!num(v[0]) || !num(v[1])) continue;
      if (v.length > 2) return null;
      score++;
    }
    return { score };
  };
  const t = bestSep(lines, fit(isNum)) || bestSep(lines, fit(s=> isFinite(parseNum(s))));
  if (!t) return null;
  const x = [], y = [];
  for (const r of t.rows){ const a = parseNum(r[0]), b = parseNum(r[1]); if (isFinite(a) && isFinite(b)){ x.push(a); y.push(b); } }
  return x.length ? { sep: t.sep, rows: t.rows, x, y } : null;
}

// A line's fields up to the last that is not empty (a trailing separator adds none).
const width = r =>{ let n = r.length; while (n && r[n - 1] === '') n--; return n; };
// A whole number, then digits: the halves of a number its decimal ',' cut in two.
const cut = (a, b)=> /^[+-]?\d+$/.test(a) && /^\d+([eE][+-]?\d+)?$/.test(b || '');
/* A table under a header the module knows: `head(fields)` gives the columns a line names
   (null for any other line), `isRow(fields, cols)` whether a line under it is data. Under
   each separator the first line `head` takes is the header, and the separator under which
   the most lines below it are data is the file's. Not ',' when a data line is wider than
   the header with a number cut in two: the ',' is the decimal mark too, and which fields
   go together cannot be told ('0,0,2011' is 0,0 | 2011 or 0 | 0,2011), so the file is
   not read (to v489 GC read the halves as values: 0,5089 gave 0 and the next gas 5089).
   A line wider than its header with no number cut (a column it does not name) reads as
   it did. Not a run of spaces when a data line has other than the header's fields: a
   cell left blank leaves none there, and the cells after it would slip into its column.
   → { sep, cols, rows (those lines) } or null. */
export function readTable(lines, head, isRow){
  return bestSep(lines, (rows, sep)=>{
    for (let h = 0; h < rows.length; h++){
      const cols = head(rows[h]);
      if (!cols) continue;
      const n = width(rows[h]), body = rows.slice(h + 1), data = body.filter(r=> isRow(r, cols));
      if (sep === ',' && data.some(r=> width(r) > n && r.some((c, i)=> cut(c, r[i + 1])))) return null;
      if (sep[0] === ' ' && data.some(r=> r.length !== rows[h].length)) return null;
      return { score: data.length, cols, rows: body };
    }
    return null;
  });
}
