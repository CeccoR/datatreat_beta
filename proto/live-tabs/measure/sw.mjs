/* Live tabs with the service worker on (every other script blocks it): the app installed
   (its worker active, the page controlled), then reloaded; a tab's frame is loaded through
   the worker's cache (index.html?embed=<id> answers from the cached index.html: ignoreSearch)
   and controlled too, and registers no worker of its own. Then the server stopped answering
   (offline: the context set offline) and the app reloaded: the shell and a new tab's frame
   come from the cache alone.
   node sw.mjs → results/sw.json */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { BASES, save, sleep } from './lib.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(()=>{ try { localStorage.setItem('datatreat-live-tabs', 'on'); } catch(e){} });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e=> errors.push(e.message));
const up = ()=> page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'), null, { timeout: 60000 });
const checks = [];
const check = (name, ok, seen)=>{ checks.push({ name, ok: !!ok, seen }); console.log(ok ? 'ok  ' : 'FAIL', name, '—', JSON.stringify(seen)); };
await page.goto(BASES.live + '/index.html'); await up();
await page.waitForFunction(()=> navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 60000 }).catch(()=>{});
if (!await page.evaluate(()=> !!navigator.serviceWorker.controller)){ await page.reload(); await up(); }
check('the shell controlled by the service worker', await page.evaluate(()=> !!navigator.serviceWorker.controller), null);
const openFrame = async mod =>{
  await page.click('#nav button[data-tab="home"]');
  const n = await page.locator('.live-frames iframe').count();
  await page.click(`.home-card[data-go="${mod}"]`);
  await page.waitForFunction(n=> document.querySelectorAll('.live-frames iframe').length > n, n);
  const f = await (await page.locator('.live-frames iframe').nth(n).elementHandle()).contentFrame();
  await f.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !document.querySelector('.module-loader.show'), null, { timeout: 30000 });
  return f;
};
const f = await openFrame('xrd');
const sf = await f.evaluate(async ()=> ({ controlled: !!navigator.serviceWorker.controller, regs: (await navigator.serviceWorker.getRegistrations()).length, embed: document.documentElement.classList.contains('embed') }));
check('a tab\'s frame is controlled by the same worker (loaded through it)', sf.controlled && sf.embed, sf);
await ctx.setOffline(true);
await page.reload(); await up();
await sleep(500);
const f2 = await openFrame('tauc').catch(e=> null);
check('offline: the shell and a new tab\'s frame come from the cache', !!f2 && await f2.evaluate(()=> !!document.querySelector('#tab-tauc.active')), { frame: !!f2 });
await ctx.setOffline(false);
console.log('errors', errors);
save('sw.json', { checks, errors });
await browser.close();
