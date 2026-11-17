// B-verify: B's variants plus symAs (symA with the fill's random numbers drawn and discarded).
import { VARIANTS as V } from '../B/methods/variants.mjs';
export const VARIANTS = { ...V, symAs: { ...V.symA, starts: 'distinctSameRng' } };
