# Track A: the size line's shape in the model

Round 2 of the free-shape research, Track A (`research/free-shape/round2/PILOT.md` §6, §8: the
engine's Lorentzian size line, not the search, is the main source of inaccuracy on exact data).
Paths are relative to this folder,
`/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/fs2/A`.
Node 22: `/opt/node22/bin/node`. Everything shared (`../gen`, `../phases`, `../harness`, `../design`,
`../pilot`) is read only; what changes is copied here. Only tuning rows were run.

## The size-line models

Each member's size line is drawn by the engine's own TCH pseudo-Voigt; what changes is the
Gaussian and Lorentzian FWHM fed to it, as multipliers [kg, kl] on the engine's Lorentzian width
w (FWHM 0.675/⟨L⟩_V in d*): HG² += (kg·w/cosθ)², HL += kl·w/cosθ. The same for the isotropic
sphere's line (Ys), so the keep criterion compares like with like.

| mode | what | how |
|---|---|---|
| `lor` | today's: a Lorentzian, FWHM 0.675/⟨L⟩_V | [0, 1]; bit-identical to the frozen engine |
| `ib` | (a) the breadth convention: a Lorentzian of integral breadth 1/⟨L⟩_V | [0, 2/(π·0.675)] = [0, 0.9431] |
| `mom` | (b1) TCH line with the exact line's Porod tail (l = ⟨L⟩_V/(π⟨L⟩_A)) and integral breadth (peak 1) | tables |
| `lsq` | (b2) TCH line that best fits the exact line (weighted least squares, \|x\| ≤ 6/⟨L⟩_V, weights 1/(p + 0.2)) | tables |
| `wppm` | (c) the exact line by the Fourier route: the engine's own WPPM profile (`FS2A_PROFILE=wppm`) | engine |

Tables (`lines/tables.json`, `lines/build-tables.mjs`, 18 s): the reduced shape along a member
(A(L) in ξ = L/T, T its support) is one function for the ball family (sphere, ellipsoid,
spheroid), one ratio for the cylinder and elliptic cylinder (ψ, the angle from the axis in the
scaled body; 0–90° every 0.5°, linear), two for the box (β = b/a, γ = c/a of the sorted scaled
direction components; 0–1 every 0.025, bilinear). The exact lines are this folder's own Fourier
transforms of A(L) (`lines/profiles.mjs`), checked against the generator's A(L) (`../gen/kernels.mjs`)
to 3·10⁻¹⁵ of the peak; the generator is never called by the model.

## Files

- `make-eng.mjs`: builds `eng/` (`../harness/eng` copied, `xrd-rietveld.js` patched: `eng.diff`) and
  `harness/lib.mjs` (`../harness/lib.mjs` with its imports here). Patches: `profileAtThetaG`,
  `shapeKs` (per member [kg, kl] from `lines/sizeline.mjs`), `shapeLine` and the isotropic line
  through them; `FS2A_NOEARLY=1` switches freeShape's early rejection off (the cross-solid fits).
- `lines/`: `profiles.mjs` (exact lines, TCH, fits), `build-tables.mjs`, `tables.json`, `sizeline.mjs`
  (the engine's lookup), `line-errors.mjs` (the line alone), `pattern-check.mjs` (the line in a
  pattern, against the generator's exact pattern without noise), `explore*.mjs` (first looks).
- `run.mjs`, `batch.mjs` (≤ 2 processes, nice 15, resumable, refuses validation rows; `--line`,
  `--profile`, `--shapes`, `--kernel`), `analyse.mjs` (the variant tables), `xconf.mjs` (confusion
  matrices), `colmatch.mjs` (what the column lengths alone tell apart), `colsep.mjs` (noise-free
  separations), `bench.mjs` (ms per evaluation).
- `subscreen.txt`: the 22 sub-screen rows and their rule.
- `results/<tag>/`: run records. `tr-*` truth references, `s-*` today's search + truth reference,
  `sph-*` spheres, `xs-*` cross-solid fits, `screen-*` the finalists' screening runs.

## Commands

```sh
node make-eng.mjs                                   # eng/, eng.diff, harness/lib.mjs
node lines/build-tables.mjs                         # lines/tables.json (18 s)
node lines/line-errors.mjs --n 200                  # the line alone, per variant (results/line-errors.json)
FS2A_LINE=lsq node lines/pattern-check.mjs --rows subscreen --out results/pattern/sub-lsq.json
node lines/family.mjs; node lines/shapes.mjs        # the equant pull on one family; the exact lines' shapes
node batch.mjs --tag tr-lsq --rows subscreen --line lsq --method truth           # truth references
node batch.mjs --tag s-lsq --rows subscreen --line lsq --method today,truth      # today's search + reference
node batch.mjs --tag s-wppm --rows subscreen --profile wppm --method today,truth
node batch.mjs --tag sph-lsq --rows spheres --line lsq --method today
node batch.mjs --tag s-hyb --rows subscreen --line lsq --method hybrid
FS2A_NOEARLY=1 node batch.mjs --tag xs-wppm --rows subclean --shapes all --profile wppm --method today
node analyse.mjs --v lor=../pilot/results/screen,lsq=results/screen-lsq --rows screen --out results/screen-lsq.md --json results/screen-lsq-digest.json
node xconf.mjs --m lor=results/xs-lor,wppm=results/xs-wppm --out results/xconf.md --json results/xconf.json
node colmatch.mjs --rows subclean; FS2A_LINE=lor node colsep.mjs --kernel none --out results/colsep-none-lor.json
node bench.mjs --rows a,b --n 20                    # per mode (FS2A_LINE / FS2A_PROFILE)
# after the restart (2026-10-27): the rest of screen-wppm resumed, the cross-solid fits with (b), the final tables
node batch.mjs --tag screen-wppm --rows $(cat rest44.txt) --profile wppm --method today,truth
node prep-xs.mjs results/s-lsq results/xs-lsq
FS2A_NOEARLY=1 node batch.mjs --tag xs-lsq --rows subclean --shapes all --line lsq --method today
node analyse.mjs --v lor=../pilot/results/screen,lsq=results/screen-lsq,wppm=results/screen-wppm --rows screen --out results/screen-final.md --json results/screen-final-digest.json
node bygroup.mjs results/screen-final-digest.json; node perclass.mjs results/screen-final-digest.json; node cost.mjs results/screen-final-digest.json
node analyse.mjs --v lor=../pilot/results/screen,ib=results/tr-ib,mom=results/tr-mom,lsq=results/s-lsq,wppm=results/s-wppm,hyb=results/s-hyb --rows subscreen --sections ref,search --out results/sub-all.md
node xconf.mjs --m lor=results/xs-lor,lsq=results/xs-lsq,wppm=results/xs-wppm --out results/xconf3.md --json results/xconf3.json
node nested.mjs results/xconf3.json; node why.mjs --x results/xconf3.json --out results/why.md
node lines/linediff.mjs                             # the exact lines of different solids against each other
```

## Results (results/)

| tag / file | what |
|---|---|
| `check/` | lor mode against the pilot record: bit-identical (χ², evaluations, dims) |
| `line-errors.json`, `lines-extra.out` | the line alone; exact line shapes; the two-member family test |
| `pattern/{sub,sph}-{lor,ib,mom,lsq,wppm}.json` | the line in the pattern, noise-free, at the truth |
| `tr-{ib,lsq,mom,wppm,inmodel}/` | truth references on the 22 sub-screen rows (`inmodel`: the engine's own lines, lor model: the floor) |
| `s-{lsq,wppm,hyb}/`, `sph-{lsq,wppm,hyb}/` | today's search on the sub-screen and the 11 screening spheres |
| `screen-lsq/`, `screen-wppm/` | the finalists on the 77-run screening set (sub-screen and sphere records copied in; the runs are deterministic) |
| `xs-lor/`, `xs-wppm/` | each clean sub-screen row searched as each of the six solids, no early rejection |
| `colmatch.json`, `colsep-*.json` | what the column lengths alone tell apart; noise-free separations |
| `bench-*.json` | ms per phase-pattern evaluation, per mode |
| `xs-lsq/` | the same with the (b) line |
| `tr-sub.md`, `screen-lsq.md`, `xconf.md`, `screen-lsq-bygroup.md` | tables (before the restart) |
| `sub-all.md`, `sph-all.md` | the sub-screen: truth references of every line model and today's search with lor, lsq, wppm, hyb; the spheres |
| `screen-final*.md`, `screen-final-digest.json` | the 77-run screening set with lor, lsq, wppm: tables, by group, per class, cost |
| `xconf3.md`, `xconf3.json`, `nested.md`, `why.md`, `linediff.md` | the solids: confusion matrices (lor, lsq, wppm), nested-family counts, what sets them apart |
| `colsep-exact-wppm.broken.out`, `colsep-none-lor.broken.out` | colsep before its weights were fixed: wrong, kept as a record; only `colsep-none-lor.json` stands |

The WPPM route (c) uses the engine's own `wppmLine` and its A(L) (`xrd-broad.js` covBase), the
same synthesis routine the generator uses for its correction term: against the generator's
pattern without noise it is 0.29 % of the peak off (median; 90th percentile 0.65 %), the TCH
line's own error in the generator's main term. Its accuracy is close to an exact model's by
construction; (b) is this folder's own tables and the engine's TCH line.
