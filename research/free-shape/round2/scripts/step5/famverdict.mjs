/* The family verdict, as the engine would make it (step 5). fits: [{ type, chi2, P, flagged }] the solids
   searched on one pattern; iso: { chi2, P } the isotropic fit (the ball family's sphere); nu: χ²_ν of the
   isotropic fit floored at 1. o: { margin, marginMisfit (the winner's fit flagged), nest: { box, cyl,
   ball } (Δχ²/ν a general member needs over its special one) }.
   → { family, by (its best member), margin (runner-up family − winner), need, determined, within (the
   families within need of the winner, the winner first), solid (the simplest member the data support),
   nested: { general, special, delta, need, supported }, tried } */
export const FAMILY = { box: 'box', sqbox: 'box', cylinder: 'cyl', ellcyl: 'cyl', ellipsoid: 'ball', spheroid: 'ball', sphere: 'ball' };
export const GENERAL = { box: 'box', cyl: 'ellcyl', ball: 'ellipsoid' }, SPECIAL = { box: 'sqbox', cyl: 'cylinder', ball: 'spheroid' };
export function familyVerdict(fits, iso, nu, o){
  // o.stat 'bic': each family by its member of least χ²/ν + P·ln N (o.N), the margin in those units
  const c = x => x.chi2/nu + (o.stat === 'bic' ? (x.P - iso.P)*Math.log(o.N) : 0), fam = { ball: { type: 'sphere', c: iso.chi2/nu, flagged: false } }, by = {};
  for (const f of fits){ if (!Number.isFinite(f.chi2)) continue; by[f.type] = f; const F = FAMILY[f.type]; if (!fam[F] || c(f) < fam[F].c) fam[F] = { type: f.type, c: c(f), flagged: !!f.flagged }; }
  const order = Object.keys(fam).sort((a, b)=> fam[a].c - fam[b].c), W = order[0];
  const margin = order.length > 1 ? fam[order[1]].c - fam[W].c : Infinity, need = fam[W].flagged ? o.marginMisfit : o.margin;
  const within = order.filter(F=> fam[F].c - fam[W].c < need);
  const g = by[GENERAL[W]], s = by[SPECIAL[W]];
  let nested = null, solid = fam[W].type;
  if (g && s){ const delta = (s.chi2 - g.chi2)/nu; const nn = g.flagged && o.nestMisfit != null ? o.nestMisfit : o.nest[W]; nested = { general: g.type, special: s.type, delta, need: nn, supported: delta >= nn }; solid = nested.supported ? g.type : s.type; }
  return { family: W, by: fam[W].type, margin, need, determined: within.length === 1, within, solid, nested, tried: Object.keys(by),
    rivals: Object.fromEntries(order.map(F=> [F, { by: fam[F].type, delta: fam[F].c - fam[W].c }])) };
}
