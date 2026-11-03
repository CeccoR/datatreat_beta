# DataTreat

A browser-based scientific data analysis tool for spectroscopy and chromatography data, for figures of your own CSV files and for iodometric kinetics. No installation or account required — all processing runs in your browser; no data is ever sent to any server.

## Getting Started

### Use Online

Open DataTreat directly in your browser — no download needed:

**[https://ceccor.github.io/datatreat/](https://ceccor.github.io/datatreat/)**

### Install as an app (offline use)

DataTreat is a Progressive Web App. When opened over HTTPS (the link above) or
`http://localhost`, your browser offers an **Install** option (address-bar icon,
or *⋮ → Install / Add to Home Screen*). Once installed it runs in its own window
and, thanks to a cache-first service worker, **works fully offline** — ideal for
a lab bench with no network. All computation already runs on-device, so nothing
else is needed. To pick up a new version, just reopen it while online.

### Run Locally

If you prefer to run it offline, clone the repository:

```bash
git clone https://github.com/CeccoR/datatreat.git
cd datatreat
```

The app is built from native ES modules, so browsers block loading it directly
via `file://`. Serve the folder over a local HTTP server instead (still no build
step and no dependencies):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in any modern browser (Chrome, Firefox,
Safari, Edge). Any other static server works too (e.g. `npx serve`).

### Settings

Before analyzing data, configure the CSV export format via the **⚙ Settings** button:

- **Decimal separator**: `.` (point) or `,` (comma)
- **Field separator**: `;` (semicolon), `,` (comma), or `Tab`

Note: The decimal and field separator cannot both be set to comma.

---

## Modules

DataTreat is a modular application. New analysis modules may be added in the future. In every module what is loaded is listed in the **trace list** (from v532; the file list to v531), a row a **trace**: its colour (the legend's), its name under **Label** (headed *Trace* in v532–v533), used in the plots, the legends and the exports, and under **File** the file it comes from. A trace is named as its file names its sample where the file states one (the DRS Cary export's first line, an XRPD file's sample, an EPR `.DSC`'s TITL, a SEM image's), else after its file; renamed in its field, the name is taken when you leave it (or press Enter), not while you type, and Escape puts back the one it had. Its box includes it in the analysis or leaves it out (it stays in the list), its grip moves it, and its ↓ downloads its file's original bytes. One file can give several traces (an XRPD file of several scans, a Custom CSV of several series): each is a trace of its own, every one showing the same file, whose bytes the project keeps once; ↓ in the head downloads every file once. Projects saved before v532 open with their labels, inclusion, order and results as they were (their names are not read again from the files). In every card with a plot on the left and its parameters on the right (DRS's Tauc and Urbach cards, XRPD's Scherrer card and its standard, EPR's spectra, SEM's crop and intensity, Custom's cards), each parameter is a row: its name on three fifths of the column, its field on the other two (from v531; the name wraps, or in SEM is cut short and the card goes to one column). Currently available modules are:

### 1. DRS UV-Vis (Tauc Plot Analysis)

Analyze diffuse reflectance spectroscopy (DRS) data in the UV-Visible range to assess light absorption and estimate semiconductor band gaps.

**Instrument compatibility**: Cary 5000  
**File format**: CSV or TXT with two columns: the wavelength in nm, and F(R) (the Kubelka-Munk function) or the reflectance in percent. The standard format is the Cary 5000's own export: the sample's name on the first line, the header `Wavelength (nm)` and `%R` or `F(R)` on the second (any separator, decimal mark, case or quotes), the data from the third; it loads with no alert, and %R is converted to F(R) = (1 − R)²/2R. Any other file loads with a warning, read from the two columns its header names, wherever they stand: the wavelength (`Wavelength`, `λ` or `nm`, with or without `(nm)`) and F(R) or the reflectance in percent (`%R`, `R%`, `R (%)`, `Reflectance (%)`); other columns are ignored. A file whose header names none of them, or names them more than one way (two wavelengths, both F(R) and %R, two samples side by side), or gives the wavelength in another unit, is refused with the reason; so is a file with no header (to v509 it was read as F(R) with a warning, and so was a JASCO export, its `YUNITS,%R` line read as %R). Projects saved before open as they were. The file list says how each file's second column was read, `%R` or `F(R)`, in a column with no header right of its label (hover it for the whole). Points with no physical value (R outside 0–100 % or of 0, F(R) below 0, a value that is no number) are left out, and the alert says how many and why. The field separator (`;`, `,`, a tab or spaces) and the decimal mark (`.` or `,`) are found in each file; fields may be in quotes; the text may be UTF-8 or UTF-16, with or without its byte-order mark.

**How to use**:

1. Upload your CSV/TXT files via drag-and-drop or click to select. Each file is a trace in the trace list, named after the sample's name on its first line in the standard format (the Cary's), else after the file; its note says how its second column was read (%R or F(R)).
2. For each spectrum, adjust:
   - **Tauc exponent**: 0.5 (indirect semiconductors) or 2 (direct semiconductors)
   - **[F(R)hν]^a smoothing window**: smoothing parameter for the absorption function
   - **Derivative smoothing window**: smoothing for the first derivative (helps identify inflection points)
   - **Tauc linear region regression window**: number of points for linear fit
   - **Baseline regression window**: number of points for baseline fit

   v520 brought these back to numbers of points, as they were to v514 (v515 to v519 made them widths in eV); a project or tab saved by v515 to v519 opens with each in points: one at v515's default (Tauc 0, 0.15, 0.2 and 0.5 eV; Urbach 0, 0.15 and 0.15 eV) as v514's (1, 20, 25 and 100; Urbach 1, 20 and 25), any other as the points it spanned where it acted, rounded, at least 1 for a smoothing and 2 for a window: a regression window, the points of the window chosen for the sample, a smoothing (or a window with none chosen), its width over the energy step at the middle of the spectrum (the middle point's, in energy order, to its two neighbours), each in all mode the median over the samples (a window's, of those with one chosen), and it is saved in points after; a project saved to v514 opens as it did then.

3. **Interactive plot**: Drag the vertical red line (Tauc region) and magenta line (baseline) to adjust the linear fit regions.
4. The Results open with F(R) and the reflectance R (%) against the wavelength, side by side, whatever the files held (R from F(R) by the exact inverse, R = 1 + F − √(F² + 2F)), and under them F(R) against the energy on a log axis, across the card. Then each card's charts:
   - **Eg (x-axis)**: Band gap from intersection with x-axis
   - **Eg (baseline)**: Band gap from intersection with baseline
   - **NRMSE & R²** for both regressions (the RMSE divided by the range of the values in the window)

5. Export processed data as CSV using the **Export CSV** button.

---

### 2. XRPD (X-Ray Powder Diffraction)

Compare, smooth, and normalize X-ray powder diffractograms.

**Instrument compatibility**: PANalytical XPERT diffractometer  
**File format**: PANalytical XML format (`.xrdml`, `.xml`)

**How to use**:

1. Upload your XRDML/XML files (the samples). Each pattern is a trace, named after the sample the file names (its `<sample>`'s name, else its id; none, the file's name). A file with several scans gives one pattern per scan, a trace each named “sample (scan k)” with the file under File, which share the file's bytes (kept once in the project); in the standard's window only its first scan is used. Points whose intensity, counting time or attenuation factor is not a number are left out, with a note saying how many; a file left with fewer than two points is refused. A file that cannot be read is named in an alert, and the others load.
2. The analyses are cards, as in DRS: a **Scherrer** card (peak search, FWHM and the Scherrer crystallite size, with the stacked patterns and the sizes in the Results) and a **Rietveld** card. **+** under them adds another of either kind; each card can be renamed, turned into the other kind, folded, moved by its ≡ grip and closed. Every card shows the same sample: its arrows (or ← / →) step them all.
3. **Instrumental standard…** (in either kind of card) opens the standard's window: it is a file of its own, not a sample. Drop its measurement there (one file: a new one replaces it; its whole name is shown under the drop zone, and the window's head, with its ×, stays at the top while the rest scrolls). In a Scherrer card's window it is analysed as the samples are, and its peaks' Caglioti fit corrects every sample's size for the instrument's width; in a Rietveld card's, it is refined, and its profile is the samples' instrument.
4. Scherrer card: **Normalization** (global, local or none — the data as they are — for the stacked Results), smoothing, baseline (its box unticked: no baseline subtracted, the pattern read from zero) and peak search, K and λ, each shared by all samples or set per sample (**all / one**); **+ Add peak** places a peak by hand. The smoothing and the SNIP baseline are widths in °2θ (0.25° and 5°, the standard's smoothing 0; the SNIP's the whole width, its points compared up to half of it on either side): the smoothing takes at each point the mean of the line through the points over a window that wide, so one setting smooths alike patterns measured at different steps; each field shows, inside it, the points it spans at the step of the pattern on show (`≈ 19 pts`, `≈ 299 pts` for 5° at 0.0167°). Up to v515 the defaults were 0.13° and 2°, and the SNIP's field its half-width. Up to v510 they were numbers of points: a project saved before opens with them as widths at its patterns' steps (patterns at different steps under *all*: that setting turns to *one*, a width each, and a note says so).

**Rietveld refinement** (the *Rietveld* card):

1. Add each phase from a CIF: drop CIF files on **Phases**, beside the pattern, or click there (a drop zone while there is no phase, then **+ CIF** at the list's foot; several at once). Each phase's ↓, left of its ×, downloads its CIF (in UTF-8, under the file's name). The list gives each phase's formula and space group, found from the atoms for a file in P1. Files in P1, such as Materials Project's, have their symmetry found from the atoms, so a cubic cell is refined by *a* alone. Each phase is ticked for every pattern at first; untick it on a pattern to leave it out of that pattern's refinement. A click on a phase shows its unit cell in 3D (drag to turn it, double click to reset) with its details.
2. Refine the instrumental standard in its window (**Instrumental standard…**) against the built-in LaB₆ (NIST SRM 660c) or a CIF of the standard's: it gives the instrument's zero and peak shape, axial-divergence asymmetry included.
3. **Refine all** refines every sample: cell, specimen displacement, crystallite size and microstrain (above the instrument's broadening), weight fractions with several phases, with R<sub>wp</sub>, R<sub>exp</sub>, χ² and the standard errors, shown across the card under the pattern, with what the result was refined with by its title and every warning at its foot. A phase with no significant intensity of its own is reported *not detected* and left out; the same CIF added twice gives two size populations of one phase. **Settings…** (under the pattern's side column; read only while a refinement runs) decides what Refine refines: per phase, each model below switched on or off and its depth, the size and the strain included; and where it starts, from the CIF or from each pattern's last result with chosen groups of parameters held there (fit the shape, hold it, then refine B per site from there). The standard's window has its own. **Clear all** clears every pattern's result.
   - With no refined standard, **Refine** and **Refine all** first ask, in a window at the centre of the screen: refine the standard first (with its window's Settings, then the samples with its profile), refine without the standard, or cancel; with no standard loaded, *Load a standard…* opens its window. While samples refine the standard cannot be refined, and while the standard refines the samples cannot, so a batch always has one instrumental profile. The standard's refinement goes on with its window closed: every card's **Instrumental standard…** button then shows a spinner and the run's progress until it ends. The standard's **Settings…** offer only what applies to a standard (its displacement parameters, its texture, where it starts, its Refinement).
   - A refinement belongs to its project and goes on when its tab is left (see *Tabs*, under Projects); closing its tab asks whether to stop it. While it runs, undo and redo go over what was done meanwhile and stop, silently, where it started; its results come in as one step there, so undoing what was done meanwhile keeps them. A stopped run keeps the patterns already done.
4. **Size profile, strain and faults** (per phase, with a refined standard): the size as a Lorentzian of the right breadth (Scherrer's K = 0.9), or by **WPPM** (Whole Powder Pattern Modelling: each line the Fourier transform of the instrument's, the crystallites', the strain's and the faults' coefficients, so the sizes are the true ones), with one size or a **log-normal distribution** of sizes (volume-weighted mean, median, number mean and σ); the microstrain isotropic or **anisotropic** (Stephens: ε² a quartic form of the direction that the Laue group leaves unchanged); **planar faults** (after Warren: stacking faults, antiphase boundaries, Ruddlesden–Popper faults), their probability per plane refined.
5. **Displacement parameters and site occupancy** (per phase): the CIF's B, one ΔB, one B per crystallographic site, or the anisotropic U<sup>ij</sup> per site within its symmetry (with B<sub>eq</sub>); and the occupancy of one of the phase's sites, refined — a site that has lost atoms, as the Sr site of a Sr-poor SrTiO₃, scatters less at every angle alike.
6. **Preferred orientation** (per phase): March–Dollase along a chosen (hkl), or the best of the low-index planes.
7. **Crystallite shape** (per phase): the isotropic size, or a free solid — ellipsoid, spheroid, cylinder, elliptic cylinder, box or square-based box — in any orientation, each reflection of a family with its own width (the solid's column length along it), from several starting shapes. It is kept only when the data support it against an isotropic size, and reports the solid's dimensions with their esds and its axes' lattice directions with their angular esds (those of the χ² valley the fit ends in), drawn as a rotatable 3D solid with the crystal's directions, their uncertainty cones and the cell's a, b, c.
   From v523 (the free-shape research's rounds 2 and 3, `research/free-shape/`, on synthetic patterns with each solid's exact lines): a solid is always drawn by its exact line (WPPM, whatever the size profile chosen; the Lorentzian of the right breadth read its extents 13–25 % long and pulled it toward equant), its isotropic size then the sphere's diameter; the search starts from the class's distinct shapes and on the lines the isotropic fit leaves most and least broadened, refines every minimum it falls into to the same level, and keeps the shape when its gain over the isotropic size is over what noise gives a sphere in the phase's Laue class (13 to 25 χ²<sub>ν</sub>, where ΔBIC under −10 asked 28–56), with ΔBIC under −10 as well where a check line by line finds a misfit; each dimension and axis gets a 95 % interval (the local error, the spread over the minima and, where the check fired, a jackknife over lines), in the result for now (the card shows the esds as before). On the research's validation runs: clean extents read within 1 % (worst extent, median; v522 +29 %), their intervals covering 98 % and the axes' 94 %, no clean sphere given a shape, for about v522's evaluations (round 2's whole fit 0.85× v522's, round 3's 1.26× round 2's). A project saved with a free solid under the Lorentzian profile opens as it was saved, its curves drawn with the old line; refined again from its last result, its solid is searched again with the exact line and its isotropic size reads differently (the sphere's diameter, not a Scherrer size); a solid saved under WPPM is carried as before. The details: [RIETVELD.md](RIETVELD.md) §10.
   From v524 the search draws no random number: each starting shape is tilted 6° in a fixed direction (v523 drew the tilt from a seeded stream), and the Refinement setting *Shape trial starts* (random starts beside the search's own) is gone; a project that set it opens without it, and the same data give the same result. On the research's 77 screening runs of round 3 it lies within the spread of v523's own tilts drawn from three seeds: the same outcomes, reach 60 of 65 (60–62), clean extents' worst +3 % at the median (+2 %), 76 of 82 clean extents and 31 of 32 clean axes within their intervals (76–78, 31), at 1.02× the search's evaluations ([research/free-shape/round3/V524.md](research/free-shape/round3/V524.md)).
   From v525 the Refinement setting *Shape extra tilt sets* (0–8, default 0) runs the search's starts again, once for each more tilt direction (fixed points spread over the sphere, the same for each set whatever the number), each set's best refined fully and every minimum found refined with the search's: about one more search per set, less likely to miss a solid only some tilts reach, and still no random number (the same data and settings give the same result). At 0 a refinement is v524's exactly; a project or result without it reads as 0. Not tuned or measured on the research's runs.
   From v528 the Refinement setting *Shape size line* chooses the free solid's line where the phase's size profile is the Lorentzian: *Lorentzian* (the default: each member a Lorentzian of the solid's width along it, as to v522; the isotropic size the Scherrer reading) or *exact, from the solid* (WPPM, as v523–v527 always drew it). The exact line is the more accurate one (the Lorentzian reads a solid's extents 13–25 % long and pulls it toward equant), and the search's thresholds were tuned on it; its tooltip says so. A result keeps the line it was refined with, and refined again from it with the other its solid is searched again. A phase whose size profile is WPPM is drawn by its exact line either way.
8. **Peak widths**: each reflection fitted alone and corrected for the instrument: a Williamson–Hall plot, beside it the tests that tell an anisotropic broadening (shape), a strain and faults apart (Williamson–Hall χ², ratios of successive orders, the models' predicted widths), and the crystallites' shape; at the card's foot the table, like the Scherrer card's (a click keeps a peak marked on the pattern and on the plot).
9. **Results**: each Rietveld card's refined patterns stacked (normalised global, local or none, in **Settings…**) and its crystallite sizes, by sample or by peak.

How it all works, in detail (the model, the solver, the strategy, the broadening, displacement, occupancy, texture and shape models, the tests, the evidence behind each choice and the limits): [RIETVELD.md](RIETVELD.md). A critical review of all this code (the errors fixed in v425, the imprecisions it found and how v426 resolved each, and the catalogue of every chosen number, each tested on synthetic data in v427): [RIETVELD-REVIEW.md](RIETVELD-REVIEW.md).

---

### 3. GC (Gas Chromatography)

Assess H₂ and O₂ production rates from gas chromatography data, including light-on time and time-interval analysis.

**Instrument compatibility**: Agilent Gas Chromatographer  
**File format**: CSV with columns:
  - "Injection date" (datetime)
  - "H2 (B) [%Mol]" and/or "O2 (B) [%Mol]", or similar (mole percentages; a file needs at least one of them)

  The header may come after title lines. Separator, decimal mark, quotes and encoding are found in each file, as for DRS; a `,`-separated file whose `,` decimals are not in quotes cannot be read either way and is refused.

  The injection dates are read as the instrument writes them, month/day/year with AM or PM. A file whose dates all exist only read day/month (13/10/2025), their times going on as the rows do, is read day/month and said; a date that does not exist (2/30/2025, 13:00 PM) leaves its row out, and the alert says how many (to v509 such a date rolled over into another: 13/10/2025 was read as 10 January 2026).

**How to use**:

1. Upload your CSV files. Each file is a trace in the trace list: a sample, with every gas measured in it (H₂ and O₂), never a trace a gas. The app auto-detects the injection date and the H₂ and O₂ columns (case-insensitive). An empty H₂ or O₂ cell leaves that injection out of that gas only (its rate, its cumulative production and its mean are computed from the injections that have a value), and an alert under the drop zone says, per file, how many empty cells were skipped.
2. Set parameters for each sample:
   - **m (mg)**: Catalyst mass in milligrams
   - **Q (mL/min)**: Carrier gas flow rate
   - **T (°C)**: The temperature the flow Q is given at (25 °C by default; the same for every sample, or one each with *all / one*). The molar volume is V<sub>m</sub> = RT/p, so the rates scale with it: for a mass-flow controller that reports standard flow, use the reference temperature on its datasheet (0, 20 or 25 °C), not its body's; for a flow measured as a volume (a bubble meter), the gas temperature where it is measured. Projects saved before v495 keep 0 °C.
   - **p**: The absolute pressure the flow Q refers to (1 atm by default; *all / one* as T). Its unit (atm, bar, kPa, mbar, Torr ≈ mmHg, psi) is chosen in its header and only changes how the values are shown and written, never the pressure. For a mass-flow controller, the reference pressure of its standard units (usually 1 atm, 1.01325 bar); for a flow measured as a volume, the gas's absolute pressure there (ambient ≈ 1 atm). Projects saved before v501 are at 1 atm.
   - **Light-on date/time**: When irradiation started (determines when H₂ production begins)

3. Adjust the **time interval** (in hours from light-on) for rate calculation:
   - **Interval start** and **Interval end** define the window
   - White vertical lines on the plot mark these boundaries

4. Two interactive plots, for the gases chosen with the **H₂ / O₂** chips (a gas no included file has is greyed out, and comes back when such a file is loaded or included):
   - **Rate (mmol/h/g)**: Production rate over time
   - **Cumulative (mmol/g)**: gas accumulated from the start of the interval

5. View results in a **bar chart** (mean production rate per sample) and a **summary table**.

**Replicates**: the trace list's **Sample** column says which sample each file is: its own, as every file starts, or another file's, chosen by that file's name (a label renamed changes no link). Each row offers its own file and the files that head a sample (linked to none): there are no chains, a file that heads a group, set to another, takes its whole group along, and a head removed leaves its group to its next file in list order. The time plots stay one per file. The mean-rate bar chart has one bar per sample, named after its head's label (the first included file's when the head is left out): its height the mean over the sample's included files of each one's mean rate, each worked out with its own m, Q, T, p, light-on and interval; its error bar the files' standard deviation (n − 1 under it; none for a sample of one file, as before). A file left out is out of the mean and of n. With replicates `mean_rates.csv` has a row per sample (each gas's mean, its standard deviation and n, then the duration, p and T, a value that differs between the replicates written as all of them joined by `/`) and `mean_rates_by_file.csv` the rows per file, as `mean_rates.csv` was; with none, `mean_rates.csv` is as before. Each choice is a step of the undo history and is saved with the project; a project saved before v512 opens with each file its own sample.
6. Export all data as CSV.

The analysis is a card, as the DRS ones are: **+** under it adds another (its own masses, flows, light-on times, intervals and delay on the same samples), and each card can be renamed, folded, moved by its ≡ grip and closed; every card has its own plots in the Results, under its name, and its own CSVs.

⚠️ **Note**: Light-on time must be **after the first injection** in your data. If it's earlier, an orange warning appears.

---

### 4. EPR (Electron Paramagnetic Resonance)

Compare, smooth, and normalize EPR spectra from Bruker instruments, each pair of files checked as it loads.

**Instrument compatibility**: Bruker EPR spectrometers (BES3T format)  
**File format**: Paired `.DTA` (binary signal data) and `.DSC` (text parameters) files

**How to use**:

1. **Upload paired files**: Both `.DTA` and `.DSC` files are required for each sample, in the same upload.
   - Files are matched by their stem name (e.g., `sample.DTA` and `sample.DSC`)
   - A `.DTA` or `.DSC` whose partner is not in the same upload is not loaded, and a warning names it (nothing is held back waiting for the other half: upload the two together)
   - Re-uploading a sample already loaded gives a yellow warning, and the file is not loaded again
   - Each pair is a trace in the trace list, named by its `.DSC`'s title (TITL), else after its files' stem, shown under File

2. Adjust:
   - **Normalization**:
     - *Global*: All spectra divided by the largest peak-to-peak
     - *Local*: Each spectrum divided by its own peak-to-peak
     - *None*: The spectra as they are (the stacking only spaces them)
   - **Smoothing width (mT)**: the mean of the line through the points over a window that wide on the plotted field (0.2 mT; 0 is none), so spectra recorded at different steps are smoothed alike; the field shows inside it the points it spans (a range when the spectra's steps differ). Up to v510 a number of points: a project saved before opens with it as a width.

3. Interactive plot overlays all spectra with your chosen normalization. The analysis is a card: **+** under it adds another (its own normalization and smoothing of the same spectra, on its own plot), and each card can be renamed, folded, moved by its ≡ grip and closed.
4. Export processed data as CSV.

**File format details**:  
The app natively reads Bruker BES3T files:
- `.DSC` contains parameters: `XPTS` (data points), `XMIN`/`XWID` (field range in Gauss), `MWFQ` (microwave frequency in Hz), `BSEQ` (byte order)
- `.DTA` contains binary float64 signal values
- B-field axis is reconstructed and corrected for microwave frequency

### 5. SEM (Scanning Electron Microscopy)

Tescan SEM images, read with their metadata, cropped, brought to comparable grey levels, grouped by scale and laid out into figures with scale bars (more in [SEM.md](SEM.md)).

**Instrument compatibility**: Tescan (the TIFF files the Tescan software saves)  
**File format**: grey TIFF, 8 or 16 bits, uncompressed, with Tescan's own metadata inside it (the `.hdr` beside it is not needed)

**How to use**:

1. **Upload the `.tif` files.** Each image is a trace in the trace list, named by the sample the file names, else after the file. Each is read with its pixel size, magnification, field of view, beam (kV, working distance) and detector (gain, offset), off the page's main thread, so the page stays responsive while they load. The info bar under the image is left out by the height the file gives for it. An image whose pixels are not square (a pixel size in X other than in Y) is brought to square pixels of the finer size, the coarser axis interpolated, so that crops, groups, scale bars and figures measure alike in both directions; its details give the size as acquired. A file of another kind, or a damaged one, is not loaded, and the list under the drop zone says why.
2. **Groups and scale.** The images are grouped by pixel size (within 10 %), each group named by its magnification; rename a group by clicking its name, or drag an image onto another group or onto *+ Group* (on a phone, hold it a moment first); *+ Group* clicked adds an empty group (kept while it is empty, until its *Remove*; once filled it goes, as the others, when its images are removed from the list), and *Reset* makes the groups again. Only the images ticked in the file list name, order and fill the groups; an image left out keeps its group and comes back to it. At *common scale* (the default) a group's images are brought to its largest pixel size (reduced by averaging, never enlarged) and to its smallest field of view, so that one scale bar serves the group; at *own scale* each keeps its pixels and gets its own bar.
3. **Crop and intensity.** One image at a time, with the histogram of its crop under it, beside the thumbnails of all the images and the image's details. Each image starts whole. With *Default* ticked the crop is the whole image, its fields locked; drag the frame's handles or sides to resize it, inside it to move it; the view stays fitted unless a tool of the toolbar over it is on (pan, zoom area; fit). The fields give the crop in pixels, with its size in µm. A ratio (1:1, 4:3, 3:2 or free) holds while resizing.
4. **Several images.** Images linked by the chain on their thumbnails share one crop (*Link all* links the images chosen); unlinked, an image keeps the crop it had. A crop larger than an image is narrowed to fit it, and the image is marked.
5. **Intensity.** A normalisation for all images: none, each image stretched between two percentiles of its own levels, or the mean and SD, or the whole histogram, of a reference image (one of them). Then contrast, brightness and gamma, with each image's own correction on top. The selector over the thumbnails applies them to all images alike, or to one group at a time (each group starting from All's settings; back to All, All takes the group's on show). Each set of settings has a *Default* box that locks it at its defaults. The statistics are the crop's, with saturated pixels left out.
6. **Figure.** Each group has its own *Figure composer* button and figure, made in the plots' composer (one composer open at a time): a page in millimetres, the most compact grid (4 × 3 for 12 images), or blocks of panels set by hand (2 × 1 blocks of 2 × 2 panels), with a gap between panels and another between blocks; panels in the file list's order, reordered by the handles of the image list; each with its sample's name (placed automatically where there is room, or by hand; horizontal or vertical), letters (a), (b)… if wanted (before the name, or in any of 8 places), and scale bars (one per group at common scale, or one per image; 8 places), their length a round value or any value typed; the page's size free, with auto margins or a plot set by hand. PNG at the chosen dpi (a page too large for a PNG in the browser says so, with the largest dpi it can make), or SVG with the images in it.
7. Export the images' metadata, crops, intensity settings and groups as CSV. The project keeps each file's own bytes; the images themselves are never changed.


### 6. Iodometry (H₂O₂ by iodide oxidation)

New in v533: iodide oxidised to triiodide by H₂O₂, followed as the absorbance of the triiodide band against time at one wavelength; a small spike in each trace marks the injection of the analyte, and each trace is read at a fixed time after its injection. A module of its own, as the others (live tabs, projects keeping the CSV's bytes, undo and redo, the view kept).

**Instrument compatibility**: Cary 60 (Kinetics)  
**File format**: the Kinetics CSV export: the traces' names on the first line, one over each pair of columns, `Time (sec)` and `Abs` on the second (a time in `min` is read in seconds), the data from the third (a shorter trace leaves its cells empty), then each trace's details under its name (`Collection Time: …`, `Wavelength (nm)  350.0`). The separator, the decimal mark, the quotes and the encoding are found from the file, as DRS finds its own. A file with no pair of columns of numbers is refused, and a file already loaded is said.

**How to use**:

1. **Upload the CSV.** Each pair of columns is a trace in the trace list, named as the file names it, its CSV under File; its tooltip gives its wavelength and collection time. Rename, include or leave out (a trace left out is left out everywhere), reorder and colour the traces as in every module.
2. **Analysis card.** The trace on show, stepped through by its arrows (← → too; a view, no undo step), with its injection, its background (dashed) and its reading marked. **Click the plot** to set the trace's injection at the point nearest in time (a guide reads that point out as the pointer moves); the results follow at once. On loading, and for every trace when **✦ Suggest** is pressed, the injection is the highest local maximum whose prominence is the **minimum prominence** at least (0.01 by default; changing it moves nothing until Suggest); a trace with none has no injection until one is clicked. On the right, on the 3/5–2/5 grid: the **reading time** (240 s by default), the minimum prominence, the calibration in use, and the trace's injection, background, reading and concentration.
3. **Alignment and reading.** Each trace's time is counted from its injection and its absorbance taken less the least it has from the injection on (its background). Its **reading** is that aligned absorbance at the reading time, linearly interpolated between the two points around it; *n/a* when the trace ends before.
4. **Calibration…** opens a window: *None* (the readings are absorbances), *Slope and intercept* typed in, or *Standards* (concentration, absorbance) fitted by least squares, the fit and its R² shown as they are typed; both ways are kept, the one chosen used, with the unit typed for the concentrations, c = (A − intercept) / slope. It is kept in the project.
5. **Results card.** The aligned traces overlaid, the reading time marked, and the readings: a point a trace included, in the trace list's order, as concentrations (in the unit typed) with a calibration, else as absorbances. Each plot's toolbar opens the figure composer.
6. **Export** `aligned.csv` (each trace's time from its injection and absorbance less its background) and `readings.csv` (each trace's file, wavelength, collection time, injection, background, reading time, reading and, calibrated, concentration).

### 7. Custom (plots of your own data)

New in v527 (named *Figure* to v530): figures of your own CSV and text files, from any instrument or spreadsheet, as a module of its own (live tabs, projects, undo and redo, the view kept, as the others).

**File format**: columns of text, under an optional header line and whatever title lines come before it. The separator (`;`, tab, `,` or spaces), the decimal mark (`.` or `,`), the quotes and the header are found from each file, as DRS and GC find theirs; a header's `Name (unit)`, `Name [unit]` or `Name / unit` gives the column's name and unit. A line of series' titles just over the header (`series 1,,,series 2,`: its first field a title, two titles at least, blanks between them, no number) gives each group of columns under a title its first roles, the group's first column the x and the others, up to the next title, its y (x y y x y), and the series their names: the title, with the column's name when the title is over several y (`series 1 – A`, `series 1 – B`, `series 2`).

**How to use**:

1. **Upload the files** (several at once). The project keeps each file's own bytes, read again as it opens. Each series (below) is a trace in the trace list (from v532; to v531 the list had a row a file), updated as the roles and the files change: named as the series (renamed under *Label* or in place in the Data card, one name in both), its colour the series' colour in the plots (from v534: picked by its swatch, or a palette given to all by the palette's button, as in the other modules; the colours are kept with the project and each change is an undo step), its CSV under File, its ↓ that file's bytes; its box leaves it out of the plots and of *Add series*, its grip orders the list (and the window's series), and × takes it out (its column, and its error's, set to *—*; a file's last series, the file). A file with no series has a row of its own, under its name, to remove it. A project saved before v532 opens with each file's series in the file's place, those of a file left out left out.
2. **Data card.** Laid out as the other modules' analysis cards: on the left the file shown, stepped through by its arrows with its number between them and its name on their right (as the samples elsewhere: a view, no undo step, no change unsaved), *Same roles for all files* at the right of that line, and under them the whole table (from v531; to v530 its first 5 rows) across the card (from v534), in a box as tall as a Plot card's chart, scrolled both ways inside it (at its end the wheel goes on to scroll the page), its head staying at the top: a line of the series' names, each over its columns (its x, its y and their errors; blank over a column of no series, or an x several series share), each a field where the name is typed over in place, then the roles, then the header. A role over each column: *x*, *y*, *err x*, *err y* or *—* (not used); by default x, y, y, y… (or as its titles say). As in Origin, a file may have several x: each y belongs to the x before it (none: its x is the row number), each err y to the y before it and each err x to the x before it, one error at most a column: a column set to err y where its y has one already takes its place, and the one it had becomes a y (an err x the same). The roles are each file's own; *Same roles for all files* gives those of the file shown to every file by the columns' places (a file's columns past the shown one's keep the defaults; a file with fewer columns is said).
3. **Series.** Each y is a series with its x and its errors, "Series M (Cols a,b)" in its name's tooltip in the Data card (M the y's place in the file, a its x's column and b its own), named as its title names it, else as the header names its column, else "Series M", typed over in place over its columns or under *Label* in the trace list (taken as the field is left or on Enter, Escape puts back the name it had; left empty, it goes back); the columns' units title the plots' axes. A series is its file and its column, not a number: as files are added, removed or moved and roles changed, the plots keep the series that still are and let the others go, and the numbers follow.
4. **Plots.** None at first: **+** under the Data card asks for the kind, *XY plot*, *Bar chart* or *Box plot*, and adds a card (Plot 1, 2…) to which the series of any files are added: **+ Add series**, at the foot of the column beside the plot (whose top is level with the plot's, as the parameters of the other modules' cards, and the button's bottom with the plot's bottom; the series between, scrolling in their box), opens a window of every included file's series, by file, those of the plot ticked; a file's box ticks or clears all its series and holds a small square when some of them are ticked. *Done* gives the plot the series ticked (those it had in their places, the new after them), *Cancel* (or Escape) nothing. Each plot has its **Normalization**, as the other modules: *none*, *local* (each series divided by its own largest |y|) or *global* (all divided by the largest of them); then each series is multiplied by its scale and, in an XY plot, its offset added: each series a row, its × and name on three fifths, its scale and offset (× and +) beside them on two. A name two of the plot's series share (two files' "Signal") is told apart by the file's label. The plot's legend names the series, each in its trace's colour; their rows have no swatch. A bar chart takes the series' x as categories (text, or numbers as they read) and its err y as the error bars, the series of a category side by side; a box plot takes each series as a group, its values down the rows, named as the series. The cards are renamed, folded, moved by their ≡ grip and closed by their ×, as the analysis cards.
5. **Figure.** Each plot's toolbar opens the figure composer on it; the figure composed is kept with its card in the project (the other modules' in the browser, by plot), and an undo step as the composer closes.
6. Export each plot's series, as plotted, as CSV.

From v529 (the user's corrections to v527): the Data card's file arrows and layout, the titles' line, the Add series window, one normalisation a plot in place of each series' own, and no crop in x (From, To). From v531 the module is named *Custom* wherever it shows (the home and New project cards, the tab, the window's title, its help); its projects and their files keep the key `fig`, so those saved before open as they were. A project saved by v527–v528 opens with each plot's normalisation *local* where every one of its series was normalised, else *none*, and its crops dropped. v529–v533 hid the traces' colours in the trace list (a plot gave its series their colours by their place in it); SEM's list, whose images have no colour, keeps that place empty so the names stand where the other modules' do.

From v534: the trace list's colour and palette pickers are back for Custom's series, and the plots draw each series in its trace's colour (a project of v529–v533 opens with each series in the palette's colour of its place among all the files' series); the Data card's list of the file's series, beside the table, is gone: the table spans the card and the series are named in place over their columns; the trace list's names column is headed *Label* again in every module; the boxes that scroll inside the page (the Data card's table, the lists) let the page scroll on at their end; every scrollbar follows the theme; Custom is the last module on the home page and in the New project chooser, whatever modules come.

Not yet: plots brought in from the other modules' projects; the error bars of an XY plot are not carried into the composer.

---

## Projects

Each tab holds one project. **Save project** keeps it in the browser (IndexedDB), and the **Projects** tab lists every saved one; the export button writes it to a `.datatreat` file, to keep or pass on. In the browser each file's bytes are stored once, by their content (SHA-256), whatever number of projects and tabs hold them, and a project or a tab keeps only that key: a save, an autosave or a tab switch writes a few kilobytes, with no pause of the page however large the files (eight 2048² SEM images: to v516 about 90 MB written at each change, the page frozen up to a second). The `.datatreat` file still holds the bytes, as before. After this update (v517) a DataTreat window left open on an older version must be reloaded: it can no longer open the browser's database (it reads and writes nothing until then; the data are safe).

A project is renamed in the list by its name field: Enter, or leaving the field, saves the name (the project's state stays as it is). From v526 a name being typed stays in its field, caret and focus too, when the list is drawn again meanwhile (as the Projects button is pressed, or as another row's rename is written): to v525 the field lost the focus and what was typed after, or the project was renamed half typed.

**Tabs** (v518). Every open tab is live: its module, plots, undo history and any job running in it (a refinement, the reading of SEM images) stay as they are while another tab is on show, so a switch only shows and hides, and a job goes on in a tab left. Any number of tabs can be open. At most 20 are awake at once, the one on show among them, and a tab hidden for 10 minutes goes to sleep (both in **Settings › Tabs in the background**); beyond the 20, the tab shown least recently goes to sleep first. A sleeping tab lets go of its module and keeps its state and its whole undo history; shown again, it wakes as it was, under the loader, in a fraction of a second. A tab whose job runs never sleeps: its 10 minutes start when the job ends. A sleeping SEM tab lets go of its images too, read back from the browser's storage when it wakes. A tab woken or reloaded shows what it showed (the sample, pattern or image on show, the plots' zoom, the instructions open, the lists' scroll, the peaks picked); changing these is no undo step and does not mark the project unsaved. From v528 what only changes what a chart shows — DRS's E<sub>g</sub> chips (x-axis / baseline) and E<sub>U</sub> chips (plain / subtracted), GC's H₂ / O₂ chips, XRPD's crystallite-size charts by sample or by peak — and a card folded or unfolded (in every module, the Custom module's Plot cards too) are an undo step but do not mark the project unsaved ("*"): they are kept with the tab (a reload shows them) and written into the project with its next save. From v530 no CSV follows them: an export has every option whichever a chart shows — GC's CSVs every gas the samples have (to v529 the gases the Results plots showed), each XRPD crystallite-size chart's CSV button both files, by sample and by peak (crystallite_size.csv and crystallite_size_by_peak.csv; rietveld_results.csv and rietveld_peaks.csv; to v529 the one on show), DRS's Eg.csv and Eu.csv both readings and both E<sub>U</sub>, as they had. A normalisation, a change, still decides what is exported. A card closed or moved, the figure composer's figure, a normalisation and anything an export or a result reads are changes, as before. What a tab has worked out (processing, fits, Rietveld curves) is kept, not computed again when it wakes. The Rietveld refinements of every tab share one pool of workers, at most the processor's cores less one. The app asks the browser to keep its storage for good (persistent storage); whether it does is the browser's choice. A window left open on v517 should be reloaded: it still reads the tabs and projects, but drops the views it does not know and may put a tab it writes elsewhere in the bar.

A `.datatreat` file is JSON: a header (the app, the file format's version, the DataTreat version that wrote it), the project with its files' original bytes (base64), and a signature, the SHA-256 of the project. **Import project** takes `.datatreat` files and the `.json` exports of v483 and earlier. A file whose name does not end in `.datatreat`, that has no signature, that a newer DataTreat wrote, or whose content changed after it was signed is imported only once you confirm. The signature tells a file DataTreat wrote and nobody changed from one that was edited, cut short or written by something else; it does not prove who wrote it, since anyone can compute it.

A project its module cannot read (damaged, or edited by hand) opens as an empty tab, with a warning; the saved project stays as it is unless you save over it.

---

## Data Export

All modules support CSV export. The exported CSV format respects your **Settings** choices:
- Decimal separator (`.` or `,`)
- Field separator (`;`, `,`, or `Tab`)

Click **Export CSV** in any module to download processed results. A value holding the field separator, a quote or a line break (a sample label with a comma, say) is written in quotes, its quotes doubled, as spreadsheets expect.

A trace unticked in the trace list (the box beside its name) stays loaded, with its settings, but is left out of the analysis, the results, the charts and the export until it is ticked again. An XRPD standard left out counts as no standard.

---

## Tests

`tests/` holds automated browser tests (Playwright, from Node's own test runner): every module loads its files with no error, nothing from a file or a project becomes markup, projects and their files come back byte for byte, the plots match their recorded hashes, CSVs parse, a Rietveld refinement runs and stops. `npm i` once, then `npm test`; [tests/README.md](tests/README.md) says what each file covers. `npm run lint` checks the app and the tests with ESLint (its settings in `eslint.config.mjs`): ESLint is no dependency, so it must be installed apart (ESLint 9 or later, e.g. `npm i -g eslint`). The app itself still needs no build and no dependency.

---

## Technical Notes

- **Client-side processing**: All calculations happen in your browser. No data is uploaded to any server.
- **Browser compatibility**: Works on modern browsers (Chrome, Firefox, Safari, Edge). JavaScript must be enabled.
- **File size limits**: Limited only by your browser's memory. For very large files, consider chunking data offline.
- **Modular architecture**: New analysis modules may be added in the future without breaking existing functionality.

---

## Troubleshooting

**Files not uploading?**
- Check the file format (CSV/TXT, XRDML, or Bruker BES3T pairs)
- Ensure files are in the same directory as the HTML file
- Check browser console for error messages (F12 → Console tab)

**Incorrect column detection in GC?**
- Column names are matched case-insensitively
- Ensure your CSV contains "injection date" and "h2"/"mol" in column headers

**EPR pair not completing?**
- Both `.DTA` and `.DSC` files must have the same stem name
- Check for spelling differences or extra characters in filenames

---

## License

See the repository for license information.
