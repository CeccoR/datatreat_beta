# Step 5's scripts (`../../STEP5.md`)

The family verdict and the keep test, on the prototype (`../../proto/engine.patch`, `SHAPE_KEEP`,
`SHAPE_FAMILY`). They ran in `$W/fs2/step5/h/` (the study) and `$W/fs2/step5/h2/` (the final engine:
the bootstrap per fit and the verification) beside the shared `fs2/` folders; `setup.sh <repository>`,
run from `$W/fs2/step5` with this folder's files copied into `h/`, makes both and the app copy. Every
run is deterministic; validation rows are never read (`mkdesign5.mjs` takes the tuning part only) and
`batch5.mjs` refuses any row not of the tuning part.

- `mkdesign5.mjs` → `design5.json`: the 154 tuning rows (key = id), four fresh noise draws of each of the
  22 tuning spheres (`<id>~d<k>`, the seed moved), and 176 mild shapes (`<id>~m<k>`: the 66 tuning truths
  outside the screening set, extents pulled towards their geometric mean to a largest/smallest r
  log-uniform in [1.02, 1.6], a new noise seed).
- `batch5.mjs <jobs>`: one `run.mjs` a job, nice 15, at most 3 at a time, a timeout each, resumable. A job
  line: `<tag> <row key> <solid|-> <K=V,...|->`; the environment: `METHOD` (fam, fboot, lrt), `KEEP_SET`
  and `FAMILY_SET` (the tunables, `;` between pairs), `MIN_OFF`, `MIN_SET`, `CK_OFF`, `FAM_REPORT`,
  `FBOOT_SRC`, `FBOOT_R`, `LRT_B`, `LRT_ALLSTARTS`.
- `run.mjs`: step 4's, with `--shape` (the solid searched), rows from `--design` by their key, and the
  methods `fam`, `fboot`, `lrt`; a record keeps `keep`, `family`, `v` (the fit returned), `fboot`, `lrt`.
- `make-eng.mjs`: step 4's, exporting `SHAPE_KEEP`, `SHAPE_FAMILY`, `familyVerdict`.
- `methods/fam.mjs`: the search as the app runs it, the keep test's numbers, the fit's vector, the
  family verdict; the report only with `FAM_REPORT=1`.
- `methods/fboot.mjs`: the family bootstrap: a solid's returned fit (`FBOOT_SRC`, a record of the same row
  and solid) refined again on T replicas seeded by the row's key alone, so that every solid sees the same
  draws.
- `methods/lrt.mjs`: the likelihood-ratio test by a quick parametric bootstrap from the isotropic fit
  (`LRT_B` replicas; the class's starts with `LRT_ALLSTARTS`, else the sphere-like one alone).
- `lib5.mjs`: the readers; `fam5.mjs`: the family margins per row (`--json fam5.json`, `--rows`);
  `famverdict.mjs`: the verdict as the engine makes it; `fam-sub.mjs`: the strategies (`--margin`,
  `--marginMisfit`, `--nestMisfit`, `--stat chi|bic`, `--choose true|any`); `fboot-jobs.mjs`,
  `fboot-an.mjs`: the bootstrap's jobs and its read; `keep5.mjs` → `keep5.json`, `keep-rules.mjs`
  (`--nulls`, `--sys`, `--rules`, `--cand`, `--lrt`): the keep rules; `cost5.mjs`: the early rejection's
  cost; `lrt-an.mjs` (run in `h2`): the bootstrap per fit; `peek*.mjs`: the lists §3.2, §4.3 and §4.4
  quote.
- Job files: `jobs-X1.txt` (spheres × six solids), `jobs-X2a.txt`, `jobs-X2b.txt` (truths × six solids,
  the stage off), `jobs-FB.txt`, `jobs-M.txt`, `jobs-N.txt`, and h2's `jobs-L.txt`, `jobs-F.txt`.

```sh
cd $W/fs2/step5/h
for j in X1 X2a FB M N X2b; do node batch5.mjs jobs-$j.txt --timeout 2400; done   # ≈ 2 h 15 min
node fam5.mjs --json fam5.json --rows                         # ../../tables/step5-family.md
node fboot-an.mjs --rows
node fam-sub.mjs --margin 14 --marginMisfit 35 --nestMisfit 25 [--choose any]
node keep5.mjs && node keep-rules.mjs --nulls --sys --cand --lrt && node cost5.mjs   # ../../tables/step5-keep.md
cd ../h2 && node batch5.mjs jobs-L.txt --timeout 3600 && node lrt-an.mjs && node batch5.mjs jobs-F.txt
```

(`jobs-FB.txt` was made by `fboot-jobs.mjs --within 30` from the four searches of X2a, with
`FBOOT_R=10`.) Not in the repository: the records (`h/results/`, `h2/results/`), the engine copies and
the app copies.
