/* ESLint's settings (npm run lint; ESLint 9 or later, installed apart: it is no dependency).
   The app's files are modules of the page or of its workers, but for the three scripts the
   page and the service worker load as they are; the tests run in Node, and the functions
   they hand to page.evaluate in the page, so they see both. The rules catch what is wrong
   (a name undefined, a key twice, code never reached, a name, an argument or a value never
   used, an expression that does nothing), not how the code is written: every one is an
   error, and the lint passes with none. research/ is another job's, not the app's; .claude/
   holds an agent's working copies. */
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
// Left out, as they flag sound code or style: no-shadow (a callback's `g` in `const g =
// groups.find(g=> …)`, page.evaluate's arguments), no-promise-executor-return (`new Promise(r=>
// setTimeout(r, ms))`), no-unmodified-loop-condition (a term fixed for the loop on purpose),
// no-control-regex (control characters stripped on purpose), no-lonely-if, no-sequences.
const rules = {
  // a name: undefined, unused (an argument after the last one used too; `_` one kept on
  // purpose), declared twice, assigned where it cannot be, a value written and never read
  'no-undef':'error', 'no-unused-vars':['error',{args:'after-used', argsIgnorePattern:'^_', varsIgnorePattern:'^_', caughtErrors:'none', ignoreRestSiblings:true}],
  'no-redeclare':'error', 'no-shadow-restricted-names':'error', 'no-import-assign':'error', 'no-const-assign':'error', 'no-func-assign':'error',
  'no-class-assign':'error', 'no-global-assign':'error', 'no-ex-assign':'error', 'no-delete-var':'error', 'no-unused-private-class-members':'error',
  'no-unused-labels':'error', 'no-useless-assignment':'error', 'no-self-assign':'error', 'no-case-declarations':'error',
  // code never run, or doing nothing
  'no-unreachable':'error', 'no-unreachable-loop':'error', 'no-unused-expressions':['error',{allowShortCircuit:true, allowTernary:true}],
  'no-useless-catch':'error', 'no-useless-return':'error', 'no-empty':['error',{allowEmptyCatch:true}], 'no-empty-pattern':'error',
  'no-constant-condition':['error',{checkLoops:false}], 'no-constant-binary-expression':'error', 'no-dupe-else-if':'error', 'no-duplicate-case':'error',
  'no-dupe-keys':'error', 'no-dupe-class-members':'error', 'no-self-compare':'error', 'no-compare-neg-zero':'error', 'for-direction':'error',
  // what does not do what it reads as
  'no-cond-assign':'error', 'no-fallthrough':'error', 'no-sparse-arrays':'error', 'no-loss-of-precision':'error', 'use-isnan':'error', 'valid-typeof':'error',
  'no-unsafe-negation':'error', 'no-unsafe-finally':'error', 'no-unsafe-optional-chaining':'error', 'no-unexpected-multiline':'error', 'no-obj-calls':'error',
  'no-async-promise-executor':'error', 'getter-return':'error', 'no-setter-return':'error', 'require-yield':'error', 'no-constructor-return':'error',
  'no-new-native-nonconstructor':'error', 'no-template-curly-in-string':'error', 'no-debugger':'error', 'no-with':'error', 'no-octal':'error',
  'no-nonoctal-decimal-escape':'error', 'no-irregular-whitespace':['error',{skipRegExps:true}],
  // regular expressions
  'no-invalid-regexp':'error', 'no-empty-character-class':'error', 'no-useless-backreference':'error', 'no-misleading-character-class':'error', 'no-useless-escape':'error' };
// The page's Content-Security-Policy runs no code made from a string (no 'unsafe-eval').
const pageRules = { ...rules, 'no-eval':'error', 'no-implied-eval':'error', 'no-new-func':'error' };
export default [
  { ignores: ['tests/out/', 'research/', '.claude/'] },
  { files: ['**/*.js'], languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: page }, rules: pageRules },
  { files: ['boot-head.js', 'boot-body.js', 'sw.js'], languageOptions: { sourceType: 'script' } },
  { files: ['**/*.mjs'], languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...page, ...probe, ...node } }, rules },
];
