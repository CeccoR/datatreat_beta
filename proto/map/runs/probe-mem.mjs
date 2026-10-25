import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8983';
const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
const page = await browser.newPage();
await page.goto(BASE + '/bench/bench.html');
await page.waitForFunction(()=> window.benchReady);
await page.evaluate(()=> window.bench({ k: 2, which: [0, 1] }));
console.log('pw workers', page.workers().length);
for (const w of page.workers()) console.log(w.url(), await w.evaluate(()=> typeof performance.memory + ' ' + (performance.memory ? performance.memory.usedJSHeapSize : '')));
// CDP: the page's session, workers auto-attached (not flattened: messages through Target.sendMessageToTarget)
const cdp = await page.context().newCDPSession(page);
const subs = [];
const pending = new Map(); let mid = 1000;
cdp.on('Target.attachedToTarget', e=> subs.push(e));
cdp.on('Target.receivedMessageFromTarget', e=>{ const m = JSON.parse(e.message); const p = pending.get(m.id); if (p){ pending.delete(m.id); p(m); } });
await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: false });
await new Promise(r=> setTimeout(r, 500));
console.log('attached', subs.map(s=> s.targetInfo.type + ' ' + s.targetInfo.url));
const send = (sessionId, method, params = {})=> new Promise(res=>{ const id = ++mid; pending.set(id, res); cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }); });
for (const s of subs){
  await send(s.sessionId, 'HeapProfiler.enable');
  await send(s.sessionId, 'HeapProfiler.collectGarbage');
  const h = await send(s.sessionId, 'Runtime.getHeapUsage');
  console.log(s.targetInfo.type, JSON.stringify(h.result));
}
await cdp.send('HeapProfiler.collectGarbage');
console.log('page heap', JSON.stringify(await cdp.send('Runtime.getHeapUsage')));
const bcdp = await browser.newBrowserCDPSession();
const info = await bcdp.send('SystemInfo.getProcessInfo');
console.log(JSON.stringify(info.processInfo));
await browser.close();
