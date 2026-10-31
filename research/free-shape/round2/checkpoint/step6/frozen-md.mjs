#!/usr/bin/env node
/* FROZEN.json as a table: node frozen-md.mjs <out.md> */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const F = JSON.parse(fs.readFileSync(path.join(HERE, 'FROZEN.json'), 'utf8')), t = F.tunables;
const j = o => '`' + JSON.stringify(o).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ') + '`';
const L = ['# The frozen prototype (step 6)', '',
  `Frozen ${F.at.slice(0, 16).replace('T', ' ')} UTC, after the confirmation on the 154 tuning runs and before any validation row was drawn or run (\`../CONFIRM.md\` §9). No tunable changed from step 5. The values as the engine read them (\`$W/fs2/step6/FROZEN.json\`, which also holds the sha256 of the engine files every validation run was checked against):`, '',
  '| switch or tunable | frozen value |', '|---|---|',
  `| \`SHAPE_MODE\` | ${j(t.SHAPE_MODE)} |`, `| \`WPPM_OPT\` (xrd-broad.js) | ${j(t.WPPM_OPT)} |`, `| \`SHAPE_FILL\` | ${t.SHAPE_FILL} |`, `| \`SHAPE_CENTRAL\` | ${t.SHAPE_CENTRAL} |`, `| \`SHAPE_FWD\` | ${t.SHAPE_FWD} |`,
  `| \`SHAPE_CHECK\` | ${j(t.SHAPE_CHECK)} |`, `| \`SHAPE_MINIMA\` | ${j(t.SHAPE_MINIMA)} |`, `| \`SHAPE_KEEP\` | ${j(t.SHAPE_KEEP)} |`, `| \`SHAPE_FAMILY\` | ${j(t.SHAPE_FAMILY)} |`, '',
  'Unchanged as well: the tables of `xrd-sizeline.js` (the lsq line only: steps 0.5° and 0.025, span 6, weights b 0.2) and `lowIndexAxes` (5 families). The app files with the patch applied to `9782d33` (sha256, first 16 hex digits):', '',
  ...Object.entries(F.app).map(([f, h])=> `- \`${f}\`: \`${h.slice(0, 16)}\``), ''];
fs.writeFileSync(process.argv[2], L.join('\n'));
console.log(L.join('\n'));
