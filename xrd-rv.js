/* =========================================================
   XRPD — the Rietveld card (page side).
   The phases come from CIFs (the standard's LaB6 is built in); the refinement runs in
   a module worker (xrd-rietveld.worker.js) on xrd-rietveld.js, and its result is kept
   per pattern, by file name, so moving, leaving out or reloading files never puts it
   on another pattern. The curves are not kept: they are recomputed from the refined
   parameters, which takes milliseconds.
========================================================= */
import { fmtData, csvLine, X_SVG, flashFieldInvalid, settings } from './utils.js';
import { Plot } from './plot.js';
import { parseCif, expandAtoms, structureCell, checkComposition, cellMass, metric, reflections } from './xrd-cryst.js';
import { readXrdmlInstrumentText } from './xrd-instr.js';
import { buildModel, calc, fitSettings, phaseSites } from './xrd-rietveld.js';
import { shapeView } from './xrd-shape3d.js';

// Names, formulae and notes come from CIF files, which may be anyone's: they go into the
// page as text, never as markup.
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The instrumental standard: NIST SRM 660c LaB6, Pm-3m, a = 4.156826 Å at 22.5 °C
// (certificate). B on 6f (x, ½, ½), x = 0.1992 (Eliseev et al., Acta Cryst. C42 (1986)
// 1263). The displacement parameters are typical values, the start of one ΔB refined with
// the profile (the standard's settings' default, stdSettings): held, a B 0.1 Å² off had moved X by 10 esd and the FWHM at 80°
// by 0.7 % (0.2 Å²: 21 esd, 1.4 %), the profile taking up the intensities' fall with
// angle; refined, the profile comes out within 1 esd whatever the B, its esds 10 % wider.
const LAB6_CIF = `data_LaB6_SRM660c
_cell_length_a 4.156826
_cell_length_b 4.156826
_cell_length_c 4.156826
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_chemical_formula_sum 'La1 B6'
_cell_formula_units_Z 1
loop_
_symmetry_equiv_pos_as_xyz
'x, y, z'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_B_iso_or_equiv
La1 La 0 0 0 0.25
B1 B 0.1992 0.5 0.5 0.35
B2 B -0.1992 0.5 0.5 0.35
B3 B 0.5 0.1992 0.5 0.35
B4 B 0.5 -0.1992 0.5 0.35
B5 B 0.5 0.5 0.1992 0.35
B6 B 0.5 0.5 -0.1992 0.35
`;
const PHASE_COLORS = ['#d4a72c', '#c77dff', '#ff8a65', '#7cc4ff', '#e05f8a', '#9ccc65'];
const SYSTEM_NAMES = { cubic:'cubic', hexagonal:'hexagonal', trigonal:'trigonal', tetragonal:'tetragonal', orthorhombic:'orthorhombic', monoclinic:'monoclinic', triclinic:'triclinic' };

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
  if (!own) notes.push(`symmetry found from the atoms: ${sym.order} operations`);
  else if (sym.order !== cif.ops.length || sc.basis) notes.push(`${cif.ops.length} operations in the file; the structure has ${sym.order}${sc.basis ? ' in its own cell' : ''}`);
  // A cell refined by one common scale (no conventional setting found): its axial ratios
  // and angles stay the file's, which the user should know.
  if (sym.constraint && sym.constraint.kind === 'isotropic' && sym.constraint.note) notes.push(sym.constraint.note);
  if (sym.bSpread > 0.01) notes.push(`the B of atoms the symmetry makes equivalent differed (by up to ${+sym.bSpread.toFixed(2)} Å² from their mean): each takes its site's mean`);
  if (sym.group === false) warnings.push('The symmetry found from the atoms does not close into a group at any tolerance tried (atoms of one kind within 0.01 Å of each other?): the operations used may be incomplete.');
  if (comp && !comp.ok && comp.message) warnings.push(comp.message);
  else if (comp && comp.note) notes.push(comp.note);
  // The sites, named as the engine names them (phaseSites): what Site occupancy offers.
  const sites = phaseSites(sc.cell, sc.atoms, sym.ops).sites.map(st=> ({ label: st.label, element: st.element, n: st.members.length }));
  return {
    name: cif.name || (fileName || '').replace(/\.cif$/i, ''), file: fileName || '', formula: cif.formulaSum || '', sites,
    cell: sc.cell, ops: sym.ops, atoms: sc.atoms, system: sym.system, constraint: sym.constraint, order: sym.order,
    mass: cellMass(sc.atoms), notes, warnings, ownCell: !!sc.basis,
  };
}
// The cell a phase is refined in, as a key: a result refined in another (the file's, before
// v426 re-expressed supercells and orthohexagonal cells) does not belong to the phase now.
const cellKey = c => [c.a, c.b, c.c, c.alpha, c.beta, c.gamma].map(v=> +(+v).toFixed(6)).join();

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
// fault model of its own would be refused anyway), and its structure is certified.
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
// The settings in a line, for the phase's row.
function summaryOf(p, std){
  const on = p.on, d = p.dep, txt = (k, v) => (MODE[k].list.find(([x])=> x === v) || [v, v])[1];
  const po = on.po ? 'preferred orientation ' + txt('po', d.po) : null;
  const adp = on.adp ? txt('adp', d.adp) : 'B from the CIF';
  if (std) return ["the instrument's profile", adp, po].filter(Boolean).join(' · ');
  return [on.size ? (d.size === 'iso' ? 'isotropic size' : txt('size', d.size)) : 'no size broadening',
    on.size && (on.wppm ? 'WPPM, ' + txt('wppm', d.wppm) : 'Lorentzian'),
    on.strain ? 'microstrain ' + txt('strain', d.strain) : 'no microstrain',
    on.faults && 'planar faults ' + txt('faults', d.faults).replace(/,.*/, ''), adp,
    on.occ && siteList(p).length > 1 && 'occupancy of ' + depOf(p, 'occ'), po].filter(Boolean).join(' · ');
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

export function createRietveld(host){
  const $ = id => document.getElementById(id);
  let phases = [];           // [{ id, cif (text), file, color, prep, on, dep (the settings: MODES) }]
  let nextId = 1;
  let idx = 0;               // the pattern on show, among the included files
  let results = {};          // file name → { params, esd, stats, stages, free, held, detected, shapes, isoParams, at, … }
  let startFrom = 'cif', hold = HOLD_DEFAULT.slice();   // where Refine starts (HOLDS)
  let fit = {};              // the Refinement settings changed from their defaults (FITS)
  let busy = false, cancelled = false;
  let plot = null;
  // Its own colour, apart from the CIF phases' (which start from the first of theirs).
  const lab6 = { id: 0, cif: LAB6_CIF, file: '', color: '#4cc9a0', ...stdSettings(), prep: prepPhase(LAB6_CIF, 'LaB6 (NIST SRM 660c)') };
  lab6.prep.name = 'LaB₆ (NIST SRM 660c)';
  lab6.prep.notes = [];      // written in P1 here only to be short: nothing to report

  // ---- the instrument, read from the file's own header (kept on the file object) ----
  function instrOf(f){
    // (one read before v426, saved with a session, lacks the monochromators' crystals: read again)
    if (f.instr && Array.isArray(f.instr.monochromators)) return f.instr;
    let ins = null;
    try {
      // (the bytes come back from a saved state, or a tab switch, as a plain array)
      const b = f.rawBytes, u8 = b == null ? null : b instanceof Uint8Array ? b : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : Array.isArray(b) ? Uint8Array.from(b) : null;
      // the bytes as they are: the reader finds their encoding (UTF-16 too)
      ins = u8 && u8.length ? readXrdmlInstrumentText(u8) : null;
    } catch(e){ ins = null; }
    f.instr = ins || f.instr || null;
    return f.instr;
  }
  const isStd = f => !!f && f.name === host.standardName();
  const phasesFor = f => isStd(f) ? [lab6] : phases;

  // ---- the worker ----
  let worker = null, jobId = 0, cancelJob = null;
  function getWorker(){
    if (worker) return worker;
    worker = new Worker(new URL('./xrd-rietveld.worker.js', import.meta.url), { type: 'module' });
    return worker;
  }
  function runInWorker(payload, onProgress){
    const w = getWorker(), id = ++jobId;
    return new Promise((resolve, reject)=>{
      const done = ()=>{ w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); cancelJob = null; };
      const onMsg = e =>{
        const d = e.data; if (!d || d.id !== id) return;
        if (d.type === 'progress'){ if (onProgress) onProgress(d.frac, d.stage); return; }
        done();
        if (d.type === 'result') resolve(d.res); else reject(new Error(d.message || 'Refinement failed'));
      };
      const onErr = e =>{ done(); worker = null; reject(new Error(e.message || 'The refinement worker failed')); };
      cancelJob = ()=>{ done(); try { w.terminate(); } catch(e){} worker = null; resolve(null); };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ id, ...payload });
    });
  }

  // What a pattern's refinement starts from: the standard gives the samples its
  // instrumental profile and zero once it is refined.
  // The role a result was refined in: as the standard (the built-in LaB6 alone) or as a
  // sample; null for a result too old to say.
  const roleOf = r => r.standard != null ? !!r.standard : Array.isArray(r.phases) ? r.phases.length === 1 && r.phases[0] === lab6.id : null;
  function irf(){
    const std = host.files().find(isStd), r = std && results[std.name] && roleOf(results[std.name]) !== false ? results[std.name] : null;
    if (!r || !r.params) return null;
    // asym: absent from a standard refined before the asymmetry was modelled (none then).
    // axL and transp (v432): the Soller model's length, where the standard's file gives its
    // Sollers (with their acceptances), and the sin 2θ shift; absent before.
    // λ1 and the radius: the profile is in degrees on that tube and goniometer (autoRefine
    // does not apply it to a pattern of another λ1).
    const ins = instrOf(std) || {}, sol = ins.soller || {}, P = r.params;
    return { U: P.U, V: P.V, W: P.W, X: P.X, Y: P.Y, asym: P.asym || 0, zero: P.zero,
      ...(Number.isFinite(P.transp) ? { transp: P.transp } : {}),
      ...(Number.isFinite(P.axL) ? { axL: P.axL, axP1: sol.incident, axP2: sol.diffracted } : {}),
      ...(Number.isFinite(ins.lam1) ? { lam1: ins.lam1 } : {}), ...(Number.isFinite(ins.radius) ? { radius: ins.radius } : {}) };
  }
  // A result's profile against the standard's now: the same refinement of it, or not (the
  // standard refined again since, or cleared). Old results' irf has no λ1: U … zero decide.
  const IRF_KEYS = ['U', 'V', 'W', 'X', 'Y', 'asym', 'zero', 'axL', 'transp'];
  const sameIrf = (a, b) => !!a && !!b && IRF_KEYS.every(k=> (a[k] || 0) === (b[k] || 0));
  const staleOf = (f, r) => !isStd(f) && !!r.irf && !sameIrf(r.irf, irf());
  // The phases as the engine takes them: their structure, and the options their settings
  // give (engineOf; the standard's LaB6 its own).
  const phaseData = (list, std) => list.map(p=> ({ id: p.id, name: p.prep.name, cell: p.prep.cell, constraint: p.prep.constraint, ops: p.prep.ops, atoms: p.prep.atoms, mass: p.prep.mass, color: p.color,
    ...engineOf(p, std) }));
  // The solid a result was refined with, from its parameters' names (each solid has its
  // own), and only when they are in use (any width ≠ 0).
  function shapeOfParams(P, id){
    const g = n => P['p' + id + '.' + n], has = n => ('p' + id + '.' + n) in P;
    // v420's ellipsoid (S = L·Lᵀ) is 'ellipsoidL'; the bodies by their widths' names.
    if (['L11', 'L22', 'L33'].some(n=> g(n))) return 'ellipsoidL';
    const type = has('Ea') ? 'ellipsoid' : has('Ws') ? 'sqbox' : has('Wd') ? 'cylinder' : has('Wh') ? 'ellcyl' : has('Wb') ? 'box' : has('Wc') ? 'spheroid' : null;
    return type && ['Ea', 'Eb', 'Ec', 'Wa', 'Wb', 'Wc', 'Wd', 'Wh', 'Ws'].some(n=> g(n)) ? type : false;
  }
  /* Why a pattern's last result cannot be started from — it must be of this pattern in
     this role, with these phases in these cells (autoRefine checks the parameters too) —
     or '' when it can. */
  function lastUnusable(f, r, list){
    if (!r || !r.params) return 'not refined yet';
    const ids = r.phases || [];
    if (ids.length !== list.length || list.some(p=> !ids.includes(p.id))) return 'refined with other phases';
    if (roleOf(r) !== isStd(f)) return 'refined in the other role';
    // (a result of v425 or older kept no cells: the file's cell then, so only a phase that
    // v426 re-expresses in a cell of its own has changed — as curvesOf reads it)
    if (r.cells ? list.some(p=> r.cells[p.id] !== cellKey(p.prep.cell)) : list.some(p=> p.prep.ownCell)) return 'a phase refined in another cell since';
    return '';
  }
  // A pattern's background terms under fit settings: the Chebyshev degree and whether the
  // 1/2θ term is used (buildModel's rule: 'auto' is on from below 20°, never from 0°).
  const bgTerms = (fs, f) => { const x0 = scanRange(f)[0]; return fs.bgDegree + (x0 > 0 && (fs.bgInv === 'auto' ? x0 < 20 : fs.bgInv) ? '+inv' : ''); };
  // run: the phases, the standard's settings and the start as they were when the run
  // started, the same for all its files (an undo during a run would otherwise change
  // them between files); run.fell collects the patterns refined from the CIF instead,
  // run.bgFreed those whose scales and background are refined rather than held.
  function payloadFor(f, run){
    const std = isStd(f), list = std ? [run.std] : run.ph, opts = { standard: std, irf: std ? null : irf(), fit: { ...run.fit } };
    if (run.start === 'last'){
      const r = results[f.name], why = lastUnusable(f, r, list);
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
      phases: phaseData(list, std), opts };
  }

  async function refine(list){
    if (busy) return;
    const todo = list.filter(f=> phasesFor(f).length);
    if (!todo.length){ setStatus('Add a phase from a CIF to refine.'); return; }
    busy = true; cancelled = false; closeSettings(); syncButtons();
    const copy = p => ({ ...p, on: { ...p.on }, dep: { ...p.dep } });
    const run = { ph: phases.map(copy), std: copy(lab6), start: startFrom, hold: hold.slice(), fit: { ...fit }, fell: [], bgFreed: [] };
    try {
      for (let k = 0; k < todo.length && !cancelled; k++){
        const f = todo[k], pay = payloadFor(f, run), from = pay.opts.start ? ' from its last result' : '';
        setStatus(`Refining ${f.label}${from}…`);
        // (the stages say the rest: a start from the last result has its own)
        const res = await runInWorker(pay, (frac, stage)=>{ showProg((k + frac)/todo.length); if (stage) setStatus(`Refining ${f.label}: ${stage}…`); });
        if (!res) break;
        // (the phases it was refined with: a CIF added meanwhile is not among them; the
        // standard's profile as the worker used it, kept to tell when the standard changes;
        // free, held, detected, shapes, isoParams: what the next start from it needs)
        const ph = isStd(f) ? [run.std] : run.ph;
        results[f.name] = { ...res, standard: isStd(f), phases: ph.map(p=> p.id), irf: isStd(f) ? null : res.irf || null, at: Date.now(),
          cells: Object.fromEntries(ph.map(p=> [p.id, cellKey(p.prep.cell)])) };
        if (f === host.files()[idx]) draw();
      }
      setStatus([run.fell.length && `From the CIF, no last result to start from: ${run.fell.join('; ')}.`,
        run.bgFreed.length && `Scales and background refined, not held: the background's terms changed since the last result (${run.bgFreed.join(', ')}).`].filter(Boolean).join(' '));
    } catch(e){
      setStatus('⚠ ' + e.message);
    } finally {
      busy = false; hideProg(); syncButtons(); draw(); host.commit();
    }
  }
  function refineAll(){
    // The standard first: the samples take their instrumental profile from it.
    const fs = host.files(), std = fs.filter(isStd);
    refine([...std, ...fs.filter(f=> !isStd(f))]);
  }

  // ---- the plot: observed, calculated, the background, the difference under them,
  // and a row of ticks per phase between the two ----
  function curvesOf(f, r){
    /* The phases as the result was refined: those it was refined with (a phase added
       since, or the file's role changed, would draw its default scale in the curve),
       with the free shape when its parameters are there and the models it used (a size
       or strain switched off among them), whatever the settings say now. */
    const ids = r.phases || null, list = phasesFor(f).filter(p=> !ids || ids.includes(p.id));
    if (ids && list.length !== ids.length) throw new Error('The phases changed since this refinement.');
    if (r.cells ? list.some(p=> r.cells[p.id] != null && r.cells[p.id] !== cellKey(p.prep.cell)) : list.some(p=> p.prep.ownCell))
      throw new Error('A phase is refined in another cell since this refinement.');
    const ph = phaseData(list, isStd(f)).map(p=>{
      const md = (r.models || {})[p.id] || {};
      return { ...p, shape: shapeOfParams(r.params, p.id), po: r.textures && r.textures[p.id] ? r.textures[p.id].hkl : null, size: md.size !== false,
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
  // The scan's 2θ range, low end first (the host turns a scan run downwards round, and
  // the engine takes either order).
  const scanRange = f => { const a = f.x[0], b = f.x[f.x.length-1]; return a <= b ? [a, b] : [b, a]; };
  function tickRowsOf(f){
    // Before a refinement the ticks sit where the file's cells put them, at Kα1 (over the
    // scan's range, whichever way it ran).
    const ins = instrOf(f) || {}, lam = ins.lam1 || 1.540598, [x0, x1] = scanRange(f);
    const dmin = lam/(2*Math.sin(Math.min(89.9, x1/2)*Math.PI/180));
    return phasesFor(f).map(p=> ({ color: p.color, name: p.prep.name,
      tt: reflections(p.prep.cell, p.prep.ops, dmin).map(r=> 2*Math.asin(lam/(2*r.d))*180/Math.PI).filter(t=> t >= x0 && t <= x1) }));
  }
  function draw(preserve){
    const fs = host.files();
    if (!fs.length) return;
    if (idx >= fs.length) idx = fs.length - 1;
    const f = fs[idx], r = results[f.name];
    $('xrdRvLabel').textContent = f.label + (isStd(f) ? ' (standard)' : '');
    $('xrdRvIdx').textContent = (idx+1) + '/' + fs.length;
    const svg = $('xrdRvSvg');
    const prev = preserve && plot ? { xmin: plot.xmin, xmax: plot.xmax } : null;
    plot = new Plot(svg, { xlabel: '2θ (°)', ylabel: 'Intensity (counts)' });
    plot.attachTools(svg.closest('.plot-wrap'));
    let c = null;
    if (r && r.params){ try { c = curvesOf(f, r); } catch(e){ c = null; } }
    const ys = f.y, lo = Math.min(...ys), hi = Math.max(...ys), A = (hi - lo) || 1;
    const groups = c ? groupTicks(c.ticks, phasesFor(f)) : tickRowsOf(f);
    const rowH = 0.045*A, rowGap = 0.02*A;
    const tickTop = lo - rowGap, tickBottom = tickTop - groups.length*(rowH + rowGap);
    let diff = null, off = 0;
    const [xa, xb] = scanRange(f);
    if (c){
      diff = ys.map((v, i)=> v - c.yc[i]);
      const dHi = Math.max(...diff), dLo = Math.min(...diff);
      off = tickBottom - rowGap - dHi;
      plot.setRange(xa, xb, off + dLo - 0.03*A, hi + 0.05*A);
    } else plot.setRange(xa, xb, tickBottom - rowGap, hi + 0.05*A);
    // A redraw keeps the 2θ zoom; the height follows what is drawn (a phase's tick row
    // more or less, the difference once there is a fit).
    if (prev){ plot.xmin = prev.xmin; plot.xmax = prev.xmax; }
    plot.drawAxes();
    plot.line(f.x, ys, 'var(--plot-errbar)', 1, undefined, { label: f.label, key: f.name });
    if (c){
      plot.line(f.x, c.bg, '#ff9933', 1, undefined, { label: 'background', key: 'background' });
      plot.line(f.x, c.yc, '#ff5050', 1.2, undefined, { label: 'calculated', key: 'calculated' });
      plot.line(f.x, diff.map(v=> v + off), '#3aa0ff', 1, undefined, { label: 'difference', key: 'difference' });
    }
    groups.forEach((g, k)=>{
      const y1 = tickTop - k*(rowH + rowGap), y0 = y1 - rowH, xs = [], yv = [];
      g.tt.forEach(t=>{ xs.push(t, t); yv.push(y0, y1); });
      plot.segments(xs, yv, g.color, 1.2, { label: g.name, key: 'ticks/' + g.name });
    });
    const leg = $('xrdRvLegend');
    leg.innerHTML = `<span><i style="background:var(--plot-errbar)"></i>observed</span>`
      + (c ? `<span><i style="background:#ff5050"></i>calculated</span><span><i style="background:#ff9933"></i>background</span><span><i style="background:#3aa0ff"></i>difference</span>` : '')
      + groups.map(g=> `<span><i style="background:${g.color}"></i>${esc(g.name)}</span>`).join('');
    $('xrdRvInstr').textContent = instrLine(instrOf(f));
    syncButtons();
    renderResults(f, r);
    renderSolids(f, r);
    renderWidths(f, r);
  }

  // ---- the crystallites' shape: each phase's refined solid in 3D (xrd-shape3d), the
  // crystal's directions on it with their uncertainty cones; drag to turn it ----
  let solidViews = [], solidsKey = '';
  // How each solid was last turned (xrd-shape3d getView), by sample and solid: coming
  // back to a sample shows it as it was left.
  const solidTurns = new Map();
  const DL_SVG = '<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="15"/><polyline points="7 10.5 12 15.5 17 10.5"/><line x1="5" y1="20" x2="19" y2="20"/></svg>';
  function solidCaption(s){
    const n = v => Number.isFinite(v) ? (v < 10 ? v.toFixed(1) : v.toFixed(0)) : '∞';
    const [x, y, z] = s.dims;
    return s.type === 'spheroid' ? `spheroid, ${s.kind}: ${n(x)} nm across, ${n(z)} nm along its axis`
      : s.type === 'cylinder' ? `cylinder, ${s.kind}: diameter ${n(x)} nm, height ${n(z)} nm`
      : s.type === 'ellcyl' ? `elliptic cylinder, ${s.kind}: ${n(x)} × ${n(y)} nm across, height ${n(z)} nm`
      : s.type === 'box' ? `box, ${s.kind}: ${n(x)} × ${n(y)} × ${n(z)} nm`
      : s.type === 'sqbox' ? `square-based box, ${s.kind}: base ${n(x)} × ${n(x)} nm, height ${n(z)} nm`
      : `ellipsoid, ${s.kind}: axes ${n(x)} × ${n(y)} × ${n(z)} nm`;
  }
  function renderSolids(f, r){
    const box = $('xrdRvSolids'), list = (r && r.solids) || [];
    // The same solids: the views stay as they were turned.
    const key = f.name + JSON.stringify(list);
    if (key === solidsKey) return;
    solidsKey = key;
    solidViews.forEach(({ view, turnKey })=>{ if (view.getView) solidTurns.set(turnKey, view.getView()); view.destroy(); });
    solidViews = [];
    if (solidTurns.size > 50) solidTurns.delete(solidTurns.keys().next().value);
    box.innerHTML = '';
    box.style.display = list.length ? '' : 'none';
    list.forEach(s=>{
      const color = (phasesFor(f).find(p=> p.id === s.id) || {}).color;
      const wrap = document.createElement('div');
      wrap.className = 'peak-box rv-solid';
      wrap.innerHTML = `<div class="peak-box-head"><span class="txt-mini">Crystallite shape${list.length > 1 ? ' · ' + esc(s.name) : ''}</span><button class="btn table-csv-btn" title="Download PNG">${DL_SVG}</button></div><div class="rv-solid-view"></div>`;
      box.appendChild(wrap);
      const view = shapeView(wrap.querySelector('.rv-solid-view'), { color });
      view.set({ type: s.type, dims: s.dims, frame: s.frame, dirs: s.dirs, cell: s.cell, caption: solidCaption(s) });
      const turnKey = f.name + '|' + s.id + '|' + JSON.stringify([s.type, s.dims, s.frame]);
      if (view.setView && solidTurns.has(turnKey)) view.setView(solidTurns.get(turnKey));
      wrap.querySelector('button').onclick = ()=>{
        const a = document.createElement('a');
        a.href = view.png(); a.download = `XRPD_shape_${f.label}_${s.name}.png`.replace(/[^\w.-]+/g, '_');
        document.body.appendChild(a); a.click(); a.remove();
      };
      solidViews.push({ view, turnKey });
    });
  }

  // ---- the peaks' own widths (xrd-widths, run by the worker): the table, the
  // Williamson–Hall plot and the tests ----
  let whPlot = null;
  // As the worker's fmtEsd: the esd rounded first, the value to its last digit.
  const fmtE = (v, e) => {
    if (!Number.isFinite(v)) return '—';
    const p = Math.floor(Math.log10(e)), n = e/Math.pow(10, p) < 2 ? 2 : 1;
    if (!(Number.isFinite(e) && e > 1e-15*Math.abs(v)) || n - 1 - p > 100) return (+v.toPrecision(4)).toString();
    let d = n - 1 - p, k = Math.round(e*Math.pow(10, d));
    if (k >= (n === 2 ? 20 : 10)){ k = Math.round(k/10); d--; }
    if (d >= 0) return v.toFixed(d) + '(' + k + ')';
    const s = Math.pow(10, -d);
    return String(Math.round(v/s)*s) + '(' + k*s + ')';
  };
  // A model's width: three decimals, or three significant digits under 0.1° (a sharp
  // peak's 0.0004° read 0.000).
  const f3 = v => !Number.isFinite(v) ? '—' : Math.abs(v) < 0.1 && v !== 0 ? String(+v.toPrecision(3)) : v.toFixed(3);
  // A probability: two significant digits, one below 10⁻³ (where the verdict turns, 2·10⁻⁴
  // read 0.000), and under the smallest a double holds as that bound.
  const fmtP = p => p < 1e-300 ? '< 1e-300' : p < 1e-3 ? p.toExponential(0) : String(+p.toPrecision(2));
  function renderWidths(f, r){
    const box = $('xrdRvWidths'), wd = r && r.widths;
    const phs = wd ? wd.phases.filter(ph=> ph.rows.length) : [];
    box.style.display = phs.length ? '' : 'none';
    if (!phs.length){ whPlot = null; return; }
    // The free shape's column when some phase kept one; a phase without has none to give.
    const shapeOn = phs.some(ph=> ph.shaped);
    const colorOf = id => (phasesFor(f).find(p=> p.id === id) || {}).color || '#888';
    // The table, as the Analysis card's: a row per peak (reflections at one 2θ are one).
    let html = '<div class="peak-scroll"><table><thead><tr><th>#</th><th>hkl</th><th>2θ (°)</th><th>Relative Intensity</th><th>FWHM (°)</th>'
      + `<th title="The sample's own FWHM: the peak fitted with the instrument's profile at that angle convolved in (Lorentzian widths adding, Gaussian ones in quadrature, as in the refinement), the sample's Gaussian part weighed in as far as the data ask for it. &lt; x: no broadening measured above the instrument's, x its upper limit (2 esd)">FWHM corr. (°)</th><th title="Scherrer: Kλ/(FWHM corr.·cosθ), K = 0.9 as the Analysis card. For a Lorentzian phase it reads as the refined size does; a WPPM phase's sizes are true dimensions, and this reading of the same crystallites comes out lower for spheres of one size (about 0.85×) and otherwise as the distribution has it (the tests below say by how much)">Crystallite size corr. (nm)</th>`
      + `<th title="The isotropic model's width for this peak, read off its own curve the same way">Model, isotropic (°)</th>${shapeOn ? '<th title="The free shape\'s width for this peak, read off its own curve the same way">Model, free shape (°)</th>' : ''}</tr></thead><tbody>`;
    let n = 0;
    phs.forEach(ph=> ph.rows.forEach(w=>{
      // Why it is overlapped (measureWidths): the others' share past 30 %, or what the
      // reflections of a phase whose isotropic model, which takes them off, does not predict
      // its widths read can do to this width at the misfit measured (biasOff, v429, in the
      // fit's own esds, HsEsdFit where the esd was widened; a result of v427–v428 has the 5 %
      // limit on their share instead).
      const bz = Number.isFinite(w.biasOff) ? w.biasOff/(w.HsEsdFit || w.Wesd) : NaN;   // (NaN is null in a saved session)
      const offTxt = 'reflections of a phase whose isotropic model, which takes them off, does not predict its widths read';
      const ovl = !Number.isFinite(w.share) ? ''
        : !(w.share <= 0.3) ? ` (the others hold ${Math.round(w.share*100)} % of its intensity across its top; 30 % allowed)`
        : 'biasOff' in w ? ` (${offTxt}: ${Number.isFinite(bz) ? `off as their widths were measured, they could move this width by ${bz.toFixed(1)} esd` : 'what they could do to this width was not computed'}; 2 esd allowed, the esd widened by as much past half of one)`
        : ` (${offTxt} hold ${Math.round(w.shareOff*100)} % of its intensity across its top; 5 % allowed)`;
      const skip = w.overlapped || w.edge || w.weak || w.flat || w.unread, why = [w.unread && 'not read: ' + w.unread, w.overlapped && 'overlapped by another reflection' + ovl, w.edge && 'at the end of the pattern', w.weak && 'too weak to measure (amplitude under 3 esd)', w.flat && 'no broadening above the instrument\'s (under 2 esd): the corrected FWHM is an upper limit (2 esd)'].filter(Boolean).join('; ');
      // Used with its esd widened (measureWidths: what those reflections could do to it).
      const wide = !skip && w.HsEsdFit > 0 ? `Its esds widened from the fit's ${+w.HsEsdFit.toPrecision(2)}° to ${+w.HsEsd.toPrecision(2)}°: ${offTxt}, off as their widths were measured, could move this width by ${bz.toFixed(1)} of the fit's esds` : '';
      // No broadening measured: the corrected FWHM as its upper limit.
      const corr = w.flat && Number.isFinite(w.HsMax) ? `&lt; ${+w.HsMax.toPrecision(2)}` : fmtE(w.Hs, w.HsEsd);
      html += `<tr class="peak-row rv-pk${skip ? ' rv-pk-out' : ''}" data-tt="${w.tt}" data-ph="${ph.id}" data-lab="${esc(w.label)}"${why ? ` title="Not used by the tests: ${esc(why)}"` : wide ? ` title="${esc(wide)}"` : ''}>`
        + `<td>${++n}</td><td><span class="rv-key-sm" style="background:${colorOf(ph.id)}"></span>${esc(w.label)}</td><td>${w.tt.toFixed(3)}</td><td>${Number.isFinite(w.rel) ? (w.rel*100).toFixed(1) + '%' : '—'}</td>`
        + `<td>${fmtE(w.H, w.Hesd)}</td><td>${corr}</td><td>${w.flat ? '—' : fmtE(w.D, w.Desd)}</td><td>${f3(w.model.iso)}</td>${shapeOn ? `<td>${ph.shaped ? f3(w.model.shape) : '—'}</td>` : ''}</tr>`;
    }));
    html += '</tbody></table></div>';
    if (!wd.corrected) html += `<div class="rv-note">${r.irfRefused ? 'The standard\'s profile did not apply to this pattern (see the warnings)' : 'No instrumental standard refined'}: the widths are not corrected for the instrument's.</div>`;
    const wrap = $('xrdRvPkWrap');
    wrap.innerHTML = html;
    drawWH(phs, colorOf);
    renderTests(phs);
    // Hover: the peak on the pattern and on the Williamson–Hall plot.
    wrap.querySelectorAll('.rv-pk').forEach(tr=>{
      tr.addEventListener('mouseenter', ()=> highlight(+tr.dataset.tt, tr.dataset.lab, +tr.dataset.ph, colorOf(+tr.dataset.ph)));
      tr.addEventListener('mouseleave', ()=> highlight(null));
    });
  }
  function highlight(tt, lab, phId, color){
    if (plot){ plot.clearOverlay(); if (tt != null) plot.vline(tt, color, false); }
    if (!whPlot) return;
    whPlot.gOverlay.innerHTML = '';
    if (tt == null) return;
    const p = (whPlot._pts || []).find(q=> q.label === lab && q.ph === phId);
    if (p){
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', whPlot.px(p.x)); c.setAttribute('cy', whPlot.py(p.y)); c.setAttribute('r', 7);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', color); c.setAttribute('stroke-width', 2);
      whPlot.gOverlay.appendChild(c);
    }
  }
  /* Williamson–Hall: H·cosθ (10⁻³ rad; H the corrected FWHM, not the integral breadth β)
     against 4·sinθ for the peaks the tests use, each with its esd and hkl; the weighted
     line through them (isotropic size + strain), from 4·sinθ = 0, where it gives Kλ/D;
     the models' own points (the isotropic model's and the free shape's) beside them. */
  function drawWH(phs, colorOf){
    const svg = $('xrdRvWhSvg');
    whPlot = new Plot(svg, { xlabel: '4·sinθ', ylabel: 'FWHM·cosθ (10⁻³ rad)' });
    whPlot.attachTools(svg.closest('.plot-wrap'));
    const D2R = Math.PI/180, pts = [], mods = [];
    phs.forEach(ph=> ph.rows.forEach(w=>{
      if (w.overlapped || w.edge || w.weak || w.flat || !(w.W > 0)) return;
      const x = 4*w.sin, k = 1e3*D2R*w.cos;
      pts.push({ x, y: w.W*k, e: (w.Wesd || 0)*k, label: w.label, ph: ph.id, color: colorOf(ph.id) });
      if (Number.isFinite(w.model.iso)) mods.push({ x, y: w.model.iso*k, kind: 'iso' });
      if (ph.shaped && Number.isFinite(w.model.shape)) mods.push({ x, y: w.model.shape*k, kind: 'shape' });
    }));
    if (!pts.length){ whPlot.setRange(0, 1, 0, 1); whPlot.drawAxes(); $('xrdRvWhLegend').innerHTML = ''; return; }
    // From 4·sinθ = 0, where a line meets the axis at Kλ/D; from 0 up, or from below the
    // lowest error bar or line where one goes under 0 (a negative intercept: no size).
    const xb = 1.12*Math.max(...pts.map(p=> p.x)) || 1;
    const ys = pts.flatMap(p=> [p.y - p.e, p.y + p.e]).concat(mods.map(m=> m.y),
      phs.flatMap(ph=> Number.isFinite(ph.wh.a) ? [1e3*ph.wh.a, 1e3*(ph.wh.a + ph.wh.b*xb)] : []));
    const y0 = Math.min(0, ...ys), y1 = Math.max(...ys), dy = (y1 - y0) || 1;
    whPlot.setRange(0, xb, y0 < 0 ? y0 - 0.08*dy : 0, y1 + 0.18*dy);
    whPlot.drawAxes();
    phs.forEach(ph=>{
      const wh = ph.wh;
      if (!Number.isFinite(wh.a)) return;
      const xa = whPlot.xmin, xb = whPlot.xmax;
      whPlot.line([xa, xb], [1e3*(wh.a + wh.b*xa), 1e3*(wh.a + wh.b*xb)], colorOf(ph.id), 1, '5,4', { label: `${ph.name}: weighted line (isotropic size + strain)`, key: 'wh/' + ph.id });
    });
    const iso = mods.filter(m=> m.kind === 'iso'), shp = mods.filter(m=> m.kind === 'shape');
    if (iso.length) whPlot.points(iso.map(m=> m.x), iso.map(m=> m.y), '#9aa3ad', 3);
    if (shp.length) whPlot.points(shp.map(m=> m.x), shp.map(m=> m.y), '#ff5050', 3);
    pts.forEach(p=>{ if (p.e > 0) whPlot.errbar(p.x, p.y, p.e); });
    phs.forEach(ph=>{ const q = pts.filter(p=> p.ph === ph.id); whPlot.points(q.map(p=> p.x), q.map(p=> p.y), colorOf(ph.id), 4.5); });
    pts.forEach(p=> whPlot.barLabel(p.x, p.y + p.e, p.label, { rot: 0, gap: 8, size: 10 }));
    whPlot._pts = pts;
    $('xrdRvWhLegend').innerHTML = phs.map(ph=> `<span><i style="background:${colorOf(ph.id)}"></i>${esc(ph.name)}, measured</span>`).join('')
      + (iso.length ? `<span><i style="background:#9aa3ad"></i>isotropic model</span>` : '')
      + (shp.length ? `<span><i style="background:#ff5050"></i>free-shape model</span>` : '');
  }
  // The tests, a box under the plot: each one's numbers and what they say.
  function renderTests(phs){
    let html = '<div class="rv-result">';
    phs.forEach(ph=>{
      const wh = ph.wh;
      if (phs.length > 1) html += `<div class="txt-mini rv-phase-name">${esc(ph.name)}</div>`;
      if (Number.isFinite(wh.chi2nu)){
        const aniso = wh.p < 1e-3;
        html += `<div class="pg-stat" title="χ² of the measured FWHM·cosθ (the corrected FWHM, not the integral breadth: D is read with K = 0.9 for the FWHM) about the weighted line, per degree of freedom (${wh.nu}), and the probability of so large a value were the broadening isotropic (size and strain alike in every direction)">Williamson–Hall: χ²<sub>ν</sub> <b>${wh.chi2nu.toFixed(1)}</b>, p <b>${fmtP(wh.p)}</b></div>`
          + `<div class="rv-note">${aniso ? 'The widths depend on hkl beyond their esds: the broadening is anisotropic (the crystallites\' shape, or faults).' : 'The widths lie on one line within their esds: consistent with an isotropic size and strain.'}</div>`
          + `<div class="pg-stat" title="The weighted line's intercept Kλ/D (K = 0.9) and slope ε; with an anisotropic broadening it is an average, not a size">line: D <b>${fmtE(wh.D, wh.Desd)} nm</b>, ε <b>${fmtE(wh.b, wh.bEsd)}</b>${aniso ? ' (an average only)' : ''}</div>`;
      } else {
        const nr = ph.rows.filter(w=> w.unread).length;
        html += `<div class="rv-note">Williamson–Hall: fewer than three peaks to read (${wh.n})${nr ? `; ${nr} not read at all (the table says why)` : ''}.</div>`;
      }
      // The stricter overlap rule (measureWidths): why fewer peaks are used. (ph.misfit: v429,
      // null in a saved result where it was NaN; a result of v427–v428 had the 5 % limit.)
      if (ph.overlapShare < 0.3) html += 'misfit' in ph
        ? `<div class="rv-note" title="Each of this phase's reflections is taken as off by its own misfit where its peak is read, else by the spread of the others' beyond their esds; what that does to a peak's width is read through the peak's own fit">The isotropic model does not predict the widths read${Number.isFinite(ph.misfit) ? ` (beyond their esds they differ from its own by ${Math.round(ph.misfit*100)} %, rms)` : ''}: as it takes this phase's reflections off the peaks they overlap, of any phase, a peak is used only where, off by as much, they could move its width by under 2 esd, its esd widened by as much past half of one (and the others hold up to 30 % of its top).</div>`
        : `<div class="rv-note">The isotropic model does not predict the widths read: as it takes this phase's reflections off the peaks they overlap, of any phase, a peak is used only where they hold under ${Math.round(ph.overlapShare*100)} % of its top (the others up to 30 %).</div>`;
      if (ph.orders.length){
        html += `<div class="pg-stat" style="margin-top:4px">Orders, Δd*(n)/Δd*(1): size 1, strain n</div>`;
        ph.orders.forEach(o=>{ html += `<div class="pg-stat">${esc(o.a)} → ${esc(o.b)}: <b>${fmtE(o.R, o.Resd)}</b> <span class="txt-meta">${o.verdict === 'order-dependent' ? 'below 1: the higher order sharper (planar faults)' : o.verdict}</span></div>`; });
      } else html += `<div class="rv-note">Orders: no pair (h k l), (n·h n·k n·l) both measured.</div>`;
      if (Number.isFinite(ph.scores.iso)) html += `<div class="pg-stat" title="Mean of ((measured − model)/esd)² over the peaks the tests use: about 1 when a model predicts the widths">Widths predicted, χ²<sub>ν</sub>: isotropic <b>${ph.scores.iso.toFixed(1)}</b>${Number.isFinite(ph.scores.shape) ? `, free shape <b>${ph.scores.shape.toFixed(1)}</b>` : ''}</div>`;
      // A WPPM phase: the sizes here are Scherrer readings, the refined one a diameter.
      if (ph.reading) html += `<div class="rv-note" title="The single-peak sizes and the line's are Scherrer readings (K = 0.9 on the corrected FWHM); WPPM's is the crystallites' own ${ph.reading.lognormal ? 'volume-weighted mean diameter' : 'diameter'}, with no Scherrer constant. The refined model's own peaks, read the same way, show how far the two kinds of size differ for these crystallites: the gap is the reading's, not the sample's">WPPM: the sizes above are Scherrer readings; read so, the model's own peaks give D <b>${fmtE(ph.reading.Dmodel)} nm</b> for its ${ph.reading.lognormal ? 'volume-weighted mean diameter' : 'diameter'} of <b>${fmtE(ph.reading.D)} nm</b>.</div>`;
    });
    html += '</div>';
    $('xrdRvTests').innerHTML = html;
  }
  // The engine's ticks (each reflection at Kα1 where the refined cell puts it), one
  // row per phase in the phases' order.
  function groupTicks(ticks, list){
    return list.map(p=> ({ name: p.prep.name, color: p.color, tt: ticks.filter(t=> t.phase === p.id).map(t=> t.tt) }));
  }

  // ---- the side column: the statistics, then what the worker made of the result —
  // the standard's instrument, or each phase's cell, size, strain (and weight fraction
  // with several phases), a value a line ----
  // The Refinement settings a result was refined with that are not the defaults (r.fit,
  // the worker's; none in a result of v428 or older), those that acted on it: the cell
  // search's range on a sample, the zero scan's on the standard, the shape's with a shape.
  function fitUsed(f, r){
    if (!r || !r.fit) return [];
    const fs = fitSettings(r.fit), std = roleOf(r) ?? isStd(f), shaped = Object.values(r.models || {}).some(m=> m && m.shape);
    return FITS.filter(m=> fs[m.k] !== FIT_DEF[m.k] && (m.role !== 'std' || std) && (m.role !== 'sample' || !std) && (!m.shape || shaped))
      .map(m=> ({ k: m.k, v: fs[m.k], said: m.said(fs[m.k]) }));
  }
  function renderResults(f, r){
    const box = $('xrdRvResults');
    if (!r || !r.params){
      const n = phasesFor(f).length;
      box.innerHTML = n ? `<div class="rv-result"><div class="rv-note">Not refined yet. <b>Refine</b> starts from the CIF's cell${isStd(f) ? ' (the certified one, held fixed)' : ''}, finds where the pattern's peaks are, and refines step by step.</div></div>`
        : `<div class="rv-result"><div class="rv-note">No phase: add one from a CIF (above).</div></div>`;
      return;
    }
    const s = r.stats || {};
    let html = `<div class="rv-result"><div class="pg-stat" title="R_wp: the weighted residual; R_exp: what the counting statistics alone would give">R<sub>wp</sub>: <b>${(s.Rwp*100).toFixed(2)}%</b>  R<sub>exp</sub>: <b>${(s.Rexp*100).toFixed(2)}%</b></div>`
      + `<div class="pg-stat" title="χ² = Σw(y − y_c)²/(N − P), the reduced χ²: (R_wp/R_exp)²">χ²: <b>${(s.chi2).toFixed(2)}</b></div>`;
    const used = fitUsed(f, r);
    if (used.length) html += `<div class="rv-note" title="The Refinement settings (Settings…) this result was refined with that are not the defaults">settings: ${esc(used.map(u=> u.said).join(', '))}</div>`;
    (r.phaseResults || []).forEach(q=>{
      html += `<div class="txt-mini${q.phase ? ' rv-phase-name' : ''}">${esc(q.name)}</div>` + q.lines.map(l=> `<div class="pg-stat"${l.title ? ` title="${esc(l.title)}"` : ''}>${esc(l.label)}: <b>${esc(l.value)}</b></div>`).join('');
    });
    // What the refinement could not do (a cell search without a minimum, a phase not
    // detected) is said beside the numbers it qualifies.
    html += (r.warnings || []).map(w=> `<div class="rv-note" style="color:var(--warn)">⚠ ${esc(w)}</div>`).join('');
    if (isStd(f)) html += `<div class="rv-note">The samples take this profile, its axial divergence, zero and sin 2θ shift as their instrument's.</div>`;
    else if (r.irf && staleOf(f, r)) html += `<div class="rv-note" style="color:var(--warn)">⚠ ${irf() ? 'The standard has been refined again since this result' : 'The standard\'s refinement this result used is gone (cleared, or another standard chosen)'}: its profile, zero and asymmetry are not the ones these numbers rest on. Refine this pattern again, or <b>Refine all</b>.</div>`;
    else if (!r.irf && !r.irfRefused) html += irf() ? `<div class="rv-note">No instrumental profile: this pattern was refined before the standard was. Refine it again to correct its widths, and the sizes from them, for the instrument's.</div>`
      : `<div class="rv-note">No instrumental profile (refine the standard first): the widths, and the sizes from them, include the instrument's.</div>`;
    html += '</div>';
    box.innerHTML = html;
  }
  function instrLine(ins){
    if (!ins) return '';
    const parts = [];
    if (isFinite(ins.lam1)) parts.push(`${ins.anode || ''} Kα₁ ${ins.lam1} Å` + (isFinite(ins.lam2) && ins.ratio > 0 ? `, Kα₂ ${ins.lam2} Å (×${ins.ratio})` : ''));
    if (isFinite(ins.radius)) parts.push(`R ${ins.radius} mm`);
    if (ins.divergence && ins.divergence.type) parts.push(`${ins.divergence.type} divergence slit${isFinite(ins.divergence.deg) ? ' ' + ins.divergence.deg + '°' : ''}`);
    if (ins.soller && isFinite(ins.soller.incident)) parts.push(`Soller ${ins.soller.incident} rad`);
    if (ins.filter) parts.push(`${ins.filter.material} filter`);
    // the crystal and its polarisation ratio, as the LP factor takes them
    if (ins.monochromator) parts.push((ins.monochromators || []).map(M=> `${M.side} ${M.crystal}${M.reflections > 1 ? '×' + M.reflections : ''} `).join('+ ') + 'monochromator' + (isFinite(ins.monoK) ? ` (K ${ins.monoK.toFixed(3)})` : ''));
    if (ins.detector && ins.detector.name) parts.push(ins.detector.name);
    return parts.join(' · ') + ((ins.warnings || []).length ? ' — ⚠ ' + ins.warnings.join('; ') : '');
  }

  // ---- phases: a row each, what was read from its CIF and its settings in a line ----
  function renderPhases(){
    const el = $('xrdRvPhaseList'), rows = [];
    const row = (p, builtIn)=>{
      const q = p.prep, K = q.constraint || {};
      // A primitive file of a centred lattice is refined as its conventional cell, so that
      // is the cell shown: the one the refined a, c… will be compared with.
      const c = K.conv && K.basis ? K.conv : q.cell, r4 = v => +(+v).toFixed(4);
      const cellTxt = (K.kind === 'cubic' ? `a = ${r4(c.a)} Å`
        : `a ${r4(c.a)}, b ${r4(c.b)}, c ${r4(c.c)} Å; α ${r4(c.alpha)}, β ${r4(c.beta)}, γ ${r4(c.gamma)}°`)
        + (K.conv && K.basis ? ` (conventional cell, ${K.volumeRatio}× the file's)` : '');
      return `<div class="rv-phase" data-ph="${p.id}"><span class="rv-key" style="background:${p.color}"></span>`
        + `<div class="rv-main"><b>${esc(q.name)}</b>${q.formula ? ` · ${esc(q.formula)}` : ''}`
        + `<div class="rv-sub">${SYSTEM_NAMES[q.system] || esc(q.system)}, ${q.order} symmetry operations · ${cellTxt} · ${q.atoms.length} atoms in the cell${builtIn ? ' · built in, for the standard (cell held at the certified value)' : p.file ? ' · ' + esc(p.file) : ''}</div>`
        + `<div class="rv-sub rv-set" title="What Refine refines for this phase: Settings… (beside Refine) changes it">${esc(summaryOf(p, builtIn))}</div>`
        + (q.notes.length ? `<div class="rv-sub">${esc(q.notes.join('; '))}</div>` : '')
        + q.warnings.map(w=> `<div class="rv-sub" style="color:var(--warn)">⚠ ${esc(w)}</div>`).join('')
        + `</div>${builtIn ? '' : `<button class="peak-del is-danger idle-dim rv-del" data-del="${p.id}" title="Remove phase">${X_SVG(13)}</button>`}</div>`;
    };
    phases.forEach(p=> rows.push(row(p, false)));
    if (host.files().some(isStd)) rows.push(row(lab6, true));
    el.innerHTML = rows.length ? rows.join('') : `<div class="rv-empty">No phase yet: <b>+ CIF</b> adds one from a crystallographic file (COD, ICSD, Materials Project…).</div>`;
  }
  async function addCifs(fileList){
    if (busy) return;
    const errs = [];
    for (const file of fileList){
      try {
        const text = await file.text();
        const prep = prepPhase(text, file.name);
        // The default settings: an isotropic size and strain, the rest off — the CIF's B
        // held, also for a CIF that gives none (v428: one ΔB on nanocrystalline samples
        // came out negative, taking up what the model lacks; RIETVELD.md §8.1).
        phases.push({ id: nextId++, cif: text, file: file.name, color: PHASE_COLORS[phases.length % PHASE_COLORS.length], prep, ...defSettings() });
      } catch(e){ errs.push(`${file.name}: ${e.message}`); }
    }
    renderPhases(); draw(true); host.commit();
    if (errs.length) setStatus('⚠ ' + errs.join(' · '));
  }

  // ---- small UI pieces ----
  function setStatus(t){ $('xrdRvStatus').textContent = t || ''; }
  function showProg(frac){ $('xrdRvProgWrap').style.display = ''; $('xrdRvProgBar').style.width = Math.max(0, Math.min(1, frac))*100 + '%'; }
  function hideProg(){ $('xrdRvProgWrap').style.display = 'none'; $('xrdRvProgBar').style.width = '0%'; }
  function syncButtons(){
    const f = host.files()[idx];
    $('xrdRvRefine').textContent = busy ? 'Cancel' : 'Refine';
    $('xrdRvRefineAll').disabled = busy;
    $('xrdRvSettings').disabled = busy;
    $('xrdRvClear').disabled = busy || !(f && results[f.name]);
    $('xrdRvClearAll').disabled = busy || !Object.keys(results).length;
    // (the phases are read when a run starts: one added meanwhile would not be in it)
    $('xrdRvAddCif').disabled = busy;
    syncSettings();
  }

  /* ---- the settings (a modal from Settings…, beside Refine): each phase's fitting modes
     and the standard's, a row each (MODES), and where Refine starts (HOLDS). A change
     applies at once, to the next refinements (the results there keep theirs), and is a
     step of the undo history. ---- */
  const setModal = $('xrdRvSetModal'), setBody = $('xrdRvSetBody');
  let setKey = '', rebuilding = false;
  let fitNote = null;        // the Refinement section's note, when an entry was not taken
  const setOpen = () => setModal.style.display === 'flex';
  const phaseOf = id => id === lab6.id ? lab6 : phases.find(p=> p.id === id);
  // Why a mode does not apply to a phase (its checkbox and depth disabled), or ''.
  const naOf = (p, k) => p === lab6 && k === 'occ' ? "The standard's structure is certified: its occupancies are the CIF's"
    : p === lab6 && STD_NA.includes(k) ? "The standard's widths are the instrument's profile (U, V, W, X, Y and the asymmetry, refined on it): no size, strain or faults of its own"
    : k === 'wppm' && !p.on.size ? 'WPPM is a profile of the crystallite size: switch the size on first'
    : k === 'occ' && siteList(p).length < 2 ? "A phase of one site: its occupancy is the scale, which the pattern cannot tell from it" : '';
  function openSettings(){
    if (busy || setOpen()) return;
    setModal.style.display = 'flex'; $('xrdRvSettings').classList.add('is-on');
    setKey = ''; fitNote = null; renderSettings();
    document.addEventListener('keydown', onSetKey);
    setModal.querySelector('.modal-box').focus();
  }
  function closeSettings(){
    if (!setOpen()) return;
    // (the focus back on the button, when it was in the box: a keyboard user goes on from there)
    const inBox = setModal.contains(document.activeElement);
    setModal.style.display = 'none'; $('xrdRvSettings').classList.remove('is-on');
    document.removeEventListener('keydown', onSetKey);
    if (inBox && !$('xrdRvSettings').disabled) $('xrdRvSettings').focus();
  }
  function onSetKey(e){ if (e.key === 'Escape') closeSettings(); }
  // Built again only when the phases on show change (one added or removed by an undo, the
  // standard chosen); otherwise the inputs are set in place, keeping the focus.
  function renderSettings(){
    if (!setOpen()) return;
    const list = [...phases, ...(host.files().some(isStd) ? [lab6] : [])];
    const key = list.map(p=> [p.id, p.color, p.prep.name].join()).join('|');
    if (key !== setKey){
      setKey = key;
      const sec = p => `<div class="rvs-sec" data-sec="${p.id}"><div class="rvs-head"><span class="rv-key" style="background:${p.color}"></span><b>${esc(p.prep.name)}</b>${p === lab6 ? '<span class="txt-meta">standard</span>' : ''}</div>`
        + MODES.map(m=>{ const id = `xrdRvSet${p.id}_${m.k}`;
          return `<div class="rvs-row" data-row="${m.k}"><input type="checkbox" id="${id}" data-on="${m.k}" data-ph="${p.id}"><label for="${id}">${m.label}</label>`
            + `<select data-depth="${m.k}" data-ph="${p.id}" aria-label="${esc(m.label)} of ${esc(p.prep.name)}: depth">${listOf(p, m).map(([v, t])=> `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></div>`; }).join('') + '</div>';
      // The hold boxes two to a row, in the phases' columns: the first under their
      // checkboxes, the second under their depths.
      const hb = ([k, t, title]) => `<input type="checkbox" id="xrdRvHold_${k}" data-hold="${k}" title="${esc(title)}"><label for="xrdRvHold_${k}" title="${esc(title)}">${t}</label>`;
      const pairs = []; for (let i = 0; i < HOLDS.length; i += 2) pairs.push(HOLDS.slice(i, i + 2));
      const html = (list.length ? list.map(sec).join('') : `<div class="rv-empty">No phase yet: <b>+ CIF</b> adds one.</div>`)
        + `<div class="rvs-sec rvs-start"><div class="rvs-head"><b>Start</b></div>`
        + `<div class="rvs-chips"><button type="button" class="mode-chip rvs-chip" data-start="cif" title="The full staged refinement from the CIF's cell: the cell search, then each group of parameters in turn">From the CIF</button>`
        + `<button type="button" class="mode-chip rvs-chip" data-start="last" title="From each pattern's last result, the groups ticked below held there">From the last result</button></div>`
        + pairs.map(([a, b])=> `<div class="rvs-row rvs-hold">${hb(a)}${b ? `<span class="rvs-hold2">${hb(b)}</span>` : ''}</div>`).join('')
        + `<div class="rvs-note" title="${esc(START_RULE)}">Held: a group ticked, at the last result's values, unless its option changed since (then refined from its usual start); the rest refined from there. No last result, or other phases or cells: from the CIF.</div></div>`
        + `<div class="rvs-sec rvs-fit"><div class="rvs-head"><b>Refinement</b><button type="button" class="btn rvs-def" data-fit-def title="Every Refinement setting back to the engine's default">Defaults</button></div>`
        + FITS.map(fitRow).join('') + `<div class="rvs-note" data-fit-note></div></div>`;
      // (a field focused while the body is rebuilt fires a last change on its way out: ignored)
      rebuilding = true; setBody.innerHTML = html; rebuilding = false;
    }
    syncSettings();
  }
  /* A Refinement setting's row, in the phases' columns: a field under their depths (its
     range beside it), or, for the 1/2θ term, its value as a checkbox under theirs and
     "automatic" under the depths (the value locked, showing what automatic gives). */
  function fitRow(m){
    const id = 'xrdRvFit_' + m.k;
    return m.bool
      ? `<div class="rvs-row" data-fit-row="${m.k}"><input type="checkbox" id="${id}" data-fit="${m.k}"><label for="${id}">${m.label}</label>`
        + `<span class="rvs-cell"><input type="checkbox" id="${id}Auto" data-fit-auto="${m.k}"><label for="${id}Auto">automatic</label></span></div>`
      : `<div class="rvs-row" data-fit-row="${m.k}"><span></span><label for="${id}">${m.label}</label>`
        + `<span class="rvs-cell"><input type="text" inputmode="decimal" autocomplete="off" id="${id}" data-fit="${m.k}" aria-label="${esc(m.label)}, ${m.rule}"><span class="rvs-range">${m.range}</span></span></div>`;
  }
  function syncSettings(){
    if (!setOpen()) return;
    setBody.querySelectorAll('[data-sec]').forEach(sec=>{
      const p = phaseOf(+sec.dataset.sec); if (!p) return;
      MODES.forEach(m=>{
        const row = sec.querySelector(`[data-row="${m.k}"]`), cb = row.querySelector('input'), sel = row.querySelector('select'), na = naOf(p, m.k);
        cb.checked = !!p.on[m.k]; sel.value = depOf(p, m.k);
        cb.disabled = busy || !!na; sel.disabled = busy || !!na || !p.on[m.k];
        row.classList.toggle('is-na', !!na);
        // (the standard's B: why one ΔB is its default — LAB6_CIF's numbers)
        row.title = cb.title = sel.title = na || (p === lab6 && m.k === 'adp' ? m.title + ". On the standard, one ΔB is the default: held, a B 0.1 Å² off moved the profile's X by 10 esd, the profile taking up the intensities' fall with angle" : m.title);
      });
    });
    setBody.querySelectorAll('[data-start]').forEach(b=>{ const on = b.dataset.start === startFrom; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); b.disabled = busy; });
    setBody.querySelectorAll('[data-hold]').forEach(cb=>{ cb.checked = hold.includes(cb.dataset.hold); cb.disabled = busy || startFrom !== 'last'; });
    setBody.querySelectorAll('.rvs-hold').forEach(r=> r.classList.toggle('is-off', startFrom !== 'last'));
    syncFit();
  }
  // What the automatic 1/2θ term gives for the pattern on show (buildModel's rule).
  function autoInv(){
    const f = host.files()[idx];
    if (!f) return { on: false, why: '' };
    const x0 = scanRange(f)[0], on = x0 > 0 && x0 < 20;
    return { on, why: ` Here automatic gives ${on ? 'on' : 'off'}: ${f.label} starts at ${fitTxt(+x0.toFixed(2))}°.` };
  }
  // The Refinement section as the settings are: each field its value (the default when
  // not set), a field being typed in left as it is.
  function syncFit(){
    const fs = fitSettings(fit), ai = autoInv();
    FITS.forEach(m=>{
      const row = setBody.querySelector(`[data-fit-row="${m.k}"]`); if (!row) return;
      const el = row.querySelector('[data-fit]');
      if (m.bool){
        const auto = !(m.k in fit), a = row.querySelector('[data-fit-auto]');
        a.checked = auto; a.disabled = busy;
        el.checked = auto ? ai.on : fit[m.k]; el.disabled = busy || auto;
        row.title = el.title = a.title = m.title + ai.why;
        row.querySelector('label').title = row.title;
        return;
      }
      const txt = fitTxt(m.pct ? fs[m.k]*100 : fs[m.k]);
      if (el !== document.activeElement || el.value === el.dataset.shown) el.value = txt;
      el.dataset.shown = txt; el.disabled = busy;
      row.title = m.full;
    });
    const def = setBody.querySelector('[data-fit-def]');
    if (def) def.disabled = busy || !Object.keys(fit).length;
    const note = setBody.querySelector('[data-fit-note]');
    if (note){
      note.classList.toggle('is-warn', !!fitNote);
      note.textContent = fitNote || 'For every pattern, from the next refinement. A result refined with other than the defaults says which, under its statistics.';
    }
  }
  // A Refinement setting changed (on change or Enter): kept when allowed — a value back at
  // its default dropped — else the field shakes, goes back to the value it had, and the
  // note says what is allowed.
  function commitFit(t){
    if (busy || rebuilding || !t.isConnected) return;
    const k = t.dataset.fit || t.dataset.fitAuto, m = FIT[k]; if (!m) return;
    if (t.dataset.fitAuto){ if (t.checked) delete fit[k]; else fit[k] = autoInv().on; }
    else if (m.bool) fit[k] = t.checked;
    else {
      const was = fitSettings(fit)[k], v = readFit(m, t.value);
      if (v === null){
        const raw = String(t.value).trim();
        fitNote = `${m.label}: ${m.rule}${m.int && /[.,]/.test(raw) ? ', without a point or comma' : ''}${raw ? ` — “${raw.length > 12 ? raw.slice(0, 12) + '…' : raw}” not taken` : ''}; kept ${t.dataset.shown}.`;
        t.value = t.dataset.shown; flashFieldInvalid(t); syncFit();
        return;
      }
      // (Enter, then the change on leaving: one step)
      if (v === was){ t.value = t.dataset.shown; if (fitNote){ fitNote = null; syncFit(); } return; }
      if (v === FIT_DEF[k]) delete fit[k]; else fit[k] = v;
    }
    // (in FITS' order, as restore gives it: the undo history compares states as text)
    fit = cleanFit(fit);
    fitNote = null;
    host.commit(); syncFit();
    // The field as taken, though still focused after Enter ("0,5" is 0.5; "1e2", 100).
    if (!m.bool) t.value = t.dataset.shown;
  }
  setBody.addEventListener('change', e=>{
    const t = e.target, d = t.dataset;
    if (d.fit || d.fitAuto){ commitFit(t); return; }
    if (busy || !(d.on || d.depth || d.hold)) return;
    if (d.hold) hold = HOLD_KEYS.filter(k=> k === d.hold ? t.checked : hold.includes(k));
    else {
      const p = phaseOf(+d.ph); if (!p) return;
      if (d.on) p.on[d.on] = t.checked;
      else if (listOf(p, MODE[d.depth]).some(([v])=> v === t.value)) p.dep[d.depth] = t.value;
    }
    host.commit(); renderPhases(); syncSettings();
  });
  setBody.addEventListener('keydown', e=>{
    if (e.key === 'Enter' && e.target.dataset.fit && e.target.type === 'text'){ e.preventDefault(); commitFit(e.target); }
  });
  setBody.addEventListener('click', e=>{
    if (e.target.closest('[data-fit-def]')){
      if (busy || !Object.keys(fit).length) return;
      fit = {}; fitNote = null; host.commit(); syncFit();
      return;
    }
    const b = e.target.closest('[data-start]');
    if (!b || busy || b.dataset.start === startFrom) return;
    startFrom = b.dataset.start === 'last' ? 'last' : 'cif';
    host.commit(); syncSettings();
  });
  setModal.addEventListener('click', e=>{ if (e.target === setModal) closeSettings(); });
  $('xrdRvSetDone').onclick = closeSettings;
  $('xrdRvSettings').onclick = ()=> setOpen() ? closeSettings() : openSettings();

  $('xrdRvAddCif').onclick = ()=> $('xrdRvCifInput').click();
  $('xrdRvCifInput').addEventListener('change', e=>{ const fl = [...e.target.files]; e.target.value = ''; if (fl.length) addCifs(fl); });
  $('xrdRvPhaseList').addEventListener('click', e=>{
    const b = e.target.closest('[data-del]'); if (!b || busy) return;
    const id = +b.dataset.del;
    phases = phases.filter(p=> p.id !== id);
    // A result refined with the phase is no longer the model's: it goes with it.
    Object.keys(results).forEach(k=>{ if ((results[k].phases || []).includes(id)) delete results[k]; });
    renderPhases(); draw(true); host.commit();
  });
  $('xrdRvRefine').onclick = ()=>{
    if (busy){ cancelled = true; if (cancelJob) cancelJob(); return; }
    const f = host.files()[idx]; if (f) refine([f]);
  };
  $('xrdRvRefineAll').onclick = ()=> refineAll();
  $('xrdRvClear').onclick = ()=>{ const f = host.files()[idx]; if (!f || busy || !results[f.name]) return; delete results[f.name]; draw(true); host.commit(); };
  // Every pattern's result, those of the files left out too (an undo brings them back).
  $('xrdRvClearAll').onclick = ()=>{ if (busy || !Object.keys(results).length) return; results = {}; draw(true); host.commit(); };
  $('xrdRvPrev').onclick = ()=>{ const n = host.files().length; if (n){ idx = (idx - 1 + n) % n; draw(); } };
  $('xrdRvNext').onclick = ()=>{ const n = host.files().length; if (n){ idx = (idx + 1) % n; draw(); } };

  return {
    // After any change to the files: the card follows them; results of files no
    // longer loaded go.
    refresh(preserve){
      const fs = host.files();
      $('xrdRvCard').style.display = fs.length ? 'block' : 'none';
      // (an undo with the settings open can take every file away: the card goes, and they go with it)
      if (!fs.length){ closeSettings(); return; }
      const names = new Set(host.allFiles().map(f=> f.name));
      Object.keys(results).forEach(k=>{ if (!names.has(k)) delete results[k]; });
      // A result refined in the other role (the standard chosen, or changed, since) is not
      // this file's any more: a sample fit of the standard's file had given the samples
      // its profile and zero as the instrument's.
      host.allFiles().forEach(f=>{ const r = results[f.name]; if (r && roleOf(r) != null && roleOf(r) !== isStd(f)) delete results[f.name]; });
      renderPhases();
      draw(preserve);
      renderSettings();
    },
    redraw(){ if (host.files().length) draw(true); },
    // Each phase's settings (on, dep), and beside them the options as v428 named them
    // (engineOf), which an older version opening the project reads.
    snapshot(){ return { phases: phases.map(p=>{ const e = engineOf(p, false);
        return { id: p.id, cif: p.cif, file: p.file, color: p.color, on: { ...p.on }, dep: { ...p.dep },
          shape: e.shape, po: e.po || '', profile: e.profile, strain: e.strain, faults: e.faults || '', adp: e.adp, occ: e.occ || null }; }),
      std: { on: { ...lab6.on }, dep: { ...lab6.dep } }, start: startFrom, hold: hold.slice(), fit: { ...fit },
      nextId, idx, results: JSON.parse(JSON.stringify(results)) }; },
    restore(s){
      s = s || {};
      // A project of v428 or older has the options without the flags (migrateSettings).
      phases = (s.phases || []).flatMap(p=>{ try { return [{ id: p.id, cif: p.cif, file: p.file, color: p.color,
        ...(p.on ? cleanSettings(p, defSettings()) : migrateSettings(p, s.refineB)), prep: prepPhase(p.cif, p.file) }]; } catch(e){ return []; } });
      // (the rows that do not apply to the standard stay off, whatever a file says)
      Object.assign(lab6, s.std ? cleanSettings(s.std, stdSettings()) : stdSettings());
      STD_NA.forEach(k=> { lab6.on[k] = false; });
      startFrom = s.start === 'last' ? 'last' : 'cif';
      hold = Array.isArray(s.hold) ? HOLD_KEYS.filter(k=> s.hold.includes(k)) : HOLD_DEFAULT.slice();
      // (a project of v428 or older has none: the defaults; a note on an entry not taken
      // is about the settings before)
      fit = cleanFit(s.fit); fitNote = null;
      nextId = s.nextId || phases.reduce((m, p)=> Math.max(m, p.id + 1), 1);
      idx = s.idx || 0;
      results = s.results ? JSON.parse(JSON.stringify(s.results)) : {};
      syncButtons();
    },
    // The CSVs: every refined pattern's curves, and one row per pattern and phase.
    csvEntries(){ return csvEntries(); },
  };

  function csvEntries(){
    const out = [], fs = host.files().filter(f=> results[f.name] && results[f.name].params);
    if (!fs.length) return out;
    const cols = [];
    fs.forEach(f=>{
      let c; try { c = curvesOf(f, results[f.name]); } catch(e){ return; }
      cols.push({ h: '2Theta_' + f.label, v: Array.from(f.x, v=> fmtData(v, 5)) },
        { h: 'Observed_' + f.label, v: Array.from(f.y, v=> fmtData(v, 3)) },
        { h: 'Calculated_' + f.label, v: Array.from(c.yc, v=> fmtData(v, 3)) },
        { h: 'Background_' + f.label, v: Array.from(c.bg, v=> fmtData(v, 3)) },
        { h: 'Difference_' + f.label, v: Array.from(f.y, (v, i)=> fmtData(v - c.yc[i], 3)) });
    });
    const n = Math.max(0, ...cols.map(c=> c.v.length));
    let t = csvLine(cols.map(c=> c.h));
    for (let i = 0; i < n; i++) t += csvLine(cols.map(c=> i < c.v.length ? c.v[i] : ''));
    out.push({ name: 'rietveld_pattern.csv', text: t });
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
      if (staleOf(f, r)) s += csvLine([f.label, '', 'standard_changed_since', '1', '', num(st.Rwp*100, 3), num(st.Rexp*100, 3), num(st.chi2, 3)]);
      // The Refinement settings it was refined with, those not the defaults (as the card
      // says them): the engine's values and units (cellRange a fraction, bgInv 1 or 0), in
      // full, with the export's decimal mark.
      fitUsed(f, r).forEach(u=> s += csvLine([f.label, '', 'fit_' + u.k, typeof u.v === 'boolean' ? (u.v ? '1' : '0') : fitTxt(u.v).replace('.', settings.decimal), '', num(st.Rwp*100, 3), num(st.Rexp*100, 3), num(st.chi2, 3)]));
    });
    out.push({ name: 'rietveld_results.csv', text: s });
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
        pk += csvLine([f.label, ph.name, w.plain, num(w.tt, 5), num(w.rel, 4), num(w.H, 5), num(w.Hesd, 5), num(w.eta, 3), lim ? num(w.HsMax, 5) : num(w.Hs, 5), lim ? '' : num(w.HsEsd, 5), num(w.D, 4), num(w.Desd, 4), w.flat ? '' : num(w.dd, 6), w.flat ? '' : num(w.ddEsd, 6), num(w.model.iso, 5), ph.shaped ? num(w.model.shape, 5) : '', skip ? 'no' : 'yes', note]);
      }));
    });
    if (anyPk) out.push({ name: 'rietveld_peaks.csv', text: pk });
    return out;
  }
}
