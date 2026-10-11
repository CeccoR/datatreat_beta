# How the Rietveld refinement works

The *Rietveld* card of the XRPD module refines powder patterns against crystal structures read from CIF files. It runs in the browser: nothing is sent to a server. This document describes the method as it is implemented. It covers:

- the model of the pattern;
- the least-squares solver;
- the staged strategy that takes a pattern from a CIF cell to a converged fit;
- the instrumental standard;
- the size, strain and fault broadening, by Lorentzian widths or by Whole Powder Pattern Modelling;
- the displacement parameters;
- preferred orientation and the crystallite-shape model;
- the single-peak width tests;
- what is reported, and with which uncertainties.

Each choice comes with its reason, and with the evidence it rests on where there is some. Most of that evidence is in the code's own comments and in the commit messages from v418 to v425.

The document follows the code as of v425. Functions are named with their file, e.g. `autoRefine` (`xrd-rietveld.js`), so that the references survive edits better than line numbers.

## Contents

1. [Overview](#1-overview)
2. [Inputs: the pattern, the instrument, the phases](#2-inputs-the-pattern-the-instrument-the-phases)
3. [The calculated pattern](#3-the-calculated-pattern)
4. [The parameters](#4-the-parameters)
5. [Least squares](#5-least-squares)
6. [The refinement strategy](#6-the-refinement-strategy)
7. [Instrument, size and strain](#7-instrument-size-and-strain)
8. [Displacement parameters](#8-displacement-parameters)
9. [Preferred orientation](#9-preferred-orientation)
10. [The free crystallite shape](#10-the-free-crystallite-shape)
11. [Weight fractions, cell volume, displacement](#11-weight-fractions-cell-volume-displacement)
12. [Peak widths and the tests that use them](#12-peak-widths-and-the-tests-that-use-them)
13. [The worker, the card and the exports](#13-the-worker-the-card-and-the-exports)
14. [Validation](#14-validation)
15. [Limits, and what could come next](#15-limits-and-what-could-come-next)
16. [Known issues](#16-known-issues)
17. [References](#17-references)

---

## 1. Overview

### 1.1 Using it

1. Load the patterns in the XRPD module (`.xrdml`), and mark the measurement of the instrumental standard (NIST SRM 660c LaB₆) as the standard.
2. Add each phase from a CIF (**+ CIF**). The standard's LaB₆ is built in.
3. Optionally, set per phase:
   - a preferred orientation (none, *best axis*, or a plane);
   - a crystallite shape (isotropic, or one of five solids);
   - the size profile (Lorentzian; WPPM, one size; WPPM, a log-normal distribution of sizes);
   - the microstrain (isotropic, or anisotropic after Stephens);
   - planar faults (none, or one of six kinds);
   - the displacement parameters (the CIF's; one ΔB; B per site; Uⁱʲ per site).
4. **Refine all** refines the standard first, then every sample with the standard's instrumental profile.
5. Read the results:
   - the result lines (with esds in brackets) and the warnings;
   - the pattern plot (observed, calculated, background, difference, ticks);
   - for samples, the peak-width table, the Williamson–Hall plot and the tests;
   - with a shape, the 3D view of the solid.

   Three CSV files export everything.

### 1.2 The modules

| File | Lines | Role |
|---|---|---|
| `xrd-data.js` | 450 | Reference tables: X-ray form factors (Waasmaier–Kirfel), anomalous dispersion (Chantler; Cromer–Liberman for Np–Cf), atomic masses; the species of a site label. |
| `xrd-cryst.js` | 1063 | CIF reading, symmetry from the atoms, conventional cells, reflection lists with multiplicities and absences, structure factors, the sites and the displacement parameters their symmetry allows. |
| `xrd-instr.js` | 328 | The instrument as the `.xrdml` header describes it; the scan itself (2θ, intensities, their variance) and the file's encoding. |
| `xrd-rietveld.js` | 2819 | The engine: the model, the profile, least squares, the staged strategy, preferred orientation, the free shape, sizes and weight fractions. |
| `xrd-broad.js` | 430 | Whole Powder Pattern Modelling (a line synthesised from its Fourier coefficients by FFT; the solids' common-volume functions; the log-normal average), Stephens' quartic invariants, the planar-fault table. |
| `xrd-rietveld.worker.js` | 400 | Runs a refinement off the main thread; formats the result lines and the CSV rows. |
| `xrd-widths.js` | 333 | Single-peak widths after the refinement; Williamson–Hall, order and prediction tests. |
| `xrd-rv.js` | 652 | The card: phases, options, runs, plots, results, state, exports. |
| `xrd-shape3d.js` | 1359 | The rotatable 3D view of a crystallite solid (2D canvas, no WebGL). |

The engine modules (`xrd-data`, `xrd-cryst`, `xrd-instr`, `xrd-broad`, `xrd-rietveld`, `xrd-widths`) are pure functions, with no DOM. The page, the worker and Node all import them, so they can be tested under Node (§14).

### 1.3 What happens on Refine

```mermaid
flowchart TD
  A[".xrdml file<br/>2θ, counts, header"] --> B["xrd-instr: λ1, λ2, ratio,<br/>radius, monochromator"]
  C["CIF"] --> D["xrd-cryst: parse, expand,<br/>find symmetry, check composition"]
  B --> E["buildModel<br/>weights, reflections, parameters"]
  D --> E
  E --> F["autoRefine<br/>cell search or zero scan,<br/>staged least squares,<br/>phase detection, strain, faults,<br/>size distribution, displacements, texture"]
  F --> G{"shape requested<br/>and standard refined?"}
  G -- yes --> H["freeShape<br/>multistart search, exact faces,<br/>held on the lattice, ΔBIC"]
  G -- no --> I
  H --> I["summarise<br/>result lines, esds, CSV rows,<br/>angular esds by profile"]
  I --> J["measureWidths<br/>single-peak fits, WH, orders,<br/>predictions (samples only)"]
  J --> K["card: plot, results,<br/>widths table, 3D view, CSV"]
```

The standard's refinement produces the instrumental resolution function (*irf*): Caglioti U, V, W; Lorentzian X, Y; the axial-divergence asymmetry; the zero. Every sample refined afterwards takes it as its instrument.

### 1.4 Conventions

- **Angles.**
  - The data, the peak positions and all widths are in degrees 2θ.
  - θ in the formulas is the Bragg angle of the line, in radians where the code needs it.
  - All profile widths are **FWHM** unless a section says integral breadth (β).
- **Size and strain conventions.** Both are read on the Lorentzian FWHM (§7.2): the Scherrer size with K = 0.9, and the microstrain ε with H = 4ε·tanθ. Stokes and Wilson read the strain on the integral breadth β, which for a Lorentzian is π/2 times the FWHM: their e = β/(4 tanθ) is 1.571× this ε (and their apparent strain η = β·cotθ = 4e is 2π× it). GSAS-II's isotropic microstrain μ (in 10⁻⁶; a Lorentzian FWHM of μ·10⁻⁶·tanθ in radians) is 4ε·10⁶. Literature values need these factors.
- **Reciprocal length.** s = sinθ/λ = 1/(2d), in Å⁻¹ (the variable of form factors and Debye–Waller factors). Where the profile theory needs it, d\* = 1/d = 2sinθ/λ.
- **Units.**
  - Cell lengths in Å; crystallite sizes in nm.
  - B in Å² (B = 8π²U).
  - The specimen displacement is reported in mm.
- **Indices.**
  - (hkl) is a plane and its reflection; {hkl} is its family.
  - [uvw] is a lattice direction; ⟨uvw⟩ is its family.
  - All are given in the **conventional** cell, even when the CIF holds a primitive one.
- **Esds** are written as 3.9151(8): the esd rounded to one significant digit (two when that digit is 1), the value rounded to the same last digit, and the esd in units of that digit (`fmtEsd`, worker; `fmtE`, card). An esd that rounds up to the next leading digit keeps one digit (0.0096 gives 1.50(1)); one of 10 or more in the units rounds the value to its tens or hundreds (125 ± 314 gives 100(300)).

## 2. Inputs: the pattern, the instrument, the phases

### 2.1 The pattern and its weights

The XRPD module (`xrd.js`) reads each `.xrdml` file through `readXrdmlScan` (`xrd-instr.js`), which also gives the reason when it refuses one. A scan recorded downwards (start above end) is turned round, with its variances: the module's plots, its peak search and the Rietveld card take 2θ ascending (up to v425 the card kept no tick before a refinement and drew the range reversed).

**Encoding.** The text is decoded from the file's bytes as the XML specification's appendix F says: a byte-order mark (UTF-8, UTF-16 LE or BE), else UTF-16 by the zero byte beside each of the first two characters, else the declaration's `encoding="…"`, else UTF-8 (`decodeXml`). Bytes that read as ASCII cannot be UTF-16, so a declared UTF-16 is then ignored (a UTF-8 file written from a .NET string declares it). `Blob.text()`, which v425 used, decodes UTF-8 alone, so a UTF-16 file was reported invalid. The card's header reader gets the same bytes.

**2θ** comes from the `2Theta` `<positions>` of the first scan:
- start and end: an evenly spaced grid over the points;
- `<listPositions>`: one per point;
- a `<commonPosition>` alone means 2θ stood still (an ω or rocking scan): refused;
- a missing or invalid start or end: refused. Up to v425 the test used the global `isFinite`, for which null is finite, and such a file loaded with every 2θ at 0.

**The intensities.**
- **`<intensities>`** (XRDML 1.x) are already on the unattenuated scale: the instrument multiplied the points counted through the automatic attenuator by its factor when it wrote the file (GSAS-II, xrayutilities and GenX read them so). Up to v424 the `beamAttenuationFactors` were applied a second time, which put an attenuated peak top 10–200× too high.
- **`<counts>`** (XRDML 2.x) are the raw counts: they are multiplied by the attenuation factors here, as xrayutilities does. Up to v425 such a file was reported invalid.
- **An attenuation list that cannot be used** (another length than the points, a factor that is not a positive number) refuses raw `<counts>`, whose attenuated points would stay uncorrected; with `<intensities>` it is ignored with a note, since only their variance needs it (v425 dropped it silently).
- **Counting times** are read with their unit (s, ms, µs, min).
- **Unequal counting times** (`<countingTimes>`, one per point: a pre-set-counts scan, whose counts sit about the preset everywhere, or a variable-time scan) make a pattern only as rates: the counts are divided by their times, and the loader says so. A pre-set-counts scan in counts without its times is refused; v425 loaded it as a nearly flat pattern. One in cps without its times is loaded with a note: its pattern is right, but its weights take every point as counted for the same time.
- **A rate with no counting time** gets its time from the noise, with a note. For Poisson counts the second difference d = y₋ − 2y + y₊ has variance m·(μ₋ + 4μ + μ₊) ≈ 6m·ȳ, m = 1/t, so d²/(6ȳ) is m times a χ²₁ variable, whose median is 0.4549; the median over the points ignores the peaks while they hold fewer than half of them. On synthetic patterns (10–250 peaks, backgrounds of 3–300 counts, 0.5–100 s) it finds t within 10 % with 10 peaks in 100°, 18 % with 60 and 37 % with 250 (on 300 counts). t sets the one-count floor, the target's shift (below: a t 37 % short moves the background about 0.6 count) and the χ² scale; the esds do not depend on it, being scaled by χ²_ν. v425 took 1 s: χ²_ν then read about 1/t (0.04 at 12 s), and the free shape's ΔBIC, which weighs a χ² difference against max(1, χ²_ν), took the evidence as t times weaker.

**Variance multiplier.** Each point carries `varMul`, so that var(y) = y·varMul: the factor that turns one count into the units of y, that is the attenuation factor, divided by the counting time when y is a rate. `varMul` is attached when it is not 1 throughout.

**What `buildModel` (`xrd-rietveld.js`) does with them:**
- **Descending scans.** A descending scan is held ascending internally: peak windows are found by bisection. Results are returned in the caller's order.
- **Bad 2θ.** A 2θ that is not a number throws, naming the point. A NaN would otherwise enter the background basis and every sum.
- **Missing counts.** A missing or non-finite count, or a non-positive `varMul`, gives the point zero weight.
- **Weights: Mighell's χ²_γ** (*ApJ* 518 (1999) 380). With m_i = varMul_i (one count in the units of y; scaled when the noise says otherwise, below) and the counts N_i = y_i/m_i, the fit's target and variance are N + min(N, 1) and N + 1; in the units of y,

  ```math
  T_i = y_i + \min(y_i^+, m_i),\qquad \sigma_i^2 = (y_i^+ + m_i)\, m_i ,\qquad w_i = 1/\sigma_i^2 ,\qquad y^+ = \max(y, 0)
  ```

  and the fit minimises Σ w_i (T_i − y_c,i)².
  - *The floor is one count in any unit.* v425's σ² = max(y, 1)·varMul floored a rate file at 1 cps, that is t counts: with t = 12 s, points under 13 counts were under-weighted by up to 12×, and χ²_ν of a 5-count background was 0.43 read as cps against 1.29 read as counts (1.06 both now).
  - *No background bias.* At the true mean μ, (N + min(N, 1) − μ)/(N + 1) averages exactly 0 over Poisson N. Weighting by the observed counts, 1/max(y, 1), as GSAS and FullProf do, pulls the background 1.0–1.2 counts per point low (a point that fluctuates low weighs more): 22 esd on a 5-count pattern.
  - *The scales.* Monte Carlo of one peak on a flat background (4000 realisations): 1/max(y, 1) biases the scale +0.5 % at 10 counts per point, +1.4 % at 5 and −4.6 % at 2, χ²_γ +0.25 %, +0.6 % and +0.8 %; on whole two-phase patterns at 5 counts no bias is resolved (−0.1 % and +0.3 %, within 1.2 standard errors of 30 realisations, where 1/max(y, 1) gives +0.4 % and +1.0 %, the second at 4 standard errors). Weights from the model (iterated) remove the scale bias too, but a peak the model lacks then pulls the scale harder: 2× at 30 % of the modelled peak's area, 4–5× at 100 %; χ²_γ keeps the data's weights.
  - *χ²_ν.* Its expectation is within 14 % of 1 per point from one count up (exact sums over N); with 1/max(y, 1) it is 1.64 at 5 counts, 1.31 at 10.
  - *The count is checked against the noise.* The target's shift needs m right: with one count taken k times too large, the background moves about k − 1 counts wherever the counts exceed k (+11 at k = 12, a rate with no counting time; exact sums over N), where 1/max(y, 1) stays about a count low whatever k. So `buildModel` estimates one count from the noise of y/m as the loader does for a rate with no time (`noiseCountScale`). On Poisson counts the estimate is 0.82–13 over 225 synthetic patterns (five structure sets from cubic to triclinic, steps 0.01–0.05°, sizes 8–200 nm, backgrounds 0.2–100 counts; the high end from sharp peaks at coarse steps). Below 1/2 the data are not counts in the units given (a rate with no time, as a session saved by v425 holds one; averaged, rescaled or smoothed counts), and the noise's count is used, with a warning: on a 4-count rutile pattern given as cps with no time, the background goes from 7.6 counts (truth 4) and ΔB 15 esd off to the refinement of the same counts given as counts: every other parameter within 0.03 esd, the background within 0.12 count.

  The agreement indices (§3.10) are computed with T; the card plots y and y − y_c.
- **Too few points.** Fewer than 10 weighted points (`MIN_POINTS`) is an error.

### 2.2 The instrument from the `.xrdml` header (`xrd-instr.js`)

**Reading the file.**
- The header is read by a small tolerant XML reader. A stray end tag closes back to its element or is ignored ("a header half-read beats none").
- It stops at the end of the first `<xrdMeasurement>`.
- A DOM entry point and a text entry point share the field logic through a five-function accessor, so the two cannot drift apart. The card uses the text one.
- Values the file does not give are left `undefined`, so `??` and `isFinite` read them as missing.

**What is read.**

| Item | Read from | Used by the model |
|---|---|---|
| Kα1, Kα2, Kβ, Kα2/Kα1 ratio | `usedWavelength` (else the anode's table, else Cu) | λ1, λ2, ratio |
| Anode | `anodeMaterial`, else the tube name (`… Cu LFF`) | defaults only |
| Goniometer radius | incident (else diffracted) beam path | the displacement in mm |
| Divergence slit | `xsi:type`, name, angle, or height at a distance | warnings, display |
| Incident Soller slit, filter | elements and names | display only |
| Anti-scatter slits, mask, diffracted Soller slit | elements and names | read, not used |
| Monochromator | any element named `*monochromator*` on each side: its crystal, reflection and number of reflections, from `<crystal>`, `<hkl>`, `<numberOfReflections>`, else from its name (`Hybrid 2xGe(220)`, `4xGe220`, `Ge(220) four-bounce`, `Bartels`, `Graphite (002)`) | polarisation K (LP, §3.4); Kα2 dropped behind a perfect crystal on the incident side |
| Sample mode, scan axis | `xrdMeasurement`, `scan` | warnings |
| Detector | `detector` | display (its name) |
| Scan mode, counting time | `scan` | read, not used (the scan reader of §2.1, `readScan`, reads them again for the weights) |

**Defaults, each with a warning shown on the card's instrument line.**

| Missing or invalid | Assumed |
|---|---|
| No wavelength | the anode's Kα1, Kα2, ratio 0.5. Cu's are as X'Pert Data Collector writes them (1.540598, 1.544426 Å); the other anodes' are Bearden's (*Rev. Mod. Phys.* 39 (1967) 78). Cu if the anode is unknown or has no table |
| λ1 but no Kα2 | a single wavelength (λ2 = λ1, ratio 0) |
| Ratio outside [0, 1] or missing | 0.5 |
| No radius | 240 mm (the displacement in mm depends on it, and the standard's radius is compared with it: §7.1) |
| A monochromator crystal not recognised | graphite (002), K = 0.800 at Cu |
| A recognised crystal with no reflection, or one that cannot diffract λ | its usual one: Ge and Si (111), LiF (200), quartz (10-11); graphite (002), its only one, without a warning |

**Geometries the model does not handle are warned about, not corrected:**
- a sample mode other than reflection;
- a scan axis other than the coupled θ–2θ (`Gonio`);
- an automatic divergence slit, whose intensities grow as sinθ against a fixed slit;
- a programmable slit with no irradiated length;
- an unknown or missing divergence slit, which is taken as fixed;
- an incident-beam crystal not recognised with a Kα2 ratio, which is kept but in doubt.

**Kα2 behind a perfect incident crystal.** A perfect crystal (Ge, Si, quartz) before the sample passes Kα1 alone: the Kα1–Kα2 separation is about eight of its Darwin widths (124″ against 16″ at Ge 111). The file's Kα2 ratio is then set to 0, with a warning (v425 kept the file's 0.5, a phantom Kα2).

**What the model uses:** λ1, λ2, the ratio, the monochromators' polarisation K (`monoK`, the product of both sides'), and the radius. The card's instrument line shows each crystal and K. A file whose header cannot be read gives Cu Kα1/Kα2 at ratio 0.5, R = 240 mm and no monochromator ([Known issues](#16-known-issues)).

### 2.3 Phases from CIF files (`xrd-cryst.js`, `prepPhase` in `xrd-rv.js`)

**The parser** reads a CIF 1.1 subset, and accepts DDLm tag spellings (`_atom_site.fract_x`). Throughout, it refuses what would give a wrong pattern without an error, and warns where it assumes.

*Block, cell and operations.*
- **Block.** The first data block with fractional coordinates is used. A file holding more structures says which one was taken. A file with only Cartesian coordinates is refused.
- **Cell.**
  - Lengths must be positive.
  - An invalid angle becomes 90°, with a warning.
  - Angles that form no cell are refused (V must exceed 10⁻⁶·abc): 120/120/120° gives V = 0, and 60/60/130° a negative metric determinant.
- **Symmetry operations** come from `_space_group_symop_operation_xyz` or `_symmetry_equiv_pos_as_xyz`.
  - Each is parsed strictly. A misread operation would silently produce a wrong structure, so an operation with a non-integer rotation or |det R| ≠ 1 is dropped, with a warning. The file is read with the rest, and the group check then usually reports the list as incomplete.
  - Translations are snapped to multiples of 1/24 within 1.5·10⁻³, so that the absence test h·t ∈ ℤ stays exact, when the snapped one still maps the structure; else the translation the atoms give is kept. Up to v424 only the snapped one was tried: with the origin off a symmetry element, the snap could move the images by more than the tolerance on a long axis (0.018 Å for a = 12 Å), and operations were lost (a YAG P1 file at a random origin lost some in 67 shifts of 200).
  - A missing identity is added.
  - A list that is not a group is reported ("the list looks incomplete").
  - So is a centred symbol whose centring translations are missing.
  - **A magnetic CIF** (MAGNDATA, ISODISTORT) gives `_space_group_symop_magn_operation.xyz` and `_space_group_symop_magn_centering.xyz`, each with a time reversal ±1. The space-group operations are every centring times every operation, time reversal dropped: it does not move the atoms, and the magnetic moments scatter X-rays negligibly. A warning says so. A magnetic group named without operations (its BNS or OG name or number, or its parent space group) counts as a named group for the refusals below, and a superspace (modulated) magnetic CIF is refused. Up to v425 such a file was read as its asymmetric unit in P1 without a word: LaMnO₃ in Pn′ma′ gave 4 atoms instead of 20.

*Sites.*
- Each site has a species, x, y, z and an occupancy.
  - Occupancy defaults to 1; over 1 is warned and kept.
  - Dummy atoms are skipped.
  - A species with no X-ray form factor is left out, with a warning.
  - An ion with no tabulated form factor falls back to the neutral atom.
- **The species** is read from `_atom_site_type_symbol`: the element, case-insensitively, and a charge in either order, spaces dropped and a site suffix after it allowed ('Ti4+', 'O-2', 'Fe++', 'Ti 4+', 'Sr2+1', 'O2-a'). A sign it cannot read is flagged as a fallback, not taken silently as the neutral atom (v425 read 'Ti 4+' and 'Sr2+1' as neutral).
- **Without a type symbol** (or with one that names no species) the label is read (`labelSpecies`). Its first two letters can be one element, or an element and the start of a site name: 'HO1' is Ho, or an H on O1; 'CO1' Co or C.
  - The formula's elements choose between the two readings.
  - Without a formula, two letters that spell an element win, as in a type symbol. When their case does not say so ('HO1', 'SR1' against 'Ho1', 'Sr1'), the site is named in a warning with its other reading.
  - Two letters with no form factor ('Cn1', 'NO1', 'Hs1') fall back to the one letter.
  - A label read as an element the formula lacks ('Wat' as W) is warned too.

  v425 read the two letters whatever their case, silently, and dropped 'Cn1' or 'NO1'.
- **B** is taken in this order:
  1. `B_iso_or_equiv`;
  2. 8π²·`U_iso_or_equiv`;
  3. the equivalent isotropic value of the anisotropic tensor (Fischer & Tillmanns), U_eq = ⅓ Σᵢⱼ Uⁱʲ a\*ᵢ a\*ⱼ (**a**ᵢ·**a**ⱼ);
  4. 0.5 Å² ("the usual guess for an inorganic solid at room temperature"), with a warning that lists the sites.

*Refusals.*
- **A named group whose operations are missing is refused.** Its sites are almost always the asymmetric unit only. Read as P1, they would fill the cell in part and give a wrong pattern with no error: rutile gives 2 atoms instead of 6, the cell found orthorhombic, and (211) the strongest line.
  - An operation list that holds the identity alone, x, y, z, counts as none.
  - With Z given, the test compares the atoms with the formula × Z.
  - Without Z, the formula is no evidence: Z would be inferred from the atoms, and an asymmetric unit that holds whole formula units would pass by construction. The atoms must then show by themselves the crystal system and the centring the symbol names, and, for a centrosymmetric group, a centre of symmetry (from the IT number, or from the symbol: a '/', −1 or −3, or an orthorhombic symbol of mirrors and glides; from a Hall symbol, its leading '−'). The lattice letter comes from the H-M symbol, else from the Hall symbol; with only an IT number, a centred group's number wants some centring (up to v424, a group named by its IT number or Hall symbol alone passed every test). So NaCl named Fm-3m, given as Na and Cl, is refused (no F centring), and so is an asymmetric unit of P-1 in general positions (no inversion).
  - A lone special position can still pass, since a site alone in its cell shows the lattice's full symmetry: Mg named P6₃/mmc, given as one Mg, is read with one atom instead of two. A file that passes is read as P1 with a warning that the cell is filled only if all its atoms are listed.

**Filling the cell.** `expandAtoms` applies the operations to every site.
- **The rounding a written value may hide** (`roundingOf`) is half a unit of its last decimal. A site's three coordinates were written alike, so a shorter one had its zeros dropped ('0.93' beside '0.866' is 0.930). A site written with one decimal or none ('0 0.5 0') is exact in a file that writes nothing longer, else it takes the file's longest; a fraction ('1/3') is exact.
- **A site's own operations** are those that take it onto itself within that rounding (on each axis, its own and its image's), or within 10⁻³ on every axis as up to v425 ("a special position written with three decimals, 0.333/0.667, yields images exactly 0.001 apart that are still one position").
- They are kept when some point they all fix rounds to the coordinates as written: the point of their fixed set nearest the site, on the scale of each axis's rounding, lies within it. A tie, a point at the edge, counts only on a coordinate that is a multiple of 1/24 (⅛ written '0.13'); a general position of Fd-3m written (0.95, 0.83, 0.41) lies at the edge of the mirror y + z = ¼ and stays general. Else the farthest operation is dropped and the test made again.
- The site is then moved onto that point, its exact special position, and its orbit is that point's.
- Up to v425 only images within 10⁻³ were one position: Mg in P6₃/mmc written (0.33, 0.67, ¼) gave 6 atoms instead of 2 (cell mass 145.8 instead of 48.6). Over the 530 settings with special positions written to two decimals, v425 multiplied 147 of 1856 and v426 none; the 16 read with too few atoms (14 in v425) are positions that two decimals put on a higher symmetry (z = 0.9957 written 0.00). At three to five decimals general positions are read as in v425. At two, 3 more of 3180 general positions are read as special (52 against 49 in v425), each within its digits of the special position taken: (0.93, 0.87, 0.84) in P6mm is (0.934, 0.868, 0.84) on the mirror y = 2x.
- Duplicates are removed per site only, so two species sharing a site (a mixed occupancy) both stay.

**Composition check.** `checkComposition` compares two things:
- the site multiplicities, with `_atom_site_symmetry_multiplicity` where the CIF gives it;
- the cell's contents, with the formula × Z.
  - An element's count may lie anywhere from Σ occ (as written) to the count with every partly occupied site full, so a refined vacancy (O 0.98 against a nominal SrTiO₃) is within. The bounds are widened by what the written occupancies and the formula's numbers may hide: half a unit of their last decimal. Up to v425 every element could be off by max(0.05, 2 %), so one O site missing passed in large cells (Si₄₈O₉₅ as SiO₂ × 48, Y₂₄Al₄₀O₉₅ as Y₃Al₅O₁₂ × 8).
  - A partly occupied site left out reads the same as a vacancy: Si₄₈ with one half of a split O site (96 positions at 0.5, 48 O) is within, since the 96 positions full give 96 (v425 flagged it, at 2 %). So when an element is within only by counting its partly occupied sites full, the card notes it: "the occupancies give O 48, the formula × Z 96: vacancies on sites the formula counts full, or a partly occupied site is missing". Telling the two apart needs the geometry of the split site, which is not used.
  - Without Z, Z is the whole number that every element of the formula allows. When none does, the nearest one is compared and the check fails; when the cell holds a fractional number of formula units, the message says so. Up to v425 Z came from the most abundant element alone, and when that element had no atom (every O site dropped) the check was skipped: "No formula (or Z) to compare with".

A mismatch is "the signature of coordinates written for one origin choice (or setting) read with the operations of another". For example, anatase I4₁/amd origin-1 coordinates with origin-2 operations give Ti₈O₁₆ instead of Ti₄O₈. When every element is off by the same factor, the message says so ("Z is wrong, or the coordinates belong to another origin choice"). H atoms the CIF lists in the formula but not in the sites (X-rays rarely locate them) are left out of the check.

### 2.4 Symmetry from the atoms

Whatever operations the CIF has, the engine uses the symmetry it finds in the filled cell (`findSymmetry`). The CIF's operations only fill the cell.

**Lattice symmetry** (`holohedry`, `latticeSymmetry`).
- It collects every integer matrix with det ±1 and RᵀGR = G within 10⁻⁴ (relative). At most 48.
- It is searched in a reduced basis of the lattice (`reduceBasis`). Each column is a lattice vector as long as its axis; such a vector's indices are bounded, |nⱼ| ≤ |a\*ⱼ||aᵢ|, so none is missed in any cell. Up to v425 the entries were limited to {−1, 0, 1}, which suffices only for reduced and conventional cells: the 530 settings given in random primitive bases (spglib's structures) were found in a lower system 419 times and with fewer operations 22 times more; none since.
- It is the holohedry of the structure's own lattice (step 3 below), expressed in the cell's basis.

**Space-group operations.**
1. Atoms are grouped by species and occupancy (to three decimals). Empty sites are ignored, because they would lower the symmetry found.
2. An operation is kept if every atom of every group lands on an atom of its own group within 0.01 Å beyond the rounding both may hide, axis by axis: the target's own, and the image's turned by R (|R|·ε, from the written digits). A P1 file at three decimals hides up to 0.0065 Å per axis on c = 13 Å. With 0.01 Å alone, corundum at three decimals gave 28 of its 36 operations and centring P instead of R, and the same cell named R -3 c without operations was refused.
   - Axis by axis, not as a sphere: a polar P4mm structure written with two decimals (Ti at z = 0.51, c = 3 Å) is not made P4/mmm, since 0.51 excludes ½; a sphere of the box's half-diagonal took in the mirror.
   - Only a file without operations (P1) is allowed its rounding. With operations, the atoms are exact images of each other under them and the file names its group: that group is found exactly, and more only within 0.01 Å, as up to v425.
3. **The pure translations** come first: R = 1, candidates t = xⱼ − x₀ for the atoms xⱼ of the group with the fewest atoms (x₀ its first). They are closed into a group T, and each is made exact, k/m with m = |T|. With them comes the structure's lattice, ℤ³ + Σ ℤt, finer than the cell's for a centred cell or a supercell.
4. **One translation for each matrix** of that lattice's holohedry that is integer in the cell (t = xⱼ − R·x₀); the others are it times T. Taken from one atom pair, t carries that pair's rounding: the atoms are matched allowing it too, then t is fitted to all of them (on each axis the middle of the offsets that every atom's rounding allows, else their median); when the fitted t does not map the structure (an atom took a near twin), the atoms are matched again from it. A matrix that is not integer in the cell cannot act on it: it is counted as lost, and the structure is then refined in its own cell (below).
5. **Snapping.** Translations go to the nearest multiple of 1/24 when the snapped one still maps the structure, so that the absence test h·t ∈ ℤ stays exact. Pure translations are snapped within 1.5·10⁻³. The others are snapped within 1.5·10⁻³ only when all of them lie that near (a standard origin, perhaps with noise), else within what the rounding of the fit allows: the part of a translation across its symmetry element is set by the origin, and v425 snapped it by coincidence (a P4₁ at a random origin came out not quite a group).
6. **A group.** Every product of two operations must be among them up to T, or map the structure within twice the tolerance (what two operations within it may need; the rounding of the atom passed through cancels), and is then added. Where that fails, the tolerance is ambiguous for the structure: the search is made again with it, and the rounding allowed, halved, at most three times. The card warns if it still fails.
7. **The atoms** are moved to the mean of their images under the group: exactly symmetric, and moved at most by the tolerance and the rounding allowed. An exact file is left as it is. The card refines these atoms.
8. The distinct R form the point group. The pure translations give the centring: P, I, F, A, B, C, R, or X for anything else (a supercell).

**Cost.** Atoms are looked up in a grid of their positions, and products are checked through the matchings already found. The mean of step 7 is taken over T, then over one operation for each R, which gives the same mean, since T is normal in the group and the operations are affine. The cost grows as N·(|T| + |R|) rather than N²·|group|. It runs on the page when a CIF is added. A YAG P1 supercell of 1280 atoms (768 operations) took 6.5 s in v425 on an idle machine, the page frozen. In CPU time, measured side by side: v425 7.4–8.6 s, v426 0.08–0.12 s (0.35–0.43 s against 0.02–0.03 s at 640 atoms; a NaCl 4×4×4 P1 cell, 12288 operations, 22–29 s against 0.1 s). The card's whole path, `structureCell` below, which also goes back to the 160-atom cell, takes 0.2–0.4 s.

**Tests.** The 530 settings, each with two or three general sites, written as P1 files exact, at four, three and two decimals (also with the cell doubled), at random origins, and under random unimodular changes of basis. The group's order and the system are found in every case, and the operations form a group. v425 lost operations in 32 of the doubled cells at three decimals, in 36 cells at two, and in 528 of the changed bases, and its operations were not a group in 65 cells at random origins (28 at four decimals).

**The structure's own cell** (`structureCell`). When the structure's lattice is finer than the cell given, the structure is re-expressed in a cell of its own.
1. The cell given divided along its own axes, a/n₁, b/n₂, c/n₃, with nᵢ the lattice translations along axis i, when it holds the whole symmetry in a standard setting. The file's axes and setting are then kept: a C2/m cell doubled along b goes back to the same C2/m cell.
2. Else the reduced primitive cell of that lattice, then the conventional cell of the symmetry found there (`conventionalBasis`). That cell is kept when it holds symmetry the cell given lost, or is smaller than it. Without a conventional cell, the primitive one is used.
- A centred cell given in its conventional setting stays as it is, and so does the primitive cell of a centred lattice (refined through its conventional cell, below).
- hcp Mg in its C-centred orthohexagonal cell (a, √3a, c) was orthorhombic up to v425, with b/a free; it is refined in its hexagonal cell (a, c).
- A P1 file of 2×1×1 YAG cells was tetragonal, with c/a free; it is refined in the cubic Ia-3d cell (160 atoms). Supercells of corundum, quartz, NaCl and rutile likewise go back to their own cells.
- Over the 530 settings written as P1 supercells (2×1×1, 1×1×2, 1×3×1), each goes back to the tabulated cell with its whole point group; the 52 with hexagonal axes, given in their C-centred orthohexagonal cell, go back to a hexagonal cell. v425 found 182, 49 and 182 of the supercells, and all 52 orthohexagonal cells, in a lower point group.
- The pattern is the same. The card notes the new cell; the indices and the refined lengths are its. A result refined before in the file's cell is not drawn on the new one.

**Crystal system.** It follows from the rotation orders:

| Rotations | System |
|---|---|
| ≥ 8 threefold | cubic |
| a sixfold | hexagonal |
| a threefold | trigonal |
| a fourfold | tetragonal |
| ≥ 3 twofold | orthorhombic |
| a twofold | monoclinic |
| none | triclinic |

**The constraint** decides how the cell is refined.
- In a standard setting, the usual free parameters are refined:

  | System | Free parameters |
  |---|---|
  | cubic | a |
  | hexagonal, trigonal (hexagonal axes) | a, c |
  | rhombohedral axes | a, α |
  | tetragonal | a, c |
  | orthorhombic | a, b, c |
  | monoclinic | a, b, c and the unique angle |
  | triclinic | all six |

- **A non-standard cell is refined through its conventional cell** (`conventionalBasis`).
  - This is the primitive cell of a centred lattice, as the Materials Project serves its P1 files.
  - Lattice vectors along the symmetry axes (indices up to ±3) become the columns of an integer matrix M. Then G_conv = MᵀGM and h_conv = h·M.
  - The atoms, operations and reflection list stay in the file's cell. Only the way its six parameters follow the refined conventional a, c (or a, b, c, β) changes.
  - Why: with one scale factor, a primitive cell "freezes c/a (and b/a, β) at the file's values: a DFT cell's wrong c/a then goes into the displacement and the widths". For a cubic phase, the refined a and V are those of the cube the tables quote.
  - Example: NaCl given as its primitive rhombohedral cell (a = 3.988 Å, 60°) is refined by the conventional a = 5.64 Å; M has |det| = 4.
- **Fallback.** If no conventional basis is found, the lengths are refined by one common scale factor (`isotropic`), which is always consistent with the symmetry, only less free.

**Reflections and ticks.** The reflections are listed in the cell the phase is refined in (the file's, or the structure's own, above), but their labels (the ticks, the tables) are given in conventional indices (`tickLabels`). Anatase's first line is then (101), not the primitive cell's (100).

### 2.5 The instrumental standard

The standard is built in: NIST SRM 660c LaB₆.

| Item | Value | Source |
|---|---|---|
| Space group | Pm-3m | |
| a | 4.156826 Å at 22.5 °C | the certificate |
| B on 6f (x, ½, ½) | x = 0.1992 | Eliseev et al., *Acta Cryst.* C42 (1986) 1263 |
| B_iso | La 0.25 Å², B 0.35 Å² | typical values |

The displacement parameters are typical values because the standard's refinement gives the instrument's profile and zero, not its intensities.

- It is written in P1, only to be short. The symmetry found is cubic, order 48, and the composition check passes (LaB₆ × 1).
- Its cell is held at the certified value throughout. No thermal-expansion correction is applied to the laboratory's temperature.

## 3. The calculated pattern

### 3.1 The model

```math
y_c(2\theta_i) = b(2\theta_i) + \sum_{p} S_p \sum_{\mathbf h} \sum_{j\in\{\alpha_1,\alpha_2\}} w_j\, m_{\mathbf h}\, LP(\theta_{\mathbf h j})\, |F_{\mathbf h j}|^2\, e^{-2\,\Delta B_p\, s_{\mathbf h}^2}\; T_{\mathbf h}\; \Phi\!\left(2\theta_i - 2\theta_{\mathbf h j}\right)
```

| Symbol | Meaning |
|---|---|
| b | the background (§3.9) |
| S_p | the scale of phase p (linear); it absorbs every constant, 1/V² included |
| **h** | the phase's reflections, one per Laue orbit |
| m_**h** | the multiplicity |
| w_j | 1 for Kα1, the Kα2/Kα1 ratio for Kα2 |
| LP | the Lorentz–polarisation factor (§3.4) |
| \|F_**h**j\|² | the structure factor's squared modulus (§3.3) with line j's f′ and f″, the atoms' displacements in it (§8) |
| ΔB_p | the phase's overall shift of the atoms' B, when its displacements are *one ΔB* (§8); 0 otherwise |
| s = 1/(2d) | as in §1.4 |
| T_**h** | the preferred-orientation factor (§9); 1 without one |
| Φ | the area-normalised peak profile, centred at the line's position (§3.5): the pseudo-Voigt of §3.6–3.7, or by WPPM the Fourier transform of the line's coefficients (§7.3) |

With a crystallite shape (§10), Φ becomes a sum over the members of each reflection's family. Each member carries its own width and its own texture weight:

```math
T_{\mathbf h}\,\Phi \;\to\; \sum_{i=1}^{m'} \frac{t_i}{m'}\, \Phi_i
```

Here m′ counts the members with ±**h** taken as one, and t_i is member i's texture weight.

With an anisotropic strain (§7.5) or planar faults (§7.6), each reflection has its own strain and fault broadening, the same for all members of its family.

Each phase's pattern is computed at scale 1 (`phasePattern`), and then:

```text
y_c = b + Σ_p S_p · pattern_p        (assemble)
```

When only linear parameters change (scales, background), only this sum is redone.

### 3.2 The reflection list

The list is made once, in `buildModel`, with `reflections` in `xrd-cryst.js`.

- **Down to:**

  ```text
  d_min = min(0.9, 1/s_max) · λ_max / (2 sin θ_lim),    θ_lim = min(89.9°, (2θ_end + 2°)/2)
  ```

  A cell that grows brings lines from beyond the end into the range (one that shrinks only takes lines out), so the list must reach every d that a cell within the bounds can stretch to the end's. The lattice lengths are bounded to ±10 % of the file's (`LAT_RANGE`), the angles to ±15° (`LAT_ANGLE`, inside 1–179°). s_max is the most any d can grow over those bounds (`latticeStretch`):
  - max over **h** of d/d₀ is max over real vectors **t** of |**t**|/|**t**|₀ in the direct metrics, √ of the largest eigenvalue of G relative to G₀ (L⁻¹GL⁻ᵀ, G₀ = LLᵀ);
  - **t**ᵀG**t** is a quadratic with a positive leading term in each length and linear in each angle's cosine, so over the bounds' box its largest value lies at a vertex, whatever **t**: the 2ⁿ vertices of the refined lattice parameters suffice.

  For a cell with right angles s_max = 1.1, and the list goes to d_full = 0.9·λ_max/(2 sin θ_lim), as before (lines just beyond the end reach in with their tails). An oblique cell needs more: β moved 15° from 105° stretches d(101) of a monoclinic cell by 16 %. With the 0.9 alone, three oblique test cells (two monoclinic, one triclinic; every vertex and 300 random cells of their box, pattern to 90°) had reflections in the range missing from the list in 35–176 of the 316–364 cells tried, up to 118–150 of them; with s_max (1.30, 1.28 and 1.48), none. Their lists grow from 375 to 599, 254 to 390 and 486 to 1131 reflections, all beyond the end.

  **Drawn once grown** (`growFade`). A reflection listed only for a growing cell (d below d_full at the file's cell) is drawn once the cell has grown it past d_full, faded in over the next 2 % of d (a smooth step, as the lines toward 180° below), so χ² stays smooth in the cell. At the file's cell the pattern is then the shorter list's to the last bit, and its cost too. Drawn at once, the lines of a monoclinic cell between 152° and 170° (pattern to 120°) reached into the range with their broad tails and made `autoRefine` 1.5 times as long (CPU time, the three oblique cells to 120°). Because the list is fixed, the hkl and their multiplicities do not change while the cell moves.
- **Laue group.** The rotation parts of the operations and their negatives, so Friedel pairs merge.
- **Multiplicity.** The size of each orbit.
- **Representative.** The member with the fewest negative indices, then the largest: (110), (210), (221) as in the tables.
- **Enumeration box.** |h| ≤ ⌊|**a**|/d_min⌋, and likewise for k and l. This bound holds for any cell, however oblique.
- **Systematic absences.** A reflection is absent if some operation (R, t) with h·R = h gives a phase h·t that is not an integer within 0.02.
  - Allowed phases are integers; forbidden ones are at least 1/6 away.
  - Because the operations are the ones found, centring, screw axes and glides are all covered.
  - Accidental and site-specific absences stay in the list with F² ≈ 0. For example, Si (222) is listed with multiplicity 8.
- **Lines beyond the pattern.** A line outside the range is computed when its window reaches into it (§3.6). Towards 2θ = 180°, though, its widths and the Lorentz factor grow as 1/cosθ. Such a line lays a broad level over the whole pattern, and that level vanished at once when the cell carried the line past 180° (λ/2d ≥ 1). On a synthetic ZnO pattern measured to 130°, the refinement stopped on that step: the cell 20 esd from the truth, χ² 1.16 where the truth gives 1.02.
  - So lines beyond the pattern fade out between 2θ = 170° and 175° (`backFade`), smoothly, and the pattern stays continuous in the cell. When the pattern itself reaches past 169°, the fade starts 1° beyond its end.

### 3.3 Structure factors

```math
F(\mathbf h) = \sum_{j} o_j\, e^{-B_j s^2}\,\bigl(f_{0,j}(s) + f'_j + i f''_j\bigr)\, e^{2\pi i\,\mathbf h\cdot\mathbf x_j},
\qquad |F_{\mathbf h}|^2 = \tfrac12\bigl(|F(\mathbf h)|^2 + |F(-\mathbf h)|^2\bigr)
```

- **The sum** runs over every atom of the filled cell (o_j is the occupancy).
- **Bijvoet average.** A powder line holds both h and −h, which f″ makes unequal in a non-centrosymmetric structure.
- **f₀** is Waasmaier & Kirfel's five Gaussians plus a constant, valid for s ≤ 6 Å⁻¹.
  - It covers the neutral atoms H–Cf and 111 common ions.
  - An unknown species gives NaN, so a bad site shows up instead of silently scattering nothing.
- **f′ and f″** are tabulated at the Kα1 and Kα2 lines of Cu, Co, Mo, Cr, Fe and Ag: Chantler's (NIST FFAST) for Z = 1–92, Cromer & Liberman's (*Acta Cryst.* A37 (1981) 267, from their orbital cross-sections as GSAS-II distributes them) for Np–Cf, the rest of f₀'s range. For Th–U the two agree within 0.6 e in f′ and 0.8 e in f″ at these lines. Up to v425 Np–Cf had none, silently: their |f|² was 9–10 % too high at Cu Kα.
  - Each line takes the tabulated line nearest its own λ within 0.002 Å; a Kα2 not tabulated takes Kα1's.
  - Kα2 has its own F² where its f′, f″ differ from Kα1's (`phaseF2`, `f2b`). An edge between the two lines, or just above both, changes them by up to 5 e from one line to the other (Ru K between Ag Kα1 and Kα2: f″ 3.59 against 0.56; Pu L2 just above both: f′ −12.9 against −8.0); v425 used Kα1's for both, which put Ho's Kα2 |f|² with Cu 6–12 % off.
  - Any other wavelength gets f′ = f″ = 0 rather than values for the wrong absorption edge, with a warning.
- **Debye–Waller.** It acts on the amplitude, so F² carries e^{−2Bs²}. B_j is the CIF's (0.5 Å² where it gives none), or the refined B of the atom's site. With anisotropic displacements, the factor is e^{−**h**ᵀβ_j**h**} instead (§8.3).

**Speed** (`phaseGeometry`, `phaseF2`).
- The positions never move. So for each scattering type (one species, occupancy and B; with refined displacements, also one site and one orientation of it) and each reflection, the geometric sum Σ e^{2πi h·x} is made once.
- A new cell then costs only the form factors at the new s: no trigonometry. On a 48-atom monoclinic cell, the trigonometry had been most of the time of a cell-search step.
- F² is cached for the last cell and displacement parameters.

### 3.4 Lorentz–polarisation

```math
LP(\theta) = \frac{1 + K \cos^2 2\theta}{(1 + K)\,\sin^2\theta\,\cos\theta}
```

This is the Bragg–Brentano factor, divided by a constant (1 + K) that the scale absorbs. K = I_π/I_σ is the polarisation ratio of the monochromators, their diffraction planes taken parallel to the sample's (International Tables C §6.2.2).
- **One reflection at 2θ_M**: K = cos²2θ_M for a mosaic crystal (graphite, LiF: kinematic), |cos 2θ_M| for a perfect one (Ge, Si, quartz: the Darwin width, and with it the integrated reflectivity, scales with the polarisation factor). A bent Johansson crystal stays perfect: its planes turn by about 1 µm/0.4 m over an extinction depth, far below the Darwin width.
- **Several reflections**: a mosaic crystal's multiply; a perfect channel-cut repeats the same angle and keeps |cos 2θ_M|; a second channel-cut set the other way (4 reflections, Bartels) gives cos²2θ_M.
- **A crystal on each side**: the product of their K.
- **With Cu**: graphite (002) 0.800; Ge (111) 0.889; Si (111) 0.879; LiF (200) 0.500; hybrid 2×Ge (220) 0.703; 4×Ge (220) 0.495.
- **Without a monochromator**, K = 1. An instrument object that gives no K takes cos² of its `monoAngle`, else graphite (002) at λ1.

v425 used graphite (002) for every monochromator. With a hybrid 2×Ge(220) that put the 20°/80° intensity ratio 5 % off, which B absorbs (about 0.15 Å² over 10–80°). A real crystal can lie between the perfect and the mosaic value (strain, mosaic spread): for Ge (220), 0.703 against 0.495, 12 % in the same ratio; the card's instrument line shows the K used.

No absorption, surface-roughness, sample-transparency or variable-slit correction is applied.

### 3.5 Peak positions

```text
2θ = 2·asin(λ_j / 2d) + zero + disp · cos θ
```

- `zero` (bounds ±2°) is the goniometer zero. It is refined on the standard only (§6).
- `disp` (bounds ±3°) is the specimen displacement term: Δ2θ = −(2s/R)·cosθ for a displacement s and a goniometer radius R. It is reported in mm as s = −disp·(π/180)·R/2.
- Each line has its own θ, so Kα2 sits where its own wavelength puts it.

### 3.6 The peak profile

**Widths.** For a line at Bragg angle θ:

```math
H_G = \sqrt{\max\!\left(10^{-8},\; U\tan^2\theta + V\tan\theta + W\right)},\qquad
H_L = (X + X_s)\tan\theta + \frac{Y + Y_s}{\cos\theta}
```

- **H_G** (Caglioti) and **H_L** are FWHM in degrees 2θ. U, V, W are in deg² and X, Y in deg.
- **Per phase.** X_s and Y_s belong to the phase: its strain-like and size-like Lorentzian broadening (§7). Lorentzian widths add under convolution, so the phase's simply add to the instrument's.
- **The floor.** H_G² never reaches 0, whatever U, V and W do (`HG2_FLOOR`). On the floor their derivatives vanish (§5.4).

**Pseudo-Voigt** (Thompson, Cox & Hastings 1987, `tch`). The pseudo-Voigt that best matches the Voigt of H_G and H_L has:

```math
H = \left(H_G^5 + 2.69269 H_G^4 H_L + 2.42843 H_G^3 H_L^2 + 4.47163 H_G^2 H_L^3 + 0.07842 H_G H_L^4 + H_L^5\right)^{1/5}
```

```math
\eta = 1.36603\,q - 0.47719\,q^2 + 0.11116\,q^3,\qquad q = H_L/H
```

η is clamped to [0, 1]; the cubic reaches 1.00000 at q = 1. With H_G = H_L = h, H = 1.635h.

**Area-normalised profile** (`addPeak`):

```math
\Phi(\delta) = \eta\left[\frac{2}{\pi H}\,\frac{1}{1 + 4\delta^2/H^2} - L_{\text{edge}}\right] + (1-\eta)\,\frac{2\sqrt{\ln 2/\pi}}{H}\,e^{-4\ln 2\,\delta^2/H^2}
```

- **Window.** It is evaluated within ±max(40·H, 1.5°) of the line (`WIN_FWHM`, `WIN_MIN`).
- **The Lorentzian is lowered by its own value at the window's edge** (L_edge), so it goes continuously to zero there. A Lorentzian still holds about 0.8 % of its area beyond 40 FWHM. Cut straight, it would leave a step at both ends of the window.
- **Not renormalised.** The intensity stays the area of the whole, untruncated peak, as a measured peak has it. What the window leaves out (1.6·η % at 40 FWHM, slow and almost flat) goes to the background, which follows it as it follows the data's own tails.
  - Renormalising inside the window instead had made the fitted intensities 1.6·η % low. Since η differs between phases, that biased their ratio.
- **The Gaussian part** is evaluated only where the exponent is under 40 (about ±3.8 H). It is zero long before the edge.

### 3.7 Axial divergence (Finger, Cox & Jephcoat 1994)

**Why.** A Bragg–Brentano peak is not symmetric. Rays that leave the diffraction plane along the goniometer axis meet each Debye cone at a slightly lower 2θ below 90° (and higher above), so low-angle peaks carry a tail towards low angles. On the user's LaB₆ a symmetric profile gave:
- R_wp 11.97 % and χ² 11.4;
- worse, a misfit that the zero, the displacement and the widths absorbed, and that the samples then inherit. Refined as a sample, LaB₆ came out at a = 4.156409 Å against its certified 4.156826 Å.

**The model** (`fcjNodes`).
- The sample's and the receiving slit's half-heights are taken equal. That leaves one parameter, A = (S + H)/L, as GSAS-II's SH/L. A two-parameter version (S ≠ H) refined its second parameter to zero on the standard.
- A ray leaving the plane by h·L meets the cone of 2θ at 2φ, where:

  ```text
  cos 2φ = cos 2θ · √(1 + h²)
  ```

- **Weight.** FCJ's weight, per unit of the axial offset h ∈ [0, A], is

  ```text
  W(h) ∝ (A − h) / ((1 + h²) · sin 2φ)
  ```

  This is finite at h = 0: in 2φ the same weight has an integrable singularity at the peak. So Gauss–Legendre quadrature in h converges fast.
- **The cut cone.** Below 2θ = atan A (and above 180° − atan A), the cone's tail ends at h_max = |tan 2θ| < A. There the weight has a 1/√(h_max − h) singularity, which the change of variable h = h_max(1 − u²) removes.
- **Size of the shift.** It goes as h², up to about −A²/2·cot 2θ. The centroid is at −A²/12·cot 2θ (radians).

**Nodes.** The profile is the weighted sum of the symmetric profile at the shifts d_k of the quadrature nodes.

| Case | Nodes used |
|---|---|
| The whole tail under 5 % of H (broad peaks, or near 90°) | 1 node at the mean shift; the profile is then within 0.04 % of the peak of the exact one |
| The tail under H/2 | 3 nodes: the Gauss quadrature of the discrete distribution of shifts (Stieltjes recurrence, then Golub–Welsch), exact for its first six moments; the profile is then within 0.01 % of the peak of the exact one (0.0095 % for a pure Lorentzian at the threshold) |
| Otherwise | n = ⌈4·\|d_max\|/H⌉ + 2 Gauss–Legendre nodes, at most 4000. The nodes are Gauss–Legendre's in h and the shift goes as h², so neighbouring shifts are H/4 apart on average and at most about H/2 (0.51·H measured); the profile is within about 0.04 % of the peak of the exact one (0.043 % at worst) |

**The cap** (`FCJ_MAX_NODES` = 4000) is for cost alone: a line's cost grows with its nodes (2.7 → 20 ms for 300 → 2358 nodes, at a step of H/3), and a WPPM line's nodes enter its Fourier coefficients one by one. Below the cap the profile holds its accuracy. Against a dense quadrature (40 000 midpoint nodes), the earlier cap of 300 drew lab lines up to 1 % of the peak off (2θ = 5°, H = 0.02°, A = 0.1; 3.8 % at 8° with A = 0.15) and synchrotron-sharp ones 2–4.5 % (H = 0.003–0.005° at 4°, A = 0.058); 4000 hold all fourteen lines tested (2θ 3–176°, H 0.003–0.03°, A 0.058–0.15) within 0.015 %. Only a tail over 1000 H long needs more, which neither a laboratory line (H ≥ 0.015°) nor a synchrotron one (A far below a laboratory's) has. Such a tail ripples, against 80 000 midpoint nodes (six tails of 750–3000 H, 2θ 3–177°, A 0.058–0.15): by up to 0.013 % of the peak with 1.25 times too few nodes, 0.035 % at 1.5, 0.15 % at 2, 0.8 % at 3 and 2.7 % at 5. `lineNodes` keeps the largest shortfall (`model.fcjShort`); past 1.5, where the ripple passes the profile's own 0.04 %, `autoRefine` warns with it and the ripple it means.

**Summing over the nodes** (`addPeakFCJ`).
- Each node is summed only over the peak's core, R = 1.5·spread + 6·H. Beyond that, one peak at the mean shift stands for them, blended in over 2·H so the profile stays continuous in the parameters.
- Out there, the shifted Lorentzians differ from the mean one by ½·var(d)·L″. That is under 2 % of a wing that is itself under 0.2 % of the peak; the profile stays within 0.005 % of the peak of the full node sum.
- A node per point over the whole window had made a large sharp cell refine 4.5× slower.

**Node counts are held during a refinement** (`lineNodes`, `fcjFreeze`). So χ² is a smooth function of the parameters: a count that changed with the widths or the asymmetry moved χ² in steps, and a derivative by up to 10×. See §5.6 for the audit that re-runs when the counts have been outgrown.

**The cell search** uses one node per line at the FCJ centroid. That is a quarter of the cost on a large sharp cell, and puts the minimum where the full profile puts it.

**Refined values.** A is refined on the standard only (§6), from 0.02 (`ASYM_START`): at 0 its derivative vanishes, since its effect goes as A². Samples take the standard's value through the irf. On the user's LaB₆:
- R_wp 7.62 %, χ² 4.62, (S+H)/L = 0.0583(1);
- refined as a sample, LaB₆ reproduces its certified cell to 1.5·10⁻⁵ Å.

### 3.8 Kα2

Kα1 and Kα2 are computed independently, each with its own:
- position;
- width (at its own θ);
- FCJ nodes;
- LP.

**The sample's widths.** A size broadens both lines alike in d\*. So Y_s (read as D = Kλ₁/Y_s), a free shape's widths and the faults' term are given to Kα2 times λ2/λ1, before its own 1/cosθ, as WPPM's synthesis in d\* gives them. The strain term 4ε·tanθ is the same for both lines at their own θ. The instrument's U … Y are the standard's, applied as refined, alike to both lines; so without an irf, where Y carries the whole size (§7.2), Kα2 keeps Kα1's reading, which the instrument's share in that size outweighs anyway. (Kα1's size width for both lines, as GSAS and FullProf have it, leaves Kα2's narrow in d\* by 1 − λ1/λ2: 0.25 % for Cu, 0.6 % for Mo, 0.8 % for Ag; Y_s about 0.09 % off for Cu.)

Kα2 is weighted by the file's ratio, and its F² has its own f′ and f″ (§3.3). The ticks and the reported peak data are Kα1's.

### 3.9 Background

```math
b(2\theta) = \sum_{k=0}^{6} c_k\, T_k(u) \;+\; \frac{c_{\text{inv}}}{2\theta},\qquad u = 2\,\frac{2\theta - 2\theta_0}{2\theta_1 - 2\theta_0} - 1
```

- **Chebyshev terms.** T₀ … T₆ over the whole pattern mapped to [−1, 1].
- **The 1/2θ term** (2θ in degrees; it takes up air scatter) is used by default when the pattern starts below 20°.
- **Linear.** All terms are linear parameters. c₀ starts at the 10th percentile of the counts.
- **Collinearity.** The 1/2θ term and the Chebyshev terms are nearly collinear. §5.3 says how the solver deals with that.

There is no separate amorphous term.

### 3.10 Agreement indices (`rStats`)

The sums run over the weighted points: N points, with P free parameters. y stands for the fit's target T = y + min(y⁺, m) of §2.1, which differs from the counts by at most one count per point.

| Index | Formula |
|---|---|
| R_p | Σ\|y − y_c\| / Σ\|y\| |
| R_wp | √( Σw(y − y_c)² / Σw y² ) |
| R_exp | √( (N − P) / Σw y² ) |
| χ² (reduced) | Σw(y − y_c)² / (N − P) = (R_wp/R_exp)² |
| cR_wp | √( Σw(y − y_c)² / Σw(y − b)² ) |

cR_wp is R_wp with the background taken out of the denominator, which a high background otherwise flatters. The card shows R_wp, R_exp and χ². The others are recorded per stage.

## 4. The parameters

Every parameter has:
- a name;
- a start value;
- box bounds;
- a difference step for its Jacobian column;
- a flag for whether it is linear.

Which ones are free at each stage is decided by the strategy (§6).

**Global parameters**

| Name | Meaning | Start | Bounds | Linear |
|---|---|---|---|---|
| `zero` | goniometer zero, ° | 0 (the irf's for a sample) | ±2 | no |
| `disp` | displacement term, Δ2θ = disp·cosθ, ° | 0 | ±3 | no |
| `U`, `V`, `W` | Caglioti H_G² = U tan²θ + V tanθ + W, °² | 0, 0, (H_est/1.635)²; on a sample, the irf's (held) | U, W ∈ [0, 20]; V ∈ [−20, 20], and V's floor (§5.4) | no |
| `X`, `Y` | Lorentzian H_L = X tanθ + Y/cosθ, ° | 0, h·cosθ_E; on a sample, the irf's (held) | [0, 10] | no |
| `asym` | axial divergence A = (S+H)/L | 0.02 on the standard with ≥ 8 reflections in range (else 0, held); on a sample the irf's (0 without one) | [0, 0.2] | no |
| `bg0`…`bg6` | Chebyshev coefficients | 10th percentile; 0 | free | yes |
| `bgInv` | coefficient of 1/2θ | 0 | free | yes |

**Per phase** (prefix `p<id>.`)

| Name | Meaning | Start | Bounds | Linear |
|---|---|---|---|---|
| `scale` | S | 10⁻³ | [0, ∞) | yes |
| `a`, `b`, `c`, `alpha`, `beta`, `gamma` (as the constraint names them) | the conventional cell | the file's (conventional) values | lengths ±10 %; angles ±15° (within 1–179°) | no |
| `B` | ΔB, Å² (displacements *one ΔB*) | 0 | [−2, 10] | no |
| `B_<site>` | the B of one site, Å² (*B per site*, §8.2) | the mean of the CIF's B over the site (0.5 without) | [−2, 20] | no |
| `U11_<site>` … `U23_<site>` | the Uⁱʲ the site's symmetry leaves free, Å² (*Uⁱʲ per site*, §8.3) | isotropic, from the CIF's B | ±0.5 | no |
| `Xs`, `Ys` | the phase's Lorentzian broadening, ° (with WPPM, Y_s is the sphere's size, §7.3) | 0 and the excess width (§6.1) | [0, 10] | no |
| `S1`…`Sn` | Stephens' anisotropic parts of ε², 10⁻⁶ (§7.5) | 0 | ±10⁴ | no |
| `FA` | the planar faults' probability per plane (§7.6) | 0 | [0, 0.45] | no |
| `LS` | σ of ln D, the log-normal width (§7.4) | 0.3 and 0.6 (two starts) | [0, 1.5] | no |
| `PO` | March–Dollase r (only with a texture) | 1 | [0.2, 5] | no |
| shape widths `Ea Eb Ec`, `Wa Wc`, `Wd Wh`, `Wa Wb Wh`, `Wa Wb Wc` | the solid's dimensions as widths, ° (§10) | 0 | [0, 10] | no |
| `R1 R2 [R3]` | rotation vector of the solid, rad | 0 | ±4; largest step 0.4 per iteration | no |
| `Q0`…`Q3` | the reference orientation (a quaternion) | 1, 0, 0, 0 | never refined | — |
| `L11`…`L33` | the v420 ellipsoid (legacy) | 0 | ±10 | no |

**Housekeeping.**
- A start outside its bounds is clamped in (`clampInto`). A hand-typed or stale value could otherwise leave a parameter where it has no effect at all: Ys = −0.2 makes H_L = 0 everywhere, and the refinement would never bring it back.
- A NaN that went through JSON (a saved session, a worker message) comes back as null. Only finite numbers are taken from a parameter object.

## 5. Least squares

The solver is `refine` / `refineHeld` (`xrd-rietveld.js`): Levenberg–Marquardt, with a handful of additions that came from failures on real and synthetic data.

### 5.1 The normal equations

```math
\chi^2 = \sum_i w_i\,(y_i - y_{c,i})^2,\qquad A = J^\top W J,\qquad g = J^\top W (y - y_c)
```

**Jacobian columns.**
- **Linear parameters: exact.** A scale's column is its phase's pattern at scale 1. A background term's column is its basis function.
- **The others: central differences** with step h = max(step, 10⁻⁷·|v|).
  - The difference is one-sided at a bound, so the model is never evaluated outside its box.
  - A column touches only the phases the parameter acts on. A phase whose scale is 0 contributes nothing.

**Scaling.** Each step is solved on the correlation-scaled matrix:

```text
A_s = D⁻¹ A D⁻¹,   D = √diag(A)
```

Every pivot is then relative to its own column's size, and parameters in Å, degrees and counts mix without trouble.

**Damping.**

```math
(A_s + \lambda I)\,\delta_s = g_s,\qquad \delta = D^{-1}\delta_s
```

This is Marquardt's diagonal damping. λ starts at 10⁻³.

- **Accepted step** (any decrease of χ²): λ → max(λ/10, 10⁻⁹).
- **Rejected step:** λ → 10λ.
- Up to 12 tries per iteration.
- The Cholesky factorisation drops a pivot below 10⁻¹⁰ of its diagonal: that parameter is numerically a combination of the others. Its step is then 0 and its variance NaN.

**Convergence.** The refinement stops when any of these holds:
- every applied shift is under 1 % of its esd;
- χ² falls by less than 10⁻⁹ (relative);
- no step lowers χ²;
- nothing can move;
- `maxIter` is reached (40 per stage; 60 for the shape's full refinements; 8 for its brief trials; 4 inside the angular profiles).

### 5.2 Bounds

**Box bounds.**
- A step is clamped component by component into the box.
- A parameter on a bound whose gradient points outwards is held for that iteration and re-tested at the next.
- The step is only clamped into the box (and, with V free, projected onto V's floor, §5.4). It is not recomputed on the parameters left free, and there is no line search: a trial step is accepted or rejected on χ² alone.

### 5.3 Linear parameters

**Inside Levenberg–Marquardt,** the scales and background terms are ordinary free parameters, with exact columns.

**When the iterations stop,** the free linear parameters are also solved exactly with the others held (`linSolve`, up to 3 times). If that lowers χ² by more than 1 % of χ²_ν, the iterations resume, with λ back at its start (10⁻³). After "no step lowers χ²", twelve rejections had left λ at 10³ or more: the next step was a thousandth of a Gauss–Newton step, passed the shift test at once, and the refinement stopped 5–10 esd short of the minimum (forced failures on synthetic SrTiO₃, rutile and ZnO).

Why: the 1/2θ term and the Chebyshev terms are nearly collinear. Along that direction a damped step is cut to almost nothing, while its shift is still far under 1 % of its (large) esd. The refinement then stopped with χ² up to 17 above its minimum on synthetic plates, all of it in the background. That gap had made the shape's starts seem to reach different minima.

**`solveLinear`** solves the scales and background by weighted linear least squares, the scales kept ≥ 0. When none comes out negative that is one solve. Otherwise it is Lawson and Hanson's active-set method (NNLS, 1974): a scale that would go negative stops at 0 along the step, and a scale at 0 comes back when the gradient there favours it. Up to v425 the negative scales were set to 0 and the rest solved again, a scale never readmitted: on six copies of SrTiO₃ with cells 0.2–0.8 % apart, χ² ended up to 0.4 % above the optimum. It now matches an exhaustive search over the scales' active sets to 10⁻¹⁴. It also serves:
- every point of the cell and zero scans (§6.2–6.3);
- the linear start of every refinement.

### 5.4 The Gaussian-width floor and V

**The problem.** H_G² = U tan²θ + V tanθ + W can be pushed to 0 at some reflection by a negative V. There the width sits on its floor (H_G ≥ 10⁻⁴°), where the U, V, W derivatives vanish. That is a plateau the refinement cannot leave. From moderate starts, a third of the LaB₆ runs ended there, reported as converged at a χ² 12 % too high.

**The fix.** When V is free, its lower bound follows U and W (`vFloor`): the lowest V that keeps the quadratic ≥ 0 over the pattern's tanθ range. That is −min(U t + W/t) over the range, or −2√(UW) where the minimum lies inside it. Every trial step is projected onto it.

**At the end,** H_G² may be on or near the floor (within 100× it, H_G ≤ 10⁻³°) at a reflection in range of a phase present. Then the free U, V and W have no meaningful curvature, and each of them is listed `atBound` with esd NaN.

### 5.5 Steps that a symmetric orientation makes unbounded

The crystallite solid's orientation is a rotation vector (§10.4).

**The problem.** Where a turn has no first-order effect (an axis on a symmetric direction, where the members' changes cancel over a family), the Gauss–Newton step is unbounded. A first step of 4 rad threw a disc's axis anywhere.

**What did not work.** Shortening the whole step instead froze every other parameter with a turn whose column was numerical noise: a sphere's sizes stopped 30 % off.

**What the solver does.**
- **Clamp per component.** Each turn component has a largest step, 0.4 rad (`maxStep`), applied to that component alone.
- **Retry without it.** When a trial with a clamped turn does not lower χ², the same step is tried again without the clamped turns.
  - At a kink of χ² (a faceted body exactly on a symmetric orientation), the turn's column is noise, and its step stays over the limit however large λ grows. Every trial carried it, and the refinement stopped with every other parameter frozen. A cylinder's sizes were 30 % off, and the angular profiles of held solids 3–5× too narrow.

### 5.6 Holding the FCJ node counts

**Held during a pass.** `refine` holds every line's FCJ node count fixed for the whole of a pass (§3.7), so χ² is smooth in the parameters.

**The audit.** At the end of a pass, it checks whether any line has outgrown its count:
- a count of 1–3 nodes now needing more;
- a larger count now needing over 1.13× as many.

If so, it refines again with fresh counts, up to 4 passes. A count down to 1/1.13 of the one needed leaves the profile within 0.1 % of the peak, so a line that moved by a node or two is no reason to start again. Measured against a dense quadrature on 4064 lines (2θ 6–174° every 3°, H 0.005–0.3°, (S+H)/L 0.01–0.15; a Lorentzian, the worst η), the worst is 0.091 %, and 0.043 % at the full count. The ratio is the largest under 0.1 %: 1.14 left 0.097 %, 1.15 0.106 %, the earlier 1.25 0.17 %. On the real LaB₆ and 33A patterns and on synthetic cubic, tetragonal, hexagonal, monoclinic and sharp Si ones, 1.13 ran the same passes as 1.25, with the same results; 1.12 ran one more on the monoclinic one.

**Why.** The asymmetry, freed from 0.02, went to 0.058 on the user's standard. Its tails were then 8× longer than the counts were made for, and χ² was 8 % off at the end.

**Exception.** The free shape's brief trials (which only rank starting shapes) and the angular profiles run a single pass.

**Reported.** `refine` returns the iterations and the time over all its passes, and `passes`, how many; the stop reason (`why`) and `converged` are the last pass's. (Up to v425 the iterations were the last pass's alone: LaB6_real's full-profile stage ran 27 + 11 + 4 and reported 4.)

### 5.7 Esds, covariance, correlations

At the solution, the solver recomputes the Jacobian:

```math
C = (J^\top W J)^{-1}\,\chi^2_\nu,\qquad \sigma_j = \sqrt{C_{jj}},\qquad \rho_{jk} = \frac{C_{jk}}{\sqrt{C_{jj}C_{kk}}}
```

χ²_ν = χ²/(N − P), counting every free parameter. It multiplies the covariance unconditionally, so it also shrinks the esds when χ²_ν < 1. The angular esds of a free shape, found by a profile of χ², follow the same convention (§10.11).

**Parameters on a bound are kept in the covariance.** Held there, such a parameter would make the esds of the ones correlated with it conditional, and too small. In synthetic tests, the sizes of runs whose strain sat at 0 missed the truth by up to 3.8 of those esds. Kept, it makes them somewhat large instead: in Monte Carlo runs where the strain sat on 0 in about half the realisations, the size's esd was 1.3× its true scatter, the safe side. Its own esd is the curvature's, as if the bound were not there. It is listed in `atBound`, for the reader to take the value as a limit.

**A parameter with no effect on the pattern,** or numerically a combination of others, gets esd NaN and is listed as `undetermined`.

**So do the others of that combination.** With X and a phase's X_s both free (the profile has X + X_s), the factorisation drops whichever comes later in the free list. The inverse then gives the other the esd it has with that one held: the esd of the sum, not its own (0.0146 for X in the order [X, X_s] and for X_s in the order [X_s, X], on a synthetic SrTiO₃). The partners are the kept parameters whose coefficient in the dropped column's combination exceeds √10⁻¹⁰, the column's residual off their span (a smaller one cannot be told from it). They get esd NaN too, their covariance rows NaN; `tied` lists each set and `esdHeld` keeps the conditional esds. The worker's warning says that only a combination of them is determined. `autoRefine` never frees X with an X_s. Two copies of a CIF at one cell and width do give two tied scales (the pattern sees their sum): the detection test (§6.4) reads the first by its esd with the other held, and the second, undetermined, goes.

**What the esds are.** They are those of linear least squares at the minimum, with the residuals taken as independent:
- They do not include the serial correlation that a systematic misfit gives the residuals (no Bérar–Lelann or Durbin–Watson correction). See §15.
- They do not include the uncertainty of anything held: the instrument from the standard, the atoms' positions and B, the wavelength.

## 6. The refinement strategy

`autoRefine` takes a pattern from the CIF's cell to a converged fit in stages. Each stage frees more parameters than the last, and each starts from where the previous one ended.

### 6.1 Starting values

**Width estimate** (`widthEstimate`). The Kα₁ FWHM of the most prominent peak:
- the peak: the local maximum of the counts smoothed over 3 points that stands highest above the higher of the lowest counts within ±4° on either side. (The highest count had been the 1/2θ rise at 5° on a strong air-scatter background.)
- its FWHM above a local background, the 10th percentile within ±4°, with the half-maximum crossings interpolated linearly;
- less the smoothing's widening: a 3-point boxcar adds 16 ln2·s²/3 to a Gaussian's FWHM², s the step;
- less the Kα₂ shoulder: the doublet of two pseudo-Voigts of the starting mixing (H_G = H_L), Kα₂ at the file's ratio and separation, read the same way, is solved for the line width that gives the reading;
- at least two steps.

On synthetic lines (six structures, steps 0.0084–0.05°, peaks of 50–20000 counts, flat and 1/2θ backgrounds) it reads the Kα₁ line's own FWHM, its axial-divergence tail included, at a median 1.03 (10–90 %: 0.90–1.79; the high end is the two-step floor, for lines narrower than that). The full width of the smoothed doublet, up to v425, read 1.22 (0.95–2.45), 3× on sharp lines at coarse steps, and took a background maximum in 9 of the 270 patterns. It sets the starting widths, and through them the steps of the zero scan and the cell search; the refinement then frees the widths.

θ_E is that peak's angle.

**Without an irf** (the standard, or a sample before any standard is refined):
- h = H_est/1.635 (H_G = H_L = h gives H = 1.635h under TCH);
- W = h², Y = h·cosθ_E;
- U = V = X = 0.

**With the standard's irf:**
- U, V, W, X, Y, the asymmetry and the zero are the standard's.
- Each phase starts with X_s = 0 and the Y_s that gives the profile (the instrument's with Y + Y_s, TCH) the width H_est at θ_E: the sample's width above the instrument's, all of it Lorentzian to start with. (Up to v425 Y_s = max(0, H_est − H_inst(θ_E))·cosθ_E, which starts the width up to 7 % narrow, since widths do not add linearly.) With several phases, each phase the cell search places then gets its own start (§6.3).
- By WPPM, Y_s starts 1.23× lower: a sphere's own profile is 1.23× as wide as the Lorentzian of the same Y_s (§7.3).

**Asymmetry.** On the standard, A starts at 0.02 when the pattern holds at least 8 reflections in range; otherwise it is held at 0. On a sample it is the irf's (0 without one).

### 6.2 The standard: a zero scan

**The zero scan.**
1. The zero is scanned over ±0.3°, both ends on the grid, in steps of at most max(H_est, 0.02°)/4, and one step beyond each end (as the cell search, §6.3). Stepping from −0.3° by H/4, up to v425, had stopped short of +0.3°: at +0.2° for H = 0.5°. At each point the scales and background are solved exactly, with the FCJ collapsed to its centroid.
2. A minimum inside the range is placed by a parabola through its three points (on χ², §6.3), so the value found does not carry the grid's step.
3. A minimum on the edge of the grid, one placed outside ±0.3°, or a flat curve, leaves the zero where it was, with a warning.

**Then,** the cell is held at the certified value, and the stages free:
1. the scales and background;
2. the zero and displacement;
3. W and Y;
4. X, U, V and the asymmetry (the full profile) when at least 8 reflections lie in range; otherwise X alone. The count is taken after stage 3, over the phases detected (a candidate left out, scale 0, has its ticks but no lines: up to v425 an absent SrTiO₃ candidate had doubled a 20–60° LaB₆ pattern's 6 to 12 and freed U, V and the asymmetry on those 6 lines), without reflections whose F² is a rounding error (under 10⁻¹⁰ of the strongest).

### 6.3 A sample: the cell search

A sample's cell may be a few per cent off the file's: a doped phase, a DFT cell, a different temperature. Its peaks must be found before least squares can refine anything: a peak that does not overlap its own model gives no gradient towards it.

**The scan** (`cellSearch`). All the phase's cell lengths are scaled by a common factor f (angles and axial ratios kept). R_wp is scanned over f ∈ [1 − 0.03, 1 + 0.03]. At each point:
- the other phases are held;
- the scales and background are solved exactly;
- the FCJ is collapsed to its centroid.

**The step.** Scaling the lengths by δf shifts a line by Δ2θ = 2tanθ·δf, so the step is

```text
δf = H(θ_max)·π/180 / (3 · 2 tanθ_max)        (H in degrees)
```

This keeps the shift of the last peak in the range below a third of its width, so the minimum cannot fall between grid points.

**The grid.**
- **Single pass.** When that needs at most 161 points, one pass of at least 41 points.
- **Two passes,** otherwise:
  - **Coarse pass.** 81 points. Every peak is widened (W raised by H_c², H_c being the width whose third the coarse step moves the last peak by). Windows shrink to ±10 FWHM: ±18° windows on a large cell had made this pass most of the search.
  - **Fine pass.** It runs around the coarse minimum, with the true profile.

  Examples:

  | 2θ_max | H(θ_max) | Grid |
  |---|---|---|
  | 80° | 0.1° | a single pass would need 175 points (> 161): two passes, 81 coarse (+ 2 beyond the ends) + 11 fine |
  | 130° | 0.5° | one pass of 91 points (+ 2 beyond the ends) |

- **Ties.** Points within 10⁻⁹ (relative) are a tie, broken towards f = 1. A phase whose scale solves to 0 everywhere leaves a flat curve, whose first point (the edge of the range) would otherwise win.
- **One step beyond each end.** The grid runs one step past each end of the range, and the minimum counts when it is placed within the range. On a grid ending at the range's ends, a true factor within half a step of them fell on the last point and counted as no minimum: with a step of 1.5·10⁻³, f = 1.0294–1.0299 were not found (up to v425).
- **Placing the minimum.** It is placed by a parabola through the least point and its two neighbours, fitted to χ² (∝ R_wp²), the quantity that is quadratic about its minimum. A parabola in R_wp = √χ², up to v425, put it nearer the grid point: on a step of 1.5·10⁻³, 5.5·10⁻⁵ off in f on average (at most 7·10⁻⁵), against 6.5·10⁻⁶.

**No minimum inside the range** (on the edge, or flat) leaves the phase's cell where that search started it, with a warning that says which: the file's cell, or the first-round cell for a phase found in the first round but not in the second. Its lattice is then held through the refinement. Why:
- An edge minimum only starts a walk to the lattice bounds. Most often it means a candidate phase that is not in the sample: an absent rutile, anatase or ZnO next to SrTiO₃ had taken up to 74 wt % that way.
- An absent LaB₆ had moved 5.7 % off its cell to sit under SrTiO₃'s peaks.

**Several phases** are searched in two rounds, each phase with the others held. A phase scanned while another still sits at its CIF cell can be drawn to that one's peaks. Only the phases found in the first round are searched again: twice round, an edge minimum compounded to 0.97² = 0.94.

**A lone phase not found** is searched once more over ±6 %. With no other phase to be confused with, the search may go wider at no risk.

**Each phase's own starting width** (`widthSearch`, with the standard's profile and several phases). The width estimate (§6.1) is one peak's, so one phase's. After the cell search, each phase it placed has its Y_s scanned, one phase at a time with the others held, the scales and background solved at each point:
- the grid: the profile's width at θ_E (the instrument's with Y + Y_s, TCH) from the instrument's own upwards, each point √2 wider than the last (a change of about a third of the width, as the cell search's step), up to the width of crystallites at the plausible limit of §6.4 (max(1 nm, two cells) across);
- the least R_wp is kept. A minimum at that upper end, or a flat curve, keeps the start; so does a phase the search did not place, which has no lines there to measure.

Why: a minority phase started at another phase's width can lose its lines in the first stages. A sharp perovskite (a = 4.00 Å, 80 nm) at 5 wt % beside 8 nm SrTiO₃, started at SrTiO₃'s width, had its cell pulled off by the broad profile in the lattice stage and came out of the widths stage at scale 0, then was left out: in 9 of 24 runs up to v425, 16 of 24 with a start 1 % wider. Started at its own width it is found in all 24, at 4.5–5.4 wt %. The search costs a few % of a two-phase refinement at most (CPU time over eight test refinements: 6.0 s with it, 6.0 s in v425; +4 % in another measurement); the final fits of the engine suites are unchanged.

**Then the stages free:**
1. the scales and background;
2. the lattice (angles included, except for phases not found) and the displacement. A sample's zero is never refined: it is the standard's (0 without one);
3. with an irf, each phase's Y_s; without one, W and Y;
4. with an irf, each phase's X_s ("size and strain"); without one, X ("profile shape"), with U, V and the asymmetry held at 0.

### 6.4 Is each phase in the sample?

A candidate phase that is not in the sample still takes what misfit its peaks can reach, and bends the other results. Before the detection tests existed:
- an absent LaB₆, held at its cell with the starting widths, came out at 2.9 esd yet 35(8) wt %;
- a broad absent NaCl, its strong lines within 0.6° of SrTiO₃'s, took 40 wt % of a SrTiO₃ pattern by fitting the tails a single crystallite size leaves.

Three tests decide, and a phase that fails is **left out**: scale 0, its cell back to the file's (for its ticks), and nothing of it refined further.

1. **Its scale must stand above 3 esd.** This is tested after the first stage, and again after the last. A scale tied to another's (§5.7: two copies of a CIF at one cell and width, the pattern seeing only their sum) is read by its esd with the other held.

   **When the scale's esd is large.** Where a phase's scale correlates with its widths (very broad lines) or with another phase's (two populations of one phase), scale/esd understates the evidence. A phase that the test after the last stage leaves out is judged again by what leaving it out cost, read from the stages run again without it: the rise of χ² (divided by χ²_ν, as the shape's ΔBIC, §10.8) against its dP parameters.
   - **Above dP·ln N + 10** (a ΔBIC under −10, the shape's margin) it is put back and the stages run again with it, its 3-esd tests waived; a warning gives its esd and the rise. The other two tests still apply. Two populations of one SrTiO₃ (`t-detect`, a sharp one at 5 wt % beside a broad one): one of the two fell to 1.6–2.7 esd in all 8 runs, while leaving it out raised χ² by 47–91 for its 4 parameters (the bar: 43). Both are now kept, the broad one at 79–96 wt % (95), where up to v425 one population alone carried the whole pattern in 7 runs of 8. An absent NaCl that took up an unmodelled amorphous hump stood at 2.9 esd and leaving it out raised χ² by 212; put back, its cell ran to the ±10 % bound and it went as implausible.
   - **Below,** it stays out, and the warning gives the rise, dP, and whether the rise is within what fitting noise gives (χ² with dP degrees of freedom, up to dP + 3√(2dP)) or above it. 2 nm rutile at 8 wt % beside 80 nm SrTiO₃ (lines 9 counts high and 4° wide on 150) stood at 1.9–2.9 esd while leaving it out raised χ² by 24–48 for its 5 parameters: more than noise gives, short of 53. It reads "Leaving it out raises χ² by 25 for its 5 parameters (fitting noise gives about 5; a BIC would keep it above 53): more than noise gives, too little to tell".
   - **Why not a bar at what noise gives.** χ²(dP) is the gain of dP parameters at fixed places. A candidate's cell and width are searched to where they gain most, so an absent phase gains more: over 84 synthetic runs with an absent candidate (seven structures, SrTiO₃ at 7 and 80 nm, with and without an unmodelled hump), 15 stood at 2–3 esd at a test, against about 2 that a normal scale would give, and an absent NaCl beside a hump raised χ² by 14 for its 4 parameters (the noise bar 12.5). None of the 84 was kept.
2. **It must be plausible as a crystalline phase** (when several phases are present). Beside other phases, a candidate that only takes up a broad hump or the background is not, however significant:
   - its cell runs to the ±10 % bound;
   - with the standard's profile, its size or strain broadening runs to its upper bound, or its crystallites come out smaller than twice its longest cell edge, or than 1 nm, whichever is larger.

   An absent NaCl or quartz beside a SrTiO₃ with an unmodelled amorphous hump had come out at 46–48(6) wt %, 0.8 nm, its Ys on its bound, through both other tests.
3. **It must have intensity of its own** (`ownEvidence`, when several phases are present).
   - **Its clear lines.** Its lines above 2 % of its strongest that no line of another phase at least a tenth as high comes within 1.5 FWHM of (Kα₂ included).
   - **The fit there:** over the points within 1.5 FWHM of those lines, y − y_c + P = α·P + c₀ + c₁(2θ − 2θ̄), with P the phase's calculated pattern and a straight line for each stretch: the lines take up what the background and the other phases' tails could.
   - **Reading α.** A phase present gives α ≈ 1; one that is not has no clear line, or α ≈ 0 at them.
   - **The test.** At least 5 % of its intensity in clear lines, and α > 3 esd.
   - **Few points.** α is fitted whenever those points determine it (the factorisation keeps its pivot, and none of the lines' terms is a combination with it): a stretch of one or two points fixes only its own line. Up to v425 more than 10 points were required, a limit no derivation gave. Si at 1.3 wt % (200 nm) beside 10 nm SrTiO₃, scanned over 20–60° at 0.03–0.05°, holds 49 % of its intensity in clear lines over 5–10 points: it was left out in 6 runs of 6, as having no clear line; now it is found in all 6, at 1.23–1.36(6–9) wt %.
   - **Why clear lines, not a share of the intensity.** Up to v424 the region was the points where the phase holds at least 2/3 of the calculated Bragg intensity. Beside a broad phase's Lorentzian tails a minority phase rarely does, even at its own peaks: rutile at 2–5 wt % and 10–30 nm beside 7 nm SrTiO₃ was left out at 15–36 esd, and SrTiO₃ reported at 100 wt %. With clear lines (`t-detect`, 8 seeds each): rutile at 1 wt % found 6 times in 8 (0 before), at 2 wt % 8 in 8 (1 before), at 5 and 20 wt % 8 in 8, its fraction within 0.1–0.2 wt %. An absent broad NaCl, its lines within 0.6° of SrTiO₃'s, has none clear and still goes.

**Restart.** A phase that fails a test at the end of a pass is left out, and the stages are run again from the cell search's result without it.
- Of the phases whose scale is not above 3 esd, the least significant goes, one per pass (backward elimination). Phases whose lines overlap have correlated scales, and leaving one out changes the others' esds. Up to v425 they all went at once: a broad and a sharp population of one SrTiO₃ (`t-detect`'s case, the sharp one at 1 and at 2 wt %) both fell under 3 esd and both went in 5 runs of 24 each, leaving no phase at all and χ²_ν at 20; one at a time, at least one of them stays in all 48 (χ²_ν ≈ 1).
- Only when none fails that test (and none is implausible) is the own-intensity test applied. Then one phase goes per pass: the one with the least intensity of its own. None goes when no phase has a region of its own.
- Phases that fail the 3-esd test after the first stage are dropped in that same pass, without a restart.

**Two copies of the same CIF** (the same lattice type and number of atoms in the cell, the cell mass within 0.1 %, and a, b, c each within 2 %) count as one phase in this test. That allows two size populations of one phase.

**Warnings** say why a phase was left out, e.g. "…93 % of its calculated intensity lies under SrTiO₃'s peaks, and none of its lines stands clear of theirs"; or "…its lines clear of theirs hold only 3.2 % of it (under 5 %)"; or "…at its lines clear of theirs (49 % of it) the pattern shows 66 ± 30 % of the intensity calculated: not told from none". When no phase has a clear line, none goes, and the warning says that the pattern tells neither whether each is there nor their fractions: on the user's 37D a NaCl candidate, its 3 nm lines covering SrTiO₃'s, stays at 62 wt % with that warning.

### 6.5 Optional stages

After the four stages, the phases' options add stages, in this order. Each frees its parameters on top of everything already free:
1. **Anisotropic strain** (§7.5): Stephens' S_j. ε² = ε₀² + 10⁻⁶ Σ S_j q_j has no derivative at ε₀ = 0 where it is clipped, so X_s is first raised to at least 0.02°.
2. **Planar faults** (§7.6): the fault probability, from 0.
3. **Size distribution** (§7.4): σ enters the profile to second order (a distribution and its mirror in ln D differ only beyond), so from σ = 0 it has no derivative. It is refined from 0.3 and from 0.6, and the lower χ² is kept.
4. **Displacement parameters** (§8): ΔB, the B per site or the Uⁱʲ per site.
5. **Preferred orientation** (§9).

Then, separately, the **free crystallite shape** (§10).

**Failures.** When every trial refinement of a stage fails (an exception, which none of the tests met), the warnings say so and the result reports what was used. A size distribution not refined is a single size (`models`: 'wppm', σ = 0); a preferred orientation not refined is not applied (no entry in `textures`; up to v425 its axis was listed at r = 1); a free shape none of whose trials refined "could not be refined" (up to v425, "not supported by the data, ΔBIC about +Infinity").

**The standard's profile is required** by WPPM, the anisotropic strain and the faults. Without it, the instrument's broadening and the sample's are one and the same. A phase that asks for them without it is refined without them, with a warning; the result's `models` says what each phase was refined with.

### 6.6 What a refinement returns

`autoRefine` returns:
- the parameters with their esds, covariance and correlations;
- the free list, `atBound` and `undetermined`, with `tied` and `esdHeld` (§5.7);
- the statistics;
- a record per stage (R_wp, R_exp, χ², R_p, cR_wp, free parameters, iterations over its FCJ passes and how many passes (§5.6), convergence, time);
- the cell-search curves;
- per phase: size and strain, weight fraction, detected or not;
- the warnings;
- the shapes kept, with their search record;
- the textures;
- the models each phase was refined with (`models`: size profile, strain, faults, displacements), from which the card draws the result again;
- the isotropic fit's parameters (when a shape was kept);
- the number of reflections in range (of the phases detected).

## 7. Instrument, size and strain

### 7.1 From the standard to the samples

**The irf.** The standard's refined U, V, W, X, Y, asymmetry and zero are passed to every sample, with the standard's λ1 and goniometer radius from its file. That sample's U … asymmetry and zero are then held at the standard's values. The irf in use is stored with each sample's result.

**What it includes.** The standard's own broadening (LaB₆ SRM 660c is large-grained and nearly strain-free) is part of the irf. Its uncertainty is not propagated into the samples' sizes.

**What it assumes, and what is checked.**
- **The wavelength.** The profile is in degrees at the standard's λ1. A pattern of another λ1 (by more than 10⁻⁴ of it: one anode's λ1 as different tables give it agrees to 2·10⁻⁵, Cu 1.540562–1.540598 Å; the next anode's differs by over 10 %) is refined without it, as if there were no standard, and a warning says why: its widths, and the sizes from them, then include the instrument's, as the card and `rietveld_peaks.csv` note. Up to v425 such a profile was applied silently.
- **The goniometer.** A pattern on another radius (by more than 10⁻³) is refined with the irf, and a warning says that its profile and asymmetry may not be this instrument's. Not refused: a file that gives no radius reads 240 mm (§2.2), so a mismatch may be a file's silence rather than another goniometer.
- **The rest of the optics and the 2θ range** are not checked. Outside the standard's range, the Caglioti quadratic is extrapolated.
- **A standard refined again.** A sample's result keeps the irf it was refined with. When the standard's refinement is no longer that one (refined again, cleared, or another file chosen as the standard), the card says so under the sample's results, and `rietveld_results.csv` carries `standard_changed_since` = 1 for it, until the sample is refined again (*Refine all* refines the standard first).

### 7.2 Size and strain from the Lorentzian widths (`sizeStrain`)

With an irf, every phase's broadening above the instrument is Lorentzian:

```math
H_{L,\text{sample}} = X_s \tan\theta + \frac{Y_s}{\cos\theta}
```

The size term goes as 1/cosθ, the strain term as tanθ:

```math
D = \frac{K\lambda_1}{Y_s\,\pi/180},\quad K = 0.9;\qquad
\varepsilon = \frac{X_s\,\pi/180}{4}\quad\left(H_{L,\varepsilon} = 4\varepsilon\tan\theta\right)
```

- D is reported in nm, with λ1 the Kα1 wavelength.
- **The strain is defined on the FWHM.** H_L,ε = 4ε·tanθ is the Lorentzian's FWHM, the same convention as K = 0.9 for the size: WPPM's 2εd\* (§7.3), Stephens' ε (§7.5) and the Williamson–Hall slope (§12.4) use it too. Stokes and Wilson read it on the integral breadth, β = (π/2)·FWHM for a Lorentzian: their e = β/(4 tanθ) is 1.571× the ε reported here, their apparent strain η = β·cotθ = 4e. GSAS-II's isotropic microstrain μ (in 10⁻⁶, a Lorentzian FWHM μ·10⁻⁶·tanθ in radians) is 4ε·10⁶.
- **Esds.** σ_D = D·σ_Ys/Y_s, and σ_ε = σ_Xs·(π/180)/4. Both come from the refinement's covariance, without the irf's uncertainty.
- **No broadening.** Y_s = 0 gives "no measurable broadening" (D = ∞).
- **Without an irf,** the whole Lorentzian width Y is used, the instrument's included, and the card says so. All phases then share one profile.

**The calibration K = 0.9 applied to the Lorentzian FWHM** (on Scherrer's constant, Langford & Wilson 1978) matches the Scherrer sizes of the XRPD Analysis card, so the two can be compared. It is a convention, not the Stokes–Wilson size of a sphere:
- A sphere's volume-weighted column length is ⟨L⟩_V = 3D/4.
- For a Lorentzian, the integral breadth is β = (π/2)·FWHM.
- So that relation gives D = 8/(3π)·λ/(FWHM·cosθ) = 0.849·λ/(FWHM·cosθ).

The reported D would therefore be 6 % above a sphere's diameter if the fitted Lorentzian had the sphere's breadth. It does not. A crystallite's line is not a Lorentzian, and least squares fits the whole of it: the core, which ⟨L⟩_V sets, and the tails, which ⟨L⟩_A sets. Matching the breadth alone would read 1.06 D, matching the tails alone 1.89 D, and matching the FWHM (FWHM·D·cosθ = 1.107 λ, §7.3) 0.81 D. The ratio 1.107/0.9 = 1.23 relates the FWHM of a sphere's line and of the Lorentzian at equal Y_s; it is not a conversion of the refined D.

**What the Lorentzian D reads on true crystallites.** Measured on noise-free WPPM patterns (SrTiO₃, ZnO, rutile and a monoclinic cell; 2θ 15–120°; the user's instrument, one with every width ×¼ and one ×2), refined with the Lorentzian model:
- **Spheres of one size:** 1.07–1.12× the diameter at 5 nm, 1.20–1.21× at 10 nm, 1.26–1.29× at 20 nm and 1.47–1.70× at 50–100 nm, with a spurious microstrain of up to 9·10⁻⁴ (X_s free, as `autoRefine` has it; held at 0, 1.06–1.08, 1.16–1.18, 1.24–1.29 and 1.27–1.52×). The less of the line the size takes, the more its tails set the fit, and the reading moves from the breadth's towards the tails'. Lines overlapped throughout (the monoclinic cell) read lower: 0.95–1.04× at 5–10 nm, 1.15–1.18× at 20 nm.
- **Log-normal distributions** (§7.4), against the volume-weighted mean diameter D_V of 10 and 30 nm: 1.10–1.27× at σ = 0.3, 1.04–1.13× at 0.5, 0.94–0.98× at 0.76, 0.83–0.96× at 0.94 and 0.70–0.96× at 1.2 (the larger figures at 10 nm).

So the Lorentzian D is an apparent size, a Scherrer reading of the fitted profile comparable with the Analysis card's, and not a diameter. True dimensions need the crystallites' own profile: WPPM (§7.3).

**Sizes compared in the card.** The Lorentzian model's sizes (the isotropic D, a free shape's dimensions) and the single-peak table and Williamson–Hall sizes (§12) all apply K = 0.9 to a Lorentzian FWHM, so for a Lorentzian phase their ratios are free of K. WPPM's sizes are true dimensions, with no K, while the table and the Williamson–Hall line stay Scherrer readings: for spheres of one size they come out about 0.85–0.88× the diameter, for a log-normal distribution as σ has it (0.87–0.88× D_V at σ = 0.3, 1.10–1.19× at 0.94; noise-free SrTiO₃ and ZnO, 10 and 25 nm). For an isotropic WPPM phase the card reads its model's own peaks the same way and gives the size they read beside the refined one (§12.4), so the gap between the two kinds of size is shown as the reading's, not the sample's.

**No Gaussian sample broadening is modelled.** A sample can never come out narrower than the standard (Y_s, X_s ≥ 0).

**Other profiles.** The size can instead be modelled by WPPM (§7.3), with one size or a log-normal distribution (§7.4); the strain can depend on the direction (§7.5); planar faults add their own broadening (§7.6).

### 7.3 Whole Powder Pattern Modelling (`wppmLine`, `xrd-broad.js`)

**Why.** A Lorentzian of the right breadth is the profile of a broad, exponential distribution of column lengths (§7.2). A single solid's profile has another shape:

| Profile | FWHM/β | ⟨L⟩_A/⟨L⟩_V |
|---|---|---|
| Lorentzian | 0.637 | 0.5 |
| sphere | 0.830 | 0.89 |
| slab, all columns equal (profile T·sinc²) | 0.886 | 1 |

At equal breadth β, the slab's tails are half the Lorentzian's: they go as 1/(2π²s²⟨L⟩_A). With the Lorentzian model, that difference goes into Y_s, the background and the sizes. Whole Powder Pattern Modelling (Scardi & Leoni 2002) takes each cause of broadening by its Fourier coefficients instead. The profile is the transform of their product.

**The coefficients.** A line is synthesised in δ = d\* − d\*₀ (Å⁻¹), where a size profile is symmetric whatever the angle:

```math
A(L) = \Bigl[\eta\, e^{-\pi H L} + (1-\eta)\, e^{-(\pi H L)^2/(4\ln 2)}\Bigr]\; e^{-\pi W_L L}\; A_S(L)\; \sum_k w_k\, e^{-2\pi i L \delta_k}
```

| Factor | What it is |
|---|---|
| H, η | the instrument's pseudo-Voigt at the line, from the standard's U … Y (TCH, §3.6), H converted to d\* (×cosθ·(π/180)/λ) |
| W_L | the Lorentzian terms' FWHM in d\*: 2εd\* for the strain (4ε·tanθ in 2θ) and κ/π for the faults (§7.6) |
| A_S(L) | the crystallites' common-volume function: the fraction of a crystallite's volume that its copy shifted by L along the diffraction vector still overlaps |
| δ_k, w_k | the axial divergence's nodes (§3.7), as shifts in d\* |

**The size factor** (`covBase`, `addMemberCoef`). For the base bodies, with ℓ the shift in their units:
- ball (diameter 1): 1 − 3ℓ/2 + ℓ³/2;
- cube (edge 1): (1 − ℓa)(1 − ℓb)(1 − ℓc), with a, b, c the direction's absolute components;
- cylinder (diameter 1, height 1): (1 − ℓc)·(2/π)(acos ℓs − ℓs·√(1 − ℓ²s²)), with s the component across the axis and c along it.

Without a shape, the body is a sphere of diameter D. With a free shape (§10), each member of the family has its own: the base body along that member's direction, at ℓ = L·|**t**|·(π/180)/(Kλ₁), **t** = **W** ∘ (Rotᵀ**u**) as in §10.3. An ellipsoid, a spheroid and an elliptic cylinder are affine images of the ball and the cylinder, so their factors are exact too. The members are averaged with their texture weights.

**The parameter.** Y_s stays the parameter, read as D = Kλ₁/(Y_s·π/180): the same conversion as the Lorentzian model's, but here D is the sphere's diameter itself, not a Scherrer size. At equal Y_s, a sphere's own profile is 1.23× as wide as the Lorentzian (FWHM·D·cosθ = 1.107λ), so a WPPM refinement starts Y_s 1.23× lower (§6.1). A solid's widths likewise read as its true dimensions, with no calibration (§10.3).

**The synthesis.** The coefficients are laid on a grid and transformed by a radix-2 FFT:
- **The window** is ±max(40·H_est, 1.5°) about the line, plus the divergence's spread, as for the pseudo-Voigt (§3.6). One period of the transform is the window.
- **The grid step** Δδ is an eighth of the narrowest component's FWHM. With a size distribution, that is the largest crystallites' (e^{3σ − σ²/2} times the mean). N is a power of 2, between 64 and 16 384.
- **The cap.** A line whose members differ in width, a thin plate's sharp in-plane members in a broad line, can ask for more: its window follows the mean width and its step the sharpest. Its members are then drawn in groups (`wppmLineOf`): sorted by width, each joins the group before it while that group's own window and step still fit the cap, and each group is synthesised on its own grid. The profile is linear in the members' coefficients, so the groups add up to the line; each is lowered by its own edge value, as a line is. On whole patterns of plates, discs and needles 0.4–2 nm thick and 300–2000 nm across (boxes, cylinders, one size and log-normal, cubic, hexagonal and tetragonal cells, 2θ 15–120°, the user's instrument and one 4× sharper), against the same code with the cap raised to 2²², the groups draw every pattern within 0.10 % of its largest peak, and the area within 0.4 % (the windows' edges, set per group). One grid with its step grown, as before, had drawn them up to 42 % off (1.3 % for a 1 nm sheet 500 nm across). A pattern whose lines fit the cap is unchanged. A sphere, with or without a distribution, has one member and keeps one grid past the cap, its step grown: its largest crystallites hold little of the line (0.06 % at σ = 1.5).
- **The coefficients** are computed out to where the instrument's and the Lorentzian terms' product falls under 10⁻⁸.
- **The edge.** Periodicity folds the tails beyond the window back in. So the profile is lowered by its value at the window's edge, the same point on both sides: it goes to zero there continuously, and what it leaves out goes to the background. This is the pseudo-Voigt's treatment (§3.6).
- **Reading it.** At each point of the pattern, δ(2θ) = 2(sinθ − sinθ₀)/λ. The profile is read by cubic (Catmull–Rom) interpolation and multiplied by the Jacobian cosθ·(π/180)/λ, so its area in 2θ is the line's intensity.

**Checks.**
- Against a direct quadrature of the same transform, the synthesised profile agrees to 0.03 % of the peak.
- On Lorentzian-like profiles, a WPPM line's area in the window is about 0.3 % below the pseudo-Voigt's at the same intensity. The periodic folding makes the pedestal taken off at the edge a little larger. Weight fractions between a WPPM phase and a Lorentzian one carry that bias.

**Cost.** On a synthetic SrTiO₃ pattern (2θ 15–120°, 5251 points), a sphere refines in about 3 s, a log-normal distribution in 8–16 s, and a free cylinder in 35–50 s. A free solid with log-normal sizes takes minutes: about 5 on the user's 33A. A broad distribution holds large crystallites whose narrow profiles set the grid, and every trial shape of the search pays for it. The log-normal average of a cylinder or a box is tabulated in ln ℓ₀ every σ/10 for each member and read by cubic interpolation (to 4·10⁻⁶); computed point by point, that case took 17–23 minutes.

**Needs the standard's profile** (§6.5). Without it, H and η would hold the sample's broadening too.

### 7.4 A log-normal distribution of sizes

**The model** (Scardi & Leoni 2001; Langford, Louër & Scardi 2000). Spheres (or the free solid scaled as a whole) with a log-normal distribution of sizes, of width σ in ln D (`LS`). A crystallite of relative size s diffracts as s³, so over the volume ln s is normal with mean 3σ² and variance σ² (relative to the median). The size factor is the average of the body's over that distribution (`lnAverage`):

```math
A_S(L) = \int a\!\left(\frac{L}{s D_m}\right)\, \phi_V(\ln s)\, d\ln s
```

**The quadrature.** In u = ln ℓ, the integrand is smooth on the body's support. Gauss–Legendre with 24 nodes over [μ − 7σ, min(ln T, μ + 7σ)] converges fast. The mass below μ − 7σ (about 10⁻¹²) is taken as a = 1. The average depends on L·scale alone. The sphere's is tabulated once per σ, every 0.01 in ln ℓ₀ from 10⁻⁴ to where it is under 10⁻⁹ (900–2500 nodes), and read by cubic (Catmull–Rom) interpolation. The nodes stay put when σ changes, so the interpolation's error changes smoothly with σ and the σ derivative (a central difference of 10⁻⁴) is clean: against the closed form, the values are within 3·10⁻⁷ and dA/dσ within 0.005 % from σ = 0.05. (2048 nodes spread over the range moved with σ; read linearly, dA/dσ was 11 % off at σ = 0.05 and 1 % at 0.3, and the esd of σ in a one-line fit 0.88× the exact one at σ = 0.05, D_V = 100 nm.) A cylinder's or a box's depends on the member's direction too: for a long line it is tabulated per member every σ/10 in ln ℓ over the line's reach, and read by cubic interpolation (to 4·10⁻⁶ of the value computed point by point).

**What the dimensions mean.** The parameter Y_s (or a solid's widths) gives the *volume-weighted mean* crystallite, ⟨D⁴⟩/⟨D³⟩ for spheres, which is e^{3.5σ²} times the median. The integral breadth, which ⟨L⟩_V sets, then stays with the size while σ changes the profile's shape. With the median as the parameter instead, σ and the size traded one for the other along the breadth.

**What is reported.**
- The volume-weighted mean diameter: what the breadth measures. The Lorentzian model's size reads 0.94–1.13× it at σ ≈ 0.5–0.8, more for a narrower distribution and less for a wider one (§7.2).
- The median, e^{−3.5σ²} times it.
- The number-weighted mean, e^{−3σ²} times it: what a count of crystallites (TEM) gives.
- σ itself.

**The profile's shape.** σ = 0 is one size: the tails fall fast. The two measures of §7.3 cross the Lorentzian's at different σ:
- **The tails.** ⟨L⟩_A/⟨L⟩_V = (8/9)·e^{−σ²} reaches the Lorentzian's 0.5 at σ = √ln(16/9) = 0.76: there the tails, which go as 1/⟨L⟩_A, are as heavy as a Lorentzian's of the same breadth.
- **The top.** FWHM/β reaches the Lorentzian's 2/π = 0.637 already at σ ≈ 0.66; at 0.76 it is 0.590, sharper-topped than a Lorentzian.

A larger σ is sharper at the top, with longer tails. σ rests on the profile's shape, so on how well the instrument's profile is known.

**A warning above σ = 0.8.** It rests on the tails' measure: past it the tails are heavier than a Lorentzian's, and most crystallites are far smaller than the mean: at σ near 1, the median is below a nanometre. The far tails set σ, and a background, a broad second phase or a strain with long tails can shape them as well. The volume-weighted mean stands; the median and the number mean rest on that tail. On the user's 33A (SrTiO₃, to 80°), with the anisotropic strain, {100} faults and B per site also free, σ came out 0.94(3), the median 0.35 nm: under one cell.

**Refined** in its own stage from σ = 0.3 and 0.6 (§6.5). Bounds 0 … 1.5.

### 7.5 Anisotropic microstrain (Stephens 1999)

**The model.** The microstrain of a reflection depends on the direction **u** of its diffraction vector:

```math
\varepsilon(\mathbf u)^2 = \varepsilon_0^2 + 10^{-6}\sum_j S_j\, q_j(\mathbf u)
```

- ε₀ = X_s·(π/180)/4 is the isotropic part.
- The q_j are the quartic forms of **u** that the Laue group leaves unchanged, less their mean over the sphere, scaled to unit rms and orthogonal to each other. So ε₀² is the mean of ε² over directions, and ε₀ the strain's rms over them as long as no direction's ε² is held at 0 (below). Each S_j is an anisotropic part of ε², in 10⁻⁶, and √ΣS_j²·10⁻⁶ the rms of ε² − ε₀² over directions.
- The number of S_j is Stephens' count less the isotropic term: 1 for a cubic phase, 2 hexagonal, 3 for 4/mmm, −3m, 4 for 4/m, −3, 5 orthorhombic, 8 monoclinic, 14 triclinic.

**The forms** (`quarticInvariants`) are built numerically for any group, rather than from a table:
1. The Laue operations, as they act on Cartesian diffraction vectors: C = B·Rᵀ·B⁻¹, turned into the conventional cell's frame (below).
2. Each of the 15 quartic monomials x^a y^b z^c, averaged over the group.
3. Their span reduced by Gram–Schmidt in the sphere's inner product, against the constant (x² + y² + z²)² and against each other. The inner product is exact, from the sphere's moments: the mean of x^a y^b z^c is (a−1)!!(b−1)!!(c−1)!!/(a+b+c+1)!! when a, b and c are even, else 0. (On 600 points the means had been up to 5·10⁻⁴ and the cross terms 1.5·10⁻³, for a triclinic phase.) A monomial whose group average vanishes leaves only rounding, judged against the monomial's own size.

Each reflection's forms are evaluated once, at its direction in the starting cell, as the free shape's member directions are.

**The frame** (`strainFrame`). The forms are built in the conventional cell's Cartesian frame (a\* along x, b\* in the x–y plane), u_conv = T·u with T = B_c·Mᵀ·B⁻¹ orthogonal, M the conventional axes in the file's fractions:
- classify's for a primitive file of a centred lattice or a non-standard setting (§2.4);
- the obverse hexagonal cell for rhombohedral axes, or for a reverse hexagonal cell (−a, −b);
- where the symmetry leaves the axes open, the reduced ones: an orthorhombic cell's in order of length (Pnma and Pbnm alike); a monoclinic cell's with the 2-fold along b, the a–c pair reduced (a the shorter, |a·c| ≤ a²/2: C2/c, I2/a and a primitive file alike) and β ≥ 90°; a triclinic cell's Buerger cell (the three shortest lattice vectors, the angles all acute or all obtuse).

One structure then gives the same S_j from any of these files. On synthetic tests the forms agree to 10⁻¹⁴: fcc, bcc, Ia-3d, I4₁/amd, C2/c, Cmmm and Immm primitive files, corundum and R-3 on rhombohedral axes and in the reverse cell, corundum in a primitive cell of the reverse lattice, rutile with its 4-fold along b, P2₁/c with unique axis a or c, β < 90° or a skewed a–c pair, C2/c as I2/a, Pnma and P-1 with their axes cycled, P-1 in a skewed cell. In v425 a primitive fcc file had given S1 the opposite sign, and the other cases other S_j altogether. Left open, as only the atoms' coordinates tell the settings apart: a turn the conventional cell allows but the Laue group does not hold. That is (b, a, −c) for 4/m and −3, and (−a, −b, c) for −3 and −3m on a primitive lattice (on a rhombohedral one the obverse cell fixes it); for a file on rhombohedral axes, the order of the axes. It changes the sign of one or two forms, also between an I4/m or R-3 file and its primitive cell. Lengths or angles equal to rounding would leave the reductions a choice as well. The S_j then mix by an orthogonal matrix, so √ΣS_j², the rms over directions and the per-plane strains stay the same.

**In the profile.**
- By the Lorentzian model, the reflection's own ε replaces the phase's: its H_L carries 4ε·tanθ.
- By WPPM, 2εd\* enters W_L (§7.3).
- Where the S_j take ε² to 0 or below, it is held at 0: no strain broadening there. The mean of ε² over directions is then above ε₀²: at X_s = 0.4°, S1 = −3 on a cubic phase a fifth of the directions are held and the rms is 5.6 % above ε₀; at X_s = 0.2°, 35 % and 51 %.

**Reported:**
- the microstrain's rms over directions: ε₀ when no direction is held at 0; otherwise √⟨max(0, ε²)⟩ over a 4000-point sphere (within 10⁻⁵ of a 400 000-point one), with ε₀ on its own line and the share of directions held in the tooltip;
- the anisotropy √ΣS_j²·10⁻⁶, the rms of ε² − ε₀² over directions, beside ε₀²;
- ε along the normals of the low-index planes (100), (010), (001), (110), (101), (011), (111), each family once. Where ε² ≤ 0, the line says so instead of giving 0 with an esd.

All with esds by propagation. The CSV gives `microstrain` (the rms), `microstrain_eps0`, `stephens_anisotropy_rms_1e-6` and the S_j.

**What it can and cannot do.** It is Laue-symmetric: all members of a family are broadened alike, so it cannot draw a plate, but it can mimic a dependence on hkl. It is Lorentzian only.

**Refined** in its own stage, from S_j = 0, with X_s first raised to at least 0.02° (§6.5). Bounds ±10⁴. The S_j's difference step moves ε² by 10⁻⁴ of its mean over the reflections (ε by 5·10⁻⁵ of itself), where the square root's curvature leaves the derivative within 10⁻⁹; a fixed step of 10⁻³ had been a third of ε² at the stage's start, the S1 column 1 % off.

### 7.6 Planar faults (after Warren)

**The model** (`faultTable`, `faultKappa`). Faults lie on the planes of a family {hkl}. Each displaces the crystal beyond it by a vector of a family f·⟨uvw⟩:
- The displacements are those of the family that lie in the plane (shears: a stacking fault, an antiphase boundary), or all of the family if none does.
- ±**R** count alike, so the faults broaden but do not shift.

Across a fault, reflection **h**'s phase jumps by 2π**h**·**R**. A column of length L along **h**'s direction **u** crosses L·|**u**·**n**_p|/d planes of orientation p, d their spacing. Each is a fault with probability α. So:

```math
A_F(L) = \prod_p \bigl(1 - \alpha\,(1 - c_p)\bigr)^{L\,|\mathbf u\cdot\mathbf n_p|/d} = e^{-\kappa L},\qquad
\kappa = -\frac{1}{d}\sum_p |\mathbf u\cdot\mathbf n_p|\,\ln\bigl(1 - \alpha(1 - c_p)\bigr)
```

with c_p the mean of cos 2π**h**·**R** over p's displacements.

- e^{−κL} is a Lorentzian of FWHM κ/π in d\*. By the Lorentzian model, the reflection's Y gains λκ/π·(180/π) (in °; divided by cosθ in H_L, like a size). By WPPM, κ/π enters W_L (§7.3).
- A reflection whose **h**·**R** is an integer for every displacement is not broadened. The broadening depends on **h**·**R** modulo 1: for ½-type displacements that is the indices' parity, for ⅓- and ⅙-type ones the indices modulo 3. So a higher order can be sharp where the first is broadened: for fcc {111} ⅙⟨112⟩ faults at α = 0.03, κ(111) = κ(222) = κ(444) = 2.03·10⁻² Å⁻¹ but κ(333) = 0, and κ(200) = κ(400) = 4.70·10⁻² Å⁻¹ but κ(600) = 0 (Warren: against a faulted plane (111), a component is sharp when h + k + l is a multiple of 3).
- **The spacing** d is the smallest non-zero projection of a lattice translation (the cell's and the centring's) on the planes' normal, (**h**·**t**)/|B**h**|. The values **h**·**t** are the integer combinations of h's components and of **h**·**c** for each centring **c**, rationals of small denominator, so their smallest positive one is their greatest common divisor, found exactly over the common denominator. (A search over translations with indices up to ±2 had missed it for planes such as (270), (380) or (570) of a primitive cell, which need ±3 or more: d doubled, κ halved and α doubled. Against a search to ±24, the gcd is right for all 1199 planes of indices up to 9 in seven lattices, P, I, F, R and C among them, where the ±2 search had 7–63 wrong.)
- **Refined:** α (`FA`), the probability per lattice plane of the family, from 0, in its own stage (§6.5). Bounds 0 … 0.45.
- **Per plane, not per layer.** Where a structure stacks several layers per lattice plane, α is that many times a probability per layer. Hexagonal close packings and wurtzite stack two close-packed layers per c, while the (001) planes are c apart: there Warren's α per layer is about α/2. For fcc {111} the lattice planes are the close-packed layers.

**The kinds offered** (`'hkl:f/g<uvw>'`):

| Faults | Typical of |
|---|---|
| {111}, ⅙⟨112⟩ | stacking faults of fcc metals (Shockley partials) |
| {001}, ⅓⟨1-10⟩ | basal stacking faults of hexagonal close packings (⅓⟨1-100⟩) |
| {100}, ½⟨111⟩ | Ruddlesden–Popper faults of perovskites |
| {100}, ½⟨110⟩ | antiphase boundaries on {100} |
| {111}, ½⟨110⟩ | antiphase boundaries on {111} |
| {110}, ½⟨110⟩ | antiphase boundaries on {110} |

**Faults that broaden nothing are refused.** When **h**·**R** is an integer for every reflection, the displacement is a translation of the lattice: ½⟨110⟩ in an fcc cell (offered for any phase), or f·⟨uvw⟩ with f·uvw whole, as 6/6. α would then be a parameter with no effect, so the phase is refined without faults and a warning says why. A specification that cannot be used (an unreadable form, f = 1/0) is refused with a warning too. Up to v425 both were accepted: α undetermined, and f = ∞ in the second case.

**Faults on every orientation at once.** Each crystallite is taken to hold faults on all the orientations of the family, independently, with probability α each. A line is then one Lorentzian, the same for all members of its family. Warren's treatment refers each member of a family to one faulted orientation. That splits a family into broadened and unbroadened members, whose mean broadening, at first order in α, equals this one's when Warren's α is N times this α (N the number of orientations: 4 for {111} of a cubic phase, 1 for a hexagonal basal plane, where the factor per layer above applies instead). The result line's tooltip says both.

**What is not modelled.** The peak shifts of fcc deformation faults and the asymmetry of twin faults (Warren; Velterop et al. 2000): with ±**R** alike, a shift goes into the cell.

**Validation.** Synthetic patterns with known faults (§14): fcc Pt with {111}, ⅙⟨112⟩ faults at α = 0.03, and ZnO with basal faults at α = 0.05, come back within their esds.

## 8. Displacement parameters

### 8.1 The choices

Each phase has a displacement option (`adp`):

| Choice | What is refined | How it enters |
|---|---|---|
| *from the CIF* (default) | nothing: each atom's B is the CIF's, or 0.5 Å² when it gives none | e^{−B s²} on each atom's amplitude (§3.3) |
| *one ΔB* | one shift `B` added to every atom's B (bounds −2 … 10 Å²) | e^{−2ΔB s²} on F² |
| *B per site* | one isotropic B per crystallographic site (§8.2) | e^{−B s²} on the amplitudes of the site's atoms |
| *Uⁱʲ per site* | the Uⁱʲ each site's symmetry leaves free (§8.3) | e^{−**h**ᵀβ**h**} on the amplitudes of the site's atoms |

- The Materials Project's CIFs give no B, so all their atoms start at 0.5 Å².
- The displacements are freed in their own stage, after the size, the strain, the faults and the size distribution, with everything else free (§6.5).
- The option is read when a run starts, so an undo during a run cannot change it between patterns.
- The built-in standard has no options: it is refined with its own B. A project saved with the v419–v423 card-wide *ΔB per phase* button opens with *one ΔB* on every phase.

### 8.2 Sites

**The sites** (`atomOrbits`, `xrd-cryst.js`). The atoms of the filled cell are grouped into orbits by the operations found from the atoms (§2.4): two atoms are one site when an operation takes one onto the other within 0.01 Å, with the same species and occupancy. The atoms are those `findSymmetry` placed, exactly symmetric, so the 0.01 Å holds whatever the rounding of the file. Each orbit is one site, named after its first atom's CIF label (letters and digits only; a repeated label gets `_2`, `_3`…).

**B per site** starts at the mean of the CIF's B over the site's atoms (0.5 Å² without one). Bounds −2 … 20 Å².

**Warnings.** A negative B is no vibration: it more likely takes up absorption, surface roughness, the background or a wrong occupancy.

### 8.3 Anisotropic displacements

**The convention** is the CIF's (Trueblood et al. 1996): Uⁱʲ in Å², on the reciprocal axes. With N = diag(a\*, b\*, c\*):

```math
\beta = 2\pi^2\, N U N,\qquad T(\mathbf h) = e^{-\mathbf h^\top \beta\, \mathbf h}
```

**The site's constraints** (`siteAdpBasis`; Grosse-Kunstleve & Adams 2002 treat them the same way). The site's own operations, those that keep its position within 0.01 Å, must leave β unchanged: RβRᵀ = β. The constraints are rows on (β11, β22, β33, β12, β13, β23), with integer coefficients and no cell in them, so they hold whatever the refined cell. In U they read T U Tᵀ = U with T = N⁻¹RN, which moves with the axial ratios when R mixes axes of different a\*: up to v425 the basis was made in U at the starting cell, and in the primitive cell of a centred orthorhombic or tetragonal lattice, refined through its conventional cell, the site symmetry was broken once the cell had moved (by up to 0.5 % for moves of 0.5–1.5 %, on 48 of 205 such phases from spglib; none since). On synthetic I222 and Ic2m patterns refined through their primitive cells, the refined β broke it by 1.4 % and U_eq differed by 0.3–0.4 % from a refinement in the conventional cell; now the site symmetry holds to 10⁻¹⁵, and U_eq agrees within 0.001 %. The rows are reduced to echelon form with the columns taken from the last, so the free parameters are the first ones:
- a cubic site keeps U11 alone;
- a site on a tetragonal axis keeps U11 and U33;
- rutile's Ti and O (site symmetry mmm and m2m) keep U11, U33 and U12, with U22 = U11 and U13 = U23 = 0.

Each parameter is the Uⁱʲ of its own component on the current cell's axes; the others follow from it through β (`adpU`), with the current reciprocal lengths. The parameters are named `U11_<site>` and so on.

**The site's other atoms.** Each atom of the orbit takes the site's β turned by the operation R that put it there: β_k = RβRᵀ. Atoms with the same species, site and R form one scattering type (§3.3).

**Start and bounds.** The isotropic U of the CIF's B, Uⁱʲ = U·(**a**\*_i·**a**\*_j)/(a\*_i a\*_j), projected onto the site's free parameters (it lies in their span exactly). Bounds ±0.5 Å².

**Reported.** Per site: the free Uⁱʲ, and B_eq = 8π²U_eq with U_eq = ⅓ Σ Uⁱʲ a\*_i a\*_j (**a**_i·**a**_j) (Fischer & Tillmanns 1988). The esd of B_eq comes by propagation through the covariance. A U that is not positive definite (some direction with ⟨u²⟩ ≤ 0) gets the same warning as a negative B.

**The axes** are the file's: for a primitive file of a centred lattice, the Uⁱʲ refer to its axes, not to the conventional cell's.

### 8.4 How well they are determined

**ΔB.** It is strongly correlated with the scale (and so with the weight fractions) and with the background. On the user's nanocrystalline SrTiO₃ (Cu, 2θ 10–80°, isotropic size), freeing it gives:

| Sample | ΔB (Å²) | ρ with the scale | ρ with X_s (strain) | ρ with Y_s (size) | ρ with background terms |
|---|---|---|---|---|---|
| 33A | 0.03(11) | 0.85 | −0.77 | 0.72 | ≤ 0.18 |
| 33A, (100) texture | 0.40(10) | 0.87 | −0.76 | 0.72 | ≤ 0.16 |
| 37D | −0.09(17) | 0.85 | −0.82 | 0.77 | ≤ 0.19 |
| 37D, (100) texture | −0.05(16) | 0.84 | −0.83 | 0.77 | ≤ 0.21 |

The value is statistically determined (±0.1–0.17 Å²) but not robust. Three reasons:

1. **A short lever arm.** With Cu up to 2θ = 80°, s² ≤ 0.174 Å⁻². A ΔB of 0.1 Å² changes the intensity by 3.4 % at 80° and by 0.65 % at the (110). The scale and ΔB differ only by that slope in s², hence ρ ≈ 0.85.
2. **Broad peaks.** In a nanocrystalline pattern, what is well measured is each peak's height (its area over its width), while the Lorentzian tails merge into the background. A higher B lowers the high-angle areas; narrower high-angle peaks (a lower X_s) keep their heights, and Y_s rebalances the low angles. Freeing ΔB therefore costs precision on the size and strain too.
3. **The esd sees only the noise.** Adding the texture moved ΔB on 33A by 0.37 Å², 3.5 esd. Anything that changes the intensities with angle ends up in ΔB:
   - surface roughness (it lowers the low angles and mimics a negative B);
   - absorption and transparency;
   - texture;
   - the tails left to the background.

**B per site and Uⁱʲ.** Each site's B differs from the others' only through how the sites weigh in each reflection's F, on top of the same slope in s². On data like these, that is worse conditioned still. On 33A (to 80°, with the log-normal sizes, the anisotropic strain and {100} faults also free), B per site gave B(Sr) 1.32(18), B(Ti) −0.44(20) and B(O) −2.00(12) Å², the last on its bound: values no vibration gives, each flagged by a warning. On synthetic rutile measured to 145° with good counting statistics, B per site and Uⁱʲ come back within their esds (§14).

**What would determine them better:** data to 2θ = 120–140° (s² up to 0.32–0.37 Å⁻², twice the lever arm), counted longer at high angle. A roughness correction would be more physical, but on such data B and roughness are notoriously correlated (§15.3).

## 9. Preferred orientation

### 9.1 The model (March–Dollase)

A platy or needle-like powder packs with its crystallites oriented, which changes the relative intensities, not the widths. Each member **h**ᵢ of a reflection's family is weighted by

```math
t(\alpha) = \left(r^2\cos^2\alpha + \frac{\sin^2\alpha}{r}\right)^{-3/2}
```

- **α** is the angle between the member's plane normal and the texture axis: the normal of the chosen (hkl). The axis is given in the conventional cell and taken to Cartesian as the reciprocal vector B·h.
- **Reading r.** r < 1 means plates lying on those planes (their normal along the sample's normal); r > 1 means needles. r = 1 is no texture.
- **Normalisation.** t is normalised to a mean of 1 over the sphere.
- **Per reflection.** A reflection's factor is the mean of its members' weights. With a crystallite shape, each member keeps its own weight (§3.1).
- **Fixed directions.** The members' directions are computed once, from the starting cell.

### 9.2 Options and refinement

**Options.** The per-phase picker offers:
- none;
- *best axis* (`auto`);
- (100), (010), (001), (110) or (111).

Through the API the axis can also be given as [h, k, l], '110', '1 -1 0', '1,-1,0', '[1 1 0]', '(110)' or '{110}', with spaces around it or not. One that cannot be read leaves the phase without texture, with a warning that says so (up to v425 it was dropped silently: ' 1 1 0' and '[1 1 0]' gave no texture).

**Starting r.** For a cubic phase, r has no first-order effect at r = 1: the members of a family weigh out evenly to first order. So r is refined from 0.8 and from 1.25 (plates and needles), and the lower χ² is kept.

***Best axis*** does the same on each of (100), (010), (001), (110), (101), (011), (111), one per Laue family: three for a cubic phase. The lowest χ² wins.

**Where the stage runs.** It runs after the isotropic stages. r stays free in everything after it: the shape search, the held frames and the angular profiles.

**Reporting.**
- The result line gives r with its esd. Its tooltip says how many esd r lies from 1, and under 2 esd "not told from no texture".
- There is no automatic significance test: the texture is kept whatever r comes out.
- The CSV row is `texture_r_h_k_l`.

### 9.3 Why it matters for the shape: the user's 37D

On the user's 37D SrTiO₃, every free solid ended as plates ⟂ ⟨310⟩. The sample is known to be made of the same flower-like petals as 33A: plates ⟂ ⟨110⟩.

**The cause was the intensities, not the search.**
- Against the isotropic fit, the (111) measures 0.62 of its computed area and the (200) 1.29.
- With no other way to move them, the shape took this up through the widths: it widened the (111) to bring its top down, and narrowed the (200).
- That is the reverse of their single-peak widths, so the Williamson–Hall misfit got worse: the predicted widths' χ²_ν was 104 for the shape, against 46 for the isotropic size.

**With the texture:**

| | Without texture | With (100) texture |
|---|---|---|
| 37D, isotropic | χ²_ν 1.672 | χ²_ν 1.368, r = 1.551(13) |
| 33A, isotropic | χ²_ν 1.706 | χ²_ν 1.497, r = 0.752(4) |

With the texture, four of the five solids on 37D find plates ⟂ ⟨110⟩:

| Solid | Thickness | Plate normal |
|---|---|---|
| cylinder | 1.84(8) nm (a disc) | its axis 9.8° from [110] |
| box | 2.09(14) nm | 2.6° from [110] |
| ellipsoid | 2.6(2) nm | 6.1° from [110] |
| elliptic cylinder | 2.29(10) nm | along [1-10], 5.0° |

The spheroid's polar axis, 2.3(2) nm, lies 9.2° from [221], itself 19.5° from [110].

The widths the solids predict agree with the single-peak ones: χ²_ν 2.6–6.1, against 40.5 for the isotropic size.

**What else was tried on 37D:**

| Tried | Outcome |
|---|---|
| More random starts (40 more, 8 full refinements instead of 3) | the same minima |
| Starting from the solid that best fits the Williamson–Hall widths | six widths against five or six shape parameters are fitted exactly by extreme shapes (an ellipsoid 1.5 nm × ∞ × 8.6 nm), which the whole pattern then rejects |
| Refining each reflection's intensity freely | plates ⟂ ⟨110⟩, but a fit that frees the intensities is not a Rietveld refinement |
| Yb on the Sr site | worse |

In the perovskite:
- F(111) = f_Sr − f_Ti + 3f_O;
- F(200) = f_Sr + f_Ti + 3f_O.

More scattering on the Ti site lowers the (111) against the (200); more on the Sr site raises it. With an isotropic size and no texture, the fit gives:

| Model | χ²_ν |
|---|---|
| stoichiometric | 1.672 |
| Yb on Ti, 5 % | 1.642 |
| Yb on Sr, 5 % | 1.719 |
| Sr vacancies, 20 % (implausible) | 1.488 |
| the texture alone | 1.368 |

Occupancies and texture compete for the same information (the relative intensities). On these data the texture is the best one-parameter description, and it is present in the pure 33A too.

## 10. The free crystallite shape

### 10.1 Why each member of a family gets its own width

An isotropic size gives every reflection the same size broadening, H_L ∝ 1/cosθ.

The user's SrTiO₃ is made of flower-like particles whose petals are plates a few nm thick, normal to a ⟨110⟩. There the (111) and (200) are narrower than the (110), which no single size can draw.

**Why the usual anisotropic models cannot draw it.** The usual models (GSAS-II's, MAUD's) give each *family* one width, Laue-symmetric or from a representative hkl. A plate normal to one ⟨110⟩ breaks the cubic symmetry of the crystal: (110) and (1-10), members of one family, then have different column lengths. A width per family cannot describe such a shape at all.

**What the engine does.** It draws each member of each family with its own width, and the peak is their sum: a sharp part and a broad part.
- The members are the Laue-equivalent **h** (one of each ± pair).
- Their directions are Cartesian unit vectors computed from the cell once (`memberVectors`); the cell moves by tenths of a per cent in a refinement.
- Each member carries 1/m′ of the reflection's intensity (times its texture weight).

### 10.2 Column lengths of the solids

**The width of a member.** Stokes & Wilson: the integral breadth of the size profile along a diffraction vector of direction **u** is λ/(⟨L⟩_V(**u**)·cosθ). ⟨L⟩_V is the crystallite's volume-weighted mean column length along **u**:

```math
\langle L\rangle_V(\mathbf u) = \frac{2}{V}\int_0^{T} g(t\,\mathbf u)\,dt
```

- g is the covariogram: the volume common to the body and its copy shifted by t**u**.
- T is the shift at which the two no longer overlap.

**Affine images.** Every solid is the affine image of a unit base body: body = Rot·diag(D)·base. The base is a ball (diameter 1), a cylinder (diameter 1, height 1) or a cube (edge 1).

The covariogram of an affine image is the image's, so:

```math
\langle L\rangle_V(\mathbf u) = \frac{\langle L\rangle_{V,\text{base}}(\hat{\mathbf w})}{|\mathbf w|},\qquad \mathbf w = \mathrm{diag}(1/D)\,\mathrm{Rot}^\top\mathbf u
```

One function per base body (`columnLengthV`) therefore serves every proportion and orientation.

**The base bodies' closed forms** (in terms of the absolute values a, b, c of ŵ's components):

| Base body | ⟨L⟩_V |
|---|---|
| Ball | 3/4, in every direction |
| Cube | 2(T − (a+b+c)T²/2 + (ab+bc+ca)T³/3 − abc·T⁴/4), with T = 1/max(a, b, c) |
| Cylinder (axis z) | (8/(π s))·(F₀ − (c/s)·F₁), with s = √(a² + b²) |

- **Cube.** It gives 1 along [100], 1/1.0607 along [110] and 1/1.1547 along [111] (Langford & Louër's K_β).
- **Cylinder.** With D = min(1, s/c):
  - A(d) = ½(acos d − d√(1−d²)) is the overlap area of two unit-diameter discs d apart;
  - F₀ = ∫₀^D A(x) dx and F₁ = ∫₀^D x·A(x) dx, both in closed form.

  Close to the axis (s < 10⁻³c), where the closed form cancels, the series (1 − 4p/(3π) + p³/(15π))/c with p = s/c is used. The values are 1 along the axis and 8/(3π) across it.

**Checks.** An independent derivation agrees with these forms to 6·10⁻¹⁵. Ray casting of the solids agrees to 10⁻⁷, over rotated and scaled bodies of all five types.

**Kinks.** ⟨L⟩_V kinks (linear in the tilt) wherever ŵ lies in a face's plane, and along the cylinder's axis (the −4p/3π term). That is what §10.6 deals with.

### 10.3 Calibration and parameters

Every dimension is read as the isotropic size: a sphere's width gives the Scherrer D with K = 0.9 (§7.2). A solid's width along **u** is that of the sphere with the same ⟨L⟩_V:

```math
w(\mathbf u) = 0.75\,\frac{|\mathbf t|}{\langle L\rangle_{V,\text{base}}(\hat{\mathbf t})},\qquad \mathbf t = \mathbf W \circ (\mathrm{Rot}^\top \mathbf u)
```

- **W** holds the solid's parameters: the widths (°) of spheres of its diameters, edges or axes.
- **Dimensions.** D = Kλ/(W·π/180): an ellipsoid's full axes, a cylinder's diameter and height, a box's edges, each read as the isotropic size is. By the Lorentzian model that is a Scherrer reading, not a true dimension (§7.2: spheres of one size read 1.0–1.7× their diameter); by WPPM the true one (below).
- **In the profile.** The member's width enters the Lorentzian as (Y + w)/cosθ, Y being the instrument's (Kα2's w is λ2/λ1 times Kα1's, §3.8). The solid's widths are the whole size: the phase's isotropic Y_s is held at 0 during the shape fit, and while the shape is in use neither profile reads it (a Y_s set by hand changes nothing; refined, it is undetermined). The legacy ellipsoid (`ellipsoidL`, Lorentzian only) is the exception: its widths add to Y_s, and its reported sizes include it.
- **By WPPM** (§7.3), each member's line is instead the transform of the base body's common-volume function along it, at ℓ = L·|**t**|·(π/180)/(Kλ₁). The widths W then read as the solid's dimensions with no calibration: the sphere's 0.75 above does not enter.

| Solid | Base | Width parameters | Turns | Notes |
|---|---|---|---|---|
| ellipsoid | ball | Ea, Eb, Ec | 3 | three axes |
| spheroid | ball | Wa (equatorial), Wc (polar) | 2 | two axes equal |
| cylinder | cylinder | Wd (diameter), Wh (height) | 2 | |
| elliptic cylinder | cylinder | Wa, Wb (cross-section), Wh | 3 | an ellipse translated along its axis |
| box | cube | Wa, Wb, Wc | 3 | |

A body of revolution refines two turns: a turn about its own axis does nothing.

The v420 ellipsoid (`ellipsoidL`, width Y_s + |Lᵀ**u**| with S = LLᵀ, six parameters) is kept only to show projects saved with it.
- Its axes' esds came from a covariance of L that is near-singular wherever the axes lie on symmetric directions: the user's plate normal came out at ±109°.
- It could not be held on the lattice.

### 10.4 Orientation

```text
Rot = R(q₀) · exp([r]×)
```

- **q₀** is a reference orientation (a quaternion). It is held within each refinement and reset before each full refinement.
- **r** is a rotation vector refined from 0.

This chart has no gimbal lock. Its esds are small turns about the body's own axes. Since q₀ is re-set before each full refinement, r never nears its |r| = π edge. The largest step per turn component is 0.4 rad (§5.5).

### 10.5 The search

**Why it needs many starts.** A refinement started from a sphere goes nowhere. By the cubic symmetry, deforming a sphere has no first-order effect on the pattern: summed over a family, uᵀδS u is the trace alone. In a lower symmetry only the part of a deformation that the Laue group averages to has one: a tetragonal or hexagonal phase's c against its a, not its a against its b. Doubling a deformation of c against a doubles the change in the pattern of rutile and of ZnO (first order), and quadruples it for SrTiO₃ (second); one of a against b quadruples it for all three, and doubles it for a monoclinic phase. So the search runs from several starting shapes (`freeShape`).

**The starts:** 11 in total (`SHAPE_STARTS` = 10, plus one).
1. **The sphere-like start.** Every width is w₀ = Y_s,iso/κ, κ being the solid's mean width factor over 400 directions (1 for a ball, 0.896 for a cylinder, 0.837 for a cube). That start has the isotropic fit's width on average. For the ellipsoid and the spheroid it *is* the sphere, so their fit never ends above the isotropic one.
2. **Plates and needles.** For each low-index direction family (up to 5 of ⟨100⟩, ⟨110⟩, ⟨111⟩, …):
   - a plate (thin along it);
   - a needle (long along it).

   Each is tilted a few degrees (0.08 rad Gaussian noise on the axis), so that no symmetry holds the axes where they start.
3. **Random shapes and orientations** (widths w₀·e^{0.8g}, g a standard normal deviate; uniform random rotations) fill the rest. A cubic phase gets 4. The v420 ellipsoid draws its S's eigenvalues, squared widths, as y₀²·e^{1.6g}: the same spread of widths (up to v425 y₀²·e^{0.8g}, widths spread half as much).
   - The random generator has a fixed seed. The same data give the same result, whatever the phase's place in the list.

**The refinements.**
1. **Brief:** each start is refined briefly (8 iterations, one FCJ pass), with the shape and everything that was free in the isotropic fit, except the phase's Y_s (held at 0).
2. **Early rejection.** If the best brief result gains less than half of what ΔBIC < −10 needs by the cheaper route, the full refinements are not run. The cheaper route is a body held on the lattice (§10.7): its 2 or 3 turns fewer, it needs a gain over 10 + (dP − n_R)·ln N, against 10 + dP·ln N with the orientation free. The brief results already reach the converged gain within 0.2 χ²_ν on synthetic plates, needles and spheres. On isotropic samples the full refinements had been most of the time, for a shape then rejected: YAG went from 152 s to 99 s, SrTiO₃ with rutile from 35 s to 19 s.
   - Up to v425 the test took the free orientation's need. A body adds as many widths as turns and drops Y_s (dP = 2n_R − 1), so half of that need is the held need less 5 − 0.5·ln N: only 0.7 below it at N = 5251, and above it beyond N = e¹⁰ ≈ 22 000 (fine steps, synchrotron data), where a shape that the held route would keep could be rejected early. A 12 × 9 nm cylinder (N = 5251) had been rejected with "ΔBIC about +8", while its held fit gives −9.0.
   - The ΔBIC the warning gives is the held route's, (dP − n_R)·ln N − gain: the lowest the trial shapes allow.
3. **Full:** the best 3 (`SHAPE_FULL`) are refined to convergence (60 iterations).
4. **Polish:** up to 2 more refinements from the best, turned by 0.02 rad about a random axis. The refinement can stop where the axes sit on a symmetric orientation: there the first-order effects of a turn cancel over a family, the esds blow up, and the shift test passes at once.

### 10.6 Flat faces: rounded for the search, exact for the result

**The problem.** A flat face makes the column length kink wherever a direction lies in it. Every member of a family lying in a face is then a V-shaped valley of χ² in the orientation, which least squares cannot settle into. A disc on the user's SrTiO₃ stopped anywhere between χ² 6364 and 6427, depending on its start.

**Rounding during the search.** The faces of the phase being searched are rounded off over 1° of the base body's direction: each component of **t** = **W**∘(Rotᵀ**u**) becomes √(t_i² + sin²1°·|**t**|²), and the vector is scaled back to |**t**|. This applies only to that phase; another phase's kept solid stays exact meanwhile.
- **Bounded.** Rounded after the dimensions scale it, a width changes by at most 1.1 % (the base body's own change over 1°), whatever the proportions: 1.000–1.011 over 200 random cylinders, elliptic cylinders and boxes with aspects up to 100, in 2000 directions each (1.000–1.022 over 2°).
- **Why 1°.** The rounding a search can bear falls with the aspect. On a synthetic SrTiO₃ disc of 100 × 1 nm, 2° ended in another valley at each of three seeds: 1500 χ²_ν above the minimum that a refinement from the truth reaches, and twice as a rod 2.6 nm across, 2700 χ²_ν above. 4° did so on a 50:1 disc (2700 χ²_ν), and missed an 11:1 disc's minimum by 1.2 χ²_ν. 1° reached the 100:1 disc's minimum at all three seeds. On every other case tried it reached the same minimum as 2°, within 0.4 χ²_ν either way: SrTiO₃ discs of 5:1 to 50:1 (the 11:1 one at three seeds), a 10:1 square plate, a 10:1 rod and a box; rutile discs of 10:1 and 50:1 and a needle; a ZnO disc of 10:1 and a rod of 20:1; a monoclinic plate; a triclinic elliptic cylinder. It took 0.7 to 1.6 times the pattern evaluations of 2°. It is untested beyond 100:1. (The 2° had been chosen on the user's SrTiO₃ disc, with the faces rounded before the dimensions scaled them.)
- **Up to v425** each component of Rotᵀ**u** was rounded, as √(x² + sin²2°), before the dimensions scaled it. A thin body's members in its plane then took sin 2° of the large width across its thin dimension, which is not small next to their own: their widths grew with the aspect, ×1.13 at 11:1 and ×1.95 at 50:1 for a disc, ×2.17 for a square plate at 50:1, and a rod's along its axis ×3.30 at 50:1 (up to ×3.28 over the random solids above). The brief, full and polished fits, and the early rejection, read a body up to that far from the one refined after. On synthetic discs (seed 1) the search had ended 2.7 χ²_ν (SrTiO₃ 11:1 on [110]), 19.7 χ²_ν (50:1) and 10.4 χ²_ν (100:1) above the minimum that a refinement from the truth reaches, and 0.24 and 0.62 χ²_ν for rutile discs of 10:1 and 50:1; rounded after, over 1°, 0.02, 0.02, 0.00, 0.02 and 0.00 χ²_ν. The other cases run with both reached the same minima; a ZnO disc came out held on [001] either way. The pattern evaluations went from 60 % fewer to 29 % more.

**Then the exact solid.** Rounding is not the solid: near a face it changes a width by up to 1.1 %. So the best shape is refined again with the exact solid, and every number reported for a shape that reached the full refinements is the exact solid's. An ellipsoid's or a spheroid's ball has no faces and is never rounded, so it is not refined again. An early rejection's approximate ΔBIC (§10.5) comes from the rounded trial shapes.

### 10.7 Held on the lattice

A crystallite's faces are lattice planes more often than not, and a held axis is two or three parameters fewer. So each solid is also refined with its axes held exactly on lattice directions (`snaps`).

**Choosing the frame.**
1. **The first axis** is chosen among the axes lying within 10° of a lattice direction: the one whose width (∝ 1/dimension) stands farthest from the other two (a plate's normal). For a body of revolution it is its own axis. It is snapped to its simplest lattice direction within 10°. Choosing merely the axis nearest a lattice direction had held a plate's whole frame on an in-plane axis 0.5° from [1-13].
2. **The second axis.** For a body with three axes, the second axis goes, in turn, on each of up to 3 of the simplest lattice directions (indices ≤ 3) lying within 0.01° of normal to the first. Each placement is a candidate frame, and the third axis completes it, right-handed. A body of revolution holds its axis alone.

**Refinement.** Each candidate frame is refined with its orientation fully held.

**The free fit refined again.** The free orientation includes the held one, so at its minimum its χ² is at most the held fit's. When the best held fit comes out below the free fit, the free search ended in a worse valley, and the free fit is refined again from the held frame, turned 0.02 rad as in the polish (§10.5): from the frame itself, on lattice directions, the refinement stops at once. It replaces the free fit when lower. On a synthetic 16 × 12 × 2.4 nm plate the free fit refined from the held frame itself stayed on it, 0.2 χ²_ν above the one refined from it turned. Without the refit, the free fit's angles and sizes (below) would measure a worse fit: on the user's 33A, with the faces rounded after the dimensions over 2°, a box's free fit, its edges 45° off in its plate, had ended 35 χ²_ν above the held one, whose edges then took ±44° esds and lost their directions (with the v425 rounding, 1.9 χ²_ν above and 4.7° off, which set the edges' esds to ±4.7°, ±0.7° and ±4.6°). Refined again, it ended 0.2 χ²_ν below the held fit and 0.2° from it, and the edges' esds were their profiles', ±4.2° and ±0.6°. With the 1° rounding the free fit ends within 0.5° of the held one, the esds ±4.6° and ±0.6°.

**Keeping it.** The held frame is kept when its ΔBIC is lower and the free fit is not better than χ² allows by chance at 95 %: Δχ²/χ²_ν ≤ 5.99 for two turns, 7.81 for three. With ΔBIC alone, three turns' discount (25) had held boxes whose true faces were 8° off ⟨111⟩, and frames 10° off the truth were held with sizes 5–11 esd off.

**What a held result reports:**
- the free fit's angle from each held axis;
- the free fit's differences in the esds of the angles (at least that angle) and of the sizes (in quadrature).

The free fit is about as likely, and the held refinement's own covariance lacks the orientation.

### 10.8 Kept or not: ΔBIC against the isotropic size

```math
\Delta\mathrm{BIC} = \frac{\chi^2_{\text{shape}} - \chi^2_{\text{iso}}}{\max(1,\chi^2_{\nu,\text{iso}})} + (P_{\text{shape}} - P_{\text{iso}})\ln N
```

- The χ² here are totals.
- **Kept** only at ΔBIC < −10; otherwise the isotropic size is kept, with a warning that gives the ΔBIC.
- **Why a threshold.** Five more parameters always lower χ² a little. Without the ΔBIC < −10 rule, the shape was kept on an isotropic synthetic sample in 7 of 12 noise draws, with ΔBIC near +40. With it, none of 22 synthetic spheres kept one.
- **Why the χ²_ν division.** χ² is divided by the isotropic fit's χ²_ν so that a misfit of the model is not taken for evidence.

**Comparing solids.** The ΔBIC of each solid against the same isotropic fit also compares the solids:

| \|ΔBIC\| between solids | Reading |
|---|---|
| under 10 | no preference |
| 10–30 | weak: within what the search itself varies on real data |
| over 30 | telling |

The sizes depend on the solid chosen. A spheroid's polar axis reads 4/3 of a disc's thickness, because ⟨L⟩_V along the axis is 3c/4 for the spheroid and h for the cylinder.

### 10.9 Sizes, groups and kinds (`shapeOf`, `bodyShapeOf`)

**Each dimension.**
- D = Kλ/(W·π/180), with esd D·σ_W/W.
- **Unbounded.** A width on its bound 0 means no broadening along that dimension, so D is unbounded. It is reported as a lower limit, "over Dof(2σ_W) nm" when that is at least 1 nm, or "unbounded".

**Do two dimensions differ?** Two dimensions are told apart when their widths differ by more than 2σ, with σ from the full covariance: σ² = C_aa + C_bb − 2C_ab. The v420 ellipsoid's widths along its principal axes likewise, from the covariance of L: σ² = (g_a − g_b)ᵀ C_L (g_a − g_b), g the widths' gradients. Its near-equal axes are anticorrelated (ρ ≈ −0.9 on synthetic plates), and up to v425 it left the covariance out: z came out about 1.4× too large, and pairs within 2σ went ungrouped.
- **The bound rule.** When one of the two widths is on its bound 0, that width has no curvature there and its linear esd means nothing (±14606° for a spheroid's unbounded equator in a test fit of 37D). The other width's own esd then decides. Before this rule, that plate, 2.5 nm thick, was called a near-sphere with no axis.

**Groups.** Two dimensions that the solid can swap, and that are not told apart, are reported by their mean, with its esd from their covariance. Each alone is not measured. Such pairs are:
- an ellipsoid's axes;
- a box's edges;
- an elliptic cylinder's cross-section.

Why: swapping them has no first-order effect, so their widths are anticorrelated (−1.0000). A box 12 × 12 × 4 nm read 13 ± 107 and 13 ± 106 nm, where its mean is 12.80(42).
- **Order of grouping.** The closest pair is grouped first, and the third dimension is compared with the pair's mean, not with each. Against each alone, the pair's huge esds had grouped a 4 nm edge with them.

**Kinds.**

| Solids | Kind | Rule |
|---|---|---|
| ellipsoid, box, elliptic cylinder | plate | one dimension under half the other two |
| | needle | one over twice the other two |
| | triaxial | each under half the next |
| | isometric or equant | within 20 % |
| | anisotropic | none of these (e.g. 5 × 7 × 10 nm) |
| spheroid | oblate, prolate, near-sphere | |
| cylinder | disc, rod, equant | |

### 10.10 Directions

**Naming an axis** (`lattDirection`). Each resolved axis is given with:
- the simplest lattice direction within 10° (indices up to 4, in the conventional cell), its angle from it, and its angular esd;
- or, when none is within 10°, the nearest.

Without the 10° snap, noise was named ⟨433⟩, ⟨332⟩ or ⟨443⟩ for an axis 2–9° from [111]. A held axis is named by the direction it is held on: a cylinder held on [301] had read "held 8.1° off [201]".

**One frame.** All the axes' labels are given in one frame (`framedAxes`):
- the Laue operation that takes a reference axis to its family's first member is applied to all of them;
- each axis is labelled by its own [uvw].

A plate's [110] normal and its [1-10] width then read apart, though both are ⟨110⟩.

**No direction.** An axis has no direction when:
- its angular esd is over 30°;
- or it belongs to a group;
- or a spheroid's or cylinder's two dimensions are within 2σ (a sphere has no axis).

A box's edges always keep theirs: a turned square is another solid, and whether the data fix them is the angular esd's to say.

**Across a body of revolution** (a spheroid or a cylinder, and an ellipsoid or an elliptic cylinder whose other two dimensions are not told apart), two lattice directions (indices ≤ 3) within 5° of normal to its axis's lattice direction are given: the simplest, and the simplest that is also within 5° of normal to it. On a [111] axis these are [1-10] and [11-2]. The lattice direction is used, not the axis itself, because [1-10] of a disc 7° off [110] fell outside the 5°.

### 10.11 Angular esds by profile (`turnEsds`)

**Why not the covariance.** Linear esds from (JᵀWJ)⁻¹ gave 30° to 10⁹° for axes the data fix within a few degrees. On symmetric directions a turn has no first-order effect (the members' changes cancel over a family), and flat faces make χ² kink.

**The profile.**
1. The solid is turned about each of its axes (two for a body of revolution), in both senses, by 1, 2, 4, 8, 16, 32 and 60°.
2. At each trial, every parameter free in the fit is refined again (4 iterations), the turn itself apart:
   - the sizes;
   - the strain, its Stephens terms, a size distribution's σ, the fault probability, the ADPs;
   - the cell, the scale and background, the texture;
   - the turns about the other axes.
3. The esd is the turn that raises χ² by χ²_ν. √Δχ² is interpolated linearly between the last two trials (from 0 before the first): exact where χ² is a parabola in the turn, on the safe side where it rises as |θ|.
4. The two senses are averaged. An axis's esd combines the turns that tilt it: √((σ_j² + σ_k²)/2).

**The threshold, χ²_ν with no floor,** is the linear esds' own convention (§5.7). Where χ² is quadratic in the parameters, χ² = χ²_min + δᵀ(JᵀWJ)δ, the profile in one of them with the others refined again is Δχ² = δ_j²/[(JᵀWJ)⁻¹]_jj. At the linear esd, δ_j² = χ²_ν·[(JᵀWJ)⁻¹]_jj, it is χ²_ν exactly. So a profile esd and a linear esd agree wherever the linear one holds. Checked on the cell's a of synthetic SrTiO₃ and rutile patterns, whose profile is a parabola: the profile esd is 0.997–1.002 of the linear one at χ²_ν from 0.81 to 1.34, wherever the true σ falls between the trial turns. Up to v425 the threshold was max(1, χ²_ν): at χ²_ν 0.81–0.82 that floor alone made the angular esds 1.10–1.11× the linear convention, and v425's Δχ² interpolation (below), which made them small, brought them to 1.04–1.08×.

**What each choice was checked against:**

| Choice | Alternative | What the alternative gave |
|---|---|---|
| sizes refined again | sizes held | a turn was too dear: ±0.26° on a synthetic disc whose axis was really fixed to about 2° (the truth 15 σ away) |
| interpolate between the last two trials | from the first trial over alone | a broad valley read as the narrow notch at a lattice orientation: esds 1.7× too small |
| √Δχ² interpolated | Δχ² interpolated (to v425) | χ² is convex, so its chord crosses the threshold early: 0.943–1.000 of σ on a parabola, down to 0.940 of the linear esd of a cell parameter, and 2.5–8 % small on three synthetic 20 × 4 nm discs |
| every free parameter refined again | the sizes, X_s, scales, background and texture (to v425) | with the Stephens terms held, the tilt esds of three synthetic 20 × 4 nm SrTiO₃ discs were 4–29 % smaller (1.128°, 3.30° and 3.86° against 1.175°, 3.44° and 5.44°; with the Δχ² interpolation too, 1.100°, 3.10° and 3.76°), and a rutile disc's with S₁–S₃ 21 % (0.516° against 0.656°). The cell, the displacement and the rest changed them by 0.2 % at most. 4 iterations per trial suffice: 15 gave 5.437° against 5.436° |
| other turns refined again | other turns held | the valley runs obliquely between them; axes lay 1.6× further from the truth than their esds said |

**Coverage.** With the v425 rules (the threshold max(1, χ²_ν), Δχ² interpolated, the sizes, X_s, scales, background, texture and other turns refined again), over 28 axes of free fits of synthetic solids, the axes lay 1.15× their esds from the truth: mean (error/esd)² 2.65, against 2 for a tilt in two directions. The rest is a second valley of χ² nearly as deep, which a profile from the minimum does not see: 2 of 7 free fits of synthetic boxes ended 3–4 esd off. The tooltip says so. At χ²_ν ≥ 1 the v426 rules can only make the esds of a fit larger: √ is concave, so √Δχ² interpolated crosses the threshold at a larger turn than Δχ² interpolated, and more parameters refined again leave no higher a χ² at each turn. On the three discs above they were 7–45 % larger; the 28-axis test was not repeated.

**Cost and display.** A profile takes about 1.5–15 s; the status says it is running. Every free parameter refined again costs 1.3–2.3 times the pattern evaluations of the v425 set (9 fits of synthetic solids), when it took 1–7 s. Esds beyond 60° are not computed. An axis whose esd is over 30°, or has none, gets no direction: the card gives its size alone ("the data do not fix its direction within 30°"), and the 3D view does not draw it. The view's dashed "not determined" line (an esd over 60°, or none) is reached only by the v420 ellipsoid's directions, whose esds are linear; the directions across a body of revolution are dashed too, as "free about the axis" (§10.12).

### 10.12 The 3D view (`xrd-shape3d.js`)

The solid is drawn under the results by a small software renderer on a 2D canvas: no WebGL, no library.

**What it shows.**
- The solid in its true proportions, in the phase's colour.
- Up to three crystal directions as arrows. Each of the solid's axes has its uncertainty as a cone of half-angle its angular esd, about the axis itself: the arrow is the simplest lattice direction near it, and where it lies off the axis its label gives that angle with the esd ("axis 6.7° off, ±0.6°"). Up to v425 the cone was drawn about the arrow, so an axis 9.7° from [111] with an esd of 4.3° lay outside its own cone. The directions across a body of revolution are dashed, with no cone: its turn about the axis is free ("free about the axis").
- The angular esds read as on the card: one significant figure under 0.095°, one decimal to 9.95°, whole degrees past it.
- The cell's a, b, c as a small triad in the top-right corner, turning with the solid. The triad is expressed in the same Laue setting as the direction labels; taken straight from the file, its c had pointed against the solid's "[001]".
- A scale bar.

**How it draws.**
- **Projection.** Orthographic, from a home view (38° azimuth, 24° elevation). The azimuth is adjusted so the directions' screen lines stay apart.
- **The solid.**
  - Meshed in quads: an ellipsoid 40 × 28; a cylinder with 56 sectors and caps; a box with its six faces.
  - Shaded by Lambert levels.
  - Drawn at 66 % opacity over what it hides, with its creases and silhouette.
- **Open extents.** A dimension that is unbounded, or over 20× the smallest other one, is drawn 4× the largest closed one and fades out towards its end.
- **Lines and cones** are split exactly where they pass under the surface (bisection on the ray–solid test), so a line goes under the solid at the surface itself.
- **Labels** avoid the lines, the arrowheads, the scale bar, the triad and each other. They keep their side as the solid turns.
- **Interaction.** Drag, touch and the arrow keys turn it; double-click, double tap and Home reset it. The turn is kept when the results are redrawn.
- **Theme.** It follows the app's theme.

**PNG download.** It always has a transparent background, in the light theme's colours, whatever the app's theme.

## 11. Weight fractions, cell volume, displacement

**Weight fractions** (Hill & Howard 1987, `weightFractions`):

```math
W_p = \frac{S_p\,(ZMV)_p}{\sum_q S_q\,(ZMV)_q}
```

- **ZM** is the cell's mass: the occupancy-weighted sum of the atomic masses of the filled cell, in g/mol.
- **V** is the refined cell's volume in the file's own basis, the cell whose atoms give ZM and F².
- **Esds.** They come from the scales' covariance, through ∂W_i/∂S_j = (δ_ij k_i − W_i k_j)/T, with k = ZMV and T = Σ S k. They do not include the cells' uncertainties.
- **When shown.** Only when more than one phase is detected. They are fractions of the crystalline phases: no amorphous content, no microabsorption correction (Brindley).

**Cell volume.**
- V is computed from the refined lattice parameters.
- Its esd is propagated numerically through their covariance (`propagate`, worker).
- For a primitive file of a centred lattice, V is the conventional cell's, labelled so: the one its a and c belong to, and the one tables quote.

**Displacement.** It is reported in mm, s = −disp·(π/180)·R/2, with R the goniometer radius from the file. Its esd is linear.

## 12. Peak widths and the tests that use them

After a sample's refinement, `measureWidths` (`xrd-widths.js`) fits every reflection of each detected phase alone. Three tests then read what the widths themselves say, before any model of the shape.

### 12.1 Isolating a peak

**Grouping.** Reflections closer than 0.2 FWHM are one peak, e.g. the (300) and (221) of a cubic cell, which share one d. A group's indices are listed in one order, h, then k, then l descending ("411/330"): in 2θ order, reflections of one d swapped with the refined cell's last digits (330/411 in 20 of 200 refined states of SrTiO₃), and rows are matched across files by their label.

**The window.** It is ±max(2.5·H, 0.4°, 7.5 steps) around the model's position, H being the model's FWHM (the tick's), which also sets the grouping above, the overlap region and the fit's bounds: the pseudo-Voigt's, or a WPPM line's measured on the line as synthesised, without the axial divergence's shifts (a solid's drawn in groups, on their sum). For an isotropic WPPM line the single sphere's 1.23·Y_s had been taken, 1.6× a log-normal line's FWHM at σ = 0.94 and 2.2× at 1.2 (its breadth stays with the mean while its top sharpens); for a solid, its members' mean width, 0.8–65× the line's (the measured H is within 0.2 % of the drawn line's FWHM in both). The 7.5 steps give the fit's six parameters 15 points: at ±0.4° alone, scans coarser than 0.055° left no peak 0.05° wide to read (synthetic SrTiO₃ with Y_s 0.05°: 3 rows of 19 at a step of 0.06°, none at 0.08–0.1°; none of rutile's at 0.1° or ZnO's at 0.08°). Now every row is read, and over 20 Poisson draws at steps of 0.06–0.1° (SrTiO₃, rutile, ZnO) the rows' z against the model's own widths have mean +0.13 to +0.25 and sd 0.92–1.06, the WH χ²_ν averages 0.88–1.12, and size and strain come out within 0.3 esd of the truth.

**The data fitted:** the pattern, less everything else the *isotropic* refinement puts there:
- the other reflections of every phase;
- the refined background.

Two choices behind this:
- **The isotropic fit, even when a shape was kept.** A test of the shape must not read the data through the shape. The (200) of the user's SrTiO₃ measured 1.08° or 0.83° depending on which model's neighbouring tails were taken away.
- **The refined background, removed exactly.** A straight line over ±2.5 FWHM left the curved background in, and read a broad (310) 3 % narrow. The fit's own straight line only corrects what is left.

### 12.2 Fitting it (`fitPeak`)

**The model.** One pseudo-Voigt per line (Kα1, and Kα2 at the file's ratio), with the instrument's asymmetry, on a straight background.

**The free parameters** are the sample's own Lorentzian width h_L and Gaussian width h_G:
- the instrument's are added as the refinement adds them: H_L = h_L + H_L,inst, H_G = √(h_G² + H_G,inst²);
- TCH then combines them.

So the corrected FWHM is the sample's, a sample no broader than the instrument comes out about zero, and no pseudo-Voigt has to be inverted. A first version fitted a pseudo-Voigt and inverted it:
- its esds were 2–3× too large wherever η sat at 1;
- it biased near-instrument widths upwards.

**Not bounded at 0.** The sample's h_L and u = h_G² may go below 0, as far as the whole peak's widths do not (u + H_G,inst² ≥ 0, h_L + H_L,inst ≥ 0): the instrument's widths are a measurement too. Bounded at 0 (to v425), noise could only push them up, and a purely Lorentzian sample, the engine's own model, read 1–7 % wide (z +0.3 to +0.6, single peaks of 0.03–1° on the standard's profile) with esds 1.2–1.5× too large. The corrected FWHM of widths below 0 reflects the rise they give (for u < 0, 2h_L − TCH(√−u, h_L)): continuous and monotonic, so noise about 0 averages out. A peak sharper at the top and longer in the tails than a Lorentzian (the whole peak's Gaussian at 0, as a wide distribution of sizes gives) is read at that bound, as before.

**The sample's Gaussian part, as far as the data ask for it.** Two fits are made: with the sample's broadening Lorentzian (u = 0, as the engine models it) and with its Gaussian part free. The corrected FWHM is their mean by their Akaike weights (u is one parameter more, χ² read in units of χ²_ν), its variance with the spread between the two added (Burnham & Anderson's model averaging). Why not always both widths: the corrected FWHM bends as √u wherever |u| passes about h_L²/5, so where a sample has no Gaussian part its esds, read at the fit, missed its spread (z sd 1.2–1.4 on single peaks 0.03–0.05° wide, the instrument's 0.038°; on synthetic SrTiO₃ 0.02° wider than the instrument the Williamson–Hall test called 7 of 30 isotropic patterns anisotropic). Why not always Lorentzian: a Gaussian part would be read as a Lorentzian one (a purely Gaussian sample 0.1° wide read 49 % narrow, z −11; one with h_L 0.1° and h_G 0.2°, 24 % narrow). The models' curves (the predictions, §12.4) are read with the data's weight.

**Measured** (200 Poisson draws per case on the standard's profile; z against the truth): purely Lorentzian samples 0.03–1° wide, z mean −0.02 to +0.12 (v425 +0.31 to +0.63), sd 0.74–0.95, esds 1.0–1.2× the scatter (v425 1.15–1.53; on the safe side: the spread between the two fits), and on weak peaks (500 counts) +0.21 (v425 +0.55); purely Gaussian ones 0.03–0.3° wide, z mean −0.08 to +0.14, sd 0.98–1.07 (on weak peaks or at a step of 0.05°, sd 1.15–1.18; v425 0.71–0.94); no broadening at all, z mean +0.02 to +0.04, sd 0.76–0.99, and 95–96 % read as not broadened.

**Where the data cannot tell the shape**, a Gaussian sample part under about half the instrument's width reads low, the Lorentzian fit taking most of the weight: h_G 0.01° at 40° (the instrument's 0.038°) reads 39 % narrow, z −0.75, sd 1.22 (v425: 18 %, z −0.16, sd 0.62); 0.02° on a weak peak, or at 130°, 38–54 % (z −0.77 to −0.88). 30–77 % of such draws are flagged not broadened, and their upper limit then covers the truth (§12.3).

**Solving.**
- **Nelder–Mead** on (centre, h_L, h_G), with the amplitude and the line solved exactly at each point.
- **The peak stays itself:**
  - its centre within half its expected width of the model's position;
  - its total width within a factor 4.
- **Esds.** From the Jacobian at the optimum, in (centre, h_L, u = h_G²) with the amplitude and the line, scaled by the fit's χ²_ν. They are propagated to the corrected FWHM by secants over ± one esd of h_L and of u: the derivative with respect to u at u = 0 would be infinite.
- **Kα2.** Its line has the sample's widths times tanθ₂/tanθ₁ (squared for u), as any broadening of d* gives (Δ2θ = Δd*·2d·tanθ, size and strain alike), and the Lorentz–polarisation factor at its own θ beside the file's ratio, as the engine draws it. With Kα1's widths and the ratio alone (to v425), the model's own peaks read 0.26 % wide at 127° and 0.7 % at 146° (synthetic SrTiO₃, X_s 0.15°, Y_s 0.25°, noise-free); now within 0.2 % at every angle (SrTiO₃, rutile, ZnO, samples wider than the instrument, to 146°). A sample as narrow as the instrument (ZnO, X_s = Y_s = 0.05°) reads within 0.4 % (v425: 0.8 %): the shape places the Kα2 from the fitted centre, the zero and displacement in it, where the engine adds them to each line (within 0.12 % without them). Most of the v425 drift was the intensity: with the tangents' ratio but the file's ratio alone, 0.4 % at 127° and 1 % at 146°.

### 12.3 Flags

Rows are flagged, listed, and not used by the tests when the peak is:

| Flag | Rule |
|---|---|
| not read | fewer than 15 points in its window (masked, or past the pattern's end), or no fit within its expected position and width: the row is kept, with the reason and no widths |
| overlapped | the other reflections together (of every phase, as the isotropic model draws them) hold more than 30 % of its own calculated intensity across its top (±H/2) |
| at an edge | its top half (±1.2 FWHM) is not all inside the pattern |
| weak | its amplitude is under 3 esd |
| not broadened | the whole width less the instrument's is under 2 of its esds; the corrected FWHM is then given as an upper limit ("< 0.012"): the widest sample, Lorentzian, Gaussian or any mix, whose whole peak is at most 2 esd wider than found (2 esd above the instrument's when it came out below), the whole width and its esd taken from the fit with the Gaussian part |

**Not broadened, by the whole width.** Where both of the sample's widths are about 0 the corrected FWHM goes as ±√|u|, and its linear esd is half its spread (with the Gaussian part free, a peak no broader than the instrument's read more than 3 esd from 0 in 15 % of draws): the whole width, smooth there, says whether the peak is broadened, and the upper limit says by how much at most. The data tell such a broadening's shape no better than its size, and a Gaussian adds to the instrument's in quadrature, so the limit is the Gaussian sample's, about four times the Lorentzian one's (at 40°, a whole width 5 % over the instrument's is a Gaussian sample 0.0096° wide, or a Lorentzian 0.0024°). Over 200 draws each of samples 0–0.02° wide (Lorentzian or Gaussian, 500–5000 counts, 40–130°), the limit lies under the truth in 0–6 draws, as a 2-esd bound should. Read along the covariance of h_L and u, it had lain under a Gaussian sample 0.01° wide in 59 of 200 draws, and under one 0.02° wide on a weak peak in 69.

**Relative intensity.** It is given only for peaks not cut by the pattern's end: a (212) cut at 80° had read 115 %.

### 12.4 The tests

**Williamson–Hall** (`williamsonHall`). H·cosθ against 4·sinθ, with H the corrected FWHM in radians, fitted by a weighted straight line. It is the FWHM, not the integral breadth β (§1.4): the size is read from the intercept with K = 0.9, Scherrer's constant for the FWHM, so D and ε are consistent with it (taken as integral breadths, the same numbers would read 1.06–1.57 times off). The card's plot starts at 4·sinθ = 0, where the line meets the axis at Kλ/D, and goes below 0 when an error bar or the line does (a negative intercept gives no size).
- **Reading the line.** An isotropic size gives a constant Kλ/D, a microstrain a slope ε. The points then lie on one line.
- **The test.** Its χ² and the probability of so large a χ² were the broadening isotropic (the regularized incomplete gamma).
- **On the card.** p < 10⁻³ reads "the broadening is anisotropic (the crystallites' shape, or faults)", and the line's D and ε are then marked as averages only.
- **Scherrer readings.** The table's sizes and the line's D apply K = 0.9 to the corrected FWHM. For a Lorentzian phase they read as the refined size does; a WPPM phase's sizes are true dimensions, which these readings put lower for spheres of one size (0.85–0.88×) and otherwise as σ has it (§7.2). For an isotropic WPPM phase the card therefore also gives the line through the model's own widths, read the same way, beside the refined size. It reads as the data's line does: 8.67 against 8.67 nm for spheres of 10 nm, 11.57 against 11.57 nm for D_V = 10 nm at σ = 0.94 (11.50 against 11.43(20) with Poisson noise).
- **Checks.** On synthetic isotropic patterns (SrTiO₃ with Y_s 0.02–0.15° and X_s 0–0.1°, weak or strong, at steps of 0.02–0.05°; rutile, ZnO, fcc Pt; 30 Poisson draws each, the refined state the truth) the rows' z against the model's own widths have mean −0.01 to +0.16 and sd 0.81–1.03, the WH χ²_ν averages 0.70–1.04 (none or one pattern in 30 called anisotropic), and size and strain come out within 0.65 esd of the truth on average (v425: z mean +0.17 to +0.59, the strain up to 0.78 esd high). On a monoclinic and a triclinic cell (10 draws, 212–235 peaks each, to 90° and 80°) the z mean is 0.00 and +0.05 and the size within 0.4 esd (v425: +0.20 and +0.30, the size 0.64 and 1.00 esd low, with 7–16 peaks a pattern dropped unread). A Gaussian width constant in 2θ is no size and no strain: its points bend off the line, and with the narrower esds the test says so in 8 patterns of 30 (v425: 0).

**Orders** (`orderTests`). For a direction measured at two orders, (h k l) and (nh nk nl) with n = 2, 3 or 4:

```math
R = \Delta d^*(n\mathbf h)/\Delta d^*(\mathbf h),\qquad \Delta d^* = H\cos\theta/\lambda
```

| R | Verdict |
|---|---|
| ≈ 1 | size |
| ≈ n | strain |
| between, outside 2σ of both | size and strain |
| < 1 − 2σ | "below 1: the higher order sharper (planar faults)": faults broaden by **h**·**R** modulo 1 (§7.6), which can leave a higher order sharp |
| > n + 2σ | more than strain |

**Prediction.** The same measurement is made on each model's own noise-free curve, with the data's weights:
- the isotropic refinement's;
- the free shape's, where one was kept (a sum of members with different widths, fitted as one pseudo-Voigt pair).

The score is the mean of ((W_measured − W_model)/σ)² over the rows used: about 1 when a model predicts the widths it was not told.

**Evidence.**
- On a synthetic plate, the true shape predicts its widths at 0.8, against 108 for the isotropic size.
- On the user's 33A:
  - WH χ²_ν 43, p 6·10⁻⁴⁵ (v425: 57, p 2·10⁻⁴⁸);
  - (110)→(220) gives 1.11(4): size and strain (outside 2σ of 1; up to v425 this line said "a size", which the code's 2σ rule did not give);
  - the isotropic size predicts the widths at 48 (v425: 57.6);
  - with the (100) texture, the five solids predict them at 2.5–4.1, against 46.7 for the isotropic size (v425: 3.1–5.5 against 55.9).

## 13. The worker, the card and the exports

### 13.1 The worker

The card runs each refinement in a module worker. It sends:
- the pattern;
- the instrument;
- the phases (cell, constraint, operations, atoms, mass, and their options: shape, texture, size profile, strain, faults, displacements);
- the options (standard or not, the irf).

The worker posts progress and then the result:
- the parameters, esds, statistics and stages;
- `atBound`, `undetermined` and whether the last refinement converged;
- the textures and the models each phase was refined with;
- the formatted result lines and warnings;
- the CSV rows;
- the peak widths and tests;
- the solids for the 3D view;
- the standard's profile as it was used (none when it did not apply, §7.1).

An exception gives an error message. A failure of the peak widths only adds a warning.

**Jobs.** They are serial. **Cancel** terminates the worker; the next job builds a new one.

### 13.2 The card

**Refine all** refines the standard first: the samples take their instrumental profile from it. An error stops the remaining patterns. A pattern's result is kept by file name, so moving, leaving out or reloading files never puts it on another pattern.

**Options.** Each phase's options sit on its row as pickers, marked when not at their default: crystallite shape, texture, size profile, microstrain, planar faults, displacement parameters. They are read when a run starts (every pattern of a *Refine all* gets the phases as they were when it started) and apply to the next refinements; results already there keep theirs.

**The plot.**
- **Curves.** It shows observed, calculated, background, difference, and a row of ticks per phase. The curves are recomputed from the refined parameters (milliseconds) rather than stored: with the phases the result was refined with (a phase added since is not drawn in it; removing one of its phases removes the result), and with the models it used, whatever the pickers say now.
- **Ticks.** Before a refinement they come from the CIF's cell; after it, from the refined cell, zero and displacement.
- **A scan recorded downwards** (start above end) is turned round when the file is loaded, and when a project saved by an earlier version is restored, so the plots, ranges and ticks take 2θ ascending (§2.1).
- **The instrument line** gives the file's Kα₁, and its Kα₂ with the ratio only when there is one (a Kα₁-only beam reads λ₂ = λ₁, ratio 0).

**Results.**
- R_wp, R_exp and χ²;
- one group per phase (or *Instrument* for the standard);
- the warnings, among them what the numbers rest on: a refinement stopped at its iteration limit, the parameters on a bound (to be read as limits), the parameters the data do not determine (no esd);
- a note when the widths are not corrected for the instrument (no standard refined, or refined after this pattern), or, on the standard, that the samples take its profile;
- a warning when the standard's refinement this sample was refined with is no longer there (refined again, cleared, or another standard chosen): its numbers rest on an earlier instrument (§7.1).

A phase not detected shows only "not detected". Quoting held values would read as a result.

**State.** The phases (with their CIF text and options) and the results are saved in the undo history and in project files. A project saved with the v420 free-shape button opens with the ellipsoid; one saved with the v419–v423 *ΔB per phase* button, with *one ΔB* on every phase. Each result records the cell each phase was refined in; a result whose phase is now refined in another cell (a supercell or an orthohexagonal cell, refined as given up to v425, §2.4) keeps its numbers but is not drawn.

### 13.3 Exports

| File | Content |
|---|---|
| `rietveld_pattern.csv` | per pattern: 2θ, observed, calculated, background, difference |
| `rietveld_results.csv` | `Pattern, Phase, Quantity, Value, Esd, Rwp, Rexp, chi2`: every reported quantity, under a fixed name |
| `rietveld_peaks.csv` | per peak: hkl, 2θ, relative intensity, FWHM and corrected FWHM with esds, η, size, Δd\*, the models' predicted widths, whether the tests use it and why not (a peak not read keeps its row, with the reason; for one not broadened the corrected FWHM is its upper limit, with no esd) |

The fixed names in `rietveld_results.csv` include:
- `a`, `V_A3`, `V_conventional_A3`;
- `crystallite_size_nm`, `microstrain`, `weight_fraction_pct`, `delta_B_A2`, `texture_r_1_0_0`;
- by WPPM, `sphere_diameter_nm`; with a log-normal distribution, `size_volume_mean_nm`, `size_median_nm`, `size_number_mean_nm`, `size_lognormal_sigma`;
- with the anisotropic strain, `microstrain` is the rms over directions, with `microstrain_eps0`, `stephens_anisotropy_rms_1e-6`, `microstrain_1_0_0` (one per low-index plane) and `stephens_S1_1e-6`… (the conventional cell's, §7.5);
- with faults, `fault_probability_1_1_1` (the planes' indices);
- per site, `B_A2_<site>`, or the free `U11_A2_<site>`… and `Beq_A2_<site>`;
- `shape_…_nm`, `shape_…_deg_off`, `shape_dBIC`, `shape_held_on_lattice`;
- `WH_chi2nu`, `WH_size_nm`, `WH_strain`, `order_ratio_110_220` (the indices run together, e.g. `order_ratio_1-10_2-20`); for an isotropic WPPM phase, `WH_size_model_nm`, the line through the model's own widths read as `WH_size_nm` is (§12.4).
- `standard_changed_since` = 1 for a sample refined with an earlier refinement of the standard (§7.1).

Without a standard, `rietveld_peaks.csv` notes on every row that the corrected columns are not corrected.

### 13.4 Cost

| Pattern and options | Time |
|---|---|
| An isotropic SrTiO₃ pattern | about 1 s |
| With a free solid | 14–45 s per solid, plus 1–7 s for its angular esds |
| WPPM (synthetic SrTiO₃, 5251 points): one sphere / a log-normal distribution / a free cylinder | about 3 s / 8–16 s / 35–50 s |
| WPPM, a free cylinder with log-normal sizes (the user's 33A) | about 5 min |
| The user's 33A with the log-normal sizes, the anisotropic strain, {100} faults and B per site | 26 s |
| A large sharp monoclinic cell | 34 s with the asymmetry, 12.5 s without |
| The peak widths after a sample's refinement (§12: two fits a peak) | about 4 s for SrTiO₃'s 19 peaks, 25 s for a monoclinic cell's 235 (v425, one fit: 3 s and 20 s) |

## 14. Validation

The engine suites (`t-unit`, `t-lab6`, `t-sto`, `t-sharp`, `t-synth`, `t-synth2`, `t-diag`) and the card's end-to-end tests are run before every version. They are kept outside the repository, with the user's data. The evidence quoted in this document comes from them and from the user's patterns.

**Profile and instrument**
- LaB₆ SRM 660c with FCJ: R_wp 7.62 %, χ² 4.62, (S+H)/L = 0.0583(1).
  - Refined as a sample, it reproduces its certified cell to 1.5·10⁻⁵ Å.
  - A ray-tracing Monte Carlo of the geometry confirms the FCJ weight, centroid and shape on both sides of 90°.
  - On synthetic standards, the refined asymmetry is unbiased, with the right esd.
- `addPeakFCJ` matches the direct node sum to 0.0004–0.006 % of the peak.

**Phases**
- Rutile beside 7 nm SrTiO₃ (`t-detect`, 8 seeds each): found 6 times in 8 at 1 wt %, every time from 2 wt % up, its fraction within 0.2 wt %. Synthetic rutile at 2–5 wt % and 10–60 nm, which up to v424 was left out at 15–36 esd, is found with W 1.8–5.1 % (§6.4).
- A sharp second perovskite (a = 4.00 Å) at 5 wt % beside 8 nm SrTiO₃: found in 24 runs of 24 (15 up to v425), at 4.5–5.4 wt % (§6.3). Two size populations of one SrTiO₃, the sharp one at 5 wt %: both kept in 8 runs of 8 (1 up to v425, §6.4).
- Absent LaB₆, NaCl, rutile, anatase and ZnO are left out instead of taking 5–74 wt %; so are NaCl and quartz beside a SrTiO₃ with an unmodelled amorphous hump, which up to v424 took 46–48 wt % (§6.4). Over 84 synthetic runs with an absent candidate (seven structures, with and without a hump), none is kept.

**Shapes**
- The column lengths agree with an independent derivation to 6·10⁻¹⁵, and with ray casting to 10⁻⁷.
- **Synthetic recovery:**
  - needles ∥ [001] and plates ⟂ [111] come back as such;
  - thicknesses: 3.0(1) nm for 3 nm and 10.0(2) for 10;
  - a needle's cross-section: 5.0(1) for 5.
- None of 22 synthetic spheres keeps a shape.
- **Angular esds:** over 28 axes the errors are 1.15× the esds (1.6× with the other turns held); 2 of 7 boxes ended in a second valley 3–4 esd off.

**The user's 33A_STO_WCL (SrTiO₃, flower-like petals)**

| Model | Result | ΔBIC vs isotropic |
|---|---|---|
| isotropic | R_wp 9.13 %, a = 3.9160(8) Å, D = 6.73(15) nm | — |
| elliptic cylinder, held | a plate 2.7(2) nm thick along a ⟨110⟩, 14.2(7) nm along the ⟨110⟩ across it, 16(4) nm along ⟨100⟩ | −474 |
| box, held | a plate 2.40(7) nm thick along [110], edges 12(4) nm along [1-10] and 16(4) nm along [001] | −456 |
| ellipsoid, held | a plate 3.08(7) nm thick along [110], 16.4(10) nm along [1-10], 27(3) nm along [001] | −426 |
| cylinder | a disc 2.35(5) nm high and 24(5) nm across, its axis 6.7(6)° from [110] | −422 |
| spheroid | oblate, 3.01(7) nm along an axis 7.7(9)° from [110], 28(8) nm across | −406 |

All five agree on a plate 2.4–3.1 nm thick with a ⟨110⟩ normal, without texture. With the (100) texture the same plates come back (2.4–3.3 nm, ⟨110⟩ normals), at ΔBIC −369 to −416 against the textured isotropic fit.

**The user's 37D_STOYbN_WCL:** §9.3.

**Broadening and displacements (v424): synthetic recovery.** Patterns computed from known parameters, with Poisson noise, the user's instrument (Cu Kα₁/Kα₂, the standard's profile and asymmetry) and a background, were refined by `autoRefine` from the file's cell. z = (fit − truth)/esd:

| Case | Pattern | Truth | z values | rms z | max \|z\| |
|---|---|---|---|---|---|
| WPPM sphere, SrTiO₃ | 15–120°, peak 4000 counts | D = 8 nm, X_s = 0.12°, a | 18 | 0.61 | 1.6 |
| log-normal, SrTiO₃ | 15–120°, 8000 | D_V = 10 nm, σ = 0.45 | 24 | 0.70 | 1.7 |
| log-normal, rutile | 15–120°, 8000 | D_V = 15 nm, σ = 0.35 | 9 | 0.70 | 1.4 |
| WPPM cylinder, SrTiO₃ | 15–120°, 8000 | diameter 20 nm, height 4 nm, tilted 45° | 16 | 1.21 | 2.6 |
| the same with log-normal sizes | 15–120°, 8000 | as above, σ = 0.3 | 9 | 1.09 | 2.1 |
| Stephens, SrTiO₃ (cubic) | 15–130°, 6000 | X_s = 0.4°, S₁ = −3 | 12 | 1.01 | 2.3 |
| Stephens, rutile (tetragonal) | 15–130°, 6000 | X_s = 0.4°, S₁…S₃ = −2, 1.5, 1 | 32 | 0.84 | 1.8 |
| faults, Pt (fcc), {111} ⅙⟨112⟩ | 30–130°, 6000 | α = 0.03 | 18 | 0.75 | 1.7 |
| faults, ZnO, {001} ⅓⟨1-10⟩ | 25–130°, 6000 | α = 0.05 | 9 | 1.21 | 2.2 |
| B per site, rutile | 20–145°, 20 000 | B(Ti) 0.45, B(O) 0.75 Å² | 12 | 0.71 | 1.7 |
| Uⁱʲ per site, rutile | 20–145°, 40 000 | six Uⁱʲ | 48 | 1.08 | 2.6 |

Over all 207 values, rms z = 0.93, and 3.9 % lie beyond ±2 (4.6 % for a normal distribution). The ZnO case first stopped at χ² 1.16 on a step left by a line near 180°; §3.2 tells how that was fixed.

**Other checks.**
- The FFT synthesis agrees with a direct quadrature to 0.03 % of the peak (§7.3). The covariograms, and the log-normal average against the distribution's moments, were checked independently.
- The numbers of Stephens forms match his table (from 1 anisotropic term for a cubic class to 14 for the triclinic one, over the eleven Laue classes), and each form is invariant under its group.
- The site constraints on Uⁱʲ were checked against the site symmetries of many structures (cubic, tetragonal, hexagonal and lower).

## 15. Limits, and what could come next

### 15.1 The size profile

**Lorentzian by default.** The default size profile is a Lorentzian (§7.2), the profile of an exponential distribution of column lengths; its size is an apparent one, not a crystallite's dimension. WPPM (§7.3) gives a solid's own profile, and a log-normal distribution of sizes (§7.4), at a cost of seconds per pattern for a sphere, a minute for a free solid and several minutes for a free solid with distributed sizes.

**Below 2–3 nm.** For the smallest crystallites the Bragg approximation itself fails: the Debye scattering equation, summed over the atoms of a model crystallite, is then the rigorous method. It costs far more: a 2 × 17 × 17 nm plate holds about 48 000 atoms.

**Other distributions.** Only the log-normal is offered; a gamma distribution or a histogram of sizes would need only another average in `addMemberCoef`.

### 15.2 Esds and residual correlation

The esds treat the residuals as independent (§5.7). With a systematic misfit, neighbouring residuals are correlated, and Rietveld esds are then too small, often by 2–3×. A Durbin–Watson statistic and the Bérar–Lelann correction would scale them.

### 15.3 Structure

**What is refined:** the displacement parameters (§8). Positions and occupancies are not refined.

**What is not corrected:**
- absorption;
- surface roughness;
- transparency;
- microabsorption;
- an automatic slit's sinθ.

**Surface roughness.** On a rough or porous flat sample, the low-angle beams graze the surface: part of what they would reach lies in the shadow of the bumps in front of it, and the irradiated volume holds less material. The intensity is lowered at low angles, less and less towards high angles. The usual corrections are Suortti's (1972), an exponential in 1/sinθ, and Pitschke, Hermann & Mattern's (1993), a polynomial in 1/sinθ; each has one or two parameters.
- **Why it matters.** The loss falls with angle, as a displacement factor's rises: a rough sample looks like one with a smaller B. A refinement that ignores it gives too low a B, even a negative one (§8).
- **Why it is not here.** On data like these, roughness and B are notoriously correlated: both act as smooth functions of angle on the same intensities. Refined together on data to 80°, neither would mean much. With B held at a physical value, or data to high angle, a roughness term would be worth adding.

**What constraints would allow:** occupancies linked by constraints (Sr/Yb on one site, summing to 1). On data to 80° these are poorly conditioned (§8.4), and they compete with the texture for the same information.

### 15.4 Texture

March–Dollase works on one axis, chosen among seven low-index planes. A spherical-harmonics texture would need no axis: for a cubic phase, order 4 has a single coefficient. Alternatively, the texture axis could be tied to the shape's plate normal.

### 15.5 Broadening

- **Strain.** Stephens' model (§7.5) is Lorentzian and Laue-symmetric. Dislocations broaden by contrast factors (Wilkens 1970; Ungár & Borbély 1996), which depend on the slip systems and on the elastic constants: a WPPM term, not yet one here. No Gaussian strain is modelled.
- **Faults** (§7.6) are one Lorentzian per family, from faults on all orientations at once. The peak shifts of fcc deformation faults and the asymmetry of twin faults are not modelled.
- **Anisotropic size** is the free solid's (§10); a size distribution scales the whole solid.

### 15.6 Instrument and inputs

- **Inputs.** Only `.xrdml` patterns, and only Bragg–Brentano reflection with a fixed slit.
- **Standard.** Only LaB₆ as the standard.
- **Monochromator.** The polarisation always assumes graphite (002).
- **Spectrum.** Kβ is not modelled; f′, f″ are taken at Kα1 only.
- **Pattern.** No excluded regions; no amorphous term in the background.
- **Weight fractions.** No internal-standard route to an amorphous fraction.
- **Display.** The card does not show the correlation matrix.

## 16. Known issues

**Fixed in v424.** The ten differences between the code and its intent that v423 listed here:
1. The weight fractions' esds with a texture came from the last texture trial: the covariance is now set back to the kept result's whatever the options.
2. Two tooltips gave a wrong formula: the crystallite size's (D = Kλ/Y_s), and the ΔBIC tooltip's 4/3 the wrong way round.
3. The ΔBIC line could read only "shape supported": it now says so with its threshold (under −10), the only case in which a shape is reported.
4. A shaped phase's ticks left out the texture and gave the first member's width: they carry the texture's weights and the members' mean width.
5. *Best axis* on a non-conventional file cell could leave a low-index plane untried: the candidates are now de-duplicated with the operations in the conventional basis.
6. A phase added after a refinement was drawn in that result's curve: a result is drawn with its own phases and models (§13.2).
7. Silent defaults: an unreadable `.xrdml` header, a wavelength outside the tabulated lines and the isotropic-scale fallback of the cell constraint now each say so.
8. The fit-quality flags reach the results: a refinement stopped at its iteration limit, the parameters on a bound, the undetermined ones.
9. A deuterated site weighs as D in the cell's mass (a species read as hydrogen whose symbol starts with D: DY3+ stays dysprosium).
10. A CIF that names its group but lists only `x, y, z`, or whose asymmetric unit holds whole formula units without a Z, is now refused as the other named groups without their operations are; so is the asymmetric unit of a centrosymmetric group that lacks its inversion (§2.3).

Found while testing v424 and fixed: a line near 2θ = 180°, beyond the pattern, could stop a refinement on a step (§3.2).

**Fixed in v425**, after a critical review of every module by eleven independent reviewers, each finding checked by another (RIETVELD-REVIEW.md lists them all, with the imprecisions, resolved in v426, and the catalogue of the calibrations):
1. The 3D view's cell triad was left-handed, and the labelled arrows pointed against it, about half the time: the Laue frames are now proper and each arrow points along its label's sense.
2. `solveLinear` on a subset solved as if the held linear terms were 0.
3. Phase detection kept an absent candidate that only took up a broad hump (46–48 wt %): the plausibility test (§6.4).
4. Phase detection dropped a present minority phase at 15–36 esd: the own-evidence test now reads the lines that stand clear of the others' (§6.4).
5. `findSymmetry` lost operations when the origin was off a symmetry element (§2.4).
6. `classify` crashed on a 6-fold without its 3-fold.
7. A named group without its operations was not refused when named by its IT number or Hall symbol alone (§2.3).
8. The attenuation factors were applied a second time to `.xrdml` intensities (§2.1).
9. The Williamson–Hall esds were not scaled by √χ²_ν.
10. The card lost the instrument read from the file after a saved state or a tab switch, and refined with the Cu defaults.
11. A result refined in one role (standard or sample) was used in the other after the standard changed: a sample fit of the standard's file had become the samples' instrument.

**Fixed in v426**: the 76 imprecisions RIETVELD-REVIEW.md §2 listed, 73 fixed and 3 mitigated; each item there says how, with its measurement. Those that change results:
1. The weights are Mighell's χ²_γ, with the one-count floor in any unit (§2.1): the background is no longer about one count per point low, and a cps file weighs as the same counts.
2. The monochromator is read from the file, crystal by crystal, and a perfect incident crystal drops Kα2 (§2.2, §3.4).
3. Kα2 has its own f′ and f″, and its size widths are λ2/λ1 times Kα1's (§3.3, §3.8).
4. UTF-16 files, XRDML 2.x `<counts>`, pre-set-count scans and descending scans load (§2.1).
5. Symmetry from the atoms allows the rounding of the written digits and is closed into a group; the lattice's symmetry is found in any basis, and a supercell is refined in its own cell (§2.3, §2.4).
6. The reflection list follows the lattice bounds (§3.2); the axial-divergence nodes go to 4000, and the audit re-runs at 1.13× (§3.7, §5.6).
7. The least squares: collinear sets reported whole, λ reset after a linear re-solve, an exact non-negative solve of the scales (§5).
8. Phase detection: one phase left out per pass, and a phase the 3-esd test leaves out put back when χ² rises past the BIC bar (§6.4).
9. The Stephens forms are exact and built in a frame of the conventional cell, so the S_j no longer depend on the file's setting (§7.5).
10. The free shape's faces are rounded after the widths scale, over 1°; the angular esds interpolate √Δχ², refine every other parameter again, and use χ²_ν as the linear esds do (§10).
11. The single-peak widths are no longer held at or above 0, a peak not broadened gets an upper limit, and a peak not read keeps its row (§12).
12. The instrumental profile carries the standard's λ1 and radius: a sample of another wavelength is refined without it, with a warning, and a sample refined with an earlier refinement of the standard is flagged (§7.1).
13. `findSymmetry` grows as N·(|T| + |R|) instead of N²·|group|: a 1280-atom YAG cell takes 0.1 s instead of 8 s (§2.4).

**Open.**
- Three imprecisions are mitigated rather than fixed (RIETVELD-REVIEW.md §2): a single peak's scale is still +0.3 to +0.8 % high at 2–10 counts per point (model weights would remove it but let a missing peak pull 2–5× harder); a minority phase whose scale is under 3 esd and whose χ² rise is under the BIC bar stays out, with the rise stated; two settings of a 4/m, −3 or −3m phase that only the atoms tell apart can give S_j of opposite sign (the setting-free √ΣS_j² is reported beside).
- A WPPM line's area in the window is about 0.3 % below the pseudo-Voigt's at the same intensity (§7.3): weight fractions between a WPPM phase and a Lorentzian one carry that bias.

## 17. References

- Bérar, J.-F. & Lelann, P. (1991). *J. Appl. Cryst.* 24, 1–5.
- Brindley, G. W. (1945). *Phil. Mag.* 36, 347–369.
- Caglioti, G., Paoletti, A. & Ricci, F. P. (1958). *Nucl. Instrum.* 3, 223–228.
- Chantler, C. T. (2000). *J. Phys. Chem. Ref. Data* 29, 597–1048 (NIST FFAST).
- Cromer, D. T. & Liberman, D. A. (1981). *Acta Cryst.* A37, 267–268.
- Durbin, J. & Watson, G. S. (1950, 1951). *Biometrika* 37, 409–428; 38, 159–178.
- Eliseev, A. A. et al. (1986). *Acta Cryst.* C42, 1263 (LaB₆).
- Finger, L. W., Cox, D. E. & Jephcoat, A. P. (1994). *J. Appl. Cryst.* 27, 892–900.
- Fischer, R. X. & Tillmanns, E. (1988). *Acta Cryst.* C44, 775–776.
- Grosse-Kunstleve, R. W. & Adams, P. D. (2002). *J. Appl. Cryst.* 35, 477–480.
- Hill, R. J. & Howard, C. J. (1987). *J. Appl. Cryst.* 20, 467–474.
- *International Tables for Crystallography* (2004). Vol. C, 3rd ed., §6.2.2 (the polarisation factor). Kluwer.
- Langford, J. I. & Louër, D. (1996). *Rep. Prog. Phys.* 59, 131–234.
- Langford, J. I., Louër, D. & Scardi, P. (2000). *J. Appl. Cryst.* 33, 964–974.
- Langford, J. I. & Wilson, A. J. C. (1978). *J. Appl. Cryst.* 11, 102–113.
- March, A. (1932). *Z. Kristallogr.* 81, 285–297; Dollase, W. A. (1986). *J. Appl. Cryst.* 19, 267–272.
- Mighell, K. J. (1999). *Astrophys. J.* 518, 380–393.
- NIST SRM 660c, Line position and line shape standard for powder diffraction (LaB₆), certificate.
- Pitschke, W., Hermann, H. & Mattern, N. (1993). *Powder Diffr.* 8, 74–83.
- Rietveld, H. M. (1969). *J. Appl. Cryst.* 2, 65–71.
- Scardi, P. & Leoni, M. (2001). *Acta Cryst.* A57, 604–613.
- Scardi, P. & Leoni, M. (2002). *Acta Cryst.* A58, 190–200.
- Stephens, P. W. (1999). *J. Appl. Cryst.* 32, 281–289.
- Stokes, A. R. & Wilson, A. J. C. (1942). *Proc. Camb. Phil. Soc.* 38, 313–322.
- Stokes, A. R. & Wilson, A. J. C. (1944). *Proc. Phys. Soc.* 56, 174–181.
- Suortti, P. (1972). *J. Appl. Cryst.* 5, 325–331.
- Thompson, P., Cox, D. E. & Hastings, J. B. (1987). *J. Appl. Cryst.* 20, 79–83.
- Trueblood, K. N., Bürgi, H.-B., Burzlaff, H., Dunitz, J. D., Gramaccioli, C. M., Schulz, H. H., Shmueli, U. & Abrahams, S. C. (1996). *Acta Cryst.* A52, 770–781.
- Ungár, T. & Borbély, A. (1996). *Appl. Phys. Lett.* 69, 3173–3175.
- Velterop, L., Delhez, R., de Keijser, Th. H., Mittemeijer, E. J. & Reefman, D. (2000). *J. Appl. Cryst.* 33, 296–306.
- Waasmaier, D. & Kirfel, A. (1995). *Acta Cryst.* A51, 416–431.
- Warren, B. E. (1969). *X-ray Diffraction*. Addison-Wesley.
- Wilkens, M. (1970). In *Fundamental Aspects of Dislocation Theory*, NBS Spec. Publ. 317, vol. II, 1195–1221.
- Williamson, G. K. & Hall, W. H. (1953). *Acta Metall.* 1, 22–31.
- XrayDB 4.5.8, https://github.com/xraypy/XrayDB (the tables of `xrd-data.js`).
