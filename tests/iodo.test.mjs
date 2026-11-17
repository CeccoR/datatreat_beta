/* The Iodometry module (v533): a synthetic Cary 60 Kinetics CSV (the traces' names over each
   (time, Abs) pair, "Time (sec),Abs" under them, rows at 0.2 s with trailing commas, a trace
   shorter than the others, then each trace's details under its name) read into a trace a
   pair, named as the file names it, its File the CSV, its wavelength and collection time in
   its tooltip; the injection suggested on the spike (the prototype's findpeaks); the
   Analysis card (the trace's arrows, a view and no step), a click on its plot setting the
   injection at the point nearest in time at once (the guide's read-out), the reading
   following; Suggest putting every trace's back; the reading interpolated at the reading
   time, n/a past a trace's end; the calibration's window, a line typed in and standards
   fitted (R²), the concentrations in the unit typed; a trace left out and one moved; the
   CSVs (aligned and readings, the details with them); the composer of the readings; the
   project saved and opened again; a tab asleep and woken; the view no change unsaved. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start, openModule, loadFiles, settle, undo, moduleState, history, saveAs, openProject, download, readZip, parseCsv, tabLabels } from './helpers.mjs';

let env, dir;
// The traces: injected at a sample's time, a spike there, then the triiodide's rise.
const TR = [
  { name: 'blank1', inj: 15.05, base: 0.16, k: 0.9, tau: 120, wl: '350.0', when: '7/23/2025 10:17:45 AM' },
  { name: 'Sample A', inj: 20.05, base: 0.40, k: 0.5, tau: 90, wl: '350.0', when: '7/23/2025 12:07:33 PM' },
  { name: 'Sample B', inj: 12.05, base: 0.17, k: 0.2, tau: 60, wl: '352.0', when: '7/23/2025 1:15:02 PM' },
  { name: 'Short', inj: 18.05, base: 0.20, k: 0.3, tau: 100, end: 150.05, wl: '350.0', when: '7/23/2025 2:40:11 PM' },
];
const T = Array.from({ length: 1501 }, (_, j)=> +(0.05 + 0.2*j).toFixed(2));
let data;   // per trace { t, A } as written
function caryFile(){
  let x = 4242;
  const rnd = ()=>{ x = (x*1103515245 + 12345) % 2147483648; return x/2147483648 - 0.5; };
  data = TR.map(tr=>{
    const i0 = T.indexOf(tr.inj), t = [], A = [];
    T.forEach((tt, j)=>{
      if (tr.end && tt > tr.end + 1e-9) return;
      let a = tr.base + (j >= i0 ? tr.k*(1 - Math.exp(-(tt - tr.inj)/tr.tau)) : 0) + 0.0008*rnd();
      if (j === i0) a += 0.1; else if (j === i0 + 1) a += 0.06; else if (j === i0 + 2) a += 0.03;
      t.push(tt); A.push(+a.toFixed(10));
    });
    return { t, A };
  });
  let s = TR.map(tr=> tr.name + ',,').join('') + '\r\n' + TR.map(()=> 'Time (sec),Abs,').join('') + '\r\n';
  T.forEach((_, j)=>{ s += data.map(d=> j < d.t.length ? `${d.t[j].toFixed(2)},${d.A[j].toFixed(10)},` : ',,').join('') + '\r\n'; });
  s += '\r\n';
  for (const tr of TR) s += `${tr.name},\r\n${tr.name}\r\nCollection Time: ${tr.when}\r\nOperator Name  :\r\nKinetics Version 5.3.0.1079\r\nParameter List :\r\nInstrument  Cary 60\r\nWavelength (nm)  ${tr.wl}\r\nOrdinate mode  Abs\r\nAve Time (sec)  0.1000\r\nMethod Log     :\r\nSimple Collect Changed: 3/10/2025 11:46:24 AM, Old:1, New:0\r\nEnd Method Modifications\r\n<Current Wavelength> , ${tr.wl}\r\n<Cycle Count> , 1\r\n\r\n`;
  return s;
}
// What the app should read: each trace aligned on the time given, read at T s after it.
function expected(k, inj, at){
  const { t, A } = data[k], i0 = t.indexOf(inj), t0 = t[i0];
  let min = Infinity;
  for (let i = i0; i < A.length; i++) min = Math.min(min, A[i]);
  const xs = t.map(v=> v - t0), ys = A.map(v=> v - min);
  if (at > xs[xs.length - 1]) return { min, A: NaN };
  let j = i0;
  while (j + 1 < xs.length && xs[j + 1] <= at) j++;
  const A1 = j + 1 < xs.length ? ys[j] + (ys[j + 1] - ys[j])*(at - xs[j])/(xs[j + 1] - xs[j]) : ys[j];
  return { min, A: A1, xs, ys };
}

before(async ()=>{
  env = await start();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datatreat-iodo-'));
  fs.writeFileSync(path.join(dir, 'kin.csv'), caryFile());
});
after(()=>{ if (dir) fs.rmSync(dir, { recursive: true, force: true }); return env && env.close(); });

const traceRows = page => page.$$eval('#iodoFileTableWrap tr.file-row', rs=> rs.map(r=> [r.querySelector('.file-label').value, r.querySelector('td.fname').textContent, r.querySelector('.file-incl').checked]));
const injs = async page => (await moduleState(page, 'iodo')).files.map(f=> f.inj);
const text = (page, id)=> page.textContent('#' + id);
async function field(page, id, v){ await page.fill('#' + id, v); await page.press('#' + id, 'Enter'); await settle(page); }
// The project bar's CSVs, by name: rows of fields.
async function csvs(page){
  const d = await download(page, ()=> page.click('.proj-csv'));
  return Object.fromEntries(readZip(d.buf).map(e=> [e.name, parseCsv(e.data.toString('utf8'))]));
}
// The Analysis plot's pixel of a time (the trace on show), in the page.
const pxOf = (page, t)=> page.$eval('#iodoSvg', (s, t)=>{ const r = s.getBoundingClientRect(), P = s._plot; return { x: r.left + P.px(t), y: r.top + (P.py(P.ymin) + P.py(P.ymax))/2 }; }, t);
const near = (a, b, tol = 1e-9)=> Math.abs(a - b) <= tol*Math.max(1, Math.abs(b));
const CAL = '.iodo-cal:not([style*="none"])';
const tick = (page, ms)=> page.evaluate(async ms=> (await import('./tabs.js')).sleepTick(Date.now() + ms), ms);
const awake = async page => (await page.evaluate(async ()=> (await import('./tabs.js')).tabsNow())).map(t=> t.awake);

test('Iodometry: a Cary Kinetics CSV, injections, the click, Suggest, readings, calibration, exports, project, sleep', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'iodo');
    assert.equal(await page.locator('#iodoAnalysis').isVisible(), false, 'no Analysis card before a file');
    await loadFiles(page, 'iodo', [path.join(dir, 'kin.csv')], 4);
    // A trace a pair of columns, named as the file names it, its File the CSV.
    assert.deepEqual(await traceRows(page), TR.map(tr=> [tr.name, 'kin.csv', true]));
    const tips = await page.$$eval('#iodoFileTableWrap td.trace-cell', t=> t.map(e=> e.title));
    assert.match(tips[0], /Wavelength: 350 nm/);
    assert.match(tips[2], /Wavelength: 352 nm/);
    assert.match(tips[1], /Collection time: 7\/23\/2025 12:07:33 PM/);
    // The injection suggested on each spike.
    assert.deepEqual(await injs(page), TR.map(tr=> tr.inj));
    const st0 = await moduleState(page, 'iodo');
    assert.equal(st0.tRead, 240);
    assert.equal(st0.cal.mode, 'none');
    assert.equal(await text(page, 'iodoIdx'), '1/4');
    assert.equal(await text(page, 'iodoCurrentLabel'), 'blank1');
    assert.equal(await text(page, 'iodoInj'), '15.05 s');
    const e0 = expected(0, 15.05, 240);
    assert.equal(await text(page, 'iodoA'), e0.A.toFixed(4));
    assert.equal(await text(page, 'iodoBg'), e0.min.toFixed(4));
    assert.equal(await page.inputValue('#iodoTRead'), '240');
    // The parameters on three fifths and two fifths.
    const split = await page.$$eval('#iodoAnalysis .param-grid', gs=> gs.flatMap(g=>{ const r = g.getBoundingClientRect(); return [...g.querySelectorAll(':scope > .pg-field')].map(f=>{ const q = f.getBoundingClientRect(); return [+((q.left - r.left)/r.width*5).toFixed(1), +(q.width/r.width*5).toFixed(1)]; }); }));
    assert.deepEqual(split, [[3, 2], [3, 2]]);

    // The trace on show: a view, no step.
    const h0 = await history(page, 'iodo');
    await page.click('#iodoNext'); await settle(page);
    assert.equal(await text(page, 'iodoCurrentLabel'), 'Sample A');
    await page.keyboard.press('ArrowRight'); await settle(page);
    assert.equal(await text(page, 'iodoIdx'), '3/4');
    await page.click('#iodoPrev'); await page.click('#iodoPrev'); await settle(page);
    assert.equal(await text(page, 'iodoIdx'), '1/4');
    assert.deepEqual(await history(page, 'iodo'), h0, 'no step');

    // The click: the injection at the point nearest in time, at once; the guide reads it out.
    const p = await pxOf(page, 100.05);
    await page.mouse.move(p.x, p.y); await settle(page);
    assert.match(await page.$eval('#iodoSvg text.iodo-guide', t=> t.textContent), /^Time = 100\.050 s/);
    await page.mouse.click(p.x, p.y); await settle(page);
    assert.deepEqual(await injs(page), [100.05, 20.05, 12.05, 18.05]);
    assert.equal(await text(page, 'iodoInj'), '100.05 s');
    const e1 = expected(0, 100.05, 240);
    assert.equal(await text(page, 'iodoA'), `n/a (the trace ends ${(300.05 - 100.05).toFixed(1)} s after the injection)`, 'past its end');
    assert.equal((await history(page, 'iodo')).index, h0.index + 1, 'a step');
    // (the click is the injection's: no trace picked out or locked there, plot.js v536)
    assert.deepEqual(await page.$eval('#iodoSvg', s=> [!!s._pick, s.querySelectorAll('.plot-pick-hl, .plot-pick-label, .plot-lockcross').length]), [false, 0], 'no trace locked by the injection click');
    assert.ok(Number.isNaN(e1.A));
    // Suggest: every trace's again.
    await page.click('#iodoSuggest'); await settle(page);
    assert.deepEqual(await injs(page), TR.map(tr=> tr.inj));
    await undo(page);
    assert.deepEqual(await injs(page), [100.05, 20.05, 12.05, 18.05]);
    await undo(page);
    assert.deepEqual(await injs(page), TR.map(tr=> tr.inj));

    // The reading interpolated between two points (240.1 s: half way); n/a for the trace that ends before.
    await field(page, 'iodoTRead', '240,1');
    assert.equal((await moduleState(page, 'iodo')).tRead, 240.1);
    let c = await csvs(page);
    let R = c['readings.csv'];
    assert.deepEqual(R[0], ['Trace', 'File', 'Wavelength (nm)', 'Collection time', 'Injection time (s)', 'Background absorbance', 'Reading time (s)', 'Absorbance - background']);
    TR.forEach((tr, k)=>{
      const e = expected(k, tr.inj, 240.1), row = R[k + 1];
      assert.deepEqual(row.slice(0, 5), [tr.name, 'kin.csv', String(+tr.wl), tr.when, String(tr.inj)]);
      assert.ok(near(+row[5], e.min), tr.name + ' background');
      assert.equal(row[6], '240.1');
      if (tr.end) assert.equal(row[7], '', 'n/a: ends before');
      else assert.ok(near(+row[7], e.A, 1e-10), `${tr.name}: ${row[7]} vs ${e.A}`);
    });
    // (half way between the two points around it)
    const eA = expected(1, 20.05, 240.1), j = eA.xs.findIndex(v=> v > 240.1);
    assert.ok(near(eA.A, (eA.ys[j - 1] + eA.ys[j])/2, 1e-9));
    // The aligned CSV: each trace's time from its injection and absorbance less its background.
    const AL = c['aligned.csv'];
    assert.deepEqual(AL[0].slice(0, 2), ['blank1 - time from injection (s)', 'blank1 - absorbance at 350 nm - background']);
    assert.equal(AL[0][4], 'Sample B - time from injection (s)');
    assert.equal(AL[0][5], 'Sample B - absorbance at 352 nm - background');
    assert.equal(AL.length - 1, 1501);
    assert.ok(near(+AL[1][0], -15), 'from the injection');
    assert.ok(near(+AL[1 + 75][0], 0) && near(+AL[1 + 75][1], data[0].A[75] - e0.min));
    assert.equal(AL[1400][7], '', 'the short trace\'s cells past its end empty');
    await field(page, 'iodoTRead', '240');
    // A value refused: the field shakes and shows the one it had.
    await field(page, 'iodoTRead', '-3');
    assert.equal(await page.inputValue('#iodoTRead'), '240');
    await field(page, 'iodoProm', 'x');
    assert.equal(await page.inputValue('#iodoProm'), '0.01');

    // Calibration: a line typed in, the unit typed; Cancel nothing.
    const h1 = await history(page, 'iodo');
    await page.click('#iodoCalBtn'); await page.waitForSelector(CAL);
    await page.selectOption('#iodoCalMode', 'line');
    await page.fill('#iodoCalSlope', '0,5');
    await page.click(`${CAL} [data-cancel]`); await settle(page);
    assert.deepEqual(await history(page, 'iodo'), h1, 'cancelled: no step');
    await page.click('#iodoCalBtn'); await page.waitForSelector(CAL);
    assert.equal(await page.inputValue('#iodoCalMode'), 'none');
    await page.selectOption('#iodoCalMode', 'line');
    await page.fill('#iodoCalSlope', '0,5');
    assert.equal(await page.isDisabled(`${CAL} [data-apply]`), true, 'no intercept yet');
    await page.fill('#iodoCalIcpt', '0.01');
    await page.fill('#iodoCalUnit', 'mM');
    await page.click(`${CAL} [data-apply]`); await settle(page);
    assert.deepEqual((await moduleState(page, 'iodo')).cal, { mode: 'line', slope: 0.5, intercept: 0.01, stds: [], unit: 'mM' });
    assert.equal(await text(page, 'iodoC'), `${+((e0.A - 0.01)/0.5).toPrecision(4)} mM`);
    assert.equal(await text(page, 'iodoReadCap'), 'Concentration (mM) at 240 s');
    assert.match(await text(page, 'iodoCalSum'), /A = 0\.5 × c \+ 0\.01, c in mM/);
    c = await csvs(page);
    R = c['readings.csv'];
    assert.equal(R[0][8], 'Concentration (mM)');
    assert.ok(near(+R[1][8], (+R[1][7] - 0.01)/0.5, 1e-9));
    assert.equal(R[4][8], '');
    // Standards fitted, R² shown; the line typed kept beside them.
    await page.click('#iodoCalBtn'); await page.waitForSelector(CAL);
    await page.selectOption('#iodoCalMode', 'std');
    const S = [[0, 0.012], [1, 0.405], [2, 0.83], [4, 1.598]];
    for (let i = 0; i < 4; i++){
      if (i >= 3) await page.click(`${CAL} [data-add-std]`);
      await page.locator(`${CAL} .iodo-std tbody tr`).nth(i).locator('input[data-j="0"]').fill(String(S[i][0]));
      await page.locator(`${CAL} .iodo-std tbody tr`).nth(i).locator('input[data-j="1"]').fill(String(S[i][1]).replace('.', ','));
    }
    const n = 4, mx = S.reduce((s, p)=> s + p[0], 0)/n, my = S.reduce((s, p)=> s + p[1], 0)/n;
    const sxx = S.reduce((s, p)=> s + (p[0] - mx)**2, 0), sxy = S.reduce((s, p)=> s + (p[0] - mx)*(p[1] - my), 0), m = sxy/sxx, q = my - m*mx;
    const r2 = 1 - S.reduce((s, p)=> s + (p[1] - (m*p[0] + q))**2, 0)/S.reduce((s, p)=> s + (p[1] - my)**2, 0);
    assert.match(await page.textContent(`${CAL} .iodo-cal-fit`), new RegExp(`R² = ${r2.toFixed(4)}`));
    await page.click(`${CAL} [data-apply]`); await settle(page);
    const cal = (await moduleState(page, 'iodo')).cal;
    assert.deepEqual(cal, { mode: 'std', slope: 0.5, intercept: 0.01, stds: S, unit: 'mM' });
    assert.match(await text(page, 'iodoCalSum'), new RegExp(`R² = ${r2.toFixed(4)}, c in mM`));
    assert.equal(await text(page, 'iodoC'), `${+((e0.A - q)/m).toPrecision(4)} mM`);
    c = await csvs(page);
    assert.ok(near(+c['readings.csv'][2][8], (+c['readings.csv'][2][7] - q)/m, 1e-9));

    // A trace left out: out of the results; one moved: the readings follow the list.
    await page.locator('#iodoFileTableWrap .file-incl').nth(1).click(); await settle(page);
    const ticks = ()=> page.$eval('#iodoReadSvg', s=> s._plot._stored.filter(e=> e.type === 'ticklabel').map(e=> e.full));
    assert.deepEqual(await ticks(), ['blank1', 'Sample B', 'Short']);
    assert.deepEqual((await csvs(page))['readings.csv'].slice(1).map(r=> r[0]), ['blank1', 'Sample B', 'Short']);
    assert.equal(await text(page, 'iodoIdx'), '1/3');
    const rows = page.locator('#iodoFileTableWrap tr.file-row');
    const from = await rows.nth(2).locator('.drag-handle').boundingBox(), to = await rows.nth(0).boundingBox();
    await page.mouse.move(from.x + from.width/2, from.y + from.height/2); await page.mouse.down();
    await page.mouse.move(from.x + from.width/2, to.y + 3, { steps: 8 }); await page.mouse.up(); await settle(page);
    assert.deepEqual((await traceRows(page)).map(r=> r[0]), ['Sample B', 'blank1', 'Sample A', 'Short']);
    assert.deepEqual(await ticks(), ['Sample B', 'blank1', 'Short']);
    const readPts = await page.$eval('#iodoReadSvg', s=> s._plot._stored.filter(e=> e.type === 'points').map(e=> e.label));
    assert.deepEqual(readPts, ['Sample B', 'blank1'], 'a point a trace with a reading');
    assert.deepEqual(await page.$$eval('#iodoAlignLegend span', s=> s.map(e=> e.textContent)), ['Sample B', 'blank1', 'Short']);
    // The readings' figure composer: a series a point.
    await page.locator('#iodoResults .plot-wrap').nth(1).locator('button[title="Figure composer (advanced export)"]').click();
    await page.waitForSelector('.fig-backdrop .fig-svg');
    assert.equal(await page.locator('.fig-backdrop .fig-serie[data-s]').count(), 2);
    await page.keyboard.press('Escape'); await settle(page);

    // Saved and opened again: all of it.
    const SS = await moduleState(page, 'iodo');
    await saveAs(page, 'iodos');
    // The view no change unsaved: the trace on show.
    await page.click('#iodoNext'); await settle(page);
    assert.equal((await tabLabels(page)).at(-1).endsWith('*'), false, 'no "*"');
    await page.click('#tabBar .ptab.is-on .ptab-x'); await settle(page);
    await openProject(page, 'iodo', 'iodos');
    assert.deepEqual(await moduleState(page, 'iodo'), SS);
    assert.deepEqual((await traceRows(page)).map(r=> r[2]), [true, true, false, true]);
    assert.equal(await text(page, 'iodoC'), `${+((expected(2, 12.05, 240).A - q)/m).toPrecision(4)} mM`);

    // Asleep and woken: its state, the trace it showed.
    await page.click('#iodoNext'); await settle(page);
    await page.evaluate(async ()=>{ const u = await import('./utils.js'); Object.assign(u.settings, { sleepMin: 10 }); });
    const nt = await page.locator('#tabBar .ptab').count();
    await openModule(page, 'epr');
    await tick(page, 11*60000);
    assert.equal((await awake(page))[nt - 1], false, 'asleep');
    await page.locator('#tabBar .ptab').nth(nt - 1).locator('.ptab-label').click(); await settle(page);
    assert.deepEqual(await moduleState(page, 'iodo'), SS);
    assert.equal(await text(page, 'iodoCurrentLabel'), 'blank1', 'the trace it showed');
    assert.deepEqual(await ticks(), ['Sample B', 'blank1', 'Short']);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Iodometry: a file with no pair of columns refused, the same file twice said, a decimal comma and ; read', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'iodo');
    fs.writeFileSync(path.join(dir, 'bad.csv'), 'hello\nworld\n');
    const semi = 'run 1;;run 2;\nTime (min);Abs;Time (min);Abs\n' + [0, 1, 2, 3, 4].map(t=> `${t};0,${t + 1};${t};0,${t + 5}`).join('\n') + '\n';
    fs.writeFileSync(path.join(dir, 'semi.csv'), semi);
    await page.setInputFiles('#iodoFiles', [path.join(dir, 'bad.csv'), path.join(dir, 'semi.csv')]);
    await page.waitForFunction(()=> document.querySelectorAll('#iodoFileTableWrap tr.file-row').length === 2); await settle(page);
    assert.match(await page.textContent('#iodoAlerts'), /bad\.csv \(no columns of time and absorbance found\)/);
    assert.deepEqual(await traceRows(page), [['run 1', 'semi.csv', true], ['run 2', 'semi.csv', true]]);
    // (minutes read as seconds: the second trace's last point at 240 s)
    await page.click('#iodoNext'); await settle(page);
    assert.deepEqual(await page.$eval('#iodoSvg', s=> s._plot._stored.find(e=> e.type === 'line').xs.slice()), [0, 60, 120, 180, 240]);
    await page.setInputFiles('#iodoFiles', [path.join(dir, 'semi.csv')]); await settle(page);
    assert.match(await page.textContent('#iodoAlerts'), /Already loaded[\s\S]*semi\.csv/);
    assert.equal((await traceRows(page)).length, 2);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
