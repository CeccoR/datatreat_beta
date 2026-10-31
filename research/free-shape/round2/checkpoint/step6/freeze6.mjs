#!/usr/bin/env node
/* The freeze: FROZEN.json with the harness's engine copy's hashes (h/run.mjs refuses a validation row unless
   its engine matches), the app copy's engine files' hashes, and the tunables as the engine holds them.
   node freeze6.mjs [--app $W/step6-app] */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), app = a.includes('--app') ? a[a.indexOf('--app') + 1] : path.resolve(HERE, '..', '..', 'step6-app');
const h = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const eng = Object.fromEntries(fs.readdirSync(path.join(HERE, 'h', 'eng')).filter(f=> f.endsWith('.js')).sort().map(f=> [f, h(path.join(HERE, 'h', 'eng', f))]));
const appFiles = Object.fromEntries(['xrd-rietveld.js', 'xrd-broad.js', 'xrd-sizeline.js', 'sw.js', 'RIETVELD.md'].map(f=> [f, h(path.join(app, f))]));
const { ENG } = await import(path.join(HERE, 'h', 'eng', 'xrd-rietveld.js'));
const B = await import(path.join(HERE, 'h', 'eng', 'xrd-broad.js'));
const src = fs.readFileSync(path.join(app, 'xrd-rietveld.js'), 'utf8'), lit = nm => { const m = src.match(new RegExp('^const ' + nm + ' = ([^;]+);', 'm')); return m ? m[1] : null; };
const tunables = { SHAPE_FILL: lit('SHAPE_FILL'), SHAPE_CENTRAL: lit('SHAPE_CENTRAL'), SHAPE_MODE: ENG.SHAPE_MODE, SHAPE_FWD: ENG.SHAPE_FWD, WPPM_OPT: B.WPPM_OPT, SHAPE_CHECK: ENG.SHAPE_CHECK, SHAPE_MINIMA: ENG.SHAPE_MINIMA, SHAPE_KEEP: ENG.SHAPE_KEEP, SHAPE_FAMILY: ENG.SHAPE_FAMILY };
const out = { at: new Date().toISOString(), note: 'frozen after the confirmation on the 154 tuning runs; the validation part is scored once on this engine', eng, app: appFiles, tunables };
fs.writeFileSync(path.join(HERE, 'FROZEN.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
