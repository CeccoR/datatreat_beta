/* The app's search as it is (b9bef5f): freeShape — 11 starts (the sphere-like one, a plate
   and a needle per low-index family, random shapes), brief refinements, early rejection,
   the best 3 refined fully, polish, the exact solid, the lattice frames held. */
export default {
  name: 'baseline',
  search: (model, k, res, free, opts, ENG) => ENG.freeShape(model, k, res, free, opts),
};
