# Track B: where the search's wall time goes

Round 2, `../AB.md`. Made by `scripts/B/prof.mjs` (engine `hp/`: a timer around phasePattern, a flag inside the Jacobians) from the run records in `$W/fs2/B/results/` (not in the repository). Only tuning rows.

Two profile runs, one process each, today then fwd in one process per row. `prof.out` first, `prof2.out` (with the Jacobian split) second.

```
box-Pm-3-near today: search 4076 ev 56309 ms; in phasePattern 54757 ms (13.43 ms/ev); outside 1552 ms = 2.8 %; iterations 161
box-Pm-3-near fwd: search 2523 ev 42763 ms; in phasePattern 40872 ms (16.20 ms/ev); outside 1891 ms = 4.4 %; iterations 192
cylinder-P4mmm-on today: search 3513 ev 56434 ms; in phasePattern 54937 ms (15.64 ms/ev); outside 1497 ms = 2.7 %; iterations 143
cylinder-P4mmm-on fwd: search 2440 ev 43252 ms; in phasePattern 41555 ms (17.03 ms/ev); outside 1697 ms = 3.9 %; iterations 182
ellcyl-P2m-generic today: search 4319 ev 91994 ms; in phasePattern 90534 ms (20.96 ms/ev); outside 1460 ms = 1.6 %; iterations 140
ellcyl-P2m-generic fwd: search 2147 ev 56771 ms; in phasePattern 55369 ms (25.79 ms/ev); outside 1402 ms = 2.5 %; iterations 141
box-Pm-3-near today: search 4076 ev 60857 ms; in phasePattern 59149 ms (14.51 ms/ev); outside 1708 ms = 2.8 %; iterations 161; in Jacobians 3428 ev 13.46 ms/ev, elsewhere 648 ev 20.07 ms/ev
box-Pm-3-near fwd: search 2523 ev 44790 ms; in phasePattern 42800 ms (16.96 ms/ev); outside 1990 ms = 4.4 %; iterations 192; in Jacobians 1832 ev 14.86 ms/ev, elsewhere 691 ev 22.54 ms/ev
ellcyl-P2m-generic today: search 4319 ev 93648 ms; in phasePattern 92085 ms (21.32 ms/ev); outside 1563 ms = 1.7 %; iterations 140; in Jacobians 4046 ev 19.48 ms/ev, elsewhere 273 ev 48.64 ms/ev
ellcyl-P2m-generic fwd: search 2147 ev 48961 ms; in phasePattern 47831 ms (22.28 ms/ev); outside 1130 ms = 2.3 %; iterations 141; in Jacobians 1883 ev 19.02 ms/ev, elsewhere 264 ev 45.55 ms/ev
```
