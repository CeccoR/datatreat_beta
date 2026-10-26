### 6.2 Fitted from the truth (the truth reference, screening set)

The truth reference is the model's minimum next to the truth: no search in it. Errors are
signed, the truth's thinnest, middle and longest extent. The median is given with the 10th–90th
percentiles; "axis" is the truth's most distinct axis (median, 90th percentile). An extent read
as unbounded counts as +∞ (4 truth references, all in −1 and 2/m).

**By solid** (66 truths, errors included):

| solid | thinnest | middle | longest | axis ° | χ²_ν |
|---|---|---|---|---|---|
| box | +18 % (+12…+77) | −0 % (−38…+32) | +1 % (−54…+23) | 4.4 (22.6) | 1.55 |
| square box | +12 % (−5…+46) | +12 % (−5…+30) | +4 % (−48…+17) | 10.6 (29.0) | 1.52 |
| cylinder | +24 % (+2…+30) | +15 % (−5…+28) | +13 % (−26…+89) | 6.1 (27.7) | 1.18 |
| elliptic cylinder | +20 % (+4…+68) | +4 % (−23…+93) | −15 % (−37…+19) | 10.0 (14.5) | 1.23 |
| ellipsoid | +10 % (+2…+75) | +5 % (−26…+15) | +2 % (−40…+17) | 1.5 (15.6) | 1.13 |
| spheroid | +25 % (+8…+57) | +5 % (−35…+21) | +3 % (−42…+∞) | 5.0 (43.4) | 1.90 |

**By Laue class** (the 33 clean truths). The anisotropy column is longest/thinnest as read,
over the truth's (median, 10th–90th percentiles):

| class | runs | thinnest | longest | anisotropy read ÷ true | axis ° |
|---|---|---|---|---|---|
| −1 | 3 | +15 % | +19 % | 1.10 (1.05…∞) | 3.7 |
| 2/m | 3 | +6 % | +10 % | 1.01 (0.98…1.03) | 11.4 |
| mmm | 3 | +10 % | −3 % | 0.91 (0.84…0.91) | 1.8 |
| 4/m | 3 | +43 % | +5 % | 0.73 (0.68…0.73) | 18.8 |
| 4/mmm | 3 | +19 % | +12 % | 0.95 (0.53…1.01) | 0.0 |
| −3 | 2 | +21 % | +3 % | 0.86 (0.81…0.91) | 22.8 |
| −3m | 3 | +47 % | −17 % | 0.75 (0.50…0.76) | 4.0 |
| 6/m | 5 | +68 % | +2 % | 0.59 (0.28…0.90) | 13.6 |
| 6/mmm | 1 | +20 % | +0 % | 0.84 | 0.0 |
| m−3 | 3 | +37 % | −6 % | 0.69 (0.66…0.71) | 2.5 |
| m−3m | 4 | +101 % | −51 % | 0.26 (0.16…0.35) | 5.3 |

**By the model error** (all solids): none (33) thinnest +29 %, longest +2 %, χ²_ν 1.28; hump
(7) +30 %, −5 %, 2.42; size distribution (7) +12 %, +17 %, 1.47; impurity (7) +10 %, −28 %,
2.59; air (6) +13 %, −3 %, 1.31; preferred orientation (6) +9 %, +52 % (two of six unbounded),
axis 8.2° (90th percentile 46.7°), 1.52.

**What this says:**
- **On top of the uniform +13–20 %, the solid is pulled toward equant, and how far follows the
  class.** In −1, 2/m and mmm the anisotropy is read about as it is (0.91–1.10). The cubic
  classes lose most of it: m−3m reads a quarter of it, and its ellipsoid, spheroid, square box
  and box refine from the truth to a sphere or a near-cube (ellipsoid-Pm-3m-near 14×37×60 nm →
  27.3×27.2×27.2 nm; sqbox-Pm-3m-near 17.6×17.6×6.8 → 14.2 nm in all three).
- **This fits where the shape shows** (a reading, not a test). A class's symmetry averages
  part of a deformation of the sphere out of the reflections' breadths, the more of it the
  higher the class: in cubic all of it, to first order (`freeShape`'s own comment). There a
  family's members differ in width, but the family's line is their sum at one 2θ, so only its
  shape carries the anisotropy. The exact lines' shapes differ from the Lorentzian's by 13–19 %
  of the peak (the generator's limit check), so the anisotropy has little left to be read
  from.
- **χ²_ν at the truth reference** is 1.40 (median; 90th percentile 5.3, at most 36). The
  misfit is the line shape. It grows with counts: the isotropic fit's χ²_ν runs from 1.02 to
  61 over the 66 truths.
- The same picture held on the first cells (§4.1's 11 truths) and at C3 (§10).

### 6.3 In-model controls (the engine's own lines)

The 11 cost truths, all clean, one per class, were drawn again with `--kernel none`: the
engine's own Lorentzian lines, the rest the same (`inmodel.mjs`; `tables/pilot-inmodel.md`
has every run):

| lines | runs | today kept | today's worst extent | today's thinnest | today's axis ° | χ²_ν | truth reference: worst extent | axis ° |
|---|---|---|---|---|---|---|---|---|
| exact | 11 | 10 | +39 % | +34 % | 11.3 | 1.15 | +46 % | 3.2 |
| the engine's | 11 | 10 | +7 % | +0 % | 1.7 | 1.00 | +6 % | 4.0 |

(medians over the kept runs; χ²_ν at today's minimum.)

Run by run, with the engine's lines:
- **Four come back within 3 % and 1.5°:** box-P4mmm-generic, ellcyl-P6mmm-on, sqbox-P2m-near,
  sqbox-Pm-3-on. box-P-1-near comes within 8 % and 1.9°, spheroid-P4m-generic within 11 % and
  6.6°.
- **The cylinders' axes are weakly determined:** cylinder-P-3-near and cylinder-Pmmm-near
  read the axis 5.0° and 4.7° off (both 'near' truths, both free), and the latter its height
  +25 %. The verifier saw the same on cylinder-P-3-near: χ² flat within 2 units between the
  free minimum and the truth's axis.
- **ellipsoid-P-3m1-on** reads its middle and longest extents +19 % and −20 %, with χ²_ν 0.98:
  the two are traded against each other.
- **Two are not determined at all:** ellipsoid-Pm-3m-near is rejected (ΔBIC −2) and its truth
  reference runs its longest extent away (+8442 %); ellcyl-P6m-generic is kept at another solid
  (+416 %, 26°), and its truth reference reads the longest +170 %.

**What it means.** The line shape accounts for most of the bias at the median: the thinnest
extent goes from +34 % to 0 %, the worst from +39 % to +7 %, the axis from 11° to 2°. It does
not account for all of it run by run. The cubic and hexagonal elliptic cases, and the
cylinders' axes, are weakly determined in the model's own lines, at these counts and with
60–73 members. The first write-up's "the same truths come back within 1 %" held for 2 of its
3 controls; it is withdrawn (§10, H9).

### 6.4 Today's minimum against the truth reference's

The truth reference stops at the minimum next to the truth. With exact lines that is often
not the model's lowest (60 kept truths; `report.mjs` minima):
- In 26, today's best χ² lies more than one χ²_ν below the truth reference's; in 13 of these
  the solid differs beyond 8° or 28 % (`sameSolid`).
- In 29 it is within one χ²_ν; in 3 of these the solid differs: equivalent minima.
- In 5 it is more than one χ²_ν above: the misses of §7.

So with exact lines, accuracy is lost in three ways:
- the minimum next to the truth is biased (§6.2);
- the lowest minimum is often another solid, which a perfect search would report;
- the search does not always reach the lowest.

Today's accuracy (§7) includes all three.
