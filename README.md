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

DataTreat is a modular application. New analysis modules may be added in the future. Currently available modules are:

### 1. DRS UV-Vis (Tauc Plot Analysis)

Analyze diffuse reflectance spectroscopy (DRS) data in the UV-Visible range to assess light absorption and estimate semiconductor band gaps.

**Instrument compatibility**: Cary 5000  
**File format**: CSV or TXT with two columns (wavelength in nm, Kubelka-Munk absorbance F(R))

**How to use**:

1. Upload your CSV/TXT files via drag-and-drop or click to select.
2. For each spectrum, adjust:
   - **Tauc exponent**: 0.5 (indirect semiconductors) or 2 (direct semiconductors)
   - **[F(R)hν]^a smoothing window**: smoothing parameter for the absorption function
   - **Derivative smoothing window**: smoothing for the first derivative (helps identify inflection points)
   - **Tauc linear region regression window**: number of points for linear fit
   - **Baseline regression window**: number of points for baseline fit

3. **Interactive plot**: Drag the vertical red line (Tauc region) and magenta line (baseline) to adjust the linear fit regions.
4. Results show:
   - **Eg (x-axis)**: Band gap from intersection with x-axis
   - **Eg (baseline)**: Band gap from intersection with baseline
   - **RMSE & R²** for both regressions

5. Export processed data as CSV using the **Export CSV** button.

---

### 2. XRPD (X-Ray Powder Diffraction)

Compare, smooth, and normalize X-ray powder diffractograms.

**Instrument compatibility**: PANalytical XPERT diffractometer  
**File format**: PANalytical XML format (`.xrdml`, `.xml`)

**How to use**:

1. Upload your XRDML/XML files.
2. Adjust:
   - **Normalization**:
     - *Global*: All spectra normalized to the global maximum across all samples
     - *Local*: Each spectrum normalized to its own maximum
   - **Smoothing window**: Number of points for moving-average smoothing

3. Interactive plot shows all diffractograms overlaid with your chosen normalization.
4. Export processed data as CSV.

**Rietveld refinement** (the *Rietveld* card):

1. Add each phase from a CIF (**+ CIF**). Files in P1, such as Materials Project's, have their symmetry found from the atoms, so a cubic cell is refined by *a* alone.
2. Choose the instrumental standard (LaB₆, NIST SRM 660c, is built in): its refinement gives the instrument's zero and peak shape, axial-divergence asymmetry included.
3. **Refine all** refines the standard first, then every sample: cell, specimen displacement, crystallite size and microstrain (above the instrument's broadening), weight fractions with several phases, with R<sub>wp</sub>, R<sub>exp</sub>, χ² and the standard errors. A phase with no significant intensity of its own is reported *not detected* and left out; the same CIF added twice gives two size populations of one phase. **Settings…** (beside Refine) decides what Refine refines: per phase, and for the standard's LaB₆ (its B and texture), each model below switched on or off and its depth, the size and the strain included; and where it starts, from the CIF or from each pattern's last result with chosen groups of parameters held there (fit the shape, hold it, then refine B per site from there). **Clear all** clears every pattern's result.
4. **Size profile, strain and faults** (per phase, with a refined standard): the size as a Lorentzian of the right breadth (Scherrer's K = 0.9), or by **WPPM** (Whole Powder Pattern Modelling: each line the Fourier transform of the instrument's, the crystallites', the strain's and the faults' coefficients, so the sizes are the true ones), with one size or a **log-normal distribution** of sizes (volume-weighted mean, median, number mean and σ); the microstrain isotropic or **anisotropic** (Stephens: ε² a quartic form of the direction that the Laue group leaves unchanged); **planar faults** (after Warren: stacking faults, antiphase boundaries, Ruddlesden–Popper faults), their probability per plane refined.
5. **Displacement parameters and site occupancy** (per phase): the CIF's B, one ΔB, one B per crystallographic site, or the anisotropic U<sup>ij</sup> per site within its symmetry (with B<sub>eq</sub>); and the occupancy of one of the phase's sites, refined — a site that has lost atoms, as the Sr site of a Sr-poor SrTiO₃, scatters less at every angle alike.
6. **Preferred orientation** (per phase): March–Dollase along a chosen (hkl), or the best of the low-index planes.
7. **Crystallite shape** (per phase): the isotropic size, or a free solid — ellipsoid, spheroid, cylinder, elliptic cylinder, box or square-based box — in any orientation, each reflection of a family with its own width (the solid's column length along it), from several starting shapes. It is kept only when the data support it against an isotropic size (ΔBIC under −10), and reports the solid's dimensions with their esds and its axes' lattice directions with their angular esds (those of the χ² valley the fit ends in), drawn as a rotatable 3D solid with the crystal's directions, their uncertainty cones and the cell's a, b, c.
8. **Peak widths**: each reflection fitted alone and corrected for the instrument, in a table like the Analysis card's, with a Williamson–Hall plot and the tests that tell an anisotropic broadening (shape), a strain and faults apart (Williamson–Hall χ², ratios of successive orders, the models' predicted widths).

How it all works, in detail (the model, the solver, the strategy, the broadening, displacement, occupancy, texture and shape models, the tests, the evidence behind each choice and the limits): [RIETVELD.md](RIETVELD.md). A critical review of all this code (the errors fixed in v425, the imprecisions it found and how v426 resolved each, and the catalogue of every chosen number, each tested on synthetic data in v427): [RIETVELD-REVIEW.md](RIETVELD-REVIEW.md).

---

### 3. GC (Gas Chromatography)

Assess H₂ production rates from gas chromatography data, including light-on time and time-interval analysis.

**Instrument compatibility**: Agilent Gas Chromatographer  
**File format**: CSV with columns:
  - "Injection date" (datetime)
  - "H2 (B) (%Mol)" or similar (hydrogen mole percentage)

**How to use**:

1. Upload your CSV files. The app auto-detects injection date and H₂ columns (case-insensitive).
2. Set parameters for each sample:
   - **m (mg)**: Catalyst mass in milligrams
   - **Q (mL/min)**: Carrier gas flow rate
   - **Light-on date/time**: When irradiation started (determines when H₂ production begins)

3. Adjust the **time interval** (in hours from light-on) for rate calculation:
   - **Interval start** and **Interval end** define the window
   - White vertical lines on the plot mark these boundaries

4. Two interactive plots:
   - **H₂ Rate (mmol/h/g)**: Production rate over time
   - **Cumulative H₂ (mmol/g)**: H₂ accumulated from the start of the interval

5. View results in a **bar chart** (mean production rate per sample) and a **summary table**.
6. Export all data as CSV.

⚠️ **Note**: Light-on time must be **after the first injection** in your data. If it's earlier, an orange warning appears.

---

### 4. EPR (Electron Paramagnetic Resonance)

Compare, smooth, and normalize EPR spectra from Bruker instruments. Includes paired-file validation and interactive pending-file management.

**Instrument compatibility**: Bruker EPR spectrometers (BES3T format)  
**File format**: Paired `.DTA` (binary signal data) and `.DSC` (text parameters) files

**How to use**:

1. **Upload paired files**: Both `.DTA` and `.DSC` files are required for each sample.
   - Files are matched by their stem name (e.g., `sample.DTA` and `sample.DSC`)
   - You can upload files in separate batches — the app waits for the pair to complete
   - If you attempt to re-upload a file whose pair is already loaded, you'll see a yellow warning

2. **Pending files table**: While waiting for a pair, an interactive table shows which files are pending:
   - ✓ Green checkmark = file present
   - ✗ Red X = file missing
   - Click **✕** to remove an unpaired file from the queue

3. Adjust:
   - **Normalization**:
     - *Global*: All spectra normalized to the global maximum
     - *Local*: Each spectrum normalized to its own maximum
   - **Smoothing points**: Moving-average window size

4. Interactive plot overlays all spectra with your chosen normalization.
5. Export processed data as CSV.

**File format details**:  
The app natively reads Bruker BES3T files:
- `.DSC` contains parameters: `XPTS` (data points), `XMIN`/`XWID` (field range in Gauss), `MWFQ` (microwave frequency in Hz), `BSEQ` (byte order)
- `.DTA` contains binary float64 signal values
- B-field axis is reconstructed and corrected for microwave frequency

### 5. SEM (Scanning Electron Microscopy)

Tescan SEM images, read with their metadata, cropped, brought to comparable grey levels and grouped by scale (more in [SEM.md](SEM.md)).

**Instrument compatibility**: Tescan (the TIFF files the Tescan software saves)  
**File format**: grey TIFF, 8 or 16 bits, uncompressed, with Tescan's own metadata inside it (the `.hdr` beside it is not needed)

**How to use**:

1. **Upload the `.tif` files.** Each is read with its pixel size, magnification, field of view, beam (kV, working distance) and detector (gain, offset). The info bar under the image is left out by the height the file gives for it. A file of another kind is not loaded, and the list under the drop zone says why.
2. **Crop.** Each image starts whole. Drag the frame's handles or sides to resize it, inside it to move it, outside to pan; the wheel zooms. The fields give the crop in pixels, with its size in µm. A ratio (1:1, 4:3, 3:2 or free) holds while resizing.
3. **Several images.** *Copy to…* gives other images the current crop; *Linked* images share one crop. A crop larger than an image is narrowed to fit it, and the image is marked.
4. **Intensity.** A normalisation for all images: none, each image stretched between two percentiles of its own levels, or the mean and SD, or the whole histogram, of a reference image (one of them, or one loaded only for this and kept out of the figure). Then contrast, brightness and gamma, for all images, with each image's own correction on top. The statistics are the crop's, with saturated pixels left out.
5. **Groups and scale.** The images are grouped by pixel size (within 10 %), each group named by its magnification; rename groups, move images between them or into new ones. At *common scale* (the default) a group's images are brought to its largest pixel size (reduced by averaging, never enlarged) and to its smallest field of view, so that one scale bar serves the group; at *own scale* each keeps its pixels and gets its own bar.
6. Export the images' metadata, crops, intensity settings and groups as CSV. The project keeps each file's own bytes; the images themselves are never changed.

---

## Data Export

All modules support CSV export. The exported CSV format respects your **Settings** choices:
- Decimal separator (`.` or `,`)
- Field separator (`;`, `,`, or `Tab`)

Click **Export CSV** in any module to download processed results.

A file unticked in the file list (the box beside its name) stays loaded, with its settings, but is left out of the analysis, the results, the charts and the export until it is ticked again. An XRPD standard left out counts as no standard.

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
