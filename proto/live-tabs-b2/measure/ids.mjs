/* The ids of an instance on show (b2): how the shell hands them over. An XRPD tab of the
   12 patterns refined, its section and layer: the elements with an id, the attributes that
   name one (for, aria-*, clip-path and other url(#…), href="#…", data-dl-svg,
   data-dl-legend), and the time of the two ways, each followed by the style and layout it
   leaves to the next frame (offsetHeight read), 20 rounds:
   - detach: the section and the layer taken out of the page and put back (what tabs.js
     does: the hidden instance's ids out of the page with it);
   - swap: the section kept in the page, hidden, its ids prefixed and back (the elements
     with an id walked, each id and each attribute naming one rewritten), as an instance
     held in the page would need.
   node ids.mjs → results/ids.json */
import { launch, med, r1, save } from './lib.mjs';
const { app, page, errors, close } = await launch(process.env.B2_BASE || 'http://127.0.0.1:8993');
await app.xrdRefined();
const out = await page.evaluate(async ()=>{
  const T = await import('./tabs.js'), inst = T.TABS[0].inst, root = inst.root, layer = inst.layer;
  const at = document.createComment('x'); root.before(at);
  // (an attribute that names an id: for, aria-*, data-dl-*; url(#…) in a paint or clip; a link's #…)
  const REFS = ['for', 'aria-describedby', 'aria-labelledby', 'aria-controls', 'data-dl-svg', 'data-dl-legend', 'clip-path', 'href', 'mask', 'fill', 'stroke'];
  const names = (a, v)=> a === 'for' || a.startsWith('aria-') || a.startsWith('data-') ? true : a === 'href' ? /^#/.test(v) : /url\(#/.test(v);
  const ided = ()=> [...root.querySelectorAll('[id]'), ...layer.querySelectorAll('[id]')];
  const referring = ()=> [...root.querySelectorAll('*'), ...layer.querySelectorAll('*')].flatMap(el=> REFS.filter(a=>{ const v = el.getAttribute(a); return v && names(a, v); }).map(a=> [el, a]));
  const nIds = ided().length, refs = referring(), nRefs = refs.length;
  const time = fn =>{ const t0 = performance.now(); fn(); void document.body.offsetHeight; return performance.now() - t0; };
  const detach = [], swap = [];
  for (let i = 0; i < 20; i++){
    detach.push(time(()=>{ root.remove(); layer.remove(); }) + time(()=>{ at.before(root); document.body.appendChild(layer); }));
    const p = 'h' + i + '-';
    const re = (v, f)=> v.replace(/url\(#([^)]+)\)/g, (_, id)=> 'url(#' + f(id) + ')').replace(/^#(.+)$/, (_, id)=> '#' + f(id));
    const rename = f =>{
      ided().forEach(el=>{ el.id = f(el.id); });
      refs.forEach(([el, a])=>{ const v = el.getAttribute(a); el.setAttribute(a, /url\(#|^#/.test(v) ? re(v, f) : v.split(' ').map(f).join(' ')); });
    };
    swap.push(time(()=>{ root.classList.remove('active'); rename(id=> p + id); }) + time(()=>{ rename(id=> id.slice(p.length)); root.classList.add('active'); }));
  }
  at.remove();
  return { ids: nIds, refs: nRefs, elements: root.querySelectorAll('*').length + layer.querySelectorAll('*').length, detach, swap };
});
const res = { ...out, detachMs: r1(med(out.detach)), swapMs: r1(med(out.swap)), errors };
console.log(JSON.stringify({ ids: res.ids, refs: res.refs, elements: res.elements, detachMs: res.detachMs, swapMs: res.swapMs }), save('ids.json', res));
await close();
