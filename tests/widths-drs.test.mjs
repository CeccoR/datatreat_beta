/* DRS's widths on the energy axis (smooth.js; to v514 numbers of points): the Tauc and
   Urbach cards' smoothing, derivative smoothing and regression windows, in eV. Each field
   shows its value to 4 significant digits, keeps it exact, and shows in its box what it
   spans in points of the sample on show, as it is typed: a smoothing, its range over the
   spectrum (hν = hc/λ, its step uneven); a regression window, the points of the window
   the scan chose, and while another value is typed those a window that wide holds between
   the lines; off at 0. Each fit's points are on the card (n) and in analysis_info.csv,
   whose widths are in eV. One width treats alike a spectrum measured at 0.5, 1 and 2 nm,
   and the suggestion finds a sharp edge measured at 1 nm (the e2e fixture's form: to
   v514 the whole span, E_g −1.929 eV); with no derivative smoothing (typed, or N2 = 1
   converted) it gives the whole span, as v514 at N2 = 1, not lines on the noise. A window
   beside a gap in the data, holding the few points on one side of it, is passed over; an
   interval with no window to fit is said narrower than its window, or with no window
   holding 3 points over half its width, by what the scan found. A project saved up to
   v514 (N, N2, M, M2) opens with them converted at each sample's spectrum, v514's window
   choice made again: in one mode each sample's windows hold v514's points and its E_g is
   v514's; in all mode the median, here v514's E_g; a smoothing that would make the scan
   take another window than v514's is narrowed; N = 1 is none; values that are no number,
   the defaults; a project from before the cards; a file left out, converted as it comes
   back; a card's kept settings of the other kind, as it is switched. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, exportProject, projectFile, importProject, openProject, download, readZip, parseCsv } from './helpers.mjs';
import { drsCsv, rng } from './fixtures.mjs';

let env, d2h, at, step, gap;
// The e2e fixture's form: an edge as a step at 3.2 eV, F(R) rising 20 per eV from 3.1 above
// it, the tail below, every nm from 250 to 800 and no noise. The lobes of its curvature are
// narrower than the run of 25 points v514's suggestion asked for.
function stepEdge(){
  const rows = ['Sample,', 'Wavelength (nm),F(R)'];
  for (let w = 250; w <= 800; w++){ const e = 1239.842/w; rows.push(w + ',' + (e > 3.2 ? 20*(e - 3.1) : 0.05 + 0.02*Math.exp((e - 3.2)/0.12)).toFixed(5)); }
  return Buffer.from(rows.join('\n') + '\n', 'utf8');
}
// The same spectrum (drsCsv's form) measured every `step` nm from 250 to 800.
function drsAt(step, { Eg = 3.0, A = 50, seed = 7 } = {}){
  const r = rng(seed), rows = ['Sample,', 'Wavelength (nm),F(R)'];
  for (let k = 0; 250 + k*step <= 800; k++){
    const w = 250 + k*step, e = 1239.842/w;
    rows.push(+w.toFixed(3) + ',' + (0.05 + (e > Eg ? A*(e - Eg)**2/e : 0) + 0.02*Math.exp(Math.min(0, e - Eg)/0.08) + 0.0005*r.n()).toFixed(6));
  }
  return Buffer.from(rows.join('\n') + '\n', 'utf8');
}
before(async ()=>{
  env = await start();
  // The fixtures' second spectrum at 2 nm (every other row), and one spectrum at 0.5, 1, 2 nm.
  const l = drsCsv({ Eg: 2.9, A: 45, seed: 4 }).toString('utf8').split('\n');
  d2h = env.fx.put('d2h.csv', [l[0], l[1], ...l.slice(2).filter((r, i)=> i % 2 === 0)].join('\n'));
  at = [0.5, 1, 2].map(s=> env.fx.put(`at${s}.csv`, drsAt(s)));
  step = env.fx.put('step.csv', stepEdge());
  // The fixtures' first spectrum with its rows from 330 to 370 nm left out (3.35 to 3.76 eV).
  gap = env.fx.put('gap.csv', drsCsv({ Eg: 3.2 }).toString('utf8').split('\n').filter(r=> !(parseFloat(r) >= 330 && parseFloat(r) <= 370)).join('\n'));
});
after(()=> env && env.close());

const val = (page, id)=> page.inputValue('#' + id);
const pts = (page, id)=> page.textContent('#' + id + 'Pts');
const txt = (page, id)=> page.textContent('#' + id);
async function enter(page, id, v){ await page.fill('#' + id, String(v)); await page.press('#' + id, 'Enter'); await settle(page); }
async function urbachCard(page){ await page.click('#taucAddAn'); await page.click('.an-menu:not([hidden]) [data-kind="urbach"]'); await settle(page); }
const shared = async (page, k = 0)=>{ const a = (await moduleState(page, 'tauc')).analyses[k]; return a.states[a.type].shared; };
// The CSVs of the project bar: each card's Eg.csv, Eu.csv and analysis_info.csv, by their ends.
async function csvs(page){
  const out = {};
  for (const e of readZip((await download(page, ()=> page.click('.proj-csv'))).buf)) out[e.name] = parseCsv(e.data.toString('utf8').replace(/^﻿/, ''), ';');
  const by = end => out[Object.keys(out).find(k=> k.endsWith(end))];
  return { eg: by('Eg.csv'), eu: by('Eu.csv'), info: by('analysis_info.csv') };
}
const near = (a, b, tol, what)=> assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);
// A state put in as a tab opening a project puts it (db.js decode, then the restore).
const restore = (page, st)=> page.evaluate(async st=>{
  const u = await import('./utils.js'), db = await import('./db.js');
  u.restoreModuleState('tauc', db.decode(st));
  for (let i = 0; i < 3; i++) await new Promise(r=> requestAnimationFrame(r));
}, st);
const encoded = page => page.evaluate(async ()=>{ const u = await import('./utils.js'), db = await import('./db.js'); return db.encode(u.getModuleState('tauc')); });

/* A project as v514 saved it: a Tauc card and an Urbach one read against it, their
   settings in points, on lines of their own (the Tauc ones common, the Urbach ones each
   sample's), `files` the state's own. */
const LINES = { v1: 2.95, v2: 3.6, v3: 2.1, v4: 2.85 }, URB = [{ v1: 2.6, v2: 3.2 }, { v1: 2.3, v2: 2.9 }];
const card = (id, type, states, ref = null)=> ({ id, type, base: '', nameAuto: true, collapsed: false, ref, refAuto: true, egSel: ['x', 'b'], urbSel: { b: ['p', 's'] }, states });
function v514(files, { tauc, urbach, per, perU }){
  const mode = per ? 'per' : 'shared';
  return { files, analyses: [
    card(1, 'tauc', { tauc: { mode, shared: { a: 0.5, ...tauc }, sharedVlines: LINES, per: files.map((f, i)=> per ? { a: 0.5, ...per[i], vlines: LINES } : {}), suggested: true } }),
    card(2, 'urbach', { urbach: { mode, shared: urbach, sharedVlines: {}, per: files.map((f, i)=> ({ ...(perU ? perU[i] : {}), vlines: URB[i] })), suggested: true } }, 1) ] };
}
// v514's E_g (x-axis) and E_g (baseline), on these lines: the fixtures' two spectra at 1 nm,
// all mode, N 4, M 30; the first at 1 nm and the second at 2 nm, one mode, N 6, M 40, M2
// 120 and N 2, M 20, M2 60.
const V512 = { all: [[3.18217, 3.23642], [2.89077, 2.94895]], per: [[3.17100, 3.22723], [2.88962, 2.94811]] };
const egs = c => c.eg.slice(1).map(r=> [+r[1], +r[3]]);
const per = async page => (await moduleState(page, 'tauc')).analyses.map(a=> a.states[a.type].per);

test('DRS: the widths in eV, each field showing the points it spans for the sample on show, as typed', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [env.fx.files.tauc[0], d2h]);
    await urbachCard(page);
    const labels = await page.$$eval('#tab-tauc .an-card .param-grid > label.txt-label', ls=> ls.map(l=> l.textContent.trim()));
    assert.deepEqual(labels, ['Tauc exponent', '[F(R)hν]0.5 smoothing width (eV)', 'Derivative smoothing width (eV)', 'Tauc linear region regression window (eV)', 'Baseline regression window (eV)',
      'Tauc reference', 'ln[F(R)] smoothing width (eV)', 'Derivative smoothing width (eV)', 'Urbach linear region regression window (eV)']);
    for (const id of ['an1Smooth', 'an1DSmooth', 'an1Win', 'an1Win2', 'an2Smooth', 'an2DSmooth', 'an2Win'])
      assert.deepEqual(await page.$eval('#' + id, e=> [e.type, e.inputMode]), ['text', 'decimal'], id);
    assert.deepEqual(await shared(page), { a: 0.5, w: 0, w2: 0.15, W: 0.2, W2: 0.5 });
    assert.deepEqual(await shared(page, 1), { w: 0, w2: 0.15, W: 0.15 });
    assert.deepEqual(await Promise.all(['an1Smooth', 'an1DSmooth', 'an1Win', 'an1Win2', 'an2Win'].map(id=> val(page, id))), ['0', '0.15', '0.2', '0.5', '0.15']);
    // The smoothing: off at 0; over the spectrum at 1 nm, from 0.0198 eV at 250 nm to 0.0019 at 800.
    assert.deepEqual([await pts(page, 'an1Smooth'), await pts(page, 'an1DSmooth'), await pts(page, 'an2DSmooth')], ['off', '≈ 7.6–77 pts', '≈ 7.6–77 pts']);
    // A window: the points of the one chosen, those its fit took.
    for (const [id, n] of [['an1Win', 'Pts1'], ['an1Win2', 'Pts2'], ['an2Win', 'Pts1']]){
      const m = /^≈ (\d+) pts$/.exec(await pts(page, id));
      assert.ok(m, id + ': ' + await pts(page, id));
      assert.equal(await txt(page, id.slice(0, 3) + n), m[1] + ' pts', id);
    }
    const w1 = +(/^≈ (\d+)/.exec(await pts(page, 'an1Win'))[1]);
    // The sample at 2 nm on show: half the points, the same width.
    await page.click('#an1Next'); await settle(page);
    assert.equal(await pts(page, 'an1DSmooth'), '≈ 3.8–39 pts');
    const w2 = +(/^≈ (\d+)/.exec(await pts(page, 'an1Win'))[1]);
    assert.ok(w2 < 0.65*w1, `${w2} points at 2 nm against ${w1} at 1 nm`);
    const span = (await page.getAttribute('#an1WinPts', 'title')).match(/from ([\d.]+) to ([\d.]+) eV/);
    assert.ok(span && +span[2] - +span[1] <= 0.2 + 1e-3 && +span[2] - +span[1] > 0.17, 'the window chosen spans the width: ' + span);
    // As typed, before it is taken: those a window that wide holds between the lines; then taken.
    await page.fill('#an1Win', '0.1');
    assert.match(await pts(page, 'an1Win'), /^≈ \d+–\d+ pts$/);
    assert.equal((await shared(page)).W, 0.2, 'not taken while typed');
    await page.press('#an1Win', 'Enter'); await settle(page);
    assert.equal((await shared(page)).W, 0.1);
    assert.equal(await pts(page, 'an1Win'), '≈ ' + (await txt(page, 'an1Pts1')));
    // 0 is no smoothing; a window of 0, or a value below 0, is refused and set back.
    await enter(page, 'an1Smooth', 0.02);
    assert.equal(await pts(page, 'an1Smooth'), '≈ 0.51–5.1 pts');
    await enter(page, 'an1Smooth', 0);
    assert.deepEqual([await val(page, 'an1Smooth'), await pts(page, 'an1Smooth')], ['0', 'off']);
    await enter(page, 'an1Smooth', -1);
    assert.deepEqual([await val(page, 'an1Smooth'), await pts(page, 'an1Smooth')], ['0', 'off']);
    await enter(page, 'an1Win', 0);
    assert.equal(await val(page, 'an1Win'), '0.1');
    // Shown to 4 significant digits, kept exact through another field's change.
    await enter(page, 'an1DSmooth', '0,123456');
    assert.equal(await val(page, 'an1DSmooth'), '0.1235');
    await enter(page, 'an1Win2', 0.45);
    assert.equal((await shared(page)).w2, 0.123456);
    // A window wider than its interval: no fit, the card says why, the field what the interval holds.
    await enter(page, 'an1Win', 3);
    assert.match(await txt(page, 'an1Alert'), /Interval too small: the Tauc linear region is narrower than its regression window\./);
    assert.match(await pts(page, 'an1Win'), /^> \d+ pts$/);
    assert.equal(await txt(page, 'an1Pts1'), '-');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('DRS: one width treats alike a spectrum at 0.5, 1 and 2 nm; the suggestion finds a sharp edge at 1 nm; analysis_info in eV', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    // The sharp edge at 1 nm alone: to v514 no run of 25 points was found, the lines were
    // the whole span kept (1.893 and 4.609 eV), and E_g −1.929 eV.
    await loadFiles(page, 'tauc', [step]);
    const L = (await moduleState(page, 'tauc')).analyses[0].states.tauc.sharedVlines;
    assert.ok(L.v1 > 2.9 && L.v2 < 3.5, 'lines ' + L.v1 + ' ' + L.v2);
    const [[eg]] = egs(await csvs(page));
    assert.ok(eg > 3.05 && eg < 3.2, 'E_g ' + eg);
    await page.click('#taucFileTableWrap tr.file-row .row-del'); await settle(page);
    await loadFiles(page, 'tauc', at);
    await urbachCard(page);
    const c = await csvs(page), h = c.info[0], col = k => c.info.slice(1).map(r=> r[h.indexOf(k)]);
    assert.deepEqual(h, ['Sample', 'Tauc Exponent', 'Smoothing width (eV)', 'Tauc regression window (eV)', 'Tauc fit points', 'Tauc start (eV)', 'Tauc end (eV)', 'Tauc R^2', 'Tauc NRMSE',
      'Baseline regression window (eV)', 'Baseline fit points', 'Baseline start (eV)', 'Baseline end (eV)', 'Baseline R^2', 'Baseline NRMSE']);
    assert.deepEqual([col('Smoothing width (eV)'), col('Tauc regression window (eV)'), col('Baseline regression window (eV)')].map(v=> v[0]), ['0.000000', '0.200000', '0.500000']);
    // The windows span the same 0.2 eV at the three steps, their points about 4 : 2 : 1.
    const n = col('Tauc fit points').map(Number), s = col('Tauc start (eV)').map(Number), e = col('Tauc end (eV)').map(Number);
    s.forEach((v, i)=> assert.ok(e[i] - v <= 0.2 + 1e-9 && e[i] - v > 0.17, `window ${i}: ${v}–${e[i]}`));
    assert.ok(n[0] > 1.8*n[1] && n[1] > 1.8*n[2], 'points ' + n);
    // E_g within 0.01 eV of each other (to v514, 25 points each: 2.986, 2.982, 2.936), E_g
    // (baseline) at every step (to v514, 100 points did not fit at 2 nm), the subtracted
    // E_U within 3 meV (to v514 40, 78 meV, none).
    const g = egs(c), eu = c.eu.slice(1).map(r=> +r[3]);
    assert.ok(Math.max(...g.map(x=> x[0])) - Math.min(...g.map(x=> x[0])) < 0.01, 'E_g ' + g.map(x=> x[0]));
    assert.ok(g.every(x=> x[1] > 2.9 && x[1] < 3.1), 'E_g (baseline) ' + g.map(x=> x[1]));
    assert.ok(Math.max(...eu) - Math.min(...eu) < 3 && eu.every(v=> v > 60 && v < 90), 'E_U (subtracted) ' + eu);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('DRS: a project saved up to v514 opens with its points as widths at its spectra, its E_g as v514 gave it', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    // All mode, the two spectra at 1 nm, through the Projects list.
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    const { obj } = await exportProject(page);
    await importProject(page, projectFile(env, 'v514all.datatreat', { ...obj, title: 'v514all', state: v514(obj.state.files, { tauc: { N: 4, N2: 20, M: 30, M2: 100 }, urbach: { N: 1, N2: 20, M: 25 } }) }, { sign: true }));
    await openProject(page, 'tauc', 'v514all');
    let sh = await shared(page), c = await csvs(page);
    assert.deepEqual(Object.keys(sh).sort(), ['W', 'W2', 'a', 'w', 'w2']);
    // Both windows chosen hold v514's 30 points, the smoothing its 4 steps there.
    assert.equal(await txt(page, 'an1Pts1'), '30 pts');
    assert.equal(await pts(page, 'an1Win'), '≈ 30 pts');
    near(sh.w, 4*sh.W/29, 0.01*sh.w, 'w = 4 steps');
    near(sh.w2, 20*sh.W/29, 0.01*sh.w2, 'w2 = 20 steps');
    assert.equal((await shared(page, 1)).w, 0, 'N = 1: none');
    egs(c).forEach((x, i)=>{ near(x[0], V512.all[i][0], 1e-5, 'E_g ' + i); near(x[1], V512.all[i][1], 5e-4, 'E_g (baseline) ' + i); });
    assert.equal(c.info[1][2], sh.w.toFixed(6));

    // One mode, the second spectrum at 2 nm: each sample its own widths, its windows v514's points.
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [env.fx.files.tauc[0], d2h]);
    const files = (await encoded(page)).files;
    await restore(page, v514(files, { tauc: { N: 1, N2: 20, M: 25, M2: 100 }, urbach: { N: 1, N2: 20, M: 25 }, per: [{ N: 6, N2: 10, M: 40, M2: 120 }, { N: 2, N2: 30, M: 20, M2: 60 }] }));
    await settle(page);
    const [tp] = await per(page);
    tp.forEach(q=> assert.deepEqual(Object.keys(q).sort(), ['W', 'W2', 'a', 'vlines', 'w', 'w2']));
    near(tp[0].w, 6*tp[0].W/39, 0.01*tp[0].w, 'w = 6 steps'); near(tp[1].w, 2*tp[1].W/19, 0.01*tp[1].w, 'w = 2 steps');
    assert.ok(tp[1].W > 1.8*tp[0].W/39*19, 'the 2 nm window wider per point');
    assert.equal(await txt(page, 'an1Pts1'), '40 pts');
    await page.click('#an1Next'); await settle(page);
    assert.deepEqual([await txt(page, 'an1Pts1'), await txt(page, 'an1Pts2')], ['20 pts', '60 pts']);
    c = await csvs(page);
    egs(c).forEach((x, i)=>{ near(x[0], V512.per[i][0], 1e-5, 'E_g ' + i); near(x[1], V512.per[i][1], 5e-4, 'E_g (baseline) ' + i); });
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('DRS: v514\'s points converted where else they come from: none, no number, before the cards, a file left out, the other kind\'s', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', env.fx.files.tauc);
    const files = (await encoded(page)).files;
    // Values that are no number, or below what v514 took: the defaults; a width held wins.
    await restore(page, v514(files, { tauc: { N: 'x', N2: -5, M: null, M2: 50, W2: 0.3 }, urbach: { N: 1, N2: 'y', M: '25' } }));
    assert.deepEqual(await shared(page), { a: 0.5, w: 0, w2: 0.15, W: 0.2, W2: 0.3 });
    assert.deepEqual(await shared(page, 1), { w: 0, w2: 0.15, W: 0.15 });
    // A project from before the cards: one Tauc analysis, its fields' values by their ids.
    await restore(page, { files, params: { taucA: '0.5', taucN: '4', taucN2: '20', taucM: '30', taucM2: '100' }, vlines: LINES });
    await settle(page);
    const sh = await shared(page);
    assert.equal(await txt(page, 'an1Pts1'), '30 pts');
    near(sh.w, 4*sh.W/29, 0.01*sh.w, 'w = 4 steps');
    egs(await csvs(page)).forEach((x, i)=> near(x[0], V512.all[i][0], 1e-5, 'E_g ' + i));
    // A card's settings of the kind it is not showing, in points: converted as it is switched.
    const st2 = v514(files, { tauc: { N: 1, N2: 20, M: 25, M2: 100 }, urbach: { N: 1, N2: 20, M: 25 } });
    st2.analyses = [card(1, 'tauc', { ...st2.analyses[0].states, urbach: { mode: 'shared', shared: { N: 3, N2: 20, M: 30 }, sharedVlines: {}, per: URB.map(v=> ({ vlines: v })), suggested: true } })];
    await restore(page, st2); await settle(page);
    await page.click('#tab-tauc .an-card .an-type'); await page.click('.an-menu:not([hidden]) [data-kind="urbach"]'); await settle(page);
    const us = await shared(page);
    assert.deepEqual(Object.keys(us).sort(), ['W', 'w', 'w2']);
    near(us.w, 3*us.W/29, 0.01*us.w, 'w = 3 steps');
    assert.match(await pts(page, 'an1Win'), /^≈ \d+ pts$/);
    // One mode, the second file (at 2 nm) left out with its entries in points: converted at
    // its spectrum as it is taken back in, its window v514's 20 points, its E_g v514's.
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [env.fx.files.tauc[0], d2h]);
    const files2 = (await encoded(page)).files;
    const st = v514(files2, { tauc: { N: 1, N2: 20, M: 25, M2: 100 }, urbach: { N: 1, N2: 20, M: 25 }, per: [{ N: 6, N2: 10, M: 40, M2: 120 }, { N: 2, N2: 30, M: 20, M2: 60 }], perU: [{ N: 3, N2: 20, M: 30 }, { N: 1, N2: 20, M: 15 }] });
    const [t, u] = st.analyses.map(a=> Object.values(a.states)[0].per);
    st.files = [files2[0], { ...files2[1], included: false, held: { '1:tauc': t[1], '2:urbach': u[1] } }];
    t.splice(1, 1); u.splice(1, 1);
    await restore(page, st); await settle(page);
    assert.equal((await per(page))[0].length, 1);
    await page.click('#taucFileTableWrap tr.file-row:nth-child(2) .file-incl'); await settle(page);
    const [tp, up] = await per(page);
    assert.deepEqual(Object.keys(tp[1]).sort(), ['W', 'W2', 'a', 'vlines', 'w', 'w2']);
    assert.deepEqual(Object.keys(up[1]).sort(), ['W', 'vlines', 'w', 'w2']);
    near(tp[1].w, 2*tp[1].W/19, 0.01*tp[1].w, 'w = 2 steps');
    assert.equal(up[1].w, 0);
    await page.click('#an1Next'); await settle(page);
    assert.equal(await txt(page, 'an1Pts1'), '20 pts');
    near(egs(await csvs(page))[1][0], V512.per[1][0], 1e-5, 'E_g');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// The lines of card k as a drag leaves them (the state put back in).
const setLines = (page, lines, k = 0)=> page.evaluate(async ([lines, k])=>{
  const u = await import('./utils.js'), db = await import('./db.js'), s = u.getModuleState('tauc'), a = s.analyses[k];
  Object.assign(a.states[a.type].sharedVlines, lines);
  u.restoreModuleState('tauc', db.decode(db.encode(s)));
  for (let i = 0; i < 3; i++) await new Promise(r=> requestAnimationFrame(r));
}, [lines, k]);
const energies = async page => (await moduleState(page, 'tauc')).files[0].wl.map(x=> 1239.842/x);
const tLines = async page =>{ const L = (await moduleState(page, 'tauc')).analyses[0].states.tauc.sharedVlines; return [L.v1, L.v2]; };

test('DRS: with no derivative smoothing, typed or converted from N2 = 1, the suggestion gives the whole span, as v514 at N2 = 1', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [env.fx.files.tauc[0]]);
    // The span the suggestion searches: the energies but the outer 10% of their range.
    const E = await energies(page), lo = Math.min(...E), hi = Math.max(...E), cut = 0.1*(hi - lo);
    const kept = E.filter(e=> e >= lo + cut && e <= hi - cut), whole = [Math.min(...kept), Math.max(...kept)];
    // Y'' not smoothed is the curve's noise grown as 1/step²: a single point above ε would make
    // a run, and the lines fell on the noise (1.893 to 3.295 eV, E_g −0.456 eV). v514 at
    // N2 = 1 found no run: the whole span, E_g 3.196.
    await enter(page, 'an1DSmooth', 0);
    await page.click('#an1Suggest'); await settle(page);
    (await tLines(page)).forEach((v, i)=> near(v, whole[i], 1e-9, 'line ' + i));
    near(egs(await csvs(page))[0][0], 3.1963, 0.001, 'E_g');
    // Narrower than every step, the same; at the default, the edge.
    await enter(page, 'an1DSmooth', 0.001);
    await page.click('#an1Suggest'); await settle(page);
    (await tLines(page)).forEach((v, i)=> near(v, whole[i], 1e-9, 'line ' + i));
    await enter(page, 'an1DSmooth', 0.15);
    await page.click('#an1Suggest'); await settle(page);
    const [v1, v2] = await tLines(page);
    assert.ok(v1 > 3 && v2 < 3.5, `lines ${v1} ${v2}`);
    // A project of v514's with N2 = 1, converted to 0: the same.
    await restore(page, v514((await encoded(page)).files, { tauc: { N: 1, N2: 1, M: 25, M2: 100 }, urbach: { N: 1, N2: 20, M: 25 } })); await settle(page);
    assert.equal((await shared(page)).w2, 0);
    assert.equal(await pts(page, 'an1DSmooth'), 'off');
    await page.click('#an1Suggest'); await settle(page);
    (await tLines(page)).forEach((v, i)=> near(v, whole[i], 1e-9, 'line ' + i));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('DRS: a window beside a gap in the data is passed over; an interval with no window to fit is said why from what the scan found', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    // The lines across the gap (3.35 to 3.76 eV): a window 0.2 eV wide from above 3.15 eV
    // reaches into it. One holding only the 3 points at its edge, 3.324 to 3.342 eV, was taken
    // (R² 0.99996, E_g 3.17 ± 0.06 eV): now each spans half its width at least.
    await loadFiles(page, 'tauc', [gap]);
    await setLines(page, { v1: 3.0, v2: 3.85 }); await settle(page);
    const c = await csvs(page), h = c.info[0], col = k => +c.info[1][h.indexOf(k)];
    const n = col('Tauc fit points'), span = col('Tauc end (eV)') - col('Tauc start (eV)');
    assert.ok(n >= 10 && span >= 0.1 - 1e-9, `${n} points over ${span} eV`);
    assert.equal(await pts(page, 'an1Win'), '≈ ' + n + ' pts');
    assert.ok(+c.eg[1][1] > 3.1 && +c.eg[1][1] < 3.25 && +c.eg[1][2] < 0.02, 'E_g ' + c.eg[1].slice(1, 3));
    // The lines wider than the window, the points between them, from the first, narrower: no
    // window, the interval narrower than it (by the lines alone, it was said to have no
    // window holding 3 points, where the field said the window wider than its points).
    await page.click('#taucFileTableWrap tr.file-row .row-del'); await settle(page);
    await loadFiles(page, 'tauc', [at[2]]);
    const [a, b] = (await tLines(page)).sort((x, y)=> x - y), E = (await energies(page)).filter(e=> e >= a && e <= b);
    assert.ok(Math.min(...E) > a + 1e-4, 'a step between the lower line and the first point');
    await enter(page, 'an1Win', String((b - Math.min(...E) + b - a)/2));
    assert.match(await txt(page, 'an1Alert'), /Interval too small: the Tauc linear region is narrower than its regression window\./);
    assert.equal(await pts(page, 'an1Win'), `> ${E.length} pts`);
    // Narrower than a step: windows, none holding 3 points.
    await enter(page, 'an1Win', 0.001);
    assert.match(await txt(page, 'an1Alert'), /Interval too small: the Tauc linear region has no regression window holding 3 points over half its width\./);
    assert.equal(await pts(page, 'an1Win'), '≈ 1 pt');
    assert.match(await page.getAttribute('#an1WinPts', 'title'), /holds 1 point between the lines .*: no window to fit$/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('DRS: a v514 project whose smoothing as a width would make the scan take another window than v514 did opens with a narrower one', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'tauc');
    await loadFiles(page, 'tauc', [env.fx.files.tauc[0]]);
    // v514, N 6, M 25 on these lines: 3.220 to 3.434 eV, E_g 3.1581 ± 0.0076 eV. Six steps
    // at the middle of that window, 0.054 eV, average more points below it, where the step
    // is narrower, and the scan took the foot, 2.83 to 3.04 eV: E_g −0.57 eV. Six of the
    // narrowest step between the lines keep v514's window.
    const L = { v1: 2.7865188740763758, v2: 3.4434271540970287, v3: 1.9365188740763757, v4: 2.6865188740763757 }, files = (await encoded(page)).files;
    await restore(page, { files, analyses: [card(1, 'tauc', { tauc: { mode: 'shared', shared: { a: 0.5, N: 6, N2: 20, M: 25, M2: 100 }, sharedVlines: L, per: files.map(()=> ({})), suggested: true } })] });
    await settle(page);
    const E = await energies(page), n = E.length, stepAt = k =>{ const p = Math.max(0, k-1), q = Math.min(n-1, k+1); return Math.abs(E[q] - E[p])/(q - p); };
    let least = Infinity;
    E.forEach((e, k)=>{ if ((e >= L.v1 && e <= L.v2) || (e >= L.v3 && e <= L.v4)) least = Math.min(least, stepAt(k)); });
    near((await shared(page)).w, 6*least, 1e-12, 'w, 6 of the narrowest steps');
    const c = await csvs(page), h = c.info[0];
    near(egs(c)[0][0], 3.158072, 0.0076, 'E_g against v514\'s');
    assert.ok(+c.info[1][h.indexOf('Tauc start (eV)')] > 3.2, 'the window above the edge: ' + c.info[1][h.indexOf('Tauc start (eV)')]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
