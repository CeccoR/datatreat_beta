# v524 (N) against the frozen prototype re-run (Z) on the rows both have: outcomes, final χ² in the isotropic fit's χ²_ν, check flags, evaluations
import json,glob,os,math
def rd(p):
    o=json.load(open(p)); return o, next(r for r in o['records'] if r['method']=='today')
import sys
T=sys.argv[1] if len(sys.argv)>1 else 'N'
rows=sorted(os.path.basename(f)[:-5] for f in glob.glob('results/'+T+'/*.json') if os.path.exists('results/Z/'+os.path.basename(f)))
def out(r): return 'error' if r.get('error') else ('held' if r.get('held') else 'free') if r.get('kept') else ('early' if r.get('early') else 'rejected')
def flag(r):
    c=r.get('check') or (r.get('info') or {}).get('check'); return bool(c and c.get('flagged'))
same=0; d=[]; ev=[0,0]; rep=[0,0]; mn=[0,0]; fl=0; chg=[]; big=[]
for row in rows:
    oz,z=rd('results/Z/'+row+'.json'); on,n=rd('results/'+T+'/'+row+'.json')
    if out(z)==out(n): same+=1
    else: chg.append(f'{row} {out(z)}→{out(n)}')
    if flag(z)==flag(n): fl+=1
    nu=max(1,(oz.get('iso') or {}).get('chi2nu',1) or 1)
    if z.get('kept') and n.get('kept'):
        dd=(n['chi2']-z['chi2'])/nu; d.append(dd)
        if abs(dd)>1: big.append(f'{row} {dd:+.1f}')
    ev[0]+=z['search']['evals']; ev[1]+=n['search']['evals']
    rep[0]+=(z.get('report') or {}).get('evals') or 0; rep[1]+=(n.get('report') or {}).get('evals') or 0
    mn[0]+=(z.get('min') or {}).get('evals') or 0; mn[1]+=(n.get('min') or {}).get('evals') or 0
d.sort()
print(f'rows {len(rows)}; outcome same {same}; changed: {chg}; check flag same {fl}')
print(f'both kept {len(d)}: N−Z final χ² (iso χ²_ν): lower by >1 {sum(x<-1 for x in d)}, within ±1 {sum(abs(x)<=1 for x in d)}, higher by >1 {sum(x>1 for x in d)}; median {d[len(d)//2] if d else float("nan"):+.3f}')
print('  |Δ|>1:', ', '.join(big))
print(f'search evals Z {ev[0]} N {ev[1]} ({ev[1]/ev[0]:.3f}x); minima stage Z {mn[0]} N {mn[1]}; report Z {rep[0]} N {rep[1]} ({rep[1]/max(1,rep[0]):.3f}x)')
