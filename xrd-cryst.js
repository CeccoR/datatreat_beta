/* =========================================================
   XRD CRYSTALLOGRAPHY (Rietveld)
   CIF reading, symmetry, reflection lists and structure factors.
   Pure functions: no DOM, importable by the page, a Worker and Node.
========================================================= */
// Conventions shared with xrd-rietveld.js:
// - fractional coordinates; a symmetry operation is {R, t}, R a row-major 3×3 array of
//   numbers, acting as x' = R·x + t. A reflection is a row vector and goes as h' = h·R.
// - a cell is {a, b, c, alpha, beta, gamma} in Å and degrees; s = sinθ/λ = 1/(2d).
import { speciesKey, f0, fprime, atomicMass } from './xrd-data.js';

const IDENT = [1,0,0, 0,1,0, 0,0,1];
const B_DEFAULT = 0.5;          // Å², the usual guess for an inorganic solid at room temperature
const EIGHT_PI2 = 8*Math.PI*Math.PI;

/* ---------- small linear algebra ---------- */
function det3(m){
  return m[0]*(m[4]*m[8]-m[5]*m[7]) - m[1]*(m[3]*m[8]-m[5]*m[6]) + m[2]*(m[3]*m[7]-m[4]*m[6]);
}
function inv3(m){
  const d = det3(m);
  return [
    (m[4]*m[8]-m[5]*m[7])/d, (m[2]*m[7]-m[1]*m[8])/d, (m[1]*m[5]-m[2]*m[4])/d,
    (m[5]*m[6]-m[3]*m[8])/d, (m[0]*m[8]-m[2]*m[6])/d, (m[2]*m[3]-m[0]*m[5])/d,
    (m[3]*m[7]-m[4]*m[6])/d, (m[1]*m[6]-m[0]*m[7])/d, (m[0]*m[4]-m[1]*m[3])/d,
  ];
}
function mul3(a, b){
  const o = new Array(9);
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) o[3*i+j] = a[3*i]*b[j] + a[3*i+1]*b[3+j] + a[3*i+2]*b[6+j];
  return o;
}
const apply3 = (R, x) => [R[0]*x[0]+R[1]*x[1]+R[2]*x[2], R[3]*x[0]+R[4]*x[1]+R[5]*x[2], R[6]*x[0]+R[7]*x[1]+R[8]*x[2]];

// cos of an angle in degrees, exact at the angles cells are written with, so a cubic or
// hexagonal metric has true zeros (and −½) rather than 6e-17 residues that would split
// the d of reflections that are equal by symmetry.
function cosd(deg){
  if (deg === 90) return 0;
  if (deg === 120) return -0.5;
  if (deg === 60) return 0.5;
  return Math.cos(deg*Math.PI/180);
}
// x mod 1 in [0, 1). A value a rounding error below 1 folds to 0, so 1 − 1e-17 and 0 are
// one position, not two.
function mod1(v){ let w = v - Math.floor(v); if (w > 1 - 1e-9) w = 0; return w; }
// A translation to the nearest multiple of 1/24 (which holds 1/2, 1/3, 1/4, 1/6, 1/8, 1/12)
// when it is within 1.5e-3: '0.3333' is 1/3, and the absence test h·t ∈ ℤ stays exact.
function snapT(v){
  const w = mod1(v), k = Math.round(w*24);
  return Math.abs(w - k/24) < 1.5e-3 ? (k % 24)/24 : w;
}

/* ---------- metric ---------- */
// Direct metric G (a_i·a_j), reciprocal metric G* = G⁻¹ and the cell volume.
function metric(cell){
  const { a, b, c } = cell;
  const ca = cosd(cell.alpha ?? 90), cb = cosd(cell.beta ?? 90), cg = cosd(cell.gamma ?? 90);
  const G = [a*a, a*b*cg, a*c*cb,  a*b*cg, b*b, b*c*ca,  a*c*cb, b*c*ca, c*c];
  return { G, Gs: inv3(G), V: Math.sqrt(det3(G)) };
}
function dSpacing(Gs, h, k, l){
  return 1/Math.sqrt(h*h*Gs[0] + k*k*Gs[4] + l*l*Gs[8] + 2*(h*k*Gs[1] + h*l*Gs[2] + k*l*Gs[5]));
}

/* ---------- symmetry operations ---------- */
// 'x, -y+1/2, z+1/4' → {R, t}. Accepts '1/2+x', '-x+y', '0.5+x', '2*x', upper case,
// spaces, quotes, a typographic minus and a magnetic CIF's trailing time reversal (±1,
// irrelevant to X-rays). Throws on anything it cannot read or that is not a lattice
// operation (non-integer or non-invertible R): a misread operation would silently
// produce a wrong structure.
function parseSymop(str){
  if (typeof str !== 'string') throw new Error('Symmetry operation: not a string.');
  const s = str.replace(/[−–]/g, '-').replace(/['"\s]/g, '').toLowerCase().replace(/^\((.*)\)$/, '$1');
  const parts = s.split(',');
  if (parts.length === 4 && /^[+-]?1$/.test(parts[3])) parts.length = 3;
  const bad = why => new Error(`Symmetry operation '${str}': ${why}.`);
  if (parts.length !== 3) throw bad('expected three comma-separated components');
  const R = new Array(9).fill(0), t = [0,0,0];
  parts.forEach((p, i)=>{
    if (!p) throw bad(`component ${i+1} is empty`);
    let used = 0;
    for (const m of p.matchAll(/([+-]?)([^+-]+)/g)){
      if (m.index !== used) throw bad(`cannot read '${p}'`);
      used = m.index + m[0].length;
      const tm = /^(\d+\.?\d*|\.\d+)?(?:\/(\d+\.?\d*))?\*?([xyz])?$/.exec(m[2]);
      if (!tm || (!tm[1] && (tm[2] || !tm[3]))) throw bad(`cannot read '${m[2]}'`);
      const v = (m[1] === '-' ? -1 : 1)*(tm[1] ? parseFloat(tm[1]) : 1)/(tm[2] ? parseFloat(tm[2]) : 1);
      if (tm[3]) R[3*i + 'xyz'.indexOf(tm[3])] += v; else t[i] += v;
    }
    if (used !== p.length) throw bad(`cannot read '${p}'`);
  });
  if (R.some(v => v !== Math.round(v))) throw bad('the coefficients of x, y, z must be integers');
  if (Math.abs(det3(R)) !== 1) throw bad('not a symmetry operation (determinant ≠ ±1)');
  return { R, t: t.map(snapT) };
}

// {R, t} → 'x-y,x,z+1/6', for display and for comparing with printed tables.
function fracStr(v){
  for (const d of [1,2,3,4,6,8,12,24]){ const n = Math.round(v*d); if (Math.abs(v*d - n) < 1e-9) return d === 1 ? String(n) : `${n}/${d}`; }
  return String(+v.toFixed(6));
}
function symopString(op){
  const { R, t } = op;
  return [0,1,2].map(i=>{
    let s = '';
    for (let j=0;j<3;j++){
      const c = R[3*i+j]; if (!c) continue;
      const mag = Math.abs(c) === 1 ? '' : Math.abs(c);
      s += (c < 0 ? '-' : (s ? '+' : '')) + mag + 'xyz'[j];
    }
    const tv = mod1(t[i]);
    if (tv) s += (s ? '+' : '') + fracStr(tv);
    return s || '0';
  }).join(',');
}

// A key that identifies an operation modulo lattice translations (1e-3 in t).
function opKey(R, t){ return R.join(',') + '|' + t.map(v => Math.round(mod1(v)*1000) % 1000).join(','); }

// Duplicates removed (mod 1); identity kept first.
function uniqueOps(ops){
  const seen = new Set(), out = [];
  for (const op of ops){ const k = opKey(op.R, op.t); if (!seen.has(k)){ seen.add(k); out.push(op); } }
  return out;
}

// Products of operations that are not in the list: an empty array for a group. A list that
// is not closed is usually missing its centring translations (or a line of the loop).
function closureMisses(ops, max = 3){
  const keys = new Set(ops.map(o => opKey(o.R, o.t))), out = [];
  for (const a of ops) for (const b of ops){
    const R = mul3(a.R, b.R), Rt = apply3(a.R, b.t);
    const t = [Rt[0]+a.t[0], Rt[1]+a.t[1], Rt[2]+a.t[2]];
    if (!keys.has(opKey(R, t))){ out.push({ R, t }); if (out.length >= max) return out; }
  }
  return out;
}

/* ---------- CIF lexer and parser (CIF 1.1 subset, DDLm tag spellings accepted) ---------- */
const isWs = c => c === ' ' || c === '\t';
// One line into tokens {v, q (quoted: never a tag or keyword), line}.
function lexLine(line, n, out){
  const L = line.length;
  let i = 0;
  while (i < L){
    const c = line[i];
    if (isWs(c)){ i++; continue; }
    if (c === '#') break;
    if (c === "'" || c === '"'){
      // A quote closes only when white space or the end of the line follows it, so
      // 'O'Neil' is one value (CIF 1.1).
      let j = i + 1;
      while (j < L && !(line[j] === c && (j + 1 === L || isWs(line[j+1])))) j++;
      out.push({ v: line.slice(i+1, j), q: true, line: n });
      i = j + 1; continue;
    }
    let j = i;
    while (j < L && !isWs(line[j])) j++;
    out.push({ v: line.slice(i, j), q: false, line: n });
    i = j;
  }
}
function cifTokens(text){
  const lines = text.replace(/^﻿/, '').split(/\r\n?|\n/);
  const out = [];
  let n = 0;
  while (n < lines.length){
    let line = lines[n];
    if (line[0] === ';'){
      // A text field runs from a line starting with ';' to the next such line.
      const buf = [line.slice(1)];
      let m = n + 1;
      while (m < lines.length && lines[m][0] !== ';') buf.push(lines[m++]);
      out.push({ v: buf.join('\n').trim(), q: true, line: n });
      if (m >= lines.length) break;
      line = lines[m].slice(1); n = m;
    }
    lexLine(line, n, out);
    n++;
  }
  return out;
}
// CIF 1 (_atom_site_fract_x) and DDLm (_atom_site.fract_x) spellings are one tag here;
// tags are case-insensitive.
const normTag = t => t.toLowerCase().replace(/\./g, '_');
const XYZ_TAGS = ['_space_group_symop_operation_xyz', '_symmetry_equiv_pos_as_xyz'];

function makeLoop(tags, vals, warnings){
  const n = tags.length, rows = [];
  if (!n) return { tags, rows };
  // Symmetry operations written unquoted with spaces ("1 -x, y, z") split into several
  // values; when every line holds at least a row's worth, read one row per line and join
  // the surplus back into the xyz column. Only when the plain row-major reading fails:
  // quoted operations several rows to a line ('x, y, z' '-x, -y, z') are legal CIF.
  const xi = tags.findIndex(t => XYZ_TAGS.includes(t));
  const plainOk = xi >= 0 && vals.length % n === 0
    && vals.every((tk, j) => j % n !== xi || (tk.v.match(/,/g) || []).length === 2);
  if (xi >= 0 && !plainOk){
    const byLine = [];
    let last = -1;
    for (const tk of vals){ if (tk.line !== last){ byLine.push([]); last = tk.line; } byLine[byLine.length-1].push(tk.v); }
    if (byLine.length && byLine.every(g => g.length >= n) && byLine.some(g => g.length > n)){
      for (const g of byLine){
        const extra = g.length - n;
        rows.push([...g.slice(0, xi), g.slice(xi, xi+extra+1).join(''), ...g.slice(xi+extra+1)]);
      }
      return { tags, rows };
    }
  }
  if (vals.length % n) warnings.push(`The loop of ${tags[0]} has ${vals.length} values for ${n} columns: the incomplete last row is dropped.`);
  for (let r = 0; r + n <= vals.length; r += n) rows.push(vals.slice(r, r+n).map(tk => tk.v));
  return { tags, rows };
}

// Text → [{name, items:{tag:value}, loops:[{tags, rows}]}]. Save frames and global_
// blocks (dictionary machinery) are skipped.
function cifBlocks(text){
  const toks = cifTokens(text), blocks = [], warnings = [];
  const isTag = tk => !tk.q && tk.v[0] === '_';
  const isKey = tk => !tk.q && /^(data_|save_|loop_$|global_$|stop_$)/i.test(tk.v);
  let cur = null, inSave = false, i = 0;
  while (i < toks.length){
    const tk = toks[i], w = tk.q ? '' : tk.v.toLowerCase();
    if (w.startsWith('data_')){ cur = { name: tk.v.slice(5), items: {}, loops: [] }; blocks.push(cur); inSave = false; i++; continue; }
    if (w.startsWith('save_')){ inSave = w !== 'save_'; i++; continue; }
    if (w === 'global_'){ cur = null; i++; continue; }
    if (!cur || inSave){ i++; continue; }
    if (w === 'loop_'){
      i++;
      const tags = [], vals = [];
      while (i < toks.length && isTag(toks[i])) tags.push(normTag(toks[i++].v));
      while (i < toks.length && !isTag(toks[i]) && !isKey(toks[i])) vals.push(toks[i++]);
      cur.loops.push(makeLoop(tags, vals, warnings));
      continue;
    }
    if (isTag(tk)){
      const nx = toks[i+1];
      if (nx && !isTag(nx) && !isKey(nx)){ cur.items[normTag(tk.v)] = nx.v; i += 2; }
      else { cur.items[normTag(tk.v)] = '?'; i++; }
      continue;
    }
    i++;   // a stray value outside any tag or loop
  }
  return { blocks, warnings };
}
// A column of values, whether the tag is a single item or in a loop; null when absent.
function column(block, tag){
  if (Object.prototype.hasOwnProperty.call(block.items, tag)) return [block.items[tag]];
  for (const lp of block.loops){ const k = lp.tags.indexOf(tag); if (k >= 0) return lp.rows.map(r => r[k]); }
  return null;
}
const isNull = v => v == null || v === '?' || v === '.';
// The first of the tags with a real value.
function item(block, ...tags){
  for (const t of tags){ const c = column(block, t); if (c && c.length && !isNull(c[0])) return c[0]; }
  return null;
}
// '3.905(2)' → 3.905; '1/3' (not CIF, but written) → 0.3333…; '?' and '.' → NaN.
function num(v){
  if (isNull(v)) return NaN;
  const s = String(v).trim();
  let m = /^([+-]?\d+)\/(\d+)$/.exec(s);
  if (m) return +m[1] / +m[2];
  m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s);
  return m ? parseFloat(m[0]) : NaN;
}

// 'Sr1 Ti1 O3', 'Ti O2', 'Ca0.5 Sr0.5 Ti O3' → {Sr:1, Ti:1, O:3}; deuterium counts as H
// (as in the scattering tables). null when nothing reads as an element.
function parseFormula(str){
  if (typeof str !== 'string') return null;
  const out = {};
  let any = false;
  for (const m of str.matchAll(/([A-Z][a-z]?)\s*(\d+\.?\d*|\.\d+)?/g)){
    const el = m[1] === 'D' ? 'H' : m[1];
    if (!(atomicMass(el) > 0)) continue;
    out[el] = (out[el] || 0) + (m[2] ? parseFloat(m[2]) : 1);
    any = true;
  }
  return any ? out : null;
}
const formulaText = f => Object.keys(f).map(el => el + (Math.abs(f[el] - 1) < 1e-9 ? '' : fmtCount(f[el]))).join('');

// The crystal system a space group names: from its IT number, else from an H-M symbol with
// its parts spaced as CIFs write them ('P 42/m n m', 'F m -3 m', 'P 1 21/c 1', 'R -3 m :H').
// null where the symbol does not say for sure: a compact 'P4332' is cubic, 'P4322' tetragonal.
/* Is the named group centrosymmetric? From the IT number; else from the symbol: a '/' (an
   axis with a mirror normal to it), −1 or −3 (m-3, Fd-3m, R-3c…), or an orthorhombic
   symbol of mirrors and glides alone (Pnma). Anything else (Fm3m, an old notation) →
   null: not known, not checked. */
const CENTRED_IT = new Set([5, 8, 9, 12, 15, 20, 21, 22, 23, 24, ...Array.from({ length: 12 }, (_, i) => 35 + i), ...Array.from({ length: 12 }, (_, i) => 63 + i),
  79, 80, 82, 87, 88, 97, 98, 107, 108, 109, 110, 119, 120, 121, 122, 139, 140, 141, 142, 146, 148, 155, 160, 161, 166, 167,
  196, 197, 199, 202, 203, 204, 206, 209, 210, 211, 214, 216, 217, 219, 220, 225, 226, 227, 228, 229, 230]);
const CENTRO_IT = [[2, 2], [10, 15], [47, 74], [83, 88], [123, 142], [147, 148], [162, 167], [175, 176], [191, 194], [200, 206], [221, 230]];
function centroOf(hm, n){
  if (n >= 1 && n <= 230) return CENTRO_IT.some(([a, b]) => n >= a && n <= b);
  if (!hm) return null;
  const body = hm.trim().replace(/\s*:.*$/, '').slice(1).replace(/\s+/g, '');
  if (/\/|-1|-3/.test(body)) return true;
  if (symbolSystem(hm, null) === 'orthorhombic' && !/\d/.test(body)) return true;
  return null;
}
function symbolSystem(hm, itNumber){
  const n = itNumber;
  if (n >= 1 && n <= 230) return n <= 2 ? 'triclinic' : n <= 15 ? 'monoclinic' : n <= 74 ? 'orthorhombic' : n <= 142 ? 'tetragonal' : n <= 167 ? 'trigonal' : n <= 194 ? 'hexagonal' : 'cubic';
  if (!hm) return null;
  const parts = hm.trim().replace(/\s*:.*$/, '').slice(1).trim().split(/\s+/).filter(Boolean), p0 = parts[0];
  if (!p0) return null;
  if (parts.length >= 2 && /3/.test(parts[1])) return 'cubic';
  if (/^-?3/.test(p0)) return 'trigonal';
  if (/6/.test(p0)) return 'hexagonal';
  if (parts.length === 1){
    if (/^-?1$/.test(p0)) return 'triclinic';
    if (/^(21?|[mcnab]|21?\/[mcnab])$/.test(p0)) return 'monoclinic';
    return /4/.test(p0) && !/3/.test(p0) ? 'tetragonal' : null;
  }
  if (/4/.test(p0)) return 'tetragonal';
  if (parts.length === 3) return parts.filter(p => p !== '1').length === 1 ? 'monoclinic' : 'orthorhombic';
  return null;
}
function fmtCount(n){ return Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : String(+n.toFixed(3)); }

// Equivalent isotropic B from an anisotropic U or B tensor (Fischer & Tillmanns 1988):
// Ueq = ⅓ Σ_ij U^ij a*_i a*_j (a_i·a_j), which is the mean of U11, U22, U33 only for
// orthogonal axes.
function equivIso(Uij, G, Gs){
  const as = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])];
  const [u11,u22,u33,u12,u13,u23] = Uij;
  const U = [u11,u12,u13, u12,u22,u23, u13,u23,u33];
  let s = 0;
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) s += U[3*i+j]*as[i]*as[j]*G[3*i+j];
  return s/3;
}

// CIF text → { name, block, cell, hm, itNumber, hall, ops, sites, formulaSum, formula, Z,
// warnings }. Reads the first data block that has fractional atom sites. Throws (with a
// message for the user) when the file has no data block, no such atom sites, or no cell:
// whatever it returns is usable. Everything else it can work around is in `warnings`.
function parseCif(text){
  const { blocks, warnings: lexWarnings } = cifBlocks(String(text ?? ''));
  if (!blocks.length) throw new Error('Not a CIF: no data_ block found.');
  const withAtoms = blocks.filter(b => column(b, '_atom_site_fract_x'));
  if (!withAtoms.length){
    const cart = blocks.some(b => column(b, '_atom_site_cartn_x'));
    throw new Error(cart ? 'The CIF gives only Cartesian atom coordinates; fractional coordinates (_atom_site_fract_x) are needed.'
                         : 'No atom sites in the CIF (_atom_site_fract_x).');
  }
  const b = withAtoms[0];
  const warnings = lexWarnings.slice();
  if (withAtoms.length > 1) warnings.push(`The file holds ${withAtoms.length} structures: the first, data_${b.name}, is used.`);

  // Cell
  const cell = {
    a: num(item(b, '_cell_length_a')), b: num(item(b, '_cell_length_b')), c: num(item(b, '_cell_length_c')),
    alpha: num(item(b, '_cell_angle_alpha')), beta: num(item(b, '_cell_angle_beta')), gamma: num(item(b, '_cell_angle_gamma')),
  };
  if (!(cell.a > 0 && cell.b > 0 && cell.c > 0)) throw new Error('The CIF has no complete unit cell (_cell_length_a, _b, _c).');
  for (const k of ['alpha','beta','gamma']){
    if (!(cell[k] > 0 && cell[k] < 180)){ warnings.push(`No valid _cell_angle_${k}: 90° assumed.`); cell[k] = 90; }
  }
  // Each angle may lie in (0, 180°) and the three still close no cell (120/120/120°
  // gives V = 0, 60/60/130° a negative G determinant): every d would be NaN.
  const { G, Gs, V } = metric(cell);
  if (!(V > 1e-6*cell.a*cell.b*cell.c)) throw new Error(`The cell angles α, β, γ = ${cell.alpha}°, ${cell.beta}°, ${cell.gamma}° do not form a unit cell.`);

  // Symmetry
  const hm = item(b, '_space_group_name_h-m_alt', '_symmetry_space_group_name_h-m', '_space_group_name_h-m');
  const hall = item(b, '_space_group_name_hall', '_symmetry_space_group_name_hall');
  const itn = num(item(b, '_space_group_it_number', '_symmetry_int_tables_number'));
  const itNumber = itn >= 1 && itn <= 230 ? Math.round(itn) : null;
  const opsCol = column(b, XYZ_TAGS[0]) || column(b, XYZ_TAGS[1]);
  let ops = [];
  if (opsCol) for (const s of opsCol){
    if (isNull(s)) continue;
    try { ops.push(parseSymop(s)); } catch(e){ warnings.push(e.message + ' It is ignored.'); }
  }
  ops = uniqueOps(ops);
  const isP1 = s => /^p\s*1$/i.test(s.trim());
  const named = (hm && !isP1(hm)) || itNumber > 1 || (hall && !isP1(hall));
  if (ops.length){
    const idIdx = ops.findIndex(o => o.R.every((v, i) => v === IDENT[i]) && o.t.every(v => !v));
    if (idIdx < 0){ warnings.push('The symmetry operations do not include the identity: it is added.'); ops.unshift({ R: IDENT.slice(), t: [0,0,0] }); }
    else if (idIdx > 0) ops.unshift(ops.splice(idIdx, 1)[0]);
    const miss = closureMisses(ops);
    if (miss.length) warnings.push(`The ${ops.length} symmetry operations do not form a group (e.g. ${symopString(miss[0])} is missing): the list looks incomplete, check the CIF.`);
    // A centred symbol needs its centring translations in the list.
    const L = hm ? hm.trim()[0].toUpperCase() : '';
    const want = { I:1, A:1, B:1, C:1, F:3 }[L] ?? (L === 'R' && Math.abs(cell.gamma - 120) < 0.01 ? 2 : 0);
    const have = ops.filter(o => o.R.every((v, i) => v === IDENT[i]) && o.t.some(v => v)).length;
    if (want && have < want) warnings.push(`${hm.trim()} is centred but the operations hold ${have} of its ${want} centring translation${want > 1 ? 's' : ''}: the cell will be filled incompletely.`);
  }

  // Anisotropic displacements, by label, for sites without an isotropic value.
  const aniso = new Map();
  const aLab = column(b, '_atom_site_aniso_label');
  if (aLab){
    const comps = ['11','22','33','12','13','23'];
    const useU = !!column(b, '_atom_site_aniso_u_11');
    const cols = comps.map(k => column(b, (useU ? '_atom_site_aniso_u_' : '_atom_site_aniso_b_') + k));
    if (cols[0]) aLab.forEach((lab, r)=>{
      const v = cols.map(c => c ? num(c[r]) : 0).map(x => Number.isFinite(x) ? x : 0);
      const eq = equivIso(v, G, Gs);
      if (eq > 0) aniso.set(lab, useU ? EIGHT_PI2*eq : eq);
    });
  }

  // Atom sites
  const fx = column(b, '_atom_site_fract_x'), fy = column(b, '_atom_site_fract_y'), fz = column(b, '_atom_site_fract_z');
  const n = fx.length;
  const col = tag => { const c = column(b, tag); return c && c.length === n ? c : null; };
  const lab = col('_atom_site_label'), typ = col('_atom_site_type_symbol'), occ = col('_atom_site_occupancy');
  const bIso = col('_atom_site_b_iso_or_equiv'), uIso = col('_atom_site_u_iso_or_equiv');
  const flag = col('_atom_site_calc_flag'), mult = col('_atom_site_symmetry_multiplicity');
  const sites = [], defaultB = [], fallback = [];
  for (let i = 0; i < n; i++){
    const label = lab && !isNull(lab[i]) ? lab[i] : `${typ && !isNull(typ[i]) ? typ[i] : 'X'}${i+1}`;
    if (flag && /^dum/i.test(flag[i] || '')) continue;   // dummy atoms (ring centroids, …)
    const type = typ && !isNull(typ[i]) ? typ[i] : label;
    const sp = speciesKey(type) || (type !== label ? speciesKey(label) : null);
    if (!sp){ warnings.push(`Site ${label}: no X-ray scattering factor for '${type}', the site is left out.`); continue; }
    if (sp.fallback) fallback.push(`${type} (${label})`);
    const x = num(fx[i]), y = num(fy ? fy[i] : null), z = num(fz ? fz[i] : null);
    if (![x, y, z].every(Number.isFinite)){ warnings.push(`Site ${label}: incomplete coordinates, the site is left out.`); continue; }
    let o = occ ? num(occ[i]) : 1;
    if (!(o >= 0)) o = 1;
    if (o > 1.0005) warnings.push(`Site ${label}: occupancy ${o} > 1.`);
    let B = bIso ? num(bIso[i]) : NaN;
    if (!Number.isFinite(B) && uIso){ const u = num(uIso[i]); if (Number.isFinite(u)) B = EIGHT_PI2*u; }
    if (!Number.isFinite(B) && aniso.has(label)) B = aniso.get(label);
    if (!Number.isFinite(B)){ B = B_DEFAULT; defaultB.push(label); }
    const m = mult ? num(mult[i]) : NaN;
    // D scatters as H (speciesKey) but weighs its own: a deuterated cell would otherwise
    // weigh light in the weight fractions.
    // (Only a species read as hydrogen: 'DY3+' is dysprosium.)
    const deut = sp.element === 'H' && /^d/i.test(String(typ && !isNull(typ[i]) ? typ[i] : label).trim());
    sites.push({ label, type, key: sp.key, element: sp.element, x, y, z, occ: o, Biso: B, mult: m > 0 ? Math.round(m) : null, ...(deut ? { massEl: 'D' } : {}) });
  }
  if (!sites.length) throw new Error('None of the atom sites in the CIF could be read.');
  if (fallback.length) warnings.push(`No tabulated form factor for the ion${fallback.length > 1 ? 's' : ''} ${fallback.join(', ')}: the neutral atom is used.`);
  if (defaultB.length) warnings.push(`No displacement parameter for ${defaultB.join(', ')}: B = ${B_DEFAULT} Å² assumed.`);
  if (sites.some(s => s.Biso < 0)) warnings.push('Negative displacement parameters in the CIF.');

  const formulaSum = item(b, '_chemical_formula_sum');
  const formula = parseFormula(formulaSum);
  const zz = num(item(b, '_cell_formula_units_z'));
  const Z = zz > 0 ? zz : null;

  /* A space group named without its operations: the sites are then, almost always, only
     the asymmetric unit, and the operations are not generated from the symbol here. Read
     as P1 they would fill the cell in part and give a wrong pattern with no error (rutile:
     2 atoms instead of 6, orthorhombic, (211) the strongest line). So the file is refused
     unless the listed atoms are evidently the whole cell: they match the formula × Z given,
     or they show by themselves the crystal system and the lattice centring the symbol
     names. (A lone special position can still pass that test: a site alone in its cell
     shows the lattice's full symmetry.) The formula × Z is evidence only with Z given:
     without it, Z is inferred from the atoms, and an asymmetric unit that holds whole
     formula units passes by construction (NaCl named Fm-3m, given as Na and Cl, read as
     one formula unit in P1). A list holding the identity alone, x, y, z, is the same
     case as none. A centrosymmetric symbol also wants the centre of symmetry: an
     asymmetric unit of P-1 in general positions shows every triclinic P lattice. */
  const onlyIdentity = ops.length === 1 && ops[0].R.every((v, i) => v === IDENT[i]) && ops[0].t.every(v => !v);
  if ((!ops.length || onlyIdentity) && named){
    const atoms = expandAtoms([], sites), comp = checkComposition(atoms, formula, Z);
    let whole = comp.checked && comp.ok;
    const why = [];
    if (comp.checked && !comp.ok) why.push(`the atoms fill the cell with ${Object.keys(comp.found).map(el => `${el} ${fmtCount(comp.found[el])}`).join(', ')}, not the formula × Z`);
    else if (!comp.checked || !(Z > 0)){
      // The lattice letter from the H-M symbol, else from the Hall symbol ('-F 4 2 3'); with
      // only the IT number, whether the lattice is centred at all.
      const hallM = hall ? /^\s*(-?)\s*([pabcifr])/i.exec(hall) : null;
      const want = symbolSystem(hm, itNumber), letter = hm && /^[pabcifr]/i.test(hm.trim()) ? hm.trim()[0].toUpperCase() : hallM ? hallM[2].toUpperCase() : null;
      const sym = findSymmetry(cell, atoms);
      const sysOk = !want || sym.system === want || (want === 'trigonal' && sym.system === 'hexagonal');
      const hexAxes = Math.abs(cell.gamma - 120) < 0.01 && same(cell.a, cell.b);
      const wantC = letter === 'R' ? (hexAxes ? 'R' : 'P') : letter;
      const centredIT = itNumber && CENTRED_IT.has(itNumber) && !(itNumber >= 143 && itNumber <= 167 && !hexAxes);
      const cenOk = wantC ? sym.centring === wantC : !centredIT || sym.centring !== 'P';
      const centro = centroOf(hm, itNumber) || (hallM && hallM[1] === '-');
      const invOk = !centro || sym.ops.some(o => o.R.every((v, i) => v === -IDENT[i]));
      whole = sysOk && cenOk && invOk;
      if (!sysOk) why.push(`the atoms show ${sym.system} symmetry, the symbol ${want}`);
      if (!cenOk) why.push(`the atoms lack the ${wantC || 'lattice'} centring`);
      if (!invOk) why.push('the atoms lack the centre of symmetry the symbol has');
    }
    if (!whole) throw new Error(`The CIF names the space group ${hm ? hm.trim() : hall ? hall.trim() : 'No. ' + itNumber} but lists ${onlyIdentity ? 'only the identity (x, y, z) as its symmetry operations' : 'no symmetry operations'}, and they are not generated from the symbol: the ${sites.length} site${sites.length > 1 ? 's' : ''} given cannot be the whole cell (${why.join('; ')}). A CIF with its operations (_space_group_symop_operation_xyz) is needed: COD, ICSD and the Materials Project (symmetrized CIF) give them.`);
    warnings.push(`The CIF lists ${onlyIdentity ? 'only the identity (x, y, z) as its symmetry operation' : 'no symmetry operations'}${hm ? ` for ${hm.trim()}` : ''}: the atoms are taken as they are (P1), so the cell is filled only if they are all listed.`);
  }
  const name = item(b, '_chemical_name_mineral') || item(b, '_chemical_formula_structural')
    || (formula ? formulaText(formula) : null) || item(b, '_chemical_name_common') || b.name;
  return { name: String(name).trim(), block: b.name, cell, hm: hm ? hm.trim() : null, itNumber, hall: hall ? hall.trim() : null,
           ops, sites, formulaSum: formulaSum ? formulaSum.trim() : null, formula, Z, warnings };
}

/* ---------- cell contents ---------- */
// Every site's orbit under the operations, positions in [0, 1), duplicates within `tol`
// (fractional, per axis, periodic) removed site by site — so a site on a special position
// gets its true multiplicity, and two sites sharing a position (a mixed occupancy) both
// stay. No operations = P1.
function expandAtoms(ops, sites, tol = 1e-3){
  const list = ops && ops.length ? ops : [{ R: IDENT, t: [0,0,0] }];
  // Inclusive (plus rounding slack): a special position written with three decimals,
  // 0.333/0.667, yields images exactly 0.001 apart that are still one position.
  const lim = tol + 1e-7;
  const near = (p, q) => {
    for (let i=0;i<3;i++){ const d = Math.abs(p[i] - q[i]); if (Math.min(d, 1 - d) > lim) return false; }
    return true;
  };
  const out = [];
  sites.forEach((s, si)=>{
    const sp = s.key && s.element ? null : speciesKey(s.type || s.label || '');
    const key = s.key || (sp ? sp.key : undefined), element = s.element || (sp ? sp.element : undefined);
    const pos = [];
    for (const { R, t } of list){
      const q = apply3(R, [s.x, s.y, s.z]);
      const p = [mod1(q[0] + t[0]), mod1(q[1] + t[1]), mod1(q[2] + t[2])];
      if (!pos.some(o => near(o, p))) pos.push(p);
    }
    for (const p of pos) out.push({ site: si, label: s.label, key, element, x: p[0], y: p[1], z: p[2],
      occ: s.occ ?? 1, Biso: s.Biso ?? B_DEFAULT, cifMult: s.mult ?? null, ...(s.massEl ? { massEl: s.massEl } : {}) });
  });
  return out;
}

// { element: atoms per cell, weighted by occupancy }.
function cellContents(atoms){
  const out = {};
  for (const a of atoms) out[a.element] = (out[a.element] || 0) + (a.occ ?? 1);
  return out;
}
// Mass of the cell contents (g/mol per cell, i.e. Z·M), for Hill–Howard weight fractions.
function cellMass(atoms){
  let m = 0;
  for (const a of atoms) m += (a.occ ?? 1)*atomicMass(a.massEl || a.element);
  return m;
}

// Does the filled cell hold formula × Z? A mismatch is the signature of coordinates written
// for one origin choice (or setting) read with the operations of another — the anatase
// I4₁/amd origin-1 coordinates with origin-2 operations give Ti8 O16 instead of Ti4 O8 —
// or of an incomplete operation list. Without Z, Z is inferred when the ratio is integral.
// The CIF's own site multiplicities, when given, are compared too: they are the most
// direct evidence. H missing from the sites (not located by X-rays) is only noted.
// → { ok, checked, expected, found, Z, message }.
function checkComposition(atoms, formulaSum, Z){
  const found = cellContents(atoms);
  const fmt = o => Object.keys(o).map(el => `${el} ${fmtCount(o[el])}`).join(', ');
  const msgs = [];
  let ok = true, checked = false;

  const bySite = new Map();
  for (const a of atoms){
    const e = bySite.get(a.site) || { label: a.label, n: 0, mult: a.cifMult };
    e.n++; bySite.set(a.site, e);
  }
  const badMult = [...bySite.values()].filter(e => e.mult > 0 && e.n !== e.mult);
  if ([...bySite.values()].some(e => e.mult > 0)) checked = true;
  if (badMult.length){
    ok = false;
    msgs.push(`Site multiplicities differ from the CIF's: ${badMult.map(e => `${e.label} ${e.n} (CIF ${e.mult})`).join(', ')}.`);
  }

  const formula = typeof formulaSum === 'string' ? parseFormula(formulaSum) : formulaSum;
  let expected = null, z = Z > 0 ? Z : null;
  if (formula && Object.keys(formula).length){
    const els = Object.keys(formula);
    const noH = formula.H && !found.H;
    const cmp = els.filter(el => !(noH && el === 'H'));
    if (!z){
      // The ratio of the most abundant element fixes Z when it is (nearly) an integer.
      const el = cmp.reduce((m, e) => formula[e] > formula[m] ? e : m, cmp[0]);
      const r = (found[el] || 0)/formula[el], ri = Math.round(r);
      if (ri >= 1 && Math.abs(r - ri) < 0.02*ri + 0.01){ z = ri; msgs.push(`Z not given: ${ri} from the cell contents.`); }
    }
    if (z){
      checked = true;
      expected = {};
      for (const el of els) expected[el] = formula[el]*z;
      const allEls = [...new Set([...cmp, ...Object.keys(found)])];
      const off = allEls.filter(el => Math.abs((found[el] || 0) - (expected[el] || 0)) > Math.max(0.05, 0.02*(expected[el] || 0)));
      if (off.length){
        ok = false;
        const ratios = allEls.map(el => (found[el] || 0)/(expected[el] || NaN));
        const r0 = ratios[0], uniform = ratios.every(r => Number.isFinite(r) && Math.abs(r - r0) < 0.02*r0);
        msgs.push(`The symmetry operations fill the cell with ${fmt(found)}, but ${formulaText(formula)} × Z = ${fmtCount(z)} is ${fmt(expected)}`
          + (uniform ? ` (every element ${fmtCount(+r0.toFixed(3))}× the formula: Z is wrong, or the coordinates belong to another origin choice or setting than the operations).`
                     : '. The coordinates and the symmetry operations may belong to different origin choices or settings, or sites are missing.'));
      } else msgs.unshift(`Cell contents ${fmt(found)} = ${formulaText(formula)} × ${fmtCount(z)}.`);
      if (noH) msgs.push('No H atoms in the sites (often not located by X-rays): H left out of the check.');
    }
  }
  if (!checked) msgs.push('No formula (or Z) to compare with: composition not checked.');
  return { ok, checked, expected, found, Z: z, message: msgs.join(' ') };
}

/* ---------- symmetry of a structure ---------- */
// The lattice holohedry as given: integer matrices with entries in {−1, 0, 1} that keep the
// metric (RᵀGR = G, columns = images of the basis vectors), identity first. At most 48.
// Built column by column from the 26 short lattice vectors, so only vectors as long as
// each axis are combined. Entries of ±1 suffice for reduced and conventional cells.
function holohedry(G, rtol = 1e-4){
  const vecs = [];
  for (let i=-1;i<=1;i++) for (let j=-1;j<=1;j++) for (let k=-1;k<=1;k++) if (i||j||k) vecs.push([i,j,k]);
  const dot = (u, v) => u[0]*(G[0]*v[0]+G[1]*v[1]+G[2]*v[2]) + u[1]*(G[3]*v[0]+G[4]*v[1]+G[5]*v[2]) + u[2]*(G[6]*v[0]+G[7]*v[1]+G[8]*v[2]);
  const cols = [0,1,2].map(i => vecs.filter(v => Math.abs(dot(v, v) - G[4*i]) <= rtol*G[4*i]));
  const tolIJ = (i, j) => rtol*Math.sqrt(G[4*i]*G[4*j]);
  const out = [];
  for (const c0 of cols[0]) for (const c1 of cols[1]){
    if (Math.abs(dot(c0, c1) - G[1]) > tolIJ(0, 1)) continue;
    for (const c2 of cols[2]){
      if (Math.abs(dot(c0, c2) - G[2]) > tolIJ(0, 2) || Math.abs(dot(c1, c2) - G[5]) > tolIJ(1, 2)) continue;
      const R = [c0[0], c1[0], c2[0],  c0[1], c1[1], c2[1],  c0[2], c1[2], c2[2]];
      if (Math.abs(det3(R)) === 1) out.push(R);
    }
  }
  const id = out.findIndex(R => R.every((v, i) => v === IDENT[i]));
  if (id > 0) out.unshift(out.splice(id, 1)[0]);
  return out;
}

// Rotation order of the proper part (det·R) from its trace.
const ROT_ORDER = { 3:1, '-1':2, 0:3, 1:4, 2:6 };
const properOf = R => { const d = det3(R); return R.map(v => v*d); };
const rotOrder = R => { const P = properOf(R); return ROT_ORDER[P[0] + P[4] + P[8]]; };
// True when the proper part of R is a rotation about basis axis i that leaves the other
// two axes in their plane (column i and row i are the unit vector).
function aboutAxis(R, i){
  const P = properOf(R);
  for (let j=0;j<3;j++){ const e = j === i ? 1 : 0; if (P[3*j+i] !== e || P[3*i+j] !== e) return false; }
  return true;
}
const same = (x, y) => Math.abs(x - y) <= 1e-4*Math.max(Math.abs(x), Math.abs(y));

// The cell spanned by the columns of M (integer combinations of `cell`'s axes, or the
// inverse relation): metric MᵀGM. Angles within 1e-9° of 60, 90 or 120° are made exact,
// so metric() keeps its true zeros.
const snapAngle = d => { for (const s of [60, 90, 120]) if (Math.abs(d - s) < 1e-9) return s; return d; };
function cellInBasis(cell, M){
  const { G } = metric(cell), Mt = [M[0],M[3],M[6], M[1],M[4],M[7], M[2],M[5],M[8]];
  const g = mul3(mul3(Mt, G), M);
  const len = i => Math.sqrt(g[4*i]);
  const ang = (i, j) => snapAngle(Math.acos(Math.max(-1, Math.min(1, g[3*i+j]/(len(i)*len(j)))))*180/Math.PI);
  return { a: len(0), b: len(1), c: len(2), alpha: ang(1, 2), beta: ang(0, 2), gamma: ang(0, 1) };
}

/* A cell whose symmetry axes are lattice vectors other than its own axes — most often the
   primitive cell of a centred lattice, as the Materials Project serves its P1 files —
   would otherwise be refined by one scale factor, which freezes c/a (and b/a, β) at the
   file's values: a DFT cell's wrong c/a then goes into the displacement and the widths.
   Its metric is parametrised instead through the conventional cell: lattice vectors along
   the symmetry axes, the columns of an integer matrix M in the given cell's fractions, so
   the conventional metric is MᵀGM and a Miller index goes as h_c = h·M. The atoms, the
   operations and the reflection list stay in the given cell; only the way its six
   parameters follow the refined a, c (or a, b, c, β) changes. The axes are found by exact
   integer tests: u lies on the axis of the proper rotation P when Pu = u, and is
   perpendicular to it when the images of u under the rotations about it sum to zero.
   → { kind, params, unique?, basis: M (row-major), conv: the conventional cell } or null
   when the axes are not among the short lattice vectors (indices up to ±3). */
function conventionalBasis(system, Rs, cell){
  const { G } = metric(cell);
  const dot = (u, v) => u[0]*(G[0]*v[0]+G[1]*v[1]+G[2]*v[2]) + u[1]*(G[3]*v[0]+G[4]*v[1]+G[5]*v[2]) + u[2]*(G[6]*v[0]+G[7]*v[1]+G[8]*v[2]);
  const vecs = [];
  for (let i=-3;i<=3;i++) for (let j=-3;j<=3;j++) for (let k=-3;k<=3;k++) if (i||j||k) vecs.push([i,j,k]);
  const l2 = new Map(vecs.map(u => [u, dot(u, u)]));
  vecs.sort((u, v) => l2.get(u) - l2.get(v));            // shortest first (stable on ties)
  const eq = (u, v) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2];
  const first = test => vecs.find(test) || null;
  const axisOf = P => first(u => eq(apply3(P, u), u));
  // ⊥ the axis of P (order n): u + Pu + … + P^(n−1)u = 0.
  const perpTo = (P, n) => u => { const s = u.slice(); let w = u; for (let k = 1; k < n; k++){ w = apply3(P, w); s[0] += w[0]; s[1] += w[1]; s[2] += w[2]; } return !s[0] && !s[1] && !s[2]; };
  const props = Rs.map(properOf), ord = props.map(P => ROT_ORDER[P[0] + P[4] + P[8]]);
  const P_ = n => props[ord.indexOf(n)];
  let A, B, Cc, kind, params, unique;
  if (system === 'cubic'){
    // The cube axes: the 4-fold axes when there are any (O, Oh), else the three 2-fold
    // ones (T, Th, whose 2-fold axes all lie along the cube edges).
    const n = ord.includes(4) ? 4 : 2, axes = [];
    props.forEach((P, i)=> { if (ord[i] !== n) return; const u = axisOf(P); if (u && !axes.some(v => eq(v, u) || eq(v, u.map(x => -x)))) axes.push(u); });
    if (axes.length !== 3) return null;
    [A, B, Cc] = axes; kind = 'cubic'; params = ['a'];
  } else if (system === 'tetragonal' || system === 'hexagonal' || system === 'trigonal'){
    const n = system === 'tetragonal' ? 4 : 3, P = ord.includes(n) ? P_(n) : null;
    if (!P) return null;
    Cc = axisOf(P); A = first(perpTo(P, n));
    if (!Cc || !A) return null;
    B = apply3(P, A);                                     // |b| = |a|, at 90° (4-fold) or 120° (3-fold)
    kind = n === 4 ? 'tetragonal' : 'hexagonal'; params = ['a','c'];
  } else if (system === 'orthorhombic'){
    const axes = [];
    props.forEach((P, i)=> { if (ord[i] !== 2) return; const u = axisOf(P); if (u && !axes.some(v => eq(v, u))) axes.push(u); });
    if (axes.length !== 3) return null;
    [A, B, Cc] = axes; kind = 'orthorhombic'; params = ['a','b','c'];
  } else if (system === 'monoclinic'){
    const P = P_(2);
    if (!P) return null;
    B = axisOf(P); A = first(perpTo(P, 2));
    if (!B || !A) return null;
    Cc = first(u => perpTo(P, 2)(u) && (A[1]*u[2] - A[2]*u[1] || A[2]*u[0] - A[0]*u[2] || A[0]*u[1] - A[1]*u[0]));
    if (!Cc) return null;
    if (dot(A, Cc) > 0) Cc = Cc.map(v => -v);             // β ≥ 90°, as usual
    kind = 'monoclinic'; unique = 'b'; params = ['a','b','c','beta'];
  } else return null;
  let M = [A[0], B[0], Cc[0], A[1], B[1], Cc[1], A[2], B[2], Cc[2]];
  const d = det3(M);
  if (!d) return null;
  if (d < 0){                                             // right-handed: flip the axis no other is built from
    if (kind === 'monoclinic') B = B.map(v => -v); else Cc = Cc.map(v => -v);
    M = [A[0], B[0], Cc[0], A[1], B[1], Cc[1], A[2], B[2], Cc[2]];
  }
  const cv = cellInBasis(cell, M);
  // The symmetry makes these equalities hold to the metric's tolerance; they are made exact.
  const conv = { a: cv.a, b: cv.b, c: cv.c, alpha: 90, beta: 90, gamma: 90 };
  if (kind === 'cubic') conv.a = conv.b = conv.c = Math.cbrt(cv.a*cv.b*cv.c);
  if (kind === 'tetragonal' || kind === 'hexagonal'){ conv.a = conv.b = Math.sqrt(cv.a*cv.b); if (kind === 'hexagonal') conv.gamma = 120; }
  if (kind === 'monoclinic') conv.beta = cv.beta;
  const sameAngle = k => Math.abs(cv[k] - conv[k]) < 0.01;
  if (!same(cv.a, conv.a) || !same(cv.b, conv.b) || !same(cv.c, conv.c) || !['alpha','beta','gamma'].every(sameAngle)) return null;
  return { kind, params, ...(unique ? { unique } : {}), basis: M, conv, volumeRatio: Math.abs(det3(M)) };
}

// Crystal system and how the cell may be refined, from the point group (distinct R) and
// the cell as given (the cell itself is not transformed). A recognised standard setting
// gets its usual free parameters; a non-standard one is refined through its conventional
// cell (conventionalBasis); anything else falls back to an isotropic scale of the
// lengths — always consistent with the symmetry, only less free.
function classify(Rs, cell){
  const ord = Rs.map(rotOrder);
  const n3 = ord.filter(o => o === 3).length, n2 = ord.filter(o => o === 2).length;
  const has = o => ord.includes(o);
  const system = n3 >= 8 ? 'cubic' : has(6) ? 'hexagonal' : n3 ? 'trigonal' : has(4) ? 'tetragonal'
               : n2 >= 3 ? 'orthorhombic' : n2 ? 'monoclinic' : 'triclinic';
  const iso = why => ({ kind:'isotropic', params:['a'], note: `${why}: the cell lengths are refined by one common scale factor` });
  const conv = why => {
    const cb = conventionalBasis(system, Rs, cell);
    return cb ? { ...cb, note: `${why}: refined as the conventional cell (${cb.params.join(', ')}), ${cb.volumeRatio}× the volume of the cell given` } : iso(why);
  };
  const { a, b, c, alpha, beta, gamma } = cell;
  let constraint;
  if (system === 'cubic'){
    // One length either way, but in a primitive cell of an F or I lattice (as the Materials
    // Project serves them) that length is not the cube edge the tables quote: such a cell
    // is refined through its conventional one, so a and V come out as the cube's.
    const right = [alpha, beta, gamma].every(x => Math.abs(x - 90) < 0.01);
    constraint = right && same(a, b) && same(b, c) ? { kind:'cubic', params:['a'] } : conv('cubic symmetry in a non-standard cell');
  } else if (system === 'hexagonal' || system === 'trigonal'){
    const R3 = Rs[ord.indexOf(3)] || Rs[ord.indexOf(6)];   // a 6-fold without its 3-fold only in a set that is not a group
    if (aboutAxis(R3, 2)) constraint = { kind:'hexagonal', params:['a','c'] };
    else if (same(a, b) && same(b, c) && same(alpha, beta) && same(beta, gamma)) constraint = { kind:'rhombohedral', params:['a','alpha'] };
    else constraint = conv(`${system} symmetry in a non-standard cell`);
  } else if (system === 'tetragonal'){
    constraint = aboutAxis(Rs[ord.indexOf(4)], 2) ? { kind:'tetragonal', params:['a','c'] } : conv('tetragonal axis not along c');
  } else if (system === 'orthorhombic'){
    constraint = Rs.every(R => [1,2,3,5,6,7].every(k => R[k] === 0)) ? { kind:'orthorhombic', params:['a','b','c'] }
               : conv('orthorhombic symmetry in a non-standard cell');
  } else if (system === 'monoclinic'){
    const R2 = Rs[ord.indexOf(2)];
    const u = [0,1,2].find(i => aboutAxis(R2, i));
    constraint = u == null ? conv('monoclinic axis not along a cell axis')
               : { kind:'monoclinic', unique:'abc'[u], params:['a','b','c', ['alpha','beta','gamma'][u]] };
  } else constraint = { kind:'triclinic', params:['a','b','c','alpha','beta','gamma'] };
  return { system, constraint };
}

// Lattice type from the pure translations (identity excluded).
function centringOf(trans){
  const has = v => trans.some(t => t.every((x, i) => Math.abs(x - v[i]) < 1e-3));
  const h = 1/2, t1 = 1/3, t2 = 2/3;
  if (!trans.length) return 'P';
  if (trans.length === 1 && has([h,h,h])) return 'I';
  if (trans.length === 3 && has([0,h,h]) && has([h,0,h]) && has([h,h,0])) return 'F';
  if (trans.length === 1 && has([0,h,h])) return 'A';
  if (trans.length === 1 && has([h,0,h])) return 'B';
  if (trans.length === 1 && has([h,h,0])) return 'C';
  if (trans.length === 2 && ((has([t2,t1,t1]) && has([t1,t2,t2])) || (has([t1,t2,t1]) && has([t2,t1,t2])))) return 'R';
  return 'X';   // a supercell or an unusual centring
}

// The space-group operations the STRUCTURE has (not just the lattice): for each metric-
// preserving R, the translations that carry a reference atom onto an atom of its own kind
// (species with the fewest atoms, so the fewest trials), kept when every atom lands on an
// atom of the same species and occupancy within `tol` (Å). Centring translations come out
// as operations with R = 1. Translations are snapped to multiples of 1/24 within 1.5e-3,
// so the absence conditions computed from them are exact.
// → { ops (identity first), order, pointOrder, centring, system, constraint }.
function findSymmetry(cell, atoms, tol = 0.01){
  const { G } = metric(cell);
  const ident = { R: IDENT.slice(), t: [0,0,0] };
  if (!atoms || !atoms.length){
    return { ops:[ident], order:1, pointOrder:1, centring:'P', ...classify([IDENT], cell) };
  }
  const groups = new Map();
  for (const a of atoms){
    // An empty site scatters nothing: counted as a species it would only lower the
    // symmetry found (and the Laue merging with it).
    const occ = +(a.occ ?? 1);
    if (!(occ > 0)) continue;
    const k = (a.key || a.element || a.label) + '|' + occ.toFixed(3);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push([mod1(a.x), mod1(a.y), mod1(a.z)]);
  }
  if (!groups.size) return { ops:[ident], order:1, pointOrder:1, centring:'P', ...classify([IDENT], cell) };
  const sets = [...groups.values()];
  const ref = sets.reduce((m, s) => s.length < m.length ? s : m);
  const x0 = ref[0], tol2 = tol*tol;
  const dist2 = (p, q) => {
    let d0 = p[0]-q[0], d1 = p[1]-q[1], d2 = p[2]-q[2];
    d0 -= Math.round(d0); d1 -= Math.round(d1); d2 -= Math.round(d2);
    return G[0]*d0*d0 + G[4]*d1*d1 + G[8]*d2*d2 + 2*(G[1]*d0*d1 + G[2]*d0*d2 + G[5]*d1*d2);
  };
  const ops = [];
  for (const R of holohedry(G)){
    const Rx0 = apply3(R, x0), tried = [];
    for (const xj of ref){
      const raw = [mod1(xj[0] - Rx0[0]), mod1(xj[1] - Rx0[1]), mod1(xj[2] - Rx0[2])];
      const snapped = raw.map(snapT);
      if (tried.some(u => dist2(u, raw) < tol2)) continue;
      tried.push(raw);
      const mapsBy = t => sets.every(set => set.every(x => {
        const y = apply3(R, x); y[0] += t[0]; y[1] += t[1]; y[2] += t[2];
        return set.some(z => dist2(y, z) < tol2);
      }));
      // The snapped translation (exact absences) when it maps the structure; else the one
      // the atoms give: snapping moves t by up to 1.5e-3 of a cell edge, more than tol on
      // a long axis when the origin is not on a symmetry element.
      const t = mapsBy(snapped) ? snapped : mapsBy(raw) ? raw : null;
      if (t && !ops.some(o => o.R.every((v, i) => v === R[i]) && dist2(o.t, t) < tol2)) ops.push({ R: R.slice(), t });
    }
  }
  if (!ops.length) ops.push(ident);   // only with inconsistent input (atoms on top of each other)
  const Rs = [], seen = new Set();
  for (const { R } of ops){ const k = R.join(); if (!seen.has(k)){ seen.add(k); Rs.push(R); } }
  const trans = ops.filter(o => o.R.every((v, i) => v === IDENT[i]) && o.t.some(v => v)).map(o => o.t);
  return { ops, order: ops.length, pointOrder: Rs.length, centring: centringOf(trans), ...classify(Rs, cell) };
}

/* ---------- displacement parameters by site ---------- */
/* atomOrbits(cell, atoms, ops, tol) → { orbit (per atom), R (per atom: the rotation that
   takes its orbit's first atom to it), ref (per orbit: that first atom's index) }: the
   atoms of the filled cell grouped into crystallographic sites under the operations found
   (findSymmetry), within tol Å — the sets that share one displacement parameter (an
   anisotropic one turned by R from atom to atom). A P1 file lists every atom as its own
   site: its orbits come from the symmetry found, not from the file's labels. */
function atomOrbits(cell, atoms, ops, tol = 0.01){
  const { G } = metric(cell), n = atoms.length, tol2 = tol*tol;
  const list = ops && ops.length ? ops : [{ R: IDENT, t: [0,0,0] }];
  const orbit = new Int32Array(n).fill(-1), Rof = new Array(n), ref = [];
  const kind = a => (a.key || a.element || a.label) + '|' + (+(a.occ ?? 1)).toFixed(3);
  const dist2 = (p, q) => {
    let d0 = p[0]-q[0], d1 = p[1]-q[1], d2 = p[2]-q[2];
    d0 -= Math.round(d0); d1 -= Math.round(d1); d2 -= Math.round(d2);
    return G[0]*d0*d0 + G[4]*d1*d1 + G[8]*d2*d2 + 2*(G[1]*d0*d1 + G[2]*d0*d2 + G[5]*d1*d2);
  };
  for (let j = 0; j < n; j++){
    if (orbit[j] >= 0) continue;
    const o = ref.length, kj = kind(atoms[j]), xj = [atoms[j].x, atoms[j].y, atoms[j].z];
    ref.push(j); orbit[j] = o; Rof[j] = IDENT.slice();
    for (const { R, t } of list){
      const y = apply3(R, xj); y[0] += t[0]; y[1] += t[1]; y[2] += t[2];
      for (let k = 0; k < n; k++){
        if (orbit[k] >= 0 || kind(atoms[k]) !== kj) continue;
        if (dist2(y, [atoms[k].x, atoms[k].y, atoms[k].z]) < tol2){ orbit[k] = o; Rof[k] = R.slice(); break; }
      }
    }
  }
  return { orbit, R: Rof, ref };
}
/* siteAdpBasis(cell, ops, x, tol) → { names, vecs }: the anisotropic displacement
   parameters a site at x may have, U^ij in the CIF's convention (Å², on the reciprocal
   axes: β_ij = 2π² a*_i a*_j U^ij, the Debye–Waller factor exp(−hᵀβh)). The site's own
   operations (those that keep x within tol Å) must leave U unchanged: with
   N = diag(a*, b*, c*) and β turning as RβRᵀ, U turns as T U Tᵀ, T = N⁻¹RN. The
   constraints, as rows on (U11, U22, U33, U12, U13, U23), reduced to echelon form with
   the columns taken from the last, so the free parameters are the first ones (U11 rather
   than U33 on a cubic site, U11 and U33 on a tetragonal axis). vecs: each free
   parameter's U as a 6-vector. */
const U_NAMES = ['U11', 'U22', 'U33', 'U12', 'U13', 'U23'];
const U_IJ = [[0,0],[1,1],[2,2],[0,1],[0,2],[1,2]];
function siteAdpBasis(cell, ops, x, tol = 0.01){
  const { G, Gs } = metric(cell), N = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])], tol2 = tol*tol;
  const dist2 = d => { d = d.map(v => v - Math.round(v)); return G[0]*d[0]*d[0] + G[4]*d[1]*d[1] + G[8]*d[2]*d[2] + 2*(G[1]*d[0]*d[1] + G[2]*d[0]*d[2] + G[5]*d[1]*d[2]); };
  const rows = [];
  for (const { R, t } of (ops && ops.length ? ops : [])){
    const y = apply3(R, x);
    if (dist2([y[0] + t[0] - x[0], y[1] + t[1] - x[1], y[2] + t[2] - x[2]]) > tol2) continue;
    const T = (i, j) => R[3*i + j]*N[j]/N[i];
    U_IJ.forEach(([a, b], r)=>{
      const row = U_IJ.map(([c, d]) => c === d ? T(a, c)*T(b, d) : T(a, c)*T(b, d) + T(a, d)*T(b, c));
      row[r] -= 1;
      rows.push(row);
    });
  }
  // Echelon form on the columns from the last (U23 … U11).
  const order = [5, 4, 3, 2, 1, 0], A = rows.map(r => order.map(c => r[c])), piv = [];
  let rr = 0;
  for (let c = 0; c < 6 && rr < A.length; c++){
    let p = rr; for (let i = rr + 1; i < A.length; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    if (Math.abs(A[p][c]) < 1e-8) continue;
    [A[rr], A[p]] = [A[p], A[rr]];
    const d = A[rr][c]; for (let k = 0; k < 6; k++) A[rr][k] /= d;
    for (let i = 0; i < A.length; i++){ if (i === rr) continue; const f = A[i][c]; if (f) for (let k = 0; k < 6; k++) A[i][k] -= f*A[rr][k]; }
    piv.push(c); rr++;
  }
  const free = [0, 1, 2, 3, 4, 5].filter(c => !piv.includes(c));
  const names = [], vecs = [];
  for (const f of free){
    const v = new Array(6).fill(0);
    v[order[f]] = 1;
    piv.forEach((c, i) => { const val = -A[i][f]; if (Math.abs(val) > 1e-12) v[order[c]] = val; });
    names.push(U_NAMES[order[f]]); vecs.push(v);
  }
  // Free parameters in U11 … U23 order.
  const idx = names.map((_, i) => i).sort((i, j) => U_NAMES.indexOf(names[i]) - U_NAMES.indexOf(names[j]));
  return { names: idx.map(i => names[i]), vecs: idx.map(i => vecs[i]) };
}
// U^ij (6-vector, U11 … U23) → β (row-major 3×3, fractional) for the cell's reciprocal lengths.
function betaOf(Uv, Ns){
  const U = [[Uv[0], Uv[3], Uv[4]], [Uv[3], Uv[1], Uv[5]], [Uv[4], Uv[5], Uv[2]]], k = 2*Math.PI*Math.PI;
  return [0, 1, 2].flatMap(i => [0, 1, 2].map(j => k*Ns[i]*Ns[j]*U[i][j]));
}
// U_eq = ⅓ Σ U^ij a*_i a*_j (a_i·a_j) (Fischer & Tillmanns), Å².
function uEquiv(Uv, cell){
  const { G, Gs } = metric(cell), N = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])];
  const U = [[Uv[0], Uv[3], Uv[4]], [Uv[3], Uv[1], Uv[5]], [Uv[4], Uv[5], Uv[2]]];
  let s = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += U[i][j]*N[i]*N[j]*G[3*i + j];
  return s/3;
}

/* ---------- reflections ---------- */
// Powder reflections with d ≥ dmin, sorted by decreasing d: each orbit of h under the Laue
// group (the point group of the operations plus −1, i.e. Friedel pairs merged) once, with
// mult = orbit size; systematically absent ones (h·R = h and h·t ∉ ℤ for some operation)
// left out. Enumeration bound: |h| = |H·a| ≤ |H||a| = |a|/d, so |h| ≤ |a|/dmin holds for
// any cell, however oblique. The representative is the member with fewest negative
// indices, then the largest (h, k, l), so it reads (110), (210), (221) as in the tables.
function reflections(cell, ops, dmin){
  if (!(dmin > 0)) return [];
  const { G, Gs, V } = metric(cell);
  if (!(V > 0)) return [];      // angles that close no cell: no d is defined
  const list = ops && ops.length ? ops : [{ R: IDENT, t: [0,0,0] }];
  const laue = [], lk = new Set();
  for (const { R } of list) for (const M of [R, R.map(v => -v)]){
    const k = M.join(); if (!lk.has(k)){ lk.add(k); laue.push(M); }
  }
  const hm = Math.floor(Math.sqrt(G[0])/dmin + 1e-9), km = Math.floor(Math.sqrt(G[4])/dmin + 1e-9), lm = Math.floor(Math.sqrt(G[8])/dmin + 1e-9);
  const nk = 2*km + 1, nl = 2*lm + 1;
  const seen = new Uint8Array((2*hm + 1)*nk*nl);
  const idx = (h, k, l) => ((h + hm)*nk + (k + km))*nl + (l + lm);
  const inBox = (h, k, l) => Math.abs(h) <= hm && Math.abs(k) <= km && Math.abs(l) <= lm;
  const qmax = (1 + 1e-9)/(dmin*dmin);
  const better = (p, q) => {   // is member p a nicer representative than q?
    const np = (p[0] < 0) + (p[1] < 0) + (p[2] < 0), nq = (q[0] < 0) + (q[1] < 0) + (q[2] < 0);
    if (np !== nq) return np < nq;
    for (let i=0;i<3;i++) if (p[i] !== q[i]) return p[i] > q[i];
    return false;
  };
  const out = [];
  for (let h = -hm; h <= hm; h++) for (let k = -km; k <= km; k++) for (let l = -lm; l <= lm; l++){
    if (seen[idx(h, k, l)] || (!h && !k && !l)) continue;
    const q = h*h*Gs[0] + k*k*Gs[4] + l*l*Gs[8] + 2*(h*k*Gs[1] + h*l*Gs[2] + k*l*Gs[5]);
    if (q > qmax) continue;
    let mult = 0, rep = [h, k, l];
    for (const M of laue){
      const p = [h*M[0] + k*M[3] + l*M[6], h*M[1] + k*M[4] + l*M[7], h*M[2] + k*M[5] + l*M[8]];
      if (!inBox(p[0], p[1], p[2])) continue;
      const j = idx(p[0], p[1], p[2]);
      if (seen[j]) continue;
      seen[j] = 1; mult++;
      if (better(p, rep)) rep = p;
    }
    let absent = false;
    for (const { R, t } of list){
      if (h*R[0] + k*R[3] + l*R[6] !== h || h*R[1] + k*R[4] + l*R[7] !== k || h*R[2] + k*R[5] + l*R[8] !== l) continue;
      const ph = h*t[0] + k*t[1] + l*t[2];
      // Allowed phases are integers; forbidden ones sit ≥ 1/6 away, so 0.02 absorbs any
      // rounding left in t without ever passing a true extinction.
      if (Math.abs(ph - Math.round(ph)) > 0.02){ absent = true; break; }
    }
    if (!absent) out.push({ h: rep[0], k: rep[1], l: rep[2], d: 1/Math.sqrt(q), mult });
  }
  out.sort((x, y) => {
    if (Math.abs(x.d - y.d) > 1e-9*x.d) return y.d - x.d;
    return better([x.h, x.k, x.l], [y.h, y.k, y.l]) ? -1 : 1;
  });
  return out;
}

/* ---------- structure factors ---------- */
// Scattering amplitudes of every atom at s, each species and element looked up once.
function amplitudes(atoms, s, line){
  const f0c = new Map(), fpc = new Map(), s2 = s*s;
  const n = atoms.length, fr = new Float64Array(n), fi = new Float64Array(n);
  for (let j = 0; j < n; j++){
    const a = atoms[j], key = a.key || a.element || a.label, el = a.element || key;
    let f = f0c.get(key);
    if (f === undefined){ f = f0(key, s); f0c.set(key, f); }
    let fp = fpc.get(el);
    if (fp === undefined){ fp = line ? fprime(el, line) : [0, 0]; fpc.set(el, fp); }
    const w = (a.occ ?? 1)*Math.exp(-(a.Biso ?? 0)*s2);
    fr[j] = w*(f + fp[0]); fi[j] = w*fp[1];
  }
  return { fr, fi };
}
const hklOf = r => Array.isArray(r) ? r : [r.h, r.k, r.l];

// F(h) = Σ occ·exp(−B s²)·(f0 + f′ + i f″)·exp(2πi h·x) over the atoms of the cell.
// `line` is a characteristic line name ('CuKa1', …) for f′, f″; null for none.
function structureFactor(hkl, atoms, s, line){
  const [h, k, l] = hklOf(hkl);
  const { fr, fi } = amplitudes(atoms, s, line);
  let re = 0, im = 0;
  for (let j = 0; j < atoms.length; j++){
    const a = atoms[j], ph = 2*Math.PI*(h*a.x + k*a.y + l*a.z), c = Math.cos(ph), sn = Math.sin(ph);
    re += fr[j]*c - fi[j]*sn; im += fr[j]*sn + fi[j]*c;
  }
  return { re, im };
}
// (|F(h)|² + |F(−h)|²)/2: a powder line holds h and −h, which f″ makes unequal in a
// non-centrosymmetric structure. Both from one pass over the atoms.
function F2(hkl, atoms, s, line){
  const [h, k, l] = hklOf(hkl);
  const { fr, fi } = amplitudes(atoms, s, line);
  let r1 = 0, i1 = 0, r2 = 0, i2 = 0;
  for (let j = 0; j < atoms.length; j++){
    const a = atoms[j], ph = 2*Math.PI*(h*a.x + k*a.y + l*a.z), c = Math.cos(ph), sn = Math.sin(ph);
    r1 += fr[j]*c - fi[j]*sn; i1 += fr[j]*sn + fi[j]*c;   // F(h)
    r2 += fr[j]*c + fi[j]*sn; i2 += fi[j]*c - fr[j]*sn;   // F(−h): phase −ph
  }
  return 0.5*(r1*r1 + i1*i1 + r2*r2 + i2*i2);
}

/* ---------- lattice parameters under a constraint ---------- */
const kindOf = c => typeof c === 'string' ? { kind: c } : (c || { kind:'triclinic' });
// Names of the free lattice values, in the order latticeParams returns them.
function latticeNames(constraint){
  const c = kindOf(constraint);
  if (c.params) return c.params.slice();
  switch (c.kind){
    case 'cubic': case 'isotropic': return ['a'];
    case 'tetragonal': case 'hexagonal': return ['a','c'];
    case 'rhombohedral': return ['a','alpha'];
    case 'orthorhombic': return ['a','b','c'];
    case 'monoclinic': return ['a','b','c', { a:'alpha', c:'gamma' }[c.unique] || 'beta'];
    default: return ['a','b','c','alpha','beta','gamma'];
  }
}
// With a conventional basis (classify), the values are the conventional cell's.
function latticeParams(constraint, cell){
  const c = kindOf(constraint);
  const cc = c.basis && c.conv ? cellInBasis(cell, c.basis) : cell;
  return latticeNames(c).map(n => cc[n]);
}
// The cell from the free values; whatever the constraint fixes comes from `template` (the
// starting cell), so a cubic cell keeps its 90°, a hexagonal one its 120°. With a
// conventional basis the values build the conventional cell (its own template), and the
// cell returned is the one given, in its own basis.
function cellFrom(constraint, values, template){
  const c0 = kindOf(constraint);
  if (c0.basis && c0.conv) return cellInBasis(cellFrom({ kind: c0.kind, unique: c0.unique, params: c0.params }, values, c0.conv), inv3(c0.basis));
  const c = c0, v = values, T = template;
  const cell = { a: T.a, b: T.b, c: T.c, alpha: T.alpha, beta: T.beta, gamma: T.gamma };
  switch (c.kind){
    case 'cubic': cell.a = cell.b = cell.c = v[0]; break;
    case 'isotropic': { const f = v[0]/T.a; cell.a = v[0]; cell.b = T.b*f; cell.c = T.c*f; break; }
    case 'tetragonal': case 'hexagonal': cell.a = cell.b = v[0]; cell.c = v[1]; break;
    case 'rhombohedral': cell.a = cell.b = cell.c = v[0]; cell.alpha = cell.beta = cell.gamma = v[1]; break;
    case 'orthorhombic': cell.a = v[0]; cell.b = v[1]; cell.c = v[2]; break;
    case 'monoclinic': { cell.a = v[0]; cell.b = v[1]; cell.c = v[2]; cell[latticeNames(c)[3]] = v[3]; break; }
    default: [cell.a, cell.b, cell.c, cell.alpha, cell.beta, cell.gamma] = v;
  }
  return cell;
}

export { parseCif, parseSymop, symopString, parseFormula, metric, dSpacing, expandAtoms, cellContents, cellMass,
         checkComposition, findSymmetry, holohedry, reflections, structureFactor, F2, latticeNames, latticeParams, cellFrom,
         atomOrbits, siteAdpBasis, betaOf, uEquiv, U_NAMES };
