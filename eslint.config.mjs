/* ESLint's settings (npm run lint; ESLint 9 or later, installed apart: it is no dependency).
   The app's files are modules of the page or of its workers, but for the three scripts the
   page and the service worker load as they are; the tests run in Node, and the functions
   they hand to page.evaluate in the page, so they see both. The rules catch what is wrong
   (a name undefined, a key twice, code never reached, a name never used), not how the code
   is written. research/ is another job's, not the app's. */
const page = {
  window:'readonly', document:'readonly', navigator:'readonly', localStorage:'readonly', location:'readonly', history:'readonly',
  indexedDB:'readonly', console:'readonly', setTimeout:'readonly', clearTimeout:'readonly', setInterval:'readonly', clearInterval:'readonly',
  requestAnimationFrame:'readonly', cancelAnimationFrame:'readonly', performance:'readonly', getComputedStyle:'readonly', matchMedia:'readonly',
  Blob:'readonly', URL:'readonly', TextEncoder:'readonly', TextDecoder:'readonly', DOMParser:'readonly', XMLSerializer:'readonly', Image:'readonly',
  Worker:'readonly', self:'readonly', postMessage:'readonly', caches:'readonly', fetch:'readonly', Request:'readonly', Response:'readonly',
  alert:'readonly', FileReader:'readonly', ImageData:'readonly', OffscreenCanvas:'readonly', DataView:'readonly', ResizeObserver:'readonly',
  MutationObserver:'readonly', IntersectionObserver:'readonly', createImageBitmap:'readonly', structuredClone:'readonly', queueMicrotask:'readonly',
  HTMLElement:'readonly', Element:'readonly', Node:'readonly', Event:'readonly', CustomEvent:'readonly', KeyboardEvent:'readonly', PointerEvent:'readonly',
  devicePixelRatio:'readonly', innerWidth:'readonly', innerHeight:'readonly', scrollY:'readonly', SVGElement:'readonly', Path2D:'readonly', CSS:'readonly',
  getSelection:'readonly', btoa:'readonly', atob:'readonly', encodeURIComponent:'readonly', decodeURIComponent:'readonly', importScripts:'readonly',
  addEventListener:'readonly', ClipboardItem:'readonly', HTMLCanvasElement:'readonly', DOMMatrix:'readonly', AbortController:'readonly', MessageChannel:'readonly',
  Option:'readonly', screen:'readonly', crypto:'readonly',
};
// What the tests' page.evaluate functions use besides.
const probe = { DataTransfer:'readonly', File:'readonly', DragEvent:'readonly', PerformanceObserver:'readonly', IDBDatabase:'readonly',
  IDBObjectStore:'readonly', IDBTransaction:'readonly', DOMException:'readonly', Navigator:'readonly', Crypto:'readonly', SubtleCrypto:'readonly',
  NodeFilter:'readonly', scrollX:'readonly', scrollTo:'readonly' };
const node = { process:'readonly', Buffer:'readonly', URL:'readonly', console:'readonly', setTimeout:'readonly', clearTimeout:'readonly',
  setInterval:'readonly', clearInterval:'readonly', TextEncoder:'readonly', TextDecoder:'readonly', structuredClone:'readonly', performance:'readonly' };
const rules = { 'no-undef':'error', 'no-unused-vars':['warn',{args:'none', varsIgnorePattern:'^_', caughtErrors:'none', ignoreRestSiblings:true}], 'no-dupe-keys':'error', 'no-unreachable':'warn',
  'no-self-assign':'warn', 'no-cond-assign':'warn', 'no-dupe-else-if':'warn', 'no-duplicate-case':'error', 'use-isnan':'error', 'valid-typeof':'error',
  'no-constant-condition':['warn',{checkLoops:false}], 'no-redeclare':'error', 'no-shadow-restricted-names':'error', 'no-fallthrough':'warn', 'no-sparse-arrays':'warn',
  'no-unsafe-negation':'error', 'no-loss-of-precision':'warn', 'no-compare-neg-zero':'warn', 'no-import-assign':'error', 'no-const-assign':'error' };
export default [
  { ignores: ['tests/out/', 'research/'] },
  { files: ['**/*.js'], languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: page }, rules },
  { files: ['boot-head.js', 'boot-body.js', 'sw.js'], languageOptions: { sourceType: 'script' } },
  { files: ['**/*.mjs'], languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...page, ...probe, ...node } }, rules },
];
