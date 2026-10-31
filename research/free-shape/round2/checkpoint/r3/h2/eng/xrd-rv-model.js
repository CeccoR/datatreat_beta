/* =========================================================
   XRPD — the Rietveld card's calculations, which touch no page (xrd-rv.js wires them to
   the card; tests/rvmodel.test.mjs calls them in Node): a phase read from its CIF; its
   fitting modes, the start and the Refinement settings, made valid, and the card's state
   saved and read back; what a run sends the worker and what the card keeps of its answer;
   what a result is drawn with (its phases, curves, ticks and sizes); the CSVs.
========================================================= */
import { parseCif, expandAtoms, structureCell, checkComposition, cellMass, metric, reflections } from './xrd-cryst.js';
import { readXrdmlInstrumentText } from './xrd-instr.js';
import { buildModel, calc, fitSettings, phaseSites, bgInvOn, shapeNamed } from './xrd-rietveld.js';
import { spaceGroupName, spaceGroupSymbol } from './xrd-sg.js';
import { fixed, isFixed } from './db.js';

const PHASE_COLORS = ['#d4a72c', '#c77dff', '#ff8a65', '#7cc4ff', '#e05f8a', '#9ccc65'];

/* A phase from a CIF: the atoms of the whole cell, and the symmetry the structure has.
   A file in P1 (as Materials Project gives them) lists every atom with no symmetry, so
   the symmetry is found from the atoms (findSymmetry): it decides how the cell is
   refined — a cubic cell by a alone, not by six free lengths and angles. The atoms are
   taken as that symmetry places them (within the rounding of the file), and a structure
   whose lattice is finer than the file's cell (a supercell, a hexagonal structure in its
   orthohexagonal cell) is refined in its own cell (structureCell). A file with its own
   operations is expanded with them, and checked against its formula and Z, which catches
   the commonest mistake, coordinates of one origin choice with the operations of the
   other. */
function prepPhase(text, fileName){
  const cif = parseCif(text);
  if (!cif || !cif.cell || !cif.sites || !cif.sites.length) throw new Error('No cell or no atom sites in this CIF.');
  const own = cif.ops && cif.ops.length > 1;
  const atoms = expandAtoms(own ? cif.ops : [], cif.sites);
  const sc = structureCell(cif.cell, atoms), sym = sc.sym;
  const comp = checkComposition(atoms, cif.formulaSum, cif.Z);
  const notes = [], warnings = [...(cif.warnings || [])];
  if (sc.basis){
    const c = sc.cell, r = v => +v.toFixed(4), V = metric(c).V/metric(cif.cell).V;
    notes.push(`the structure repeats on a lattice finer than the file's cell: refined in its own cell, a ${r(c.a)}, b ${r(c.b)}, c ${r(c.c)} Å, α ${r(c.alpha)}, β ${r(c.beta)}, γ ${r(c.gamma)}° (${+V.toFixed(4)}× the file's volume; the same pattern)`);
  }
  // (a file without operations: its symmetry found from the atoms is in the structure's
  // details, "from the atoms" and its operations, not a note)
  if (own && (sym.order !== cif.ops.length || sc.basis)) notes.push(`${cif.ops.length} operations in the file; the structure has ${sym.order}${sc.basis ? ' in its own cell' : ''}`);
  // A cell refined by one common scale (no conventional setting found): its axial ratios
  // and angles stay the file's, which the user should know.
  if (sym.constraint && sym.constraint.kind === 'isotropic' && sym.constraint.note) notes.push(sym.constraint.note);
  if (sym.bSpread > 0.01) notes.push(`the B of atoms the symmetry makes equivalent differed (by up to ${+sym.bSpread.toFixed(2)} Å² from their mean): each takes its site's mean`);
  if (sym.group === false) warnings.push('The symmetry found from the atoms does not close into a group at any tolerance tried (atoms of one kind within 0.01 Å of each other?): the operations used may be incomplete.');
  if (comp && !comp.ok && comp.message) warnings.push(comp.message);
  else if (comp && comp.note) notes.push(comp.note);
  // The sites, named as the engine names them (phaseSites): what Site occupancy offers.
  const sites = phaseSites(sc.cell, sc.atoms, sym.ops).sites.map(st=> ({ label: st.label, element: st.element, n: st.members.length }));
  // The space group the file names, else the one its atoms have (xrd-sg.js).
  const named = spaceGroupName(cif.hm);
  let sg = named;
  if (!sg){ try { sg = spaceGroupSymbol(sc.cell, sym.ops, sym.constraint); } catch(e){ sg = null; } }
  return {
    name: cif.name || (fileName || '').replace(/\.cif$/i, ''), file: fileName || '', formula: cif.formulaSum || '', sites,
    cell: sc.cell, ops: sym.ops, atoms: sc.atoms, system: sym.system, constraint: sym.constraint, order: sym.order,
    mass: cellMass(sc.atoms), notes, warnings, ownCell: !!sc.basis, Z: cif.Z || null,
    sg: sg || null, sgFrom: named ? 'cif' : sg ? 'atoms' : null, src: textKey(text),
  };
}
// A text's content as a short key: FNV-1a over its characters, and its length.
function textKey(s){
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + '.' + s.length;
}
/* prepPhase by the CIF's text and the file's name (which names a phase whose CIF has none):
   an undo, a redo or a tab switch restores every phase, and each was read again there (to
   v483), its CIF parsed and its symmetry found anew. What it gives is shared by the phases
   of that text, every card's, and nothing changes it. The last 32 read are kept. */
const PREPS = new Map();
function prepOf(text, fileName){
  const k = (fileName || '') + '\n' + text;
  let q = PREPS.get(k);
  if (q){ PREPS.delete(k); PREPS.set(k, q); return q; }
  q = prepPhase(text, fileName);
  PREPS.set(k, q);
  if (PREPS.size > 32) PREPS.delete(PREPS.keys().next().value);
  return q;
}
// The cell a phase is refined in, as a key: a result refined in another (the file's, before
// v426 re-expressed supercells and orthohexagonal cells) does not belong to the phase now.
const cellKey = c => [c.a, c.b, c.c, c.alpha, c.beta, c.gamma].map(v=> +(+v).toFixed(6)).join();
/* A result is never changed once written (a new one replaces it): frozen, deep, it is shared
   by the undo states it is in and by the curves drawn from it; its lists of numbers or
   names fixed instead (db.js: shared by a state parked; a double frozen takes twice the
   memory). (A typed array cannot be frozen; a result holds none.) */
const isObj = x => x !== null && typeof x === 'object';
function frozen(v){
  if (Array.isArray(v) && (isFixed(v) || !v.some(isObj))) return fixed(v);
  if (v && typeof v === 'object' && !ArrayBuffer.isView(v) && !Object.isFrozen(v)){ Object.freeze(v); for (const k in v) frozen(v[k]); }
  return v;
}

// The engine's options as the v428 pickers named them; read from projects of v428 or older
// (migrateSettings) and from results (curvesOf). The crystallite shapes (xrd-rietveld
// SHAPE_TYPES): none (the isotropic size) or a free solid; a project saved with the one free
// shape there was (true) has the ellipsoid.
const SHAPES = [['', 'isotropic size'], ['ellipsoid', 'ellipsoid'], ['spheroid', 'spheroid (two axes equal)'], ['cylinder', 'cylinder'], ['ellcyl', 'elliptic cylinder'], ['box', 'box'], ['sqbox', 'square-based box']];
const shapeOpt = v => v === true ? 'ellipsoid' : SHAPES.some(([k])=> k && k === v) ? v : false;
const TEXTURE_AXES = ['100', '010', '001', '110', '111'];
const textureOpt = v => v === 'auto' || TEXTURE_AXES.includes(v) ? v : '';
const profileOpt = v => v === 'wppm' || v === 'lognormal' ? v : 'lorentz';
const strainOpt = v => v === 'aniso' ? 'aniso' : 'iso';
// Planar faults: the planes' family and the displacement (conventional indices), the
// common kinds named.
const FAULTS = [['111:1/6<112>', '{111} ⅙⟨112⟩, fcc stacking'], ['001:1/3<1-10>', '(001) ⅓⟨1-10⟩, hexagonal stacking'], ['100:1/2<111>', '{100} ½⟨111⟩, Ruddlesden–Popper'],
  ['100:1/2<110>', '{100} ½⟨110⟩, antiphase'], ['111:1/2<110>', '{111} ½⟨110⟩, antiphase'], ['110:1/2<110>', '{110} ½⟨110⟩']];
const faultOpt = v => FAULTS.some(([k])=> k === v) ? v : '';
const adpOpt = v => v === 'overall' || v === 'site' || v === 'aniso' ? v : 'cif';

/* The fitting modes of a phase (the settings modal, a row each): each switched on or off
   and, when on, refined at a depth. The engine's options follow from them (engineOf): a
   mode off is the engine's "none" — no size or strain broadening (size false, strain
   'off'), the Lorentzian profile, no faults, the CIF's B, no texture. The defaults are
   v428's: an isotropic size and strain, the rest off. */
const MODES = [
  { k: 'size', label: 'Crystallite size', on: true, list: [['iso', 'isotropic'], ...SHAPES.filter(([k])=> k).map(([k, t])=> [k, 'free shape: ' + t.replace(' (two axes equal)', '')])],
    title: "The crystallites' size broadening, Y_s/cosθ above the instrument's. Off: none (Y_s held at 0). Isotropic: one size. Free shape: a solid of any proportions and orientation, each reflection of a family with its own width; it tries several starting shapes (tens of seconds a sample, minutes with many reflections or log-normal sizes) and is kept only when the data support it against the isotropic size. Size models need the standard's profile" },
  { k: 'wppm', label: 'WPPM (size profile)', on: false, list: [['wppm', 'one size'], ['lognormal', 'log-normal sizes']],
    title: "The size broadening's profile. Off: a Lorentzian, the size read with Scherrer's K = 0.9 (an apparent size: spheres of one size read 1.0–1.7 times theirs). On: Whole Powder Pattern Modelling, each line the Fourier transform of the crystallites' own common-volume function with the instrument's, the strain's and the faults' coefficients: the true dimensions, of one size or over a log-normal distribution of sizes (σ refined). Needs the crystallite size and the standard's profile" },
  { k: 'strain', label: 'Microstrain', on: true, list: [['iso', 'isotropic'], ['aniso', 'anisotropic (Stephens)']],
    title: "Off: none (X_s held at 0). Isotropic: one microstrain, the Lorentzian 4ε·tanθ. Anisotropic (Stephens): ε² a quartic form of the reflection's direction that the Laue group leaves unchanged (1 more term for a cubic phase, up to 14 for a triclinic one): a strain that depends on hkl. Anisotropic needs the standard's profile" },
  { k: 'faults', label: 'Planar faults', on: false, list: FAULTS,
    title: "Planar faults (after Warren) on the planes of a family, each displacing the crystal beyond it by a vector of the family: a reflection whose h·R is not an integer broadens (by parity, not by order). Refined: the probability per plane. Needs the standard's profile" },
  { k: 'adp', label: 'Displacement parameters', on: false, list: [['overall', 'one ΔB'], ['site', 'B per site'], ['aniso', 'U per site, anisotropic']],
    title: "Off: the CIF's B, held (0.5 Å² for every atom where the CIF gives none; a B 0.5 Å² off goes into the strain and the size, 10–20 % in the size). On: one ΔB added to every atom's B; one B per crystallographic site; or Uⁱʲ per site, those its symmetry leaves free. Each is strongly correlated with the scale, the background and, on broad peaks, the widths: they want data to high angle. On nanocrystalline patterns they can come out unphysical (negative, or on their bound), whatever the size model, taking up what the model lacks rather than vibrations" },
  // Its depth is a site of the phase's own (siteList): the list is the phase's.
  { k: 'occ', label: 'Site occupancy', on: false, list: [], sites: true,
    title: "Off: the CIF's occupancies, held. On: the occupancy of the site chosen refined — the share of it its species fills, read from how strongly it scatters at every angle alike (a B lowers it more the higher the angle). Under 1, atoms missing (vacancies, a depleted surface) or a lighter species beside them; over 1, a heavier one. On a nanocrystalline SrTiO₃ whose Sr site scatters 0.7 of a full one, the CIF's full site had been read as a negative B, a texture and B per site of +4 and −2 Å². Correlated with the scale and the displacement parameters: on data to 80° hold B or refine one ΔB beside it" },
  { k: 'po', label: 'Preferred orientation', on: false, list: [['auto', 'best axis'], ...TEXTURE_AXES.map(a=> [a, `(${a})`])],
    title: "March–Dollase: the crystallites' planes (hkl) lie preferentially parallel to the surface (r under 1, plates) or across it (r over 1, needles), which changes the intensities, not the widths. Best axis: the lowest χ² of the low-index planes" },
];
const MODE = Object.fromEntries(MODES.map(m=> [m.k, m]));
// The rows that do not apply to the standard: its widths are the instrumental profile,
// refined as U, V, W, X, Y (autoRefine refines it without an irf, so a size, strain or
// fault model of its own would be refused anyway), and its structure is certified. Its
// settings, its own since v460, do not show them (to v493 shown, disabled).
const STD_NA = ['size', 'wppm', 'strain', 'faults', 'occ'];
// A mode's depths for a phase: its own sites for the occupancy, else the mode's list.
const siteList = p => ((p && p.prep && p.prep.sites) || []).map(st=> [st.label, `${st.label} (${st.element}${st.n > 1 ? ', ×' + st.n : ''})`]);
const listOf = (p, m) => m.sites ? siteList(p) : m.list;
// The depth in force: for the occupancy a site of the phase's (the first when the one
// saved is not, or none was chosen yet).
const depOf = (p, k) => { const v = p.dep[k], l = listOf(p, MODE[k]); return l.some(([x])=> x === v) ? v : (l[0] || [''])[0]; };
const defSettings = () => ({ on: Object.fromEntries(MODES.map(m=> [m.k, m.on])), dep: Object.fromEntries(MODES.map(m=> [m.k, m.sites ? '' : m.list[0][0]])) });
// The standard's: one ΔB, as the built-in LaB6 had before v429 (lab6.adp); no texture.
const stdSettings = () => { const s = defSettings(); STD_NA.forEach(k=> { s.on[k] = false; }); s.on.adp = true; return s; };
// Settings as saved, made valid: a flag not a boolean, or a depth not offered, takes the default.
const cleanSettings = (s, def) => ({
  on: Object.fromEntries(MODES.map(m=> [m.k, s && s.on && typeof s.on[m.k] === 'boolean' ? s.on[m.k] : def.on[m.k]])),
  // (a site is the phase's to check: depOf)
  dep: Object.fromEntries(MODES.map(m=> [m.k, s && s.dep && (m.sites ? typeof s.dep[m.k] === 'string' : m.list.some(([v])=> v === s.dep[m.k])) ? s.dep[m.k] : def.dep[m.k]])) });
// A phase of a project of v428 or older: each option a picker whose first choice was its
// "none" (the isotropic size, the Lorentzian, no faults, the CIF's B, no texture).
function migrateSettings(p, refineB){
  const s = defSettings(), shape = shapeOpt(p.shape), prof = profileOpt(p.profile), fl = faultOpt(p.faults), po = textureOpt(p.po);
  // (before the per-phase displacement option, one card-wide ΔB toggle: on, one ΔB each)
  const adp = p.adp ? adpOpt(p.adp) : refineB ? 'overall' : 'cif';
  if (shape) s.dep.size = shape;
  if (prof !== 'lorentz'){ s.on.wppm = true; s.dep.wppm = prof; }
  s.dep.strain = strainOpt(p.strain);
  if (fl){ s.on.faults = true; s.dep.faults = fl; }
  if (adp !== 'cif'){ s.on.adp = true; s.dep.adp = adp; }
  if (po){ s.on.po = true; s.dep.po = po; }
  return s;
}
// The engine's options of a phase (phaseData) from its settings.
function engineOf(p, std){
  const on = p.on, d = p.dep, adp = on.adp ? d.adp : 'cif', po = on.po ? d.po : null;
  // The standard: no broadening model of its own (STD_NA); the fields as before v429.
  if (std) return { size: true, shape: false, profile: 'lorentz', strain: 'iso', faults: null, adp, po, occ: null };
  const occ = on.occ && siteList(p).length > 1 && depOf(p, 'occ') ? [depOf(p, 'occ')] : null;
  return { size: on.size, shape: on.size && d.size !== 'iso' ? d.size : false, profile: on.size && on.wppm ? d.wppm : 'lorentz',
    strain: on.strain ? d.strain : 'off', faults: on.faults ? d.faults : null, adp, po, occ };
}
/* Where a refinement starts (the settings' Start section): from the CIF (the full staged
   refinement) or from the pattern's last result, with these groups of parameters held at
   it (xrd-rietveld autoRefine's opts.hold; the engine's rule decides what is held). */
const HOLDS = [
  ['linear', 'Scales, background', 'The phases\' scales and the background (refined, not held, when the background\'s degree or its 1/2θ term changed since: Refinement)'],
  ['cell', 'Cell, displacement', 'The lattice parameters and the specimen displacement; on the standard, the zero and the displacement'],
  ['instrument', 'Instrument profile', 'U, V, W, X, Y and the asymmetry, where they are refined: on the standard, or on a sample refined without the standard\'s profile (with it they are always the standard\'s)'],
  ['sizestrain', 'Size and strain', 'Y_s, X_s, Stephens\' S_j and the log-normal σ'],
  ['shape', 'Free shape', 'The free solid\'s widths and orientation (a solid kept is then not searched again)'],
  ['faults', 'Planar faults', 'The fault probability'],
  ['adp', 'Displacement (B)', 'ΔB, the B per site or the Uⁱʲ per site'],
  ['occ', 'Occupancy', 'The refined site occupancy'],
  ['texture', 'Texture', 'The preferred orientation\'s r and its axis'],
];
const HOLD_KEYS = HOLDS.map(([k])=> k), HOLD_DEFAULT = HOLD_KEYS.filter(k=> k !== 'linear');
// The groups of the models the standard has none of (STD_NA, no free shape): its settings
// do not show them (to v493 shown, ticked, holding nothing there); kept as they are.
const STD_HOLD_NA = ['sizestrain', 'shape', 'faults', 'occ'];
const START_RULE = 'Each pattern starts from its own last refinement. A group ticked is held at its values there — but only the parameters that refinement refined with the same model: whatever is new or changed since (an option switched on, a depth changed, a shape type changed) is refined, from its usual start. Everything not held is refined from the last values. A pattern with no last result, or one refined with other phases or another cell, is refined from the CIF.';
/* The Refinement settings (card-wide, the settings' last section): the least squares' and
   the searches' hyperparameters, sent as opts.fit (xrd-rietveld fitSettings). Only the
   keys changed are kept, absent is the engine's default. The defaults and ranges are
   fitSettings' own (it clamps ±∞ to the ends), so the page refuses what the engine would
   clamp. pct: shown in per cent, kept as a fraction; role: the only role it acts in;
   shape: used by the free shape's search alone. */
const FIT_DEF = fitSettings({});
const FITS = [
  { k: 'maxIter', label: 'Max iterations', int: true, said: v => `max ${v} iterations`,
    title: "Levenberg–Marquardt iterations allowed in each refinement: each stage, each trial (the size distribution's, the texture's), the free shape's (its full refinements 1.5 times as many, its brief trials 8, or this when fewer). A refinement stopped by it is said under the results." },
  { k: 'shiftTol', label: 'Shift tolerance (esd)', said: v => `shift tolerance ${v} esd`,
    title: 'A refinement has converged when no parameter moves by more than this fraction of its esd in an iteration (or χ² stops falling). Smaller: more iterations, the values settled further.' },
  { k: 'lambda', label: 'Starting damping λ', said: v => `starting λ ${v}`,
    title: "Marquardt's damping at the start of each refinement: larger, shorter first steps down the gradient. The convergence test allows for it, so from 1e-8 to 1000 the refinements reach the same minimum, in more or fewer iterations." },
  { k: 'bgDegree', label: 'Background degree', int: true, said: v => `background degree ${v}`,
    title: "The background's Chebyshev terms T₀…Tₙ over the pattern. More take a broader hump (an amorphous part), but also the lines' tails where their shape is not fully modelled, which moves the sizes. A result is drawn with its own." },
  { k: 'bgInv', label: '1/2θ background term', bool: true, said: v => `1/2θ term ${v ? 'on' : 'off'}`,
    title: 'A term c/2θ in the background, for the air scatter that rises at low angles. Automatic: on when the scan starts below 20° (never when it reaches 0°).' },
  { k: 'cellRange', label: 'Cell search range (%)', pct: true, role: 'sample', said: v => `cell search ±${fitTxt(v*100)} %`,
    title: "How far the cell search scales the CIF's cell lengths, ± this: a sample's cell may be a few per cent off the file's (doping, a DFT cell, temperature). A lone phase not found is searched again over twice it. Wider: slower, and more room for a false minimum. Samples only." },
  { k: 'zeroRange', label: 'Zero scan range (°)', role: 'std', said: v => `zero scan ±${v}°`,
    title: "The standard's zero is scanned over ± this before its refinement (the zero and the specimen's displacement together). Beyond 1° its bounds widen with it. The standard only." },
  { k: 'shapeStarts', label: 'Shape trial starts', int: true, shape: true, said: v => `${v} shape starts`,
    title: "The free shape's search: the starting shapes beside the sphere-like one. The plates and needles along the low-index directions are always run, random shapes fill up to this. More: slower, less likely to miss the best solid." },
  { k: 'shapeFull', label: 'Shape full refinements', int: true, shape: true, said: v => `${v} shape starts refined fully`,
    title: "The free shape's best trial starts refined to convergence." },
];
const FIT = Object.fromEntries(FITS.map(m=> [m.k, m]));
// A setting as shown (twelve significant digits: 7.3 % is 0.073, not 0.07300000000000001).
const fitTxt = v => String(+(+v).toPrecision(12));
FITS.forEach(m=>{ if (m.bool) return;
  m.lo = fitSettings({ [m.k]: -Infinity })[m.k]; m.hi = fitSettings({ [m.k]: Infinity })[m.k];
  const s = v => fitTxt(m.pct ? v*100 : v), u = m.pct ? ' %' : m.k === 'zeroRange' ? '°' : '';
  m.range = `${s(m.lo)}–${s(m.hi)}`;
  m.rule = `${m.int ? 'a whole number' : 'a number'} from ${s(m.lo)} to ${s(m.hi)}${u}`;
  m.full = `${m.title} Default ${s(FIT_DEF[m.k])}${u}; ${m.rule}.`;
});
// A setting as the engine takes it, from the field's text, or null when not allowed. A
// comma reads as the point (as figure.js readNum), but the whole entry must be a decimal
// number (an exponent allowed: 1e-6); not hex or binary (+'0x10' is 16), nor Infinity.
const DEC = /^[+-]?(\d+[.,]?\d*|[.,]\d+)(e[+-]?\d+)?$/i;
function readFit(m, raw){
  const t = String(raw).trim();
  // A whole number written with a separator is refused: "1.000" or "1,000" may mean a
  // thousand (an Italian or an English grouping) and would read as 1.
  if (m.int && /[.,]/.test(t)) return null;
  // (+ 0: −0 is 0)
  let v = DEC.test(t) ? +t.replace(',', '.') + 0 : NaN;
  if (!Number.isFinite(v) || (m.int && !Number.isInteger(v))) return null;
  if (m.pct) v = +(v/100).toPrecision(12);
  return v >= m.lo && v <= m.hi ? v : null;
}
// Settings as saved, made valid: a key unknown, out of range or at its default is dropped.
function cleanFit(s){
  const out = {};
  if (s && typeof s === 'object') FITS.forEach(m=>{
    const v = s[m.k];
    if (m.bool ? v === true || v === false : typeof v === 'number' && readFit({ ...m, pct: false }, v) === v && v !== FIT_DEF[m.k]) out[m.k] = v;
  });
  return out;
}

// A phase's formula from the atoms of its cell, reduced ('Sr1 Ti1 O3' or eight-formula-unit
// cells alike give SrTiO3); the CIF's own where the counts are not whole (a mixed site).
function formulaOf(prep){
  const n = {};
  for (const a of prep.atoms) n[a.element] = (n[a.element] || 0) + (a.occ ?? 1);
  const els = Object.keys(n), ints = els.map(e => Math.round(n[e]));
  const whole = els.length && els.every((e, i) => Math.abs(n[e] - ints[i]) < 1e-3 && ints[i] > 0);
  if (!whole){
    const f = String(prep.formula || '').trim();
    return f ? f.replace(/([A-Za-z])1(?![\d.])/g, '$1').replace(/\s+/g, '') : els.join('');
  }
  const gcd = (a, b) => b ? gcd(b, a % b) : a, g = ints.reduce(gcd);
  // Electropositive first, oxygen and the halogens last, as formulae are written.
  const last = ['N', 'P', 'As', 'S', 'Se', 'Te', 'O', 'F', 'Cl', 'Br', 'I'];
  const order = els.map((e, i) => [e, ints[i]/g]).sort((a, b) => (last.indexOf(a[0]) - last.indexOf(b[0])) || 0);
  return order.map(([e, c]) => e + (c === 1 ? '' : c)).join('');
}
/* The sizes the Results chart by sample (sizesOf): a result's rows, and what each is — in
   the legend by its phase's name, how it is read in the note under the chart, and by the
   value where a phase has sizes of several kinds. */
const SIZE_ROWS = { crystallite_size_nm: 'scherrer', sphere_diameter_nm: 'sphere', size_volume_mean_nm: 'volume' };
const SIZE_KINDS = {
  scherrer: ['Scherrer size', "Scherrer size: the Lorentzian's, K = 0.9, an apparent size (spheres of one size read 1.0–1.7 times their diameter).", 'Scherrer'],
  sphere: ['sphere diameter (WPPM)', 'Sphere diameter (WPPM): the true diameter of spheres of one size.', 'sphere'],
  volume: ['volume-weighted mean diameter (WPPM)', 'Volume-weighted mean diameter (WPPM, log-normal sizes): what the breadth measures; the median and the number-weighted mean are in the results.', 'volume mean'],
  shape: ["free shape's dimensions", "Free shape: its dimensions, each measured one with its esd (dimensions not told apart, their mean) — with WPPM the solid's own, else read as the Scherrer size is.", 'shape'],
};
/* Reflections at one 2θ (a cubic phase's 300 and 221: the same h² + k² + l²) are one peak,
   the sum of both: written "300 + 221" (up to v462 "300/221", which read as a division).
   The widths keep "300/221" as the peak's name, which matches it across patterns and
   saved results; only what is shown and exported is written so. */
const hklShow = lab => String(lab).split('/').join(' + ');
const hklPlain = t => String(t).split(' / ').join(' + ');
/* A negative Miller index has a bar over it where the text is rich: the results, the
   settings' line by their title, the widths' table and tests, the plots' labels (plot.js
   runs) and the 3D views (xrd-shape3d). Plain text keeps the minus hklText writes (the
   CSVs, the tooltips); an <option>, which takes no markup, has a combining overline after
   each digit (optBars). To v486 the minus was shown everywhere (v480 had made it one sign).
   hklRuns: an index label ('1-10', '1 -1 11', '300 + 221' as hklShow writes it; '11̅0', a
   bar after its digit, in a result of v479 or older, whose result lines had '−') as
   [text, barred] runs, each negative index's digits barred and its minus dropped. Without
   spaces every index is one digit (hklText); with them, each number is one index. */
function hklRuns(t){
  const out = [], add = (s, bar) => { const l = out[out.length - 1]; if (l && !l[1] && !bar) l[0] += s; else out.push([s, bar]); };
  String(t).split(' + ').forEach((part, i)=>{
    if (i) add(' + ', false);
    const spaced = part.includes(' ');
    for (let j = 0; j < part.length; j++){
      const ch = part[j];
      if ((ch === '-' || ch === '−') && /\d/.test(part[j + 1] || '')){
        let e = j + 2;
        if (spaced) while (/\d/.test(part[e] || '')) e++;
        add(part.slice(j + 1, e), true); j = e - 1;
      } else if (/\d/.test(ch) && part[j + 1] === '\u0305'){ add(ch, true); j++; }
      else add(ch, false);
    }
  });
  return out;
}
// A label's runs for a plot (plot.js tickLabel, barLabel), as shown (cut to fit, its index
// at its end: whole), or null where nothing is barred: the label drawn as it always was.
function plotRuns(shown, hkl){
  if (!shown.endsWith(hkl)) return null;
  const r = hklRuns(hkl), pre = shown.slice(0, shown.length - hkl.length);
  return r.some(x=> x[1]) ? (pre ? [[pre, false], ...r] : r) : null;
}

// ---- the instrument, read from the file's own header (kept on the file object) ----
/* A pattern of a later <xrdMeasurement> of its file (f.meas, its index, v485) takes that
   measurement's header, kept with its index (meas): to v493 every pattern took the first
   measurement's, a scan measured otherwise (another tube, other optics) refined with the
   first's wavelengths. */
function instrOf(f){
  const k = Number.isInteger(f.meas) && f.meas > 0 ? f.meas : 0;
  // (one read before v426, saved with a session, lacks the monochromators' crystals; one
  // read to v493 for a later measurement's pattern, the first's header: read again)
  if (f.instr && Array.isArray(f.instr.monochromators) && (f.instr.meas || 0) === k) return f.instr;
  let ins = null;
  try {
    // (the bytes come back from a saved state, or a tab switch, as a plain array)
    const b = f.rawBytes, u8 = b == null ? null : b instanceof Uint8Array ? b : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : Array.isArray(b) ? Uint8Array.from(b) : null;
    // the bytes as they are: the reader finds their encoding (UTF-16 too)
    ins = u8 && u8.length ? readXrdmlInstrumentText(u8, k) : null;
  } catch(e){ ins = null; }
  if (ins && k) ins.meas = k;
  f.instr = ins || f.instr || null;
  return f.instr;
}
// The built-in LaB6's id (the standard's card: lab6).
const LAB6_ID = 0;
// The role a result was refined in: as the standard or as a sample; null for a result
// too old to say (before v429: the built-in LaB6 alone was the standard's).
const roleOf = r => r.standard != null ? !!r.standard : Array.isArray(r.phases) ? r.phases.length === 1 && r.phases[0] === LAB6_ID : null;
/* The instrumental profile a standard's refinement gives the samples (the standard's
   card: its own, from its file f; a sample's: the standard's, host.irf). */
function irfOf(f, results){
  const r = f && results[f.name] && roleOf(results[f.name]) !== false ? results[f.name] : null;
  if (!r || !r.params) return null;
  // asym: absent from a standard refined before the asymmetry was modelled (none then).
  // axL and transp (v432): the Soller model's length, where the standard's file gives its
  // Sollers (with their acceptances), and the sin 2θ shift; absent before.
  // λ1 and the radius: the profile is in degrees on that tube and goniometer (autoRefine
  // does not apply it to a pattern of another λ1).
  const ins = instrOf(f) || {}, sol = ins.soller || {}, P = r.params;
  return { U: P.U, V: P.V, W: P.W, X: P.X, Y: P.Y, asym: P.asym || 0, zero: P.zero,
    ...(Number.isFinite(P.transp) ? { transp: P.transp } : {}),
    ...(Number.isFinite(P.axL) ? { axL: P.axL, axP1: sol.incident, axP2: sol.diffracted } : {}),
    ...(Number.isFinite(ins.lam1) ? { lam1: ins.lam1 } : {}), ...(Number.isFinite(ins.radius) ? { radius: ins.radius } : {}) };
}
// A result's profile against the standard's now: the same refinement of it, or not (the
// standard refined again since, or cleared). Old results' irf has no λ1: U … zero decide.
const IRF_KEYS = ['U', 'V', 'W', 'X', 'Y', 'asym', 'zero', 'axL', 'transp'];
const sameIrf = (a, b) => !!a && !!b && IRF_KEYS.every(k=> (a[k] || 0) === (b[k] || 0));
// The phases as the engine takes them: their structure, and the options their settings
// give (engineOf; the standard's its own).
const phaseData = (list, std) => list.map(q=> ({ id: q.id, name: q.prep.name, cell: q.prep.cell, constraint: q.prep.constraint, ops: q.prep.ops, atoms: q.prep.atoms, mass: q.prep.mass, color: q.color,
  ...engineOf(q, std) }));
// The solid a result was refined with, from its parameters' names (each solid has its
// own), and only when they are in use (any width ≠ 0): the engine's shapeNamed.
const shapeOfParams = (P, id) => shapeNamed(P, 'p' + id + '.');
/* Why a pattern's last result cannot be started from — it must be of this pattern in
   this role, with these phases in these cells (autoRefine checks the parameters too) —
   or '' when it can. */
function lastUnusable(f, r, list, std){
  if (!r || !r.params) return 'not refined yet';
  const ids = r.phases || [];
  if (ids.length !== list.length || list.some(q=> !ids.includes(q.id))) return 'refined with other phases';
  if (roleOf(r) !== std) return 'refined in the other role';
  // (a result of v425 or older kept no cells: the file's cell then, so only a phase that
  // v426 re-expresses in a cell of its own has changed — as curvesOf reads it)
  if (r.cells ? list.some(q=> r.cells[q.id] !== cellKey(q.prep.cell)) : list.some(q=> q.prep.ownCell)) return 'a phase refined in another cell since';
  return '';
}
// A pattern's background terms under fit settings: the Chebyshev degree and whether the
// 1/2θ term is used (the engine's rule, bgInvOn: 'auto' is on from below 20°, never from 0°).
const bgTerms = (fs, f) => fs.bgDegree + (bgInvOn(scanRange(f)[0], fs.bgInv) ? '+inv' : '');
// run (refine's, xrd-rv.js): the phases, the start and the standard's profile as they
// were when the run started, the same for all its files (an undo during a run would
// otherwise change them between files; up to v477 the profile was read per file, and the
// standard refined during a batch gave the patterns after it another); run.fell collects
// the patterns refined from the CIF instead, run.bgFreed those whose scales and
// background are refined rather than held.
function payloadFor(f, run, results, std){
  const list = std ? [run.std] : run.ph.filter(q=> !q.off[f.name]), opts = { standard: std, irf: run.irf, fit: { ...run.fit } };
  if (run.start === 'last'){
    const r = results[f.name], why = lastUnusable(f, r, list, std);
    if (why) run.fell.push(`${f.label} (${why})`);
    // What autoRefine's start takes: the values, what was refined and held, the models,
    // the phases detected, the shapes kept with their isotropic fit, the profile used.
    else { opts.start = { params: r.params, free: r.free, held: r.held || [], models: r.models, textures: r.textures, shapes: r.shapes || {}, isoParams: r.isoParams || null, detected: r.detected, irf: r.irf || null };
      /* The background's terms changed since (its degree, or the 1/2θ term; a result of
         v428 or older had the defaults): the scales and background are a changed group,
         refined. Held, the terms kept would keep values fitted beside those dropped. */
      const bgMoved = bgTerms(fitSettings(r.fit), f) !== bgTerms(fitSettings(run.fit), f);
      if (bgMoved && run.hold.includes('linear')) run.bgFreed.push(f.label);
      opts.hold = run.hold.filter(k=> k !== 'linear' || !bgMoved); }
  }
  return { x: Array.from(f.x), y: Array.from(f.y), varMul: f.varMul ? Array.from(f.varMul) : null, instr: instrOf(f),
    phases: phaseData(list, std), opts, list };
}
// A result as the card keeps it (refine), frozen: the phases it was refined with (a CIF
// added meanwhile is not among them), the standard's profile as the worker used it (kept
// to tell when the standard changes); free, held, detected, shapes, isoParams: what the
// next start from it needs.
const resultRecord = (res, ph, std, at) => frozen({ ...res, standard: std, phases: ph.map(q=> q.id), irf: std ? null : res.irf || null, at,
  cells: Object.fromEntries(ph.map(q=> [q.id, cellKey(q.prep.cell)])) });

/* The phases as the result was refined: those it was refined with (a phase added
   since, or one unticked, would draw its default scale in the curve), in the cells it
   was refined in (else it throws). all: the card's phases; own: those refined on the
   pattern, for a result that names none (older than v429). */
function resultPhases(r, all, own){
  const ids = r.phases || null, list = ids ? all.filter(q=> ids.includes(q.id)) : own;
  if (ids && list.length !== ids.length) throw new Error('The phases changed since this refinement.');
  if (r.cells ? list.some(q=> r.cells[q.id] != null && r.cells[q.id] !== cellKey(q.prep.cell)) : list.some(q=> q.prep.ownCell))
    throw new Error('A phase is refined in another cell since this refinement.');
  return list;
}
// The curves themselves: the phases with the free shape when its parameters are there
// and the models the result used (a size or strain switched off among them), whatever
// the settings say now.
function curvesFrom(f, r, list, std){
  const ph = phaseData(list, std).map(q=>{
    const md = (r.models || {})[q.id] || {};
    return { ...q, shape: shapeOfParams(r.params, q.id), po: r.textures && r.textures[q.id] ? r.textures[q.id].hkl : null, size: md.size !== false,
      profile: profileOpt(md.profile), strain: md.strain === 'off' ? 'off' : strainOpt(md.strain), faults: md.faults || null, adp: adpOpt(md.adp),
      occ: Array.isArray(md.occ) ? md.occ : null };
  });
  // Built as the result's model was: its background terms and reflection list are those
  // of the fit settings it was refined with (r.fit; the defaults for a result of v428 or
  // older), not the settings now — a background of degree 12 drawn with 6 terms is wrong.
  const fs = fitSettings(r.fit);
  const model = buildModel({ x: f.x, y: f.y, varMul: f.varMul || null, instr: instrOf(f), phases: ph, bgDegree: fs.bgDegree, bgInv: fs.bgInv, cellRange: fs.cellRange });
  return calc(model, r.params);
}
/* A value as JSON, exactly: a NaN is not a null, nor −0 0 (what the curves take from a
   result and its instrument, in the key their kept curves are kept under: xrd-rv.js
   curveKey). */
const exactJson = v => JSON.stringify(v, (k, x)=> typeof x === 'number' && (!Number.isFinite(x) || Object.is(x, -0)) ? '#' + (Object.is(x, -0) ? '-0' : x) : x);
// The scan's 2θ range, low end first (the host turns a scan run downwards round, and
// the engine takes either order).
const scanRange = f => { const a = f.x[0], b = f.x[f.x.length-1]; return a <= b ? [a, b] : [b, a]; };
function tickRows(f, list){
  // Before a refinement the ticks sit where the file's cells put them, at Kα1 (over the
  // scan's range, whichever way it ran).
  const ins = instrOf(f) || {}, lam = ins.lam1 || 1.540598, [x0, x1] = scanRange(f);
  const dmin = lam/(2*Math.sin(Math.min(89.9, x1/2)*Math.PI/180));
  return list.map(q=> ({ color: q.color, name: q.prep.name,
    tt: reflections(q.prep.cell, q.prep.ops, dmin).map(r=> 2*Math.asin(lam/(2*r.d))*180/Math.PI).filter(t=> t >= x0 && t <= x1) }));
}
// The engine's ticks (each reflection at Kα1 where the refined cell puts it), one
// row per phase in the phases' order.
function groupTicks(ticks, list){
  return list.map(q=> ({ name: q.prep.name, color: q.color, tt: ticks.filter(t=> t.phase === q.id).map(t=> t.tt) }));
}

/* A pattern's sizes, by phase: the isotropic size — the Lorentzian's Scherrer size, WPPM's
   sphere diameter, or over a log-normal distribution its volume-weighted mean diameter,
   what the Results give first (the median and the number mean beside it are not
   charted) — or the free shape's dimensions that were measured (those with an esd: a
   mean of dimensions not told apart, not each). Each with its kind (SIZE_KINDS). Up to
   v483 WPPM's sizes were left out: a WPPM phase had no point. */
function sizesOf(r){
  const by = new Map();
  (r.table || []).forEach(q=>{
    if (!q.phase || !Number.isFinite(q.value) || !Number.isFinite(q.esd)) return;
    const shape = /^shape_.*_nm$/.test(q.name) && !/_min_nm$/.test(q.name);
    const kind = shape ? 'shape' : SIZE_ROWS[q.name];
    if (!kind) return;
    if (!by.has(q.phase)) by.set(q.phase, []);
    by.get(q.phase).push({ v: q.value, e: q.esd, shape, kind });
  });
  return by;
}
// The kinds of size charted by sample, of one phase or of all, in SIZE_KINDS' order.
const sizeKinds = (fs, results, name) => { const on = new Set(fs.flatMap(f=> [...sizesOf(results[f.name])].filter(([n])=> name == null || n === name).flatMap(([, v])=> v.map(q=> q.kind))));
  return Object.keys(SIZE_KINDS).filter(k=> on.has(k)); };
/* The sizes charted (drawSizes): its columns, its points with their esds and the values
   written above them (marks), and the legend's series; by sample, each phase in its colour
   (colorOf, by its name). */
function sizeMarks(fs, results, sizeBy, colorOf){
  const cols = [], marks = [];     // marks: { x, v, e, color, dx, label }
  let series = [];
  if (sizeBy === 'peak'){
    // The reflections the tests use, in any pattern: a column each, by phase and 2θ.
    const refl = new Map();
    fs.forEach(f=>{ const wd = results[f.name].widths; if (!wd) return;
      wd.phases.forEach(ph=> ph.rows.forEach(w=>{
        if (w.overlapped || w.edge || w.weak || w.flat || w.unread || !Number.isFinite(w.D)) return;
        // (by its indices as numbers: a result of v479 or older wrote a negative index's
        // label with a bar, a later one with a minus)
        const key = ph.name + '|' + (w.plain || w.label);
        if (!refl.has(key)) refl.set(key, { ph: ph.name, label: w.label, tt: w.tt, by: new Map() });
        refl.get(key).by.set(f.name, w);
      })); });
    const list = [...refl.values()].sort((a, b)=> a.ph === b.ph ? a.tt - b.tt : a.ph < b.ph ? -1 : 1);
    const many = new Set(list.map(c=> c.ph)).size > 1;
    series = fs.map(f=> ({ name: f.label, color: f.color }));
    const step = fs.length > 1 ? Math.min(10, 40/(fs.length - 1)) : 0;
    list.forEach((c, i)=>{
      cols.push({ label: many ? `${c.ph} ${hklShow(c.label)}` : hklShow(c.label), name: `${c.ph} (${hklShow(c.label)})`, hkl: hklShow(c.label) });
      fs.forEach((f, si)=>{ const w = c.by.get(f.name); if (w) marks.push({ x: i + 1, v: w.D, e: w.Desd, color: f.color, dx: (si - (fs.length - 1)/2)*step }); });
    });
  } else {
    const names = [...new Set(fs.flatMap(f=> [...sizesOf(results[f.name]).keys()]))];
    // Each phase with the sizes it has; one with sizes of several kinds (a pattern refined
    // with WPPM, another without) has its kind written by each value too.
    const kinds = new Map(names.map(n=> [n, sizeKinds(fs, results, n)]));
    series = names.map(n=> ({ name: `${n}: ${kinds.get(n).map(k=> SIZE_KINDS[k][0]).join(' / ')}`, color: colorOf(n) }));
    const step = names.length > 1 ? 18 : 0;
    fs.forEach((f, i)=>{
      cols.push({ label: f.label, name: f.name });
      const by = sizesOf(results[f.name]);
      names.forEach((n, si)=>{
        const vs = by.get(n) || [], dx = (si - (names.length - 1)/2)*step;
        vs.forEach(q=> marks.push({ x: i + 1, v: q.v, e: q.e, color: colorOf(n), dx }));
        if (vs.length) marks.push({ x: i + 1, top: Math.max(...vs.map(q=> q.v + (q.e || 0))), dx, label: vs.map(q=> `${q.v.toFixed(1)}±${q.e.toFixed(1)}`).join(' / ') + (kinds.get(n).length > 1 ? ' ' + SIZE_KINDS[vs[0].kind][2] : '') });
      });
    });
  }
  return { cols, marks, series };
}

// The Refinement settings a result was refined with that are not the defaults (r.fit,
// the worker's; none in a result of v428 or older), those that acted on it: the cell
// search's range on a sample, the zero scan's on the standard, the shape's with a shape.
function fitUsed(r, std){
  if (!r || !r.fit) return [];
  const fs = fitSettings(r.fit), isS = roleOf(r) ?? std, shaped = Object.values(r.models || {}).some(m=> m && m.shape);
  return FITS.filter(m=> fs[m.k] !== FIT_DEF[m.k] && (m.role !== 'std' || isS) && (m.role !== 'sample' || !isS) && (!m.shape || shaped))
    .map(m=> ({ k: m.k, v: fs[m.k], said: m.said(fs[m.k]) }));
}
// The CSVs (the card's csvEntries): every refined pattern's curves (curves: the card's
// curvesOf), one row per pattern and phase (stale: the card's staleOf), and the peak
// widths. data, line: utils.js fmtData and csvLine; decimal: the export's decimal mark.
function csvTables(pre, files, results, { curves, stale, std }, { data: fmtData, line: csvLine, decimal }){
  const out = [], fs = files.filter(f=> results[f.name] && results[f.name].params);
  if (!fs.length) return out;
  const cols = [];
  fs.forEach(f=>{
    let c; try { c = curves(f, results[f.name]).c; } catch(e){ return; }
    cols.push({ h: '2Theta_' + f.label, v: Array.from(f.x, v=> fmtData(v, 5)) },
      { h: 'Observed_' + f.label, v: Array.from(f.y, v=> fmtData(v, 3)) },
      { h: 'Calculated_' + f.label, v: Array.from(c.yc, v=> fmtData(v, 3)) },
      { h: 'Background_' + f.label, v: Array.from(c.bg, v=> fmtData(v, 3)) },
      { h: 'Difference_' + f.label, v: Array.from(f.y, (v, i)=> fmtData(v - c.yc[i], 3)) });
  });
  const n = Math.max(0, ...cols.map(c=> c.v.length));
  let t = csvLine(cols.map(c=> c.h));
  for (let i = 0; i < n; i++) t += csvLine(cols.map(c=> i < c.v.length ? c.v[i] : ''));
  out.push({ name: pre + 'rietveld_pattern.csv', text: t });
  let s = csvLine(['Pattern', 'Phase', 'Quantity', 'Value', 'Esd', 'Rwp', 'Rexp', 'chi2']);
  fs.forEach(f=>{
    const r = results[f.name], st = r.stats || {};
    // Number.isFinite: a NaN that went through JSON (undo, a saved project) comes back as
    // null, which the global isFinite takes for 0 and fmtData cannot format. fmtData: a
    // value too small for its fixed decimals keeps three significant digits or more (an
    // esd of 3·10⁻⁷ at eight decimals read 0.00000030, a Δd* esd of 10⁻⁶ at six 0.000001).
    const num = (v, d)=> Number.isFinite(v) ? fmtData(v, d) : '';
    (r.table || []).forEach(q=> s += csvLine([f.label, q.phase || '', q.name, num(q.value, 8), num(q.esd, 8), num(st.Rwp*100, 3), num(st.Rexp*100, 3), num(st.chi2, 3)]));
    // A sample refined with an earlier refinement of the standard (the card's warning).
    if (stale(f, r)) s += csvLine([f.label, '', 'standard_changed_since', '1', '', num(st.Rwp*100, 3), num(st.Rexp*100, 3), num(st.chi2, 3)]);
    // The Refinement settings it was refined with, those not the defaults (as the card
    // says them): the engine's values and units (cellRange a fraction, bgInv 1 or 0), in
    // full, with the export's decimal mark.
    fitUsed(r, std).forEach(u=> s += csvLine([f.label, '', 'fit_' + u.k, typeof u.v === 'boolean' ? (u.v ? '1' : '0') : fitTxt(u.v).replace('.', decimal), '', num(st.Rwp*100, 3), num(st.Rexp*100, 3), num(st.chi2, 3)]));
  });
  out.push({ name: pre + 'rietveld_results.csv', text: s });
  // The peak widths of every refined sample.
  const num = (v, d)=> Number.isFinite(v) ? fmtData(v, d) : '';
  let pk = csvLine(['Pattern', 'Phase', 'hkl', '2Theta_deg', 'Relative_intensity', 'FWHM_deg', 'FWHM_esd_deg', 'eta', 'FWHM_corr_deg', 'FWHM_corr_esd_deg', 'Size_corr_nm', 'Size_corr_esd_nm', 'Delta_dstar_invA', 'Delta_dstar_esd_invA', 'Model_isotropic_FWHM_corr_deg', 'Model_free_shape_FWHM_corr_deg', 'Used_by_tests', 'Note']);
  let anyPk = false;
  fs.forEach(f=>{
    const wd = results[f.name].widths, refused = !!results[f.name].irfRefused;
    if (!wd) return;
    wd.phases.forEach(ph=> ph.rows.forEach(w=>{
      anyPk = true;
      const skip = [w.unread && 'not read: ' + w.unread, w.overlapped && 'overlapped', w.edge && 'edge', w.weak && 'weak', w.flat && 'no broadening above the instrument (the corrected FWHM an upper limit, 2 esd)'].filter(Boolean).join(' ');
      // Without a standard (or with one of another wavelength) the corr columns hold the
      // whole widths, the instrument's in.
      const note = [skip, !wd.corrected && (refused ? 'not corrected: the standard is of another wavelength' : 'not corrected: no instrumental standard'),
        !skip && w.HsEsdFit > 0 && `esds widened from the fit's ${num(w.HsEsdFit, 5)} deg by what a misfitting phase's reflections could do to it`].filter(Boolean).join('; ');
      const lim = w.flat && Number.isFinite(w.HsMax);
      pk += csvLine([f.label, ph.name, hklPlain(w.plain), num(w.tt, 5), num(w.rel, 4), num(w.H, 5), num(w.Hesd, 5), num(w.eta, 3), lim ? num(w.HsMax, 5) : num(w.Hs, 5), lim ? '' : num(w.HsEsd, 5), num(w.D, 4), num(w.Desd, 4), w.flat ? '' : num(w.dd, 6), w.flat ? '' : num(w.ddEsd, 6), num(w.model.iso, 5), ph.shaped ? num(w.model.shape, 5) : '', skip ? 'no' : 'yes', note]);
    }));
  });
  if (anyPk) out.push({ name: pre + 'rietveld_peaks.csv', text: pk });
  return out;
}

// The rows the settings window shows a card.
function rowsFor(std){
  // The settings that apply to this card: the samples' (a cell search), the standard's (a
  // zero scan; no free shape's, which it has none of: to v493 shown there).
  const fits = FITS.filter(m=> (!m.role || m.role === (std ? 'std' : 'sample')) && !(std && m.shape));
  // The modes and the start's groups shown: the standard's, those that apply to it (its
  // displacement parameters and its texture; STD_NA's and STD_HOLD_NA's are not there).
  const modes = std ? MODES.filter(m=> !STD_NA.includes(m.k)) : MODES;
  const holds = std ? HOLDS.filter(([k])=> !STD_HOLD_NA.includes(k)) : HOLDS;
  return { fits, modes, holds };
}
// A Refinement setting not at its default (what Defaults sets back): on the standard one it
// shows (to v493 any key kept, a free shape's hidden there too); a sample's reads as before.
const fitShown = (fit, std, fits) => std ? fits.some(m=> m.k in fit) : !!Object.keys(fit).length;
// Why a mode does not apply to a phase (its checkbox and depth disabled), or ''. (The
// standard's rows that never apply are not shown: to v493 they were, disabled, said so.)
const naOf = (q, k) => k === 'wppm' && !q.on.size ? 'WPPM is a profile of the crystallite size: switch the size on first'
  : k === 'occ' && siteList(q).length < 2 ? "A phase of one site: its occupancy is the scale, which the pattern cannot tell from it" : '';
// What the automatic 1/2θ term gives for the pattern on show (the engine's rule, bgInvOn).
function autoInvOf(f){
  if (!f) return { on: false, why: '' };
  const x0 = scanRange(f)[0], on = bgInvOn(x0, 'auto');
  return { on, why: ` Here automatic gives ${on ? 'on' : 'off'}: ${f.label} starts at ${fitTxt(+x0.toFixed(2))}°.` };
}
// The note on a Refinement entry not taken (commitFit): what is allowed, the entry, the
// value kept.
function fitRefusal(m, value, shown){
  const raw = String(value).trim();
  return `${m.label}: ${m.rule}${m.int && /[.,]/.test(raw) ? ', without a point or comma' : ''}${raw ? ` — “${raw.length > 12 ? raw.slice(0, 12) + '…' : raw}” not taken` : ''}; kept ${shown}.`;
}

/* The card's state as saved (snapshot). Each phase's settings (on, dep) and the patterns it
   is not refined on, and beside them the options as v428 named them (engineOf), which an
   older version opening the project reads. c: the card's phases, std, lab6, pick, start,
   hold, fit, nextId, sel and results, and view: a sample card's { sizeBy, resNorm }. */
function stateOf(c){
  const { phases, std, lab6, pick, hold, fit, nextId, sel, results } = c;
  return { phases: phases.map(q=>{ const e = engineOf(q, std);
    return { id: q.id, cif: q.cif, file: q.file, color: q.color, on: { ...q.on }, dep: { ...q.dep }, off: { ...q.off },
      shape: e.shape, po: e.po || '', profile: e.profile, strain: e.strain, faults: e.faults || '', adp: e.adp, occ: e.occ || null }; }),
  ...(std ? { std: { on: { ...lab6.on }, dep: { ...lab6.dep } }, pick } : {}), start: c.start, hold: hold.slice(), fit: { ...fit },
  // (the results as they are: each frozen, shared by the states it is in; up to v486
  // every commit copied them all through JSON)
  nextId, sel, results: { ...results }, ...(c.view || {}) };
}
/* A state read back (restore, unless a step during a run keeps the card's): the phases,
   each with its settings made valid (or migrated from a project of v428 or older) and
   its CIF read (one that is not read is left out), the standard's own settings and the
   phase chosen, the start, the Refinement settings and the next id. A state whose phases
   are no list throws, before anything is read. */
function readState(s, std){
  // A project of v428 or older has the options without the flags (migrateSettings).
  const phases = (s.phases || []).flatMap(q=>{ try { return [{ id: q.id, cif: q.cif, file: q.file, color: q.color,
    ...(q.on ? cleanSettings(q, std ? stdSettings() : defSettings()) : migrateSettings(q, s.refineB)), prep: prepOf(q.cif, q.file),
    off: q.off && typeof q.off === 'object' ? Object.fromEntries(Object.keys(q.off).filter(k=> q.off[k]).map(k=> [k, true])) : {} }]; } catch(e){ return []; } });
  const out = { phases };
  if (std){
    // (the rows that do not apply to the standard stay off, whatever a file says)
    out.std = s.std ? cleanSettings(s.std, stdSettings()) : stdSettings();
    [out.std, ...phases].forEach(q=> STD_NA.forEach(k=> { q.on[k] = false; }));
    out.pick = phases.some(q=> q.id === s.pick) ? s.pick : 0;
  }
  out.start = s.start === 'last' ? 'last' : 'cif';
  out.hold = Array.isArray(s.hold) ? HOLD_KEYS.filter(k=> s.hold.includes(k)) : HOLD_DEFAULT.slice();
  // (a project of v428 or older has none: the defaults)
  out.fit = cleanFit(s.fit);
  out.nextId = s.nextId || phases.reduce((m, q)=> Math.max(m, q.id + 1), 1);
  return out;
}
// A state's results, frozen as they come (the standard's the state's own, shared with the
// history; a sample card's a JSON copy xrd.js xrdRestore makes; up to v486 copied again
// in the restore).
function resultsOf(s){
  const results = {};
  if (s.results && typeof s.results === 'object') Object.keys(s.results).forEach(k=>{ results[k] = frozen(s.results[k]); });
  return results;
}

export { PHASE_COLORS, prepPhase, textKey, prepOf, cellKey, frozen, MODES, MODE, siteList, listOf, depOf, defSettings, stdSettings, cleanSettings, migrateSettings, engineOf,
  HOLDS, HOLD_KEYS, HOLD_DEFAULT, START_RULE, FIT_DEF, FITS, FIT, fitTxt, readFit, cleanFit, formulaOf,
  SIZE_KINDS, hklShow, hklPlain, hklRuns, plotRuns,
  instrOf, LAB6_ID, irfOf, sameIrf, lastUnusable, payloadFor, resultRecord,
  resultPhases, curvesFrom, exactJson, scanRange, tickRows, groupTicks,
  sizesOf, sizeKinds, sizeMarks, fitUsed, csvTables, rowsFor, fitShown, naOf, autoInvOf, fitRefusal, stateOf, readState, resultsOf };
