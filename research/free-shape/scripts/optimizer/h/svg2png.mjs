// node svg2png.mjs in.svg out.png — renders an SVG with Playwright's Chromium (for checking).
import fs from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [inp, out] = process.argv.slice(2);
const svg = fs.readFileSync(inp, 'utf8'), m = svg.match(/width="(\d+)" height="(\d+)"/);
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: +m[1], height: +m[2] } });
await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
await p.screenshot({ path: out }); await b.close();
