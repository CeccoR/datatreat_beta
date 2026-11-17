import { makeUniq } from './uniq-core.mjs';
// the main batch: the search's ends and 12 extra lattice-frame starts, up to 4 minima refined, profiles, the noise-free δ
export default makeUniq({ name: 'u-main', extraStarts: true, profile: true, noiseFree: true, boot: 0 });
