export const meta = {
  name: 'fs2-AB',
  description: 'Free-shape round 2, tracks A and B in parallel: an exact-line-shape size model (accuracy, telling solids apart) and the search efficiency (no intermediate covariance, forward differences with a central last pass, canonical frame dedupe, symmetry-cut starts); each verified adversarially, fixed, then written up',
  phases: [
    { title: 'Explore', detail: 'A: line-shape model; B: search efficiency — in parallel, each on the screening rows' },
    { title: 'Verify', detail: 'a skeptic per track re-runs and tries to refute its headline claims' },
    { title: 'Fix', detail: 'per track, the confirmed problems' },
    { title: 'Write', detail: 'research/free-shape/round2/AB.md, scripts, tables' },
  ],
}

const S = args.S
const F = `${S}/fs2`
const OUT = '/home/user/datatreat_beta/research/free-shape/round2'

const EXPLORE = {
  type: 'object',
  properties: {
    tried: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, idea: { type: 'string' }, results: { type: 'string', description: 'numbers with how they were measured' }, verdict: { type: 'string' } },
      required: ['name', 'idea', 'results', 'verdict'] } },
    best: { type: 'string', description: 'the recommended combination, its gains and costs on the full screening set' },
    why: { type: 'string', description: 'the mechanisms found: why it works or fails' },
    open: { type: 'array', items: { type: 'string' } },
    files: { type: 'array', items: { type: 'string' } },
  },
  required: ['tried', 'best', 'why', 'open', 'files'],
}
const VERDICT = {
  type: 'object',
  properties: {
    reproduced: { type: 'array', items: { type: 'string' } },
    problems: { type: 'array', items: { type: 'object', properties: {
      where: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, severity: { type: 'string', enum: ['blocking', 'major', 'minor'] } },
      required: ['where', 'problem', 'evidence', 'severity'] } },
  },
  required: ['reproduced', 'problems'],
}
const WRITE = {
  type: 'object',
  properties: { file: { type: 'string' }, summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'summary', 'files'],
}

const TRACKS = [
  { key: 'A', label: 'line-shape', brief: `TRACK A — THE SIZE LINE'S SHAPE IN THE MODEL. Work in ${F}/A/.
The pilot (PILOT.md §6, §8) found that the engine's Lorentzian size line, not the search, is the main source of inaccuracy on exact data: one exact line is read 13–20 % long (6 % of it the breadth convention: FWHM 0.675/⟨L⟩_V gives an integral breadth 1.06/⟨L⟩_V, the exact line's is 1/⟨L⟩_V); refined from the truth, solids are pulled toward equant shapes the more the higher the symmetry (longest/thinnest read ÷ true 0.26 in m−3m, about 1 in −1, 2/m, mmm); 3 of 11 spheres keep a false shape; and in-model (engine's own lines) most truths come back. The user wants the solids told apart and an efficient fit.
Build, in a copy of the engine (never the shared fs2 folders' files: copy what you change into ${F}/A/), size-line models for the fit, cheapest first, and measure each:
 (a) the breadth convention alone (the Lorentzian's integral breadth = 1/⟨L⟩_V);
 (b) a shape-aware line: per member, the exact size line's width and Gaussian/Lorentzian character (or a better few-parameter form) taken from tables in the solid's reduced shape parameters along that member (the ellipsoid family is one universal profile scaled by D(n); a cylinder or elliptic cylinder one ratio; a box two ratios), fed into the engine's own line (its TCH pseudo-Voigt or what fits best) so the cost stays near today's;
 (c) the exact line by the Fourier route, if (b) is not accurate enough, with its cost.
For each: its error against the generator's exact lines (as a line and as a pattern); accuracy against the truth on clean and error rows (thinnest, middle, longest, axis; longest/thinnest read ÷ true per Laue class); the false shapes on the spheres; the cost per evaluation and per run. Then the solids: on clean sub-screen rows fit all six solids (cross-class) with the best model and with today's, and give the confusion matrix by χ² and by BIC; explain WHY solids are confused or told apart (what in the data distinguishes them: column lengths along the measured directions against the line shapes; how symmetry and the number of distinct directions enter), and what would fix the remaining confusion. Avoid the inverse crime: your model's line code must be your own (tables, approximations), checked against the generator's exact lines, not a call into it.` },
  { key: 'B', label: 'search-efficiency', brief: `TRACK B — THE SEARCH'S EFFICIENCY. Work in ${F}/B/. The user: efficiency is the key word. Measure on today's model (the engine's Lorentzian); the gains are mechanics and will be re-checked on track A's model later.
 (1) No covariance in intermediate refinements (only the returned fit's).
 (2) Forward-difference Jacobians, with the best minimum refined once more with central differences — the user's condition; measure what that last pass costs and whether it moves the minimum.
 (3) Held lattice frames de-duplicated by the canonical convention (the harness's canonical()).
 (4) Symmetry cuts the starts: read how freeShapeRun builds its starts (lowIndexAxes, latticeAcross, the plate/needle per family, the random ones) and remove starts equivalent under the phase's Laue class and the solid's own symmetry (a cylinder's two equal axes, a spheroid's axis only), restrict random starts to the fundamental zone, and scale the start count to how many distinct ones the class leaves (higher symmetry → more equivalent starts → fewer needed).
 (5) Round 1 (FREE-SHAPE.md §4.2, cubic only) found forward differences + no intermediate covariance halve the cost; confirm or refute in every Laue class.
Judge reach against the best exact χ² known per run over all methods run on it (the pilot shows today's minimum is often below the truth reference), the outcome against today's (held, free, rejected), accuracy against the truth, evaluations and wall time. Do not retry what round 1 rejected (Broyden, log widths, widths surrogate, more random starts) or what the user dropped (halving the brief trials).` },
]

phase('Explore')
const results = await pipeline(TRACKS,
  T => agent(`${args.common}\n\n${T.brief}\n\nScreen variants on a sub-screen first: 22 rows of the screening set, 2 per Laue class, every solid and both clean and error rows present, chosen by a fixed rule written to ${F}/${T.key}/subscreen.txt; the same list for every variant. Run only finalists on the full 77-run screening set. Report every variant tried with its numbers, including those that failed.`,
    { label: `explore:${T.label}`, phase: 'Explore', schema: EXPLORE }),
  (res, T) => agent(`${args.common}\n\nYOU ARE A SKEPTIC for track ${T.key}. Its brief: ${T.brief}\nIts report: ${JSON.stringify(res)}\nTry to REFUTE its headline claims: re-run at least three of its key numbers yourself from its scripts (and one with your own independent check), look for comparisons that are not like for like (different rows, references, seeds), accuracy scored loosely, costs measured under different load, claims beyond what was run, validation rows touched, the inverse crime (track A), equivalent starts removed that were not equivalent (track B). Work in ${F}/${T.key}-verify/. Report only problems you can demonstrate.`,
    { label: `verify:${T.label}`, phase: 'Verify', schema: VERDICT }).then(v => ({ res, v })),
  ({ res, v }, T) => (v && v.problems.length)
    ? agent(`${args.common}\n\nTrack ${T.key}'s report: ${JSON.stringify(res)}\nIts skeptic found: ${JSON.stringify(v)}\nCheck each problem; fix the real ones at the root in ${F}/${T.key}/, re-run what each fix touches, and return the corrected full report (every variant, the best, the mechanisms, open points). Reject wrong points with the reason in 'open'.`,
        { label: `fix:${T.label}`, phase: 'Fix', schema: EXPLORE }).then(f => ({ track: T.key, report: f || res, verify: v }))
    : Promise.resolve({ track: T.key, report: res, verify: v }),
)

phase('Write')
const write = await agent(`${args.common}\n\nTHE TWO TRACKS (after verification and fixes): ${JSON.stringify(results)}\nWrite ${OUT}/AB.md in the repo's plain, dense style: a summary first (what to adopt, the gains, what it costs, what stays open), then track A (the size line: each model tried, its accuracy and cost, the solids' confusion matrix and why), track B (each efficiency step, its gain and risk, per Laue class), the verifications and what they changed, and the next steps for round 2 (PROTOCOL.md: minima at one level of refinement with the two errors, the per-line χ²_ν flag and jackknife, the keep criterion, re-checking B on A's model). Copy the scripts behind every number into ${OUT}/scripts/A/ and ${OUT}/scripts/B/ and small tables into ${OUT}/tables/ (no bulk results; no scratch-folder absolute paths in the repo — write them as $W/...). Also update ${OUT}/scripts/README.md's index.`,
  { label: 'write', phase: 'Write', schema: WRITE })

return { results, write }
