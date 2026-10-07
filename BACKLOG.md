# Backlog

Things looked at and deliberately left for later. Each says what was found and what
was proposed; nothing here is in the code yet.

## GC

- **CSV fields in quotes.** `splitCSVLine` splits on the delimiter even inside quotes,
  so a comma-separated export with quoted comma decimals (`"0,5089"`) shifts the
  columns: H₂ reads 0 and O₂ takes the next column. Semicolon files with comma
  decimals are fine. Proposed: split on delimiters outside quotes only.
- **Impossible dates.** `parseGCDate` takes month/day/year and does not check the
  ranges: `13/10/2025` silently becomes 10 Jan 2026, `2/30/2025` 2 Mar. Proposed:
  refuse a date that does not exist (or detect day/month order from the file).

- **Replicates.** A way to say that several datasets are the same sample, so the
  mean rate gets real statistics (mean ± spread over replicates) instead of an
  error estimated from one run. Until then the mean rate is reported as it is.

## XRPD

- **Kα1/Kα2 separation without fitting, through the standard.** The classic FWHM is
  measured on the unresolved Kα1+Kα2 doublet, whose splitting grows with angle
  (0.06° at 25°, 0.22° at 75°). With a standard chosen, separate the two "easily"
  (no profile fit — e.g. a Rachinger-type stripping, or the doublet width the
  standard shows at each angle) so the sample's Kα1 width is what is sized. Without
  a standard nothing says how the width varies: no Caglioti can be invented, and
  nothing is done.
- **Peak assignment across samples (crystallite size by peak).** Peaks are matched
  in one greedy sweep in order of 2θ: each joins the current reflection if its
  sample is not in it yet and it lies within √(w² + w̄²) of the reflection's mean
  position (w its FWHM, w̄ the reflection's mean FWHM), else it starts a new one. It
  is order-dependent and compares against the mean only, so two reflections closer
  than about one FWHM can swap peaks. To be solved: e.g. an optimal assignment
  (each sample's peaks to the reflections at minimum total distance in sigmas)
  rather than the sweep.

## EPR

- **Baseline.** Drawn through the first and last raw points only, so a noisy end
  tilts it. Being reworked by the user; left as it is meanwhile.
