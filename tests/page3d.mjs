/* The page the two 3D views (xrd-shape3d.js shapeView, xrd-cell3d.js cellView) are run on
   in Node, no browser (v564, out of shape3d.test.mjs, where it was v554's fakePage):
   elements, a computed style with the theme's tokens, the observers, the frames run by hand,
   and canvases that record every call and property set, every number by its shortest
   round-trip string, measureText a fixed width a character. Its log is what a test hashes.
   fakePage(o): o.media, the media queries kept and their changes fired by hand (media);
   o.fonts, document.fonts with its loadingdone and ready (fontsDone, fontsReady); o.clock,
   performance.now a clock moved by hand (advance); o.classes, the classes an element is
   given kept (el.classes). Without them the page is v554's as it was, which
   golden/shape3d.json was made on. */
import { createHash } from 'node:crypto';

const sha = s => createHash('sha256').update(s).digest('hex');
export const TOKENS = {
  dark: { '--bg': '#0e1316', '--text': '#dfe8ea', '--muted': '#7f97a0', '--accent': '#ffb454', '--phase2': '#5ab0ff' },
  light: { '--bg': '#ffffff', '--text': '#1a2327', '--muted': '#56676f', '--accent': '#c77700', '--phase2': '#1f6fd0' },
};
// A colour as a canvas gives it back: #rrggbb when opaque, rgba(…) when not; anything else
// is no colour, and the property keeps what it had.
export function canvasColour(v, was){
  const s = String(v).trim().toLowerCase();
  const hex = n => n.toString(16).padStart(2, '0');
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (m){ const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]; return '#' + h; }
  if (s === 'black') return '#000000';
  if (s === 'white') return '#ffffff';
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (m){
    const [r, g, b] = [m[1], m[2], m[3]].map(x => Math.round(Math.min(255, +x)));
    return m[4] == null || +m[4] >= 1 ? '#' + hex(r) + hex(g) + hex(b) : `rgba(${r}, ${g}, ${b}, ${+m[4]})`;
  }
  return typeof v === 'object' ? v : was;
}
export function fakePage(o = {}){
  const log = [];
  let nid = 0, theme = 'dark', clock = 1000;
  const fmt = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v))
    : typeof v === 'string' ? JSON.stringify(v)
    : Array.isArray(v) ? '[' + v.map(fmt).join(',') + ']'
    : v && v.data instanceof Uint8ClampedArray ? `img(${v.width}x${v.height}:${sha(v.data).slice(0, 16)})`
    : v && v.id ? v.id : String(v);
  const rec = (id, what, args) => log.push(id + '.' + what + (args ? '(' + args.map(fmt).join(',') + ')' : ''));
  const recorder = (id, state = {}, special = {}) => new Proxy(Object.assign(state, { id }), {
    get(st, k){
      if (k in st || typeof k === 'symbol') return st[k];
      return (...a) => { const r = special[k] ? special[k](...a) : undefined; rec(id, k, a); return r; };
    },
    set(st, k, v){
      st[k] = k === 'fillStyle' || k === 'strokeStyle' ? canvasColour(v, st[k]) : v;
      rec(id, k + '=' + fmt(v));
      return true;
    },
  });
  class El {
    constructor(tag){
      this.tag = tag; this.id = tag + (++nid); this.style = {}; this.attrs = {}; this.on = {}; this.kids = []; this.parentElement = null; this.nodeType = 1; this.hidden = false; this.clientWidth = 0; this.bg = '';
      const cls = this.classes = new Set();
      this.classList = o.classes ? { add(c){ cls.add(c); }, remove(c){ cls.delete(c); } } : { add(){}, remove(){} };
    }
    setAttribute(k, v){ this.attrs[k] = String(v); }
    getAttribute(k){ return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k){ delete this.attrs[k]; }
    append(...c){ c.forEach(x => this.appendChild(x)); }
    appendChild(c){ c.parentElement = this; this.kids.push(c); return c; }
    remove(){ if (this.parentElement) this.parentElement.kids = this.parentElement.kids.filter(x => x !== this); this.parentElement = null; }
    addEventListener(t, f){ (this.on[t] = this.on[t] || []).push(f); }
    removeEventListener(t, f){ this.on[t] = (this.on[t] || []).filter(x => x !== f); }
    fire(type, e = {}){ for (const f of this.on[type] || []) f({ type, pointerId: 7, pointerType: 'mouse', button: 0, clientX: 0, clientY: 0, preventDefault(){}, stopPropagation(){}, ...e }); }
    focus(){}
    setPointerCapture(){ throw new Error('no such pointer'); }
    releasePointerCapture(){}
  }
  class Canvas extends El {
    constructor(){ super('canvas'); this.w = 300; this.h = 150; this.ctx = null; }
    get width(){ return this.w; }
    set width(v){ this.w = v; rec(this.id, 'width=' + v); }
    get height(){ return this.h; }
    set height(v){ this.h = v; rec(this.id, 'height=' + v); }
    getContext(){
      return this.ctx || (this.ctx = recorder(this.id, { fillStyle: '#000000', font: '10px sans-serif' }, {
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(4 * w * h) }),
        createLinearGradient: () => recorder('grad' + (++nid)),
        createRadialGradient: () => recorder('rgrad' + (++nid)),
        // a width a character, by the font's size
        measureText: s => ({ width: String(s).length * 0.55 * parseFloat(/([\d.]+)px/.exec(this.ctx.font || '10px')[1]) }),
      }));
    }
    toDataURL(){ const s = sha(log.join('\n')); rec(this.id, 'toDataURL'); return 'data:image/png;' + s; }
  }
  const frames = [], observers = [], media = [], fontsOn = [];
  let ready = null;
  const page = {
    log, frames,
    document: {
      createElement: t => t === 'canvas' ? new Canvas() : new El(t),
      documentElement: new El('html'),
      ...(o.fonts ? { fonts: {
        addEventListener(t, f){ fontsOn.push(f); }, removeEventListener(t, f){ const i = fontsOn.indexOf(f); if (i >= 0) fontsOn.splice(i, 1); },
        ready: new Promise(r => { ready = r; }) } } : {}),
    },
    getComputedStyle: el => ({
      getPropertyValue: n => TOKENS[theme][n] || '',
      backgroundColor: el.bg ? (el.bg[theme] || el.bg) : 'rgba(0, 0, 0, 0)',
      fontFamily: 'Inter, sans-serif', paddingLeft: '8px', paddingRight: '8px',
    }),
    requestAnimationFrame: f => { frames.push(f); return frames.length; },
    cancelAnimationFrame: () => {},
    matchMedia: o.media
      ? q => { const m = { q, on: [], addEventListener(t, f){ m.on.push(f); }, removeEventListener(t, f){ m.on = m.on.filter(x => x !== f); } }; media.push(m); return m; }
      : () => ({ addEventListener(){}, removeEventListener(){} }),
    ResizeObserver: class { constructor(f){ this.f = f; } observe(el){ observers.push(() => this.f([{ contentRect: { width: el.clientWidth - 16 } }])); this.f([{ contentRect: { width: el.clientWidth - 16 } }]); } disconnect(){} },
    MutationObserver: class { constructor(f){ page.themed.push(f); } observe(){} disconnect(){} },
    // (new Path2D() gives back the recorder this returns)
    Path2D: function(){ return recorder('path' + (++nid)); },
    themed: [],
    performance: { now: () => clock },
    // the frames asked for, run (and those they ask for)
    flush(){ for (let i = 0; i < 4 && frames.length; i++){ const fs = frames.splice(0); fs.forEach(f => f(0)); } },
    resize(){ observers.forEach(o => o()); },
    setTheme(t){ theme = t; page.themed.forEach(f => f([])); },
    // (o.media) the queries' listeners told of a change: those whose query holds `what`
    mediaChange(what){ for (const m of media.slice()) if (m.q.includes(what)) m.on.slice().forEach(f => f({ matches: true })); },
    listening: what => media.filter(m => m.q.includes(what)).reduce((n, m) => n + m.on.length, 0),
    // (o.fonts) a font loaded; every font loaded (document.fonts.ready)
    fontsDone(){ fontsOn.slice().forEach(f => f({})); },
    fontsReady(){ if (ready) ready(); ready = null; },
    fontsListening: () => fontsOn.length,
    advance(ms){ clock += ms; },
  };
  return page;
}
// The page as the globals a view reads (o.clock: performance.now the page's clock too).
export function install(page, dpr, o = {}){
  Object.assign(globalThis, {
    window: globalThis, devicePixelRatio: dpr, document: page.document, getComputedStyle: page.getComputedStyle,
    requestAnimationFrame: page.requestAnimationFrame, cancelAnimationFrame: page.cancelAnimationFrame, matchMedia: page.matchMedia,
    ResizeObserver: page.ResizeObserver, MutationObserver: page.MutationObserver, Path2D: page.Path2D,
  });
  if (o.clock) Object.defineProperty(globalThis, 'performance', { value: page.performance, configurable: true, writable: true });
}
