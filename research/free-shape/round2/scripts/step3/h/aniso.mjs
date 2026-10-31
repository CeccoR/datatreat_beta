// the anisotropy's jackknife: A = ln(longest/thinnest) of the kept solid, sd over the drops ((G−1)/G); per flagged kept row
import { load, f } from './an3.mjs';
const FLAG = x=> x.st.zseg > 3.09 || x.st.zb1 > 3.09, ver = process.env.VER || 's12';
const A = d => { const fin = d.filter(Number.isFinite); if (fin.length < d.length) return Infinity; return Math.log(Math.max(...d)/Math.min(...d)); };
for (const x of load().filter(x=> x.st && x.kept && (FLAG(x) || process.env.ALL))){
  const a = A(x.r.solid.dims), dr = x.ck.jack.drops.filter(d=> d[ver]), G = x.ck.jack.G;
  let t = 0, inf = false; for (const d of dr){ const b = A(d[ver].dims); if (!Number.isFinite(b) || !Number.isFinite(a)){ if (b !== a) inf = true; continue; } t += (b - a)**2; }
  const sd = inf ? Infinity : Math.sqrt((G - 1)/G*t), mn = Math.min(...dr.map(d=> A(d[ver].dims)));
  console.log(x.row.id.padEnd(26), (x.ek + ' ' + f(x.es)).padEnd(15), (x.why || '-').padEnd(14), 'A', f(a), 'sd', f(sd), 'A/sd', f(a/sd, 1), 'min A over drops', f(mn), x.clean ? 'CLEAN' : '');
}
