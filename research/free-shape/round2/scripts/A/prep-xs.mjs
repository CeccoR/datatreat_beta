// Copies each clean sub-screen row's own-solid run from a search folder into a cross-solid
// folder as <id>.<solid>.json, unless that search rejected the solid early (a run without the
// early rejection could then differ). node prep-xs.mjs <from> <to>
import fs from 'node:fs';
const [from, to] = process.argv.slice(2);
fs.mkdirSync(to, { recursive: true });
const sub = fs.readFileSync(new URL('./subscreen.txt', import.meta.url), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.trim().split(/\s+/)).filter(s=> s[4] === 'none');
for (const s of sub){
  const f = `${from}/${s[0]}.json`; if (!fs.existsSync(f)) { console.log('missing', f); continue; }
  const o = JSON.parse(fs.readFileSync(f, 'utf8')), r = o.records.find(x=> x.method === 'today' || x.method === 'hybrid');
  const early = !r.kept || (r.extra && r.extra.lsq && !r.extra.lsq.kept);   // (only kept solids: a rejected one runs again, the hybrid then polishes it)
  console.log(s[0], s[2], early ? 'early: not copied' : 'copied');
  if (!early){ o.records = [r]; o.note = "the true solid's run, from " + from; fs.writeFileSync(`${to}/${s[0]}.${s[2]}.json`, JSON.stringify(o)); }
}
