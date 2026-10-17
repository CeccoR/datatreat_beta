/* =========================================================
   XRPD — the Rietveld card (page side).
   The phases come from CIFs (the standard's LaB6 is built in); the refinement runs in
   a module worker (xrd-rietveld.worker.js) on xrd-rietveld.js, and its result is kept
   per pattern, by file name, so moving, leaving out or reloading files never puts it
   on another pattern. The curves are not kept: they are recomputed from the refined
   parameters, which takes milliseconds.
========================================================= */
import { fmtData, csvLine, X_SVG, flashFieldInvalid, settings, fitCsvIcons } from './utils.js';
import { Plot } from './plot.js';
import { parseCif, expandAtoms, structureCell, checkComposition, cellMass, metric, reflections } from './xrd-cryst.js';
import { readXrdmlInstrumentText } from './xrd-instr.js';
import { buildModel, calc, fitSettings, phaseSites } from './xrd-rietveld.js';
import { shapeView } from './xrd-shape3d.js';
import { cellView, elementColor } from './xrd-cell3d.js';
import { spaceGroupName, spaceGroupSymbol, sgPretty } from './xrd-sg.js';

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
  // The space group the file names, else the one its atoms have (xrd-sg.js).
  const named = spaceGroupName(cif.hm);
  let sg = named;
  if (!sg){ try { sg = spaceGroupSymbol(sc.cell, sym.ops, sym.constraint); } catch(e){ sg = null; } }
  return {
    name: cif.name || (fileName || '').replace(/\.cif$/i, ''), file: fileName || '', formula: cif.formulaSum || '', sites,
    cell: sc.cell, ops: sym.ops, atoms: sc.atoms, system: sym.system, constraint: sym.constraint, order: sym.order,
    mass: cellMass(sc.atoms), notes, warnings, ownCell: !!sc.basis, Z: cif.Z || null,
    sg: sg || null, sgFrom: named ? 'cif' : sg ? 'atoms' : null,
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
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const formulaPretty = f => esc(f).replace(/(\d+(?:\.\d+)?)/g, m => m.replace(/\d/g, d => SUBS[d]));

const DL_SVG = '<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="15"/><polyline points="7 10.5 12 15.5 17 10.5"/><line x1="5" y1="20" x2="19" y2="20"/></svg>';
const CSV_SVG = '<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><text x="12" y="11" font-size="8.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" style="font-family:sans-serif">CSV</text><line x1="6" y1="18" x2="15" y2="18"/><polyline points="12.5 15.5 16 18 12.5 20.5"/></svg>';

// The card's instructions (cards.js shows them under its title).
export const RV_INFO = `Whole-pattern Rietveld refinement. Each phase comes from a CIF (<b>+ CIF</b>, in the list beside the pattern, which gives each its formula and space group): its cell, its atoms and the symmetry the structure has. A file in P1, as Materials Project gives them, has its symmetry found from the atoms, so that a cubic cell is refined by <i>a</i> alone (a primitive cell of a centred lattice through its conventional cell, whose <i>a</i> and <i>V</i> are the ones reported), and its space group read off those operations; a file with its own operations is checked against its formula and Z (an origin-choice mix-up shows there). A phase's tick in the list says whether it is refined on the pattern on show: every pattern has them all at first, and each its own. A click on a phase shows its unit cell beside the list, in 3D (drag it to turn it, a double click puts it back), with its details under it. The instrumental standard (<b>Instrumental standard…</b>) is a file of its own, refined in its own window against the built-in LaB₆ (NIST SRM 660c, <i>a</i> = 4.156826 Å, held fixed) or a CIF of the standard's: its zero and its peak shape — the Thompson–Cox–Hastings pseudo-Voigt, Gaussian width² = U·tan²θ + V·tanθ + W and Lorentzian width = X·tanθ + Y/cosθ, made asymmetric by the axial divergence (through the Soller slits the file gives, Cheary–Coelho's full axial model, with the sample's and receiver's axial length L refined; without Sollers, Finger–Cox–Jephcoat's one parameter (S+H)/L: the tail of the low-angle peaks towards lower angles) — and a shift of 2θ as sin 2θ, the form of the sample's transparency, beside the zero and the displacement, become the instrument's, and each sample refines only its own broadening on top of them: a Lorentzian Y<sub>s</sub>/cosθ, which gives the crystallite size (D = Kλ/Y<sub>s</sub>, Y<sub>s</sub> in radians, K = 0.9 as in the Scherrer analysis), and X<sub>s</sub>·tanθ = 4ε·tanθ, the microstrain. The pattern is computed from Kα₁ and Kα₂ at the file's wavelengths and ratio, the Bragg–Brentano Lorentz–polarisation factor (with a monochromator only when the file has one), |F|² from the atoms (Waasmaier–Kirfel form factors with Chantler's anomalous terms), a Chebyshev background and a specimen displacement per sample; each point weighs by its counts (1/σ², σ² the counts times the attenuation). <b>Refine</b> starts from the CIF's cell, finds where the pattern's peaks are by scaling that cell, then frees the parameters stage by stage; <b>Refine all</b> does every pattern. <b>Settings…</b> decides what Refine refines: for each phase each of the models below switched on or off and, when on, how deep (the size and the microstrain can be off too). It also sets where Refine starts: from the CIF, as above, or from each pattern's last result, with the groups of parameters ticked held at its values (whatever is new or changed since is refined) — a shape fitted, say, then held while B per site is refined. Its <b>Refinement</b> section sets, for every pattern, the least squares and the searches: the iterations allowed, the shift tolerance and the starting damping, the background's Chebyshev degree and its 1/2θ term (automatic: on when the scan starts below 20°), the cell search's range, and the free shape's trial starts, each result saying which it was refined with when they are not the defaults. <b>Clear</b> removes this pattern's result, <b>Clear all</b> every pattern's. With several phases each gets its weight fraction (Hill–Howard, of the crystalline part). A phase is reported <i>not detected</i>, and left out of the refinement, when its scale is not above 3 esd, or when it is significant only through intensity under another phase's peaks with no part of the pattern its own (a candidate impurity whose lines fall on the main phase's would otherwise take up whatever misfit those peaks leave). The same CIF added twice gives two size populations of one phase. <b>Size profile</b> (with a refined standard): <i>Lorentzian</i>, a Lorentzian of the right breadth read with Scherrer's K; or <i>WPPM</i> (Whole Powder Pattern Modelling, Scardi &amp; Leoni), each line synthesised as the Fourier transform of the product of the instrument's, the size's, the strain's and the faults' coefficients — the size's being the crystallites' own common-volume function (a sphere's, or a free solid's along each member of the family), so the dimensions are the true ones and the profile's shape counts too. With <i>log-normal sizes</i> the coefficients are averaged over a distribution of width σ (of ln D): the size read is the volume-weighted mean (what the breadth measures), with the median and the number-weighted mean beside. <b>Microstrain</b>: isotropic, or <i>anisotropic</i> (Stephens: ε² a quartic form of the reflection's direction that the Laue group leaves unchanged; given as its rms and along the low-index planes' normals). <b>Planar faults</b> (after Warren): faults on a family of planes, each displacing the crystal by a vector of a family (those in the plane), the probability per plane refined: reflections whose h·R is not an integer broaden, by parity rather than by order. <b>Displacement parameters</b>: the CIF's held (0.5 Å² where it has none); one ΔB added to all of a phase's B; one B per crystallographic site (the sites from the symmetry found); or the anisotropic U<sup>ij</sup> per site, only those the site's symmetry leaves free, with B<sub>eq</sub>. Each is strongly correlated with the scale, and so with the weight fractions, with the background and, on broad peaks, with the widths: they want data to high angle. <b>Site occupancy</b>: the occupancy of one of the phase's sites refined — how strongly the site scatters against its species at full occupancy, alike at every angle (a B lowers it more the higher the angle): under 1, atoms missing (vacancies, a depleted surface) or a lighter species beside them; over 1, a heavier one. The weight fractions use the cell's mass at the refined occupancy. Every site at once would be the scale again, so a phase of one site has none to refine; the standard's structure is certified. <b>Preferred orientation</b>: March–Dollase, each reflection's members weighed by (r²·cos²α + sin²α/r)<sup>−3/2</sup>, α their angle to the normal of the chosen planes (hkl) — r under 1 when such planes lie preferentially parallel to the sample's surface (plates), over 1 when they do not (needles); <i>best axis</i> tries the low-index planes and keeps the lowest χ². For a cubic phase r has no first-order effect at 1, so it is refined from 0.8 and from 1.25 and the better kept. It changes the intensities, not the widths: an intensity misfit left in is otherwise taken up by a free shape, which widens or narrows peaks to fit it (on a SrTiO<sub>3</sub> whose Sr site scatters 0.7 of a full one, with that site held full the plates came out ⟂ ⟨310⟩; with its occupancy refined, ⟂ ⟨110⟩, as the crystals are). <b>Crystallite shape</b> (with a refined standard): the isotropic size, or a free solid — an <i>ellipsoid</i> of any proportions, a <i>spheroid</i> (two axes equal), a <i>cylinder</i>, an <i>elliptic cylinder</i> (an ellipse translated along its axis), a <i>box</i> or a <i>square-based box</i> (two edges equal: a square plate or rod) —, in any orientation. A shape that breaks the crystal's symmetry (a disc normal to one ⟨110⟩ of a cubic phase) gives the reflections of one family different widths, so each is drawn with its own and the peak is their sum; its width follows the solid's volume-weighted column length along it (Stokes &amp; Wilson), in closed form for each solid (the faces rounded off over 2° of direction during the search only: the result is the exact solid's). The fit starts from several shapes (the sphere, plates and needles along the low-index directions, slightly tilted, and random ones) and keeps the best, if it beats the isotropic size by ΔBIC under −10 (χ² divided by the isotropic fit's χ²<sub>ν</sub>, so that a misfit is not taken for evidence); else the isotropic size stays. Each solid is also refined with its axes held exactly on their nearest lattice directions — its faces lattice planes —, and kept so when that gives the lower ΔBIC and the free orientation is not better by more than its χ² allows (95 %); the free fit's angle from them is given beside. The ΔBIC of each solid against the same isotropic fit also compares the solids: under 10 is no preference, 10–30 weak (within what the search itself varies on real data), over 30 telling; and the sizes depend on the solid chosen. The result gives the solid's dimensions with their esds — true ones (diameter, height, edges, full axes): with WPPM the solid's own, else calibrated as the isotropic size, a sphere's diameter —, each axis with the simplest lattice direction within 10°, its angle from it and its angular esd (the turn of the solid that raises χ² by χ²<sub>ν</sub>, its sizes and its turns about the other axes refined again: it measures the valley of χ² the fit ends in, and of 7 free fits of synthetic boxes 2 ended 3–4 esd off, in another valley nearly as deep); two dimensions not told apart within 2 esd have no direction of their own, nor has an axis whose angular esd is over 30°. The sizes across a thin solid's faces assume ideally flat faces: a 2° spread of their orientation would shorten them by 10–30 %. The solid is drawn beside the peak widths with the crystal's directions on it and their uncertainty as cones (an axis the data do not fix dashed, <i>not determined</i>), and the cell's <i>a</i>, <i>b</i>, <i>c</i> in a corner for reference: drag it to turn it. Under the pattern: the difference, and a row of ticks per phase at its reflections; under them, the refinement's results across the card, each phase with what its CIF gave and how it was refined. <b>Peak widths</b>: each reflection of a sample fitted alone (the pattern less the isotropic refinement's background and every other reflection, with a straight line for what is left, Kα₁ and Kα₂ and the instrument's asymmetry) by its own Lorentzian and Gaussian widths, to which the instrument's at that angle are added as the refinement adds them: their FWHM is the sample's alone, and the size from it is as in the Scherrer analysis. Three tests read them with no model of the shape, written in the Williamson–Hall plot (its tooltip has them in full): <i>Williamson–Hall</i>, β·cosθ against 4·sinθ, where an isotropic size and strain put the points on one line (χ²<sub>ν</sub> about it and its probability); <i>orders</i>, Δd* = β·cosθ/λ of (h k l) and (n·h n·k n·l), equal for a size, in the ratio n for a strain, below 1 for faults that broaden by parity; and <i>prediction</i>, the same measurement on each model's own curve, which a model of the shape should match. Overlapped, weak or end-of-pattern peaks, and those no broader than the instrument within 2 esd, are listed but not used. R<sub>wp</sub>, R<sub>exp</sub> and χ² judge the fit; the values in brackets are the standard errors in the last digits, which the serially correlated residuals of a powder pattern make smaller than the real uncertainty. A refinement that stopped before converging, parameters on a bound (to be read as limits) and parameters the data do not determine are said under the results. How it all works in detail: RIETVELD.md in the repository.`;
export const RV_STD_INFO = `The instrumental standard's own Rietveld refinement: one file (a file dropped replaces the one there), refined against the phase chosen in the list (the round button) — the built-in LaB₆ (NIST SRM 660c), or a CIF of the standard's. Its zero, its peak shape (U, V, W, X, Y and the axial divergence) and its sin 2θ shift become the instrument's, which every sample's refinement then takes: refine it before the samples, and refine them again after refining it again. Its cell is held at the CIF's (a certified standard's), and its own widths are the instrument's: no size, strain or faults of its own; its <b>Settings…</b> keep its displacement parameters (one ΔB by default) and its texture, where its refinement starts, and the zero scan's range.`;

/* host: {
     files()        the patterns refined (the included samples; the standard's one)
     allFiles()     every file loaded, for the results of those left out
     idx(), step(d) the sample on show, shared by the cards, and stepping it (samples)
     commit()       a step of the undo history
     irf()          the standard's instrumental profile (samples)
     openStd()      open the standard's window (samples)
     changed()      the standard's result changed (the standard): the samples' notes follow
     hidden()       the card is folded: nothing is drawn
   }
   o: { prefix, standard } */
export function createRietveld(host, root, o){
  const p = o.prefix, std = !!o.standard;
  root.innerHTML = rvHtml(p, std);
  const $ = id => root.querySelector('#' + p + id);
  let phases = [];           // [{ id, cif (text), file, color, prep, on, dep (the settings: MODES), off (file name → true: not refined there) }]
  let nextId = 1;
  let results = {};          // file name → { params, esd, stats, stages, free, held, detected, shapes, isoParams, at, … }
  let startFrom = 'cif', hold = HOLD_DEFAULT.slice();   // where Refine starts (HOLDS)
  let fit = {};              // the Refinement settings changed from their defaults (FITS)
  let busy = false, cancelled = false;
  let plot = null;
  let sel = null;            // the phase whose structure is on show
  // The standard's: the built-in LaB6, its own colour apart from the CIF phases'; the
  // phase its refinement uses (pick).
  const lab6 = { id: 0, cif: LAB6_CIF, file: '', color: '#4cc9a0', ...stdSettings(), prep: prepPhase(LAB6_CIF, 'LaB6 (NIST SRM 660c)'), off: {} };
  lab6.prep.name = 'LaB₆ (NIST SRM 660c)';
  lab6.prep.notes = [];      // written in P1 here only to be short: nothing to report
  let pick = 0;
  const allPhases = ()=> std ? [lab6, ...phases] : phases;
  const curIdx = ()=> std ? 0 : Math.min(host.idx(), Math.max(0, host.files().length - 1));

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
  // The phases refined on a pattern: the standard's chosen one; a sample's those ticked for it.
  const stdPhase = ()=> allPhases().find(q=> q.id === pick) || lab6;
  const phasesFor = f => std ? [stdPhase()] : phases.filter(q=> !(f && q.off[f.name]));

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

  // The role a result was refined in: as the standard or as a sample; null for a result
  // too old to say (before v429: the built-in LaB6 alone was the standard's).
  const roleOf = r => r.standard != null ? !!r.standard : Array.isArray(r.phases) ? r.phases.length === 1 && r.phases[0] === lab6.id : null;
  /* The instrumental profile a standard's refinement gives the samples (the standard's
     card: its own; a sample's: the standard's, host.irf). */
  function ownIrf(){
    const f = host.files()[0], r = f && results[f.name] && roleOf(results[f.name]) !== false ? results[f.name] : null;
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
  const irf = ()=> std ? ownIrf() : host.irf();
  // A result's profile against the standard's now: the same refinement of it, or not (the
  // standard refined again since, or cleared). Old results' irf has no λ1: U … zero decide.
  const IRF_KEYS = ['U', 'V', 'W', 'X', 'Y', 'asym', 'zero', 'axL', 'transp'];
  const sameIrf = (a, b) => !!a && !!b && IRF_KEYS.every(k=> (a[k] || 0) === (b[k] || 0));
  const staleOf = (f, r) => !std && !!r.irf && !sameIrf(r.irf, irf());
  // The phases as the engine takes them: their structure, and the options their settings
  // give (engineOf; the standard's its own).
  const phaseData = list => list.map(q=> ({ id: q.id, name: q.prep.name, cell: q.prep.cell, constraint: q.prep.constraint, ops: q.prep.ops, atoms: q.prep.atoms, mass: q.prep.mass, color: q.color,
    ...engineOf(q, std) }));
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
    if (ids.length !== list.length || list.some(q=> !ids.includes(q.id))) return 'refined with other phases';
    if (roleOf(r) !== std) return 'refined in the other role';
    // (a result of v425 or older kept no cells: the file's cell then, so only a phase that
    // v426 re-expresses in a cell of its own has changed — as curvesOf reads it)
    if (r.cells ? list.some(q=> r.cells[q.id] !== cellKey(q.prep.cell)) : list.some(q=> q.prep.ownCell)) return 'a phase refined in another cell since';
    return '';
  }
  // A pattern's background terms under fit settings: the Chebyshev degree and whether the
  // 1/2θ term is used (buildModel's rule: 'auto' is on from below 20°, never from 0°).
  const bgTerms = (fs, f) => { const x0 = scanRange(f)[0]; return fs.bgDegree + (x0 > 0 && (fs.bgInv === 'auto' ? x0 < 20 : fs.bgInv) ? '+inv' : ''); };
  // run: the phases and the start as they were when the run started, the same for all its
  // files (an undo during a run would otherwise change them between files); run.fell
  // collects the patterns refined from the CIF instead, run.bgFreed those whose scales and
  // background are refined rather than held.
  function payloadFor(f, run){
    const list = std ? [run.std] : run.ph.filter(q=> !q.off[f.name]), opts = { standard: std, irf: std ? null : irf(), fit: { ...run.fit } };
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
      phases: phaseData(list), opts, list };
  }

  async function refine(list){
    if (busy) return;
    const todo = list.filter(f=> phasesFor(f).length);
    if (!todo.length){ setStatus(std ? 'Load the standard\'s file to refine it.' : list.length ? 'No phase ticked for this pattern: add one from a CIF, or tick one.' : 'Add a phase from a CIF to refine.'); return; }
    busy = true; cancelled = false; closeSettings(); syncButtons();
    const copy = q => ({ ...q, on: { ...q.on }, dep: { ...q.dep }, off: { ...q.off } });
    const run = { ph: phases.map(copy), std: copy(stdPhase()), start: startFrom, hold: hold.slice(), fit: { ...fit }, fell: [], bgFreed: [] };
    try {
      for (let k = 0; k < todo.length && !cancelled; k++){
        const f = todo[k], pay = payloadFor(f, run), from = pay.opts.start ? ' from its last result' : '';
        const ph = pay.list; delete pay.list;
        setStatus(`Refining ${f.label}${from}…`);
        // (the stages say the rest: a start from the last result has its own)
        const res = await runInWorker(pay, (frac, stage)=>{ showProg((k + frac)/todo.length); if (stage) setStatus(`Refining ${f.label}: ${stage}…`); });
        if (!res) break;
        // (the phases it was refined with: a CIF added meanwhile is not among them; the
        // standard's profile as the worker used it, kept to tell when the standard changes;
        // free, held, detected, shapes, isoParams: what the next start from it needs)
        results[f.name] = { ...res, standard: std, phases: ph.map(q=> q.id), irf: std ? null : res.irf || null, at: Date.now(),
          cells: Object.fromEntries(ph.map(q=> [q.id, cellKey(q.prep.cell)])) };
        if (f === host.files()[curIdx()]) draw();
      }
      setStatus([run.fell.length && `From the CIF, no last result to start from: ${run.fell.join('; ')}.`,
        run.bgFreed.length && `Scales and background refined, not held: the background's terms changed since the last result (${run.bgFreed.join(', ')}).`].filter(Boolean).join(' '));
    } catch(e){
      setStatus('⚠ ' + e.message);
    } finally {
      busy = false; hideProg(); syncButtons(); draw(); host.commit();
      if (std && host.changed) host.changed();
    }
  }
  const refineAll = ()=> refine(host.files().slice());

  // ---- the plot: observed, calculated, the background, the difference under them,
  // and a row of ticks per phase between the two ----
  function curvesOf(f, r){
    /* The phases as the result was refined: those it was refined with (a phase added
       since, or one unticked, would draw its default scale in the curve), with the free
       shape when its parameters are there and the models it used (a size or strain
       switched off among them), whatever the settings say now. */
    const ids = r.phases || null, list = ids ? allPhases().filter(q=> ids.includes(q.id)) : phasesFor(f);
    if (ids && list.length !== ids.length) throw new Error('The phases changed since this refinement.');
    if (r.cells ? list.some(q=> r.cells[q.id] != null && r.cells[q.id] !== cellKey(q.prep.cell)) : list.some(q=> q.prep.ownCell))
      throw new Error('A phase is refined in another cell since this refinement.');
    const ph = phaseData(list).map(q=>{
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
    return { c: calc(model, r.params), list };
  }
  // The scan's 2θ range, low end first (the host turns a scan run downwards round, and
  // the engine takes either order).
  const scanRange = f => { const a = f.x[0], b = f.x[f.x.length-1]; return a <= b ? [a, b] : [b, a]; };
  function tickRowsOf(f){
    // Before a refinement the ticks sit where the file's cells put them, at Kα1 (over the
    // scan's range, whichever way it ran).
    const ins = instrOf(f) || {}, lam = ins.lam1 || 1.540598, [x0, x1] = scanRange(f);
    const dmin = lam/(2*Math.sin(Math.min(89.9, x1/2)*Math.PI/180));
    return phasesFor(f).map(q=> ({ color: q.color, name: q.prep.name,
      tt: reflections(q.prep.cell, q.prep.ops, dmin).map(r=> 2*Math.asin(lam/(2*r.d))*180/Math.PI).filter(t=> t >= x0 && t <= x1) }));
  }
  function draw(preserve){
    const fs = host.files();
    syncButtons();
    renderPhases();
    if (!fs.length){
      $('Label').textContent = std ? 'No standard loaded' : '—';
      if (!std) $('Idx').textContent = '0/0';
      if (plot){ plot = null; }
      $('Svg').replaceChildren(); $('Legend').innerHTML = ''; $('Instr').textContent = '';
      renderResults(null, null); renderWidths(null, null); renderSolids(null, null);
      return;
    }
    const k = curIdx(), f = fs[k], r = results[f.name];
    $('Label').textContent = f.label;
    if (!std) $('Idx').textContent = (k+1) + '/' + fs.length;
    if (host.hidden && host.hidden()) return;
    const svg = $('Svg');
    const prev = preserve && plot ? { xmin: plot.xmin, xmax: plot.xmax } : null;
    plot = new Plot(svg, { xlabel: '2θ (°)', ylabel: 'Intensity (counts)' });
    plot.attachTools(svg.closest('.plot-wrap'));
    let c = null, used = phasesFor(f);
    if (r && r.params){ try { const cv = curvesOf(f, r); c = cv.c; used = cv.list; } catch(e){ c = null; } }
    const ys = f.y, lo = Math.min(...ys), hi = Math.max(...ys), A = (hi - lo) || 1;
    const groups = c ? groupTicks(c.ticks, used) : tickRowsOf(f);
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
    groups.forEach((g, k2)=>{
      const y1 = tickTop - k2*(rowH + rowGap), y0 = y1 - rowH, xs = [], yv = [];
      g.tt.forEach(t=>{ xs.push(t, t); yv.push(y0, y1); });
      plot.segments(xs, yv, g.color, 1.2, { label: g.name, key: 'ticks/' + g.name });
    });
    const leg = $('Legend');
    leg.innerHTML = `<span><i style="background:var(--plot-errbar)"></i>observed</span>`
      + (c ? `<span><i style="background:#ff5050"></i>calculated</span><span><i style="background:#ff9933"></i>background</span><span><i style="background:#3aa0ff"></i>difference</span>` : '')
      + groups.map(g=> `<span><i style="background:${g.color}"></i>${esc(g.name)}</span>`).join('');
    $('Instr').textContent = instrLine(instrOf(f));
    renderResults(f, r);
    renderWidths(f, r);
    renderSolids(f, r);
    fitSide();
  }

  // ---- the crystallites' shape: each phase's refined solid in 3D (xrd-shape3d), the
  // crystal's directions on it with their uncertainty cones; drag to turn it ----
  let solidViews = [], solidsKey = '';
  // How each solid was last turned (xrd-shape3d getView), by sample and solid: coming
  // back to a sample shows it as it was left.
  const solidTurns = new Map();
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
  // The solids' views are as tall as the Williamson–Hall plot beside them (shared by
  // several), and give way sideways, the table and the plot taking the room first.
  const solidHeight = n => ()=> { const h = $('WhSvg').getBoundingClientRect().height || 300; return Math.max(160, Math.round(h/n) - (n > 1 ? 34 : 0)); };
  function renderSolids(f, r){
    const box = $('Solids'), list = (r && r.solids) || [];
    // The same solids: the views stay as they were turned.
    const key = (f ? f.name : '') + JSON.stringify(list);
    if (key === solidsKey) return;
    solidsKey = key;
    solidViews.forEach(({ view, turnKey })=>{ if (view.getView) solidTurns.set(turnKey, view.getView()); view.destroy(); });
    solidViews = [];
    if (solidTurns.size > 50) solidTurns.delete(solidTurns.keys().next().value);
    box.innerHTML = '';
    root.querySelector('.rv-wrow').classList.toggle('has-solid', !!list.length);
    box.style.display = list.length ? '' : 'none';
    list.forEach(s=>{
      const color = (allPhases().find(q=> q.id === s.id) || {}).color;
      const wrap = document.createElement('div');
      wrap.className = 'rv-solid';
      wrap.innerHTML = `<div class="peak-box-head"><span class="txt-mini">Crystallite shape${list.length > 1 ? ' · ' + esc(s.name) : ''}</span><button class="btn table-csv-btn" title="Download PNG">${DL_SVG}</button></div><div class="rv-solid-view"></div>`;
      box.appendChild(wrap);
      const view = shapeView(wrap.querySelector('.rv-solid-view'), { color, height: solidHeight(list.length) });
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

  // ---- the peaks' own widths (xrd-widths, run by the worker): the table, and the
  // Williamson–Hall plot with the tests written in it ----
  let whPlot = null;
  // As the worker's fmtEsd: the esd rounded first, the value to its last digit.
  const fmtE = (v, e) => {
    if (!Number.isFinite(v)) return '—';
    const pw = Math.floor(Math.log10(e)), n = e/Math.pow(10, pw) < 2 ? 2 : 1;
    if (!(Number.isFinite(e) && e > 1e-15*Math.abs(v)) || n - 1 - pw > 100) return (+v.toPrecision(4)).toString();
    let d = n - 1 - pw, k = Math.round(e*Math.pow(10, d));
    if (k >= (n === 2 ? 20 : 10)){ k = Math.round(k/10); d--; }
    if (d >= 0) return v.toFixed(d) + '(' + k + ')';
    const sc = Math.pow(10, -d);
    return String(Math.round(v/sc)*sc) + '(' + k*sc + ')';
  };
  // A model's width: three decimals, or three significant digits under 0.1° (a sharp
  // peak's 0.0004° read 0.000).
  const f3 = v => !Number.isFinite(v) ? '—' : Math.abs(v) < 0.1 && v !== 0 ? String(+v.toPrecision(3)) : v.toFixed(3);
  // A probability: two significant digits, one below 10⁻³ (where the verdict turns, 2·10⁻⁴
  // read 0.000), and under the smallest a double holds as that bound.
  const fmtP = q => q < 1e-300 ? '< 1e-300' : q < 1e-3 ? q.toExponential(0) : String(+q.toPrecision(2));
  function renderWidths(f, r){
    const box = $('Widths'), wd = r && r.widths;
    const phs = wd ? wd.phases.filter(ph=> ph.rows.length) : [];
    box.style.display = phs.length ? '' : 'none';
    if (!phs.length){ whPlot = null; return; }
    // The free shape's column when some phase kept one; a phase without has none to give.
    const shapeOn = phs.some(ph=> ph.shaped);
    const colorOf = id => (allPhases().find(q=> q.id === id) || {}).color || '#888';
    // The table, as the Scherrer card's: a row per peak (reflections at one 2θ are one).
    let html = '<div class="peak-scroll"><table><thead><tr><th>#</th><th>hkl</th><th>2θ (°)</th><th>Relative Intensity</th><th>FWHM (°)</th>'
      + `<th title="The sample's own FWHM: the peak fitted with the instrument's profile at that angle convolved in (Lorentzian widths adding, Gaussian ones in quadrature, as in the refinement), the sample's Gaussian part weighed in as far as the data ask for it. &lt; x: no broadening measured above the instrument's, x its upper limit (2 esd)">FWHM corr. (°)</th><th title="Scherrer: Kλ/(FWHM corr.·cosθ), K = 0.9 as the Scherrer card. For a Lorentzian phase it reads as the refined size does; a WPPM phase's sizes are true dimensions, and this reading of the same crystallites comes out lower for spheres of one size (about 0.85×) and otherwise as the distribution has it (the tests say by how much)">Crystallite size corr. (nm)</th>`
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
    const wrap = $('PkWrap');
    wrap.innerHTML = html;
    drawWH(phs, colorOf);
    // Hover: the peak on the pattern and on the Williamson–Hall plot.
    wrap.querySelectorAll('.rv-pk').forEach(tr=>{
      tr.addEventListener('mouseenter', ()=> highlight(+tr.dataset.tt, tr.dataset.lab, +tr.dataset.ph, colorOf(+tr.dataset.ph)));
      tr.addEventListener('mouseleave', ()=> highlight(null));
    });
    fitCsvIcons(root);
  }
  function highlight(tt, lab, phId, color){
    if (plot){ plot.clearOverlay(); if (tt != null) plot.vline(tt, color, false); }
    if (!whPlot) return;
    whPlot.gOverlay.querySelectorAll('.wh-hl').forEach(e=> e.remove());
    if (tt == null) return;
    const q = (whPlot._pts || []).find(x=> x.label === lab && x.ph === phId);
    if (q){
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', whPlot.px(q.x)); c.setAttribute('cy', whPlot.py(q.y)); c.setAttribute('r', 7);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', color); c.setAttribute('stroke-width', 2); c.setAttribute('class', 'wh-hl');
      whPlot.gOverlay.appendChild(c);
    }
  }
  /* The tests, as lines of text: Williamson–Hall's χ²_ν and verdict, the line's size and
     strain, the orders' ratios, the models' predictions; and in full, for the tooltip. */
  function testLines(phs){
    const short = [], full = [];
    phs.forEach(ph=>{
      const wh = ph.wh, pre = phs.length > 1 ? ph.name + ': ' : '';
      if (Number.isFinite(wh.chi2nu)){
        const aniso = wh.p < 1e-3;
        short.push(`${pre}χ²ν ${wh.chi2nu.toFixed(1)}, p ${fmtP(wh.p)}: ${aniso ? 'anisotropic' : 'isotropic'}`);
        short.push(`D ${fmtE(wh.D, wh.Desd)} nm, ε ${fmtE(wh.b, wh.bEsd)}${aniso ? ' (an average)' : ''}`);
        full.push(`${pre}Williamson–Hall: χ²_ν ${wh.chi2nu.toFixed(1)} over ${wh.nu} degrees of freedom, p ${fmtP(wh.p)}. ${aniso ? 'The widths depend on hkl beyond their esds: the broadening is anisotropic (the crystallites\' shape, or faults).' : 'The widths lie on one line within their esds: consistent with an isotropic size and strain.'} The weighted line: D ${fmtE(wh.D, wh.Desd)} nm (Kλ/D its intercept, K = 0.9, on the corrected FWHM), ε ${fmtE(wh.b, wh.bEsd)}${aniso ? ', an average only' : ''}.`);
      } else {
        const nr = ph.rows.filter(w=> w.unread).length;
        short.push(`${pre}fewer than three peaks to read (${wh.n})`);
        full.push(`${pre}Williamson–Hall: fewer than three peaks to read (${wh.n})${nr ? `; ${nr} not read at all (the table says why)` : ''}.`);
      }
      if (ph.orders.length){
        short.push('orders: ' + ph.orders.map(x=> `${x.a}→${x.b} ${fmtE(x.R, x.Resd)}`).join(', '));
        full.push('Orders, Δd*(n)/Δd*(1) (size 1, strain n): ' + ph.orders.map(x=> `${x.a} → ${x.b}: ${fmtE(x.R, x.Resd)}, ${x.verdict === 'order-dependent' ? 'below 1: the higher order sharper (planar faults)' : x.verdict}`).join('; ') + '.');
      } else full.push('Orders: no pair (h k l), (n·h n·k n·l) both measured.');
      if (Number.isFinite(ph.scores.iso)){
        short.push(`widths predicted, χ²ν: isotropic ${ph.scores.iso.toFixed(1)}${Number.isFinite(ph.scores.shape) ? `, free shape ${ph.scores.shape.toFixed(1)}` : ''}`);
        full.push(`Widths predicted (the mean of ((measured − model)/esd)² over the peaks the tests use: about 1 when a model predicts them): isotropic ${ph.scores.iso.toFixed(1)}${Number.isFinite(ph.scores.shape) ? `, free shape ${ph.scores.shape.toFixed(1)}` : ''}.`);
      }
      // The stricter overlap rule (measureWidths): why fewer peaks are used. (ph.misfit: v429,
      // null in a saved result where it was NaN; a result of v427–v428 had the 5 % limit.)
      if (ph.overlapShare < 0.3) full.push('misfit' in ph
        ? `The isotropic model does not predict the widths read${Number.isFinite(ph.misfit) ? ` (beyond their esds they differ from its own by ${Math.round(ph.misfit*100)} %, rms)` : ''}: as it takes this phase's reflections off the peaks they overlap, of any phase, a peak is used only where, off by as much, they could move its width by under 2 esd, its esd widened by as much past half of one (and the others hold up to 30 % of its top).`
        : `The isotropic model does not predict the widths read: as it takes this phase's reflections off the peaks they overlap, of any phase, a peak is used only where they hold under ${Math.round(ph.overlapShare*100)} % of its top (the others up to 30 %).`);
      // A WPPM phase: the sizes here are Scherrer readings, the refined one a diameter.
      if (ph.reading) full.push(`WPPM: the sizes are Scherrer readings; read so, the model's own peaks give D ${fmtE(ph.reading.Dmodel)} nm for its ${ph.reading.lognormal ? 'volume-weighted mean diameter' : 'diameter'} of ${fmtE(ph.reading.D)} nm (the gap is the reading's, not the sample's).`);
    });
    return { short, full };
  }
  /* Williamson–Hall: H·cosθ (10⁻³ rad; H the corrected FWHM, not the integral breadth β)
     against 4·sinθ for the peaks the tests use, each with its esd and hkl; the weighted
     line through them (isotropic size + strain), from 4·sinθ = 0, where it gives Kλ/D;
     the models' own points (the isotropic model's and the free shape's) beside them; and
     the tests written in its top left corner, above the data (their tooltip in full). */
  function drawWH(phs, colorOf){
    const svg = $('WhSvg');
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
    const T = testLines(phs);
    if (!pts.length){ whPlot.setRange(0, 1, 0, 1); whPlot.drawAxes(); $('WhLegend').innerHTML = ''; noteWH(T); return; }
    // From 4·sinθ = 0, where a line meets the axis at Kλ/D; from 0 up, or from below the
    // lowest error bar or line where one goes under 0 (a negative intercept: no size). Room
    // above the data for the tests' lines.
    const xb = 1.12*Math.max(...pts.map(q=> q.x)) || 1;
    const ys = pts.flatMap(q=> [q.y - q.e, q.y + q.e]).concat(mods.map(m=> m.y),
      phs.flatMap(ph=> Number.isFinite(ph.wh.a) ? [1e3*ph.wh.a, 1e3*(ph.wh.a + ph.wh.b*xb)] : []));
    const y0 = Math.min(0, ...ys), y1 = Math.max(...ys), dy = (y1 - y0) || 1;
    const hPx = svg.getBoundingClientRect().height || 300, plotPx = Math.max(80, hPx - 60), need = 14*T.short.length + 16;
    const frac = Math.min(0.75, need/plotPx);
    whPlot.setRange(0, xb, y0 < 0 ? y0 - 0.08*dy : 0, y1 + Math.max(0.12*dy, (y1 - Math.min(0, y0))*frac/(1 - frac)));
    whPlot.drawAxes();
    phs.forEach(ph=>{
      const wh = ph.wh;
      if (!Number.isFinite(wh.a)) return;
      const xa = whPlot.xmin, xe = whPlot.xmax;
      whPlot.line([xa, xe], [1e3*(wh.a + wh.b*xa), 1e3*(wh.a + wh.b*xe)], colorOf(ph.id), 1, '5,4', { label: `${ph.name}: weighted line (isotropic size + strain)`, key: 'wh/' + ph.id });
    });
    const iso = mods.filter(m=> m.kind === 'iso'), shp = mods.filter(m=> m.kind === 'shape');
    if (iso.length) whPlot.points(iso.map(m=> m.x), iso.map(m=> m.y), '#9aa3ad', 3);
    if (shp.length) whPlot.points(shp.map(m=> m.x), shp.map(m=> m.y), '#ff5050', 3);
    pts.forEach(q=>{ if (q.e > 0) whPlot.errbar(q.x, q.y, q.e); });
    phs.forEach(ph=>{ const q = pts.filter(x=> x.ph === ph.id); whPlot.points(q.map(x=> x.x), q.map(x=> x.y), colorOf(ph.id), 4.5); });
    pts.forEach(q=> whPlot.barLabel(q.x, q.y + q.e, q.label, { rot: 0, gap: 8, size: 10 }));
    whPlot._pts = pts;
    $('WhLegend').innerHTML = phs.map(ph=> `<span><i style="background:${colorOf(ph.id)}"></i>${esc(ph.name)}, measured</span>`).join('')
      + (iso.length ? `<span><i style="background:#9aa3ad"></i>isotropic model</span>` : '')
      + (shp.length ? `<span><i style="background:#ff5050"></i>free-shape model</span>` : '');
    noteWH(T);
  }
  // The tests in the plot's corner, kept there through a zoom or a pan (they are the
  // plot's, not the data's); the full text as their tooltip.
  function noteWH(T){
    const svg = $('WhSvg');
    const put = ()=>{
      svg.querySelectorAll('.wh-note').forEach(e=> e.remove());
      if (!whPlot || !T.short.length) return;
      const m = whPlot.margin, NS = 'http://www.w3.org/2000/svg';
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'wh-note');
      const t = document.createElementNS(NS, 'title'); t.textContent = T.full.join('\n'); g.appendChild(t);
      T.short.forEach((line, i)=>{
        const tx = document.createElementNS(NS, 'text');
        tx.setAttribute('x', m.l + 8); tx.setAttribute('y', m.t + 14 + 14*i);
        tx.setAttribute('class', 'wh-note-line');
        tx.textContent = line;
        g.appendChild(tx);
      });
      svg.appendChild(g);
    };
    put();
    if (whPlot){ const was = whPlot._onView; whPlot._onView = ()=>{ if (was) was(); put(); }; }
  }
  // The engine's ticks (each reflection at Kα1 where the refined cell puts it), one
  // row per phase in the phases' order.
  function groupTicks(ticks, list){
    return list.map(q=> ({ name: q.prep.name, color: q.color, tt: ticks.filter(t=> t.phase === q.id).map(t=> t.tt) }));
  }

  // ---- the results, across the card under the pattern: the statistics, then what the
  // worker made of the result — the standard's instrument, or each phase's cell, size,
  // strain (and weight fraction with several phases), a value a line — and beside each
  // phase what its CIF gave and how it is refined ----
  // The Refinement settings a result was refined with that are not the defaults (r.fit,
  // the worker's; none in a result of v428 or older), those that acted on it: the cell
  // search's range on a sample, the zero scan's on the standard, the shape's with a shape.
  function fitUsed(f, r){
    if (!r || !r.fit) return [];
    const fs = fitSettings(r.fit), isS = roleOf(r) ?? std, shaped = Object.values(r.models || {}).some(m=> m && m.shape);
    return FITS.filter(m=> fs[m.k] !== FIT_DEF[m.k] && (m.role !== 'std' || isS) && (m.role !== 'sample' || !isS) && (!m.shape || shaped))
      .map(m=> ({ k: m.k, v: fs[m.k], said: m.said(fs[m.k]) }));
  }
  // What a phase's CIF and settings say, under its name in the results.
  const phaseInfo = q => [`<div class="rv-note rv-set" title="What Refine refines for this phase: Settings… changes it">${esc(summaryOf(q, std))}</div>`]
    .concat(q.prep.notes.length ? [`<div class="rv-note">${esc(q.prep.notes.join('; '))}</div>`] : [])
    .concat(q.prep.warnings.map(w=> `<div class="rv-note" style="color:var(--warn)">⚠ ${esc(w)}</div>`)).join('');
  const group = (title, body, phase) => `<div class="rv-group"><div class="txt-mini${phase ? ' rv-phase-name' : ''}">${title}</div>${body}</div>`;
  function renderResults(f, r){
    const box = $('Results');
    if (!f){ box.innerHTML = `<div class="rv-note rv-wide">${std ? 'No standard loaded: drop its file above.' : 'No pattern.'}</div>`; return; }
    const shown = r && r.params ? (()=>{ try { return curvesOf(f, r).list; } catch(e){ return phasesFor(f); } })() : phasesFor(f);
    if (!r || !r.params){
      const n = phasesFor(f).length;
      box.innerHTML = (n ? `<div class="rv-note rv-wide">Not refined yet. <b>Refine</b> starts from the CIF's cell${std ? ' (the certified one, held fixed)' : ''}, finds where the pattern's peaks are, and refines step by step.</div>`
        : `<div class="rv-note rv-wide">${phases.length ? 'No phase ticked for this pattern: tick one in the list.' : 'No phase: add one from a CIF (+ CIF, beside the pattern).'}</div>`)
        + shown.map(q=> group(esc(q.prep.name), phaseInfo(q), true)).join('');
      return;
    }
    const s = r.stats || {};
    const used = fitUsed(f, r);
    let html = group('Fit', `<div class="pg-stat" title="R_wp: the weighted residual; R_exp: what the counting statistics alone would give">R<sub>wp</sub>: <b>${(s.Rwp*100).toFixed(2)}%</b></div>`
      + `<div class="pg-stat">R<sub>exp</sub>: <b>${(s.Rexp*100).toFixed(2)}%</b></div>`
      + `<div class="pg-stat" title="χ² = Σw(y − y_c)²/(N − P), the reduced χ²: (R_wp/R_exp)²">χ²: <b>${(s.chi2).toFixed(2)}</b></div>`
      + (used.length ? `<div class="rv-note" title="The Refinement settings (Settings…) this result was refined with that are not the defaults">settings: ${esc(used.map(u=> u.said).join(', '))}</div>` : ''));
    // A phase's group gets what its CIF gave under its values; the k-th phase group is the
    // k-th phase refined (by name where they differ).
    const left = shown.slice();
    (r.phaseResults || []).forEach(q=>{
      let info = '';
      if (q.phase){ const i = left.findIndex(x=> x.prep.name === q.name); const ph = i >= 0 ? left.splice(i, 1)[0] : null; if (ph) info = phaseInfo(ph); }
      html += group(esc(q.name), q.lines.map(l=> `<div class="pg-stat"${l.title ? ` title="${esc(l.title)}"` : ''}>${esc(l.label)}: <b>${esc(l.value)}</b></div>`).join('') + info, q.phase);
    });
    left.forEach(q=>{ html += group(esc(q.prep.name), phaseInfo(q), true); });
    // What the refinement could not do (a cell search without a minimum, a phase not
    // detected) is said beside the numbers it qualifies.
    html += (r.warnings || []).map(w=> `<div class="rv-note rv-wide" style="color:var(--warn)">⚠ ${esc(w)}</div>`).join('');
    if (std) html += `<div class="rv-note rv-wide">The samples take this profile, its axial divergence, zero and sin 2θ shift as their instrument's.</div>`;
    else if (r.irf && staleOf(f, r)) html += `<div class="rv-note rv-wide" style="color:var(--warn)">⚠ ${irf() ? 'The standard has been refined again since this result' : 'The standard\'s refinement this result used is gone (cleared, or another standard loaded)'}: its profile, zero and asymmetry are not the ones these numbers rest on. Refine this pattern again, or <b>Refine all</b>.</div>`;
    else if (!r.irf && !r.irfRefused) html += irf() ? `<div class="rv-note rv-wide">No instrumental profile: this pattern was refined before the standard was. Refine it again to correct its widths, and the sizes from them, for the instrument's.</div>`
      : `<div class="rv-note rv-wide">No instrumental profile (refine the standard first: <b>Instrumental standard…</b>): the widths, and the sizes from them, include the instrument's.</div>`;
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

  // ---- the phases: a short list beside the pattern (formula and space group), each
  // ticked for the pattern on show (the standard's: one chosen), and the structure of the
  // one selected ----
  function renderPhases(){
    const el = $('PhaseList'), list = allPhases(), f = host.files()[curIdx()];
    if (!list.some(q=> q.id === sel)) sel = list.length ? (std ? pick : list[0].id) : null;
    el.innerHTML = list.length ? list.map(q=>{
      const builtIn = q === lab6, on = std ? q.id === pick : !(f && q.off[f.name]);
      const pickEl = std
        ? `<input type="radio" name="${p}Pick" data-pick="${q.id}"${on ? ' checked' : ''}${busy ? ' disabled' : ''} title="The phase the standard is refined with" aria-label="Refine the standard with ${esc(q.prep.name)}">`
        : `<input type="checkbox" data-on="${q.id}"${on ? ' checked' : ''}${busy || !f ? ' disabled' : ''} title="Refined on this pattern (each pattern its own)" aria-label="Refine ${esc(q.prep.name)} on this pattern">`;
      return `<div class="rv-cif${q.id === sel ? ' is-sel' : ''}" data-sel="${q.id}" title="${esc(q.prep.name)}${q.file ? ' · ' + esc(q.file) : builtIn ? ' · built in' : ''}">${pickEl}`
        + `<span class="rv-key" style="background:${q.color}"></span><span class="rv-cif-f">${formulaPretty(formulaOf(q.prep))}</span>`
        + `<span class="rv-cif-sg"${q.prep.sgFrom === 'atoms' ? ' title="Found from the atoms: the file is in P1"' : ''}>${esc(sgPretty(q.prep.sg) || '—')}</span>`
        + `<button class="peak-del is-danger idle-dim rv-del" data-del="${q.id}"${builtIn || busy ? ' disabled' : ''} title="${builtIn ? 'Built in: it cannot be removed' : 'Remove phase'}">${X_SVG(13)}</button></div>`;
    }).join('') : `<div class="rv-empty">No phase yet: <b>+ CIF</b> adds one from a crystallographic file (COD, ICSD, Materials Project…).</div>`;
    renderCell();
  }
  // The selected phase's cell in 3D (xrd-cell3d) and its details under it.
  let cellV = null, cellKeyShown = '';
  function renderCell(){
    const q = allPhases().find(x=> x.id === sel) || null, info = $('CellInfo');
    $('CellName').textContent = q ? q.prep.name : '';
    if (!q){ if (cellV) cellV.set(null); cellKeyShown = ''; info.innerHTML = '<div class="rv-empty">Select a phase to see its structure.</div>'; return; }
    if (!cellV) cellV = cellView($('Cell'), { side: ()=> cellSide() });
    const k = q.id + '|' + cellKey(q.prep.cell);
    if (k !== cellKeyShown){ cellKeyShown = k; cellV.set({ name: q.id + q.prep.name, cell: q.prep.cell, atoms: q.prep.atoms }); }
    const P = q.prep, K = P.constraint || {}, c = K.conv && K.basis ? K.conv : P.cell, r4 = v => +(+v).toFixed(4);
    const V = metric(c).V, Vc = metric(P.cell).V;
    // The density: the cell's mass (g/mol) over its volume, 1 g/mol/Å³ = 1.66054 g/cm³.
    const rho = P.mass/Vc*1.66054;
    const els = [...new Set(P.atoms.map(a=> a.element))];
    const lens = K.kind === 'cubic' ? `a = ${r4(c.a)} Å` : `a ${r4(c.a)}, b ${r4(c.b)}, c ${r4(c.c)} Å`;
    const angs = ['alpha', 'beta', 'gamma'].every(x=> Math.abs(c[x] - 90) < 1e-6) ? '' : `α ${r4(c.alpha)}, β ${r4(c.beta)}, γ ${r4(c.gamma)}°`;
    info.innerHTML = `<div class="rv-ci-name">${esc(P.name)}</div>`
      + `<div><span>Formula</span> ${formulaPretty(formulaOf(P))}${P.Z ? `, Z = ${esc(P.Z)}` : ''}</div>`
      + `<div><span>Space group</span> ${esc(sgPretty(P.sg) || '—')}${P.sgFrom === 'atoms' ? ' (from the atoms)' : ''}</div>`
      + `<div><span>System</span> ${SYSTEM_NAMES[P.system] || esc(P.system)}, ${P.order} operations</div>`
      + `<div><span>Cell</span> ${lens}${angs ? '; ' + angs : ''}${K.conv && K.basis ? ' (conventional)' : ''}</div>`
      + `<div><span>Volume</span> ${r4(V)} Å³ · <span>ρ</span> ${rho.toFixed(3)} g/cm³</div>`
      + `<div><span>Atoms</span> ${P.atoms.length} in the cell</div>`
      + `<div class="rv-ci-els">${els.map(e=> `<span><i style="background:${elementColor(e)}"></i>${esc(e)}</span>`).join('')}</div>`
      + `<div class="rv-ci-file">${q === lab6 ? 'built in, the standard\'s certified cell' : esc(q.file)}</div>`;
  }
  // The square's side: the shorter of the box's width and what is left of its height
  // under the details (fitSide sets the box's height to end with the plot).
  function cellSide(){
    const box = $('Cell').closest('.rv-cellbox');
    if (!box) return 0;
    const cs = getComputedStyle(box), w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - box.querySelector('.peak-box-head').offsetHeight - 8;
    return Math.max(80, Math.min(w, h > 0 ? h : w));
  }
  // The column beside the pattern ends where the plot does: its boxes take the height the
  // buttons leave (set by the grid; on a narrow screen, where it sits under the pattern,
  // their own).
  function fitSide(){ if (cellV) cellV.redraw(); }
  async function addCifs(fileList){
    if (busy) return;
    const errs = [];
    let first = null;
    for (const file of fileList){
      try {
        const text = await file.text();
        const prep = prepPhase(text, file.name);
        // The default settings: an isotropic size and strain, the rest off — the CIF's B
        // held, also for a CIF that gives none (v428: one ΔB on nanocrystalline samples
        // came out negative, taking up what the model lacks; RIETVELD.md §8.1). The
        // standard's: its own (the instrument's widths, one ΔB).
        const q = { id: nextId++, cif: text, file: file.name, color: PHASE_COLORS[phases.length % PHASE_COLORS.length], prep, ...(std ? stdSettings() : defSettings()), off: {} };
        phases.push(q);
        if (first == null) first = q.id;
      } catch(e){ errs.push(`${file.name}: ${e.message}`); }
    }
    if (first != null) sel = first;
    draw(true); renderSettings(); host.commit();
    if (errs.length) setStatus('⚠ ' + errs.join(' · '));
  }

  // ---- small UI pieces ----
  function setStatus(t){ $('Status').textContent = t || ''; }
  function showProg(frac){ $('ProgWrap').style.display = ''; $('ProgBar').style.width = Math.max(0, Math.min(1, frac))*100 + '%'; }
  function hideProg(){ $('ProgWrap').style.display = 'none'; $('ProgBar').style.width = '0%'; }
  function syncButtons(){
    const fs = host.files(), f = fs[curIdx()];
    $('Refine').textContent = busy ? 'Cancel' : 'Refine';
    $('Refine').disabled = !busy && !f;
    $('RefineAll').disabled = busy || std || !fs.length;
    $('Settings').disabled = busy;
    $('Clear').disabled = busy || !(f && results[f.name]);
    $('ClearAll').disabled = busy || std || !Object.keys(results).length;
    // (the phases are read when a run starts: one added meanwhile would not be in it)
    $('AddCif').disabled = busy;
    syncSettings();
  }

  /* ---- the settings (a modal from Settings…, beside Refine): each phase's fitting modes,
     a row each (MODES), and where Refine starts (HOLDS). A change applies at once, to the
     next refinements (the results there keep theirs), and is a step of the undo history.
     The standard's card has its own: its phases', its start and its Refinement. ---- */
  const setModal = document.createElement('div');
  setModal.className = 'modal-backdrop';
  setModal.style.display = 'none';
  setModal.innerHTML = `<div class="modal-box rvs-box" role="dialog" aria-modal="true" aria-labelledby="${p}SetTitle" tabindex="-1">
      <h3 class="txt-head" id="${p}SetTitle" style="margin:0 0 4px">Fitting settings${std ? ': instrumental standard' : ''}</h3>
      <p class="txt-meta" style="margin:0 0 6px">What <b>Refine</b> refines, on each phase${std ? ' of the standard' : ''}. A change applies to the next refinement.</p>
      <div class="rvs-body"></div>
      <button class="btn primary" type="button" data-done style="width:100%;margin-top:16px">Done</button>
    </div>`;
  document.body.appendChild(setModal);
  const setBody = setModal.querySelector('.rvs-body');
  let setKey = '', rebuilding = false;
  let fitNote = null;        // the Refinement section's note, when an entry was not taken
  const setOpen = () => setModal.style.display === 'flex';
  const phaseOf = id => allPhases().find(q=> q.id === id);
  // The settings that apply to this card: the samples' (a cell search), the standard's (a
  // zero scan).
  const fitsHere = FITS.filter(m=> !m.role || m.role === (std ? 'std' : 'sample'));
  // Why a mode does not apply to a phase (its checkbox and depth disabled), or ''.
  const naOf = (q, k) => std && k === 'occ' ? "The standard's structure is certified: its occupancies are the CIF's"
    : std && STD_NA.includes(k) ? "The standard's widths are the instrument's profile (U, V, W, X, Y and the asymmetry, refined on it): no size, strain or faults of its own"
    : k === 'wppm' && !q.on.size ? 'WPPM is a profile of the crystallite size: switch the size on first'
    : k === 'occ' && siteList(q).length < 2 ? "A phase of one site: its occupancy is the scale, which the pattern cannot tell from it" : '';
  function openSettings(){
    if (busy || setOpen()) return;
    setModal.style.display = 'flex'; $('Settings').classList.add('is-on');
    setKey = ''; fitNote = null; renderSettings();
    // (capture, and stopped there: a window under this one, the standard's, closes on its own Escape)
    document.addEventListener('keydown', onSetKey, true);
    setModal.querySelector('.modal-box').focus();
  }
  function closeSettings(){
    if (!setOpen()) return;
    // (the focus back on the button, when it was in the box: a keyboard user goes on from there)
    const inBox = setModal.contains(document.activeElement);
    setModal.style.display = 'none'; $('Settings').classList.remove('is-on');
    document.removeEventListener('keydown', onSetKey, true);
    if (inBox && !$('Settings').disabled) $('Settings').focus();
  }
  function onSetKey(e){ if (e.key === 'Escape'){ e.stopPropagation(); closeSettings(); } }
  // Built again only when the phases on show change (one added or removed by an undo);
  // otherwise the inputs are set in place, keeping the focus.
  function renderSettings(){
    if (!setOpen()) return;
    const list = allPhases();
    const key = list.map(q=> [q.id, q.color, q.prep.name].join()).join('|');
    if (key !== setKey){
      setKey = key;
      const sec = q => `<div class="rvs-sec" data-sec="${q.id}"><div class="rvs-head"><span class="rv-key" style="background:${q.color}"></span><b>${esc(q.prep.name)}</b>${q === lab6 ? '<span class="txt-meta">built in</span>' : ''}</div>`
        + MODES.map(m=>{ const id = `${p}Set${q.id}_${m.k}`;
          return `<div class="rvs-row" data-row="${m.k}"><input type="checkbox" id="${id}" data-on="${m.k}" data-ph="${q.id}"><label for="${id}">${m.label}</label>`
            + `<select data-depth="${m.k}" data-ph="${q.id}" aria-label="${esc(m.label)} of ${esc(q.prep.name)}: depth">${listOf(q, m).map(([v, t])=> `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></div>`; }).join('') + '</div>';
      // The hold boxes two to a row, in the phases' columns: the first under their
      // checkboxes, the second under their depths.
      const hb = ([k, t, title]) => `<input type="checkbox" id="${p}Hold_${k}" data-hold="${k}" title="${esc(title)}"><label for="${p}Hold_${k}" title="${esc(title)}">${t}</label>`;
      const pairs = []; for (let i = 0; i < HOLDS.length; i += 2) pairs.push(HOLDS.slice(i, i + 2));
      const html = (list.length ? list.map(sec).join('') : `<div class="rv-empty">No phase yet: <b>+ CIF</b> adds one.</div>`)
        + `<div class="rvs-sec rvs-start"><div class="rvs-head"><b>Start</b></div>`
        + `<div class="rvs-chips"><button type="button" class="mode-chip rvs-chip" data-start="cif" title="The full staged refinement from the CIF's cell: the cell search, then each group of parameters in turn">From the CIF</button>`
        + `<button type="button" class="mode-chip rvs-chip" data-start="last" title="From each pattern's last result, the groups ticked below held there">From the last result</button></div>`
        + pairs.map(([a, b])=> `<div class="rvs-row rvs-hold">${hb(a)}${b ? `<span class="rvs-hold2">${hb(b)}</span>` : ''}</div>`).join('')
        + `<div class="rvs-note" title="${esc(START_RULE)}">Held: a group ticked, at the last result's values, unless its option changed since (then refined from its usual start); the rest refined from there. No last result, or other phases or cells: from the CIF.</div></div>`
        + `<div class="rvs-sec rvs-fit"><div class="rvs-head"><b>Refinement</b><button type="button" class="btn rvs-def" data-fit-def title="Every Refinement setting back to the engine's default">Defaults</button></div>`
        + fitsHere.map(fitRow).join('') + `<div class="rvs-note" data-fit-note></div></div>`;
      // (a field focused while the body is rebuilt fires a last change on its way out: ignored)
      rebuilding = true; setBody.innerHTML = html; rebuilding = false;
    }
    syncSettings();
  }
  /* A Refinement setting's row, in the phases' columns: a field under their depths (its
     range beside it), or, for the 1/2θ term, its value as a checkbox under theirs and
     "automatic" under the depths (the value locked, showing what automatic gives). */
  function fitRow(m){
    const id = p + 'Fit_' + m.k;
    return m.bool
      ? `<div class="rvs-row" data-fit-row="${m.k}"><input type="checkbox" id="${id}" data-fit="${m.k}"><label for="${id}">${m.label}</label>`
        + `<span class="rvs-cell"><input type="checkbox" id="${id}Auto" data-fit-auto="${m.k}"><label for="${id}Auto">automatic</label></span></div>`
      : `<div class="rvs-row" data-fit-row="${m.k}"><span></span><label for="${id}">${m.label}</label>`
        + `<span class="rvs-cell"><input type="text" inputmode="decimal" autocomplete="off" id="${id}" data-fit="${m.k}" aria-label="${esc(m.label)}, ${m.rule}"><span class="rvs-range">${m.range}</span></span></div>`;
  }
  function syncSettings(){
    if (!setOpen()) return;
    setBody.querySelectorAll('[data-sec]').forEach(secEl=>{
      const q = phaseOf(+secEl.dataset.sec); if (!q) return;
      MODES.forEach(m=>{
        const row = secEl.querySelector(`[data-row="${m.k}"]`), cb = row.querySelector('input'), sl = row.querySelector('select'), na = naOf(q, m.k);
        cb.checked = !!q.on[m.k]; sl.value = depOf(q, m.k);
        cb.disabled = busy || !!na; sl.disabled = busy || !!na || !q.on[m.k];
        row.classList.toggle('is-na', !!na);
        // (the standard's B: why one ΔB is its default — LAB6_CIF's numbers)
        row.title = cb.title = sl.title = na || (std && m.k === 'adp' ? m.title + ". On the standard, one ΔB is the default: held, a B 0.1 Å² off moved the profile's X by 10 esd, the profile taking up the intensities' fall with angle" : m.title);
      });
    });
    setBody.querySelectorAll('[data-start]').forEach(b=>{ const on = b.dataset.start === startFrom; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); b.disabled = busy; });
    setBody.querySelectorAll('[data-hold]').forEach(cb=>{ cb.checked = hold.includes(cb.dataset.hold); cb.disabled = busy || startFrom !== 'last'; });
    setBody.querySelectorAll('.rvs-hold').forEach(r=> r.classList.toggle('is-off', startFrom !== 'last'));
    syncFit();
  }
  // What the automatic 1/2θ term gives for the pattern on show (buildModel's rule).
  function autoInv(){
    const f = host.files()[curIdx()];
    if (!f) return { on: false, why: '' };
    const x0 = scanRange(f)[0], on = x0 > 0 && x0 < 20;
    return { on, why: ` Here automatic gives ${on ? 'on' : 'off'}: ${f.label} starts at ${fitTxt(+x0.toFixed(2))}°.` };
  }
  // The Refinement section as the settings are: each field its value (the default when
  // not set), a field being typed in left as it is.
  function syncFit(){
    const fs = fitSettings(fit), ai = autoInv();
    fitsHere.forEach(m=>{
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
      const q = phaseOf(+d.ph); if (!q) return;
      if (d.on) q.on[d.on] = t.checked;
      else if (listOf(q, MODE[d.depth]).some(([v])=> v === t.value)) q.dep[d.depth] = t.value;
    }
    host.commit(); draw(true); syncSettings();
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
  setModal.querySelector('[data-done]').onclick = closeSettings;
  $('Settings').onclick = ()=> setOpen() ? closeSettings() : openSettings();

  $('AddCif').onclick = ()=> $('CifInput').click();
  $('CifInput').addEventListener('change', e=>{ const fl = [...e.target.files]; e.target.value = ''; if (fl.length) addCifs(fl); });
  $('PhaseList').addEventListener('click', e=>{
    const del = e.target.closest('[data-del]');
    if (del){
      if (busy || del.disabled) return;
      const id = +del.dataset.del;
      phases = phases.filter(q=> q.id !== id);
      if (pick === id) pick = 0;
      // A result refined with the phase is no longer the model's: it goes with it.
      Object.keys(results).forEach(k=>{ if ((results[k].phases || []).includes(id)) delete results[k]; });
      draw(true); renderSettings(); host.commit();
      if (std && host.changed) host.changed();
      return;
    }
    if (e.target.closest('input')) return;
    const row = e.target.closest('[data-sel]');
    if (!row || +row.dataset.sel === sel) return;
    sel = +row.dataset.sel;
    renderPhases();
  });
  $('PhaseList').addEventListener('change', e=>{
    const t = e.target;
    if (busy) return;
    if (t.dataset.pick != null){ pick = +t.dataset.pick; draw(true); host.commit(); return; }
    if (t.dataset.on != null){
      const q = phases.find(x=> x.id === +t.dataset.on), f = host.files()[curIdx()];
      if (!q || !f) return;
      if (t.checked) delete q.off[f.name]; else q.off[f.name] = true;
      draw(true); host.commit();
    }
  });
  $('Refine').onclick = ()=>{
    if (busy){ cancelled = true; if (cancelJob) cancelJob(); return; }
    const f = host.files()[curIdx()]; if (f) refine([f]);
  };
  $('RefineAll').onclick = ()=> refineAll();
  $('Clear').onclick = ()=>{ const f = host.files()[curIdx()]; if (!f || busy || !results[f.name]) return; delete results[f.name]; draw(true); host.commit(); if (std && host.changed) host.changed(); };
  // Every pattern's result, those of the files left out too (an undo brings them back).
  $('ClearAll').onclick = ()=>{ if (busy || !Object.keys(results).length) return; results = {}; draw(true); host.commit(); if (std && host.changed) host.changed(); };
  if (!std){
    $('Prev').onclick = ()=> host.step(-1);
    $('Next').onclick = ()=> host.step(1);
    $('Std').onclick = ()=> host.openStd();
  }

  let csvPre = '';           // the downloads' names: the card's, then the file's
  return {
    // After any change to the files: the card follows them; results of files no
    // longer loaded go.
    refresh(preserve){
      const fs = host.files();
      if (!fs.length) closeSettings();
      const names = new Set(host.allFiles().map(f=> f.name));
      Object.keys(results).forEach(k=>{ if (!names.has(k)) delete results[k]; });
      draw(preserve);
      renderSettings();
    },
    redraw(){ draw(true); },
    // The standard's profile for the samples (the standard's card).
    irf: ownIrf,
    destroy(){ closeSettings(); setModal.remove(); if (cellV) cellV.destroy(); solidViews.forEach(({ view })=> view.destroy()); },
    // Each phase's settings (on, dep) and the patterns it is not refined on, and beside them
    // the options as v428 named them (engineOf), which an older version opening the
    // project reads.
    snapshot(){ return { phases: phases.map(q=>{ const e = engineOf(q, std);
        return { id: q.id, cif: q.cif, file: q.file, color: q.color, on: { ...q.on }, dep: { ...q.dep }, off: { ...q.off },
          shape: e.shape, po: e.po || '', profile: e.profile, strain: e.strain, faults: e.faults || '', adp: e.adp, occ: e.occ || null }; }),
      ...(std ? { std: { on: { ...lab6.on }, dep: { ...lab6.dep } }, pick } : {}), start: startFrom, hold: hold.slice(), fit: { ...fit },
      nextId, sel, results: JSON.parse(JSON.stringify(results)) }; },
    restore(s){
      s = s || {};
      // A project of v428 or older has the options without the flags (migrateSettings).
      phases = (s.phases || []).flatMap(q=>{ try { return [{ id: q.id, cif: q.cif, file: q.file, color: q.color,
        ...(q.on ? cleanSettings(q, std ? stdSettings() : defSettings()) : migrateSettings(q, s.refineB)), prep: prepPhase(q.cif, q.file),
        off: q.off && typeof q.off === 'object' ? Object.fromEntries(Object.keys(q.off).filter(k=> q.off[k]).map(k=> [k, true])) : {} }]; } catch(e){ return []; } });
      if (std){
        // (the rows that do not apply to the standard stay off, whatever a file says)
        Object.assign(lab6, s.std ? cleanSettings(s.std, stdSettings()) : stdSettings());
        [lab6, ...phases].forEach(q=> STD_NA.forEach(k=> { q.on[k] = false; }));
        pick = phases.some(q=> q.id === s.pick) ? s.pick : 0;
      }
      startFrom = s.start === 'last' ? 'last' : 'cif';
      hold = Array.isArray(s.hold) ? HOLD_KEYS.filter(k=> s.hold.includes(k)) : HOLD_DEFAULT.slice();
      // (a project of v428 or older has none: the defaults; a note on an entry not taken
      // is about the settings before)
      fit = cleanFit(s.fit); fitNote = null;
      nextId = s.nextId || phases.reduce((m, q)=> Math.max(m, q.id + 1), 1);
      sel = Number.isInteger(s.sel) ? s.sel : null;
      results = s.results ? JSON.parse(JSON.stringify(s.results)) : {};
      setKey = '';
      syncButtons();
    },
    // The CSVs: every refined pattern's curves, and one row per pattern and phase.
    csvEntries(pre){ return csvEntries(pre || ''); },
    setName(n){ csvPre = n ? n + ' - ' : ''; nameFiles(); },
  };

  // The downloads named after the card.
  function nameFiles(){
    const set = (b, name)=>{ if (b) b.dataset.csvNames = name; };
    root.querySelectorAll('[data-csv-base]').forEach(b=> set(b, csvPre + b.dataset.csvBase));
    root.querySelectorAll('.plot-dl-btn[data-dl-base]').forEach(b=> b.dataset.dlName = csvPre + b.dataset.dlBase);
    root.querySelectorAll('.plot-wrap').forEach(w=>{ const d = w.querySelector('.plot-dl-btn[data-csv-base]'), c = w.querySelector('.plot-csv-btn'); if (d && c) c.dataset.csvNames = d.dataset.csvNames; });
  }
  function csvEntries(pre){
    const out = [], fs = host.files().filter(f=> results[f.name] && results[f.name].params);
    if (!fs.length) return out;
    const cols = [];
    fs.forEach(f=>{
      let c; try { c = curvesOf(f, results[f.name]).c; } catch(e){ return; }
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
      if (staleOf(f, r)) s += csvLine([f.label, '', 'standard_changed_since', '1', '', num(st.Rwp*100, 3), num(st.Rexp*100, 3), num(st.chi2, 3)]);
      // The Refinement settings it was refined with, those not the defaults (as the card
      // says them): the engine's values and units (cellRange a fraction, bgInv 1 or 0), in
      // full, with the export's decimal mark.
      fitUsed(f, r).forEach(u=> s += csvLine([f.label, '', 'fit_' + u.k, typeof u.v === 'boolean' ? (u.v ? '1' : '0') : fitTxt(u.v).replace('.', settings.decimal), '', num(st.Rwp*100, 3), num(st.Rexp*100, 3), num(st.chi2, 3)]));
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
        pk += csvLine([f.label, ph.name, w.plain, num(w.tt, 5), num(w.rel, 4), num(w.H, 5), num(w.Hesd, 5), num(w.eta, 3), lim ? num(w.HsMax, 5) : num(w.Hs, 5), lim ? '' : num(w.HsEsd, 5), num(w.D, 4), num(w.Desd, 4), w.flat ? '' : num(w.dd, 6), w.flat ? '' : num(w.ddEsd, 6), num(w.model.iso, 5), ph.shaped ? num(w.model.shape, 5) : '', skip ? 'no' : 'yes', note]);
      }));
    });
    if (anyPk) out.push({ name: pre + 'rietveld_peaks.csv', text: pk });
    return out;
  }
}

/* The card's markup (and the standard's window's: the same, with one pattern and one
   phase chosen): the pattern with the phases and the structure beside it, the buttons
   under them ending with the plot; the results across under it; then the peak widths,
   the Williamson–Hall plot and the crystallites' shape in one row. */
function rvHtml(p, std){
  return `
        <div class="rv-top">
          <div class="plot-nav-row rv-nav">
            <div class="plot-nav-left">${std ? '' : `
              <button class="btn nav-arrow an-prev" id="${p}Prev" aria-label="Previous sample" title="Previous sample (&#8592;)">&#8249;</button>
              <span id="${p}Idx" class="pill nav-count" style="margin:0">1/1</span>
              <button class="btn nav-arrow an-next" id="${p}Next" aria-label="Next sample" title="Next sample (&#8594;)">&#8250;</button>`}
              <span class="txt-caption" id="${p}Label">—</span>
            </div>
          </div>
          <div class="rv-plot">
            <div class="plot-wrap">
              <svg class="plot" id="${p}Svg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-base="rietveld_pattern.csv" data-csv-names="rietveld_pattern.csv" data-dl-base="XRPD_rietveld.svg" data-dl-name="XRPD_rietveld.svg" data-dl-legend="${p}Legend">${DL_SVG}</button>
            </div>
          </div>
          <div class="rv-under">
            <div id="${p}Legend" class="legend"></div>
            <p class="txt-meta" id="${p}Instr"></p>
          </div>
          <div class="rv-side">
            <div class="rv-boxes">
              <div class="peak-box rv-cifs">
                <div class="peak-box-head">
                  <span class="txt-mini">Phases</span>
                  <button class="btn rv-addcif" id="${p}AddCif" title="Add a phase from a CIF file">+ CIF</button>
                  <input type="file" id="${p}CifInput" accept=".cif,.CIF" multiple style="display:none">
                </div>
                <div class="rv-ciflist" id="${p}PhaseList"></div>
              </div>
              <div class="peak-box rv-cellbox">
                <div class="peak-box-head"><span class="txt-mini">Structure</span><span class="rv-cell-name" id="${p}CellName"></span></div>
                <div class="rv-cell" id="${p}Cell"></div>
                <div class="rv-cell-info" id="${p}CellInfo"></div>
              </div>
            </div>
            <div id="${p}Status" class="txt-meta rv-status"></div>
            <div id="${p}ProgWrap" class="rv-prog" style="display:none"><div id="${p}ProgBar"></div></div>
            <div class="rv-btns">
              <button class="btn primary" id="${p}Refine">Refine</button>
              <button class="btn primary" id="${p}RefineAll"${std ? ' title="The standard is one pattern: Refine refines it"' : ''}>Refine all</button>
            </div>
            <div class="rv-btns">
              <button class="btn" id="${p}Settings" aria-haspopup="dialog" title="What Refine refines, for each phase, and where it starts">Settings…</button>${std ? '' : `
              <button class="btn" id="${p}Std" aria-haspopup="dialog" title="The instrumental standard: its file, its phase and its refinement, whose profile every sample takes">Instrumental standard…</button>`}
            </div>
            <div class="rv-btns">
              <button class="btn" id="${p}Clear" title="This pattern's result">Clear</button>
              <button class="btn" id="${p}ClearAll" title="Every pattern's result"${std ? ' disabled' : ''}>Clear all</button>
            </div>
          </div>
        </div>
        <div class="peak-box rv-fit">
          <div class="peak-box-head"><span class="txt-mini">Refinement</span></div>
          <div class="rv-fit-grid" id="${p}Results"></div>
        </div>
        <!-- The peaks' own widths: each reflection fitted alone, and the tests on them -->
        <div id="${p}Widths" class="rv-widths" style="display:none">
          <div class="rv-wrow">
            <div class="peak-box rv-wtable">
              <div class="peak-box-head">
                <span class="txt-mini">Peak widths</span>
                <button class="btn table-csv-btn" data-csv-mod="xrd" data-csv-base="rietveld_peaks.csv" data-csv-names="rietveld_peaks.csv" title="Download CSV">${CSV_SVG}</button>
              </div>
              <div id="${p}PkWrap"></div>
            </div>
            <div class="rv-wh">
              <p class="txt-caption">Williamson–Hall</p>
              <div class="plot-wrap">
                <svg class="plot" id="${p}WhSvg"></svg>
                <button class="btn plot-dl-btn" data-dl-svg="${p}WhSvg" data-csv-mod="xrd" data-csv-base="rietveld_peaks.csv" data-csv-names="rietveld_peaks.csv" data-dl-base="XRPD_williamson_hall.svg" data-dl-name="XRPD_williamson_hall.svg" data-dl-legend="${p}WhLegend">${DL_SVG}</button>
              </div>
              <div id="${p}WhLegend" class="legend"></div>
            </div>
            <div class="peak-box rv-solids" id="${p}Solids" style="display:none"></div>
          </div>
        </div>`;
}
