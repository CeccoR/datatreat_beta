/* DRS's smoothing, derivative smoothing and regression windows in points, as to v514 (v520:
   v515 to v519 made them widths in eV). The Tauc and Urbach cards' fields are v514's, whole
   numbers of points with its labels and defaults (N 1, N2 20, M 25, M2 100; the Urbach card
   1, 20, 25), a value not a whole number or below the least set back; analysis_info.csv in
   points. What they give is v514's, to the last digit of the CSVs, on the fixtures at the
   defaults, at windows chosen in all mode and in one mode (a spectrum at 2 nm among them);
   the suggestion places the lines where v514 did (on a step edge at 1 nm, as v514, the whole
   span). A project saved to v514 opens as v514 opened it: its points kept, its E_g v514's
   (all mode through Projects › Import, one mode, values that are no number, a project from
   before the cards). One saved by v515 to v519, its widths in eV, opens in points: a width
   at v515's default, v514's default; a window, the points of the window v519 chose for the
   sample (the field showed them, '≈ N pts'), in all mode their median over the samples; a
   smoothing, the width over the energy step at the middle of the spectrum, in all mode its
   median; rounded, at least the least; values that are no number, the defaults; a width
   beside its points, the points; a file left out, converted as it is taken back in; a
   card's kept settings of the other kind, as it is switched. v514's numbers were taken on
   v514's app (git show 82b2939), v519's points on v519's (git show 34e9906); the tests up
   to the conversion pass on v514's app as they are. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, exportProject, projectFile, importProject, openProject, download, readZip } from './helpers.mjs';
import { drsCsv } from './fixtures.mjs';

let env, d2h, step;
before(async ()=>{
  env = await start();
  // The fixtures' second spectrum at 2 nm (every other row).
  const l = drsCsv({ Eg: 2.9, A: 45, seed: 4 }).toString('utf8').split('\n');
  d2h = env.fx.put('d2h.csv', [l[0], l[1], ...l.slice(2).filter((r, i)=> i % 2 === 0)].join('\n'));
  // An edge as a step at 3.2 eV, F(R) rising 20 per eV from 3.1 above it, the tail below,
  // every nm from 250 to 800 and no noise: the lobes of its curvature narrower than the run
  // of 25 points the suggestion asks for.
  const rows = ['Sample,', 'Wavelength (nm),F(R)'];
  for (let w = 250; w <= 800; w++){ const e = 1239.842/w; rows.push(w + ',' + (e > 3.2 ? 20*(e - 3.1) : 0.05 + 0.02*Math.exp((e - 3.2)/0.12)).toFixed(5)); }
  step = env.fx.put('step.csv', rows.join('\n') + '\n');
});
after(()=> env && env.close());

const val = (page, id)=> page.inputValue('#' + id);
async function enter(page, id, v){ await page.fill('#' + id, String(v)); await page.press('#' + id, 'Enter'); await settle(page); }
async function urbachCard(page){ await page.click('#taucAddAn'); await page.click('.an-menu:not([hidden]) [data-kind="urbach"]'); await settle(page); }
const states = async page => (await moduleState(page, 'tauc')).analyses.map(a=> a.states[a.type]);
const shared = async (page, k = 0)=> (await states(page))[k].shared;
// Each card's per-sample entries, their lines left out.
const per = async page => (await states(page)).map(s=> s.per.map(q=>{ const { vlines, ...o } = q; return o; }));
// The CSVs of the project bar: the Tauc card's Eg.csv and analysis_info.csv, the Urbach card's Eu.csv, as written.
async function csvs(page){
  const out = {};
  for (const e of readZip((await download(page, ()=> page.click('.proj-csv'))).buf)) out[e.name] = e.data.toString('utf8');
  const by = end => out[Object.keys(out).find(k=> k.endsWith(end))];
  return { eg: by(' - Eg.csv'), eu: by(' - Eu.csv'), info: by('analysis_info.csv') };
}
// A state put in as a tab opening a project puts it (db.js decode, then the restore).
const restore = (page, st)=> page.evaluate(async st=>{
  const u = await import('./utils.js'), db = await import('./db.js');
  u.restoreModuleState('tauc', db.decode(st));
  for (let i = 0; i < 3; i++) await new Promise(r=> requestAnimationFrame(r));
}, st);
const encoded = page => page.evaluate(async ()=>{ const u = await import('./utils.js'), db = await import('./db.js'); return db.encode(u.getModuleState('tauc')); });

/* A state as a project saves it: a Tauc card and an Urbach one read against it, their
   settings as given (points to v514, widths in eV from v515 to v519), on lines of their own
   (the Tauc ones common, the Urbach ones each sample's), `files` the state's own. */
const LINES = { v1: 2.95, v2: 3.6, v3: 2.1, v4: 2.85 }, URB = [{ v1: 2.6, v2: 3.2 }, { v1: 2.3, v2: 2.9 }];
const card = (id, type, states, ref = null)=> ({ id, type, base: '', nameAuto: true, collapsed: false, ref, refAuto: true, egSel: ['x', 'b'], urbSel: { b: ['p', 's'] }, states });
function saved(files, { tauc, urbach, per, perU }){
  const mode = per ? 'per' : 'shared';
  return { files, analyses: [
    card(1, 'tauc', { tauc: { mode, shared: { a: 0.5, ...tauc }, sharedVlines: LINES, per: files.map((f, i)=> per ? { a: 0.5, ...per[i], vlines: LINES } : {}), suggested: true } }),
    card(2, 'urbach', { urbach: { mode, shared: urbach, sharedVlines: {}, per: files.map((f, i)=> ({ ...(perU ? perU[i] : {}), vlines: URB[i] })), suggested: true } }, 1) ] };
}

/* v514's CSVs (its app, the same steps). DEF: the fixtures' two spectra at 1 nm, an Urbach
   card added, the defaults; CHO: Tauc N 4, N2 10, M 30, M2 80, Urbach N 3, N2 15, M 20; PER:
   the first spectrum and the second at 2 nm, one mode, the first N 6, N2 10, M 40, M2 120,
   the second N 2, N2 30, M 20, M2 60, the Urbach card in one mode, the second's M 15. */
const EG_H = 'Sample;Eg;Eg_err;Eg_baseline;Eg_baseline_err\n';
const EU_H = 'Sample;Eu_meV;Eu_err_meV;Eu_subtracted_meV;Eu_subtracted_err_meV;Eu_subtracted_err_fit_meV;Eu_subtracted_err_baseline_meV\n';
const INFO_H = 'Sample;Tauc Exponent;Smoothing points;Tauc regression points;Tauc start (eV);Tauc end (eV);Tauc R^2;Tauc NRMSE;Baseline regression points;Baseline start (eV);Baseline end (eV);Baseline R^2;Baseline NRMSE\n';
const V514 = {
  DEF: { eg: EG_H + 'drs1;3.158072;0.007588;3.218936;0.005341\ndrs2;2.888253;0.000516;2.946766;0.000525\n',
    eu: EU_H + 'drs1;521.419410;80.634060;66.569851;10.774641;6.326431;8.721763\ndrs2;79.337451;2.661142;48.863409;2.863125;2.831066;0.427262\n',
    info: INFO_H + 'drs1;0.5;1;25;3.220369;3.434465;0.994789;0.022441;100;2.145055;2.588397;0.966429;0.045615\ndrs2;0.5;1;25;3.220369;3.434465;0.999996;0.000600;100;2.163773;2.615700;0.978477;0.038468\n' },
  CHO: { eg: EG_H + 'drs1;-0.582033;0.506212;2.850637;0.071860\ndrs2;2.887512;0.000554;2.945838;0.000635\n',
    eu: EU_H + 'drs1;-4608.322076;4103.795192;;;;\ndrs2;75.746357;2.018824;78.322158;8.320786;7.202839;4.165883\n',
    info: INFO_H + 'drs1;0.5;4;30;2.830689;3.031399;0.929185;0.068006;80;2.217964;2.583004;0.950444;0.059327\ndrs2;0.5;4;30;3.179082;3.434465;0.999994;0.000748;80;2.133979;2.469805;0.965536;0.049640\n' },
  PER: { eg: EG_H + 'drs1;-0.464027;0.310587;2.938382;0.072661\nd2h;2.885238;0.001373;2.944189;0.001246\n',
    eu: EU_H + 'drs1;-7801.735676;7632.392859;;;;\nd2h;83.317039;5.191955;74.578495;8.829435;5.834585;6.626955\n',
    info: INFO_H + 'drs1;0.5;6;40;2.798740;3.068916;0.958533;0.051790;120;1.913336;2.343747;0.972562;0.042027\nd2h;0.5;2;20;3.099605;3.424978;0.999972;0.001597;60;1.974271;2.431063;0.985004;0.033143\n' },
  // The projects saved to v514 below, as v514 opened them: all mode (N 4, M 30) and one mode.
  ALL: EG_H + 'drs1;3.182168;0.001598;3.236415;0.001382\ndrs2;2.890770;0.000353;2.948954;0.000433\n',
  ONE: EG_H + 'drs1;3.170995;0.004729;3.227229;0.003867\nd2h;2.889620;0.000647;2.948111;0.000662\n',
  BAD: EG_H + 'drs1;3.184601;0.001125;3.239019;0.001475\ndrs2;2.891076;0.000283;2.952604;0.000584\n',
};

test('DRS: the windows in points, as v514: whole numbers in v514\'s fields, at its defaults; a value not a whole number or below the least set back', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    await urbachCard(page);
    const labels = await page.$$eval('#tab-tauc .an-card .param-grid > label.txt-label', ls=> ls.map(l=> l.textContent.trim()));
    assert.deepEqual(labels, ['Tauc exponent', '[F(R)hν]0.5 smoothing window', 'Derivative smoothing window', 'Tauc linear region regression window', 'Baseline regression window',
      'Tauc reference', 'ln[F(R)] smoothing window', 'Derivative smoothing window', 'Urbach linear region regression window']);
    for (const [id, min] of [['an1N', '1'], ['an1N2', '1'], ['an1M', '2'], ['an1M2', '2'], ['an2N', '1'], ['an2N2', '1'], ['an2M', '2']])
      assert.deepEqual(await page.$eval('#' + id, e=> [e.type, e.min, e.step]), ['number', min, ''], id);
    assert.equal(await page.locator('#tab-tauc .an-card .wf-pts, #an1Pts1, #an1Pts2, #an2Pts1, #an2Pts1s').count(), 0, 'no points beside a field, no n beside a fit');
    assert.deepEqual(await shared(page), { a: 0.5, N: 1, N2: 20, M: 25, M2: 100 });
    assert.deepEqual(await shared(page, 1), { N: 1, N2: 20, M: 25 });
    assert.deepEqual(await Promise.all(['an1N', 'an1N2', 'an1M', 'an1M2', 'an2N', 'an2N2', 'an2M'].map(id=> val(page, id))), ['1', '20', '25', '100', '1', '20', '25']);
    // Not a whole number, below the least: set back, nothing taken.
    await enter(page, 'an1N', '2.5');
    await enter(page, 'an1M', 1);
    await enter(page, 'an2N2', 0);
    assert.deepEqual([await val(page, 'an1N'), await val(page, 'an1M'), await val(page, 'an2N2')], ['1', '25', '20']);
    assert.deepEqual([await shared(page), await shared(page, 1)], [{ a: 0.5, N: 1, N2: 20, M: 25, M2: 100 }, { N: 1, N2: 20, M: 25 }]);
    // Taken: the window M points in analysis_info.csv.
    await enter(page, 'an1M', 30);
    assert.equal((await shared(page)).M, 30);
    const info = (await csvs(page)).info.split('\n');
    assert.equal(info[0] + '\n', INFO_H);
    assert.deepEqual(info[1].split(';').slice(2, 4), ['1', '30']);
    // Fewer points between the lines than the window: no fit, said.
    await enter(page, 'an1M', 2000);
    assert.match(await page.textContent('#an1Alert'), /Interval too small: too few points for the regression!/);
    assert.equal(await page.textContent('#an1Eg'), '-');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('DRS: E_g and E_U as v514 gave them, every CSV value, at the defaults, at windows chosen and in one mode with a spectrum at 2 nm', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    await urbachCard(page);
    assert.deepEqual(await csvs(page), V514.DEF, 'the defaults');
    for (const [id, v] of [['an1N', 4], ['an1N2', 10], ['an1M', 30], ['an1M2', 80], ['an2N', 3], ['an2N2', 15], ['an2M', 20]]) await enter(page, id, v);
    assert.deepEqual(await csvs(page), V514.CHO, 'windows chosen');
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [env.fx.files.tauc[0], d2h]);
    await urbachCard(page);
    await page.click('#an1ModeAll'); await settle(page);
    for (const [id, v] of [['an1N', 6], ['an1N2', 10], ['an1M', 40], ['an1M2', 120]]) await enter(page, id, v);
    await page.click('#an1Next'); await settle(page);
    for (const [id, v] of [['an1N', 2], ['an1N2', 30], ['an1M', 20], ['an1M2', 60]]) await enter(page, id, v);
    await page.click('#an2ModeAll'); await settle(page);
    await enter(page, 'an2M', 15);
    assert.deepEqual(await csvs(page), V514.PER, 'one mode');
    assert.deepEqual(await per(page), [[{ a: 0.5, N: 6, N2: 10, M: 40, M2: 120 }, { a: 0.5, N: 2, N2: 30, M: 20, M2: 60 }], [{ N: 1, N2: 20, M: 25 }, { N: 1, N2: 20, M: 15 }]]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('DRS: the suggestion places the lines as v514 did; on a step edge at 1 nm, the whole span kept, as v514', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    await urbachCard(page);
    let [t, u] = await states(page);
    assert.deepEqual(t.sharedVlines, { v1: 2.7865188740763758, v2: 3.4434271540970287, v3: 1.9365188740763757, v4: 2.6865188740763757 });
    u.per.forEach(q=> assert.deepEqual(q.vlines, { v1: 2.3274171025650254, v2: 3.220368831168831 }));
    // No run of 25 points with |Y''| above 10% of its largest: the lines at the ends of the
    // span kept (v515 to v519 found the edge, E_g 3.126 eV).
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [step]);
    [t] = await states(page);
    assert.deepEqual(t.sharedVlines, { v1: 1.8928885496183208, v2: 4.609078066914498, v3: 1.5498025000000002, v4: 1.7928885496183207 });
    assert.equal((await csvs(page)).eg, EG_H + 'step;-1.928577;0.005649;1.794912;0.005424\n');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('DRS: a project saved to v514 opens as v514 opened it: its points kept, its E_g v514\'s', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    // All mode, through the Projects list.
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    const { obj } = await exportProject(page);
    await importProject(page, projectFile(env, 'v514all.datatreat', { ...obj, title: 'v514all', appVersion: 'v514', state: saved(obj.state.files, { tauc: { N: 4, N2: 20, M: 30, M2: 100 }, urbach: { N: 1, N2: 20, M: 25 } }) }, { sign: true }));
    await openProject(page, 'tauc', 'v514all');
    assert.deepEqual([await shared(page), await shared(page, 1)], [{ a: 0.5, N: 4, N2: 20, M: 30, M2: 100 }, { N: 1, N2: 20, M: 25 }]);
    assert.deepEqual(await Promise.all(['an1N', 'an1N2', 'an1M', 'an1M2'].map(id=> val(page, id))), ['4', '20', '30', '100']);
    assert.equal((await csvs(page)).eg, V514.ALL);
    // One mode, the second spectrum at 2 nm.
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [env.fx.files.tauc[0], d2h]);
    const files = (await encoded(page)).files;
    await restore(page, saved(files, { tauc: { N: 1, N2: 20, M: 25, M2: 100 }, urbach: { N: 1, N2: 20, M: 25 }, per: [{ N: 6, N2: 10, M: 40, M2: 120 }, { N: 2, N2: 30, M: 20, M2: 60 }], perU: [{ N: 3, N2: 20, M: 30 }, { N: 1, N2: 20, M: 15 }] }));
    await settle(page);
    assert.deepEqual(await per(page), [[{ a: 0.5, N: 6, N2: 10, M: 40, M2: 120 }, { a: 0.5, N: 2, N2: 30, M: 20, M2: 60 }], [{ N: 3, N2: 20, M: 30 }, { N: 1, N2: 20, M: 15 }]]);
    assert.equal((await csvs(page)).eg, V514.ONE);
    // Values that are no number, or below the least: the defaults; one not whole kept, and
    // rounded where it acts.
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    const f = (await encoded(page)).files;
    await restore(page, saved(f, { tauc: { N: 'x', N2: -5, M: null, M2: 50.4 }, urbach: { N: 1, N2: 'y', M: '25' } })); await settle(page);
    assert.deepEqual([await shared(page), await shared(page, 1)], [{ a: 0.5, N: 1, N2: 20, M: 25, M2: 50.4 }, { N: 1, N2: 20, M: 25 }]);
    assert.equal(await val(page, 'an1M2'), '50');
    assert.equal((await csvs(page)).eg, V514.BAD);
    // A project from before the cards: one Tauc analysis, its fields' values by their ids.
    await restore(page, { files: f, params: { taucA: '0.5', taucN: '4', taucN2: '20', taucM: '30', taucM2: '100' }, vlines: LINES }); await settle(page);
    assert.deepEqual(await shared(page), { a: 0.5, N: 4, N2: 20, M: 30, M2: 100 });
    assert.equal((await csvs(page)).eg, V514.ALL);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* ---- Saved by v515 to v519: widths in eV ----
   The points of the windows v519 chose, as its fields showed them for each sample ('≈ N
   pts'), in these states: ALL, all mode on the first spectrum and the second at 2 nm, Tauc
   W 0.25 eV (the baseline's 0.5, the default), Urbach W 0.2; ONE, one mode, Tauc W 0.3 and
   0.15, W2 0.45 and 0.5, Urbach W 0.25 and 0.1; KIND, an Urbach card's settings kept on a
   Tauc card, W 0.2, shown as it was switched. */
const V519 = { ALL: { M: [26, 13], U: [27, 17] }, ONE: { M: [32, 8], M2: [101, 57], U: [36, 9] }, KIND: [29, 18] };
const median = a =>{ const s = a.slice().sort((x, y)=> x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1] + s[m])/2; };
// A spectrum's energy step at its middle: the middle point's, in energy order, to its two neighbours.
const midStep = wl =>{ const E = wl.map(x=> 1239.842/x).sort((a, b)=> a - b), m = E.length >> 1; return (E[m+1] - E[m-1])/2; };

test('DRS: a project saved by v515 to v519, its widths in eV, opens in points: v515\'s defaults v514\'s, a window the points v519 chose, a smoothing over the middle step', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    // All mode, through the Projects list: the median over the samples.
    await loadFiles(page, 'tauc', [env.fx.files.tauc[0], d2h]);
    const { obj } = await exportProject(page), st = obj.state.files.map(f=> midStep(f.wl));
    await importProject(page, projectFile(env, 'v519all.datatreat', { ...obj, title: 'v519all', appVersion: 'v519', state: saved(obj.state.files, { tauc: { w: 0.03, w2: 0.1, W: 0.25, W2: 0.5 }, urbach: { w: 0, w2: 0.15, W: 0.2 } }) }, { sign: true }));
    await openProject(page, 'tauc', 'v519all');
    const pt = (w, s)=> Math.round(median(s.map(x=> w/x)));
    assert.deepEqual([await shared(page), await shared(page, 1)], [{ a: 0.5, N: pt(0.03, st), N2: pt(0.1, st), M: Math.round(median(V519.ALL.M)), M2: 100 }, { N: 1, N2: 20, M: Math.round(median(V519.ALL.U)) }]);
    assert.deepEqual([pt(0.03, st), pt(0.1, st), Math.round(median(V519.ALL.M)), Math.round(median(V519.ALL.U))], [5, 17, 20, 22]);
    assert.deepEqual(await Promise.all(['an1N', 'an1N2', 'an1M', 'an1M2'].map(id=> val(page, id))), ['5', '17', '20', '100']);
    // Saved again, in points: v514's form.
    const s2 = (await exportProject(page)).obj.state.analyses.map(a=> a.states[a.type].shared);
    assert.deepEqual(s2, [{ a: 0.5, N: 5, N2: 17, M: 20, M2: 100 }, { N: 1, N2: 20, M: 22 }]);

    // One mode: each sample's own at its spectrum (one Urbach entry with W alone, the common
    // ones for the rest).
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [env.fx.files.tauc[0], d2h]);
    const files = (await encoded(page)).files, one = { tauc: { w: 0, w2: 0.15, W: 0.2, W2: 0.5 }, urbach: { w: 0, w2: 0.15, W: 0.15 },
      per: [{ w: 0.03, w2: 0.15, W: 0.3, W2: 0.45 }, { w: 0.05, w2: 0.2, W: 0.15, W2: 0.5 }], perU: [{ w: 0, w2: 0, W: 0.25 }, { W: 0.1 }] };
    await restore(page, saved(files, one)); await settle(page);
    const want = [[{ a: 0.5, N: Math.round(0.03/st[0]), N2: 20, M: V519.ONE.M[0], M2: V519.ONE.M2[0] }, { a: 0.5, N: Math.round(0.05/st[1]), N2: Math.round(0.2/st[1]), M: V519.ONE.M[1], M2: 100 }],
      [{ N: 1, N2: 1, M: V519.ONE.U[0] }, { M: V519.ONE.U[1] }]];
    assert.deepEqual(await per(page), want);
    assert.deepEqual([await shared(page), await shared(page, 1)], [{ a: 0.5, N: 1, N2: 20, M: 25, M2: 100 }, { N: 1, N2: 20, M: 25 }], 'the common ones at v515\'s defaults: v514\'s');
    await page.click('#an1Next'); await settle(page);
    assert.deepEqual(await Promise.all(['an1N', 'an1N2', 'an1M', 'an1M2', 'an2N', 'an2N2', 'an2M'].map(id=> val(page, id))), ['6', '22', '8', '100', '1', '20', '9']);

    // A file left out with its entries in eV, in one mode: converted as it is taken back in.
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [env.fx.files.tauc[0], d2h]);
    const f3 = (await encoded(page)).files, st3 = saved(f3, one);
    const [t, u] = st3.analyses.map(a=> Object.values(a.states)[0].per);
    st3.files = [f3[0], { ...f3[1], included: false, held: { '1:tauc': t[1], '2:urbach': u[1] } }];
    t.splice(1, 1); u.splice(1, 1);
    await restore(page, st3); await settle(page);
    assert.deepEqual((await per(page)).map(c=> c.length), [1, 1]);
    await page.click('#taucFileTableWrap tr.file-row:nth-child(2) .file-incl'); await settle(page);
    assert.deepEqual(await per(page), want);

    // Values that are no number, or out of range: the defaults; a width beside its points: the points.
    await restore(page, saved(f3, { tauc: { w: 'x', w2: -1, W: null, W2: 0 }, urbach: { N: 4, w: 0.5, W: '0.2' } })); await settle(page);
    assert.deepEqual([await shared(page), await shared(page, 1)], [{ a: 0.5, N: 1, N2: 20, M: 25, M2: 100 }, { N: 4, N2: 20, M: 25 }]);

    // A card's settings of the kind it is not showing, in eV: converted as it is switched.
    const st4 = saved(f3, { tauc: { w: 0, w2: 0.15, W: 0.2, W2: 0.5 }, urbach: { w: 0, w2: 0.15, W: 0.15 } });
    st4.analyses = [card(1, 'tauc', { ...st4.analyses[0].states, urbach: { mode: 'shared', shared: { w: 0.02, w2: 0.15, W: 0.2 }, sharedVlines: {}, per: URB.map(v=> ({ vlines: v })), suggested: true } })];
    await restore(page, st4); await settle(page);
    assert.deepEqual(await shared(page), { a: 0.5, N: 1, N2: 20, M: 25, M2: 100 });
    await page.click('#tab-tauc .an-card .an-type'); await page.click('.an-menu:not([hidden]) [data-kind="urbach"]'); await settle(page);
    assert.deepEqual(await shared(page), { N: pt(0.02, st), N2: 20, M: Math.round(median(V519.KIND)) });
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
