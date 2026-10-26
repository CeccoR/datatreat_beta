# Free shape, round 2: the pilot

This is stage 1 of `../PROTOCOL.md`. The pilot integrates the parts built before it (the
phases, the generator, the harness, the design). It measures the cost of a run in every Laue
class and sets cells, range and step by that cost. It measures the bias of the model's
Lorentzian on exact line shapes, and runs today's search on the 77-run screening set:
round 2's reference. Two verifiers then checked it; §10 lists what they found and what was
done, and every number below is from after the fixes.

All data are synthetic. Only tuning rows were run; the validation rows were not touched.
The engine is a frozen copy of `b9bef5f`, instrumented only. The scripts and small inputs are
in `scripts/`, which has its own README.

## Contents

1. [Summary](#1-summary)
2. [What was built](#2-what-was-built)
3. [The checks](#3-the-checks)
4. [The cost of a run](#4-the-cost-of-a-run)
5. [Decisions: cells, range, step](#5-decisions-cells-range-step)
6. [The Lorentzian on exact lines](#6-the-lorentzian-on-exact-lines)
7. [Today's search on the screening set](#7-todays-search-on-the-screening-set)
8. [What it means for round 2](#8-what-it-means-for-round-2)
9. [Files](#9-files)
10. [The verification](#10-the-verification)

## 1. Summary

- **Cost as first drawn was 2.7× the budget.** The budget is the 77 screening runs in about
  1 h on 3 processes, so 140 s a run. On the first cells and 10–130°/0.01°, one clean truth per
  class took 375 s on average for the isotropic fit, today's search and its report. P−1 took
  1331 s and P2/m 889 s: their model lists are long, so an evaluation costs 85–142 ms against
  22–50 ms elsewhere.
- **Decided, after the verification:**
  - **cells:** every cell scaled by 0.8 in every length;
  - **range:** 10–110°;
  - **step:** 0.01°, unchanged.

  The pilot first scaled only P−1, P2/m and Pmmm, with 10–100° (C3). That left those three
  classes with half the others' members (53–58 against 101–112), and it cost more. Every class
  now has 60–73 members in range. On the screening set a run costs 115 s (mean, isotropic fit
  + search + report) against 134 s at C3; 133 s with the truth reference and the drawing. The
  runs' times sum to 147 min (171 min with the truth reference): about 49 min (57) on 3
  processes, 74 min (86) on 2. There were no failures.
- **The Lorentzian is biased on exact lines, and the bias goes with the symmetry.**
  - A single exact size line, fitted alone, is read 13–20 % long, whatever the solid and
    direction.
  - Fitted from the truth, the solids are pulled toward equant shapes. The thinnest extent
    reads +29 % (median over the 33 clean truths). Longest over thinnest, read and divided by
    the truth's, is 0.91–1.10 in −1, 2/m and mmm, 0.73–0.95 in the tetragonal and trigonal
    classes, 0.59–0.84 in the hexagonal ones, 0.69 in m−3 and 0.26 in m−3m.
  - Drawn with the engine's own lines, the same 11 cost truths come back with the extents
    within 7 % and the axis within 1.7° (medians; with exact lines 39 % and 11°). Not every run
    does: the cubic ellipsoid, a hexagonal elliptic cylinder and the cylinders' axes (5°) are
    weakly determined even in the model's own lines (§6.3).
- **Today's search on the screening set (round 2's reference):**
  - **Reach:** 58 of 63 judged truths are within Δ 1 of the truth reference. Three of the five
    misses are elliptic cylinders. At C3 it was 61 of 62.
  - **Kept:** 60 of 66 truths. The 6 rejected are four cubic truths and two square boxes in
    4/m and 6/m. The data do not support them even from the truth: the truth reference's ΔBIC
    is +4 to +27.
  - **Spheres:** 3 of 11 keep a shape: the two smallest (2.5 and 3.4 nm) as near-equant
    bodies, and one with preferred orientation.
  - **Accuracy of the kept solids:** worst extent +42 % (median; 90th percentile +290 %), thinnest
    +20 %, the most distinct axis 6.8° (90th percentile 79°). 3 kept truths read an extent as
    unbounded; they count as +∞.
  - **The lowest minimum is often not the one next to the truth.** In 26 of 60 kept truths
    today's minimum lies more than one χ²_ν below the truth reference's, 13 of them at another
    solid.
- **The verification** found twelve problems, all real, three of them wording only (§10). Two
  were major and in the scoring: unbounded extents dropped from the medians, and spheroids and
  square boxes paired by size. On the first baseline alone they move the worst extent from +35 %
  to +46 % (median).
