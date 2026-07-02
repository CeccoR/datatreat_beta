# DataTreat

A browser-based scientific data analysis tool for spectroscopy and chromatography data. No installation or account required — all processing runs in your browser; no data is ever sent to any server.

## Getting Started

### Use Online

Open DataTreat directly in your browser — no download needed:

**[https://ceccor.github.io/datatreat/](https://ceccor.github.io/datatreat/)**

### Run Locally

If you prefer to run it offline, clone the repository:

```bash
git clone https://github.com/CeccoR/datatreat.git
cd datatreat
```

Then open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge). No server or build step required.

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
   - **m (g)**: Catalyst mass in grams
   - **Q (mL/min)**: Carrier gas flow rate
   - **Light-on date/time**: When irradiation started (determines when H₂ production begins)

3. Adjust the **time interval** (in hours from light-on) for rate calculation:
   - **Interval start** and **Interval end** define the window
   - White vertical lines on the plot mark these boundaries

4. Two interactive plots:
   - **H₂ Rate (mmol/h/g)**: Production rate over time
   - **Cumulative H₂ (mmol/g)**: Total accumulated H₂

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

---

## Data Export

All modules support CSV export. The exported CSV format respects your **Settings** choices:
- Decimal separator (`.` or `,`)
- Field separator (`;`, `,`, or `Tab`)

Click **Export CSV** in any module to download processed results.

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
