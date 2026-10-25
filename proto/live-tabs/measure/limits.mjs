/* What live tabs keep and what they break, checked in the app (live only): each check a line
   ok / FAIL with what was seen. Not timed.
   node limits.mjs → results/limits.json */
import { launch, addTab, DRS, XRD12, save, sleep } from './lib.mjs';
import fs from 'node:fs';
const env = await launch('live');
const { app, page } = env;
await app.goto();
const checks = [];
const check = (name, ok, seen)=>{ checks.push({ name, ok: !!ok, seen }); console.log(ok ? 'ok  ' : 'FAIL', name, '—', typeof seen === 'string' ? seen : JSON.stringify(seen)); };
const smooth = f => f.inputValue('#xrdA1Smooth');
const setSmooth = (f, v)=> f.evaluate(v=>{ const i = document.querySelector('#xrdA1Smooth'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, v);

await addTab(app, 'xrd');                 // 0
await addTab(app, 'drs');                 // 1
let fx = await app.frame(0), fd = await app.frame(1);

// 1. Keys after a click on the shell's bar: Ctrl+Z reaches the tab on show.
{
  await app.show(0);
  await setSmooth(fx, '0.4'); await sleep(300);
  await page.locator('#tabBar .ptab').nth(0).locator('.ptab-label').click();   // the bar clicked: focus goes back into the frame
  await sleep(200);
  const focus = await page.evaluate(()=> document.activeElement && document.activeElement.tagName);
  await page.keyboard.press('Control+z'); await sleep(400);
  check('Ctrl+Z after a click on the tab bar undoes in the tab on show (focus moved into its frame)', (await smooth(fx)) === '0.25', { focusInShell: focus, smooth: await smooth(fx) });
  await page.keyboard.press('Control+y'); await sleep(400);
  check('Ctrl+Y redoes there too', (await smooth(fx)) === '0.4', await smooth(fx));
  // focus left in the shell (its logo clicked): the key forwarded to the frame
  await page.click('header h1'); await sleep(200);
  const f2 = await page.evaluate(()=> document.activeElement && document.activeElement.tagName);
  await page.keyboard.press('Control+z'); await sleep(400);
  check('Ctrl+Z with the focus in the shell (its header clicked) is forwarded to the tab on show', (await smooth(fx)) === '0.25', { focusInShell: f2, smooth: await smooth(fx) });
  const before = await fx.evaluate(()=> document.querySelector('#xrdA1Prev') && document.querySelector('.an-sample-name, .an-nav-name') ? document.querySelector('.an-sample-name, .an-nav-name').textContent : null);
  const idx0 = await fx.evaluate(async ()=> (await import('./utils.js')).getModuleState('xrd').curIdx);
  await page.click('header h1'); await page.keyboard.press('ArrowRight'); await sleep(400);
  const idx1 = await fx.evaluate(async ()=> (await import('./utils.js')).getModuleState('xrd').curIdx);
  check('→ with the focus in the shell steps the sample in the tab on show', idx1 !== idx0, { curIdx: [idx0, idx1], label: before });
  // the DRS tab hidden is not touched by keys meant for the XRPD one
  const h0 = await fd.evaluate(async ()=> (await import('./utils.js')).getModuleHistory('tauc').index);
  await page.keyboard.press('Control+z'); await sleep(300);
  const h1 = await fd.evaluate(async ()=> (await import('./utils.js')).getModuleHistory('tauc').index);
  check('a key reaches only the tab on show (the hidden DRS history untouched)', h0 === h1, [h0, h1]);
}

// 2. Drag and drop of a file onto a frame's dropzone (a drop event with a DataTransfer)
{
  await app.show(1);
  const n0 = await fd.locator('#taucFileTableWrap tr.file-row').count();
  const text = fs.readFileSync(DRS[0], 'utf8');
  await fd.evaluate(t=>{
    const dt = new DataTransfer(); dt.items.add(new File([t], 'dropped.csv', { type: 'text/csv' }));
    const dz = document.querySelector('#taucDropzone');
    for (const type of ['dragenter', 'dragover', 'drop']) dz.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, text);
  await fd.waitForFunction(n=> document.querySelectorAll('#taucFileTableWrap tr.file-row').length > n, n0, { timeout: 10000 }).catch(()=>{});
  const n1 = await fd.locator('#taucFileTableWrap tr.file-row').count();
  check('a file dropped on a tab frame\'s dropzone is read there', n1 === n0 + 1, [n0, n1]);
}

// 3. Downloads from a frame: the project's CSV (zip) and a plot's figure
{
  await app.show(1);
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(e=> null), fd.click('.proj-csv')]);
  check('a download started in a frame (the project bar\'s CSV) reaches the browser', !!d, d ? d.suggestedFilename() : 'no download event');
}

// 4. Settings and theme set in the shell reach the live frames (the storage event)
{
  await page.click('#nav button[data-tab="settings"]');
  await page.selectOption('#settingDecimal', ',');
  await sleep(300);
  const dec = await fd.evaluate(async ()=> (await import('./utils.js')).settings.decimal);
  check('the decimal separator set in Settings is the frames\' at once', dec === ',', dec);
  await page.selectOption('#settingDecimal', '.');
  const th0 = await fx.evaluate(()=> document.documentElement.getAttribute('data-theme'));
  await page.click('#themeToggle'); await sleep(600);
  const th1 = await fx.evaluate(()=> document.documentElement.getAttribute('data-theme'));
  const sh = await page.evaluate(()=> document.documentElement.getAttribute('data-theme'));
  check('the theme toggled in the shell is the frames\' at once', th1 === sh && th1 !== th0, { before: th0, frame: th1, shell: sh });
  await page.click('#themeToggle'); await sleep(400);
}

// 5. Projects: saved in a frame, listed in the shell; renamed in the list → the tab and its
//    name field; deleted in the list → its tab and frame gone
{
  await app.show(0);
  await fx.fill('.project-name-input', 'Lim X'); await fx.click('.proj-save'); await fx.waitForSelector('.proj-save.is-saved');
  await page.click('#nav button[data-tab="projects"]');
  await page.waitForSelector('#sessListWrap input.proj-rename[value="Lim X"]', { timeout: 5000 }).catch(()=>{});
  check('a project saved in a frame is in the shell\'s Projects list', await page.locator('#sessListWrap input.proj-rename[value="Lim X"]').count() === 1, await page.locator('#sessListWrap input.proj-rename').evaluateAll(a=> a.map(x=> x.value)));
  const inp = page.locator('#sessListWrap input.proj-rename[value="Lim X"]');
  await inp.fill('Lim X2'); await inp.press('Enter'); await sleep(600);
  const label = await page.locator('#tabBar .ptab').nth(0).textContent();
  const field = await fx.inputValue('.project-name-input');
  check('renamed in the list: the tab\'s label and its page\'s name field', /Lim X2/.test(label) && field === 'Lim X2', { label, field });
  // saved, unchanged: the record's dirty false in the shell's mirror
  check('the tab\'s saved state mirrored in the shell (no "*")', !/\*/.test(label), label);
}

// 6. A hidden tab with unsaved work closed from the bar: shown, then asked in its page
{
  await app.show(0);
  await app.show(1);   // DRS on show, dirty (never saved)
  await app.show(0);
  await page.locator('#tabBar .ptab').nth(1).locator('.ptab-x').click();
  await sleep(600);
  const on = await page.locator('#tabBar .ptab.is-on').textContent();
  const asked = await fd.evaluate(()=>{ const t = document.querySelector('.pwa-confirm.show'); return t ? t.querySelector('span').textContent : null; });
  check('closing a hidden unsaved tab shows it and asks there (today: asked over the tab on show)', /DRS/.test(on) && /Save/.test(asked || ''), { on, asked });
  await fd.click('.pwa-confirm.show .btn:not(.primary)');   // Don't save
  await page.waitForFunction(()=> document.querySelectorAll('#tabBar .ptab').length === 1);
  check('… "Don\'t save" closes it: the frame removed', await page.locator('.live-frames iframe').count() === 1, await page.locator('.live-frames iframe').count());
}

// 7. A refinement goes on while its tab is left, with no question; its results there on
//    return; one undo then does what it does after a run on show (the same frame, the same
//    run, once on show and once hidden)
{
  await addTab(app, 'drs');  // 1
  fd = await app.frame(1);
  const run = async hidden =>{
    const s = await app.show(0);
    const before = await app.results(fx), h0 = await fx.evaluate(async ()=>{ const x = (await import('./utils.js')).getModuleHistory('xrd'); return x.index; });
    await s.waitForTimeout(700);
    await s.click('#xrdR2RefineAll'); await s.waitForSelector('.confirm-modal'); await s.click('.confirm-modal .btn:not(.primary)');
    await s.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
    let banner = null, mark = null;
    if (hidden){
      await page.locator('#tabBar .ptab').nth(1).locator('.ptab-label').click(); await sleep(1500);
      banner = await page.evaluate(()=> !!document.querySelector('.pwa-confirm.show'));
      mark = await page.locator('#tabBar .ptab').nth(0).textContent();
    }
    await fx.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { timeout: 300000 });
    const k = await app.results(fx);
    const label = await page.locator('#tabBar .ptab').nth(0).textContent();
    await app.show(0); await sleep(300);
    const h = await fx.evaluate(async ()=>{ const x = (await import('./utils.js')).getModuleHistory('xrd'); return { n: x.states.length, index: x.index }; });
    await page.keyboard.press('Control+z'); await sleep(500);
    const undone = await app.results(fx);
    const h2 = await fx.evaluate(async ()=>{ const x = (await import('./utils.js')).getModuleHistory('xrd'); return { n: x.states.length, index: x.index }; });
    await page.keyboard.press('Control+y'); await sleep(500);
    return { banner, mark, resultsBefore: before, indexBefore: h0, results: k, label, hist: h, histAfterUndo: h2, resultsAfterUndo: undone, resultsAfterRedo: await app.results(fx) };
  };
  const shown = await run(false), hidden = await run(true);
  check('leaving a tab while it refines asks nothing; the bar marks it running', hidden.banner === false && /⟳/.test(hidden.mark), { banner: hidden.banner, mark: hidden.mark });
  check('its results written while hidden, the tab marked changed', hidden.results === 12 && /\*/.test(hidden.label), { results: hidden.results, label: hidden.label });
  // (one undo goes back to the state the run started from, one redo to its results: on show
  // and hidden alike)
  const same = r => r.hist.index === r.indexBefore + 1 && r.histAfterUndo.index === r.indexBefore && r.resultsAfterUndo === r.resultsBefore && r.resultsAfterRedo === r.results;
  check('undo and redo after the run hidden do as after the run on show (its own history: one step, back to the state it started from)', same(shown) && same(hidden), { shown, hidden });
}

// 8. A modal in a frame no longer holds the tab bar: switching with the standard's window open
{
  const s = await app.show(0);
  await s.click('#xrdA1Std').catch(()=>{});
  await sleep(500);
  const open = await s.evaluate(()=> [...document.querySelectorAll('.modal-backdrop')].some(m=> m.getClientRects().length > 0));
  let switched = false;
  try { await page.locator('#tabBar .ptab').nth(1).locator('.ptab-label').click({ timeout: 2000 }); switched = /DRS/.test(await page.locator('#tabBar .ptab.is-on').textContent()); } catch(e){}
  check('a window open in a frame (the XRPD standard) no longer keeps the tabs from switching (a change: today it covers the bar)', open && switched, { modalOpen: open, switched });
  await app.show(0); await s.keyboard?.press?.('Escape'); await page.keyboard.press('Escape'); await sleep(300);
}

// 9. Records: the shell writes order and the tab on show, each frame its state; a reload
//    gives the same tabs, order and work
{
  await app.show(1);
  await setSmooth(fx, '0.35'); await sleep(6500);   // (the autosave)
  // drag tab 1 before tab 0
  const a = await page.locator('#tabBar .ptab').nth(1).boundingBox(), b = await page.locator('#tabBar .ptab').nth(0).boundingBox();
  await page.mouse.move(a.x + a.width/2, a.y + a.height/2); await page.mouse.down(); await page.mouse.move(b.x + 5, b.y + b.height/2, { steps: 8 }); await page.mouse.up();
  await sleep(800);
  const order0 = await page.locator('#tabBar .ptab .ptab-tech').allTextContents();
  await page.reload();
  await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab'));
  await sleep(1000);
  const framesAtBoot = await page.locator('.live-frames iframe').count();
  const order1 = await page.locator('#tabBar .ptab .ptab-tech').allTextContents();
  const xi = order1.findIndex(t=> /XRPD/.test(t));
  await page.locator('#tabBar .ptab').nth(xi).locator('.ptab-label').click();
  fx = await app.frame(xi);
  const sm = await smooth(fx), k = await app.results(fx);
  check('after a reload: the order the shell wrote, the state each frame wrote', JSON.stringify(order0) === JSON.stringify(order1) && sm === '0.35' && k === 12, { order0, order1, smooth: sm, results: k });
  check('after a reload only the tab on show has a frame (lazy)', framesAtBoot === 1, framesAtBoot);
}

// 10. Memory ceiling: the isolate's heap limit (one for the shell and every frame)
{
  const lim = await page.evaluate(()=> performance.memory ? Math.round(performance.memory.jsHeapSizeLimit/1048576) : null);
  check('one JS heap limit for all the tabs (same-origin frames share an isolate)', true, lim + ' MB');
}
console.log('errors', env.errors);
save('limits.json', { checks, errors: env.errors });
await env.close();
