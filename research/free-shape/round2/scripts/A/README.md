# Track A: the size line's shape in the model

Round 2 of the free-shape research, Track A (`research/free-shape/round2/PILOT.md` §6, §8: the
engine's Lorentzian size line, not the search, is the main source of inaccuracy on exact data).
Paths are relative to this folder,
`$W/fs2/A`.
Node 22: `/opt/node22/bin/node`. Everything shared (`../gen`, `../phases`, `../harness`, `../design`,
`../pilot`) is read only; what changes is copied here. Only tuning rows were run.

**In the repository** (`research/free-shape/round2/scripts/A/`): the scripts only. The write-up is
`../../AB.md`. Not copied, and rebuilt by the commands below: `eng/` and `harness/lib.mjs`
(`node make-eng.mjs`) and `lines/tables.json` (`cd lines && node build-tables.mjs`, 18 s; rebuilt byte for byte).
The run records (`results/`, one JSON per run, 15 MB) stay in the work folder; the small tables
quoted in AB.md are in `../../tables/` as `A-*.md`. `verify/` holds the skeptic's own checks
(`indep-line.mjs`, `fisher-line.mjs`, `cmp.mjs`, `methods/rival.mjs`); they ran from
`$W/fs2/A-verify` and import from there: `cp -r verify $W/fs2/A-verify` before running them.

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
(cd lines && node build-tables.mjs)                # lines/tables.json (18 s; it writes to the working folder)
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

## Findings (final, 2026-10-27)

Medians unless said; "worst" is the largest |extent error| of a run, +∞ when an extent is read
unbounded; axis is the truth's most distinct axis. Scored by the pilot's report.mjs rules
(analyse.mjs). Validation rows were never run or read.

**The line alone and in the pattern** (`line-errors.json`, 200 random members per solid in the
design's ranges; `pattern/`, the generator's pattern without noise at the truth, 21 sub-screen
rows without texture):

| model | line: max \|Δ\| of the peak (90 %) | ⟨L⟩_V read ÷ true | pattern: max \|Δ\| (90 %) | excess χ²_ν (90 %) |
|---|---|---|---|---|
| lor | 17.5 % (18.6) | 1.163 | 13.0 % (16.1) | 0.81 (3.94) |
| ib (a) | 17.0 % (18.3) | 1.097 | 11.7 % (15.3) | 0.66 (2.94) |
| mom (b1) | 5.4 % (6.9) | 1.042 | 4.2 % (6.0) | 0.10 (0.24) |
| lsq (b2) | 4.5 % (6.4) | 1.000 | 3.6 % (5.6) | 0.04 (0.12) |
| wppm (c) | — | — | 0.29 % (0.65) | 0.000 (0.007) |

The exact lines of different solids at one ⟨L⟩_V differ by 1–12 % of the peak (`linediff.md`:
ball against a box edge 4.8 %, against a cylinder across 1.7 %; a box edge and a cylinder along
its axis are the same line). The Lorentzian is 11.5–21 % off every one of them, the lsq line
2.5–8 %.

**The 77-run screening set** (`screen-final*.md`; lor is the pilot's run):

| model | truth ref: thinnest / worst (90 %) / axis ° | search: kept | reach | worst (90 %) | thinnest | axis ° (90 %) | clean: worst / axis / anisotropy | spheres kept | s/run (ev, ms/ev) |
|---|---|---|---|---|---|---|---|---|---|
| lor | +19 % / +38 % (+101) / 5.0 | 60/66 | 58/63 | +42 % (+290) | +20 % | 6.8 (79.0) | +32 % / 7.6 / 0.74 | 3/11 | 115 (3990, 14.6) |
| lsq | +1 % / +13 % (+338) / 3.1 | 65/66 | 65/66 | +16 % (+232) | +1 % | 4.3 (31.8) | +10 % / 3.8 / 0.95 | 2/11 | 99 (3552, 14.1) |
| wppm | +0 % / +4 % (+410) / 1.3 | 66/66 | 62/66 | +4 % (+335) | +0 % | 1.6 (14.4) | +2 % / 0.9 / 0.99 | 2/11 | 254 (3331, 33.9) |

(s/run: superseded by the fix round below, item 1: these are the runs' own walls under different loads; under one load wppm costs 2.88× lor, lsq 0.99×. Old note: isotropic fit + search + report, the runs' own time; lor ran on 3 processes in the pilot,
lsq and wppm on 2 beside track B's 2: the evaluations and `bench-*.json`, run back to back under
one load, are the like-for-like cost: lsq 3.4–8.1 ms an evaluation against lor 4.0–7.6, wppm
12.4–78.6, 2.4–13× lor's, the more the more members.)

**The solids** (`xconf3.md`, `nested.md`; 11 clean sub-screen rows × 6 solids, early rejection
off): right / nested-family member (box ↔ square box, elliptic cylinder ↔ cylinder, ellipsoid ↔
spheroid) / another family:

| model | by χ² | by BIC |
|---|---|---|
| lor | 5 / 1 / 5 | 6 / 1 / 4 |
| lsq | 7 / 3 / 1 | 6 / 2 / 3 |
| wppm | 7 / 4 / 0 | 7 / 3 / 1 |

(Counted with no margin; with a margin, and with each model's expected margin, see the fix round below, item 2.)

`why.md` sets each row's column-length mismatch and noise-free in-model separation beside each
model's noisy separation.

## Fix round (2026-10-30): the skeptic's eight points

Every point held; each was fixed at its root and what it touches re-run. New code is under `fix/`
(and marked `[fix]` in `run.mjs`, `make-eng.mjs`, `lines/sizeline.mjs`); the 2026-10-27 findings
above stand except where this section replaces them.

**Engine and run changes.** `make-eng.mjs` adds `FS2A_WPPM_BALL=1`: in the WPPM profile every
member's size coefficients are the ball's at the member's own ⟨L⟩_V (the same line shape in every
direction; ellipsoid and spheroid are unchanged, checked bit for bit). `run.mjs` records the fit's
CPU time (`out.cpu`: isotropic fit + methods, the draw left out) and takes `--kernel inmodel` (the
row drawn by this folder's own model at the truth, `fix/inmodel-lib.mjs`; its WPPM pattern is
0.06–0.22 % of the peak off the generator's exact one). With the flags off nothing changes: the 66
timing runs below reproduce their reference records' χ² and evaluations exactly.

1. **Cost** (`fix/time.mjs`, `fix/timecost.mjs` → `results/timecost.md`, `results/time/`). The 22
   sub-screen rows (2 a Laue class, the screening set's class weights), each with lor, lsq, mom and
   wppm back to back in turn, two rows at a time, `--method today`: CPU s a run (isotropic fit +
   search + report), mean over the rows; ratio of sums to lor; per-row ratio median (range):
   lor 48; lsq 48, 0.99 (1.02, 0.63–1.49); mom 50, 1.04; **wppm 140, 2.88 (2.47, 1.20–4.77)**. By
   class wppm ÷ lor: −1 3.6, 2/m 2.9, mmm 3.3, 4/m 2.7, 4/mmm 2.3, −3 3.6, −3m 2.8, 6/m 2.5,
   6/mmm 1.5, m−3 1.8, m−3m 2.1; −1 runs 572 s against lor's 158. Walls under the same load give
   the same ratios (wppm 2.95). CPU per evaluation (median over rows): lor 6.3 ms, lsq 6.5, wppm
   18.1. Evaluations a run (deterministic): lor 6066 (search 4040), lsq 5710 (3525), wppm 5334
   (3217). The screening set estimated as 7 × each class's mean: lor 62 min, lsq 62, wppm 179 (CPU).
   The old figures (lor 115 s and 147 min, wppm 254 s and 325 min, "2.2×", "lsq 99 s against
   115") were the runs' own walls under different loads: the same deterministic runs took 110 s
   then and 45 s now for lor, 272 s and 134 s for wppm. They are withdrawn. lsq costs what lor
   costs (0.99×, 6 % fewer evaluations); it is not cheaper.
2. **Solids with a margin** (`fix/xmargin.mjs` → `results/xmargin.md`; `fix/shapesep.mjs`,
   `fix/sepcmp.mjs` → `results/sepcmp.md`). The 11/11 counted two near ties as right. The true
   family's margin over the best other family, χ²/χ²_ν,iso; right family (true solid + nested) /
   undetermined / another family at m = 3: lor 4 / 4 / 3, lsq 9 / 1 / 1, wppm 9 / 2 / 0 (by BIC:
   lor 5 / 3 / 3, lsq 8 / 1 / 2, wppm 10 / 0 / 1); at m = 10: lor 3 / 5 / 3, lsq 6 / 5 / 0,
   wppm 7 / 4 / 0. Since each row is one noise draw, the margin each model shows on average was
   computed too: the noise-free fits of the true solid and of each other family's general member
   (box, elliptic cylinder, ellipsoid) to the generator's exact pattern without noise, Poisson
   weights at the row's counts. Expected margin of the nearest other family, right / within ±3 /
   wrong: lor 4 / 3 / 4, lsq 8 / 1 / 2, wppm 8 / 3 / 0. lsq's two errors are systematic, not
   draws: cylinder-P6m-on goes to the ellipsoid by 8.9 and ellcyl-P6m-generic to the ellipsoid and
   box by 11.0 and 10.4 (its one draw happened to land +5.8 the right way). wppm's expected margins
   are never negative; three rows lie within 3 (ellcyl-P6m-generic 1.6, ellcyl-Pm-3m-generic 2.7,
   box-P-3m1-near 3.0) and cylinder-P6m-on at 6.5. So lsq and wppm place the same number of rows
   decisively; wppm is never wrong in expectation, lsq is wrong on two rows.
3. **What the line shape adds** (`fix/shapesep.mjs --data inmodel`; `fix/floors.mjs` →
   `results/floors2.out`). The in-model floor against the exact model was not like for like. Two
   controls replace it, both in-model (each model's own lines in the data), with the ball control
   `wppm-ball`: every member the ball's exact line at its own ⟨L⟩_V, as compact as the exact lines
   but with no direction-dependent shape.
   - Telling the families apart (17 pairs within 2.6 % rms of column lengths, noise-free in-model
     Δχ² of the other family's best fit): the ball line separates them 1.8× as far as the
     Lorentzian (median; 0.7–5.3), the exact lines 13× as far as the ball line (median; 1.5–150).
     For example box-P-1-near against the elliptic cylinder: lor 3.6, ball 5.2, wppm 117;
     spheroid-P-3-near against the box: 0.1, 0.2, 35; ellcyl-P6m-generic against the box: 0.2,
     0.1, 1.5. The compactness the skeptic's bound points to is real but small here; the
     separation comes from the shape changing with direction.
   - The extents at the truth (truth reference, 11 clean rows × 2 noise draws, in-model): worst
     extent lor +8.0 % (90th +19.6 %), ball +4.7 % (+59.1 %), wppm +2.8 % (+12.0 %); axis 1.5°,
     1.0°, 0.6°. Paired by row and draw, ball beats lor in 11 of 22 (median change +1.0 point),
     wppm beats ball in 15 of 22 (−0.4), wppm beats lor in 16 of 22 (−2.5). One model's two draws
     differ by as much (lor +5.6 and +8.7 %; the old floor, another draw, +8.9 %). So at the truth
     the exact model reads the extents a few points better in its own world, and these runs cannot
     split that between compactness and direction-dependent shape. The old verdict ("the exact
     lines carry information beyond ⟨L⟩_V for the extents") is withdrawn; it holds for telling the
     solids apart.
4. **Anisotropy like for like** (`fix/aniso.mjs` → `results/aniso.md`). Today's search on the 28
   clean rows every model kept, median ratio and median |ln ratio|: lor 0.74, 0.33; lsq 0.96, 0.09;
   wppm 1.00, 0.02. Rows outside 0.9–1.1: lor 21, lsq 14, wppm 6 of 28 (wppm 0.70–1.72:
   ellcyl-Pm-3m-generic 0.70, box-P-3m1-near 0.84, spheroid-P-3-near 1.11, ellipsoid-P-3m1-on 1.15,
   box-P6m-generic 1.34, ellipsoid-P6m-near 1.72). Per class on the truth reference (every clean
   row, so the same rows for each model; 1–5 rows a class): m−3m lor 0.26, lsq 1.21 (|ln| 0.37:
   rows 0.73, 15.0, 1.53, 0.88), wppm 0.96; 6/m 0.59, 0.96, 0.99. The old per-class search medians
   (lor 0.11 in m−3m) covered 1 of 4 rows for lor. wppm's class medians lie within 0.96–1.09, but
   per row it reads 0.69–1.68 (5 of 33 outside 0.9–1.1).
5. **lsq's spread**: covered by 4 (median |ln ratio| 0.09–0.11 against wppm's 0.02).
6. **mom** (`results/s-mom/`, `fix/merge-mom.mjs`, `fix/mom-search.mjs` → `results/mom-search.out`,
   `results/sub-mom.md`). mom's search now ran on the sub-screen (the timing runs). Kept solids,
   all 22 rows: mom worst +17 % (90th +248 %), thinnest +4 %, axis 3.2° (29.9), 1 unbounded, reach
   20/22 (Δ from the kept solid's χ², an upper bound: these runs had no refinement log); lsq +16 %
   (+195 %), +3 %, 3.5° (29.5), 0 unbounded, 22/22. Clean rows: mom +11 % (+762 %), lsq +16 %
   (+199 %); mom's tail is two elliptic cylinders whose height runs away (ellcyl-P6m-generic
   unbounded, ellcyl-Pm-3m-generic +762 %; lsq +307 % and +199 %). On the truth reference mom has
   the smaller clean worst extent (+9 % against +16 %) and axis (2.2° against 2.6°), lsq the smaller
   bias (mom reads the middle and longest extents 4–8 % short) and the better 90th of the axis. The
   extents do not separate them; lsq is kept for its fit (pattern 3.6 % against 4.2 % of the peak,
   excess χ²_ν 0.04 against 0.10, χ²_ν at the truth 3.02 against 3.83 on cylinder-P4mmm-on), its
   reach and its tail.
7. **lsq's line figures in sample** (`fix/line-oos.mjs` → `results/line-oos-*.out`). The same 1200
   members (same seed; the original sampling reproduces `line-errors.json` exactly), read with
   other weights than lsq's tables were fitted with: ⟨L⟩_V read ÷ true with weights 1/(p + 0.02) to
   |x| ≤ 10 (tails weighted): lor 1.252, mom 1.061, lsq 1.013 (10–90 %: 1.004–1.027); with
   1/(p + 2) (nearly flat): lor 1.131, mom 1.032, lsq 0.986 (0.978–0.991). lsq's 1.000 is by
   construction; out of sample it reads within 1.5 %. The max |Δ| figures do not change with the
   weights (they sit at the line's top).
8. **The family test for the box edge** (`results/lines-extra.out`): lsq reads zero spread at δ 0.1
   and 0.2 for a box edge or a cylinder along its axis (0.90 at 0.3, 1.03 at 0.5), and for the ball
   0, 0.48, 0.90, 1.00.

Also corrected while checking: "families of different shape separate at 12–25 % rms by 240–2800
χ²" holds at high counts only. At large extents or few counts the same mismatch gives little:
box-P-3m1-near (14–60 nm, 906 counts) 0.6–1.0 against the square box, cylinder and spheroid at
12–15 %; ellcyl-Pm-3m-generic (2192 counts) 3.7–6.2 at 15–16 % (`results/colsep-none-lor.json`).

Commands of this round:

```sh
node make-eng.mjs                                              # eng/ with FS2A_WPPM_BALL
node fix/time.mjs --rows subscreen --modes lor,lsq,mom,wppm   # 88 runs, results/time/ (≈ 55 min on 2 processes)
node fix/timecost.mjs --out results/timecost.md --json results/timecost.json
node fix/merge-mom.mjs; node analyse.mjs --v lor=../pilot/results/screen,mom=results/s-mom,lsq=results/s-lsq,wppm=results/s-wppm --rows subscreen --sections ref,search --out results/sub-mom.md --json results/sub-mom-digest.json
node fix/mom-search.mjs results/sub-mom-digest.json
node fix/xmargin.mjs results/xconf3.json --m 0,3,6,10 --out results/xmargin.md --json results/xmargin.json
node fix/aniso.mjs results/screen-final-digest.json --out results/aniso.md
fix/chain.sh     # shapesep inmodel lor / wppm / wppm-ball, exact lor / lsq / wppm; tr-im-{lor,wppm,ball}
fix/chain2.sh    # tr-im2-{lor,wppm,ball}: a second noise draw (FS2A_INMODEL_SEED=draw2)
node fix/sepcmp.mjs --out results/sepcmp.md --json results/sepcmp.json
node analyse.mjs --v lor-im=results/tr-im-lor,lor-im2=results/tr-im2-lor,ball-im=results/tr-im-ball,ball-im2=results/tr-im2-ball,wppm-im=results/tr-im-wppm,wppm-im2=results/tr-im2-wppm,wppmx-exact=results/s-wppm,lorgen-gen=results/tr-inmodel --rows subclean --sections ref --out results/floors2.md --json results/floors2-digest.json
node fix/floors.mjs results/floors2-digest.json
node fix/line-oos.mjs --n 200 --X 10 --b 0.02 --out results/line-oos-X10-b0.02.json   # and --b 2; --X 6 --b 0.2 reproduces line-errors.json
```
