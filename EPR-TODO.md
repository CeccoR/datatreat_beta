# EPR: things to do

What the EPR module does not do yet, found in the review of v471. Each says what happens
now and what is proposed; nothing here is in the code yet. References are to `epr.js` as
it was then (functions named, since lines move).

## Reading the files

- **2D data.** A `.DSC` with `YPTS` > 1 (a series of spectra: power, temperature or angle
  steps) is read for its first `XPTS` values only (`processPair`); the other slices are
  dropped without a word. Proposed: say so when the file loads, and later offer which
  slice to show, or each slice as a sample of its own.
- **A field axis that is not linear.** `XTYP IGD` (the field of each point listed in a
  `.XGF` file beside the pair) is taken as linear from `XMIN` and `XWID` (`buildBAxis`).
  Proposed: read the `.XGF` when it is there; without it, refuse the file or warn.
- **Spectra with and without `MWFQ` on one axis.** A spectrum whose `.DSC` has no
  frequency is drawn on the field it was measured at, the others on their field rescaled
  to 9.5 GHz; with one of each the axis is titled "Magnetic Field (mT)", the g axis goes,
  and the two kinds do not line up by g. Proposed: say which spectra are not rescaled
  (the legend, a note), or let the user type the missing frequency.

## Normalisation by the acquisition (needed later)

Today the spectra are compared as they come (none) or each divided by a peak-to-peak
(global or local). Intensities from two acquisitions are comparable only once the
acquisition's own factors are divided out, and the `.DSC` carries them:

| Factor | `.DSC` key | How the signal grows with it |
|---|---|---|
| Receiver gain | `RCAG` (in dB on Xenon: × 10^(RCAG/20)) | linearly |
| Number of scans | `AVGS` | linearly, if the spectrum is summed (not if averaged) |
| Microwave power | `MWPW` (W) | as √P, while the line is not saturated |
| Modulation amplitude | `B0MA` (T) | linearly, while it is well under the line width |
| Conversion time | `SPTP` (s) | linearly, unless the acquisition already normalised it |

Proposed: a "normalise by the acquisition" option, before the stacking normalisation, that
divides each spectrum by gain × scans × √power × modulation amplitude (× conversion time
where needed), shows each factor used, and leaves a missing one at 1 with a note. Then,
for spin counting, the double integral of each spectrum relative to a reference sample
measured the same way. To check against real `.DSC` files from the instrument before it
is written (which keys it writes, in which units, and which normalisations the
acquisition software has already applied).

## Baseline and export

- **The baseline** is a straight line through the first and last raw points
  (`processPair`), so a noisy end tilts it (also in BACKLOG.md). Being reworked by the user.
- **The CSV's "Raw_" column** is the intensity after that baseline, not the file's raw
  values; and its "Smoothed_" column takes the first point as the background
  (`smoothedOut`). Proposed: name the columns for what they hold, and give the file's
  raw intensities as well.

## Edge cases

- Global normalisation of spectra that are all flat divides by zero (the plot's `gmax`).
- An `XPTS` of 1 gives a field axis of NaN (`buildBAxis` divides by `npts − 1`).
