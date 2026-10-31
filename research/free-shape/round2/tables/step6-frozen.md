# The frozen prototype (step 6)

Frozen 2026-10-31 11:02 UTC, after the confirmation on the 154 tuning runs and before any validation row was drawn or run (`../CONFIRM.md` §9). No tunable changed from step 5. The values as the engine read them (`$W/fs2/step6/FROZEN.json`, which also holds the sha256 of the engine files every validation run was checked against):

| switch or tunable | frozen value |
|---|---|
| `SHAPE_MODE` | `{line: exact, search: v2}` |
| `WPPM_OPT` (xrd-broad.js) | `{fast: true, pair: true, axial: true}` |
| `SHAPE_FILL` | 0 |
| `SHAPE_CENTRAL` | true |
| `SHAPE_FWD` | briefs |
| `SHAPE_CHECK` | `{on: true, z: 3.09, bin: 1, minsep: 0.3, jack: true, groups: 20, iter: 4, retest: false}` |
| `SHAPE_MINIMA` | `{on: true, collect: 30, preLn: 0.1, preDeg: 5, max: 6, kick: 0.02, rounds: 10, gain: 0.5, shift: 0, k: 2, floorLn: 0.02, floorDeg: 1, capDeg: 10, delta: 16, deltaMisfit: 25, keep: 30, kappa: 1.2}` |
| `SHAPE_KEEP` | `{rule: lrt, alpha: 0.001, margin: 2, misfit: true, bic: 10, early: 0.5, record: false}` |
| `SHAPE_FAMILY` | `{solids: none, margin: 14, marginMisfit: 35, nest: {box: 3.84, cyl: 5.99, ball: 5.99}, nestMisfit: 25}` |

Unchanged as well: the tables of `xrd-sizeline.js` (the lsq line only: steps 0.5° and 0.025, span 6, weights b 0.2) and `lowIndexAxes` (5 families). The app files with the patch applied to `9782d33` (sha256, first 16 hex digits):

- `xrd-rietveld.js`: `da6b65f13ddb7847`
- `xrd-broad.js`: `8e451deae01bf62e`
- `xrd-sizeline.js`: `f7c8b9a9c029ec85`
- `sw.js`: `5c03d10bff27475b`
- `RIETVELD.md`: `16a645e66a349c89`
