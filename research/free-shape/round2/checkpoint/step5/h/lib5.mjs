/* Step 5's readers: a run's numbers per solid, from the step 5 records (results/<tag>/<key>.<shape>.json)
   and, for a screening truth's own solid, step 4's S2 record (../../step4/h/results/S2/<id>.json). */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
export const SOLIDS = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
export const FAM = { box: 'box', sqbox: 'box', cylinder: 'cyl', ellcyl: 'cyl', ellipsoid: 'ball', spheroid: 'ball', sphere: 'ball' };
export const GEN = { box: 'box', cyl: 'ellcyl', ball: 'ellipsoid' }, SPEC = { box: 'sqbox', cyl: 'cylinder', ball: 'spheroid' };
export const design = JSON.parse(fs.readFileSync(path.join(HERE, 'design5.json'), 'utf8'));
export const rowOf = key => design.rows.find(r=> r.key === key);
export const load = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch(e){ return null; } };
// One fit's numbers: { solid, kept, chi2 (the fit's, or for a shape not kept the search's best: iso less
// the gain), P, gain (pre-stage, in nu), gainBrief, nu, N, iso, flagged (the fit's per-line check),
// flagKeep (the check before the stage), held, ms, evals }
export function fitOf(rec, solid){
  if (!rec || !rec.records || !rec.records[0]) return null;
  const r = rec.records[0], iso = rec.iso, nu = Math.max(1, iso.chi2nu), k = r.keep || null;
  const o = { solid, kept: r.kept, held: r.held, iso: iso.chi2, nu, N: iso.N, Piso: iso.P, ms: rec.wall, evals: r.evals, early: r.early,
    flagged: r.check ? !!r.check.flagged : null, z: r.check ? Math.max(r.check.zSeg || 0, r.check.zBin || 0) : null };
  if (k){ o.gainBrief = k.gainBrief; o.gainFree = +k.gainFree; o.gainHeld = +k.gainHeld; o.gain = k.gain; o.dP = k.dP; o.dPfree = k.dPfree; o.dPheld = k.dPheld; o.flagKeep = k.flagged; o.zKeep = Math.max(k.zSeg || 0, k.zBin || 0); }
  if (r.kept){ o.chi2 = r.chi2; o.P = r.P; }
  else { const g = k ? (Number.isFinite(k.gain) ? k.gain : k.gainBrief) : -(r.dBIC); o.chi2 = iso.chi2 - g*nu; o.P = iso.P + (k ? (k.dP ?? k.dPheld) : 0); }
  if (!k && r.info){   // a step 4 record: the numbers from info
    const i = r.info; o.gain = (i.chi2Iso - i.chi2)/Math.max(1, i.chi2redIso); o.dP = i.P - i.Piso; o.flagKeep = o.flagged;
    o.dPfree = r.held ? null : o.dP; o.gainFree = Number.isFinite(i.dBICfree) ? null : null;
  }
  if (r.minima) o.minima = r.minima.length;
  return o;
}
export const S2 = id => load(path.join(HERE, '..', '..', 'step4', 'h', 'results', 'S2', id + '.json'));
export const rec5 = (tag, key, solid) => load(path.join(HERE, 'results', tag, key + (solid ? '.' + solid : '') + '.json'));
export const q = (a, p) => { const s = [...a].filter(Number.isFinite).sort((x, y)=> x - y); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo])*(i - lo); };
export const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
