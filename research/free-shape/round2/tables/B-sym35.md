# Track B: the start cut on the 35 runs of the five classes with a random fill

Round 2, `../AB.md`. Made by `scripts/B/score.mjs --supersede` from the run records in `$W/fs2/B/results/` (not in the repository). Only tuning rows.

## Track B scores (35 runs: box-P-3m1-near,box-Pm-3-near,cylinder-P6m-on,cylinder-Pm-3m-on,ellcyl-P6m-generic,ellcyl-Pm-3m-generic,ellipsoid-P6mmm-generic,spheroid-P6mmm-near,sqbox-P-3m1-on,sqbox-Pm-3-on,box-P6m-generic,box-P6mmm-on,box-Pm-3m-generic,sqbox-P6m-near,sqbox-P6mmm-generic,sqbox-Pm-3m-near,cylinder-P-3m1-generic,cylinder-P6mmm-near,cylinder-Pm-3-generic,ellcyl-P-3m1-near,ellcyl-P6mmm-on,ellcyl-Pm-3-near,ellipsoid-P-3m1-on,ellipsoid-P6m-near,ellipsoid-Pm-3-on,ellipsoid-Pm-3m-near,spheroid-P-3m1-generic,spheroid-P6m-on,spheroid-Pm-3-generic,spheroid-Pm-3m-on,sphere-P-3m1-2,sphere-P6m-3,sphere-P6mmm-1,sphere-Pm-3-2,sphere-Pm-3m-3; tags sub1, sub2, sub2s, full, fullsub, sym25, held30, symfix)

Best known: the lowest exact χ² over every method run on the run (pilot today and truth reference, every variant). Δ in χ²_ν of that fit; reached Δ ≤ 1 on truths, early rejections not judged. Evaluations and wall s of the search (no report). "vs today": the pilot's today on the same run; solid changed: an extent > 5 % or the principal axis > 2° from today's (modulo the class). Wall ratio: the variant's search s over the today replica's (in the same process for the methods run with it, tag sub1; otherwise another process on the same rows, under the load of its time). Wall × pilot: against the pilot's own run of today (3 processes on an otherwise idle machine; these ran 2 beside another agent's 2–3: a load bias against the variants).

| variant | runs | evals (sum) | × today | median per-run ratio | wall × today replica (runs) | wall × pilot | ms/ev | held / free / rej (early) | same outcome | reported χ² vs today: within 0.1 / lower / higher (kept both) | solid changed (kept both) | reached / judged | Δ>1 runs | worst extent, median (90 %) | thinnest, median | axis °, median (90 %) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pilot | 35 | 122921 | 1.000 | 1.000 | 0.979 (10) | 1.000 | 12.4 | 18 / 8 / 9 (5) | 35/35 | 26 / 0 / 0 (26) | 0/26 | 24/27 | ellcyl-P6m-generic 1.1; ellcyl-P6mmm-on 62.9; ellcyl-Pm-3-near 2.6 | +81 % (+259 %) | +54 % | 16.5 (87.7) |
| fwd | 35 | 65522 | 0.533 | 0.526 | 0.616 (10) | 0.623 | 14.5 | 18 / 8 / 9 (5) | 35/35 | 23 / 2 / 1 (26): ellcyl-P6m-generic -1.05; box-P6m-generic -0.25; ellcyl-P-3m1-near +0.16 | 1/26 | 25/27 | ellcyl-P6mmm-on 59.4; ellcyl-Pm-3-near 2.6 | +81 % (+264 %) | +58 % | 17.1 (87.7) |
| fwdH* | 35 | 63894 | 0.520 | 0.524 | — (0) | — | — | 18 / 8 / 9 (5) | 35/35 | 23 / 2 / 1 (26): ellcyl-P6m-generic -1.05; box-P6m-generic -0.25; ellcyl-P-3m1-near +0.16 | 1/26 | 25/27 | ellcyl-P6mmm-on 59.4; ellcyl-Pm-3-near 2.6 | +81 % (+264 %) | +58 % | 17.1 (87.7) |
| symA | 35 | 54151 | 0.441 | 0.442 | 0.463 (10) | 0.471 | 13.3 | 18 / 8 / 9 (5) | 35/35 | 22 / 3 / 1 (26): ellcyl-P6m-generic -1.05; box-P6m-generic -0.25; sqbox-P6mmm-generic -0.34; ellcyl-P-3m1-near +0.16 | 1/26 | 25/27 | ellcyl-P6mmm-on 59.4; ellcyl-Pm-3-near 2.6 | +81 % (+264 %) | +58 % | 16.6 (87.7) |
| symAC | 35 | 54809 | 0.446 | 0.448 | 0.466 (10) | 0.475 | 13.3 | 18 / 8 / 9 (5) | 35/35 | 22 / 3 / 1 (26): ellcyl-P6m-generic -1.05; box-P6m-generic -0.29; sqbox-P6mmm-generic -0.35; ellcyl-P-3m1-near +0.16 | 1/26 | 25/27 | ellcyl-P6mmm-on 59.4; ellcyl-Pm-3-near 2.6 | +81 % (+264 %) | +58 % | 16.5 (87.7) |
| symA0 | 35 | 54510 | 0.443 | 0.446 | 0.496 (10) | 0.502 | 14.1 | 18 / 8 / 9 (5) | 35/35 | 22 / 3 / 1 (26): ellcyl-P6m-generic -1.05; box-P6m-generic -0.46; sqbox-P6mmm-generic -0.25; ellcyl-P-3m1-near +0.16 | 2/26 | 24/27 | cylinder-Pm-3m-on 2.6; ellcyl-P6mmm-on 59.8; ellcyl-Pm-3-near 2.4 | +81 % (+264 %) | +58 % | 14.0 (87.7) |
| symA0C | 35 | 55183 | 0.449 | 0.459 | 0.499 (10) | 0.506 | 14.0 | 18 / 8 / 9 (5) | 35/35 | 22 / 3 / 1 (26): ellcyl-P6m-generic -1.05; box-P6m-generic -0.49; sqbox-P6mmm-generic -0.33; ellcyl-P-3m1-near +0.16 | 2/26 | 24/27 | cylinder-Pm-3m-on 2.6; ellcyl-P6mmm-on 59.8; ellcyl-Pm-3-near 2.4 | +81 % (+264 %) | +58 % | 14.0 (87.7) |
| cuts | 35 | 50670 | 0.412 | 0.397 | 0.404 (10) | 0.432 | 13.1 | 18 / 8 / 9 (5) | 35/35 | 22 / 3 / 1 (26): ellcyl-P6m-generic -1.05; box-P6m-generic -0.25; sqbox-P6mmm-generic -0.34; ellcyl-P-3m1-near +0.16 | 1/26 | 25/27 | ellcyl-P6mmm-on 59.2; ellcyl-Pm-3-near 2.6 | +81 % (+264 %) | +58 % | 17.1 (87.7) |
| cutsC | 35 | 51301 | 0.417 | 0.404 | 0.407 (10) | 0.436 | 13.0 | 18 / 8 / 9 (5) | 35/35 | 22 / 3 / 1 (26): ellcyl-P6m-generic -1.05; box-P6m-generic -0.29; sqbox-P6mmm-generic -0.35; ellcyl-P-3m1-near +0.16 | 1/26 | 25/27 | ellcyl-P6mmm-on 59.2; ellcyl-Pm-3-near 2.6 | +81 % (+264 %) | +58 % | 17.1 (87.7) |
| cuts0 | 35 | 50970 | 0.415 | 0.397 | 0.413 (10) | 0.465 | 13.9 | 18 / 8 / 9 (5) | 35/35 | 21 / 3 / 2 (26): ellcyl-P6m-generic -1.05; box-P6m-generic -0.46; sqbox-P6mmm-generic -0.25; ellcyl-P-3m1-near +0.16; spheroid-P6m-on +0.15 | 1/26 | 24/27 | cylinder-Pm-3m-on 2.6; ellcyl-P6mmm-on 58.4; ellcyl-Pm-3-near 2.4 | +81 % (+264 %) | +58 % | 16.9 (87.7) |
| cuts0C | 35 | 51773 | 0.421 | 0.401 | 0.417 (10) | 0.471 | 13.9 | 18 / 8 / 9 (5) | 35/35 | 21 / 4 / 1 (26): ellcyl-P6m-generic -1.05; box-P6m-generic -0.49; sqbox-P6mmm-generic -0.33; sphere-P6mmm-1 -0.43; ellcyl-P-3m1-near +0.16 | 2/26 | 24/27 | cylinder-Pm-3m-on 2.6; ellcyl-P6mmm-on 58.4; ellcyl-Pm-3-near 2.4 | +81 % (+264 %) | +58 % | 16.8 (87.7) |

### Per Laue class: evaluations × today (sum over the class's runs) / wall × the today replica (runs with one) / wall × the pilot's today

| class | runs | fwd | fwdH* | symA | symAC | symA0 | symA0C | cuts | cutsC | cuts0 | cuts0C |
|---|---|---|---|---|---|---|---|---|---|---|---|
| -3m | 7 | 0.51 / 0.60 / 0.61 | 0.50 / — / — | 0.45 / 0.43 / 0.50 | 0.45 / 0.43 / 0.50 | 0.44 / 0.48 / 0.51 | 0.45 / 0.48 / 0.52 | 0.44 / 0.43 / 0.50 | 0.44 / 0.43 / 0.51 | 0.44 / 0.43 / 0.52 | 0.44 / 0.44 / 0.52 |
| 6/m | 7 | 0.54 / 0.67 / 0.71 | 0.54 / — / — | 0.49 / 0.49 / 0.53 | 0.49 / 0.50 / 0.54 | 0.51 / 0.53 / 0.60 | 0.52 / 0.53 / 0.61 | 0.47 / 0.48 / 0.51 | 0.48 / 0.48 / 0.51 | 0.49 / 0.49 / 0.59 | 0.49 / 0.50 / 0.59 |
| 6/mmm | 7 | 0.53 / 0.56 / 0.60 | 0.51 / — / — | 0.46 / 0.48 / 0.49 | 0.47 / 0.48 / 0.50 | 0.46 / 0.48 / 0.52 | 0.47 / 0.49 / 0.53 | 0.39 / 0.34 / 0.39 | 0.39 / 0.34 / 0.40 | 0.39 / 0.35 / 0.44 | 0.40 / 0.35 / 0.45 |
| m-3 | 7 | 0.56 / 0.69 / 0.61 | 0.54 / — / — | 0.42 / 0.46 / 0.43 | 0.43 / 0.47 / 0.44 | 0.41 / 0.52 / 0.44 | 0.42 / 0.52 / 0.45 | 0.42 / 0.44 / 0.42 | 0.43 / 0.44 / 0.43 | 0.41 / 0.44 / 0.41 | 0.42 / 0.44 / 0.41 |
| m-3m | 7 | 0.53 / 0.63 / 0.60 | 0.51 / — / — | 0.35 / 0.42 / 0.35 | 0.36 / 0.43 / 0.36 | 0.36 / 0.47 / 0.40 | 0.36 / 0.47 / 0.40 | 0.34 / 0.38 / 0.33 | 0.34 / 0.39 / 0.34 | 0.34 / 0.41 / 0.37 | 0.34 / 0.41 / 0.37 |

### Per run: evaluations, outcome, Δ

| run | class | best known | truth ref Δ | pilot | fwd | fwdH* | symA | symAC | symA0 | symA0C | cuts | cutsC | cuts0 | cuts0C |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box-P-3m1-near | -3m | 10072.8 | 0.21 | 3294 h Δ0.01 | 1594 h Δ0.01 | 1548 h Δ0.01 | 1289 h Δ0.01 | 1308 h Δ0.01 | 1275 h Δ0.00 | 1294 h Δ0.00 | 1270 h Δ0.01 | 1289 h Δ0.01 | 1256 h Δ0.00 | 1275 h Δ0.00 |
| box-Pm-3-near | m-3 | 21134.4 | 0.06 | 4076 h Δ0.09 | 2489 h Δ0.19 | 2301 h Δ0.19 | 1831 h Δ0.19 | 1848 h Δ0.19 | 1875 h Δ0.16 | 1892 h Δ0.16 | 1831 h Δ0.19 | 1848 h Δ0.19 | 1875 h Δ0.16 | 1892 h Δ0.16 |
| cylinder-P6m-on | 6/m | 10866.3 | 11.47 | 2662 h Δ0.00 | 1391 h Δ0.00 | 1391 h Δ0.00 | 1178 h Δ0.00 | 1193 h Δ0.00 | 1190 h Δ0.00 | 1205 h Δ0.00 | 1178 h Δ0.00 | 1193 h Δ0.00 | 1190 h Δ0.00 | 1205 h Δ0.00 |
| cylinder-Pm-3m-on | m-3m | 16943.2 | 3.75 | 3146 h Δ0.02 | 1624 h Δ0.00 | 1624 h Δ0.00 | 1197 h Δ0.00 | 1210 h Δ0.00 | 1350 h Δ2.61 | 1363 h Δ2.61 | 1063 h Δ0.00 | 1076 h Δ0.00 | 1216 h Δ2.61 | 1229 h Δ2.61 |
| ellcyl-P6m-generic | 6/m | 11065.3 | 45.56 | 5182 f Δ1.05 | 2827 f Δ0.00 | 2827 f Δ0.00 | 2552 f Δ0.00 | 2586 f Δ0.00 | 2552 f Δ0.00 | 2586 f Δ0.00 | 2552 f Δ0.00 | 2586 f Δ0.00 | 2552 f Δ0.00 | 2586 f Δ0.00 |
| ellcyl-Pm-3m-generic | m-3m | 11232.8 | 5.01 | 3130 h Δ0.00 | 1755 h Δ0.00 | 1662 h Δ0.00 | 1200 h Δ0.00 | 1217 h Δ0.00 | 1111 h Δ0.00 | 1128 h Δ0.00 | 1153 h Δ0.00 | 1170 h Δ0.00 | 1064 h Δ0.00 | 1081 h Δ0.00 |
| ellipsoid-P6mmm-generic | 6/mmm | 18405.5 | 26.90 | 4015 h Δ0.00 | 2085 h Δ0.00 | 1877 h Δ0.00 | 1622 h Δ0.00 | 1641 h Δ0.00 | 1596 h Δ0.00 | 1615 h Δ0.00 | 1460 h Δ0.00 | 1479 h Δ0.00 | 1434 h Δ0.00 | 1453 h Δ0.00 |
| spheroid-P6mmm-near | 6/mmm | 28764.7 | 245.51 | 5998 h Δ0.00 | 3395 h Δ0.00 | 3395 h Δ0.00 | 3196 h Δ0.00 | 3211 h Δ0.00 | 3143 h Δ0.00 | 3158 h Δ0.00 | 2355 h Δ0.00 | 2370 h Δ0.00 | 2352 h Δ0.00 | 2367 h Δ0.00 |
| sqbox-P-3m1-on | -3m | 10992.1 | 120.26 | 3976 h Δ0.19 | 1809 h Δ0.06 | 1809 h Δ0.06 | 1590 h Δ0.06 | 1605 h Δ0.06 | 1640 h Δ0.12 | 1655 h Δ0.12 | 1590 h Δ0.06 | 1605 h Δ0.06 | 1640 h Δ0.12 | 1655 h Δ0.12 |
| sqbox-Pm-3-on | m-3 | 15492.8 | 0.00 | 3095 h Δ0.00 | 1584 h Δ0.00 | 1500 h Δ0.00 | 1172 h Δ0.00 | 1187 h Δ0.00 | 1310 h Δ0.01 | 1339 h Δ0.00 | 1044 h Δ0.00 | 1059 h Δ0.00 | 1182 h Δ0.01 | 1211 h Δ0.00 |
| box-P6m-generic | 6/m | 10357.8 | 0.11 | 3748 f Δ0.49 | 1912 f Δ0.24 | 1912 f Δ0.24 | 1669 f Δ0.24 | 1700 f Δ0.20 | 2158 f Δ0.03 | 2189 f Δ0.00 | 1488 f Δ0.24 | 1519 f Δ0.20 | 1977 f Δ0.03 | 2008 f Δ0.00 |
| box-P6mmm-on | 6/mmm | 13688.4 | 7.29 | 3621 f Δ0.00 | 1837 f Δ0.00 | 1837 f Δ0.00 | 1605 f Δ0.00 | 1629 f Δ0.00 | 1639 f Δ0.00 | 1663 f Δ0.00 | 1353 f Δ0.00 | 1377 f Δ0.00 | 1288 f Δ0.00 | 1312 f Δ0.00 |
| box-Pm-3m-generic | m-3m | 239716.4 | 2.07 | 3574 h Δ0.00 | 1866 h Δ0.00 | 1818 h Δ0.00 | 1294 h Δ0.00 | 1311 h Δ0.00 | 1310 h Δ0.00 | 1327 h Δ0.00 | 1273 h Δ0.00 | 1290 h Δ0.00 | 1289 h Δ0.00 | 1306 h Δ0.00 |
| sqbox-P6m-near | 6/m | 17033.7 | 0.01 | 3174 r Δ0.00 | 1827 r Δ0.00 | 1827 r Δ0.00 | 1604 r Δ0.00 | 1604 r Δ0.00 | 1628 r Δ0.01 | 1628 r Δ0.01 | 1604 r Δ0.00 | 1604 r Δ0.00 | 1628 r Δ0.01 | 1628 r Δ0.01 |
| sqbox-P6mmm-generic | 6/mmm | 208058.9 | 36.89 | 4088 f Δ0.35 | 2094 f Δ0.36 | 1966 f Δ0.36 | 1792 f Δ0.01 | 1817 f Δ0.00 | 1791 f Δ0.09 | 1884 f Δ0.01 | 1792 f Δ0.01 | 1817 f Δ0.00 | 1791 f Δ0.09 | 1884 f Δ0.01 |
| sqbox-Pm-3m-near | m-3m | 13279.6 | 1.02 | 3454 r Δ0.00 | 1763 r Δ0.00 | 1579 r Δ0.00 | 1179 r Δ0.32 | 1179 r Δ0.32 | 1179 r Δ0.38 | 1179 r Δ0.38 | 1089 r Δ0.32 | 1089 r Δ0.32 | 1089 r Δ0.38 | 1089 r Δ0.38 |
| cylinder-P-3m1-generic | -3m | 10263.5 | 0.01 | 2702 f Δ0.00 | 1392 f Δ0.00 | 1392 f Δ0.00 | 1245 f Δ0.00 | 1267 f Δ0.00 | 1233 f Δ0.01 | 1255 f Δ0.00 | 1170 f Δ0.00 | 1192 f Δ0.00 | 1158 f Δ0.01 | 1180 f Δ0.00 |
| cylinder-P6mmm-near | 6/mmm | 11700.5 | 97.20 | 3238 h Δ0.33 | 1769 h Δ0.01 | 1769 h Δ0.01 | 1548 h Δ0.01 | 1563 h Δ0.01 | 1548 h Δ0.00 | 1563 h Δ0.00 | 1158 h Δ0.41 | 1173 h Δ0.41 | 1145 h Δ0.80 | 1160 h Δ0.80 |
| cylinder-Pm-3-generic | m-3 | 30393.4 | 3.77 | 3920 h Δ0.00 | 2470 h Δ0.00 | 2470 h Δ0.00 | 1875 h Δ0.00 | 1891 h Δ0.00 | 1812 h Δ0.01 | 1827 h Δ0.01 | 1875 h Δ0.00 | 1891 h Δ0.00 | 1812 h Δ0.01 | 1827 h Δ0.01 |
| ellcyl-P-3m1-near | -3m | 10047.7 | 2.16 | 4316 h Δ0.03 | 2058 h Δ0.01 ≠ | 1970 h Δ0.01 ≠ | 1729 h Δ0.01 ≠ | 1746 h Δ0.01 ≠ | 1714 h Δ0.00 ≠ | 1731 h Δ0.00 ≠ | 1729 h Δ0.01 ≠ | 1746 h Δ0.01 ≠ | 1714 h Δ0.00 ≠ | 1731 h Δ0.00 ≠ |
| ellcyl-P6mmm-on | 6/mmm | 93881.7 | 0.00 | 4347 h Δ62.91 | 2324 h Δ59.44 | 2168 h Δ59.44 | 1921 h Δ59.44 | 1958 h Δ59.44 | 2037 h Δ59.77 | 2074 h Δ59.77 | 1984 h Δ59.16 | 2003 h Δ59.16 | 2189 h Δ58.37 | 2208 h Δ58.37 |
| ellcyl-Pm-3-near | m-3 | 10197.1 | 0.00 | 3728 h Δ2.56 | 2428 h Δ2.56 | 2212 h Δ2.56 | 1852 h Δ2.56 | 1978 h Δ2.56 | 1664 h Δ2.44 | 1725 h Δ2.44 | 1852 h Δ2.56 | 1978 h Δ2.56 | 1664 h Δ2.44 | 1725 h Δ2.44 |
| ellipsoid-P-3m1-on | -3m | 11142.5 | 0.00 | 4071 h Δ0.00 | 2372 h Δ0.00 | 2288 h Δ0.00 | 2042 h Δ0.00 | 2061 h Δ0.00 | 1913 h Δ0.00 | 1932 h Δ0.00 | 2042 h Δ0.00 | 2061 h Δ0.00 | 1913 h Δ0.00 | 1932 h Δ0.00 |
| ellipsoid-P6m-near | 6/m | 10294.1 | 3.42 | 3701 h Δ0.00 | 2084 h Δ0.00 | 2021 h Δ0.00 | 1841 h Δ0.00 | 1860 h Δ0.00 | 1842 h Δ0.00 | 1861 h Δ0.00 | 1685 h Δ0.00 | 1704 h Δ0.00 | 1558 h Δ0.00 | 1577 h Δ0.00 |
| ellipsoid-Pm-3-on | m-3 | 10522.5 | 0.00 | 4148 h Δ0.05 | 1787 h Δ0.00 | 1745 h Δ0.00 | 1631 h Δ0.00 | 1646 h Δ0.00 | 1499 h Δ0.00 | 1514 h Δ0.00 | 1631 h Δ0.00 | 1646 h Δ0.00 | 1499 h Δ0.00 | 1514 h Δ0.00 |
| ellipsoid-Pm-3m-near | m-3m | 10144.1 | 0.00 | 2134 e Δ— | 1129 e Δ— | 1129 e Δ— | 698 e Δ— | 698 e Δ— | 698 e Δ— | 698 e Δ— | 698 e Δ— | 698 e Δ— | 698 e Δ— | 698 e Δ— |
| spheroid-P-3m1-generic | -3m | 45166.9 | 5.17 | 4059 f Δ0.00 | 2127 f Δ0.00 | 2127 f Δ0.00 | 1937 f Δ0.00 | 1978 f Δ0.00 | 1926 f Δ0.00 | 1967 f Δ0.00 | 1846 f Δ0.00 | 1884 f Δ0.00 | 1856 f Δ0.00 | 1898 f Δ0.00 |
| spheroid-P6m-on | 6/m | 10136.1 | 0.00 | 2646 f Δ0.00 | 1393 f Δ0.00 | 1393 f Δ0.00 | 1678 f Δ0.00 | 1700 f Δ0.00 | 1666 f Δ0.00 | 1688 f Δ0.00 | 1593 f Δ0.00 | 1615 f Δ0.00 | 1571 f Δ0.15 | 1637 f Δ0.06 |
| spheroid-Pm-3-generic | m-3 | 11646.1 | 0.00 | 1885 e Δ— | 1044 e Δ— | 1044 e Δ— | 641 e Δ— | 641 e Δ— | 641 e Δ— | 641 e Δ— | 641 e Δ— | 641 e Δ— | 641 e Δ— | 641 e Δ— |
| spheroid-Pm-3m-on | m-3m | 12774.3 | 0.00 | 1802 e Δ— | 969 e Δ— | 969 e Δ— | 579 e Δ— | 579 e Δ— | 579 e Δ— | 579 e Δ— | 579 e Δ— | 579 e Δ— | 579 e Δ— | 579 e Δ— |
| sphere-P-3m1-2 | -3m | 17389.8 | — | 3027 r Δ— | 1641 r Δ— | 1641 r Δ— | 1539 r Δ— | 1539 r Δ— | 1561 r Δ— | 1561 r Δ— | 1539 r Δ— | 1539 r Δ— | 1561 r Δ— | 1561 r Δ— |
| sphere-P6m-3 | 6/m | 13446.0 | — | 2922 r Δ— | 1512 r Δ— | 1512 r Δ— | 1248 r Δ— | 1248 r Δ— | 1249 r Δ— | 1249 r Δ— | 1248 r Δ— | 1248 r Δ— | 1249 r Δ— | 1249 r Δ— |
| sphere-P6mmm-1 | 6/mmm | 11826.3 | — | 6324 f Δ— | 3177 f Δ— | 3177 f Δ— | 2948 f Δ— | 2981 f Δ— | 2952 f Δ— ≠ | 2984 f Δ— ≠ | 2076 f Δ— | 2103 f Δ— | 2111 f Δ— | 2246 f Δ— ≠ |
| sphere-Pm-3-2 | m-3 | — | — | 1922 e Δ— | 1031 e Δ— | 1031 e Δ— | 644 e Δ— | 644 e Δ— | 644 e Δ— | 644 e Δ— | 644 e Δ— | 644 e Δ— | 644 e Δ— | 644 e Δ— |
| sphere-Pm-3m-3 | m-3m | 19254.7 | — | 1796 e Δ— | 963 e Δ— | 963 e Δ— | 585 e Δ— | 585 e Δ— | 585 e Δ— | 585 e Δ— | 585 e Δ— | 585 e Δ— | 585 e Δ— | 585 e Δ— |

### By stage: evaluations a run (mean over the runs the variant ran), iterations a refinement (mean) in brackets; cov: the returned fit's covariance alone

| variant | runs | brief | full | polish | exact | held | refit | central | cov |
|---|---|---|---|---|---|---|---|---|---|
| fwd | 35 | 1176 (7.7) | 413 (12.1) | 49 (3.3) | 28 (2.7) | 174 (9.1) | 17 (2.8) | 37 (1.6) | 14 |
| symA | 35 | 882 (7.7) | 428 (12.4) | 57 (3.9) | 30 (3.0) | 119 (9.6) | 17 (2.8) | 33 (1.3) | 14 |
| symA0 | 35 | 882 (7.7) | 428 (12.4) | 61 (4.6) | 30 (2.9) | 126 (10.0) | 17 (2.8) | 33 (1.3) | 14 |
| cuts | 35 | 882 (7.7) | 318 (12.7) | 56 (3.9) | 35 (3.4) | 126 (9.7) | 17 (2.8) | 32 (1.3) | 14 |
| cuts0 | 35 | 882 (7.7) | 318 (12.7) | 64 (4.6) | 33 (3.2) | 129 (10.2) | 17 (2.9) | 37 (1.5) | 14 |

### The central pass (the returned fit refined once more with central differences)

- fwdC: 26 kept runs; 38 evaluations (median; 28–159), iterations 1; χ² lowered by 0.0004 χ²_ν (median), 0.249 at most; 1 runs by more than 0.1, 0 by more than 1.
- fwdHC: 10 kept runs; 33 evaluations (median; 28–59), iterations 1; χ² lowered by 0.0001 χ²_ν (median), 0.003 at most; 0 runs by more than 0.1, 0 by more than 1.
- fullDropC: 10 kept runs; 33 evaluations (median; 28–59), iterations 1; χ² lowered by 0.0001 χ²_ν (median), 0.003 at most; 0 runs by more than 0.1, 0 by more than 1.
- fullRepC: 10 kept runs; 33 evaluations (median; 28–59), iterations 1; χ² lowered by 0.0001 χ²_ν (median), 0.003 at most; 0 runs by more than 0.1, 0 by more than 1.
- symA0C: 26 kept runs; 38 evaluations (median; 28–116), iterations 1; χ² lowered by 0.0003 χ²_ν (median), 0.082 at most; 0 runs by more than 0.1, 0 by more than 1.
- symC0C: 10 kept runs; 33 evaluations (median; 28–59), iterations 1; χ² lowered by 0.0000 χ²_ν (median), 0.003 at most; 0 runs by more than 0.1, 0 by more than 1.
- cuts0C: 26 kept runs; 38 evaluations (median; 28–160), iterations 1; χ² lowered by 0.0004 χ²_ν (median), 0.476 at most; 1 runs by more than 0.1, 0 by more than 1.
- symAC: 26 kept runs; 38 evaluations (median; 28–143), iterations 1; χ² lowered by 0.0004 χ²_ν (median), 0.059 at most; 0 runs by more than 0.1, 0 by more than 1.
- symCC: 10 kept runs; 33 evaluations (median; 28–59), iterations 1; χ² lowered by 0.0001 χ²_ν (median), 0.003 at most; 0 runs by more than 0.1, 0 by more than 1.
- cutsC: 26 kept runs; 38 evaluations (median; 28–143), iterations 1; χ² lowered by 0.0004 χ²_ν (median), 0.059 at most; 0 runs by more than 0.1, 0 by more than 1.
