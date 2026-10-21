# DataTreat

A browser-based scientific data analysis tool for spectroscopy and chromatography data. No installation or account required — all processing runs in your browser; no data is ever sent to any server.

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

DataTreat is a modular application. New analysis modules may be added in the future. In every module the loaded files are listed with a **sample label** each, used in the plots, the legends and the exports: a label is taken when you leave its field (or press Enter), not while you type, and Escape puts back the one it had. Currently available modules are:

### 1. DRS UV-Vis (Tauc Plot Analysis)

Analyze diffuse reflectance spectroscopy (DRS) data in the UV-Visible range to assess light absorption and estimate semiconductor band gaps.

**Instrument compatibility**: Cary 5000  
**File format**: CSV or TXT with two columns: the wavelength in nm, and F(R) (the Kubelka-Munk function) or the reflectance in percent. The standard format is the Cary 5000's own export: the sample's name on the first line, the header `Wavelength (nm)` and `%R` or `F(R)` on the second (any separator, decimal mark, case or quotes), the data from the third; it loads with no alert, and %R is converted to F(R) = (1 − R)²/2R. Any other file loads with a warning saying how it was read: by its header when it names the reflectance (`R%`, `R (%)`, `Reflectance (%)`, or `%R` elsewhere than on the second line) or F(R), else as F(R). The file list says how each file's second column was read, `%R` or `F(R)`, in a column with no header right of its label (hover it for the whole). Points with no physical value (R outside 0–100 % or of 0, F(R) below 0, a value that is no number) are left out, and the alert says how many and why. The field separator (`;`, `,`, a tab or spaces) and the decimal mark (`.` or `,`) are found in each file; fields may be in quotes; the text may be UTF-8 or UTF-16, with or without its byte-order mark.

**How to use**:

1. Upload your CSV/TXT files via drag-and-drop or click to select.
2. For each spectrum, adjust:
   - **Tauc exponent**: 0.5 (indirect semiconductors) or 2 (direct semiconductors)
   - **[F(R)hν]^a smoothing window**: smoothing parameter for the absorption function
   - **Derivative smoothing window**: smoothing for the first derivative (helps identify inflection points)
   - **Tauc linear region regression window**: number of points for linear fit
   - **Baseline regression window**: number of points for baseline fit

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

1. Upload your XRDML/XML files (the samples). A file with several scans gives one pattern per scan, named “file (scan k)”, which share the file's bytes (kept once in the project); in the standard's window only its first scan is used. Points whose intensity, counting time or attenuation factor is not a number are left out, with a note saying how many; a file left with fewer than two points is refused. A file that cannot be read is named in an alert, and the others load.
2. The analyses are cards, as in DRS: a **Scherrer** card (peak search, FWHM and the Scherrer crystallite size, with the stacked patterns and the sizes in the Results) and a **Rietveld** card. **+** under them adds another of either kind; each card can be renamed, turned into the other kind, folded, moved by its ≡ grip and closed. Every card shows the same sample: its arrows (or ← / →) step them all.
3. **Instrumental standard…** (in either kind of card) opens the standard's window: it is a file of its own, not a sample. Drop its measurement there (one file: a new one replaces it; its whole name is shown under the drop zone, and the window's head, with its ×, stays at the top while the rest scrolls). In a Scherrer card's window it is analysed as the samples are, and its peaks' Caglioti fit corrects every sample's size for the instrument's width; in a Rietveld card's, it is refined, and its profile is the samples' instrument.
4. Scherrer card: **Normalization** (global, local or none — the data as they are — for the stacked Results), smoothing, baseline (its box unticked: no baseline subtracted, the pattern read from zero) and peak search, K and λ, each shared by all samples or set per sample (**all / one**); **+ Add peak** places a peak by hand.

**Rietveld refinement** (the *Rietveld* card):

1. Add each phase from a CIF: drop CIF files on **Phases**, beside the pattern, or click there (a drop zone while there is no phase, then **+ CIF** at the list's foot; several at once). The list gives each phase's formula and space group, found from the atoms for a file in P1. Files in P1, such as Materials Project's, have their symmetry found from the atoms, so a cubic cell is refined by *a* alone. Each phase is ticked for every pattern at first; untick it on a pattern to leave it out of that pattern's refinement. A click on a phase shows its unit cell in 3D (drag to turn it, double click to reset) with its details.
2. Refine the instrumental standard in its window (**Instrumental standard…**) against the built-in LaB₆ (NIST SRM 660c) or a CIF of the standard's: it gives the instrument's zero and peak shape, axial-divergence asymmetry included.
3. **Refine all** refines every sample: cell, specimen displacement, crystallite size and microstrain (above the instrument's broadening), weight fractions with several phases, with R<sub>wp</sub>, R<sub>exp</sub>, χ² and the standard errors, shown across the card under the pattern, with what the result was refined with by its title and every warning at its foot. A phase with no significant intensity of its own is reported *not detected* and left out; the same CIF added twice gives two size populations of one phase. **Settings…** (under the pattern's side column; read only while a refinement runs) decides what Refine refines: per phase, each model below switched on or off and its depth, the size and the strain included; and where it starts, from the CIF or from each pattern's last result with chosen groups of parameters held there (fit the shape, hold it, then refine B per site from there). The standard's window has its own. **Clear all** clears every pattern's result.
   - With no refined standard, **Refine** and **Refine all** first ask, in a window at the centre of the screen: refine the standard first (with its window's Settings, then the samples with its profile), refine without the standard, or cancel; with no standard loaded, *Load a standard…* opens its window. While samples refine the standard cannot be refined, and while the standard refines the samples cannot, so a batch always has one instrumental profile. The standard's refinement goes on with its window closed: every card's **Instrumental standard…** button then shows a spinner and the run's progress until it ends. The standard's **Settings…** offer only what applies to a standard (its displacement parameters, its texture, where it starts, its Refinement).
   - A refinement belongs to its project: leaving its tab (another tab, a new one) or closing it asks whether to stop it, and undo waits for it to end. A stopped run keeps the patterns already done.
4. **Size profile, strain and faults** (per phase, with a refined standard): the size as a Lorentzian of the right breadth (Scherrer's K = 0.9), or by **WPPM** (Whole Powder Pattern Modelling: each line the Fourier transform of the instrument's, the crystallites', the strain's and the faults' coefficients, so the sizes are the true ones), with one size or a **log-normal distribution** of sizes (volume-weighted mean, median, number mean and σ); the microstrain isotropic or **anisotropic** (Stephens: ε² a quartic form of the direction that the Laue group leaves unchanged); **planar faults** (after Warren: stacking faults, antiphase boundaries, Ruddlesden–Popper faults), their probability per plane refined.
5. **Displacement parameters and site occupancy** (per phase): the CIF's B, one ΔB, one B per crystallographic site, or the anisotropic U<sup>ij</sup> per site within its symmetry (with B<sub>eq</sub>); and the occupancy of one of the phase's sites, refined — a site that has lost atoms, as the Sr site of a Sr-poor SrTiO₃, scatters less at every angle alike.
6. **Preferred orientation** (per phase): March–Dollase along a chosen (hkl), or the best of the low-index planes.
7. **Crystallite shape** (per phase): the isotropic size, or a free solid — ellipsoid, spheroid, cylinder, elliptic cylinder, box or square-based box — in any orientation, each reflection of a family with its own width (the solid's column length along it), from several starting shapes. It is kept only when the data support it against an isotropic size (ΔBIC under −10), and reports the solid's dimensions with their esds and its axes' lattice directions with their angular esds (those of the χ² valley the fit ends in), drawn as a rotatable 3D solid with the crystal's directions, their uncertainty cones and the cell's a, b, c.
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

**How to use**:

1. Upload your CSV files. The app auto-detects the injection date and the H₂ and O₂ columns (case-insensitive). An empty H₂ or O₂ cell leaves that injection out of that gas only (its rate, its cumulative production and its mean are computed from the injections that have a value), and an alert under the drop zone says, per file, how many empty cells were skipped.
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

2. Adjust:
   - **Normalization**:
     - *Global*: All spectra divided by the largest peak-to-peak
     - *Local*: Each spectrum divided by its own peak-to-peak
     - *None*: The spectra as they are (the stacking only spaces them)
   - **Smoothing points**: Moving-average window size

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

1. **Upload the `.tif` files.** Each is read with its pixel size, magnification, field of view, beam (kV, working distance) and detector (gain, offset), off the page's main thread, so the page stays responsive while they load. The info bar under the image is left out by the height the file gives for it. An image whose pixels are not square (a pixel size in X other than in Y) is brought to square pixels of the finer size, the coarser axis interpolated, so that crops, groups, scale bars and figures measure alike in both directions; its details give the size as acquired. A file of another kind, or a damaged one, is not loaded, and the list under the drop zone says why.
2. **Groups and scale.** The images are grouped by pixel size (within 10 %), each group named by its magnification; rename a group by clicking its name, or drag an image onto another group or onto *+ Group* (on a phone, hold it a moment first); *+ Group* clicked adds an empty group (kept while it is empty, until its *Remove*; once filled it goes, as the others, when its images are removed from the list), and *Reset* makes the groups again. Only the images ticked in the file list name, order and fill the groups; an image left out keeps its group and comes back to it. At *common scale* (the default) a group's images are brought to its largest pixel size (reduced by averaging, never enlarged) and to its smallest field of view, so that one scale bar serves the group; at *own scale* each keeps its pixels and gets its own bar.
3. **Crop and intensity.** One image at a time, with the histogram of its crop under it, beside the thumbnails of all the images and the image's details. Each image starts whole. With *Default* ticked the crop is the whole image, its fields locked; drag the frame's handles or sides to resize it, inside it to move it; the view stays fitted unless a tool of the toolbar over it is on (pan, zoom area; fit). The fields give the crop in pixels, with its size in µm. A ratio (1:1, 4:3, 3:2 or free) holds while resizing.
4. **Several images.** Images linked by the chain on their thumbnails share one crop (*Link all* links the images chosen); unlinked, an image keeps the crop it had. A crop larger than an image is narrowed to fit it, and the image is marked.
5. **Intensity.** A normalisation for all images: none, each image stretched between two percentiles of its own levels, or the mean and SD, or the whole histogram, of a reference image (one of them). Then contrast, brightness and gamma, with each image's own correction on top. The selector over the thumbnails applies them to all images alike, or to one group at a time (each group starting from All's settings; back to All, All takes the group's on show). Each set of settings has a *Default* box that locks it at its defaults. The statistics are the crop's, with saturated pixels left out.
6. **Figure.** Each group has its own *Figure composer* button and figure, made in the plots' composer (one composer open at a time): a page in millimetres, the most compact grid (4 × 3 for 12 images), or blocks of panels set by hand (2 × 1 blocks of 2 × 2 panels), with a gap between panels and another between blocks; panels in the file list's order, reordered by the handles of the image list; each with its sample's name (placed automatically where there is room, or by hand; horizontal or vertical), letters (a), (b)… if wanted (before the name, or in any of 8 places), and scale bars (one per group at common scale, or one per image; 8 places), their length a round value or any value typed; the page's size free, with auto margins or a plot set by hand. PNG at the chosen dpi (a page too large for a PNG in the browser says so, with the largest dpi it can make), or SVG with the images in it.
7. Export the images' metadata, crops, intensity settings and groups as CSV. The project keeps each file's own bytes; the images themselves are never changed.

---

## Projects

Each tab holds one project. **Save project** keeps it in the browser (IndexedDB), and the **Projects** tab lists every saved one; the export button writes it to a `.datatreat` file, to keep or pass on.

A `.datatreat` file is JSON: a header (the app, the file format's version, the DataTreat version that wrote it), the project with its files' original bytes (base64), and a signature, the SHA-256 of the project. **Import project** takes `.datatreat` files and the `.json` exports of v483 and earlier. A file whose name does not end in `.datatreat`, that has no signature, that a newer DataTreat wrote, or whose content changed after it was signed is imported only once you confirm. The signature tells a file DataTreat wrote and nobody changed from one that was edited, cut short or written by something else; it does not prove who wrote it, since anyone can compute it.

A project its module cannot read (damaged, or edited by hand) opens as an empty tab, with a warning; the saved project stays as it is unless you save over it.

---

## Data Export

All modules support CSV export. The exported CSV format respects your **Settings** choices:
- Decimal separator (`.` or `,`)
- Field separator (`;`, `,`, or `Tab`)

Click **Export CSV** in any module to download processed results. A value holding the field separator, a quote or a line break (a sample label with a comma, say) is written in quotes, its quotes doubled, as spreadsheets expect.

A file unticked in the file list (the box beside its name) stays loaded, with its settings, but is left out of the analysis, the results, the charts and the export until it is ticked again. An XRPD standard left out counts as no standard.

---

## Tests

`tests/` holds automated browser tests (Playwright, from Node's own test runner): every module loads its files with no error, nothing from a file or a project becomes markup, projects and their files come back byte for byte, the plots match their recorded hashes, CSVs parse, a Rietveld refinement runs and stops. `npm i` once, then `npm test`; [tests/README.md](tests/README.md) says what each file covers. The app itself still needs no build and no dependency.

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
