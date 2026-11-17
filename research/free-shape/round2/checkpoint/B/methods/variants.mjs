/* Track B's variants, by name: make(cfg) of var.mjs. FWD is noCov and forward differences in
   every refinement of the search. */
const ALL = st => ({ brief: st, full: st, polish: st, exact: st, held: st, refit: st });
const NOCOV = { noCov: true }, FWD = { noCov: true, fwd: true };
export const VARIANTS = {
  // today's search, replicated (cfg {}): checked against the pilot's records
  today: {},
  // (1) no covariance in intermediate refinements; the returned fit's once (central)
  nocov: { lm: ALL(NOCOV), final: 'cov' },
  // (2) forward differences + (1); the returned fit's covariance once, then the fit refined
  // once more with central differences (both accounted from one run: fwd and fwdC); (3) the
  // held frames that repeat one modulo the class are refined but flagged (fwdH = fwd less them)
  fwd: { lm: ALL(FWD), final: 'central', held: 'count' },
  // (3) held frames de-duplicated by canonical(), for real
  fwdH: { lm: ALL(FWD), final: 'central', held: 'canon' },
  // (2') forward differences in the brief trials only (8 iterations each, a fixed count); the
  // full, polish, exact, held and refit refinements central, all without covariance; the
  // returned fit's covariance once
  fwdB: { lm: { brief: FWD, full: NOCOV, polish: NOCOV, exact: NOCOV, held: NOCOV, refit: NOCOV }, final: 'cov', held: 'canon' },
  // (4) the class's distinct low-index starts only (no random fill)
  symA: { lm: ALL(FWD), final: 'central', held: 'canon', starts: 'distinct' },
  // (4) the random fill kept only where the zone leaves room (≥ 20° from every start, modulo the class)
  symC: { lm: ALL(FWD), final: 'central', held: 'canon', starts: 'fz', fzDeg: 20 },
  // (4b) full refinements only from distinct brief ends (modulo the class and the body)
  fullDrop: { lm: ALL(FWD), final: 'central', held: 'canon', fullDedup: 'drop' },
  fullRep: { lm: ALL(FWD), final: 'central', held: 'canon', fullDedup: 'replace' },
  // the finalist combination: (1) + (2) + (3) + (4) symA + (4b) fullDrop
  cuts: { lm: ALL(FWD), final: 'central', held: 'canon', starts: 'distinct', fullDedup: 'drop' },
  // the first versions of symA, symC and cuts (tags sub2s, sym25, full, fullsub): their fill
  // shifted the random stream, so every later polish and refit turn differed from fwdH's
  symA0: { lm: ALL(FWD), final: 'central', held: 'canon', starts: 'distinctShift' },
  symC0: { lm: ALL(FWD), final: 'central', held: 'canon', starts: 'fzShift', fzDeg: 20 },
  cuts0: { lm: ALL(FWD), final: 'central', held: 'canon', starts: 'distinctShift', fullDedup: 'drop' },
};
