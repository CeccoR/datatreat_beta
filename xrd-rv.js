/* =========================================================
   XRPD — the Rietveld card (page side).
   The phases come from CIFs (the standard's LaB6 is built in); the refinement runs in
   a module worker (xrd-rietveld.worker.js) on xrd-rietveld.js, and its result is kept
   per pattern, by file name, so moving, leaving out or reloading files never puts it
   on another pattern. The curves drawn from it are kept by the pattern (curvesKept), made
   again from the refined parameters only where what they are made from changed.
   The calculations, which touch no page, are xrd-rv-model.js's; the words and markup that
   need no page, xrd-rv-html.js's.
========================================================= */
import { fmtData, csvLine, X_SVG, DL_SVG as DL_ICON, downloadBytes, flashFieldInvalid, settings, fitCsvIcons, maxArr, barNames, barChipYmax, NORM_OPTIONS, normOf, confirmModal, keeper } from './utils.js';
import { fileSafe } from './cards.js';
import { Plot } from './plot.js';
import { decodeText } from './textdata.js';
import { fitSettings } from './xrd-rietveld.js';
import { shapeView } from './xrd-shape3d.js';
import { cellView } from './xrd-cell3d.js';
import { PHASE_COLORS, prepPhase, prepOf, cellKey, defSettings, stdSettings, listOf, depOf, MODE, HOLD_KEYS, HOLD_DEFAULT, FIT_DEF, FIT, fitTxt, readFit, cleanFit,
  SIZE_KINDS, hklShow, plotRuns, instrOf, LAB6_ID, irfOf, sameIrf, payloadFor, resultRecord, resultPhases, curvesFrom, exactJson, scanRange, tickRows, groupTicks,
  sizeKinds, sizeMarks, fitUsed, csvTables, rowsFor, fitShown, naOf, autoInvOf, fitRefusal, stateOf, readState, resultsOf } from './xrd-rv-model.js';
import { esc, barIdx, solidCaption, instrLine, group, warnNote, fitLineHtml, phaseRowsHtml, cellDetailsHtml, settingsBodyHtml, widthsTableHtml, testsHtml } from './xrd-rv-html.js';
import { lanes } from './xrd-rv-pool.js';

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
// The name its CIF is downloaded under (the list's download button: cifFile).
const LAB6_FILE = 'LaB6_NIST-SRM-660c.cif';
/* A view (the pattern's plot, the widths' table and plot, the Results' charts, a list, a
   box of text) is drawn again only when what it is drawn from changed: a plot keeps the
   key of its inputs as last drawn, a box of markup the markup it was given. In a key an
   object is a number of its own (idOf: the same object, the same number; a pattern's
   arrays never change, xrd.js), a result is when it was refined (resKey: an undo gives
   back the same as a copy), and a plot's size on the page is there (sizeOf: 0 out of
   sight, so one drawn hidden is drawn again when shown). Up to v490 every edit drew the
   whole card again (a setting changed: its plots, tables and 3D cell, 55 ms with 12
   patterns), and a label changed every card. A value that is no object, which a project
   read in may hold where one should be (a result or a file's instrument a number), is
   there as itself: a WeakMap takes no such key (it threw in the restore, which drew such
   a project before). */
const ids = new WeakMap();
let nid = 0;
const idOf = o => o == null ? '-' : typeof o !== 'object' && typeof o !== 'function' ? typeof o + ':' + String(o) : ids.get(o) || (ids.set(o, ++nid), nid);
const resKey = r => !r ? '-' : Number.isFinite(r.at) ? 'at' + r.at : 'r' + idOf(r);
const sizeOf = el => { if (!el) return '-'; const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
// (a plot at the range it was drawn with: not zoomed nor panned)
const atOrigin = P => P.xmin === P._origXmin && P.xmax === P._origXmax && P.ymin === P._origYmin && P.ymax === P._origYmax;
/* A refined pattern's curves (the calculated, its background and the reflections' ticks),
   its difference (observed less calculated, under the plot) and its net pattern (observed
   less background, the Results' stacked plot), kept by its intensities (utils.js keeper:
   while a state, a tab asleep or a history holds the pattern) under all they are made
   from: the 2θ and variance factors (the same arrays: fixed, xrd.js), the instrument, all
   the curves take from the result (exactly: a NaN is not a null, nor −0 0; a result read
   back by an undo is a copy, the same), each phase's structure (its prep, one object for
   one CIF text: prepOf; the standard's LaB6, one for the page) and colour, and the role.
   A tab woken, an undo, a redraw or the CSVs take them as drawn before: to b2v3 a card kept
   the last pattern drawn and the Results' last 64, and a tab woken made all again (an XRPD
   tab of 12 refined patterns, 115 ms of its wake). */
const curvesKept = keeper('xrd-curves'), diffKept = keeper('xrd-difference'), netKept = keeper('xrd-net');
// (and a pattern not refined, its phases' reflections where its cells put them: tickRows,
// by the 2θ, the instrument and the phases)
const ticksKept = keeper('xrd-ticks');
const curveKey = (f, r, list, std) => exactJson([idOf(f.x), idOf(f.varMul), instrOf(f), [r.params, r.models, r.textures, r.fit, r.phases, r.cells],
  list.map(q=> [q.id, idOf(q.prep), q.color]), !!std]);
// The standard's LaB6 as read, one for every card (its curves' key holds it by identity).
let lab6Prep = null;
const LAB6_PREP = ()=> lab6Prep || (lab6Prep = Object.assign(prepPhase(LAB6_CIF, 'LaB6 (NIST SRM 660c)'),
  // (written in P1 here only to be short: nothing to report)
  { name: 'LaB₆ (NIST SRM 660c)', notes: [] }));

const DL_SVG = '<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="15"/><polyline points="7 10.5 12 15.5 17 10.5"/><line x1="5" y1="20" x2="19" y2="20"/></svg>';
const CSV_SVG = '<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><text x="12" y="11" font-size="8.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" style="font-family:sans-serif">CSV</text><line x1="6" y1="18" x2="15" y2="18"/><polyline points="12.5 15.5 16 18 12.5 20.5"/></svg>';

// The card's instructions (cards.js shows them under its title).
export const RV_INFO = `Whole-pattern Rietveld refinement. Each phase comes from a CIF, dropped on <b>Phases</b> beside the pattern or selected with a click there (its drop zone while there is no phase, then <b>+ CIF</b> at the list's foot; several at once), the list giving each its formula and space group: its cell, its atoms and the symmetry the structure has. A file in P1, as Materials Project gives them, has its symmetry found from the atoms, so that a cubic cell is refined by <i>a</i> alone (a primitive cell of a centred lattice through its conventional cell, whose <i>a</i> and <i>V</i> are the ones reported), and its space group read off those operations; a file with its own operations is checked against its formula and Z (an origin-choice mix-up shows there). A phase's tick in the list says whether it is refined on the pattern on show: every pattern has them all at first, and each its own. The download button left of a phase's × (which removes it) saves its CIF under the file's name: its text as read, in UTF-8 whatever the file's encoding; it changes nothing, and works while a refinement runs, when the × and the tick are disabled until it ends (the run refines the phases it started with). A click on a phase shows its unit cell beside the list, in 3D (drag it to turn it, a double click puts it back), with its details under it; with no phase that box is empty. The instrumental standard (<b>Instrumental standard…</b>) is a file of its own, refined in its own window against the built-in LaB₆ (NIST SRM 660c, <i>a</i> = 4.156826 Å, held fixed) or a CIF of the standard's: its zero and its peak shape — the Thompson–Cox–Hastings pseudo-Voigt, Gaussian width² = U·tan²θ + V·tanθ + W and Lorentzian width = X·tanθ + Y/cosθ, made asymmetric by the axial divergence (through the Soller slits the file gives, Cheary–Coelho's full axial model, with the sample's and receiver's axial length L refined; without Sollers, Finger–Cox–Jephcoat's one parameter (S+H)/L: the tail of the low-angle peaks towards lower angles) — and a shift of 2θ as sin 2θ, the form of the sample's transparency, beside the zero and the displacement, become the instrument's, and each sample refines only its own broadening on top of them: a Lorentzian Y<sub>s</sub>/cosθ, which gives the crystallite size (D = Kλ/Y<sub>s</sub>, Y<sub>s</sub> in radians, K = 0.9 as in the Scherrer analysis), and X<sub>s</sub>·tanθ = 4ε·tanθ, the microstrain. The pattern is computed from Kα₁ and Kα₂ at the file's wavelengths and ratio, the Bragg–Brentano Lorentz–polarisation factor (with a monochromator only when the file has one), |F|² from the atoms (Waasmaier–Kirfel form factors with Chantler's anomalous terms), a Chebyshev background and a specimen displacement per sample; each point weighs by its counts (1/σ², σ² the counts times the attenuation). <b>Refine</b> starts from the CIF's cell, finds where the pattern's peaks are by scaling that cell, then frees the parameters stage by stage; <b>Refine all</b> does every pattern. With no refined standard they ask first, in a window over the page: refine the standard first (as its window's <b>Settings…</b> are) and then the samples, refine without it, or neither; with none loaded, load one. While the standard refines no sample does, and the other way round, so that a batch takes one instrumental profile throughout; its run shows on every card's <b>Instrumental standard…</b> (a spinner, and its progress along the button's foot), its window closed or open. <b>Settings…</b> (read only while a refinement runs) decides what Refine refines: for each phase each of the models below switched on or off and, when on, how deep (the size and the microstrain can be off too). It also sets where Refine starts: from the CIF, as above, or from each pattern's last result, with the groups of parameters ticked held at its values (whatever is new or changed since is refined) — a shape fitted, say, then held while B per site is refined. Its <b>Refinement</b> section sets, for every pattern, the least squares and the searches: the iterations allowed, the shift tolerance and the starting damping, the background's Chebyshev degree and its 1/2θ term (automatic: on when the scan starts below 20°), the cell search's range, and the free shape's trial starts, each result saying which it was refined with when they are not the defaults. Its <b>Results</b> section sets how the patterns stacked in the card's section of the Results are normalised: to the largest (global), each to its own maximum (local), or as they are (none). <b>Clear</b> removes this pattern's result, <b>Clear all</b> every pattern's. With several phases each gets its weight fraction (Hill–Howard, of the crystalline part). A phase is reported <i>not detected</i>, and left out of the refinement, when its scale is not above 3 esd, or when it is significant only through intensity under another phase's peaks with no part of the pattern its own (a candidate impurity whose lines fall on the main phase's would otherwise take up whatever misfit those peaks leave). The same CIF added twice gives two size populations of one phase. <b>Size profile</b> (with a refined standard): <i>Lorentzian</i>, a Lorentzian of the right breadth read with Scherrer's K; or <i>WPPM</i> (Whole Powder Pattern Modelling, Scardi &amp; Leoni), each line synthesised as the Fourier transform of the product of the instrument's, the size's, the strain's and the faults' coefficients — the size's being the crystallites' own common-volume function (a sphere's, or a free solid's along each member of the family), so the dimensions are the true ones and the profile's shape counts too. With <i>log-normal sizes</i> the coefficients are averaged over a distribution of width σ (of ln D): the size read is the volume-weighted mean (what the breadth measures), with the median and the number-weighted mean beside. <b>Microstrain</b>: isotropic, or <i>anisotropic</i> (Stephens: ε² a quartic form of the reflection's direction that the Laue group leaves unchanged; given as its rms and along the low-index planes' normals). <b>Planar faults</b> (after Warren): faults on a family of planes, each displacing the crystal by a vector of a family (those in the plane), the probability per plane refined: reflections whose h·R is not an integer broaden, by parity rather than by order. <b>Displacement parameters</b>: the CIF's held (0.5 Å² where it has none); one ΔB added to all of a phase's B; one B per crystallographic site (the sites from the symmetry found); or the anisotropic U<sup>ij</sup> per site, only those the site's symmetry leaves free, with B<sub>eq</sub>. Each is strongly correlated with the scale, and so with the weight fractions, with the background and, on broad peaks, with the widths: they want data to high angle. <b>Site occupancy</b>: the occupancy of one of the phase's sites refined — how strongly the site scatters against its species at full occupancy, alike at every angle (a B lowers it more the higher the angle): under 1, atoms missing (vacancies, a depleted surface) or a lighter species beside them; over 1, a heavier one. The weight fractions use the cell's mass at the refined occupancy. Every site at once would be the scale again, so a phase of one site has none to refine; the standard's structure is certified. <b>Preferred orientation</b>: March–Dollase, each reflection's members weighed by (r²·cos²α + sin²α/r)<sup>−3/2</sup>, α their angle to the normal of the chosen planes (hkl) — r under 1 when such planes lie preferentially parallel to the sample's surface (plates), over 1 when they do not (needles); <i>best axis</i> tries the low-index planes and keeps the lowest χ². For a cubic phase r has no first-order effect at 1, so it is refined from 0.8 and from 1.25 and the better kept. It changes the intensities, not the widths: an intensity misfit left in is otherwise taken up by a free shape, which widens or narrows peaks to fit it (on a SrTiO<sub>3</sub> whose Sr site scatters 0.7 of a full one, with that site held full the plates came out ⟂ ⟨310⟩; with its occupancy refined, ⟂ ⟨110⟩, as the crystals are). <b>Crystallite shape</b> (with a refined standard): the isotropic size, or a free solid — an <i>ellipsoid</i> of any proportions, a <i>spheroid</i> (two axes equal), a <i>cylinder</i>, an <i>elliptic cylinder</i> (an ellipse translated along its axis), a <i>box</i> or a <i>square-based box</i> (two edges equal: a square plate or rod) —, in any orientation. A shape that breaks the crystal's symmetry (a disc normal to one ⟨110⟩ of a cubic phase) gives the reflections of one family different widths, so each is drawn with its own and the peak is their sum; its width follows the solid's volume-weighted column length along it (Stokes &amp; Wilson), in closed form for each solid (the faces rounded off over 2° of direction during the search only: the result is the exact solid's). The fit starts from several shapes (the sphere, plates and needles along the low-index directions, slightly tilted, and random ones) and keeps the best, if it beats the isotropic size by ΔBIC under −10 (χ² divided by the isotropic fit's χ²<sub>ν</sub>, so that a misfit is not taken for evidence); else the isotropic size stays. Each solid is also refined with its axes held exactly on their nearest lattice directions — its faces lattice planes —, and kept so when that gives the lower ΔBIC and the free orientation is not better by more than its χ² allows (95 %); the free fit's angle from them is given beside. The ΔBIC of each solid against the same isotropic fit also compares the solids: under 10 is no preference, 10–30 weak (within what the search itself varies on real data), over 30 telling; and the sizes depend on the solid chosen. The result gives the solid's dimensions with their esds — true ones (diameter, height, edges, full axes): with WPPM the solid's own, else calibrated as the isotropic size, a sphere's diameter —, each axis with the simplest lattice direction within 10°, its angle from it and its angular esd (the turn of the solid that raises χ² by χ²<sub>ν</sub>, its sizes and its turns about the other axes refined again: it measures the valley of χ² the fit ends in, and of 7 free fits of synthetic boxes 2 ended 3–4 esd off, in another valley nearly as deep); two dimensions not told apart within 2 esd have no direction of their own, nor has an axis whose angular esd is over 30°. The sizes across a thin solid's faces assume ideally flat faces: a 2° spread of their orientation would shorten them by 10–30 %. The solid is drawn beside the tests with the crystal's directions on it and their uncertainty as cones (an axis the data do not fix dashed, <i>not determined</i>), and the cell's <i>a</i>, <i>b</i>, <i>c</i> in a corner for reference: drag it to turn it. Under the pattern: the difference, and a row of ticks per phase at its reflections; under them, the refinement's results across the card, by its title what it was refined with (each phase's models, the Refinement settings not the defaults), at its foot every warning. <b>Peak widths</b> (the table at the card's foot: a click keeps a peak marked on the pattern and on the Williamson–Hall plot): each reflection of a sample fitted alone (the pattern less the isotropic refinement's background and every other reflection, with a straight line for what is left, Kα₁ and Kα₂ and the instrument's asymmetry) by its own Lorentzian and Gaussian widths, to which the instrument's at that angle are added as the refinement adds them: their FWHM is the sample's alone, and the size from it is as in the Scherrer analysis. Three tests read them with no model of the shape, in their box beside the Williamson–Hall plot: <i>Williamson–Hall</i>, β·cosθ against 4·sinθ, where an isotropic size and strain put the points on one line (χ²<sub>ν</sub> about it and its probability); <i>orders</i>, Δd* = β·cosθ/λ of (h k l) and (n·h n·k n·l), equal for a size, in the ratio n for a strain, below 1 for faults that broaden by parity; and <i>prediction</i>, the same measurement on each model's own curve, which a model of the shape should match. Overlapped, weak or end-of-pattern peaks, and those no broader than the instrument within 2 esd, are listed but not used. R<sub>wp</sub>, R<sub>exp</sub> and χ² judge the fit; the values in brackets are the standard errors in the last digits, which the serially correlated residuals of a powder pattern make smaller than the real uncertainty. A refinement that stopped before converging, parameters on a bound (to be read as limits) and parameters the data do not determine are said under the results. How it all works in detail: RIETVELD.md in the repository.`;
export const RV_STD_INFO = `The instrumental standard's own Rietveld refinement: one file (a file dropped replaces the one there), refined against the phase chosen in the list (the round button) — the built-in LaB₆ (NIST SRM 660c), or a CIF of the standard's, dropped on <b>Phases</b> or selected with <b>+ CIF</b> at the list's foot. Each phase's download button, left of its ×, saves its CIF: the built-in LaB₆'s as the app holds it (LaB6_NIST-SRM-660c.cif, written in P1), a CIF's as read (in UTF-8). Its zero, its peak shape (U, V, W, X, Y and the axial divergence) and its sin 2θ shift become the instrument's, which every sample's refinement then takes: refine it before the samples (a sample's Refine offers to), and refine them again after refining it again. It cannot be refined while a sample refines, nor the samples while it does. Its cell is held at the CIF's (a certified standard's), and its own widths are the instrument's: no size, strain, faults or free shape of its own, nor an occupancy refined. Its <b>Settings…</b>, its own, hold only what applies to it: its displacement parameters (one ΔB by default) and its texture; where its refinement starts, with the groups it can hold (the scales and background, its zero and displacement, the profile, B, the texture); and the Refinement settings, the zero scan's range among them. Closed while it refines, this window leaves the run going: every Rietveld card's <b>Instrumental standard…</b> shows it, with its progress, until it ends.`;

/* host: {
     files()        the patterns refined (the included samples; the standard's one)
     allFiles()     every file loaded, for the results of those left out
     idx(), step(d) the sample on show, shared by the cards, and stepping it (samples)
     commit()       a step of the undo history
     irf()          the standard's instrumental profile (samples)
     openStd()      open the standard's window (samples)
     stdLoaded()    a standard's file is loaded (samples)
     refineStd(tell) refine the standard, as its window's Refine (samples, "Refine the
                    standard first"): { own, done }, done resolving to { ok, why }; tell(frac,
                    text) its progress. Its run going on already, that one (own false)
     stopStd(commit) stop the standard's run (samples; commit as cancel's)
     stdRun()       the standard's run, { frac }, or null (samples: Instrumental standard…
                    shows it)
     blocked()      why Refine cannot run now (the standard refining, for the samples; a
                    sample, for the standard), or ''
     onBusy()       a run started or ended here: the others' buttons follow
     hold()         the history held from the state on show (a run's start, a sample's wait
                    for the standard's run): its mark (utils.js UndoStack.hold)
     release(h, wrote, quiet)  the mark closed, with the patterns the run wrote (file name →
                    result) for the history's states (quiet: a commit follows)
     onProgress()   the run here went on (the standard: the samples' Instrumental standard…)
     changed()      the standard's result changed (the standard): the samples' notes follow
     hidden()       the card is folded: nothing is drawn
     unseen()       its module's instance is not on show (b2: a tab left, a run going on in
                    it): nothing is drawn at all, the tab's redraw draws it as it is shown
     placed()       the card is still its deck's (not closed, nor set aside by a restore):
                    one waiting for the standard's run starts its own as that ends. None:
                    the card in the page (to b2, when a module's one instance was the page's)
     layer          where its settings window goes (the instance's layer, b2); none, the body
   }
   o: { prefix, standard } */
export function createRietveld(host, root, o){
  const p = o.prefix, std = !!o.standard;
  root.innerHTML = rvHtml(p, std);
  // A card's section of the Results (the samples'): the refined patterns stacked, and the
  // crystallite sizes, as the Scherrer card's.
  const res = std ? null : document.createElement('div');
  if (res){ res.className = 'res-an'; res.innerHTML = resHtml(p); }
  // The elements, found in the card or its section whether or not they are in the page.
  const $ = id => root.querySelector('#' + p + id) || (res && res.querySelector('#' + p + id));
  let phases = [];           // [{ id, cif (text), file, color, prep, on, dep (the settings: MODES), off (file name → true: not refined there) }]
  let nextId = 1;
  let results = {};          // file name → { params, esd, stats, stages, free, held, detected, shapes, isoParams, at, … }
  let startFrom = 'cif', hold = HOLD_DEFAULT.slice();   // where Refine starts (HOLDS)
  let fit = {};              // the Refinement settings changed from their defaults (FITS)
  let busy = false;
  let cur = null, curP = null; // the run going on (refine's) and its promise
  let waiting = null;        // a sample's Refine waiting for the standard's run ("Refine the standard first")
  let mark = null, wrote = null; // the history held by the run or the wait (host.hold), and the patterns the run wrote (name → result)
  // What a run takes as it starts locked (the phases' × and ticks, Settings…, + CIF, Clear):
  // while it goes on, and while a sample's waits for the standard's run, the history held
  // from there (press), so that the states above hold them as the run takes them (up to
  // v508 open during the wait, the run taking them as it started after it).
  const locked = ()=> busy || !!waiting;
  let gen = 0;               // the states restored so far: a choice outlived by one is dropped
  let plot = null;
  let sel = null;            // the phase whose structure is on show
  let gone = false;          // destroyed: nothing is drawn
  let csvPre = '';           // the downloads' names: the card's, then the file's
  // The listeners the card registers once (on its own elements, its section of the
  // Results, its settings window and, while that is open, the document) all come off
  // together when it is destroyed.
  const ac = new AbortController();
  // The standard's: the built-in LaB6, its own colour apart from the CIF phases'; the
  // phase its refinement uses (pick).
  const lab6 = { id: LAB6_ID, cif: LAB6_CIF, file: '', color: '#4cc9a0', ...stdSettings(), prep: LAB6_PREP(), off: {} };
  let pick = 0;
  const allPhases = ()=> std ? [lab6, ...phases] : phases;
  const curIdx = ()=> std ? 0 : Math.min(host.idx(), Math.max(0, host.files().length - 1));

  // The phases refined on a pattern: the standard's chosen one; a sample's those ticked for it.
  const stdPhase = ()=> allPhases().find(q=> q.id === pick) || lab6;
  const phasesFor = f => std ? [stdPhase()] : phases.filter(q=> !(f && q.off[f.name]));

  // ---- the workers: the page's pool's (xrd-rv-pool.js); a run's jobs, its lanes (cur.lanes) ----
  // The standard's card's own instrumental profile, from its file's result (irfOf).
  function ownIrf(){ return irfOf(host.files()[0], results); }
  const irf = ()=> std ? ownIrf() : host.irf();
  const staleOf = (f, r) => !std && !!r.irf && !sameIrf(r.irf, irf());

  /* A run: the patterns on the pool's lanes (below), each result written whole once its
     pattern and those before it are done, into the results the card holds then (a module
     read out and in again meanwhile, as a saved project's CSV export from the Projects list
     does, puts back the same; the card set aside by it is taken up again, xrd.js), and only
     for a file still loaded. Cancel, a tab left (the tab manager's stop) or a kind switch
     ends it at once (cancel): it says so, the patterns done are kept (those done behind
     one under way written then), those under way are not, and nothing comes of their
     workers' answers after. Resolves to { ok, why }.
     It holds the history from its start (holdHist; a sample's from its wait for the
     standard's run, press): the steps taken meanwhile are undone and redone around it, and
     as it ends, however it ends, the patterns written go into the states saved meanwhile
     and, a step of their own, after the one it started from (releaseHist). Up to v508 the
     steps taken meanwhile could be neither undone nor redone until it ended, a banner
     saying so, and its results came in as a step at its end. */
  async function refine(list, tell){
    if (busy) return { ok: false, why: 'a refinement is running' };
    // A batch takes one instrumental profile throughout: no sample refines while the
    // standard does, nor the standard while a sample does. (A wait for the standard's run
    // that comes to nothing lets the history go.)
    const why = host.blocked ? host.blocked() : '';
    if (why){ setStatus(why); releaseHist(); return { ok: false, why }; }
    const todo = list.filter(f=> phasesFor(f).length);
    if (!todo.length){
      const t = std ? 'Load the standard\'s file to refine it.' : list.length ? 'No phase ticked for this pattern: add one from a CIF, or tick one.' : 'Add a phase from a CIF to refine.';
      setStatus(t); releaseHist(); return { ok: false, why: t };
    }
    // (the settings stay open if they are: read only until the run ends, syncSettings)
    busy = true; holdHist(); syncButtons();
    const copy = q => ({ ...q, on: { ...q.on }, dep: { ...q.dep }, off: { ...q.off } });
    const run = cur = { ph: phases.map(copy), std: copy(stdPhase()), start: startFrom, hold: hold.slice(), fit: { ...fit }, irf: std ? null : irf(),
      fell: [], bgFreed: [], n: todo.length, done: 0, tell };
    if (host.onBusy) host.onBusy();
    try {
      /* Its patterns on the pool's lanes (xrd-rv-pool.js lanes: several at once, up to the
         pool's cap shared with every run of every page), each payload built as its pattern
         is taken, in order; the results written in the patterns' order, each once those
         before it are, so that the results, the history's step and the file saved are a
         run of one lane's, key order included. An error stops the patterns not taken; those
         under way end and are written. (run.frac: how far the run is, for the standard's
         button on the samples' cards) Up to backlog 23's prototype one worker, the
         patterns one after the other. */
      const lbl = k => todo[k].label, from = [];
      const L = run.lanes = lanes(todo.length, {
        payload: k =>{
          const f = todo[k], pay = payloadFor(f, run, results, std), ph = pay.list;
          delete pay.list;
          from[k] = pay.opts.start ? ' from its last result' : '';
          return { pay, ctx: { f, ph } };
        },
        write: (k, res, { f, ph })=>{
          // (a file taken away meanwhile: its result has no pattern to go with)
          if (!host.allFiles().some(g=> g.name === f.name)) return;
          results[f.name] = resultRecord(res, ph, std, Date.now());
          if (wrote) wrote[f.name] = results[f.name];
          run.done++;
          // (by name: a module read out and in again gives the same files as new objects)
          if (f.name === (host.files()[curIdx()] || {}).name) draw();
        },
        // (one pattern under way: as one lane says it, its stages; several: their names and
        // how many are done)
        progress: (frac, on, k, stage, what)=>{
          if (cur !== run) return;
          run.frac = frac; showProg(frac);
          if (on.length > 1){ if (what !== 'progress' || stage) setStatus(`Refining ${on.map(lbl).join(', ')}… (${run.done} of ${run.n} done)`); }
          else if (what === 'start') setStatus(`Refining ${lbl(k)}${from[k]}…`);
          else if (what === 'done' && on.length) setStatus(`Refining ${lbl(on[0])}…`);
          else if (stage) setStatus(`Refining ${lbl(k)}: ${stage}…`);
          // (the stages say the rest: a start from the last result has its own)
          const t = stage ? `${lbl(k)}: ${stage}` : on.map(lbl).join(', ');
          if (run.tell && t) run.tell(run.frac, t);
          if (host.onProgress) host.onProgress();
        },
      });
      const { error } = await L.done;
      if (cur !== run) return { ok: false, why: 'stopped' };
      if (error) throw error;
      setStatus([run.fell.length && `From the CIF, no last result to start from: ${run.fell.join('; ')}.`,
        run.bgFreed.length && `Scales and background refined, not held: the background's terms changed since the last result (${run.bgFreed.join(', ')}).`].filter(Boolean).join(' '));
      return { ok: true };
    } catch(e){
      if (cur !== run) return { ok: false, why: 'stopped' };
      setStatus('⚠ ' + e.message);
      return { ok: false, why: e.message };
    } finally {
      if (cur === run) endRun(true);
    }
  }
  // (the history let go before the run's own commit: the state on show then has the run's
  // results, and the commit adds no step; one not committed here is the switch's or the
  // close's, which the change listeners hear)
  function endRun(commit){
    cur = null; busy = false; hideProg(); syncButtons(); draw();
    releaseHist(!commit);
    if (commit) host.commit();
    if (std && host.changed) host.changed();
    if (host.onBusy) host.onBusy();
  }
  // The history held from a run's start or a wait's (host.hold), once; let go with what the
  // run wrote (host.release), once, whichever way it ends.
  function holdHist(){ if (!mark && host.hold){ mark = host.hold(); wrote = {}; } }
  function releaseHist(quiet){ const m = mark, w = wrote; mark = wrote = null; if (m && host.release) host.release(m, w, quiet); }
  const start = (list, tell)=> (curP = refine(list, tell));
  /* Ends the run at once, or a sample's wait for the standard's: Cancel, the tab manager's
     stop (a tab left, xrd.js), a kind switch (commit false: the switch commits). Up to v477
     Cancel let the worker's last answer end the run, and an end that came after a switch
     went to the project then shown. */
  function cancel(commit = true){
    if (waiting){
      const w = waiting; waiting = null; w.cancelled = true;
      if (w.own && host.stopStd) host.stopStd(commit);
      releaseHist();
      hideProg(); syncButtons();
      setStatus(w.own ? 'Stopped, the standard\'s refinement with it: nothing refined.' : 'Stopped waiting for the standard\'s refinement: nothing refined.');
    }
    const run = cur;
    if (!run) return;
    // (the jobs under way cancelled; those done behind them written, in order)
    if (run.lanes) run.lanes.stop();
    endRun(commit);
    setStatus(run.n > 1 ? `Stopped after ${run.done} of ${run.n} patterns: the others keep what they had.` : `Stopped: ${std ? 'the standard' : 'the pattern'} keeps what it had.`);
  }
  /* Refine and Refine all on a sample with no refined standard (no result of the standard's
     file to take its profile from, ownIrf) ask first: refine the standard (its window's
     Settings… as they are) and then these, refine without it, or not (×, Escape, a click
     beside it); with no standard loaded, load one (its window) instead of the first. The
     question is a window at the centre of the screen, its primary answer focused, the
     focus back on the button pressed once answered (to v493 a banner at the top, easily
     missed). The patterns are those of the press, found again by name when the choice is
     made. A press with no phase to refine on any of them asks nothing: Refine says so at
     once (asked first, the standard was refined before that was said). */
  async function press(all){
    const f = host.files()[curIdx()];
    if (!all && !f) return;
    const names = all ? null : [f.name];
    const list = ()=> all ? host.files().slice() : host.files().filter(g=> names.includes(g.name));
    if (std || irf() || !list().some(g=> phasesFor(g).length)){ start(list()); return; }
    const g = gen, loaded = !!(host.stdLoaded && host.stdLoaded());
    const c = await confirmModal(loaded
      ? 'The instrumental standard is not refined: without its profile the widths, and the sizes from them, include the instrument\'s. Refine it first, with the settings of its window?'
      : 'No instrumental standard is loaded: without its profile the widths, and the sizes from them, include the instrument\'s.',
      loaded ? 'Refine the standard first' : 'Load a standard…', 'Refine without the standard',
      { title: 'Instrumental standard', back: $(all ? 'RefineAll' : 'Refine') });
    // (outlived: another state restored in the card, the card closed, a run started meanwhile)
    if (!c || g !== gen || !root.isConnected || busy || waiting) return;
    // Answered with the card not on show, it starts nothing: the window covers the tabs,
    // but the browser's Back still leaves for a section the address names (Home, Projects,
    // Settings). The banner, to v493, stayed over any tab left, and the XRPD project might
    // no longer be the live tab, the one the tab manager guards: a run started so went into
    // the next XRPD project opened, unasked, and "Load a standard…" opened its window over
    // the other module. Back on the card, its Refine asks again.
    if (!root.closest('.tab.active')){ setStatus('Nothing refined: the question was answered with the card not on show.'); return; }
    if (c === 'alt' || irf()){ start(list()); return; }
    if (!loaded){ host.openStd(); return; }
    // (the standard refining already: this waits for that run; refused while a sample refines)
    const w = { cancelled: false, own: false };
    const sr = host.refineStd((frac, t)=>{ if (waiting === w){ showProg(frac); setStatus(`Refining the standard first: ${t}…`); } });
    if (sr.why){ setStatus(sr.why); return; }
    // (the history held from here: the patterns go in after the standard's own step)
    w.own = sr.own; waiting = w; holdHist();
    setStatus('Refining the instrumental standard first…'); syncButtons();
    const r = await sr.done;
    // (stopped from here, or by the tab manager: cancel said so)
    if (w.cancelled || gone || !(host.placed ? host.placed() : root.isConnected)){ if (!w.cancelled) releaseHist(); return; }
    waiting = null; hideProg(); syncButtons();
    if (!r.ok || !irf()){ releaseHist(); setStatus(r.ok ? 'The standard\'s refinement gave no profile (its file changed meanwhile?): nothing refined.'
      : r.why === 'stopped' ? 'The standard\'s refinement was stopped: nothing refined.' : `The standard's refinement failed (${String(r.why).replace(/\.$/, '')}): nothing refined.`); return; }
    start(list());
  }

  // ---- the plot: observed, calculated, the background, the difference under them,
  // and a row of ticks per phase between the two ----
  // (kept: curvesKept, above. Up to v486 a redraw built and calculated the model twice,
  // and an undo or a tab switch again for every refined pattern in the Results: 1.5–2.5 s
  // for twelve)
  function curvesOf(f, r){
    const list = resultPhases(r, allPhases(), phasesFor(f)), key = curveKey(f, r, list, std);
    return { c: curvesKept(f.y, key, ()=>{ const { yc, bg, ticks } = curvesFrom(f, r, list, std); return { yc, bg, ticks }; }), list, key };
  }
  /* The pattern's plot as last drawn (plotKey): the pattern, its instrument, its result,
     the phases (each one's structure, colour and tick on it, the standard's chosen) and
     the plot's size. The same again, it stays as it is (kept in view, as preserve keeps
     it; else only where not zoomed): the label, which only the figure composer's name of
     the observed trace has, is set in place. */
  let plotKey = '', instrTxt = '';
  const setText = (id, t)=>{ const el = $(id); if (el.textContent !== t) el.textContent = t; };
  function draw(preserve){
    if (gone || (host.unseen && host.unseen())) return;
    const fs = host.files();
    syncButtons();
    renderPhases();
    if (!fs.length){
      // (the standard's plot has no caption: its window names the file)
      if (!std){ setText('Label', '—'); setText('Idx', '0/0'); }
      renderRes();
      if (plot){ plot = null; }
      $('Svg').replaceChildren(); $('Legend').innerHTML = ''; $('Instr').textContent = ''; plotKey = instrTxt = '';
      renderResults(null, null); renderWidths(null, null); renderSolids(null, null);
      return;
    }
    const k = curIdx(), f = fs[k], r = results[f.name];
    if (!std){ setText('Label', f.label); setText('Idx', (k+1) + '/' + fs.length); }
    // (the Results show every pattern, the card folded or not)
    renderRes();
    if (host.hidden && host.hidden()) return;
    const svg = $('Svg');
    const key = [f.name, idOf(f.x), idOf(f.y), idOf(f.varMul), idOf(instrOf(f)), resKey(r), std ? pick : '',
      allPhases().map(q=> [q.id, q.color, idOf(q.prep), q.off[f.name] ? 0 : 1].join(':')).join(), sizeOf(svg)].join('|');
    const drawn = !(plot && key === plotKey && (preserve || atOrigin(plot)));
    if (drawn){ plotKey = ''; drawPattern(f, r, svg, preserve); plotKey = key; }
    else plot._stored.forEach(e=>{ if (e.key === f.name) e.label = f.label; });
    const it = instrLine(instrOf(f));
    if (it !== instrTxt){ instrTxt = it; $('Instr').textContent = it; }
    renderResults(f, r);
    // (the picked peak's line again on a plot drawn anew, where the widths' table is there
    // as it was and so did not mark it: its picked peak is this pattern's. With no widths
    // (no result, one cleared, none measured) none is marked, as before: the one picked
    // is another pattern's or the cleared result's)
    if (!renderWidths(f, r) && drawn && whPlot) markPeaks();
    renderSolids(f, r);
    fitSide();
  }
  function drawPattern(f, r, svg, preserve){
    const prev = preserve && plot ? { xmin: plot.xmin, xmax: plot.xmax } : null;
    plot = new Plot(svg, { xlabel: '2θ (°)', ylabel: 'Intensity (counts)' });
    plot.attachTools(svg.closest('.plot-wrap'));
    let c = null, used = phasesFor(f), key = '';
    if (r && r.params){ try { const cv = curvesOf(f, r); c = cv.c; used = cv.list; key = cv.key; } catch(e){ c = null; } }
    const ys = f.y, lo = Math.min(...ys), hi = Math.max(...ys), A = (hi - lo) || 1;
    const groups = c ? groupTicks(c.ticks, used)
      : ticksKept(f.y, exactJson([idOf(f.x), instrOf(f), used.map(q=> [q.id, idOf(q.prep), q.color])]), ()=> tickRows(f, used));
    const rowH = 0.045*A, rowGap = 0.02*A;
    const tickTop = lo - rowGap, tickBottom = tickTop - groups.length*(rowH + rowGap);
    let diff = null, off = 0;
    const [xa, xb] = scanRange(f);
    if (c){
      diff = diffKept(ys, key, ()=> ys.map((v, i)=> v - c.yc[i]));
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
      + groups.map(g=> `<span><i style="background:${esc(g.color)}"></i>${esc(g.name)}</span>`).join('');
  }

  /* ---- the Results (a card's section): every refined pattern stacked, the observed
     less its refined background, normalised as Settings… say (resNorm); the crystallite sizes by
     sample (each phase's refined size with its esd; a free shape's measured dimensions,
     each with its own) or by peak (each reflection's own size, from the peak widths,
     across the samples). Each drawn again only when what it shows changes. ---- */
  // resNorm: the stacked patterns' normalisation (Settings…, Results), as the Scherrer card's.
  let sizeBy = 'sample', resNorm = 'global';
  // A pattern's observed less its refined background, or null (kept: netKept).
  function netOf(f, r){
    let list; try { list = resultPhases(r, allPhases(), phasesFor(f)); } catch(e){ return null; }
    return netKept(f.y, curveKey(f, r, list, std), ()=>{ try { const { c } = curvesOf(f, r); return Array.from(f.y, (y, i)=> y - c.bg[i]); } catch(e){ return null; } });
  }
  const refinedFiles = ()=> host.files().filter(f=> results[f.name] && results[f.name].params);
  const phaseColor = name => (allPhases().find(q=> q.prep.name === name) || {}).color || '#888';
  // (up to v490 the section was drawn whole again on any change to it: a label, the
  // Results' charts both)
  function renderRes(){
    if (!res) return;
    const fs = refinedFiles(), anyW = fs.some(f=> results[f.name].widths);
    if (sizeBy === 'peak' && !anyW) sizeBy = 'sample';
    const row = res.querySelector('.res-row'), none = $('ResNone'), on = fs.length ? '' : 'none';
    if (row.style.display !== on) row.style.display = on;
    if (none.style.display !== (fs.length ? 'none' : '')) none.style.display = fs.length ? 'none' : '';
    if (!fs.length) return;
    const a = drawStacked(fs), b = drawSizes(fs, anyW);
    sizeNames();
    if (a || b) fitCsvIcons(res);
  }
  /* The stacked plot as last drawn: the patterns, each one's observed less its background
     (one array while what it is made from is the same: netOf), colour and 2θ, the
     normalisation and the plot's size. A label is no part of it: the legend's, written
     again alone, and the figure composer's name of its trace, set in place. */
  let stackKey = '', stackPlot = null, stackLeg = '';
  function drawStacked(fs){
    const shown = fs.map(f=> ({ f, y: netOf(f, results[f.name]) })).filter(q=> q.y), svg = $('ResSvg');
    const leg = shown.map(({ f })=> `<span><i style="background:${esc(f.color)}"></i>${esc(f.label)}</span>`).join('');
    if (leg !== stackLeg){ stackLeg = leg; $('ResLegend').innerHTML = leg; }
    const key = [resNorm, sizeOf(svg), ...shown.map(({ f, y })=> [f.name, f.color, idOf(f.x), idOf(y)].join(':'))].join('|');
    if (stackPlot && key === stackKey){
      const lab = new Map(shown.map(({ f })=> [f.name, f.label]));
      stackPlot._stored.forEach(e=>{ if (lab.has(e.key)) e.label = lab.get(e.key); });
      return false;
    }
    stackKey = '';
    const plot = stackPlot = new Plot(svg, { xlabel: '2θ (°)', ylabel: 'Intensity (a. u.)', noYTickLabels: true });
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    // (global: each divided by the largest; local: by its own; none: as they are, the
    // largest spacing them, the plot's unit)
    const gmax = Math.max(1e-12, ...shown.map(({ y })=> maxArr(y)));
    const unit = resNorm === 'none' ? gmax : 1, n = shown.length, baseOf = j => -j*1.1*unit;
    let lo = Infinity, hi = -Infinity;
    shown.forEach(({ f })=>{ const [a, b] = scanRange(f); lo = Math.min(lo, a); hi = Math.max(hi, b); });
    if (!isFinite(lo)){ lo = 0; hi = 1; }
    plot.setRange(lo, hi, baseOf(Math.max(0, n - 1)), baseOf(0) + 1.1*unit);
    plot.drawAxes();
    shown.forEach(({ f, y }, j)=>{
      const mx = resNorm === 'local' ? (maxArr(y) || 1) : resNorm === 'none' ? 1 : gmax;
      const norm1 = y.map(v=> v/mx);
      plot.line(f.x, norm1.map(v=> v + baseOf(j) + 0.05*unit), f.color, 1.3, undefined, { raw: { xs: f.x, ys: norm1 }, label: f.label, key: f.name });
    });
    stackKey = key;
    return true;
  }
  /* The sizes as points with their esds, the names under the axis cut and tilted to fit
     (barNames) as the Scherrer card's, the values written above. By sample: a column a
     pattern, a point a phase (beside each other) and a dimension of a free shape; by peak:
     a column a reflection, a point a pattern. */
  // The chart as last drawn (sizeKey): its columns, its points and their values, the chips
  // in its corner and its size; the chips, the legend and the note as last written.
  let sizeKey = '', sizeChips = '', sizeLeg = '', sizeNote = '';
  function drawSizes(fs, anyW){
    const svg = $('SizeSvg'), chips = $('SizeBy'), wrap = svg.closest('.plot-wrap');
    const ch = [['sample', 'by sample'], ['peak', 'by peak']].map(([k, t])=>
      `<button type="button" class="mode-chip plot-chip${sizeBy === k ? ' is-on' : ''}" data-size-by="${k}"`
      + `${k === 'peak' && !anyW ? ' disabled title="No peak widths: they are measured on a sample refined with its phases"' : ` title="Crystallite size ${t}"`}>${t}</button>`).join('');
    if (ch !== sizeChips){ sizeChips = ch; chips.innerHTML = ch; }
    const { cols, marks, series } = sizeMarks(fs, results, sizeBy, phaseColor);
    const pts = marks.filter(m=> m.v != null), labs = marks.filter(m=> m.label);
    const legend = $('SizeLegend'), note = $('SizeNote');
    const put = (lg, nt)=>{ if (lg !== sizeLeg){ sizeLeg = lg; legend.innerHTML = lg; } if (nt !== sizeNote){ sizeNote = nt; note.textContent = nt; } };
    if (!pts.length){ wrap.style.display = 'none'; sizeKey = ''; put('', sizeBy === 'peak' ? 'No peak the tests use.' : 'No size refined: the size is off, or every phase was refined without one.'); return false; }
    if (wrap.style.display) wrap.style.display = '';
    put(series.map(q=> `<span><i style="background:${esc(q.color)}"></i>${esc(q.name)}</span>`).join(''), sizeBy === 'peak'
      ? "Each reflection's own size (Scherrer, K = 0.9, on its FWHM less the instrument's), the peaks the tests use."
      : sizeKinds(fs, results).map(k=> SIZE_KINDS[k][1]).join(' '));
    const key = JSON.stringify([ch, cols, marks, sizeOf(svg)]);
    if (key === sizeKey) return false;
    sizeKey = '';
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    const br = svg.getBoundingClientRect(), svgW = br.width || 640, svgH = br.height || 420, n = cols.length;
    const fit = barNames(mctx, cols.map(c=> c.label), Math.max(60, svgW - 75), 55);
    const maxLbl = Math.max(0, ...fit.labels.map(l=> mctx.measureText(l).width));
    const bottom = Math.round(26 + maxLbl*fit.sin), mTop = 15, gap = 8, plotH = svgH - mTop - bottom;
    const maxValW = Math.max(0, ...labs.map(m=> mctx.measureText(m.label).width));
    const reserve = gap + maxValW + 6, frac = plotH > reserve ? 1 - reserve/plotH : 0.5;
    const tops = pts.map(m=> m.v + (Number.isFinite(m.e) ? m.e : 0));
    const ymax = Math.max(Math.max(...tops)*1.15, (labs.length ? Math.max(...labs.map(m=> m.top)) : 0)/frac,
      barChipYmax(chips, svg, labs.map(m=> ({ x: m.x, dx: m.dx, top: m.top, w: mctx.measureText(m.label).width })), { W: svgW, ml: 55, mr: 20, mTop, plotH, gap, x0: 0, x1: n + 1 }));
    const plot = new Plot(svg, { xlabel: '', ylabel: 'Crystallite size (nm)', noXTickLabels: true, noXGrid: true, yGrid: true, margin: { l: 55, r: 20, t: mTop, b: bottom } });
    plot.setRange(0, n + 1, 0, ymax || 1);
    plot.drawAxes();
    pts.forEach(m=>{ if (Number.isFinite(m.e) && m.e > 0) plot.errbar(m.x, m.v, m.e, m.dx); });
    // (a point a colour, each beside its column's centre by its offset)
    const groups = new Map();
    pts.forEach(m=>{ const k = m.color + '|' + m.dx; if (!groups.has(k)) groups.set(k, { color: m.color, dx: m.dx, xs: [], ys: [] }); const g = groups.get(k); g.xs.push(m.x + m.dx/((svgW - 75)/(n + 1))); g.ys.push(m.v); });
    groups.forEach(g=> plot.points(g.xs, g.ys, g.color, 4.5));
    labs.forEach(m=> plot.barLabel(m.x, m.top, m.label, { gap, dx: m.dx }));
    // (the whole name's runs too: the figure composer draws it, with its bars)
    cols.forEach((c, i)=> plot.tickLabel(i + 1, fit.labels[i], fit.rot, c.label, c.name, c.hkl ? plotRuns(fit.labels[i], c.hkl) : null, c.hkl ? plotRuns(c.label, c.hkl) : null));
    plot.attachTools(wrap);
    sizeKey = key;
    return true;
  }
  // The size chart's downloads follow what it shows, and the card's name.
  function sizeNames(){
    if (!res) return;
    res.querySelectorAll('[data-size-dl]').forEach(b=>{
      b.dataset.csvNames = csvPre + (sizeBy === 'peak' ? 'rietveld_peaks.csv' : 'rietveld_results.csv');
      if (b.classList.contains('plot-dl-btn')) b.dataset.dlName = csvPre + (sizeBy === 'peak' ? 'XRPD_rietveld_size_by_peak.svg' : 'XRPD_rietveld_size.svg');
    });
  }
  if (res) res.addEventListener('click', e=>{
    const b = e.target.closest('[data-size-by]');
    if (!b || b.disabled || b.dataset.sizeBy === sizeBy) return;
    sizeBy = b.dataset.sizeBy === 'peak' ? 'peak' : 'sample';
    renderRes();
    host.commit();
  }, { signal: ac.signal });

  // ---- the crystallites' shape: each phase's refined solid in 3D (xrd-shape3d), the
  // crystal's directions on it with their uncertainty cones; drag to turn it ----
  let solidViews = [], solidsKey = '';
  // How each solid was last turned (xrd-shape3d getView), by sample and solid: coming
  // back to a sample shows it as it was left.
  const solidTurns = new Map();
  /* The solids' views fill their box, square beside the Williamson–Hall plot and as tall
     (the plot's height, the column's width): each the box's height, shared by several,
     less its head and its caption. Stacked on a narrow screen: square, 320 px at most. */
  const solidHeight = n => ()=>{
    const box = $('Solids'), cs = getComputedStyle(box);
    if (document.documentElement.classList.contains('narrow-layout')) return Math.min(320, box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    let h = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 10*(n - 1);
    box.querySelectorAll('.rv-solid').forEach(w=>{ const c = w.querySelector('canvas'); h -= w.offsetHeight - (c ? c.offsetHeight : 0); });
    return Math.max(120, Math.floor(h/n));
  };
  function renderSolids(f, r){
    const box = $('Solids'), list = (r && r.solids) || [];
    // The same solids: the views stay as they were turned.
    const key = (f ? f.name : '') + JSON.stringify(list);
    if (key === solidsKey) return;
    solidsKey = key;
    solidViews.forEach(({ view, turnKey })=>{ if (view.getView) solidTurns.set(turnKey, view.getView()); view.destroy(); });
    solidViews = [];
    if (solidTurns.size > 50) solidTurns.delete(solidTurns.keys().next().value);
    // No solid kept: the box says so, in its place (the free shape is a setting; a solid
    // searched and not kept, the results say why).
    box.innerHTML = list.length ? '' : `<div class="peak-box-head"><span class="txt-mini">Crystallite shape</span></div><div class="rv-empty">${r && r.params && Object.values(r.models || {}).some(m=> m && m.shape)
      ? 'No free shape kept: none beat the isotropic size by ΔBIC under −10.' : 'Isotropic size: no free shape refined. <b>Settings…</b> sets one (Crystallite size, free shape).'}</div>`;
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

  // ---- the peaks' own widths (xrd-widths, run by the worker): the Williamson–Hall plot,
  // the tests on them beside it, and the table at the card's foot ----
  let whPlot = null;
  // The peak picked in the table (a click; another click lets it go), as the Scherrer
  // card's: marked on the pattern and on the Williamson–Hall plot until then, the one
  // under the pointer beside it. Of one pattern: another pattern's table has none.
  let pkSel = null, pkHov = null;
  /* The table, the Williamson–Hall plot and the tests as last drawn (widthsKey): the
     pattern, its result, the phases' colours and the plot's size. Drawn again, it says so
     (the picked peak is marked again with it). */
  let widthsKey = '';
  function renderWidths(f, r){
    const box = $('Widths'), wd = r && r.widths;
    const phs = wd ? wd.phases.filter(ph=> ph.rows.length) : [];
    if (box.style.display !== (phs.length ? '' : 'none')) box.style.display = phs.length ? '' : 'none';
    if (!phs.length){ whPlot = null; widthsKey = ''; return false; }
    const key = [f.name, resKey(r), allPhases().map(q=> q.id + ':' + q.color).join(), sizeOf($('WhSvg'))].join('|');
    if (whPlot && key === widthsKey) return false;
    widthsKey = '';
    const colorOf = id => (allPhases().find(q=> q.id === id) || {}).color || '#888';
    const wrap = $('PkWrap');
    wrap.innerHTML = widthsTableHtml(phs, wd, r, colorOf);
    drawWH(phs, colorOf);
    $('Tests').innerHTML = testsHtml(phs);
    const pk = tr => ({ file: f.name, tt: +tr.dataset.tt, lab: tr.dataset.lab, ph: +tr.dataset.ph, color: colorOf(+tr.dataset.ph) });
    const same = (a, b) => !!a && !!b && a.file === b.file && a.lab === b.lab && a.ph === b.ph;
    const rows = [...wrap.querySelectorAll('.rv-pk')];
    // (the one picked stays picked through a redraw of its pattern, while its row is there)
    if (pkSel && !rows.some(tr=> same(pk(tr), pkSel))) pkSel = null;
    pkHov = null;
    rows.forEach(tr=>{
      tr.classList.toggle('selected', same(pk(tr), pkSel));
      tr.addEventListener('mouseenter', ()=>{ pkHov = pk(tr); tr.classList.add('hovering'); markPeaks(); });
      tr.addEventListener('mouseleave', ()=>{ pkHov = null; tr.classList.remove('hovering'); markPeaks(); });
      tr.addEventListener('click', ()=>{
        const k = pk(tr);
        pkSel = same(k, pkSel) ? null : k;
        rows.forEach(x=> x.classList.toggle('selected', same(pk(x), pkSel)));
        markPeaks();
      });
    });
    markPeaks();
    fitCsvIcons(root);
    widthsKey = key;
    return true;
  }
  // The picked peak and the one under the pointer: a line at each on the pattern, in its
  // phase's colour, and a ring round each on the Williamson–Hall plot (the picked one's
  // thicker; drawn again at a zoom or a pan of it).
  const marked = ()=> [pkSel, pkHov].filter((k, i, a)=> k && (i === 0 || !a[0] || a[0].lab !== k.lab || a[0].ph !== k.ph));
  function markPeaks(){
    if (plot){ plot.clearOverlay(); marked().forEach(k=> plot.vline(k.tt, k.color, false)); }
    markWH();
  }
  function markWH(){
    if (!whPlot) return;
    whPlot.gOverlay.querySelectorAll('.wh-hl').forEach(e=> e.remove());
    marked().forEach(k=>{
      const q = (whPlot._pts || []).find(x=> x.label === k.lab && x.ph === k.ph);
      if (!q) return;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', whPlot.px(q.x)); c.setAttribute('cy', whPlot.py(q.y)); c.setAttribute('r', 7);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', k.color); c.setAttribute('stroke-width', k === pkSel ? 2.6 : 2); c.setAttribute('class', 'wh-hl');
      whPlot.gOverlay.appendChild(c);
    });
  }
  /* Williamson–Hall: H·cosθ (10⁻³ rad; H the corrected FWHM, not the integral breadth β)
     against 4·sinθ for the peaks the tests use, each with its esd and hkl; the weighted
     line through them (isotropic size + strain), from 4·sinθ = 0, where it gives Kλ/D;
     and the models' own points (the isotropic model's and the free shape's) beside them. */
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
    whPlot._onView = markWH;
    if (!pts.length){ whPlot.setRange(0, 1, 0, 1); whPlot.drawAxes(); $('WhLegend').innerHTML = ''; return; }
    // From 4·sinθ = 0, where a line meets the axis at Kλ/D; from 0 up, or from below the
    // lowest error bar or line where one goes under 0 (a negative intercept: no size).
    const xb = 1.12*Math.max(...pts.map(q=> q.x)) || 1;
    const ys = pts.flatMap(q=> [q.y - q.e, q.y + q.e]).concat(mods.map(m=> m.y),
      phs.flatMap(ph=> Number.isFinite(ph.wh.a) ? [1e3*ph.wh.a, 1e3*(ph.wh.a + ph.wh.b*xb)] : []));
    const y0 = Math.min(0, ...ys), y1 = Math.max(...ys), dy = (y1 - y0) || 1;
    whPlot.setRange(0, xb, y0 < 0 ? y0 - 0.08*dy : 0, y1 + 0.12*dy);
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
    pts.forEach(q=>{ const t = hklShow(q.label); whPlot.barLabel(q.x, q.y + q.e, t, { rot: 0, gap: 8, size: 10, runs: plotRuns(t, t) }); });
    whPlot._pts = pts;
    $('WhLegend').innerHTML = phs.map(ph=> `<span><i style="background:${esc(colorOf(ph.id))}"></i>${esc(ph.name)}, measured</span>`).join('')
      + (iso.length ? `<span><i style="background:#9aa3ad"></i>isotropic model</span>` : '')
      + (shp.length ? `<span><i style="background:#ff5050"></i>free-shape model</span>` : '');
  }

  // ---- the results, across the card under the pattern: the statistics, then what the
  // worker made of the result — the standard's instrument, or each phase's cell, size,
  // strain (and weight fraction with several phases), a value a line — and beside each
  // phase what its CIF gave and how it is refined ----
  /* By the box's title, what the result was refined with — each phase's models (refinedOf)
     and the Refinement settings that are not the defaults —, or, not refined yet, what
     Refine will refine (the settings); a phase's name before its line when there are
     several. */
  // (each box of markup written again only when its markup changed: up to v490 at every draw)
  let fitSetHtml = null, resultsHtml = null;
  function renderFitSet(f, r, shown){
    const el = $('FitSet'), done = !!(r && r.params), list = f ? shown : [];
    const used = done ? fitUsed(r, std) : [];
    const html = fitLineHtml(list, r, done, used, std);
    if (html !== fitSetHtml){ fitSetHtml = html; el.innerHTML = html; }
    const t = done ? 'What this result was refined with' : list.length ? 'What Refine will refine: Settings… changes it' : '';
    if (el.title !== t) el.title = t;
    el.classList.toggle('is-next', !done);
  }
  /* The statistics, then each group the worker made of the result (the specimen or the
     instrument, each phase's values); under them all, the notes and every warning: the
     refinement's (a cell search without a minimum, a phase not detected, a parameter on a
     bound), the CIFs' (their composition against the formula) and the standard's. */
  function renderResults(f, r){
    const box = $('Results'), put = h =>{ if (h !== resultsHtml){ resultsHtml = h; box.innerHTML = h; } };
    if (!f){ renderFitSet(null, null, []); put(`<div class="rv-note rv-wide">${std ? 'No standard loaded: drop its file above.' : 'No pattern.'}</div>`); return; }
    const shown = r && r.params ? (()=>{ try { return curvesOf(f, r).list; } catch(e){ return phasesFor(f); } })() : phasesFor(f);
    renderFitSet(f, r, shown);
    const cifWarn = shown.flatMap(q=> q.prep.warnings.map(w=> warnNote(`${esc(q.prep.name)}: ${esc(w)}`))).join('');
    if (!r || !r.params){
      const n = phasesFor(f).length;
      put((n ? `<div class="rv-note rv-wide">Not refined yet. <b>Refine</b> starts from the CIF's cell${std ? ' (the certified one, held fixed)' : ''}, finds where the pattern's peaks are, and refines step by step.</div>`
        : `<div class="rv-note rv-wide">${phases.length ? 'No phase ticked for this pattern: tick one in the list.' : 'No phase: add one from a CIF, dropped on Phases beside the pattern or selected with a click there.'}</div>`) + cifWarn);
      return;
    }
    const s = r.stats || {};
    let html = group('Fit', `<div class="pg-stat" title="R_wp: the weighted residual; R_exp: what the counting statistics alone would give">R<sub>wp</sub>: <b>${(s.Rwp*100).toFixed(2)}%</b></div>`
      + `<div class="pg-stat">R<sub>exp</sub>: <b>${(s.Rexp*100).toFixed(2)}%</b></div>`
      + `<div class="pg-stat" title="χ² = Σw(y − y_c)²/(N − P), the reduced χ²: (R_wp/R_exp)²">χ²: <b>${(s.chi2).toFixed(2)}</b></div>`);
    (r.phaseResults || []).forEach(q=>{
      html += group(esc(q.name), q.lines.map(l=> `<div class="pg-stat"${l.title ? ` title="${esc(l.title)}"` : ''}>${barIdx(esc(l.label))}: <b>${barIdx(esc(l.value))}</b></div>`).join(''), q.phase);
    });
    if (std) html += `<div class="rv-note rv-wide">The samples take this profile, its axial divergence, zero and sin 2θ shift as their instrument's.</div>`;
    else if (!r.irf && !r.irfRefused) html += irf() ? `<div class="rv-note rv-wide">No instrumental profile: this pattern was refined before the standard was. Refine it again to correct its widths, and the sizes from them, for the instrument's.</div>`
      : `<div class="rv-note rv-wide">No instrumental profile (refine the standard first: <b>Instrumental standard…</b>): the widths, and the sizes from them, include the instrument's.</div>`;
    html += (r.warnings || []).map(w=> warnNote(barIdx(esc(w)))).join('') + cifWarn;
    if (!std && r.irf && staleOf(f, r)) html += warnNote(`${irf() ? 'The standard has been refined again since this result' : 'The standard\'s refinement this result used is gone (cleared, or another standard loaded)'}: its profile, zero and asymmetry are not the ones these numbers rest on. Refine this pattern again, or <b>Refine all</b>.`);
    put(html);
  }

  // ---- the phases: a short list beside the pattern (formula and space group), each
  // ticked for the pattern on show (the standard's: one chosen), and the structure of the
  // one selected ----
  // (the list and the details written again only when their markup changed: up to v490 at
  // every draw; its handlers are the list's own, delegated)
  let phasesHtml = null, cellInfoHtml = null;
  function renderPhases(){
    const el = $('PhaseList'), list = allPhases(), f = host.files()[curIdx()];
    if (!list.some(q=> q.id === sel)) sel = list.length ? (std ? pick : list[0].id) : null;
    const html = phaseRowsHtml(list, { p, std, pick, sel, f, lab6, dlIcon: DL_ICON, xIcon: X_SVG });
    if (html !== phasesHtml){ phasesHtml = html; el.innerHTML = html; }
    lockRows();
    /* No phase: the drop zone in the list's place; with one, the list and + CIF, a drop zone
       of one line, at the box's foot (to v498 "No phase yet: + CIF adds one…" and + CIF, a
       button, in the box's head). A zone hidden with the focus in it gives it to the other. */
    const none = !list.length, dz = $('CifDz'), mini = $('AddCif'), had = [dz, mini].find(z=> z.contains(document.activeElement));
    if (el.hidden !== none) el.hidden = none;
    if (dz.hidden === none) dz.hidden = !none;
    if (mini.hidden !== none) mini.hidden = none;
    if (had && had.hidden) (none ? dz : mini).focus({ preventScroll: true });
    renderCell();
  }
  /* A row's × and tick (the standard's: its choice) are locked while a run goes on here (in
     the standard's window, while the standard refines), which took the phases as it started
     (run.ph), or waits for the standard's run to start after it (locked): at once as it
     starts and until it ends, is stopped or fails (syncButtons), titled why, the pointer
     'not-allowed' over them (.is-locked). The × disabled; the tick and the choice
     aria-disabled, not disabled, so that they keep their accent and a ticked phase or the
     one chosen reads as such (the browser's disabled look draws ticked and not alike, one
     grey), a click on them cancelled (the list's click). To v505 they kept their
     look until the list was next drawn, which a run did only once the pattern on show was
     refined: never in a run of one pattern, the standard's, or Refine all with a later
     pattern on show; a click was refused unsaid. The list's markup leaves this out, so that a
     run starting or ending does not write it again. The download stays enabled (a run
     changes nothing of a CIF); the built-in LaB6's × is disabled for good, with its own title
     (data-built). A sample's card does not lock its rows while the standard refines, unless
     it waits for that run, nor the standard's window while samples do: their runs took the
     phases they refine as they started. */
  const ROW_TITLES = { del: ['Remove phase', 'the phase stays until it ends'], on: ['Refined on this pattern (each pattern its own)', 'the tick stays as it is until it ends'],
    pick: ['The phase the standard is refined with', 'the phase chosen stays until it ends'] };
  function lockRows(){
    const f = host.files()[curIdx()], lock = locked();
    $('PhaseList').querySelectorAll('[data-del]:not([data-built]), [data-on], [data-pick]').forEach(c=>{
      const k = c.dataset.del != null ? 'del' : c.dataset.on != null ? 'on' : 'pick', t = ROW_TITLES[k];
      // (a tick with no pattern on show disabled, as ever)
      const off = k === 'del' ? lock : k === 'on' && !f, title = lock ? 'A refinement is running: ' + t[1] : t[0];
      if (c.disabled !== off) c.disabled = off;
      if (k !== 'del' && c.hasAttribute('aria-disabled') !== lock){ if (lock) c.setAttribute('aria-disabled', 'true'); else c.removeAttribute('aria-disabled'); }
      if (c.title !== title) c.title = title;
      if (c.classList.contains('is-locked') !== lock) c.classList.toggle('is-locked', lock);
    });
  }
  /* The selected phase's cell in 3D (xrd-cell3d) and its details under it; no phase, none
     of either, the box saying so (to v498 the 3D view kept the cell drawn last on show:
     xrd-cell3d set). */
  let cellV = null, cellKeyShown = '';
  let cellNext = null;   // (how the cell was turned as its tab slept or the page went, by its key: showNext)
  function renderCell(){
    const q = allPhases().find(x=> x.id === sel) || null, info = $('CellInfo');
    const put = h =>{ if (h !== cellInfoHtml){ cellInfoHtml = h; info.innerHTML = h; } };
    setText('CellName', q ? q.prep.name : '');
    if (!q){ if (cellV) cellV.set(null); cellKeyShown = ''; cellNext = null; put('<div class="rv-empty">No phase yet: a CIF added in Phases shows its structure here.</div>'); return; }
    if (!cellV) cellV = cellView($('Cell'), { side: ()=> cellSide() });
    // (by the CIF's content too: ids start again at 1 in each project and after an undo, so
    // another CIF of the same cell kept the atoms shown before, the details the new ones, to
    // v486; and by its name, which a CIF without one takes from its file's)
    const k = q.id + '|' + cellKey(q.prep.cell) + '|' + q.prep.src + '|' + q.prep.name;
    if (k !== cellKeyShown){ cellKeyShown = k; cellV.set({ name: q.id + q.prep.name, cell: q.prep.cell, atoms: q.prep.atoms }); }
    // (the turn it had, given back on the same cell only, at its first drawing since)
    if (cellNext){ if (cellNext.key === k) cellV.setView(cellNext); cellNext = null; }
    put(cellDetailsHtml(q, q === lab6));
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
  // their own). The cell is drawn again, next frame, only when its square is no longer the
  // one drawn (up to v490 at every draw).
  let sideRaf = 0;
  function fitSide(){
    if (!cellV || sideRaf) return;
    sideRaf = requestAnimationFrame(()=>{
      sideRaf = 0;
      const cv = $('Cell').querySelector('canvas'), s = Math.round(cellSide());
      if (gone || !cv || cv.hidden || (cv.style.width === s + 'px' && cv.width === Math.round(s*(window.devicePixelRatio || 1)))) return;
      cellV.redraw();
    });
  }
  async function addCifs(fileList){
    if (locked()) return;
    const errs = [];
    let first = null;
    for (const file of fileList){
      try {
        // A file dropped may be any (the picker offers .cif alone): one not named so is read
        // all the same, a CIF under another name taken and anything else said (parseCif: "Not
        // a CIF: …"), but not one larger than any CIF of a phase, a pattern or an image.
        if (!/\.cif$/i.test(file.name) && file.size > 4e6) throw new Error('not a CIF file (.cif).');
        // (its encoding found as the text files' are, textdata.js: UTF-16 too, which
        // file.text(), UTF-8 alone, read as no CIF to v493)
        const text = decodeText(new Uint8Array(await file.arrayBuffer()));
        const prep = prepOf(text, file.name);
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
  // A press of Refine or Refine all within a moment of the last, or one of Refine within a
  // moment of its turning into Cancel or back, is not taken: the second click of a double
  // click (up to v477 it cancelled the run the first had started). A later click is.
  const QUICK = 600;
  let pressT = -Infinity, turnT = -Infinity;
  function quick(turn){ const t = performance.now(); if (t - pressT < QUICK || (turn && t - turnT < QUICK)) return true; pressT = t; return false; }
  function syncButtons(){
    const fs = host.files(), f = fs[curIdx()], on = busy || !!waiting;
    // Not now (host.blocked): a sample while the standard refines, the standard while a sample does.
    const why = !on && host.blocked ? host.blocked() : '', b = $('Refine'), label = on ? 'Cancel' : 'Refine';
    if (b.textContent !== label){ b.textContent = label; turnT = performance.now(); }
    b.disabled = !on && (!f || !!why);
    // (a wait on a run the standard's window started: Cancel ends the wait, not that run)
    b.title = waiting ? (waiting.own ? 'The standard is refined first: Cancel stops it' : 'Waiting for the standard\'s refinement: Cancel stops waiting (the standard goes on)') : why;
    if (!std){ $('RefineAll').disabled = on || !fs.length || !!why; $('RefineAll').title = why; }
    $('Clear').disabled = on || !(f && results[f.name]);
    if (!std) $('ClearAll').disabled = on || !Object.keys(results).length;
    // (the phases are read when a run starts: one added meanwhile would not be in it) The
    // drop zones as + CIF was, a button disabled then; the box refuses a drop then (cifBox).
    const off = String(on);
    [$('CifDz'), $('AddCif')].forEach(z=>{ if (z.getAttribute('aria-disabled') !== off) z.setAttribute('aria-disabled', off); });
    // (the rows' × and tick with them, at once: lockRows)
    lockRows();
    syncStd();
    syncSettings();
  }
  /* The standard's refinement on every sample card's Instrumental standard… (one standard
     for all), its window open or not: a spinner before the label, as the drop zones' while
     they read, the run's progress as a bar along the button's foot, as the card's own
     (host.stdRun: null when none runs, else { frac }, not known before the worker's first
     word), and its name and title saying so; until the run ends, is stopped or fails. To
     v492 a run went on unseen once its window was closed. */
  const stdTitle = std ? '' : $('Std').title;
  let stdShown = '';
  function syncStd(){
    if (std) return;
    const run = host.stdRun ? host.stdRun() : null, b = $('Std');
    const pct = run && Number.isFinite(run.frac) ? Math.round(Math.max(0, Math.min(1, run.frac))*100) : null;
    const k = run ? 'run:' + pct : '';
    if (k === stdShown) return;
    stdShown = k;
    b.classList.toggle('rv-std-run', !!run);
    if (!run){ b.removeAttribute('aria-busy'); b.removeAttribute('aria-label'); b.style.removeProperty('--rv-std-prog'); b.title = stdTitle; return; }
    const t = pct == null ? 'refining' : `refining, ${pct} %`;
    b.setAttribute('aria-busy', 'true');
    b.setAttribute('aria-label', `Instrumental standard… (${t})`);
    b.style.setProperty('--rv-std-prog', pct == null ? '0' : String(pct/100));
    b.title = `The instrumental standard is being refined${pct == null ? '' : ` (${pct} %)`}: its window, this button, shows the run and can stop it`;
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
      <p class="rvs-busy" hidden>Refining: these are the settings it runs with, to be changed when it ends.</p>
      <div class="rvs-body"></div>
      <button class="btn primary" type="button" data-done style="width:100%;margin-top:16px">Done</button>
    </div>`;
  (host.layer || document.body).appendChild(setModal);
  const setBody = setModal.querySelector('.rvs-body');
  let setKey = '', rebuilding = false;
  let fitNote = null;        // the Refinement section's note, when an entry was not taken
  const setOpen = () => setModal.style.display === 'flex';
  const phaseOf = id => allPhases().find(q=> q.id === id);
  // The settings, the modes and the start's groups this card shows (rowsFor).
  const { fits: fitsHere, modes: modesHere, holds: holdsHere } = rowsFor(std);
  // Open while a run goes on too, to see what it refines: read only then (syncSettings).
  function openSettings(){
    if (setOpen()) return;
    setModal.style.display = 'flex'; $('Settings').classList.add('is-on');
    setKey = ''; fitNote = null; renderSettings();
    // (capture, and stopped there: a window under this one, the standard's, closes on its own Escape)
    document.addEventListener('keydown', onSetKey, { capture: true, signal: ac.signal });
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
  // (its window in the page: one of a tab not on show, b2, leaves the key to the page)
  function onSetKey(e){ if (e.key === 'Escape' && setModal.isConnected){ e.stopPropagation(); closeSettings(); } }
  // Built again only when the phases on show change (one added or removed by an undo);
  // otherwise the inputs are set in place, keeping the focus.
  function renderSettings(){
    if (!setOpen()) return;
    const list = allPhases();
    const key = list.map(q=> [q.id, q.color, q.prep.name].join()).join('|');
    if (key !== setKey){
      setKey = key;
      const html = settingsBodyHtml(list, { p, std, lab6, modes: modesHere, holds: holdsHere, fits: fitsHere, normOptions: NORM_OPTIONS });
      // (a field focused while the body is rebuilt fires a last change on its way out: ignored)
      rebuilding = true; setBody.innerHTML = html; rebuilding = false;
    }
    syncSettings();
  }
  function syncSettings(){
    if (!setOpen()) return;
    const lock = locked();
    setModal.querySelector('.rvs-busy').hidden = !lock;
    setBody.querySelectorAll('[data-sec]').forEach(secEl=>{
      const q = phaseOf(+secEl.dataset.sec); if (!q) return;
      modesHere.forEach(m=>{
        const row = secEl.querySelector(`[data-row="${m.k}"]`), cb = row.querySelector('input'), sl = row.querySelector('select'), na = naOf(q, m.k);
        cb.checked = !!q.on[m.k]; sl.value = depOf(q, m.k);
        cb.disabled = lock || !!na; sl.disabled = lock || !!na || !q.on[m.k];
        row.classList.toggle('is-na', !!na);
        // (the standard's B: why one ΔB is its default — LAB6_CIF's numbers)
        row.title = cb.title = sl.title = na || (std && m.k === 'adp' ? m.title + ". On the standard, one ΔB is the default: held, a B 0.1 Å² off moved the profile's X by 10 esd, the profile taking up the intensities' fall with angle" : m.title);
      });
    });
    setBody.querySelectorAll('[data-start]').forEach(b=>{ const on = b.dataset.start === startFrom; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); b.disabled = lock; });
    setBody.querySelectorAll('[data-hold]').forEach(cb=>{ cb.checked = hold.includes(cb.dataset.hold); cb.disabled = lock || startFrom !== 'last'; });
    setBody.querySelectorAll('.rvs-hold').forEach(r=> r.classList.toggle('is-off', startFrom !== 'last'));
    const rn = setBody.querySelector('[data-res-norm]');
    if (rn){ rn.value = resNorm; rn.disabled = lock; }
    syncFit();
  }
  // What the automatic 1/2θ term gives for the pattern on show (autoInvOf).
  function autoInv(){ return autoInvOf(host.files()[curIdx()]); }
  // The Refinement section as the settings are: each field its value (the default when
  // not set), a field being typed in left as it is.
  function syncFit(){
    const fs = fitSettings(fit), ai = autoInv(), lock = locked();
    fitsHere.forEach(m=>{
      const row = setBody.querySelector(`[data-fit-row="${m.k}"]`); if (!row) return;
      const el = row.querySelector('[data-fit]');
      if (m.bool){
        const auto = !(m.k in fit), a = row.querySelector('[data-fit-auto]');
        a.checked = auto; a.disabled = lock;
        el.checked = auto ? ai.on : fit[m.k]; el.disabled = lock || auto;
        row.title = el.title = a.title = m.title + ai.why;
        row.querySelector('label').title = row.title;
        return;
      }
      const txt = fitTxt(m.pct ? fs[m.k]*100 : fs[m.k]);
      if (el !== document.activeElement || el.value === el.dataset.shown) el.value = txt;
      el.dataset.shown = txt; el.disabled = lock;
      row.title = m.full;
    });
    const def = setBody.querySelector('[data-fit-def]');
    if (def) def.disabled = lock || !fitShown(fit, std, fitsHere);
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
    if (locked() || rebuilding || !t.isConnected) return;
    const k = t.dataset.fit || t.dataset.fitAuto, m = FIT[k]; if (!m) return;
    if (t.dataset.fitAuto){ if (t.checked) delete fit[k]; else fit[k] = autoInv().on; }
    else if (m.bool) fit[k] = t.checked;
    else {
      const was = fitSettings(fit)[k], v = readFit(m, t.value);
      if (v === null){
        fitNote = fitRefusal(m, t.value, t.dataset.shown);
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
    if (d.resNorm != null){ if (locked()) return; resNorm = normOf(t.value); renderRes(); host.commit(); return; }
    if (locked() || !(d.on || d.depth || d.hold)) return;
    if (d.hold) hold = HOLD_KEYS.filter(k=> k === d.hold ? t.checked : hold.includes(k));
    else {
      const q = phaseOf(+d.ph); if (!q) return;
      if (d.on) q.on[d.on] = t.checked;
      else if (listOf(q, MODE[d.depth]).some(([v])=> v === t.value)) q.dep[d.depth] = t.value;
    }
    host.commit(); draw(true); syncSettings();
  }, { signal: ac.signal });
  setBody.addEventListener('keydown', e=>{
    if (e.key === 'Enter' && e.target.dataset.fit && e.target.type === 'text'){ e.preventDefault(); commitFit(e.target); }
  }, { signal: ac.signal });
  setBody.addEventListener('click', e=>{
    if (e.target.closest('[data-fit-def]')){
      if (locked() || !fitShown(fit, std, fitsHere)) return;
      fit = {}; fitNote = null; host.commit(); syncFit();
      return;
    }
    const b = e.target.closest('[data-start]');
    if (!b || locked() || b.dataset.start === startFrom) return;
    startFrom = b.dataset.start === 'last' ? 'last' : 'cif';
    host.commit(); syncSettings();
  }, { signal: ac.signal });
  setModal.addEventListener('click', e=>{ if (e.target === setModal) closeSettings(); }, { signal: ac.signal });
  setModal.querySelector('[data-done]').onclick = closeSettings;
  $('Settings').onclick = ()=> setOpen() ? closeSettings() : openSettings();

  /* CIFs in: a click, Enter or Space on the drop zone (no phase yet) or on + CIF (the
     zone of one line at the box's foot) selects them; files dropped anywhere on the Phases
     box are taken, several at once, the box lit while they are dragged over it. While a run
     goes on neither selects, and a drop is refused (the pointer says so), as + CIF was
     disabled then. Up to v498 only + CIF, a button, took CIFs in. */
  const pickCifs = ()=>{ if (!locked()) $('CifInput').click(); };
  [$('CifDz'), $('AddCif')].forEach(z=>{
    z.addEventListener('click', pickCifs, { signal: ac.signal });
    z.addEventListener('keydown', e=>{ if ((e.key === 'Enter' || e.key === ' ') && !e.altKey && !e.ctrlKey && !e.metaKey){ e.preventDefault(); if (!e.repeat) pickCifs(); } }, { signal: ac.signal });
  });
  const cifBox = $('Cifs'), withFiles = e => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  ['dragenter', 'dragover'].forEach(t=> cifBox.addEventListener(t, e=>{
    if (!withFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = locked() ? 'none' : 'copy';
    cifBox.classList.toggle('dragover', !locked());
  }, { signal: ac.signal }));
  cifBox.addEventListener('dragleave', e=>{ if (!cifBox.contains(e.relatedTarget)) cifBox.classList.remove('dragover'); }, { signal: ac.signal });
  cifBox.addEventListener('drop', e=>{
    if (!withFiles(e)) return;
    e.preventDefault();
    cifBox.classList.remove('dragover');
    const fl = [...e.dataTransfer.files];
    if (!locked() && fl.length) addCifs(fl);
  }, { signal: ac.signal });
  $('CifInput').addEventListener('change', e=>{ const fl = [...e.target.files]; e.target.value = ''; if (fl.length) addCifs(fl); }, { signal: ac.signal });
  /* A phase's CIF downloaded (its button left of its ×; up to v502 none): its text as the
     card read it, which is the file's in UTF-8 whatever its encoding (decodeText: a UTF-16
     file comes out in UTF-8, a UTF-8 one's mark dropped), under its file's name, else its
     name's; the built-in LaB6's as written here (LAB6_CIF). As bytes, as the file list gives
     a file's: as text (downloadBlob, typed CSV) the browser adds '.csv' to a name with no
     extension. Nothing changes: no step of the history, a run going on or not; the row is
     not selected. */
  const cifFile = q => q === lab6 ? LAB6_FILE : q.file || fileSafe(q.prep.name || 'phase') + '.cif';
  $('PhaseList').addEventListener('click', e=>{
    const dl = e.target.closest('[data-dl]');
    if (dl){ const q = allPhases().find(x=> x.id === +dl.dataset.dl); if (q && typeof q.cif === 'string') downloadBytes(cifFile(q), new TextEncoder().encode(q.cif)); return; }
    const del = e.target.closest('[data-del]');
    if (del){
      if (locked() || del.disabled) return;
      const id = +del.dataset.del;
      phases = phases.filter(q=> q.id !== id);
      if (pick === id) pick = 0;
      // A result refined with the phase is no longer the model's: it goes with it.
      Object.keys(results).forEach(k=>{ if ((results[k].phases || []).includes(id)) delete results[k]; });
      draw(true); renderSettings(); host.commit();
      if (std && host.changed) host.changed();
      return;
    }
    /* A tick or choice locked (lockRows): its click cancelled, which puts its state back,
       a click's, Space's or an arrow key's between the choices, and no change follows. */
    if (e.target.closest('input')){ if (locked()) e.preventDefault(); return; }
    const row = e.target.closest('[data-sel]');
    if (!row || +row.dataset.sel === sel) return;
    sel = +row.dataset.sel;
    renderPhases();
  }, { signal: ac.signal });
  $('PhaseList').addEventListener('change', e=>{
    const t = e.target;
    if (locked()) return;
    if (t.dataset.pick != null){ pick = +t.dataset.pick; draw(true); host.commit(); return; }
    if (t.dataset.on != null){
      const q = phases.find(x=> x.id === +t.dataset.on), f = host.files()[curIdx()];
      if (!q || !f) return;
      if (t.checked) delete q.off[f.name]; else q.off[f.name] = true;
      draw(true); host.commit();
    }
  }, { signal: ac.signal });
  $('Refine').onclick = ()=>{
    if (quick(true)) return;
    if (busy || waiting){ cancel(); return; }
    press(false);
  };
  $('Clear').onclick = ()=>{ const f = host.files()[curIdx()]; if (!f || locked() || !results[f.name]) return; delete results[f.name]; draw(true); host.commit(); if (std && host.changed) host.changed(); };
  if (!std){
    // (the standard is one pattern: its window has neither)
    $('RefineAll').onclick = ()=>{ if (!quick() && !busy && !waiting) press(true); };
    // Every pattern's result, those of the files left out too (an undo brings them back).
    $('ClearAll').onclick = ()=>{ if (locked() || !Object.keys(results).length) return; results = {}; draw(true); host.commit(); };
    $('Prev').onclick = ()=> host.step(-1);
    $('Next').onclick = ()=> host.step(1);
    $('Std').onclick = ()=> host.openStd();
  }

  return {
    res,
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
    // A label or a colour changed, a sample stepped to, the card unfolded, the tab on show
    // again or resized, the standard refined: each view drawn again where what it shows
    // changed (a table drawn out of sight with its plot, whose size is in its key).
    redraw(){ draw(true); },
    // The standard's profile for the samples (the standard's card).
    irf: ownIrf,
    // A run going on here (its own worker's: not a wait for the standard's), or either
    // (active), ending it as Cancel does, and the buttons as the other cards' runs leave
    // them (host.blocked).
    running: ()=> busy,
    active: ()=> busy || !!waiting,
    // The run going on here and how far it is, or null (the standard's card: its button on
    // the samples' cards, syncStd).
    progress: ()=> busy && cur ? { frac: cur.frac } : null,
    syncStd,
    cancel,
    sync: syncButtons,
    // The standard refined for a sample ("Refine the standard first", host.refineStd).
    run(tell){
      if (busy){ if (cur) cur.tell = tell; return { own: false, done: curP }; }
      const why = host.blocked ? host.blocked() : '';
      return why ? { why } : { own: true, done: start(host.files().slice(), tell) };
    },
    /* The card closed (or turned into another kind, set aside then dropped): a run going on
       ends as the kind switch ends it (cancel(false): the card goes, its last state is the
       history's), nothing drawn after, the workers of its jobs terminated (the pool lets
       its idle ones go after a while, xrd-rv-pool.js). Up to v483 a card closed mid-run
       kept refining unseen, drew its 3D views on the detached card when it ended, and every
       card that had refined left its worker alive. */
    destroy(){ gone = true; cancel(false);
      closeSettings(); setModal.remove(); if (cellV) cellV.destroy(); solidViews.forEach(({ view })=> view.destroy()); solidViews = []; ac.abort(); },
    /* What it shows beside its state (b2v4, xrd.js): the peak picked in its table of widths,
       how each crystallite's solid was turned (by pattern and solid, as solidTurns), the
       phase on show (by its id and name) and how its unit cell was turned (by the cell's key,
       cellKeyShown), given back as its tab wakes or the page is reloaded, the state restored,
       for its next drawing. The phase on show is in its state too (sel: an undo goes back to
       its step's, a project saved reopens on it), but a click on its row is no change, and
       its record held the one before till the next (to b2v4 a reload showed it). */
    shows(){
      const turns = new Map(solidTurns);
      solidViews.forEach(({ view, turnKey })=>{ if (view.getView) turns.set(turnKey, view.getView()); });
      const v = {}, q = allPhases().find(x=> x.id === sel), cell = cellV && cellKeyShown ? cellV.getView() : null;
      if (pkSel) v.pk = { ...pkSel };
      if (turns.size) v.turns = [...turns];
      if (q) v.sel = { id: q.id, name: q.prep.name };
      if (cell) v.cell = { key: cellKeyShown, R: cell.R };
      else if (cellNext) v.cell = cellNext;
      return Object.keys(v).length ? v : null;
    },
    showNext(v){
      const p = v && v.pk;
      if (p && typeof p.file === 'string' && typeof p.lab === 'string' && Number.isFinite(p.tt) && Number.isFinite(p.ph))
        pkSel = { file: p.file, tt: p.tt, lab: p.lab, ph: p.ph, color: typeof p.color === 'string' ? p.color : '#888' };
      if (v && Array.isArray(v.turns)) v.turns.slice(-50).forEach(e=>{ if (Array.isArray(e) && typeof e[0] === 'string' && e[1] && typeof e[1] === 'object') solidTurns.set(e[0], e[1]); });
      // (the phase where it is still there under its name; the cell's turn at its next drawing)
      const s = v && v.sel, q = s && allPhases().find(x=> x.id === s.id);
      if (q && q.prep.name === s.name) sel = q.id;
      const c = v && v.cell;
      cellNext = c && typeof c.key === 'string' && Array.isArray(c.R) ? { key: c.key, R: c.R } : null;
    },
    // The card's state as saved (stateOf).
    snapshot(){ return stateOf({ phases, std, lab6, pick, start: startFrom, hold, fit, nextId, sel, results, view: res ? { sizeBy, resNorm } : null }); },
    /* step: an undo or a redo. One while a run goes on here, or waits for the standard's
       (locked), keeps what the run takes as it starts (the phases with their settings and
       ticks, the standard's settings and choice, the start, the Refinement settings: their
       controls locked meanwhile, the states above the history's mark hold them alike) and
       the patterns it has written (wrote), over the state's results, whose others come in
       (a file brought back brings its own; a during-run state's part of the run's is the
       release's to write); what the views show (the phase on show, the Results' size by and
       normalisation) is the state's. The panel is not built again: its run, its progress,
       Cancel, the Settings read only, the rows locked (to v508 no step came while a run went
       on). */
    restore(s, step){
      s = s || {};
      const keep = !!step && locked();
      if (!keep){
        const t = readState(s, std);
        phases = t.phases;
        if (std){ Object.assign(lab6, t.std); pick = t.pick; }
        startFrom = t.start; hold = t.hold;
        // (a note on an entry not taken is about the settings before)
        fit = t.fit; fitNote = null;
        nextId = t.nextId;
        setKey = '';
      }
      sel = Number.isInteger(s.sel) ? s.sel : null;
      results = resultsOf(s);
      if (keep && wrote) Object.assign(results, wrote);
      sizeBy = s.sizeBy === 'peak' ? 'peak' : 'sample'; resNorm = normOf(s.resNorm);
      // A run going on is the module's own, read out and in again (a saved project's CSVs,
      // runWithModuleState; a run is stopped before another project comes in): it goes on
      // into the results restored; or stepped through (above). Nothing running,
      // the last run's words go (they were about the state before: "Stopped…" otherwise
      // showed on the next project), and a choice still open is dropped (press).
      gen++;
      if (!busy && !waiting) setStatus('');
      syncButtons();
    },
    // The CSVs: every refined pattern's curves, and one row per pattern and phase.
    csvEntries(pre){ return csvTables(pre || '', host.files(), results, { curves: curvesOf, stale: staleOf, std }, { data: fmtData, line: csvLine, decimal: settings.decimal }); },
    setName(n){ csvPre = n ? n + ' - ' : ''; nameFiles(); },
  };

  // The downloads named after the card, in the card and in its Results section.
  function nameFiles(){
    sizeNames();
    [root, res].filter(Boolean).forEach(el=>{
      el.querySelectorAll('[data-csv-base]').forEach(b=>{ b.dataset.csvNames = csvPre + b.dataset.csvBase; });
      el.querySelectorAll('.plot-dl-btn[data-dl-base]').forEach(b=> b.dataset.dlName = csvPre + b.dataset.dlBase);
      el.querySelectorAll('.plot-wrap').forEach(w=>{ const d = w.querySelector('.plot-dl-btn[data-csv-names]'), c = w.querySelector('.plot-csv-btn'); if (d && c) c.dataset.csvNames = d.dataset.csvNames; });
    });
  }
}

/* The card's section of the Results: the refined patterns stacked, and the crystallite
   sizes (by sample or by peak, the chips in the plot's corner), as the Scherrer card's. */
function resHtml(p){
  return `
        <h4 class="res-an-title"></h4>
        <p class="txt-meta" id="${p}ResNone">No pattern refined yet: <b>Refine</b> in the card above.</p>
        <div class="row res-row" style="gap:16px">
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Refinement: observed less the background</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}ResSvg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}ResSvg" data-csv-mod="xrd" data-csv-base="rietveld_pattern.csv" data-csv-names="rietveld_pattern.csv" data-dl-base="XRPD_results_rietveld.svg" data-dl-name="XRPD_results_rietveld.svg" data-dl-legend="${p}ResLegend">${DL_SVG}</button>
            </div>
            <div id="${p}ResLegend" class="legend"></div>
          </div>
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Crystallite size</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}SizeSvg"></svg>
              <span class="plot-chips" id="${p}SizeBy"></span>
              <button class="btn plot-dl-btn" data-size-dl data-dl-svg="${p}SizeSvg" data-csv-mod="xrd" data-csv-names="rietveld_results.csv" data-dl-name="XRPD_rietveld_size.svg" data-dl-legend="${p}SizeLegend">${DL_SVG}</button>
            </div>
            <div id="${p}SizeLegend" class="legend"></div>
            <div id="${p}SizeNote" class="txt-meta"></div>
          </div>
        </div>`;
}

/* The card's markup (and the standard's window's: the same, with one pattern and one
   phase chosen): the pattern with the phases and the structure beside it, the buttons
   under them ending with the plot; the results across under it; then the Williamson–Hall
   plot, the tests on the widths and the crystallites' shape in one row; the peak widths'
   table at the foot. */
function rvHtml(p, std){
  return `
        <div class="pside">
          <div class="plot-nav-row pside-nav">
            <div class="plot-nav-left">${std ? '' : `
              <button class="btn nav-arrow an-prev" id="${p}Prev" aria-label="Previous sample" title="Previous sample (&#8592;)">&#8249;</button>
              <span id="${p}Idx" class="pill nav-count" style="margin:0">1/1</span>
              <button class="btn nav-arrow an-next" id="${p}Next" aria-label="Next sample" title="Next sample (&#8594;)">&#8250;</button>
              <span class="txt-caption" id="${p}Label">—</span>`}
            </div>
          </div>
          <div class="pside-plot">
            <div class="plot-wrap">
              <svg class="plot" id="${p}Svg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-base="rietveld_pattern.csv" data-csv-names="rietveld_pattern.csv" data-dl-base="XRPD_rietveld.svg" data-dl-name="XRPD_rietveld.svg" data-dl-legend="${p}Legend">${DL_SVG}</button>
            </div>
          </div>
          <div class="pside-under">
            <div id="${p}Legend" class="legend"></div>
            <p class="txt-meta" id="${p}Instr"></p>
          </div>
          <div class="pside-col rv-side">
            <div class="rv-boxes">
              <div class="peak-box rv-cifs" id="${p}Cifs">
                <div class="peak-box-head">
                  <span class="txt-mini">Phases</span>
                  <input type="file" id="${p}CifInput" accept=".cif,.CIF" multiple style="display:none">
                </div>
                <div class="rv-ciflist" id="${p}PhaseList"></div>
                <div class="dropzone rv-cifdz" id="${p}CifDz" role="button" tabindex="0" hidden>
                  <div class="dz-icon" aria-hidden="true">⤒</div>
                  <div class="dz-title">Drag here CIF files, or click to select them.</div>
                  <div class="txt-meta">.cif</div>
                </div>
                <div class="dropzone rv-cifdz rv-cifdz-mini" id="${p}AddCif" role="button" tabindex="0" aria-label="+ CIF: add phases from CIF files" title="Add phases from CIF files: a click selects them, or drop them anywhere on Phases"><span class="rv-cifdz-plus" aria-hidden="true">+</span> CIF: drop or click</div>
              </div>
              <div class="peak-box rv-cellbox">
                <div class="peak-box-head"><span class="txt-mini">Structure</span><span class="rv-cell-name" id="${p}CellName"></span></div>
                <div class="rv-cell" id="${p}Cell"></div>
                <div class="rv-cell-info" id="${p}CellInfo"></div>
              </div>
            </div>
            <div id="${p}Status" class="txt-meta rv-status"></div>
            <div id="${p}ProgWrap" class="rv-prog" style="display:none"><div id="${p}ProgBar"></div></div>
${std ? `
            <div class="rv-btns">
              <button class="btn primary" id="${p}Refine">Refine</button>
              <button class="btn" id="${p}Settings" aria-haspopup="dialog" title="What Refine refines, on the standard's phase, and where it starts">Settings…</button>
              <button class="btn" id="${p}Clear" title="The standard's result">Clear</button>
            </div>` : `
            <div class="rv-btns">
              <button class="btn primary" id="${p}Refine">Refine</button>
              <button class="btn primary" id="${p}RefineAll">Refine all</button>
            </div>
            <div class="rv-btns">
              <button class="btn" id="${p}Settings" aria-haspopup="dialog" title="What Refine refines, for each phase, and where it starts">Settings…</button>
              <button class="btn" id="${p}Std" aria-haspopup="dialog" title="The instrumental standard: its file, its phase and its refinement, whose profile every sample takes">Instrumental standard…</button>
            </div>
            <div class="rv-btns">
              <button class="btn" id="${p}Clear" title="This pattern's result">Clear</button>
              <button class="btn" id="${p}ClearAll" title="Every pattern's result">Clear all</button>
            </div>`}
          </div>
        </div>
        <div class="peak-box rv-fit">
          <div class="peak-box-head rv-fit-head"><span class="txt-mini">Refinement</span><span class="rv-fit-set" id="${p}FitSet"></span></div>
          <div class="rv-fit-grid" id="${p}Results"></div>
        </div>
        <!-- The peaks' own widths, each reflection fitted alone: the Williamson-Hall plot, the
             tests on them and the crystallites' shape in a row, as tall as the plot; their
             table at the card's foot -->
        <div id="${p}Widths" class="rv-widths" style="display:none">
          <div class="rv-wrow">
            <p class="txt-caption">Williamson–Hall</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}WhSvg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}WhSvg" data-csv-mod="xrd" data-csv-base="rietveld_peaks.csv" data-csv-names="rietveld_peaks.csv" data-dl-base="XRPD_williamson_hall.svg" data-dl-name="XRPD_williamson_hall.svg" data-dl-legend="${p}WhLegend">${DL_SVG}</button>
            </div>
            <div id="${p}WhLegend" class="legend"></div>
            <div class="peak-box rv-tests">
              <div class="peak-box-head"><span class="txt-mini">Tests on the widths</span></div>
              <div class="rv-tests-body" id="${p}Tests"></div>
            </div>
            <div class="peak-box rv-solids" id="${p}Solids"></div>
          </div>
          <div class="peak-box rv-wtable">
            <div class="peak-box-head">
              <span class="txt-mini">Peak widths</span>
              <button class="btn table-csv-btn" data-csv-mod="xrd" data-csv-base="rietveld_peaks.csv" data-csv-names="rietveld_peaks.csv" title="Download CSV">${CSV_SVG}</button>
            </div>
            <div id="${p}PkWrap"></div>
          </div>
        </div>`;
}
