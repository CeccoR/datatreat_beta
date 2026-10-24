import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage(); await p.goto('http://127.0.0.1:8984/index.html'); await p.waitForTimeout(1500);
const kids = new Map();
for (const d of fs.readdirSync('/proc')){ if (!/^\d+$/.test(d)) continue; try { const st = fs.readFileSync(`/proc/${d}/stat`, 'utf8'); const pp = +st.slice(st.lastIndexOf(')') + 2).split(' ')[1]; if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(+d); } catch(e){} }
const walk = (pid, dep)=>{ for (const c of kids.get(pid) || []){ let cmd = ''; try { cmd = fs.readFileSync(`/proc/${c}/cmdline`, 'utf8').split('\0').filter(Boolean); } catch(e){ cmd = ['?']; } console.log(' '.repeat(dep*2) + c, (cmd[0]||'').slice(-40), (cmd.find(a=> a.startsWith('--type='))||'')); walk(c, dep + 1); } };
walk(process.pid, 0);
await b.close();
