cap: P (276 stages run) against PX uncapped

- not flagged: 171 stages, evaluations 326275 (median 692, 90 % 5020, max 13225); capped 0; not explored 23
- flagged: 105 stages, evaluations 164602 (median 1033, 90 % 3773, max 8316); capped 23; not explored 23

| row | error | stage evals capped / uncapped | search evals | returned χ² capped − uncapped (χ²_ν) | outcome | minima ≤ Δ*: capped / uncapped (the uncapped ones found) | extents E covered | axis E |
|---|---|---|---|---|---|---|---|---|
| box-P4m-near-a | impurity 0.83 | 1762 / 3333 | 4267 / 5838 | 0.00 | free / free | 2 / 3 (2) | 3/3 / 3/3 | 1 / 1 |
| box-P4m-generic-a | impurity 0.99 | 2054 / 3201 | 4701 / 5799 | 0.11 | free / free | 1 / 1 (1) | 3/3 / 3/3 | 1 / 1 |
| box-P6mmm-near-a | po 0.70 | 2294 / 5033 | 4343 / 7082 | 0.00 | held / held | 1 / 3 (1) | 3/3 / 3/3 | 0 / 1 |
| box-Pm-3m-on-a | po 0.46 | 5003 / 14273 | 6830 / 16117 | 12.67 | held / free | 1 / 4 (1) | 2/3 / 3/3 | 0 / 1 |
| sqbox-P4mmm-generic-a | po 0.86 | 3979 / 7191 | 5958 / 9170 | 0.00 | free / free | 2 / 3 (2) | 1/2 / 1/2 | 1 / 1 |
| ellcyl-P-3m1-generic-a | sizedist 0.51 | 4040 / 4895 | 8132 / 8987 | 0.00 | free / free | 2 / 3 (2) | 2/3 / 2/3 | 0 / 1 |
| ellcyl-P6mmm-on-a | impurity 0.94 | 1684 / 6204 | 3767 / 8287 | 0.00 | held / held | 2 / 4 (2) | 3/3 / 3/3 | 1 / 1 |
| ellipsoid-Pmmm-generic-a | impurity 0.76 | 8316 / 17237 | 11066 / 19987 | 0.00 | free / free | 1 / 1 (1) | 3/3 / 3/3 | 1 / 1 |
| ellipsoid-Pm-3m-near-a | sizedist 0.98 | 4513 / 7893 | 8249 / 11629 | 0.00 | free / free | 1 / 1 (1) | 3/3 / 3/3 | 1 / 1 |
| spheroid-P6mmm-near-a | hump 0.60 | 1971 / 2440 | 3854 / 4323 | 0.00 | free / free | 1 / 1 (1) | 2/2 / 2/2 | 1 / 1 |
| box-P-3-near-b |  | 1576 / 3277 | 3756 / 5456 | 0.66 | free / free | 1 / 3 (1) | 2/3 / 3/3 | 1 / 1 |
| box-Pm-3-generic-b | hump 0.35 | 1361 / 1692 | 4335 / 4666 | 0.00 | free / free | 2 / 3 (2) | 1/3 / 2/3 | 1 / 1 |
| box-Pm-3m-near-b | impurity 0.41 | 2727 / 6412 | 4433 / 8118 | 0.00 | held / held | 1 / 1 (1) | 3/3 / 3/3 | 1 / 1 |
| sqbox-Pmmm-on-b | impurity 0.56 | 1781 / 3843 | 4173 / 6235 | 0.00 | held / held | 2 / 2 (2) | 2/2 / 2/2 | 1 / 1 |
| sqbox-Pm-3m-generic-b | impurity 0.86 | 2234 / 5246 | 3816 / 6828 | 0.00 | held / held | 2 / 4 (2) | 2/2 / 2/2 | 1 / 1 |
| ellipsoid-P-3m1-generic-b | impurity 0.49 | 6249 / 12413 | 8394 / 14558 | 0.00 | free / free | 1 / 1 (1) | 3/3 / 3/3 | 1 / 1 |
| spheroid-P6mmm-on-b | po 0.91 | 1057 / 1477 | 2288 / 2708 | 0.00 | free / free | 2 / 2 (2) | 2/2 / 2/2 | 1 / 1 |
| sphere-P-1-6 | sizedist 0.95 | 4845 / 5161 | 7721 / 8037 | 0.00 | free / free | 3 / 3 (3) | — / — | — / — |
| sphere-P4mmm-4 | po 0.57 | 1151 / 2436 | 2519 / 3804 | 0.00 | held / held | 2 / 2 (2) | — / — | — / — |
| sphere-P-3m1-3 | impurity 0.92 | 1879 / 2399 | 3685 / 4205 | 0.00 | free / free | 3 / 4 (3) | — / — | — / — |
| sphere-P6m-1 | po 0.10 | 2286 / 5195 | 5605 / 8514 | 0.00 | held / held | 2 / 2 (2) | — / — | — / — |
| sphere-P6m-4 | impurity 0.49 | 2027 / 2987 | 3335 / 4295 | 0.00 | held / held | 3 / 3 (3) | — / — | — / — |
| sphere-P6mmm-5 | po 0.45 | 2892 / 3973 | 4853 / 5934 | 0.00 | held / held | 1 / 1 (1) | — / — | — / — |

Over the 23 rows P capped: stage 67681 against 128211 evaluations (0.53×), search 120080 against 180577 (0.66×); returned χ² higher by > 0.5 χ²_ν on 2; minima within Δ* 39 against 55, of the uncapped ones found 39; extents covered 40 against 43, axes 14 against 17.
