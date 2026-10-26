### 4.2 At the decided cells and range (the screening set, 7 runs per class)

Every cell × 0.8, 10–110°/0.01° (§5):

| class | members in range (list) | reflections (list) | ms/eval, search | evals: iso / search / report | s: iso / search / report | iso + search + report, s | truth reference, s |
|---|---|---|---|---|---|---|---|
| −1 | 70 (214) | 70 (214) | 51.2 | 1388 / 4447 / 1063 | 99 / 226 / 54 | 379 | 53 |
| 2/m | 71 (144) | 46 (88) | 28.4 | 665 / 4299 / 1391 | 24 / 123 / 38 | 186 | 26 |
| mmm | 68 (94) | 30 (41) | 18.2 | 426 / 3628 / 1325 | 8 / 65 / 25 | 99 | 15 |
| 4/m | 67 (102) | 22 (33) | 15.3 | 396 / 5322 / 946 | 5 / 85 / 15 | 106 | 20 |
| 4/mmm | 68 (93) | 19 (25) | 15.7 | 437 / 4566 / 1317 | 6 / 72 / 19 | 97 | 16 |
| −3 | 61 (91) | 23 (33) | 13.0 | 393 / 4068 / 1786 | 4 / 56 / 23 | 83 | 9 |
| −3m | 67 (104) | 22 (31) | 12.6 | 373 / 3635 / 1866 | 4 / 45 / 21 | 70 | 12 |
| 6/m | 69 (93) | 17 (21) | 10.6 | 294 / 3434 / 1341 | 2 / 36 / 14 | 52 | 10 |
| 6/mmm | 60 (103) | 14 (20) | 14.6 | 378 / 4519 / 2055 | 3 / 66 / 29 | 98 | 14 |
| m−3 | 73 (89) | 12 (14) | 12.4 | 289 / 3253 / 1186 | 2 / 42 / 16 | 59 | 12 |
| m−3m | 73 (89) | 10 (12) | 11.4 | 256 / 2719 / 454 | 2 / 30 / 5 | 36 | 8 |

- The mean is 115 s a run (median 85), against 134 s at C3. The longest run is
  ellcyl-P-1-near at 599 s.
- With the truth reference and the drawing (0.3–0.8 s a pattern), the mean is 133 s.
- The search's evaluations cost 14.6 ms (median; 7–57).
- **Where the time goes:** 67 % in the search, 20 % in the report, 13 % in the isotropic fit.
  P−1 costs 3.3× the mean, through its evaluations: a 6-parameter cell, a model list of 214
  reflections, and an isotropic fit of about 1400 evaluations, a quarter of its time.
- **The whole set.** The runs' own times sum to 147 min for the isotropic fit, search and
  report, and 171 min with the truth reference and the drawing. On 3 processes that is about
  49 and 57 min, on 2 about 74 and 86 min. (The batch ran on 3 processes, nice 15, in 63 min of
  elapsed time; a session limit stopped it once at 40 runs, and it resumed, the 3 runs in
  flight run again from the start.)
