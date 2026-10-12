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
- **Free shape: the axes held on the lattice (found in v429, awaiting a go-ahead).**
  Two defects of the shape search, measured on 36D and 37D without texture and on
  synthetic discs. (1) A body held on the lattice goes to the simplest direction within
  10° of the free fit's axis, not the nearest: discs whose free normal lies within 0–2°
  of [310] are reported as "⟨210⟩ (8°)", and the held box and ellipsoid of 36D stay on
  [210], 2–10 in χ² above the same solids held on [310]. Taking the nearest direction
  needs a preference for the simpler one when χ² is practically equal (a synthetic
  [210] disc as a box would otherwise be held on [320], 0.6 lower). (2) The held
  candidates are built only near the best free fit: frames on the low-index directions
  (⟨100⟩, ⟨110⟩, ⟨111⟩) are never tried; adding them changes only the fits with one ΔB
  free on these samples. Neither change reaches the shallow minima 8° from [110] that
  the box finds on 36D (ΔBIC −10). Scripts: scratchpad/v429/L/.
- **Rietveld against MAUD (started in v426, on hold).** How far our engine and MAUD
  recover a known truth from synthetic patterns at equal model depth, with a third,
  neutral generator (the Debye scattering equation of atomistic crystallites), to
  guide the calibrations. Done so far, outside the repository: MAUD 3.06 built from
  source and run headless; a model-by-model map with the conversions (MAUD draws a
  Lorentzian sample breadth with √π where π is due, so its Delft sizes and fault
  probabilities need a factor; its log-normal "Distributions" counts the size twice;
  its Warren faults shift no line; it has no free shape, so solids are compared by
  their column lengths along a few directions); runners for both programs, ours also
  with forward differences as MAUD's, and 32 cases; the Debye generator, its checks
  unfinished. Two engine problems it found: a fault probability carried the starting
  cell's error (α·a_start/a_true), fixed in v427 with the calibrations; autoRefine's
  anisotropic-strain stage ended in a wrong minimum on a ZnO case (D 34 nm for 50, a
  strain clipped to 0) that refine() from the same start recovers, to be checked again
  on v427's stages.

## EPR

- **Baseline.** Drawn through the first and last raw points only, so a noisy end
  tilts it. Being reworked by the user; left as it is meanwhile.
