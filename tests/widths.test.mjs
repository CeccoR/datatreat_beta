/* The widths of the smoothing and of the SNIP background on the x axis (smooth.js; to v510
   numbers of points): XRPD's in °2θ, the samples' and the standard's, EPR's in mT. Each
   field shows its value to 4 significant digits, keeps it exact, and shows in its box what
   it spans in points of the file on show, as it is typed; the same width treats alike
   patterns measured at different steps. A project saved up to v510 (its settings in
   points: N, blWin, smooth) opens with them converted at each file's step: one step, the
   same results (v510's FWHMs here); steps that differ under all, that chip to one, a width
   per pattern, and a note; points per sample, N = 1, values that are no number, a file
   left out (its step counted: taken back in, the points v510 gave it, the shared ones
   under all), a Rietveld card's Scherrer settings, an EPR card and a project from before
   the cards. The CSV headers give the widths. An EPR spectrum with a value that is no
   number smooths the others as a project reopened does. At 320 px, in both themes, and in
   a narrow side column, the points stay in their field, muted, the value whole beside or
   above them, nothing past the edge. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, exportProject, projectFile, importProject, openProject, download, readZip, parseCsv, undo, switchTab } from './helpers.mjs';
import { xrdml, eprPair } from './fixtures.mjs';

let env, h00, t00, epr2, eprNaN;
before(async ()=>{
  env = await start();
  // The fixture's first pattern at half its points (a step of 0.026°), and an EPR pair at
  // half the points of the fixture's (512 over the same sweep).
  h00 = env.fx.put('h00.xrdml', xrdml(0, { n: 2692 }));
  // and at a third of them (0.039°)
  t00 = env.fx.put('t00.xrdml', xrdml(0, { n: 1795 }));
  const { dsc, dta } = eprPair({ title: 'half' }), M = 512, half = Buffer.alloc(M*8);
  for (let i = 0; i < M; i++) half.writeDoubleBE(dta.readDoubleBE(16*i), 8*i);
  epr2 = [env.fx.put('h1.DSC', Buffer.from(dsc.toString('latin1').replace('XPTS 1024', 'XPTS 512').replace('XWID 200.0', 'XWID ' + 200*1022/1023), 'latin1')), env.fx.put('h1.DTA', half)];
  // An EPR spectrum whose 501st value is no number.
  const bad = eprPair({ title: 'nan' });
  bad.dta.writeDoubleBE(NaN, 8*500);
  eprNaN = [env.fx.put('n1.DSC', bad.dsc), env.fx.put('n1.DTA', bad.dta)];
});
after(()=> env && env.close());

// The patterns' steps (°): 70° over 5383, 2691 and 1794 intervals.
const S0 = 70/5383, SH = 70/2691, ST = 70/1794;
// v510's FWHMs (°) with N = 10 points and the SNIP's 150, from its peaks.csv: the fixture's
// s00 and the same pattern at half the points.
const V509 = { s00: [0.19151, 0.21703, 0.2427, 0.26481, 0.31051, 0.35426, 0.39709], h00: [0.28451, 0.29628, 0.30995, 0.32525, 0.35975, 0.39925, 0.4443] };
const val = (page, id)=> page.inputValue('#' + id);
const pts = (page, id)=> page.textContent('#' + id + 'Pts');
async function enter(page, id, v){ await page.fill('#' + id, String(v)); await page.press('#' + id, 'Enter'); await settle(page); }
const near = (a, b, tol, what)=> assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);
// The CSVs of the project bar, read.
async function csvs(page){
  const out = {};
  for (const e of readZip((await download(page, ()=> page.click('.proj-csv'))).buf)) out[e.name] = parseCsv(e.data.toString('utf8'), ';');
  return out;
}
// A sample's FWHMs from peaks.csv.
function fwhms(c, label){
  const rows = c[Object.keys(c).find(k=> k.endsWith('peaks.csv'))], j = rows[0].indexOf('Peak_FWHM_deg_' + label);
  return rows.slice(1).map(r=> r[j]).filter(v=> v !== '' && v != null).map(Number);
}
const xrdShared = s => s.cards[0].states.scherrer;
// A state's Scherrer settings as v510 kept them: the widths as points.
const pointsOf = (q, N, blWin)=>{ const { smoothW, snipW, ...r } = q; return { ...r, N, blWin }; };
function asV509(sc, N, blWin, per = []){
  const { stepNote, heldPts, ...r } = sc;
  return { ...r, shared: pointsOf(sc.shared, N, blWin), perParams: sc.perParams.map((q, i)=> pointsOf(q, ...(per[i] || [N, blWin]))) };
}
// A project made here, its state changed by `edit`, signed and opened as a project read in.
async function reopen(page, mod, name, edit){
  const { obj } = await exportProject(page);
  const state = JSON.parse(JSON.stringify(obj.state));
  edit(state);
  await importProject(page, projectFile(env, name + '.datatreat', { ...obj, title: name, state }, { sign: true }));
  await openProject(page, mod, name);
}

test('XRPD: the widths in °2θ, each field showing its points at the step of the pattern on show, as typed', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.files.xrd[0], h00]);
    const titles = await page.$$eval('#xrdAnalyses .param-grid > .pg-title', ts=> ts.map(t=> t.textContent.replace(/\s+/g, ' ').trim()));
    assert.ok(titles.includes('Smoothing width (°2θ) all') && titles.includes('Baseline SNIP half-width (°2θ) all'), JSON.stringify(titles));
    for (const id of ['xrdA1Smooth', 'xrdA1BlWin']) assert.deepEqual(await page.$eval('#' + id, e=> [e.type, e.inputMode]), ['text', 'decimal']);
    assert.deepEqual([await val(page, 'xrdA1Smooth'), await pts(page, 'xrdA1Smooth'), await val(page, 'xrdA1BlWin'), await pts(page, 'xrdA1BlWin')], ['0.13', '≈ 10 pts', '2', '±154 pts']);
    assert.deepEqual([xrdShared(await moduleState(page, 'xrd')).shared.smoothW, xrdShared(await moduleState(page, 'xrd')).shared.snipW], [0.13, 2]);
    // The pattern at twice the step on show: the same widths, half the points.
    await page.click('#xrdA1Next'); await settle(page);
    assert.deepEqual([await pts(page, 'xrdA1Smooth'), await pts(page, 'xrdA1BlWin')], ['≈ 5 pts', '±77 pts']);
    // As typed, before it is taken; then taken.
    await page.fill('#xrdA1Smooth', '0.26');
    assert.equal(await pts(page, 'xrdA1Smooth'), '≈ 10 pts');
    assert.equal(xrdShared(await moduleState(page, 'xrd')).shared.smoothW, 0.13, 'not taken while typed');
    await page.press('#xrdA1Smooth', 'Enter'); await settle(page);
    assert.equal(xrdShared(await moduleState(page, 'xrd')).shared.smoothW, 0.26);
    await page.click('#xrdA1Prev'); await settle(page);
    assert.equal(await pts(page, 'xrdA1Smooth'), '≈ 20 pts', 'the other pattern on show: its own points');
    // 0 is none; a value refused is set back, its points with it.
    await enter(page, 'xrdA1Smooth', 0);
    assert.deepEqual([await val(page, 'xrdA1Smooth'), await pts(page, 'xrdA1Smooth')], ['0', 'off']);
    await enter(page, 'xrdA1Smooth', -1);
    assert.deepEqual([await val(page, 'xrdA1Smooth'), await pts(page, 'xrdA1Smooth')], ['0', 'off']);
    await enter(page, 'xrdA1BlWin', 0);
    assert.deepEqual([await val(page, 'xrdA1BlWin'), await pts(page, 'xrdA1BlWin')], ['2', '±154 pts'], 'the SNIP\'s half-width above 0');
    // Shown to 4 significant digits, kept exact through another field's change.
    await enter(page, 'xrdA1Smooth', '0,123456');
    assert.deepEqual([await val(page, 'xrdA1Smooth'), await pts(page, 'xrdA1Smooth')], ['0.1235', '≈ 9.5 pts']);
    await enter(page, 'xrdA1K', 0.95);
    assert.equal(xrdShared(await moduleState(page, 'xrd')).shared.smoothW, 0.123456);
    // The baseline off: its field disabled and dimmed, its points kept.
    await page.click('#xrdA1BlOn'); await settle(page);
    assert.equal(await page.isDisabled('#xrdA1BlWin'), true);
    assert.ok(await page.$eval('#xrdA1BlWin', e=> +getComputedStyle(e.parentNode).opacity) < 1);
    assert.equal(await pts(page, 'xrdA1BlWin'), '±154 pts');
    await page.click('#xrdA1BlOn'); await settle(page);
    // One width treats both patterns alike: their FWHMs within 2.5 % (v510's 10 points:
    // 0.217° and 0.296° for the 32.4° peak, 36 % apart).
    await enter(page, 'xrdA1Smooth', 0.13);
    const c = await csvs(page), a = fwhms(c, 's00'), b = fwhms(c, 'h00');
    assert.equal(a.length, b.length);
    a.forEach((v, i)=> assert.ok(Math.abs(v - b[i])/v < 0.025, `peak ${i + 1}: ${v} and ${b[i]}`));
    assert.ok((V509.h00[1] - V509.s00[1])/V509.s00[1] > 0.3);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('XRPD: the standard\'s widths at its own file\'s step; the CSV headers give the widths', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.files.xrd[0], h00]);
    await page.click('#xrdA1Std');
    assert.deepEqual([await val(page, 'xrdStdASmooth'), await pts(page, 'xrdStdASmooth')], ['0', ''], 'no standard: no points');
    await page.setInputFiles('#xrdStdPeaksFiles', h00);
    await page.waitForSelector('#xrdStdPeaks .xrd-std-name'); await settle(page);
    assert.deepEqual([await pts(page, 'xrdStdASmooth'), await val(page, 'xrdStdABlWin'), await pts(page, 'xrdStdABlWin')], ['off', '2', '±77 pts']);
    await page.fill('#xrdStdASmooth', '0.052');
    assert.equal(await pts(page, 'xrdStdASmooth'), '≈ 2 pts');
    await page.press('#xrdStdASmooth', 'Enter'); await settle(page);
    assert.equal((await moduleState(page, 'xrd')).stdPeaks.shared.smoothW, 0.052);
    await page.keyboard.press('Escape'); await settle(page);
    const c = await csvs(page), h = c['Scherrer - diffractograms.csv'][0], hs = c['standard.csv'][0];
    for (const t of ['Smoothed_s00 (w=0.13°)', 'SNIP_background_s00 (W=2°)', 'Smoothed_h00 (w=0.13°)', 'SNIP_background_h00 (W=2°)'])
      assert.ok(h.includes(t), t + ' in ' + JSON.stringify(h));
    assert.ok(hs.includes('Smoothed_h00 (w=0.052°)') && hs.includes('SNIP_background_h00 (W=2°)'), JSON.stringify(hs));
    // One pattern's baseline off (one): its column says so, the other's its width.
    await page.click('#xrdA1ModeBl'); await settle(page);
    await page.click('#xrdA1Next'); await settle(page);
    await page.click('#xrdA1BlOn'); await settle(page);
    const h2 = (await csvs(page))['Scherrer - diffractograms.csv'][0];
    assert.ok(h2.includes('SNIP_background_h00 (off)') && h2.includes('SNIP_background_s00 (W=2°)'), JSON.stringify(h2));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('XRPD: a project to v510 at one step opens with its points as widths, and v510\'s results', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', env.fx.files.xrd);
    await page.click('#xrdA1Std');
    await page.setInputFiles('#xrdStdPeaksFiles', env.fx.std);
    await page.waitForSelector('#xrdStdPeaks .xrd-std-name'); await settle(page);
    await page.keyboard.press('Escape'); await settle(page);
    await reopen(page, 'xrd', 'Old one step', s=>{
      s.cards[0].states.scherrer = asV509(s.cards[0].states.scherrer, 10, 150);
      s.stdPeaks = asV509(s.stdPeaks, 1, 150);
    });
    const s = await moduleState(page, 'xrd'), sc = xrdShared(s);
    near(sc.shared.smoothW, 10*S0, 1e-15, 'one width, 10 steps');
    near(sc.shared.snipW, 150*S0, 1e-14, 'the SNIP\'s, 150 steps');
    assert.deepEqual([sc.paramMode.N, sc.paramMode.blWin, sc.stepNote], ['shared', 'shared', undefined]);
    sc.perParams.forEach(q=> near(q.smoothW, 10*S0, 1e-15, 'a sample\'s own'));
    assert.deepEqual([s.stdPeaks.shared.smoothW, s.stdPeaks.shared.snipW.toFixed(6)], [0, (150*S0).toFixed(6)], 'the standard: N = 1 is none');
    assert.deepEqual(await page.$$eval('#xrdA1ModeN, #xrdA1ModeBl', cs=> cs.map(c=> c.textContent)), ['all', 'all']);
    assert.equal(await page.textContent('#xrdA1StepNote'), '');
    assert.deepEqual([await val(page, 'xrdA1Smooth'), await pts(page, 'xrdA1Smooth'), await val(page, 'xrdA1BlWin'), await pts(page, 'xrdA1BlWin')], ['0.13', '≈ 10 pts', '1.951', '±150 pts']);
    // v510's FWHMs (the last peak, 2.8° from the end, within 1e-4: the end points count half now)
    const f = fwhms(await csvs(page), 's00');
    assert.equal(f.length, V509.s00.length);
    f.forEach((v, i)=> near(v, V509.s00[i], i < f.length - 1 ? 1e-5 : 1e-4, `s00 peak ${i + 1}`));
    assert.equal(await page.isVisible('.proj-save.is-saved'), true, 'opened as it was saved');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('XRPD: a project to v510 at different steps: those chips to one, a width each, v510\'s results, and a note', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.files.xrd[0], h00]);
    await reopen(page, 'xrd', 'Old two steps', s=>{ s.cards[0].states.scherrer = asV509(s.cards[0].states.scherrer, 10, 150); });
    let sc = xrdShared(await moduleState(page, 'xrd'));
    assert.deepEqual([sc.paramMode.N, sc.paramMode.blWin, sc.stepNote], ['per', 'per', ['N', 'blWin']]);
    [S0, SH].forEach((st, i)=>{ near(sc.perParams[i].smoothW, 10*st, 1e-15, 'smoothing ' + i); near(sc.perParams[i].snipW, 150*st, 1e-13, 'SNIP ' + i); assert.equal(sc.perParams[i].blOn, true); });
    near(sc.shared.smoothW, 10*SH, 1e-15, 'the shared value at the median step');
    assert.deepEqual(await page.$$eval('#xrdA1ModeN, #xrdA1ModeBl', cs=> cs.map(c=> c.textContent)), ['one', 'one']);
    assert.match(await page.textContent('#xrdA1StepNote'), /different steps: the smoothing and SNIP half-width, set in points up to v510, are kept as they were, a width for each pattern \(one\)\. Set one width in all/);
    const c = await csvs(page);
    for (const [lab, want] of Object.entries(V509)){
      const f = fwhms(c, lab);
      assert.equal(f.length, want.length);
      f.forEach((v, i)=> near(v, want[i], i < f.length - 2 ? 1e-5 : 2e-4, `${lab} peak ${i + 1}`));
    }
    await page.click('#xrdA1Next'); await settle(page);
    assert.deepEqual([await val(page, 'xrdA1Smooth'), await pts(page, 'xrdA1Smooth'), await pts(page, 'xrdA1BlWin')], ['0.2601', '≈ 10 pts', '±150 pts']);
    // The smoothing back to all: the width on show for both, its note gone; the SNIP's stays.
    await page.click('#xrdA1ModeN'); await settle(page);
    sc = xrdShared(await moduleState(page, 'xrd'));
    assert.deepEqual([sc.paramMode.N, sc.stepNote], ['shared', ['blWin']]);
    near(sc.shared.smoothW, 10*SH, 1e-15, 'the width on show, shared');
    assert.match(await page.textContent('#xrdA1StepNote'), /the SNIP half-width, set in points up to v510, is kept as it was/);
    await page.click('#xrdA1StepNote [data-step-x]'); await settle(page);
    assert.equal(await page.textContent('#xrdA1StepNote'), '');
    assert.equal(xrdShared(await moduleState(page, 'xrd')).stepNote, undefined);
    await undo(page);
    assert.match(await page.textContent('#xrdA1StepNote'), /SNIP half-width/, 'the dismissal undone');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('XRPD: points per sample, N = 1, values that are no number, a file left out and a Rietveld card\'s Scherrer settings, converted', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.files.xrd[0], env.fx.files.xrd[1], h00]);
    await reopen(page, 'xrd', 'Old mixed', s=>{
      const sc = s.cards[0].states.scherrer;
      s.cards[0].states.scherrer = { ...asV509(sc, 'abc', -5, [[1, 150], [9, 'x']]), paramMode: { ...sc.paramMode, N: 'per' } };
      s.cards[0].states.scherrer.perParams.length = 2;
      // h00 left out, its entries held as v510 held them
      s.files[2].included = false;
      s.files[2].held = { 'A1:params': pointsOf(sc.perParams[2], 12, 100), 'A1:manual': [], 'A1:removed': [] };
      s.cards[1].states.scherrer = asV509(sc, 6, 50);
      s.cards[1].states.scherrer.perParams.length = 2;
    });
    let sc = xrdShared(await moduleState(page, 'xrd'));
    // (the SNIP's shared under all, h00 left out at another step: one, its note, and its
    // points kept for h00)
    assert.deepEqual([sc.perParams[0].smoothW, sc.paramMode.N, sc.paramMode.blWin, sc.stepNote, sc.heldPts], [0, 'per', 'per', ['blWin'], { blWin: -5, blOn: true }], 'N = 1: none');
    near(sc.perParams[1].smoothW, 9*S0, 1e-15, 'an odd N');
    assert.equal(sc.shared.smoothW, 0.13, 'no number: the default');
    near(sc.shared.snipW, S0, 1e-15, 'below 1: one point, as v510 took it');
    near(sc.perParams[1].snipW, S0, 1e-15, 'its own no number: the shared value, one point');
    assert.equal(await pts(page, 'xrdA1Smooth'), 'off');
    await page.click('#xrdA1Next'); await settle(page);
    assert.deepEqual([await val(page, 'xrdA1Smooth'), await pts(page, 'xrdA1Smooth')], ['0.117', '≈ 9 pts']);
    // The file left out taken in: at its own step, its held smoothing (one), and the SNIP's
    // shared point (all), not its own 100, as v510 gave it.
    await page.locator('#xrdFileTableWrap .file-incl').nth(2).click(); await settle(page);
    sc = xrdShared(await moduleState(page, 'xrd'));
    near(sc.perParams[2].smoothW, 12*SH, 1e-15, 'the held smoothing');
    near(sc.perParams[2].snipW, SH, 1e-15, 'the held SNIP');
    // The Rietveld card back to Scherrer: its settings in points converted at each step,
    // the patterns' steps differing under all: one, with the note.
    await page.click('#xrdAnalyses .an-card[data-an="2"] .an-type');
    await page.click('.an-menu:not([hidden]) [data-kind="scherrer"]'); await settle(page);
    const s2 = (await moduleState(page, 'xrd')).cards[1].states.scherrer;
    assert.deepEqual([s2.paramMode.N, s2.paramMode.blWin, s2.stepNote], ['per', 'per', ['N', 'blWin']]);
    [S0, S0, SH].forEach((st, i)=> near(s2.perParams[i].smoothW, 6*st, 1e-15, 'card 2, sample ' + i));
    assert.match(await page.textContent('#xrdA2StepNote'), /different steps/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// v510's shared baseline box, off, under all: the file left out comes back with it off, as
// v510 took it in, not with its own held entry's box (the default, on).
test('XRPD: a file left out of a project to v510 comes back with v510\'s shared baseline box', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.files.xrd[0], env.fx.files.xrd[1], h00]);
    await reopen(page, 'xrd', 'Old box off', s=>{
      const sc = s.cards[0].states.scherrer;
      s.cards[0].states.scherrer = asV509(sc, 10, 150);
      s.cards[0].states.scherrer.shared.blOn = false;
      s.cards[0].states.scherrer.perParams.length = 2;
      s.files[2].included = false;
      s.files[2].held = { 'A1:params': { ...pointsOf(sc.perParams[2], 10, 150), blOn: true }, 'A1:manual': [], 'A1:removed': [] };
    });
    let sc = xrdShared(await moduleState(page, 'xrd'));
    assert.deepEqual([sc.paramMode.blWin, sc.heldPts, sc.perParams.map(q=> q.blOn)], ['per', { N: 10, blWin: 150, blOn: false }, [false, false]]);
    await page.locator('#xrdFileTableWrap .file-incl').nth(2).click(); await settle(page);
    sc = xrdShared(await moduleState(page, 'xrd'));
    assert.equal(sc.perParams[2].blOn, false, 'h00\'s box off, as v510 shared it');
    await page.click('#xrdA1Next'); await page.click('#xrdA1Next'); await settle(page);
    assert.equal(await page.isChecked('#xrdA1BlOn'), false, 'its box unticked on show');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('XRPD: files left out of a project to v510 come back with the points v510 gave them, at their own steps', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.files.xrd[0], env.fx.files.xrd[1], h00]);
    // Those included at one step, h00 left out at another, the shared 10 points under all;
    // h00's own entry, held, of 12 and 100 (under all, not in use: v510 took the shared).
    const leftOut = (s, i, k, own)=>{ s.files[i].included = false; s.files[i].held = { [k + ':params']: own, [k + ':manual']: [], [k + ':removed']: [] }; };
    await reopen(page, 'xrd', 'Old held', s=>{
      const sc = s.cards[0].states.scherrer;
      s.cards[0].states.scherrer = asV509(sc, 10, 150);
      s.cards[0].states.scherrer.perParams.length = 2;
      leftOut(s, 2, 'A1', pointsOf(sc.perParams[2], 12, 100));
    });
    let sc = xrdShared(await moduleState(page, 'xrd'));
    assert.deepEqual([sc.paramMode.N, sc.paramMode.blWin, sc.stepNote, sc.heldPts], ['per', 'per', ['N', 'blWin'], { N: 10, blWin: 150, blOn: true }], 'the step left out counted');
    sc.perParams.forEach((q, i)=>{ near(q.smoothW, 10*S0, 1e-15, 'smoothing ' + i); near(q.snipW, 150*S0, 1e-13, 'SNIP ' + i); });
    assert.match(await page.textContent('#xrdA1StepNote'), /different steps/);
    // Saved so and opened again (a project of this version: nothing converted), then h00
    // taken in: the shared 10 and 150 points at its step, as v510 took it in under all.
    await reopen(page, 'xrd', 'Held saved', ()=>{});
    await page.locator('#xrdFileTableWrap .file-incl').nth(2).click(); await settle(page);
    sc = xrdShared(await moduleState(page, 'xrd'));
    near(sc.perParams[2].smoothW, 10*SH, 1e-15, 'h00\'s smoothing');
    near(sc.perParams[2].snipW, 150*SH, 1e-13, 'h00\'s SNIP');
    await page.click('#xrdA1Next'); await page.click('#xrdA1Next'); await settle(page);
    assert.deepEqual([await val(page, 'xrdA1Smooth'), await pts(page, 'xrdA1Smooth'), await pts(page, 'xrdA1BlWin')], ['0.2601', '≈ 10 pts', '±150 pts']);
    // The smoothing shared again: its points for the files left out go with its note.
    await page.click('#xrdA1ModeN'); await settle(page);
    assert.deepEqual(xrdShared(await moduleState(page, 'xrd')).heldPts, { blWin: 150, blOn: true });
    // The steps of those included differing too, under all a shared 20 points that the file
    // left out never had as its own (its entry kept from before, 10): taken in, 20 at its step.
    await loadFiles(page, 'xrd', [t00]);
    await reopen(page, 'xrd', 'Old held 2', s=>{
      const sc = s.cards[0].states.scherrer;
      s.cards[0].states.scherrer = { ...asV509(sc, 20, 150), paramMode: { ...sc.paramMode, N: 'shared', blWin: 'shared' } };
      s.cards[0].states.scherrer.perParams.length = 3;
      leftOut(s, 3, 'A1', pointsOf(sc.perParams[3], 10, 100));
    });
    sc = xrdShared(await moduleState(page, 'xrd'));
    assert.deepEqual([sc.paramMode.N, sc.stepNote, sc.heldPts], ['per', ['N', 'blWin'], { N: 20, blWin: 150, blOn: true }]);
    [S0, S0, SH].forEach((st, i)=> near(sc.perParams[i].smoothW, 20*st, 1e-15, 'smoothing ' + i));
    await page.locator('#xrdFileTableWrap .file-incl').nth(3).click(); await settle(page);
    sc = xrdShared(await moduleState(page, 'xrd'));
    near(sc.perParams[3].smoothW, 20*ST, 1e-15, 't00\'s smoothing');
    near(sc.perParams[3].snipW, 150*ST, 1e-13, 't00\'s SNIP');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('EPR: the smoothing width in mT, its points (a range at different steps), the CSV header, and projects to v510', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'epr');
    await loadFiles(page, 'epr', env.fx.files.epr.slice(0, 2));
    assert.equal(await page.textContent('label[for="epr1Smooth"]'), 'Smoothing width (mT)');
    assert.deepEqual(await page.$eval('#epr1Smooth', e=> [e.type, e.inputMode]), ['text', 'decimal']);
    assert.deepEqual([await val(page, 'epr1Smooth'), await pts(page, 'epr1Smooth')], ['0.2', '≈ 10 pts']);
    await loadFiles(page, 'epr', epr2);
    assert.equal(await pts(page, 'epr1Smooth'), '≈ 5.1–10 pts', 'two steps: the range');
    await page.fill('#epr1Smooth', '0.4');
    assert.equal(await pts(page, 'epr1Smooth'), '≈ 10–20 pts');
    await page.press('#epr1Smooth', 'Enter'); await settle(page);
    assert.equal((await moduleState(page, 'epr')).cards[0].smoothW, 0.4);
    const h = (await csvs(page))['Spectra - epr_spectra.csv'][0];
    assert.ok(h.includes('Smoothed_e1 (w=0.4 mT)') && h.includes('Smoothed_h1 (w=0.4 mT)'), JSON.stringify(h));
    await enter(page, 'epr1Smooth', 0);
    assert.equal(await pts(page, 'epr1Smooth'), 'off');
    // Projects to v510: the points at the spectra's median step (here, e1's alone).
    await page.locator('#eprFileTableWrap .file-incl').nth(1).click(); await settle(page);
    const step = 20/1023;
    await reopen(page, 'epr', 'Old EPR', s=>{
      const c = s.cards[0]; delete c.smoothW;
      s.cards = [{ ...c, smooth: 10 }, { ...c, id: 2, smooth: 1 }, { ...c, id: 3, smooth: 'abc' }];
    });
    let cs = (await moduleState(page, 'epr')).cards;
    near(cs[0].smoothW, 10*step, 1e-15, 'N 10');
    assert.deepEqual([cs[1].smoothW, cs[2].smoothW], [0, 0.2], 'N = 1: none; no number: the default');
    assert.deepEqual([await val(page, 'epr1Smooth'), await pts(page, 'epr1Smooth'), await pts(page, 'epr2Smooth')], ['0.1955', '≈ 10 pts', 'off']);
    assert.ok((await csvs(page))['Spectra - epr_spectra.csv'][0].includes('Smoothed_e1 (w=0.1955 mT)'));
    // One from before the cards: its settings at the top.
    await reopen(page, 'epr', 'Older EPR', s=>{ delete s.cards; s.smooth = 4; s.norm = 'local'; });
    cs = (await moduleState(page, 'epr')).cards;
    assert.equal(cs.length, 1);
    near(cs[0].smoothW, 4*step, 1e-15, 'N 4');
    assert.equal(cs[0].norm, 'local');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('EPR: a value that is no number in a spectrum: the others smoothed without it, as the project reopened has them', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'epr');
    await loadFiles(page, 'epr', eprNaN);
    const col = rows =>{ const j = rows[0].indexOf('Smoothed_n1 (w=0.2 mT)'); assert.ok(j >= 0, JSON.stringify(rows[0])); return rows.slice(1).map(r=> r[j]); };
    const fresh = col((await csvs(page))['Spectra - epr_spectra.csv']);
    const bad = fresh.map((v, i)=> [i, v]).filter(([, v])=> !Number.isFinite(parseFloat(String(v).replace(',', '.'))));
    assert.deepEqual(bad.map(([i])=> i), [500], 'the point itself alone');
    // Reopened, the pair that is no number left out: the same smoothing of the others.
    await reopen(page, 'epr', 'EPR no number', ()=>{});
    const back = col((await csvs(page))['Spectra - epr_spectra.csv']);
    assert.deepEqual(back, fresh.filter((_, i)=> i !== 500));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the fields at 320 px, in both themes, and in a narrow side column: the points inside the field, muted, the value whole, nothing past the edge', async ()=>{
  const { page, errors, close } = await env.page({ viewport: { width: 320, height: 700 } });
  // Each field's box, its value and its points: the points inside the box, after the value
  // on its line or on a line of their own under it; the value's text whole in its room.
  const fields = ids => page.evaluate(ids => ids.map(id =>{
    const el = document.getElementById(id), box = el.parentNode.getBoundingClientRect(), r = el.getBoundingClientRect(), p = el.nextElementSibling, q = p.getBoundingClientRect();
    const cs = getComputedStyle(p), ci = getComputedStyle(el), textBottom = r.bottom - parseFloat(ci.paddingBottom);
    return { id, value: el.value, text: p.textContent, w: q.width,
      inside: q.left >= box.left && q.right <= box.right + 0.5 && q.top >= box.top && q.bottom <= box.bottom + 0.5 && r.left >= box.left && r.right <= box.right + 0.5,
      apart: r.right <= q.left + 0.5 || q.top >= textBottom - 0.5, whole: el.scrollWidth <= el.clientWidth,
      muted: cs.color !== ci.color, small: parseFloat(cs.fontSize) < parseFloat(ci.fontSize), right: box.right };
  }), ids);
  const check = (g, what)=>{
    assert.ok(g.inside && g.w > 0 && g.text, `${what} ${g.id}: the points inside the field (${JSON.stringify(g)})`);
    assert.ok(g.apart, `${what} ${g.id}: the points clear of the value (${JSON.stringify(g)})`);
    assert.ok(g.whole, `${what} ${g.id}: the value ${g.value} whole (${JSON.stringify(g)})`);
    assert.ok(g.muted && g.small, `${what} ${g.id}: muted`);
  };
  try {
    await openModule(page, 'xrd');
    await loadFiles(page, 'xrd', [env.fx.files.xrd[0]]);
    // widths as a project to v510 gets them (150 and 5 points at 0.013°)
    await enter(page, 'xrdA1BlWin', 1.951); await enter(page, 'xrdA1Smooth', 0.06502);
    await openModule(page, 'epr');
    await loadFiles(page, 'epr', env.fx.files.epr.slice(0, 2));
    await enter(page, 'epr1Smooth', 0.1955);
    for (const theme of ['dark', 'light']){
      await page.evaluate(async t=>{ const u = await import('./utils.js'); u.applyTheme(t); }, theme);
      for (const [mod, ids] of [['xrd', ['xrdA1Smooth', 'xrdA1BlWin']], ['epr', ['epr1Smooth']]]){
        await switchTab(page, mod === 'xrd' ? 0 : 1);
        for (const g of await fields(ids)){ check(g, theme); assert.ok(g.right <= 320, `${theme} ${g.id}: within the window`); }
        assert.ok(await page.evaluate(()=> document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${theme} ${mod}: no sideways scroll`);
      }
    }
    // The desktop's side column at 900 px (some 105 px a field), the sample's and the
    // standard's window's.
    await page.setViewportSize({ width: 900, height: 800 });
    await switchTab(page, 0); await settle(page);
    for (const g of await fields(['xrdA1Smooth', 'xrdA1BlWin'])) check(g, '900');
    await page.click('#xrdA1Std');
    await page.setInputFiles('#xrdStdPeaksFiles', env.fx.std);
    await page.waitForSelector('#xrdStdPeaks .xrd-std-name'); await settle(page);
    await enter(page, 'xrdStdASmooth', 0.06502); await enter(page, 'xrdStdABlWin', 1.951);
    for (const g of await fields(['xrdStdASmooth', 'xrdStdABlWin'])) check(g, '900, the standard');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
