// mkjobs.mjs <line> <profile> <A tag for the order> <fwd,fwd...> [tagprefix]: the 77 screening rows, longest first
// (by A's record: iso + search + report wall), each row's variants next to each other (one load)
import fs from 'node:fs'; import path from 'node:path'; import { readResult } from './lib.mjs';
const FS2 = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const [line, profile, atag, fwds, pre] = process.argv.slice(2);
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const rows = design.rows.filter(r=> r.screen && r.split !== 'validation').map(r=> r.id);
const cost = id => { const o = readResult(fs.readFileSync(path.join(FS2, 'A', 'results', atag, id + '.json'), 'utf8')), t = o.records.find(r=> r.method === 'today'); return o.iso.ms + t.search.ms + (t.report ? t.report.ms : 0); };
rows.sort((a, b)=> cost(b) - cost(a));
for (const id of rows) for (const f of fwds.split(',')) console.log(`${pre || 'v2'}${f === 'all' ? 'a' : 'b'}-${profile === 'wppm' ? 'wppm' : line} ${line} v2 ${f} ${profile} ${id}`);
