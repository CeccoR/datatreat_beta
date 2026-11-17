# Checkpoint of round 2's work in progress

A copy of the scratch work behind tracks A and B (`../AB.md` when written), taken every
30 minutes while the work runs, so that hours of runs are not lost if the session stops.
It is raw: scripts, engine copies, results (one JSON per run), batch logs, the workflow's
journal (every finished agent's full report) and its script and arguments. `STATUS.txt`
says where each batch stood at the last checkpoint.

- `A/`: track A, the size line's shape in the model (engine copy with switchable line
  models, tables, results).
- `B/`: track B, the search's efficiency (variant engine, results).
- `A-verify/`, `B-verify/`: the skeptics' checks.
- `pilot/`: the pilot's work folder, with the screening reference runs (`results/screen`).

To resume elsewhere: unpack the engine at b9bef5f into `fs2/engine`, put `../scripts/`'s
gen, harness, phases, design and this folder's pilot, A and B under one `fs2/` folder, and
see `workflow-fs2-AB.js` and the journal for what each stage did. Once round 2's write-up
is final, this folder is condensed or removed.
