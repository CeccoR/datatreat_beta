# Free shape, round 2

Round 2 of the free-shape work, run under `../PROTOCOL.md` (synthetic data only; 198 truths and 33 spheres
from a designed experiment, split by truth into a tuning part of 154 runs and a validation part of 77 scored
once). Round 1 is `../FREE-SHAPE.md`.

**What round 2 found, and what the prototype does.** The pilot showed that today's error on exact line
shapes came mostly from the engine's Lorentzian size line, not from the search: it reads ⟨L⟩_V 13–25 % long
and pulls a solid toward equant (worst extent +42 %, anisotropy read at three quarters on the screening
runs). The prototype (`proto/`, a patch of the app's engine behind switches that give v522 back) replaces it
by the solid's exact line (WPPM), made cheaper than the Lorentzian by three shortcuts; cuts the search
(forward differences in the brief trials, no intermediate covariance, held frames once per orbit, the class's
distinct starts); checks every fit line by line, with a jackknife over lines where the check fires; refines
every true minimum to the same level and gives each parameter two errors (local, and the spread over the
minima) and a uniqueness verdict; keeps a shape by a likelihood-ratio threshold set by the Laue class; and, on
request, says which family of solid the data tell apart. Confirmed unchanged on the 154 tuning runs and
frozen, it was scored once on the 77 validation runs against today's search: 65 of 66 truths kept (61), no
clean sphere kept (2 of 5), the clean extents read within 1 % (worst, median; today +28 %) and the anisotropy
at 1.00 (0.77), intervals covering 80 of 80 clean extents (today's esds 17 of 76), no clean truth given a wrong family (0 of 33), at 0.85×
today's evaluations and 0.53× its wall. Its shortfalls: the angles' intervals cover 84 % of the clean axes,
and a size distribution or texture can still make a shape, an unflagged one or a wrong family where the
model lacks the error.

## Index

| file | what |
|---|---|
| `../PROTOCOL.md` | the test protocol agreed for round 2: the design, the split, the stages, the figures of merit |
| `PILOT.md` | stage 1: the generator checked, the cost, cells and range decided, today's search on the 77 screening runs (the reference) |
| `AB.md` | stage 2, screening: track A (the size line: Lorentzian, lsq, WPPM) and track B (the search's efficiency) |
| `STEP1.md` | search v2 in the engine with the lsq line and WPPM; forward differences in the brief trials only |
| `STEP2.md` | WPPM made cheaper (`WPPM_OPT`); the exact line the free shape's default |
| `STEP3.md` | the per-line check and the jackknife over lines |
| `STEP4.md` | the minima stage: every true minimum, two errors per parameter, uniqueness, directions as sets |
| `STEP5.md` | the solid's family (on request) and the keep test by the Laue class |
| `CONFIRM.md` | stage 3: the prototype confirmed on the 154 tuning runs, no tunable changed, the freeze |
| `VALIDATION.md` | stage 4: the frozen prototype and today's search on the 77 validation runs, scored once |
| `proto/` | the prototype: `engine.patch` (against `9782d33`, applies to the branch), `README.md` (its parts, switches, frozen tunables, verifications 1–9), `xrd-sizeline.js`, `build-sizeline.mjs`, `verify/` |
| `tables/` | the small tables each note reads (`pilot-*`, `A-*`, `B-*`, `step1-*` … `step6-*`; `step6-frozen.md`: the frozen tunables) |
| `scripts/` | the scripts behind every number, one folder per stage (`README.md` there; `step6/` for the confirmation and the validation) |
| `checkpoint/` | raw copies of the scratch work taken during the runs (to be condensed once round 2's write-up is final) |
