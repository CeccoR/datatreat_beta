/* The widths of the smoothing and of the SNIP background on the x axis (smooth.js; to v510
   numbers of points): XRPD's in °2θ, the samples' and the standard's, EPR's in mT. Each
   field shows its value to 4 significant digits, keeps it exact, and shows in its box what
   it spans in points of the file on show, as it is typed; the same width treats alike
   patterns measured at different steps. A project saved up to v510 (its settings in points:
   N, blWin, smooth) opens with its points ignored, the default widths (EPR's here, v583;
   XRPD's in tests/oldprojects.test.mjs, v586: to v585 converted at each file's step), and an
   EPR project from before the cards with one card of the defaults. The CSV headers give the
   widths. An EPR spectrum with a value that is no
   number smooths the others, the project reopened the same (v583: read again from its bytes). At 320 px, in both themes, and in
   a narrow side column, the points stay in their field, muted, the value whole beside or
   above them, nothing past the edge. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, settle, moduleState, exportProject, projectFile, importProject, openProject, download, readZip, parseCsv, switchTab } from './helpers.mjs';
import { xrdml, eprPair } from './fixtures.mjs';

let env, h00, epr2, eprNaN;
before(async ()=>{
  env = await start();
  // The fixture's first pattern at half its points (a step of 0.026°), and an EPR pair at
  // half the points of the fixture's (512 over the same sweep).
  h00 = env.fx.put('h00.xrdml', xrdml(0, { n: 2692 }));
  const { dsc, dta } = eprPair({ title: 'half' }), M = 512, half = Buffer.alloc(M*8);
  for (let i = 0; i < M; i++) half.writeDoubleBE(dta.readDoubleBE(16*i), 8*i);
  epr2 = [env.fx.put('h1.DSC', Buffer.from(dsc.toString('latin1').replace('XPTS 1024', 'XPTS 512').replace('XWID 200.0', 'XWID ' + 200*1022/1023), 'latin1')), env.fx.put('h1.DTA', half)];
  // An EPR spectrum whose 501st value is no number.
  const bad = eprPair({ title: 'nan' });
  bad.dta.writeDoubleBE(NaN, 8*500);
  eprNaN = [env.fx.put('n1.DSC', bad.dsc), env.fx.put('n1.DTA', bad.dta)];
});
after(()=> env && env.close());

// v510's FWHMs (°) with N = 10 points and the SNIP's 150, from its peaks.csv: the fixture's
// s00 and the same pattern at half the points.
const V509 = { s00: [0.19151, 0.21703, 0.2427, 0.26481, 0.31051, 0.35426, 0.39709], h00: [0.28451, 0.29628, 0.30995, 0.32525, 0.35975, 0.39925, 0.4443] };
const val = (page, id)=> page.inputValue('#' + id);
const pts = (page, id)=> page.textContent('#' + id + 'Pts');
async function enter(page, id, v){ await page.fill('#' + id, String(v)); await page.press('#' + id, 'Enter'); await settle(page); }
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
    assert.ok(titles.includes('Smoothing width (°2θ) all') && titles.includes('Baseline SNIP width (°2θ) all'), JSON.stringify(titles));
    for (const id of ['xrdA1Smooth', 'xrdA1BlWin']) assert.deepEqual(await page.$eval('#' + id, e=> [e.type, e.inputMode]), ['text', 'decimal']);
    // (the SNIP's field its whole width, 5°, its points 384.5 steps of 0.0130°; to v515 the
    // half-width, 2°, '±154 pts'; the defaults to v515 0.13° and 2°)
    assert.deepEqual([await val(page, 'xrdA1Smooth'), await pts(page, 'xrdA1Smooth'), await val(page, 'xrdA1BlWin')], ['0.25', '≈ 19 pts', '5']);
    assert.match(await pts(page, 'xrdA1BlWin'), /^≈ 38[45] pts$/);
    assert.deepEqual([xrdShared(await moduleState(page, 'xrd')).shared.smoothW, xrdShared(await moduleState(page, 'xrd')).shared.snipW], [0.25, 2.5]);
    // The pattern at twice the step on show: the same widths, half the points.
    await page.click('#xrdA1Next'); await settle(page);
    assert.deepEqual([await pts(page, 'xrdA1Smooth'), await pts(page, 'xrdA1BlWin')], ['≈ 10 pts', '≈ 192 pts']);
    // As typed, before it is taken; then taken.
    await page.fill('#xrdA1Smooth', '0.26');
    assert.equal(await pts(page, 'xrdA1Smooth'), '≈ 10 pts');
    assert.equal(xrdShared(await moduleState(page, 'xrd')).shared.smoothW, 0.25, 'not taken while typed');
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
    assert.equal(await val(page, 'xrdA1BlWin'), '5', 'the SNIP\'s width above 0');
    assert.match(await pts(page, 'xrdA1BlWin'), /^≈ 38[45] pts$/);
    // Shown to 4 significant digits, kept exact through another field's change.
    await enter(page, 'xrdA1Smooth', '0,123456');
    assert.deepEqual([await val(page, 'xrdA1Smooth'), await pts(page, 'xrdA1Smooth')], ['0.1235', '≈ 9.5 pts']);
    await enter(page, 'xrdA1K', 0.95);
    assert.equal(xrdShared(await moduleState(page, 'xrd')).shared.smoothW, 0.123456);
    // The baseline off: its field disabled and dimmed, its points kept.
    await page.click('#xrdA1BlOn'); await settle(page);
    assert.equal(await page.isDisabled('#xrdA1BlWin'), true);
    assert.ok(await page.$eval('#xrdA1BlWin', e=> +getComputedStyle(e.parentNode).opacity) < 1);
    assert.match(await pts(page, 'xrdA1BlWin'), /^≈ 38[45] pts$/);
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
    assert.deepEqual([await pts(page, 'xrdStdASmooth'), await val(page, 'xrdStdABlWin'), await pts(page, 'xrdStdABlWin')], ['off', '5', '≈ 192 pts']);
    await page.fill('#xrdStdASmooth', '0.052');
    assert.equal(await pts(page, 'xrdStdASmooth'), '≈ 2 pts');
    await page.press('#xrdStdASmooth', 'Enter'); await settle(page);
    assert.equal((await moduleState(page, 'xrd')).stdPeaks.shared.smoothW, 0.052);
    await page.keyboard.press('Escape'); await settle(page);
    const c = await csvs(page), h = c['Scherrer - diffractograms.csv'][0], hs = c['standard.csv'][0];
    for (const t of ['Smoothed_s00 (w=0.25°)', 'SNIP_background_s00 (W=5°)', 'Smoothed_h00 (w=0.25°)', 'SNIP_background_h00 (W=5°)'])
      assert.ok(h.includes(t), t + ' in ' + JSON.stringify(h));
    assert.ok(hs.includes('Smoothed_h00 (w=0.052°)') && hs.includes('SNIP_background_h00 (W=5°)'), JSON.stringify(hs));
    // One pattern's baseline off (one): its column says so, the other's its width.
    await page.click('#xrdA1ModeBl'); await settle(page);
    await page.click('#xrdA1Next'); await settle(page);
    await page.click('#xrdA1BlOn'); await settle(page);
    const h2 = (await csvs(page))['Scherrer - diffractograms.csv'][0];
    assert.ok(h2.includes('SNIP_background_h00 (off)') && h2.includes('SNIP_background_s00 (W=5°)'), JSON.stringify(h2));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('EPR: the smoothing width in mT, its points (a range at different steps), the CSV header, and projects to v510 (v583: their points ignored)', async ()=>{
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
    // (each trace named by its .DSC's TITL, v532)
    const h = (await csvs(page))['Spectra - epr_spectra.csv'][0];
    assert.ok(h.includes('Smoothed_sample one (w=0.4 mT)') && h.includes('Smoothed_half (w=0.4 mT)'), JSON.stringify(h));
    await enter(page, 'epr1Smooth', 0);
    assert.equal(await pts(page, 'epr1Smooth'), 'off');
    // Projects to v510, their smoothing in points (`smooth`): an old field, ignored, the width the
    // default (v583: to v582 the points at the spectra's median step).
    await page.locator('#eprFileTableWrap .file-incl').nth(1).click(); await settle(page);
    await reopen(page, 'epr', 'Old EPR', s=>{
      const c = s.cards[0]; delete c.smoothW;
      s.cards = [{ ...c, smooth: 10 }, { ...c, id: 2, smooth: 1 }, { ...c, id: 3, smooth: 'abc' }];
    });
    let cs = (await moduleState(page, 'epr')).cards;
    assert.deepEqual(cs.map(c=> [c.smoothW, 'smooth' in c]), [[0.2, false], [0.2, false], [0.2, false]]);
    assert.deepEqual([await val(page, 'epr1Smooth'), await pts(page, 'epr1Smooth'), await pts(page, 'epr2Smooth')], ['0.2', '≈ 10 pts', '≈ 10 pts']);
    assert.ok((await csvs(page))['Spectra - epr_spectra.csv'][0].includes('Smoothed_sample one (w=0.2 mT)'));
    // One from before the cards, its settings at the top: ignored, one card of the defaults.
    await reopen(page, 'epr', 'Older EPR', s=>{ delete s.cards; s.smooth = 4; s.norm = 'local'; });
    cs = (await moduleState(page, 'epr')).cards;
    assert.deepEqual(cs.map(c=> [c.type, c.smoothW, c.norm]), [['spectra', 0.2, 'global']]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('EPR: a value that is no number in a spectrum: the others smoothed without it, the project reopened the same', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'epr');
    await loadFiles(page, 'epr', eprNaN);
    const col = rows =>{ const j = rows[0].indexOf('Smoothed_nan (w=0.2 mT)'); assert.ok(j >= 0, JSON.stringify(rows[0])); return rows.slice(1).map(r=> r[j]); };
    const fresh = col((await csvs(page))['Spectra - epr_spectra.csv']);
    const bad = fresh.map((v, i)=> [i, v]).filter(([, v])=> !Number.isFinite(parseFloat(String(v).replace(',', '.'))));
    assert.deepEqual(bad.map(([i])=> i), [500], 'the point itself alone');
    // Reopened: read again from its files' bytes, as loaded (v583: to v582 from the arrays the
    // project held, the pair that is no number left out).
    await reopen(page, 'epr', 'EPR no number', ()=>{});
    const back = col((await csvs(page))['Spectra - epr_spectra.csv']);
    assert.deepEqual(back, fresh);
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
