// the uniqueness analysis after the c1 search (variants.mjs c1)
import { makeUniq } from './uniq.mjs';
import { VARIANTS } from '../variants.mjs';
export default makeUniq({ name: 'u-c1', ...VARIANTS.c1 }, { within: 10, refineWithin: 100, maxExtra: 6, points: 5 });
