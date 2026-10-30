# Track A: the size line alone and in the pattern

Round 2, `../AB.md`. Made by `scripts/A/lines/` (`line-errors.mjs`, `pattern-check.mjs`, `linediff.mjs`, `shapes.mjs`, `family.mjs`) and `scripts/A/fix/line-oos.mjs` from the run records in `$W/fs2/A/results/` (not in the repository). Only tuning rows.

## The line alone and in the pattern

| model | line alone: max \|Δ\| of the peak, median (90 %) | ⟨L⟩_V read ÷ true (tables' weights) | in the pattern: max \|Δ\| of the peak, median (90 %) | excess χ²_ν, median (90 %; max) |
|---|---|---|---|---|
| lor | 17.5 % (18.6) | 1.163 | 12.97 % (16.06) | 0.807 (3.941; 36.8 cylinder-P4mmm-on) |
| ib (a) | 17.0 % (18.3) | 1.097 | 11.70 % (15.34) | 0.660 (2.939; 29.2 cylinder-P4mmm-on) |
| mom (b1) | 5.4 % (6.9) | 1.042 | 4.22 % (5.99) | 0.104 (0.242; 4.9 cylinder-P4mmm-on) |
| lsq (b2) | 4.5 % (6.4) | 1.000 (in sample) | 3.63 % (5.63) | 0.039 (0.116; 2.8 cylinder-Pm-3m-on, a size-distribution row) |
| wppm (c) | — | — | 0.29 % (0.65) | 0.000 (0.007; 2.5 cylinder-Pm-3m-on, a size-distribution row) |

Line alone: `lines/line-errors.mjs --n 200` (200 random members per solid in the design's ranges, unit area, |x| ≤ 6, weights 1/(p + 0.2)). In the pattern: `lines/pattern-check.mjs`, the generator's pattern without noise at the truth against the model at the truth, the 21 sub-screen rows without texture.

## The exact lines of different solids at one ⟨L⟩_V (`linediff.mjs`)

Max |Δp| over |x| ≤ 6, % of the peak (unit peak, x = s·⟨L⟩_V); last two columns: today's Lorentzian (FWHM 0.675/⟨L⟩_V) and the lsq table's TCH line against each exact line.

| line | ball | box edge | box face diag | box body diag | box (1, .5, .25) | cyl axis | cyl 45° | cyl across | Lorentzian 0.675 | lsq TCH |
|---|---|---|---|---|---|---|---|---|---|---|
| ball | 0.0 | 4.8 | 3.8 | 7.8 | 3.4 | 4.8 | 4.9 | 1.7 | 17.5 | 4.5 |
| box edge | 4.8 | 0.0 | 8.5 | 12.4 | 8.2 | 0.0 | 9.6 | 3.2 | 21.0 | 8.0 |
| box face diag | 3.8 | 8.5 | 0.0 | 4.1 | 1.0 | 8.5 | 1.1 | 5.5 | 14.7 | 3.9 |
| box body diag | 7.8 | 12.4 | 4.1 | 0.0 | 4.7 | 12.4 | 3.0 | 9.5 | 11.5 | 2.5 |
| box (1, .5, .25) | 3.4 | 8.2 | 1.0 | 4.7 | 0.0 | 8.2 | 1.9 | 5.2 | 15.3 | 4.9 |
| cyl axis | 4.8 | 0.0 | 8.5 | 12.4 | 8.2 | 0.0 | 9.6 | 3.2 | 21.0 | 8.0 |
| cyl 45° | 4.9 | 9.6 | 1.1 | 3.0 | 1.9 | 9.6 | 0.0 | 6.6 | 13.8 | 3.2 |
| cyl across | 1.7 | 3.2 | 5.5 | 9.5 | 5.2 | 3.2 | 6.6 | 0.0 | 18.8 | 5.8 |

## The exact lines' shapes (`shapes.mjs`)

| line | FWHM·⟨L⟩_V | ⟨L⟩_A/⟨L⟩_V | lsq (g, l) | Lorentzian share l/(g + l) | lsq max \|Δ\| | p(x = 1) | p(x = 2) |
|---|---|---|---|---|---|---|---|
| ball (any direction) | 0.830 | 0.889 | 0.627, 0.267 | 0.30 | 4.5 % | 0.048 | 0.0159 |
| box along an edge | 0.886 | 1.000 | 0.728, 0.143 | 0.16 | 8.0 % | -0.000 | 0.0000 |
| box, face diagonal | 0.786 | 0.750 | 0.531, 0.354 | 0.40 | 3.9 % | 0.068 | 0.0169 |
| box, body diagonal | 0.741 | 0.667 | 0.437, 0.438 | 0.50 | 2.5 % | 0.076 | 0.0190 |
| cylinder along the axis | 0.886 | 1.000 | 0.728, 0.143 | 0.16 | 8.0 % | -0.000 | 0.0000 |
| cylinder at 45° (scaled) | 0.774 | 0.735 | 0.510, 0.376 | 0.42 | 3.2 % | 0.070 | 0.0170 |
| cylinder across | 0.850 | 0.925 | 0.661, 0.226 | 0.25 | 5.8 % | 0.032 | 0.0133 |

A Lorentzian of integral breadth 1 has FWHM 0.637, a Gaussian 0.939; today's Lorentzian (FWHM 0.675) has p(1) 0.10, p(2) 0.026.

## Two members of one family (`family.mjs`)

Two lines of ⟨L⟩_V 1 ± δ in one reflection, fitted as one family of two members: the spread read ÷ true, and the mean ⟨L⟩_V read.

```
ball      δ 0.1 | lor: spread read/true 0.00, mean ⟨L⟩_V read 1.158 | lsq: spread read/true 0.00, mean ⟨L⟩_V read 0.995
ball      δ 0.2 | lor: spread read/true 0.00, mean ⟨L⟩_V read 1.146 | lsq: spread read/true 0.48, mean ⟨L⟩_V read 0.982
ball      δ 0.3 | lor: spread read/true 0.00, mean ⟨L⟩_V read 1.127 | lsq: spread read/true 0.90, mean ⟨L⟩_V read 0.980
ball      δ 0.5 | lor: spread read/true 0.00, mean ⟨L⟩_V read 1.081 | lsq: spread read/true 1.00, mean ⟨L⟩_V read 0.981
box edge  δ 0.1 | lor: spread read/true 0.00, mean ⟨L⟩_V read 1.187 | lsq: spread read/true 0.00, mean ⟨L⟩_V read 0.993
box edge  δ 0.2 | lor: spread read/true 0.00, mean ⟨L⟩_V read 1.168 | lsq: spread read/true 0.00, mean ⟨L⟩_V read 0.973
box edge  δ 0.3 | lor: spread read/true 0.00, mean ⟨L⟩_V read 1.146 | lsq: spread read/true 0.90, mean ⟨L⟩_V read 0.968
box edge  δ 0.5 | lor: spread read/true 0.00, mean ⟨L⟩_V read 1.101 | lsq: spread read/true 1.03, mean ⟨L⟩_V read 0.967
```

## Out of sample: the same 1200 members read with other weights (`fix/line-oos.mjs`)

Per solid: max |Δ| of the peak, median (90 %); ⟨L⟩_V read ÷ true, median (10–90 %). The max |Δ| sits at the line's top and does not change with the weights.

**The tables' own sampling (|x| ≤ 6, weights 1/(p + 0.2)): reproduces line-errors.json**

| solid | lor: max \|Δ\| median (90 %); read median (10–90 %) | ib: max \|Δ\| median (90 %); read median (10–90 %) | mom: max \|Δ\| median (90 %); read median (10–90 %) | lsq: max \|Δ\| median (90 %); read median (10–90 %) |
|---|---|---|---|---|
| box | 16.9 % (19.9); 1.169 (1.144–1.189) | 16.4 % (19.7); 1.102 (1.079–1.121) | 6.4 % (7.7); 1.054 (1.037–1.059) | 5.8 % (7.5); 1.000 (1.000–1.000) |
| sqbox | 15.0 % (18.7); 1.156 (1.141–1.180) | 14.3 % (18.3); 1.090 (1.076–1.113) | 5.5 % (7.2); 1.047 (1.036–1.058) | 4.7 % (6.8); 1.000 (1.000–1.000) |
| cylinder | 16.6 % (18.6); 1.163 (1.145–1.176) | 16.1 % (18.3); 1.097 (1.080–1.109) | 5.8 % (6.9); 1.047 (1.035–1.056) | 5.0 % (6.4); 1.000 (1.000–1.000) |
| ellcyl | 17.9 % (18.6); 1.170 (1.152–1.173) | 17.5 % (18.3); 1.103 (1.086–1.106) | 6.2 % (6.4); 1.048 (1.040–1.049) | 5.4 % (5.7); 1.000 (1.000–1.000) |
| ellipsoid | 17.5 % (17.5); 1.163 (1.163–1.163) | 17.0 % (17.0); 1.097 (1.097–1.097) | 5.4 % (5.4); 1.041 (1.041–1.041) | 4.5 % (4.5); 1.000 (1.000–1.000) |
| spheroid | 17.5 % (17.5); 1.163 (1.163–1.163) | 17.0 % (17.0); 1.097 (1.097–1.097) | 5.4 % (5.4); 1.041 (1.041–1.041) | 4.5 % (4.5); 1.000 (1.000–1.000) |
| all | 17.5 % (18.6); 1.163 (1.147–1.176) | 17.0 % (18.3); 1.097 (1.082–1.109) | 5.4 % (6.9); 1.042 (1.038–1.057) | 4.5 % (6.4); 1.000 (1.000–1.000) |

**Tails weighted (|x| ≤ 10, weights 1/(p + 0.02))**

| solid | lor: max \|Δ\| median (90 %); read median (10–90 %) | ib: max \|Δ\| median (90 %); read median (10–90 %) | mom: max \|Δ\| median (90 %); read median (10–90 %) | lsq: max \|Δ\| median (90 %); read median (10–90 %) |
|---|---|---|---|---|
| box | 16.9 % (19.9); 1.255 (1.189–1.378) | 16.4 % (19.7); 1.184 (1.121–1.299) | 6.4 % (7.7); 1.082 (1.046–1.124) | 5.8 % (7.5); 1.019 (1.003–1.047) |
| sqbox | 15.0 % (18.7); 1.213 (1.181–1.310) | 14.3 % (18.3); 1.144 (1.114–1.236) | 5.5 % (7.2); 1.063 (1.043–1.103) | 4.7 % (6.8); 1.009 (1.002–1.032) |
| cylinder | 16.6 % (18.6); 1.240 (1.196–1.291) | 16.1 % (18.3); 1.169 (1.128–1.217) | 5.8 % (6.9); 1.068 (1.044–1.093) | 5.0 % (6.4); 1.013 (1.003–1.026) |
| ellcyl | 17.9 % (18.6); 1.269 (1.209–1.289) | 17.5 % (18.3); 1.197 (1.141–1.215) | 6.2 % (6.4); 1.076 (1.051–1.082) | 5.4 % (5.7); 1.019 (1.006–1.023) |
| ellipsoid | 17.5 % (17.5); 1.252 (1.252–1.252) | 17.0 % (17.0); 1.180 (1.180–1.180) | 5.4 % (5.4); 1.061 (1.061–1.061) | 4.5 % (4.5); 1.013 (1.013–1.013) |
| spheroid | 17.5 % (17.5); 1.252 (1.252–1.252) | 17.0 % (17.0); 1.180 (1.180–1.180) | 5.4 % (5.4); 1.061 (1.061–1.061) | 4.5 % (4.5); 1.013 (1.013–1.013) |
| all | 17.5 % (18.6); 1.252 (1.198–1.292) | 17.0 % (18.3); 1.180 (1.129–1.219) | 5.4 % (6.9); 1.061 (1.048–1.094) | 4.5 % (6.4); 1.013 (1.004–1.027) |

**Nearly flat (|x| ≤ 10, weights 1/(p + 2))**

| solid | lor: max \|Δ\| median (90 %); read median (10–90 %) | ib: max \|Δ\| median (90 %); read median (10–90 %) | mom: max \|Δ\| median (90 %); read median (10–90 %) | lsq: max \|Δ\| median (90 %); read median (10–90 %) |
|---|---|---|---|---|
| box | 16.9 % (19.9); 1.134 (1.124–1.138) | 16.4 % (19.7); 1.070 (1.060–1.073) | 6.4 % (7.7); 1.036 (1.029–1.037) | 5.8 % (7.5); 0.981 (0.971–0.992) |
| sqbox | 15.0 % (18.7); 1.130 (1.122–1.137) | 14.3 % (18.3); 1.066 (1.058–1.072) | 5.5 % (7.2); 1.034 (1.029–1.037) | 4.7 % (6.8); 0.987 (0.975–0.993) |
| cylinder | 16.6 % (18.6); 1.132 (1.124–1.136) | 16.1 % (18.3); 1.067 (1.060–1.071) | 5.8 % (6.9); 1.032 (1.028–1.036) | 5.0 % (6.4); 0.985 (0.978–0.992) |
| ellcyl | 17.9 % (18.6); 1.133 (1.127–1.134) | 17.5 % (18.3); 1.069 (1.063–1.069) | 6.2 % (6.4); 1.032 (1.030–1.032) | 5.4 % (5.7); 0.982 (0.980–0.990) |
| ellipsoid | 17.5 % (17.5); 1.131 (1.131–1.131) | 17.0 % (17.0); 1.066 (1.066–1.066) | 5.4 % (5.4); 1.029 (1.029–1.029) | 4.5 % (4.5); 0.986 (0.986–0.986) |
| spheroid | 17.5 % (17.5); 1.131 (1.131–1.131) | 17.0 % (17.0); 1.066 (1.066–1.066) | 5.4 % (5.4); 1.029 (1.029–1.029) | 4.5 % (4.5); 0.986 (0.986–0.986) |
| all | 17.5 % (18.6); 1.131 (1.125–1.136) | 17.0 % (18.3); 1.066 (1.061–1.071) | 5.4 % (6.9); 1.032 (1.029–1.037) | 4.5 % (6.4); 0.986 (0.978–0.991) |
