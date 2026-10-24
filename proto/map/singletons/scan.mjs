// Static inventory of what assumes ONE instance per module (DataTreat, read only).
// node scan.mjs <appRoot>  → JSON on stdout
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from '/opt/node-tools/node_modules/acorn/dist/acorn.mjs';
import * as walk from '/opt/node-tools/node_modules/acorn-walk/dist/walk.mjs';

const ROOT = process.argv[2] || '/home/user/datatreat_beta';
const FILES = ['tauc.js','xrd.js','xrd-peaks.js','xrd-rv.js','xrd-rv-model.js','xrd-rv-html.js','gc.js','epr.js',
  'sem.js','sem-read.js','sem-figure.js','modkit.js','modcharts.js','cards.js','utils.js','tabs.js','sessions.js',
  'figure.js','plot.js','db.js','smooth.js','textdata.js','boot-head.js','boot-body.js','xrd-cell3d.js','xrd-shape3d.js'];

const REG = ['registerHistory','registerTabRedraw','registerCsvExport','registerBusy','setTabLoaded','moduleBusy','stopModule',
  'getModuleState','restoreModuleState','getModuleHistory','setModuleHistory','moduleStateKey','onModuleChange','onModuleChangeOnce',
  'runWithModuleState','moduleHasData','refreshProjBar','normalizeProjIcons','makeCsvButton','downloadCsvFiles','runCsvExport','redrawAll'];
const UI = ['colorPickerUI','palettePickerUI','confirmBanner','confirmModal','openComposer','closeComposer','openFigureEditor',
  'openDateModal','openSemFigure','goTab','activeTab','TABS','settings','onSectionChange','setupDropzone','renderUnifiedFileList',
  'createDateTimeField','showModuleLoader','notice'];
const GLOBAL_OBJ = new Set(['document','window','self','globalThis']);

function srcOf(node, src){ return src.slice(node.start, node.end); }
function objName(n, src){
  if (!n) return '';
  if (n.type === 'Identifier') return n.name;
  if (n.type === 'MemberExpression') return objName(n.object, src) + '.' + (n.computed ? '[]' : n.property.name);
  if (n.type === 'CallExpression') return objName(n.callee, src) + '()';
  return n.type;
}
function isFn(n){ return n && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration'); }
function mutableInit(init){
  if (!init) return 'undef';
  if (init.type === 'ObjectExpression') return 'object';
  if (init.type === 'ArrayExpression') return 'array';
  if (init.type === 'NewExpression') return 'new ' + (init.callee.name || init.callee.type);
  return null;
}

const out = {};
for (const f of FILES){
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  const lines = src.split('\n').length;
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: f.startsWith('boot') ? 'script' : 'module', locations: true }); }
  catch(e){ out[f] = { error: String(e) }; continue; }
  // The module's IIFE: (function(){ ... })() at program level.
  let iife = null;
  for (const st of ast.body){
    if (st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' && isFn(st.expression.callee)
        && st.expression.arguments.length === 0 && (st.end - st.start) > src.length * 0.5) iife = st.expression.callee;
  }
  const r = { lines, iife: iife ? { from: iife.loc.start.line, to: iife.loc.end.line } : null,
    shared: [], instance: [], listeners: [], removes: [], idsLiteral: new Set(), idsDynamic: [], qsDoc: [], qsDocIds: [],
    reg: {}, ui: {}, workers: [], observers: [], timersAtLoad: [], storage: 0, idAttrsInStrings: [], idAssign: 0, factories: [] };
  // Declarations: program level (shared by every instance) and the IIFE's (per instance once a factory)
  const decl = (body, bucket, level)=>{
    for (const st of body){
      if (st.type === 'VariableDeclaration'){
        for (const d of st.declarations){
          const names = d.id.type === 'Identifier' ? [d.id.name] : srcOf(d.id, src).replace(/[{}\[\]\s]/g,'').split(',');
          const kind = st.kind === 'const' ? mutableInit(d.init) : st.kind;
          if (kind) bucket.push({ name: names.join(','), kind: st.kind + (st.kind==='const' ? ':' + kind : ''), line: d.loc.start.line, level });
        }
      }
      if (st.type === 'ExportNamedDeclaration' && st.declaration && st.declaration.type === 'VariableDeclaration') decl([st.declaration], bucket, level);
      if (st.type === 'ClassDeclaration') bucket.push({ name: st.id.name, kind: 'class', line: st.loc.start.line, level });
    }
  };
  decl(ast.body, r.shared, 'program');
  if (iife) decl(iife.body.body, r.instance, 'iife');
  // Exported factories
  for (const st of ast.body){
    const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
    if (d && d.type === 'FunctionDeclaration' && /^(create|module|open)/.test(d.id.name)) r.factories.push({ name: d.id.name, from: d.loc.start.line, to: d.loc.end.line });
  }
  const atLoad = ancestors =>{
    // at load: no enclosing function except the IIFE
    for (let i = ancestors.length - 2; i >= 0; i--){ const a = ancestors[i]; if (isFn(a) && a !== iife) return false; }
    return true;
  };
  const inFactory = ancestors => ancestors.some(a=> a.type === 'FunctionDeclaration' && r.factories.some(fc=> fc.name === (a.id && a.id.name)));
  walk.fullAncestor(ast, (node, state, ancestors)=>{
    if (node.type === 'CallExpression'){
      const c = node.callee;
      const prop = c.type === 'MemberExpression' && !c.computed ? c.property.name : null;
      const obj = c.type === 'MemberExpression' ? objName(c.object, src) : '';
      if (prop === 'addEventListener' || prop === 'removeEventListener'){
        const tgt = obj;
        const glob = /^(document|window|self|globalThis)(\.body|\.documentElement)?$/.test(tgt) || /matchMedia/.test(tgt) || /serviceWorker/.test(tgt);
        const ev = node.arguments[0] && node.arguments[0].type === 'Literal' ? node.arguments[0].value : srcOf(node.arguments[0], src);
        const rec = { tgt, ev, line: node.loc.start.line, load: atLoad(ancestors), factory: inFactory(ancestors) };
        if (prop === 'addEventListener' && glob) r.listeners.push(rec);
        if (prop === 'removeEventListener' && glob) r.removes.push(rec);
      }
      if (prop === 'getElementById' || (c.type === 'Identifier' && (c.name === '$' || c.name === '$$' || c.name === 'byId'))){
        const a = node.arguments[0];
        const via = prop ? 'getElementById' : c.name;
        if (a && a.type === 'Literal' && typeof a.value === 'string') r.idsLiteral.add(via + ':' + a.value);
        else if (a) r.idsDynamic.push({ via, arg: srcOf(a, src).slice(0, 60), line: node.loc.start.line });
      }
      if ((prop === 'querySelector' || prop === 'querySelectorAll' || prop === 'getElementsByClassName') && GLOBAL_OBJ.has(obj)){
        const a = node.arguments[0];
        const s = a ? srcOf(a, src).slice(0, 90) : '';
        r.qsDoc.push({ sel: s, line: node.loc.start.line });
        if (/#/.test(s)) r.qsDocIds.push({ sel: s, line: node.loc.start.line });
      }
      if (c.type === 'Identifier' && REG.includes(c.name)) r.reg[c.name] = (r.reg[c.name] || 0) + 1;
      if (prop && /^(setInterval|setTimeout|requestAnimationFrame)$/.test(prop) === false && c.type === 'Identifier' && c.name === 'setInterval') r.timersAtLoad.push(node.loc.start.line);
      if (prop === 'getItem' || prop === 'setItem' || prop === 'removeItem') r.storage++;
    }
    if (node.type === 'NewExpression' && node.callee.type === 'Identifier'){
      if (node.callee.name === 'Worker') r.workers.push(node.loc.start.line);
      if (/Observer$/.test(node.callee.name)) r.observers.push({ kind: node.callee.name, line: node.loc.start.line, load: atLoad(ancestors) });
    }
    if (node.type === 'Identifier' && UI.includes(node.name)){
      const parent = ancestors[ancestors.length - 2];
      const isImport = parent && (parent.type === 'ImportSpecifier' || parent.type === 'ExportSpecifier');
      const isDecl = parent && (parent.type === 'FunctionDeclaration' || parent.type === 'VariableDeclarator') && parent.id === node;
      const isProp = parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed;
      const isKey = parent && parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand;
      if (!isImport && !isDecl && !isProp && !isKey) r.ui[node.name] = (r.ui[node.name] || 0) + 1;
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && !node.left.computed && node.left.property.name === 'id') r.idAssign++;
    if ((node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateElement'){
      const s = node.type === 'Literal' ? node.value : node.value.cooked || '';
      const re = /\bid="([^"]*)/g; let m;
      while ((m = re.exec(s))) r.idAttrsInStrings.push({ id: m[1].slice(0, 40), line: node.loc.start.line });
    }
  });
  r.idsLiteral = [...r.idsLiteral].sort();
  out[f] = r;
}

// index.html: ids by section
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const secRe = /<section[^>]*id="(tab-[a-z]+)"[\s\S]*?<\/section>/g;
const sections = {}; let m; let inSections = 0;
while ((m = secRe.exec(html))){
  const ids = [...m[0].matchAll(/\sid="([^"]+)"/g)].map(x=> x[1]);
  sections[m[1]] = { ids: ids.length, fors: [...m[0].matchAll(/\sfor="([^"]+)"/g)].length,
    idRefs: [...m[0].matchAll(/data-dl-(?:svg|legend)="([^"]+)"/g)].length, list: ids };
  inSections += ids.length;
}
const allIds = [...html.matchAll(/\sid="([^"]+)"/g)].map(x=> x[1]);
const htmlSummary = { totalIds: allIds.length, inSections, outside: allIds.filter(i=> !Object.values(sections).some(s=> s.list.includes(i))), sections };

// style.css: id selectors
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const selBlocks = [...css.matchAll(/([^{}]+)\{/g)].map(x=> x[1].trim()).filter(s=> !s.startsWith('@'));
const idSel = {}; let rulesWithId = 0;
for (const s of selBlocks){
  const ids = [...s.matchAll(/#([A-Za-z][\w-]*)/g)].map(x=> x[1]);
  if (ids.length) rulesWithId++;
  ids.forEach(i=> idSel[i] = (idSel[i] || 0) + 1);
}
const byPrefix = {};
for (const [i, n] of Object.entries(idSel)){
  const k = (i.match(/^(tab-(?:tauc|xrd|gc|epr|sem)|tauc|xrd|gc|epr|sem)/) || ['core'])[0].replace('tab-', '');
  byPrefix[k] = (byPrefix[k] || 0) + n;
}
console.log(JSON.stringify({ files: out, html: htmlSummary, css: { rules: selBlocks.length, rulesWithId, distinctIds: Object.keys(idSel).length, refsByModule: byPrefix, ids: idSel } }, null, 1));
