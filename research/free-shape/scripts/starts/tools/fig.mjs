// Figures for the starts study (SVG; svg2png.mjs in the harness renders them).
// node fig.mjs cost --stages s.json --compare c.json --methods a,b --labels 'A|B' --out f.svg [--title t]
//   stacked bars of mean evaluations a run by stage, the reach and the mean as labels
// node fig.mjs scatter --tags t --method m --out f.svg: per run, the method's evaluations
//   against the baseline's (one dot a run, by set), with y = x and y = x/2
import fs from 'node:fs'; import path from 'node:path';
const H = new URL('../../', import.meta.url).pathname + 'harness';
const ST = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const a = process.argv.slice(3), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
// the reference palette (dataviz skill, light): slots 1–3, text and surface tokens
const C = { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', axis: '#a3a29d' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const font = 'font-family="system-ui, -apple-system, Segoe UI, sans-serif"';
const kfmt = x => x >= 1000 ? (x/1000).toFixed(1) + 'k' : x.toFixed(0);
const nice = (mx, n = 5) => { const raw = mx/n, p = 10**Math.floor(Math.log10(raw)), st = [1, 2, 2.5, 5, 10].map(m=> m*p).find(s=> s >= raw); return st; };

if (process.argv[2] === 'cost'){
  const S = JSON.parse(fs.readFileSync(opt.stages, 'utf8')), Cm = JSON.parse(fs.readFileSync(opt.compare, 'utf8'));
  const ms = String(opt.methods).split(','), lab = opt.labels ? String(opt.labels).split('|') : ms;
  const W = 940, L = 250, R = 190, top = 74, rh = 30, bh = 16, Hh = top + rh*ms.length + 44;
  const wEq = m => S[m].nSide ? (S[m].msWidths + S[m].msScreen)/5.7 : 0;
  const mx = Math.max(...ms.map(m=> S[m].evals + wEq(m))), step = nice(mx), xmax = Math.ceil(mx/step)*step, X = v => L + (W - L - R)*v/xmax;
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" ${font}>`, `<rect width="${W}" height="${Hh}" fill="${C.surface}"/>`];
  o.push(`<text x="16" y="26" font-size="16" font-weight="600" fill="${C.ink}">${esc(opt.title || 'Pattern evaluations a run, by stage')}</text>`);
  // legend
  const segs = [['widths', 'widths reading + screen (time ÷ 5.7 ms)', C.axis], ['brief', 'brief refinements', C.s1], ['full', 'full + polish', C.s2], ['exheld', 'exact faces + held frames', C.s3]];
  let lx = 16; for (const [, t, c] of segs){ o.push(`<rect x="${lx}" y="40" width="12" height="12" rx="2" fill="${c}"/><text x="${lx + 18}" y="50" font-size="12" fill="${C.ink2}">${t}</text>`); lx += 30 + t.length*6.2; }
  for (let v = 0; v <= xmax; v += step){ o.push(`<line x1="${X(v)}" x2="${X(v)}" y1="${top - 8}" y2="${top + rh*ms.length}" stroke="${C.grid}" stroke-width="1"/><text x="${X(v)}" y="${top + rh*ms.length + 16}" font-size="11" fill="${C.ink2}" text-anchor="middle">${kfmt(v)}</text>`); }
  o.push(`<text x="${(L + W - R)/2}" y="${top + rh*ms.length + 34}" font-size="11" fill="${C.ink2}" text-anchor="middle">pattern evaluations a run (mean)</text>`);
  ms.forEach((m, i)=> {
    const s = S[m], y = top + rh*i + (rh - bh)/2, vals = [wEq(m), s.brief, s.full, s.exact + s.held];
    o.push(`<text x="${L - 10}" y="${y + bh - 3}" font-size="12.5" fill="${C.ink}" text-anchor="end">${esc(lab[i])}</text>`);
    let x0 = 0;
    vals.forEach((v, j)=> { const xa = X(x0), xb = X(x0 + v); if (xb - xa > 2.5) o.push(`<rect x="${xa + (j ? 1 : 0)}" y="${y}" width="${Math.max(0, xb - xa - (j ? 1 : 0) - 1)}" height="${bh}" rx="${j === vals.length - 1 ? 3 : 1}" fill="${segs[j][2]}"/>`); x0 += v; });
    const c = Cm[m];
    o.push(`<text x="${X(x0) + 8}" y="${y + bh - 3}" font-size="12" fill="${C.ink}">${kfmt(s.evals)} · reached ${c.reached}/${c.judged} · Δ > 3: ${c.miss3}</text>`);
  });
  o.push('</svg>');
  fs.writeFileSync(opt.out, o.join('\n'));
}

if (process.argv[2] === 'scatter'){
  const { readResult } = await import(H + '/lib.mjs');
  const load = d => fs.readdirSync(d).filter(f=> f.endsWith('.json') && f !== 'summary.json').map(f=> readResult(fs.readFileSync(path.join(d, f), 'utf8'))).filter(r=> r.records);
  const base = new Map(load(path.join(H, 'results', 'baseline')).map(r=> [`${r.case}|${r.seed}`, r.records.find(m=> m.method === 'baseline')]));
  const pts = [];
  for (const t of String(opt.tags).split(',')) for (const r of load(path.join(ST, 'results', t))){ const m = r.records.find(m=> m.method === opt.method), b = base.get(`${r.case}|${r.seed}`); if (m && b) pts.push({ x: b.evals, y: m.evals, kind: r.kind, id: r.case + '#' + r.seed }); }
  const W = 560, Hh = 520, L = 64, R = 20, T = 56, B = 56, mx = Math.max(...pts.map(p=> Math.max(p.x, p.y))), step = nice(mx), xm = Math.ceil(mx/step)*step;
  const X = v => L + (W - L - R)*v/xm, Y = v => Hh - B - (Hh - T - B)*v/xm;
  const col = { synth: C.s1, sample: C.s2, control: C.s3, fixture: C.s3 }, name = { synth: 'synthetic', sample: 'sample-like', control: 'controls and fixtures' };
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" ${font}>`, `<rect width="${W}" height="${Hh}" fill="${C.surface}"/>`];
  o.push(`<text x="16" y="24" font-size="15" font-weight="600" fill="${C.ink}">${esc(opt.title || `Evaluations a run: ${opt.method} against the app's search`)}</text>`);
  for (let v = 0; v <= xm; v += step){ o.push(`<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${Hh - B}" stroke="${C.grid}"/><line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.grid}"/>`);
    o.push(`<text x="${X(v)}" y="${Hh - B + 16}" font-size="11" fill="${C.ink2}" text-anchor="middle">${kfmt(v)}</text><text x="${L - 6}" y="${Y(v) + 4}" font-size="11" fill="${C.ink2}" text-anchor="end">${kfmt(v)}</text>`); }
  o.push(`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(xm)}" y2="${Y(xm)}" stroke="${C.axis}" stroke-width="1.5" stroke-dasharray="4 4"/><text x="${X(xm*0.93)}" y="${Y(xm*0.93) - 6}" font-size="11" fill="${C.ink2}" text-anchor="end">same cost</text>`);
  o.push(`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(xm)}" y2="${Y(xm/2)}" stroke="${C.axis}" stroke-width="1.5" stroke-dasharray="2 3"/><text x="${X(xm*0.97)}" y="${Y(xm*0.485) + 16}" font-size="11" fill="${C.ink2}" text-anchor="end">half</text>`);
  o.push(`<text x="${(L + W - R)/2}" y="${Hh - 14}" font-size="11.5" fill="${C.ink2}" text-anchor="middle">the app's search (baseline): evaluations</text><text transform="translate(16 ${(T + Hh - B)/2}) rotate(-90)" font-size="11.5" fill="${C.ink2}" text-anchor="middle">${esc(opt.method)}: evaluations</text>`);
  for (const p of pts) o.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4" fill="${col[p.kind]}" stroke="${C.surface}" stroke-width="1.5"><title>${esc(p.id)}: ${p.x} → ${p.y}</title></circle>`);
  let ly = T + 6; for (const k of ['synth', 'sample', 'control']){ o.push(`<circle cx="${L + 14}" cy="${ly}" r="4.5" fill="${col[k]}"/><text x="${L + 24}" y="${ly + 4}" font-size="12" fill="${C.ink2}">${name[k]} (${pts.filter(p=> k === 'control' ? /control|fixture/.test(p.kind) : p.kind === k).length})</text>`); ly += 18; }
  o.push('</svg>');
  fs.writeFileSync(opt.out, o.join('\n'));
}
