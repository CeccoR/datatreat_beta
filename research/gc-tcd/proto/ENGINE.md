# GC-TCD peak integration engine: port notes and validation

This is a prototype, and nothing in the live app changes. `engine.patch` (next to this file) adds
five new files and touches no existing app file:

| File | What it is |
|---|---|
| `gc-tcd.js` | The engine: a pure ES module, with no import and no DOM. It runs in Node, in the page and in a worker. |
| `gc-tcd.worker.js` | A module worker: one chromatogram per message. |
| `gc-tcd-pool.js` | Spreads many chromatograms over `hardwareConcurrency − 1` workers, with progress and an `AbortSignal`. |
| `tests/gctcd-engine.test.mjs` | Node tests on synthetic data only (11 tests, about 2 s). |
| `tests/README.md` | One row for the new test. |

To apply it: `git apply research/gc-tcd/proto/engine.patch`, then run
`node --test tests/gctcd-engine.test.mjs`. The patch is made against `fdb7de0`, the branch tip
when the work began.

## 1. What was ported, and what was dropped

The engine is a port, **as it is**, of the H2/O2 part of `reintegra_tcd.py` v2.1 (which carries
the model of `forma_universale.py`). The model and the algorithm were not simplified or optimised.

**Kept, one to one**

- **Peak shape (8 parameters).** Two equal Gaussians, the second shifted by `dmu` and weighted
  `fc`, convolved with two exponential tails (`tau1`, and `tau2` with weight `w2`).
  - Each component has area 1, so `A` is the peak area.
  - The internal parametrisation is unchanged: ln σ, dmu/σ, fc, ln(τ1/σ), ln((τ2−τ1)/σ), w2.
  - The weak priors, limits and start values are unchanged (`SHAPE`).
  - So is the stable EMG with its two branches (`erfcx` where z ≥ 0, `erfc` otherwise).
- **Window model.** Each window fits:
  - its peaks;
  - a polynomial in t − mean(t) (degree 1);
  - sigmoid baseline steps, with bounds [from, to] on the position and [0.15, 3] s on the width.
    The step's prior is (h −13 ± 3, t0 305.6 ± 0.6, ln width ln 0.8 ± 0.5).
  - mu is bounded to the local maximum ± `larghezza_mu` (1.5 s). The start is the maximum within
    ± 1.5 s of the nominal time, when it rises more than 5 × the noise above the median of the
    first 10 points.
- **Noise.** 1.4826 × MAD of the first differences / √2, taken over the window. Spikes are found
  with the un-floored noise; the noise is then floored at 1e-6.
- **Spikes (`trova_spike`).** Thresholds 10 × noise and 25 % of the neighbours' signal, and larger
  than the local slope. One point per round is replaced by its neighbours' mean: 6 rounds in the
  fit, 3 in the trapezoids.
- **Two-pass fit (`fit_picchi`).**
  1. A robust soft-L1 pass (f_scale 3, max_nfev 100) finds the narrow glitches. A glitch is a
     group of residuals larger than 25 × noise and 25 % of the local signal, with gaps of at
     most 3 points, at most 1.4 s wide, and larger than half the peaks' signal within ± 1 s.
     Each glitch is excluded with ± 0.6 s around it.
  2. An ordinary least-squares pass (max_nfev 2000) starts from the robust solution.
  3. **Restart rule.** When χ²_r > 4, or the step is more than 3 sd from its prior, the fit is
     redone from the generic start and the lower cost is kept.
- **Jacobian.** Block-wise, as in the Python: finite differences on each peak's own shape
  (h = 1e-6·max(1, |q|), turned negative at an upper bound). The steps, the polynomial and the
  priors are analytic.
- **Uncertainty.** sd(A) = sqrt(diag pinv(JᵀJ)) at the solution (numpy's rcond of 1e-15).
- **Apex time.** The argmax of the unit-area shape on numpy's `arange(t0, t_end, 0.02)`.
- **Trapezoids (`trapezi_classici`).**
  - The base line runs between two points: the mean (t, y) of an interval, or the minimum of a
    5-point moving average (the "valley").
  - Spikes are replaced by their neighbours' mean over [left − 2, right + 2].
  - The fit's glitches are linearly interpolated over, as `np.interp` does.
  - The area is the trapezoid sum above the line.
- **Edge cases.** A window whose end is past the column's last finite point gives NaN, as
  `_integra_colonna` does. Non-finite points are dropped first.
- **Software factor (`esegui`).** k = median(area/table) over the injections with a table value of
  at least 0.02 %mol (H2) or 0.012 %mol (O2), when there are at least 10.

**Dropped, as asked**

- N2 and its window;
- X655, S264, S340;
- the kinetic model, tau, the deconvolution, the autotest and the figures;
- file-name parsing, and `trova_ordine` (the app takes the columns in table-row order);
- `FormaUniversale` (the median shapes, used only for figures and N2);
- in `analizza_calibrazioni`, the removal of duplicate columns and the dynamic-programming
  alignment of columns to table rows. In the app, the user types the levels.
- the `fissi` option of `forma_universale._fit`, which v2.1's own `_fit` does not have.

## 2. API, as implemented (`gc-tcd.js`)

### `DEFAULT_METHOD`

Deep-frozen; make variants from `structuredClone(DEFAULT_METHOD)`.

```js
{ windows: [{ key: 'H2O2', from: 268, to: 326, baseDegree: 1,
    peaks: [{ name: 'H2', t: 287.3, gas: 'h2' }, { name: 'O2', t: 302.3, gas: 'o2' }, { name: 'S310', t: 310.2, gas: null }],
    steps: [{ from: 303, to: 309, prior: { h: -13, hSd: 3, t0: 305.6, t0Sd: 0.6 } }] }],
  trapezoid: { h2: { left: [281, 283.6], right: [295, 300.5], valley: 'right' },
               o2: { left: [295, 300.5], right: [304.8, 305.6] } },
  transfer: { h2: { minValue: 0.02, minCount: 10 }, o2: { minValue: 0.012, minCount: 10 } },
  fit: { shiftAllowance: 1.5, priorWeight: 1.0, apexSearch: 1.5, apexSnr: 5, maskGlitches: true,
         robustLoss: 'soft_l1', robustFScale: 3.0, maxNfev: 2000, maxNfevRobust: 100,
         glitch: { noiseTimes: 25, localFraction: 0.25, groupGap: 3, maxWidth: 1.4, near: 1.0, nearFraction: 0.5, pad: 0.6 },
         restart: { chi2r: 4.0, stepSds: 3 },
         spikes: { threshold: 10, fraction: 0.25, roundsFit: 6, roundsTrapezoid: 3 },
         step: { width: 0.8, widthMin: 0.15, widthMax: 3.0, widthLogSd: 0.5 },
         apexGrid: 0.02 } }
```

Another window (N2, say) is one more entry in `windows`, with its own peaks, steps (with or
without a prior) and `baseDegree`. In each gas's trapezoid, the glitches excluded are those of
the window that holds that gas's peak.

### `readTcd(text) → { t, cols } | { error }`

- **Format.** `;`-separated with a decimal comma, with or without a trailing `;`, and CRLF or LF
  line ends. `,`- or tab-separated files with `.` decimals are read too. A BOM and header lines
  are skipped.
- **Columns.** `cols[j][i]` is NaN where a cell is blank: a column that ends early keeps its finite
  points. Columns blank throughout are dropped, as pandas' `dropna(how='all')` does.
- **Refusal.** A time axis that does not increase is refused, as v2.1's `leggi_tcd` does (see §8).

### `integrateChromatogram(t, y, method = DEFAULT_METHOD)`

Returns a compact, JSON-serialisable result (about 2 to 3 kB):

```js
{ gases: { h2: { area, sd, tApex, chi2r, trap, window }, o2: {…} },
  windows: [{ key, p: [29 numbers], noise, chi2r, rms, cost, nfev, nfevTotal, ok, tc,
              spikes: [times], excluded: [[a, b]], restarted, restartWon,
              peaks: [{ name, gas, area, sd, tApex, params: { A, mu, sigma, dmu, fc, tau1, tau2, w2 } }],
              steps: [{ h, t0, width }] }] }
```

- `nfev` is the final fit's, as in the Python; `nfevTotal` counts every pass.
- `tc` is the polynomial's centre.
- A window past the data's end has `p: null`, `beyondData: true` and NaN values.
- A fit that throws gives NaN plus `error`, and the other windows go on.
- JSON writes NaN as `null`: read `null` back as NaN, never as 0.

### `windowCurves(t, y, method, windowResult)`

Returns `{ t, y, model, base, peaks: { H2, O2, S310 }, residual, dropped: { t, y, kind } }`:

- The curves are recomputed from the stored `p` on the points the fit used.
- Spikes and excluded points are taken out exactly as the fit did, and listed in `dropped` with
  `kind` 'spike' or 'excluded'.
- `base` holds the polynomial plus the steps.

### `fitCalibration(points, { zeroIntercept })`

Returns `{ slope, intercept, r2, n, residuals: [{ conc, area, fitted, relDev }] }`:

- An ordinary least-squares line, or one through the origin.
- `r2 = 1 − SSres/SStot`, with SStot about the mean area in both cases, so the two R² are
  comparable. Through the origin it can be negative.
- `relDev = (area − fitted)/fitted`.

### `transferK(areas, tableValues, { minValue, minCount })`

Returns `{ k, n }` or `null`.

### Helpers, also exported

- `erf`, `erfc`, `erfcx`, `emg`, `peakShape`, `physical`, `step`;
- `findSpikes`, `fitOnce` (Python's `_fit`), `fitPeaks` (`fit_picchi`), `trapezoid`;
- `leastSquaresTrf(fun, jac, x0, lb, ub, { xScale, loss, fScale, maxNfev, ftol, xtol, gtol })`;
- `median`, `npSum`, `npMean`, and `SHAPE`.

### Pool (`gc-tcd-pool.js`)

`integrateMany(t, cols, { method, workers, onProgress(done, total, k, res), signal, makeWorker })`
returns `{ results, ms, wall }`:

- The results come back in column order.
- A failed worker gives that chromatogram `{ error }`, and a fresh worker carries on.
- An abort terminates every worker and rejects with an `AbortError`.
- `makeWorker` lets Node, or a test, supply a Worker-like object (worker_threads in the test).
- The workers are module workers of the app's own origin, as in `xrd-rv-pool.js`
  (`new Worker(new URL('./gc-tcd.worker.js', import.meta.url), { type: 'module' })`), so the
  CSP `script-src 'self'` is respected.

## 3. The solver, and the deviations from scipy/numpy

`leastSquaresTrf` ports `scipy.optimize.least_squares(method='trf', tr_solver='exact')` from the
installed scipy 1.18.1, one function at a time:

- `trf_bounds`, `select_step` (the trust-region step, the reflected step, the Cauchy step), and
  `solve_lsq_trust_region` (Moré's algorithm on one SVD);
- `CL_scaling_vector`, `update_tr_radius`, `check_termination`;
- `make_strictly_feasible`: rstep 1e-10 at the start, `nextafter` after each step;
- `step_size_to_bound`, `intersect_trust_region`;
- `build_quadratic_1d`, `minimize_quadratic_1d`, `evaluate_quadratic`;
- `x_scale` as an array: the Python's (max(|A₀|, 10σ), 0.1, 0.3, 0.3, 0.1, 0.3, 0.5, 0.03) per
  peak, (5σ, 0.3, 0.3) per step, (10σ, σ/10) for the polynomial. As in the Python, the first
  peak's start area is used for every peak.
- the `linear` and `soft_l1` losses with scipy's scaling (`scale_for_robust_loss_function`);
- scipy's defaults: ftol = xtol = gtol = 1e-8.

On the three toy problems in the test, the same x, cost, nfev and status come out as from
scipy (9, 26 and 11 evaluations).

**Deviations, all at the rounding level:**

| What | scipy / numpy | Here | Effect |
|---|---|---|---|
| SVD of the augmented Jacobian | LAPACK `gesdd` | Householder QR, then one-sided Jacobi on R. Only Uᵀf is needed. | Same s, V and Uᵀf to rounding |
| `pinv(JᵀJ)` | LAPACK SVD | Cyclic Jacobi eigen-decomposition of JᵀJ, \|λ\| ≤ 1e-15·max dropped | sd(A) agrees to 1e-9 (median) |
| Dot products, Jᵀf | BLAS (summation order unknown) | Sequential sums | Rounding only |
| `erfc`, `erfcx` | cephes / Faddeeva | W. J. Cody's CALERF (rational Chebyshev) | See below |
| `np.sum`, `np.mean` | Pairwise summation | **The same pairwise algorithm**, checked bit for bit on 9,400 random arrays | Needed where the order decides: see below |
| `np.arange(t0, t1, 0.02)` | start + i·((start + step) − start) | The same | Same apex grid |
| `exp`, `log` | glibc | V8 | 1 ulp at most |

**Why the pairwise sums matter.** The mean time of a trapezoid's base interval lands on a grid
point (282.3, 297.7 and 305.2 s). One ulp more or less then takes that point in or out of the
integration. With numpy's pairwise order, all 411 trapezoid areas came out bit-identical.

**erfc and erfcx against scipy** (17,000 points over −30 to 10⁸):

| Range | Max relative error | Median | Notes |
|---|---|---|---|
| `erfcx(x ≥ 0)` | 8.9e-16 | 1.2e-16 | The branch the model uses |
| `erfc(x < 0)` | 2.0e-16 | | The model's other branch |
| `erfc(x > 4)` | ≤ 6e-14 | | The relative error of exp(−x²) at x up to ~23; inherent |
| `erfcx(x < 0)` | ≤ 6e-14 | | Same cause |

**Robust loss.** The task said the soft-L1 loss applies to the data residuals only, which is what
the Python's comment says. In fact scipy's `least_squares` applies the loss to **every**
residual, the priors included, and the Python does not separate them. The port does what scipy
does, so that it lands on the same minima. The prior residuals are mostly below f_scale = 3, so
they stay nearly quadratic either way.

**Other small differences**

- `transferK` leaves out non-finite areas. numpy's median of a selection holding a NaN would
  return NaN.
- The robust pass's sd is not computed: the Python computes it and never uses it.

## 4. Validation on the user's data (aggregates only)

**Data**

- 10 TCD files: 9 runs and CALS, 455 chromatograms in all.
- The Python reference ran v2.1's own `_fit` and `trapezi_classici`, through a copy of
  `fit_picchi` instrumented to record each pass, with multiprocessing(4). One JSON per
  chromatogram went to the scratchpad.
- One older run (44 chromatograms) is refused by `readTcd`: its time column restarts at 0
  halfway through the file (§8). That leaves **411 chromatograms compared**: 377 from runs and 34
  standards. 410 were fitted; 1 standard column ends at 309 s, so its window is NaN in both
  codes.

**Floor of the comparison: Python against itself.** The whole reference was run a second time
with every data value moved by one ulp (`np.nextafter`). The JS–Python differences are then set
against these Python–Python differences.

**Runs (377 chromatograms): agreement to rounding everywhere**

| Quantity | JS vs Python: median / p95 / max | Python vs Python + 1 ulp: max |
|---|---|---|
| H2 area, relative | 4.5e-11 / 4.8e-8 / **5.5e-6** | 1.3e-5 |
| H2 area, %mol (through k) | max **0.0009 ppm** | 0.0009 ppm |
| O2 area, relative | 1.8e-10 / 1.4e-6 / **2.5e-5** | 2.4e-5 |
| O2 area, %mol | max 0.006 ppm | 0.006 ppm |
| H2 / O2 sd, relative | max 6.7e-5 / 2.6e-4 | |
| χ²_r, relative | max 7.7e-6 | |
| S310 area, relative | max 7.2e-5 | |
| Step height | max 0.001 | |
| tApex H2, O2 | identical in 377 / 377 | |
| Trapezoid areas H2, O2 | **bit-identical** in 377 / 377 | |

H2 by signal level (runs). S/N is area/sd. ppm is through k_H2 = 67,583 area per %mol.

| H2 class | n | Relative difference, max | Absolute difference, max |
|---|---|---|---|
| S/N ≥ 100 | 207 | 5.0e-7 | 0.0009 ppm |
| S/N 30–100 | 94 | 2.9e-6 | 5e-5 ppm |
| S/N 10–30 | 49 | 5.5e-6 | 2e-5 ppm |
| S/N 3–10 | 24 | 1.2e-7 | 2e-7 ppm |
| S/N < 3 | 3 | 6e-9 | 3e-9 ppm |
| Table H2 ≥ 0.02 % | 183 | 3.1e-7 | 0.0009 ppm |
| Table H2 20–200 ppm | 113 | 2.9e-6 | 5e-5 ppm |
| Table H2 < 20 ppm | 81 | 5.5e-6 | 2e-5 ppm |

**Decisions**

- Spikes: the same in all 410 fitted chromatograms.
- Glitch exclusions: the same in 409 / 410. The odd one is one of the fragile standards below.
- Restart decision: the same in 403 / 410. All 7 different ones are among the standards.

The target (~0.1 % where S/N is good, with the same glitch and spike decisions) is met with a
margin of four orders of magnitude.

**Standards (CALS, 33 fitted): fragile fits, as fragile in Python itself**

- **Where it happens.** The O2 standards with 1–10 % O2 (O2 S/N about 1,000 to 10,000, H2 ≈ 0).
- **Why.** The robust pass reaches max_nfev = 100 before it converges (38 of the 410 fits do).
  Where it stops then depends on rounding. Passes 2 and 3 start from there, and there are several
  local minima.
- **The solver is not the cause.** Started from Python's robust endpoint, the JS second and third
  passes land on Python's results to 1e-11 in cost.
- **Python against itself.** With the data moved by one ulp:
  - 8 of the 33 standards change by more than 0.01 sd: 7 in JS against Python, with 5 in common.
  - The largest changes are about the same: H2 up to 12 sd (JS 12.5 sd), about 1.5–3 ppm in
    H2-free O2 standards; O2 up to 1.8 % (JS 2.2 %).
  - In 3 of these chromatograms, JS lands on the same alternative minimum as the perturbed
    Python, to the printed digits.
- **The worst JS case** is one 10 % O2 standard: O2 −2.2 %, χ²_r 41 against 8. I ran Python on
  that column under 12 random one-ulp perturbations:
  - it lands on that same solution (to all printed digits) in 2 of the 13 runs;
  - it lands on another χ²_r ≈ 41 solution in 3 of them;
  - its O2 ranges over 2.4 %.

  So every JS outcome among the fragile fits is one that Python v2.1 also produces. The
  instability belongs to the algorithm (a robust pass truncated at 100 evaluations, with
  path-dependent minima), not to the port. It bears on the simplification being studied.

**Software factor.** Pooled over the six runs that have H2 and O2 %mol columns, natural column
order, the same in both codes:

| Factor | Value | n | JS vs Python |
|---|---|---|---|
| k_H2 | 67,583 area per %mol | 182 | 1e-9 |
| k_O2 | 9,018 area per %mol | 294 | 3e-12 |
| k_H2, trapezoids | 66,972 area per %mol | | Identical |

Per run, k_H2 ranges over 0.2 %. With `trova_ordine` dropped, the natural order still fits the
tables: for every H2 ≥ 0.02 % injection, |area/k − table|/table is at most 2.4 % (median 0.28 %).
No column is out of place in these runs.

## 5. Timing (4-core container, Node 22, Python 3.13 with numpy 2.5 and scipy 1.18, 1 BLAS thread)

**Per chromatogram, one thread**

| Set | JS: median / mean / max | Python: median / mean / max |
|---|---|---|
| One run of 50 injections | **156 / 158 / 225 ms** (7.9 s for the run) | 284 / 285 / 409 ms (14.2 s) |
| CALS, 34 | 337 / 485 / 4,753 ms (16.5 s) | 579 / 867 / 8,207 ms (29.5 s) |
| All 411 | 139 / 171 / 4,753 ms (70 s) | |

- JS is about 1.8 × faster than Python per chromatogram.
- The fits evaluate the model 74 times per chromatogram (median over the three passes), with a
  p95 of 172. The slow cases are restarts and the 2000-evaluation limit.
- `readTcd` takes about 100 ms for a 6,900 × 50 file.

**Pool, one run of 50 injections** (Node worker_threads, standing in for Web Workers):

| Workers | Wall time |
|---|---|
| 1 | 8.75 s |
| 2 | 5.81 s |
| **3 (cores − 1, the default)** | **3.78 s** |
| 4 | 3.23 s |

- Pool results are bit-identical to direct calls.
- An abort takes effect as soon as it is asked: the workers are terminated.
- For comparison, the Python reference (Pool(4)) did all 455 chromatograms in 39 s.
- Chromium was not measured: Playwright is not installed in this container. V8 is the same
  engine, so expect similar per-chromatogram times. A worker's first chromatogram is slower while
  the JIT warms up.

## 6. Window sensitivity

**Set-up**

- 40 run chromatograms: 14 with H2 ≥ 0.02 % (high; median 2,550 ppm), 13 with 20–200 ppm (low;
  median 39 ppm), 13 below 20 ppm (none; median 5.5 ppm). All have O2.
- Each edge was moved on its own by ±1, ±2 and ±5 s, and compared with the default method.
- The formal sd, for scale: H2 median 0.66 ppm, O2 median 3.5 ppm. ppm are through k.

**Fit window (268–326 s).** Median / p95 of the absolute change.

| Edge moved | H2 high, rel % | H2 low, rel % | H2 low, ppm | H2 none, ppm | O2, rel % | O2, ppm |
|---|---|---|---|---|---|---|
| from −5 (263) | 0.161 / 0.800 | 1.97 / 5.56 | 0.78 / 2.56 | 0.10 / 0.27 | 2.15 / 5.20 | 4.7 / 10.9 |
| from −2 | 0.008 / 0.135 | 0.24 / 1.71 | 0.12 / 0.51 | 0.03 / 0.09 | 0.25 / 1.08 | 0.7 / 2.3 |
| from −1 | 0.008 / 0.035 | 0.06 / 0.38 | 0.02 / 0.14 | 0.01 / 0.06 | 0.10 / 0.34 | 0.3 / 0.7 |
| from +1 | 0.007 / 0.073 | 0.09 / 0.36 | 0.03 / 0.19 | 0.02 / 0.06 | 0.16 / 0.47 | 0.3 / 1.5 |
| from +2 | 0.021 / 0.108 | 0.09 / 0.83 | 0.04 / 0.34 | 0.02 / 0.07 | 0.16 / 1.16 | 0.4 / 2.5 |
| from +5 | 0.028 / 0.188 | 0.34 / 0.58 | 0.10 / 0.19 | 0.08 / 0.22 | 0.29 / 1.14 | 0.7 / 2.7 |
| to −5 (321) | 0.037 / 0.421 | 1.04 / 2.20 | 0.38 / 1.35 | 0.03 / 0.17 | 0.63 / 2.03 | 1.8 / 5.5 |
| to −2 | 0.017 / 0.056 | 0.45 / 1.03 | 0.16 / 0.69 | 0.01 / 0.22 | 0.22 / 0.95 | 0.6 / 3.0 |
| to −1 | 0.007 / 0.034 | 0.20 / 0.62 | 0.08 / 0.44 | 0.01 / 0.09 | 0.12 / 0.43 | 0.3 / 1.6 |
| to +1 | 0.018 / 0.109 | 0.16 / 0.57 | 0.06 / 0.23 | 0.03 / 0.11 | 0.28 / 0.68 | 0.7 / 2.2 |
| to +2 | 0.022 / 0.161 | 0.37 / 1.32 | 0.16 / 0.62 | 0.04 / 0.20 | 0.44 / 1.12 | 0.9 / 4.8 |
| to +5 (331) | 0.046 / 0.464 | 1.42 / 3.54 | 0.61 / 1.82 | 0.09 / 0.48 | 1.09 / 2.86 | 2.7 / 7.4 |

**Moves of ±1–2 s barely matter.** H2 changes by 0.01–0.02 % (p95 ≤ 0.16 %) at high levels. At
low and no H2 it changes by ≤ 0.16 ppm (p95 ≤ 0.7 ppm), about one formal sd at most. O2 changes
by 0.1–0.4 % (p95 ≤ 1.2 %), a fraction of its sd.

**±5 s is the danger zone.** At 263 s the window takes in part of the system peak at 262–267.5 s.
At 331 s it reaches the N2 peak at 332 s. The model has no peak for either, so χ²_r rises. The
worst single case is a 10 ppm change in H2 at 2,500 ppm.

**Trapezoid base intervals.** Median / p95. Only the valid cases are shown: the interval is not
empty, it is not inverted, and a valley interval has ≥ 5 points. Where a row names both
directions (±), it gives the worse of the two.

| Change | H2 high, rel % | H2 low, ppm | H2 none, ppm |
|---|---|---|---|
| left [281, 283.6], start ±1 | 0.05 / 0.31 | 0.66 / 1.61 | 1.00 / 3.87 |
| left start ±2 | 0.09 / 0.87 | 1.54 / 3.91 | 0.75 / 5.47 |
| left end −1 / +1 | 0.04 / 0.42 | 0.72 / 2.06 | 0.61 / 3.06 |
| left end +2 (onto the H2 front) | 1.9 / 2.6 | 0.62 / 1.90 | 0.62 / 1.55 |
| left end +5 (onto the H2 peak) | 82 / 83 | 26 / 67 | 3.8 / 9.0 |
| whole left interval ±1 | 0.08 / 0.32 | 0.82 / 3.08 | 1.20 / 3.24 |
| right [295, 300.5] valley, start ±1 to ±5 | 0.000 / 0.000 | 0.00 / 0.80 | 0.00 / 1.51 |
| right end −1 / −2 | 0.19 / 1.12 – 0.56 / 1.50 | ≤ 1.1 / 4.7 | ≤ 1.9 / 5.5 |
| right end +1, +2 | 0.000 / 0.013 | 0 / 0 | 0 / 0 |
| right end +5 (onto O2) | 1.8 / 7.7 | 25 / 31 | 0 / 47 |

| Change | O2 rel % | O2 ppm |
|---|---|---|
| left [295, 300.5], start or end ±1 | 0.9–4.3 / 5–13 | 2.8–10 / 9–31 |
| left start or end ±2 | 1.5–24 / 12–31 | 4–53 / 20–168 |
| right [304.8, 305.6], start −1 | 7.4 / 12.7 | 18 / 53 |
| right start −2 | 34 / 47 | 75 / 260 |
| right end +1 / +2 / +5 | 2.9–4.2 / 8.7–14.6 | 8–11 / 23–32 |
| whole right interval ±1 | 5.8–15 / 16–26 | 16–37 / 44–107 |

**The trapezoids are 10–100 times more sensitive than the fit.**

- **O2's right base point sits on the baseline step**, which is centred at 305.6 s. Moving that
  interval by 1 s changes O2 by 5–15 %.
- H2's valley search (right) is robust while its interval stays in the valley.
- H2's left interval shifts H2 by about 1 ppm per second at low levels.

### Recommendation: numeric fields first, dragging only as an aid

1. **Numeric fields as the method's source of truth.** They should be exact, stored with the
   method, the same for every injection of a run and of a project, and shown with the results.
   Every number above was obtained with exact edges, and reproducibility across sessions and
   people needs them.
2. **Drag handles on the chromatogram are fine for the fit window**, as a convenience. They should
   snap to the 0.2 s data grid and write into the numeric fields. ±1–2 s of hand imprecision
   costs at most about one formal sd at low H2, and < 0.2 % at high H2.
   - The plot must draw the neighbouring system peaks (262–267.5 s and the N2 peak at 332 s).
   - The plot should warn, or refuse, when an edge enters one of them: that is where ±5 s goes
     wrong.
3. **The trapezoid base intervals should be numeric only**, or dragged with a strong snap and a
   live readout of the area change. A one-second slip in O2's right interval changes O2 by
   5–15 %. These intervals are a control, not the result, so they rarely need moving at all.

## 7. Calibration check (CALS)

**Set-up**

- The levels come from the `cal_<gas>_<conc>%` names.
- The columns are assigned to them as v2.1's `analizza_calibrazioni` does: duplicate columns are
  removed and columns are aligned to rows. Python's own assignment was reused, so that both codes
  see the same points; in the app, the user types the levels.
- `analizza_calibrazioni` ran with the runs' k_H2 = 67,583 and the trapezoid k = 66,972.

**H2 (one level, 0.5 %, 3 injections)**

|  | Area per % (mean ± sd) | Standard / runs |
|---|---|---|
| Shape, JS | 67,646 ± 266 | 1.00093 |
| Shape, Python | 67,646 ± 266 | 1.00093 |
| Trapezoids, JS and Python | 67,155 ± 305 | 1.00272 |

Through the origin, `fitCalibration` gives slope 67,646, the same value. With one level, the line
with an intercept is undetermined (NaN).

**O2, Python's line: levels ≥ 0.5 %, with intercept**

| Method | Slope (area per %) | Intercept |
|---|---|---|
| Shape, JS | 9,748 | −448 (−459 ppm) |
| Shape, Python | 9,800 | −532 (−543 ppm) |
| Shape, JS with Python's area for the one fragile 10 % standard (§4) | **9,800.3** | −532 |
| Trapezoids, JS | 9,258.37 | −490.6 |
| Trapezoids, Python | 9,258.37 | −490.6 |

- The whole shape difference comes from the fragile 10 % standard. With Python's value swapped
  in, the slope is 9,800.3, and the small rest comes from the other fragile standards.
- The trapezoid lines are identical, as are their per-level means and CVs.

**Per-level deviation from the line** (Python's definition, % of slope × conc), JS / Python:

| Method | 0.2 % | 0.5 % | 1 % | 2 % | 5 % | 10 % |
|---|---|---|---|---|---|---|
| Shape | −4.0 / −0.2 | +0.1 / +1.3 | +0.5 / +0.8 | −0.3 / −0.4 | 0.0 / −0.4 | 0.0 / +0.1 |
| Trapezoids | +1.7 / +1.7 | +1.7 / +1.7 | +0.8 / +0.8 | −0.2 / −0.2 | −0.6 / −0.6 | +0.2 / +0.2 |

**`fitCalibration` on the JS shape areas**

| Points | Line | Slope | Intercept | R² | Mean relDev by level |
|---|---|---|---|---|---|
| All levels, 29 | With intercept | 9,750 | −462 | 0.99981 | 0.2 %: −4.3 %; 0.5 %: +0.4 %; ≥ 1 %: within ±0.6 % |
| All levels, 29 | Through 0 | 9,680 | 0 | 0.99969 | 0.2 %: −26 %; 0.5 %: −8.4 %; 1 %: −3.5 %; 2 %: −1.9 %; 5 %: −0.2 %; 10 %: +0.25 % |
| ≥ 0.5 %, 26 | With intercept | 9,748 | −448 | 0.99980 | |
| ≥ 0.5 %, 26 | Through 0 | 9,680 | 0 | 0.99970 | |

The trapezoids give the same pattern: through 0, slope 9,184; low levels −24 % and −8.7 %.

**The O2 response has a real negative intercept** of about −500 ppm, by either method. A line
through the origin biases the low levels by −8 % at 0.5 % and −26 % at 0.2 %, while R² barely
moves (0.9998 → 0.9997). The app should offer the intercept by default for O2 and show the
per-level deviations, since R² cannot tell the two apart.

**Two data points for the user:**

- The 0.5 % level holds one injection with about 70 % of the level's area, the first of the
  series (CV 12 %).
- Another column ends at 309 s, so its O2 is NaN in both codes.

## 8. Open issues

1. **Fragile fits on large O2 peaks** (§4). The robust pass's max_nfev = 100 truncation makes 8
   of 33 O2 standards depend on rounding: up to about 2 % in O2 and about 10 sd in a near-zero H2.
   - This holds in Python v2.1 too, so the port cannot fix it without changing the algorithm,
     which was out of scope.
   - It is the first thing for the simplification study to look at.
   - Until then, a QC flag on χ²_r > 4 after the restart would catch the worst outcome
     (χ²_r 41).
2. **One older run's TCD file has its time restart at 0 mid-file.** It reads as two blocks, and
   its first two columns are blank in the second block.
   - `readTcd` refuses it with "The time does not increase at line …".
   - v2.1's `leggi_tcd` also refuses it, since its time step is irregular.
   - The tolerant `leggi_tcd_libero` (used for CALS) would mix the two blocks into one window.
   - The three older runs also lack an O2 column in their tables, so the Python pipeline skips
     them anyway.
3. **`trova_ordine` is dropped.** It is not needed for the six runs (§4), but a file whose first
   column belongs elsewhere would now go unnoticed. A cheap check against the table, such as
   |area/k − table| per row, could flag it.
4. **NaN becomes `null` in JSON** (stored projects). Consumers must map `null` back to NaN.
5. **When wired into the app:**
   - `sw.js` must precache `gc-tcd.js`, `gc-tcd.worker.js` and `gc-tcd-pool.js`.
   - The pool does not share the Rietveld pool's Web Locks cap: a GC run and a refinement at once
     would each take cores − 1.
   - The pool sends each chromatogram's full column with its time (about 110 kB per message,
     under 1 ms).
6. **Chromium timing not measured** (no Playwright in the container). Node's worker_threads
   timings stand in for it.
7. **The noise estimate is the Python's**: MAD of the differences over the whole window, peak
   flanks included. On synthetic data with strong peaks it reads 1.6 × the true noise, so χ²_r
   reads low. The port keeps this, since the glitch thresholds and restart rule are scaled to it.
