/* =========================================================
   XRD FIT CORE — pure numeric routines (no DOM).
   Shared by xrd.js (curve reconstruction) and the fit Web Worker.
========================================================= */

const CU_KA1 = 1.540598; // Å

const CU_KA2 = 1.544426; // Å

const KA2_RATIO = 0.5;   // Iα2 / Iα1

function nearestIdx(x, pos){
    if (!x || !x.length) return 0;
    const span = (x[x.length-1]-x[0]) || 1;
    const t = (pos-x[0])/span*(x.length-1);
    return Math.max(0, Math.min(x.length-1, Math.round(t)));
  }

function refineIdx(y, idx, win){
    let best = idx;
    const lo = Math.max(0, idx-win), hi = Math.min(y.length-1, idx+win);
    for (let j=lo; j<=hi; j++) if (y[j] > y[best]) best = j;
    return best;
  }

function pseudoVoigt(xi, x0, fwhm, eta){
    const t = (xi-x0)*(xi-x0) / (fwhm*fwhm);
    const g = Math.exp(-4*Math.LN2*t);
    const l = 1 / (1 + 4*t);
    return eta*l + (1-eta)*g;
  }

function ka2Delta(twoTheta){
    const th = (twoTheta/2)*Math.PI/180;
    return 2*((CU_KA2-CU_KA1)/CU_KA1)*Math.tan(th)*180/Math.PI;
  }

function doubletModel(par, xi){
    const A=par[0], x0=par[1], fw=par[2], eta=par[3], bg=par[4]||0, d=ka2Delta(x0);
    return A*(pseudoVoigt(xi,x0,fw,eta) + KA2_RATIO*pseudoVoigt(xi,x0+d,fw,eta)) + bg;
  }

function solveLinear(A, b){
    const n=b.length, M=A.map((r,i)=>r.concat(b[i]));
    for (let c=0;c<n;c++){
      let piv=c; for (let r=c+1;r<n;r++) if (Math.abs(M[r][c])>Math.abs(M[piv][c])) piv=r;
      if (Math.abs(M[piv][c])<1e-12) return null;
      [M[c],M[piv]]=[M[piv],M[c]];
      for (let r=0;r<n;r++){ if (r===c) continue; const f=M[r][c]/M[c][c]; for (let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; }
    }
    const z=new Array(n); for (let i=0;i<n;i++) z[i]=M[i][n]/M[i][i];
    return z;
  }

function lmRun(xs, ys, p0, step){
    let p=p0.slice();
    const resid = pp => xs.map((xi,k)=>doubletModel(pp,xi)-ys[k]);
    const cost  = r => r.reduce((s,v)=>s+v*v,0);
    let r=resid(p), c=cost(r), lambda=1e-3;
    for (let iter=0; iter<120; iter++){
      const m=p.length, pert=p.map(v=>Math.max(1e-6,Math.abs(v))*1e-4);
      const Jc=[];
      for (let j=0;j<m;j++){ const pp=p.slice(); pp[j]+=pert[j]; const rj=resid(pp); Jc.push(rj.map((v,k)=>(v-r[k])/pert[j])); }
      const JtJ=Array.from({length:m},()=>new Array(m).fill(0)), Jtr=new Array(m).fill(0);
      for (let a=0;a<m;a++){
        for (let b=0;b<m;b++){ let s=0; for (let k=0;k<r.length;k++) s+=Jc[a][k]*Jc[b][k]; JtJ[a][b]=s; }
        let s2=0; for (let k=0;k<r.length;k++) s2+=Jc[a][k]*r[k]; Jtr[a]=s2;
      }
      let stepTaken=false;
      for (let tries=0; tries<8; tries++){
        const Ad=JtJ.map((row,a)=>row.map((v,b)=> a===b ? v*(1+lambda) : v));
        const dp=solveLinear(Ad, Jtr.map(v=>-v));
        if (!dp || dp.some(v=>!isFinite(v))){ lambda*=10; continue; }
        let pn=p.map((v,j)=>v+dp[j]);
        pn[0]=Math.max(0,pn[0]); pn[2]=Math.max(step*0.5,pn[2]); pn[3]=Math.min(1,Math.max(0,pn[3]));
        const rn=resid(pn), cn=cost(rn);
        if (cn<c){ const rel=(c-cn)/(c||1); p=pn; r=rn; c=cn; lambda=Math.max(lambda*0.4,1e-10); stepTaken=true;
          if (rel<1e-7) iter=120; break; }
        lambda*=10;
      }
      if (!stepTaken) break;
    }
    return {p, cost:c};
  }

function fitDoublet(x, y, idx0, fwhmGuess){
    const idx = refineIdx(y, idx0, 3);
    const step = x.length>1 ? Math.abs((x[x.length-1]-x[0])/(x.length-1)) : 1;
    const guess = (isFinite(fwhmGuess) && fwhmGuess>0) ? fwhmGuess : Math.max(0.2, step*4);
    const hw = Math.max(guess*4, step*10);
    let lo=idx, hi=idx;
    while (lo>0 && x[idx]-x[lo] < hw) lo--;
    while (hi<x.length-1 && x[hi]-x[idx] < hw) hi++;
    const xs=x.slice(lo,hi+1), ys=y.slice(lo,hi+1);
    if (xs.length < 7) return null;
    const bg0 = Math.min(...ys);
    const amp0 = Math.max(1e-9, y[idx]-bg0);
    let best=null;
    for (const eta0 of [0.2, 0.5, 0.8]){
      const res = lmRun(xs, ys, [amp0, x[idx], guess, eta0, bg0], step);
      if (!best || res.cost < best.cost) best = res;
    }
    const p = best.p;
    if (p[1]<xs[0] || p[1]>xs[xs.length-1] || !isFinite(p[2]) || p[2]<=0) return null;
    // normalised RMS residual as a fit-quality indicator
    const rms = Math.sqrt(best.cost/xs.length) / (amp0||1);
    return {shape:'pv', amp:p[0], pos:p[1], fwhm:p[2], eta:p[3], bg:p[4], rms};
  }

function cdiv(ar,ai,br,bi){ const d=br*br+bi*bi; return [(ar*br+ai*bi)/d,(ai*br-ar*bi)/d]; }

function cef(x, y){
    const tr=y, ti=-x, s=Math.abs(x)+y;
    if (s>=15){
      const nr=0.5641896*tr, ni=0.5641896*ti, t2r=tr*tr-ti*ti, t2i=2*tr*ti;
      return cdiv(nr,ni,0.5+t2r,t2i);
    } else if (s>=5.5){
      const ur=tr*tr-ti*ti, ui=2*tr*ti, ar=1.410474+0.5641896*ur, ai=0.5641896*ui;
      const nr=tr*ar-ti*ai, ni=tr*ai+ti*ar, u2r=ur*ur-ui*ui, u2i=2*ur*ui;
      return cdiv(nr,ni,0.75+3*ur+u2r,3*ui+u2i);
    } else if (y>=0.195*Math.abs(x)-0.176){
      let Nr=0.5642236,Ni=0; const mac=c=>{ const r=Nr*tr-Ni*ti+c, i=Nr*ti+Ni*tr; Nr=r; Ni=i; };
      mac(3.778987); mac(11.96482); mac(20.20933); mac(16.4955);
      let Dr=1,Di=0; const mad=c=>{ const r=Dr*tr-Di*ti+c, i=Dr*ti+Di*tr; Dr=r; Di=i; };
      mad(6.699398); mad(21.69274); mad(39.27121); mad(38.82363); mad(16.4955);
      return cdiv(Nr,Ni,Dr,Di);
    } else {
      const ur=tr*tr-ti*ti, ui=2*tr*ti;
      let Pr=0.56419,Pi=0; const sp=c=>{ const mr=ur*Pr-ui*Pi, mi=ur*Pi+ui*Pr; Pr=c-mr; Pi=-mi; };
      sp(1.320522); sp(35.76683); sp(219.0313); sp(1540.787); sp(3321.9905); sp(36183.31);
      const nr=tr*Pr-ti*Pi, ni=tr*Pi+ti*Pr;
      let Qr=1,Qi=0; const sq=c=>{ const mr=ur*Qr-ui*Qi, mi=ur*Qi+ui*Qr; Qr=c-mr; Qi=-mi; };
      sq(1.841439); sq(61.57037); sq(364.2191); sq(2186.181); sq(9022.228); sq(24322.84); sq(32066.6);
      const e=Math.exp(ur), er=e*Math.cos(ui), ei=e*Math.sin(ui);
      const [qr,qi]=cdiv(nr,ni,Qr,Qi);
      return [er-qr, ei-qi];
    }
  }

const INV_SQRT_PI = 1/Math.sqrt(Math.PI);

function voigtVal(xi, x0, sigma, gamma){
    const a = sigma*Math.SQRT2; const u=(xi-x0)/a, v=gamma/a;
    return cef(u, v)[0];
  }

function voigtGrad(xi, x0, sigma, gamma){
    const a = sigma*Math.SQRT2; const u=(xi-x0)/a, v=gamma/a;
    const [wr, wi] = cef(u, v);
    const zw_r = u*wr - v*wi, zw_i = u*wi + v*wr;     // z·w
    const wpr = -2*zw_r;                               // Re w'
    const wpi = -2*zw_i + 2*INV_SQRT_PI;               // Im w'
    return {
      val: wr,
      dx0: -wpr/a,
      dgam: -wpi/a,
      dsig: -(Math.SQRT2/a)*(wpr*u - wpi*v)            // Re[w'·z]
    };
  }

function voigtFWHM(sigma, gamma){
    const fG = 2*sigma*Math.sqrt(2*Math.LN2), fL = 2*gamma;
    return 0.5346*fL + Math.sqrt(0.2166*fL*fL + fG*fG);
  }

function pvGrad(xi, x0, w, eta){
    const z=(xi-x0)/w, t=z*z, denom=1+4*t;
    const G=Math.exp(-4*Math.LN2*t), L=1/denom;
    return {
      val: eta*L + (1-eta)*G,
      dx0: eta*(8*z/(w*denom*denom)) + (1-eta)*(G*8*Math.LN2*z/w),
      dw:  eta*(8*t/(w*denom*denom)) + (1-eta)*(G*8*Math.LN2*t/w),
      deta: L - G
    };
  }

function baseGrad(profile, xi, c, p2, p3){
    if (profile==='voigt'){ const g=voigtGrad(xi,c,p2,p3); return {val:g.val,dx0:g.dx0,d2:g.dsig,d3:g.dgam}; }
    const g=pvGrad(xi,c,p2,p3); return {val:g.val,dx0:g.dx0,d2:g.dw,d3:g.deta};
  }

function baseVal(profile, xi, c, p2, p3){
    return profile==='voigt' ? voigtVal(xi,c,p2,p3) : pseudoVoigt(xi,c,p2,p3);
  }

function fcjOffsets(pos, SL, HL, nq){
    const emax = SL + HL;
    if (!(emax > 0)) return [{d:0,w:1}];
    const cosP = Math.cos(pos*Math.PI/180), plateau = Math.abs(SL-HL);
    const out=[]; let wsum=0;
    for (let q=0;q<nq;q++){
      const eps = emax*(q+0.5)/nq;
      let tw = eps<=plateau ? 1 : (emax-eps)/((emax-plateau)||1); if (tw<0) tw=0;
      const cE=Math.cos(eps); let arg=cosP/(cE*cE); if(arg>1)arg=1; if(arg<-1)arg=-1;
      out.push({d: Math.acos(arg)*180/Math.PI - pos, w:tw}); wsum+=tw;
    }
    if (wsum<=0) return [{d:0,w:1}];
    out.forEach(o=>o.w/=wsum);
    return out;
  }

function compGrad(profile, asym, xi, c, p2, p3, a){
    if (!asym || !asym.on){ const g=baseGrad(profile,xi,c,p2,p3); return {val:g.val,dc:g.dx0,d2:g.d2,d3:g.d3,da:0}; }
    if (asym.mode==='split'){
      const left = xi < c, s = Math.exp(left ? -a/2 : a/2), dsda = (left?-0.5:0.5)*s;
      const w2 = p2*s, w3 = profile==='voigt' ? p3*s : p3; // pV: η not scaled
      const g = baseGrad(profile, xi, c, w2, w3);
      const d3 = profile==='voigt' ? g.d3*s : g.d3;
      const da = profile==='voigt' ? (g.d2*p2 + g.d3*p3)*dsda : (g.d2*p2)*dsda;
      return {val:g.val, dc:g.dx0, d2:g.d2*s, d3, da};
    }
    // FCJ: convolve base profile (and its gradients) with the kernel
    const offs = fcjOffsets(c, asym.SL, asym.HL, asym.nq);
    let val=0,dc=0,d2=0,d3=0;
    for (const o of offs){ const g=baseGrad(profile, xi-o.d, c, p2, p3); val+=o.w*g.val; dc+=o.w*g.dx0; d2+=o.w*g.d2; d3+=o.w*g.d3; }
    return {val,dc,d2,d3,da:0};
  }

function compVal(fp, xi, c){
    const prof=fp.shape, p2=(prof==='voigt'?fp.sigma:fp.fwhm), p3=(prof==='voigt'?fp.gamma:fp.eta);
    if (!fp.asym){ return baseVal(prof,xi,c,p2,p3); }
    if (fp.asym==='split'){
      const left=xi<c, s=Math.exp(left?-fp.a/2:fp.a/2);
      return baseVal(prof, xi, c, p2*s, prof==='voigt'?p3*s:p3);
    }
    const offs=fcjOffsets(c, fp.SL, fp.HL, fp.nq||14); let v=0;
    for (const o of offs) v+=o.w*baseVal(prof, xi-o.d, c, p2, p3);
    return v;
  }

function polyfitPow(xs, yv, xc, xh, deg){
    const nb=deg+1, A=Array.from({length:nb},()=>new Array(nb).fill(0)), b=new Array(nb).fill(0);
    for (let i=0;i<xs.length;i++){
      const u=(xs[i]-xc)/xh; const pw=new Array(nb); let um=1; for(let m=0;m<nb;m++){pw[m]=um;um*=u;}
      for (let a=0;a<nb;a++){ b[a]+=pw[a]*yv[i]; for(let c=0;c<nb;c++) A[a][c]+=pw[a]*pw[c]; }
    }
    return solveLinear(A,b) || new Array(nb).fill(0);
  }

async function fitGlobal(x, y, active, snip, hp, onProgress){
    const N=active.length; if (!N) return null;
    const voigt = (hp.profile||'voigt')==='voigt', profile = voigt?'voigt':'pv';
    const asym = { on: !!hp.asym, mode: hp.asymMode||'split', SL: hp.SL, HL: hp.HL, nq: 14 };
    const split = asym.on && asym.mode==='split';
    // Standard-calibration mode: refine the FCJ geometry (S/L, H/L) as two global params
    const calib = asym.on && asym.mode==='fcj' && !!hp.calib;
    const pp_n = split ? 5 : 4;                       // params per peak
    const n=x.length, r=KA2_RATIO, K2=2*Math.sqrt(2*Math.LN2);
    const xc=(x[0]+x[n-1])/2, xh=((x[n-1]-x[0])/2)||1;

    // Stratified deterministic sampling: concentrate points near peaks, fill rest
    // uniformly. Using ALL points makes the FCJ standard fit ~35x slower (≈100 s on
    // a 2000-pt pattern) for negligible accuracy gain, so we decimate.
    const PK_PTS = 100, BG_PER_DEG = 10;
    const BG_TOTAL = Math.round(BG_PER_DEG * (x[n-1] - x[0]));
    const selected = new Uint8Array(n);
    if (hp._allPoints){
      selected.fill(1);                               // final refinement uses every point
    } else {
      for (const pk of active){
        const hw = 2 * Math.max(1e-3, pk.w0);         // ±2·FWHM half-window
        const lo = pk.x0 - hw, hi = pk.x0 + hw;
        selected[nearestIdx(x, pk.x0)] = 1;           // force the peak maximum
        const inWin = [];
        for (let i=0; i<n; i++) if (x[i]>=lo && x[i]<=hi) inWin.push(i);
        if (inWin.length <= PK_PTS){ inWin.forEach(i=>selected[i]=1); }
        else { const step=(inWin.length-1)/(PK_PTS-1); for (let q=0;q<PK_PTS;q++) selected[inWin[Math.round(q*step)]]=1; }
      }
      const already = selected.reduce((s,v)=>s+v, 0);
      const bgBudget = Math.max(0, BG_TOTAL - already);
      if (bgBudget > 0){ const stride=Math.max(1, Math.floor(n/bgBudget)); for (let i=0;i<n;i+=stride) selected[i]=1; }
    }
    const xs=[], ys=[], ws=[], us=[], snipS=[];
    for (let i=0; i<n; i++) if (selected[i]){
      xs.push(x[i]); ys.push(y[i]); ws.push(1/Math.max(y[i],1)); us.push((x[i]-xc)/xh); snipS.push(snip[i]||0);
    }
    // Calibration refines a SINGLE geometry param G = S/L = H/L (the two are
    // degenerate in this kernel; only their sum is identifiable).
    const deg=hp.bgDegree, nb=deg+1, idxG=pp_n*N+nb, P=idxG+(calib?1:0);
    const bgAnchor = Math.max(0, hp.bgAnchor||0); // soft SNIP-anchor strength (0 = off)
    const p=new Float64Array(P);
    const wScale = hp.wScale!==undefined ? hp.wScale : 1; // initial-width multi-start factor
    active.forEach((pk,k)=>{
      const w0=Math.max(1e-3, pk.w0)*wScale, b=pp_n*k;
      p[b]=Math.max(1e-6,pk.A0); p[b+1]=pk.x0;
      if (voigt){ const sf=hp.sigFrac!==undefined?hp.sigFrac:0.6, gf=hp.gamFrac!==undefined?hp.gamFrac:0.2;
                  p[b+2]=Math.max(1e-4, sf*w0/K2); p[b+3]=Math.max(0, gf*w0); }
      else      { p[b+2]=w0;                          p[b+3]=Math.min(1,Math.max(0,hp.etaInit!==undefined?hp.etaInit:0.5)); }
      if (split) p[b+4]=0;
    });
    const c0=polyfitPow(xs, snipS, xc, xh, deg);
    for (let m=0;m<nb;m++) p[pp_n*N+m]=c0[m]||0;
    if (calib){ p[idxG]=Math.max(1e-3, 0.5*((asym.SL||0.02)+(asym.HL||0.02))); }
    // Optional seed: start from a supplied parameter vector (used by the final all-points step)
    if (hp._seedP && hp._seedP.length===P) p.set(hp._seedP);
    const hFD=1e-4; // finite-difference step for the S/L, H/L gradients
    // Per-peak position bounds: stay within a few FWHM of the detected position,
    // and never leave the data range by more than a small margin (edge peaks may
    // be partly cut, but must not run off to absurd 2θ).
    const xLo=x[0], xHi=x[n-1], xMargin=Math.min(5, 0.1*(xHi-xLo));
    const posLo=new Float64Array(N), posHi=new Float64Array(N);
    active.forEach((pk,k)=>{ const win=Math.max(1, 4*Math.max(1e-3,pk.w0));
      posLo[k]=Math.max(xLo-xMargin, pk.x0-win); posHi[k]=Math.min(xHi+xMargin, pk.x0+win); });

    const JtJ=Array.from({length:P},()=>new Float64Array(P)), Jtr=new Float64Array(P), grad=new Float64Array(P);
    const isFCJ = asym.on && asym.mode==='fcj';
    // FCJ value+grad using a PREcomputed offset kernel (offsets depend only on the
    // peak centre and S/L,H/L, so they are constant across all data points).
    function fcjComp(offs, xi, c, p2, p3){
      let val=0,dc=0,d2=0,d3=0;
      for (let j=0;j<offs.length;j++){ const o=offs[j], g=baseGrad(profile, xi-o.d, c, p2, p3);
        val+=o.w*g.val; dc+=o.w*g.dx0; d2+=o.w*g.d2; d3+=o.w*g.d3; }
      return {val,dc,d2,d3};
    }
    // per-peak cached kernels (rebuilt each evalAll, when x0 or G may have changed)
    const kA=isFCJ?new Array(N):null, kB=isFCJ?new Array(N):null, kGA=calib?new Array(N):null, kGB=calib?new Array(N):null;
    function evalAll(pp, accum){
      let cost=0;
      if (calib){ const G=Math.max(1e-3,pp[idxG]); asym.SL=G; asym.HL=G; }
      if (isFCJ){
        for (let k=0;k<N;k++){ const x0=pp[pp_n*k+1], d=ka2Delta(x0);
          kA[k]=fcjOffsets(x0, asym.SL, asym.HL, asym.nq);
          kB[k]=fcjOffsets(x0+d, asym.SL, asym.HL, asym.nq);
          if (calib){ const Gp=asym.SL+hFD; kGA[k]=fcjOffsets(x0, Gp, Gp, asym.nq); kGB[k]=fcjOffsets(x0+d, Gp, Gp, asym.nq); }
        }
      }
      if (accum){ for(let a=0;a<P;a++){ JtJ[a].fill(0); } Jtr.fill(0); }
      for (let q=0;q<xs.length;q++){
        const xi=xs[q]; let m=0; if (accum) grad.fill(0);
        let gG=0;
        for (let k=0;k<N;k++){
          const b=pp_n*k, A=pp[b],x0=pp[b+1],p2=pp[b+2],p3=pp[b+3],a=split?pp[b+4]:0,d=ka2Delta(x0);
          const c1 = isFCJ ? fcjComp(kA[k],xi,x0,p2,p3) : compGrad(profile,asym,xi,x0,p2,p3,a);
          const c2 = isFCJ ? fcjComp(kB[k],xi,x0+d,p2,p3) : compGrad(profile,asym,xi,x0+d,p2,p3,a);
          const shape=c1.val+r*c2.val; m+=A*shape;
          if (accum){
            grad[b]=shape;
            grad[b+1]=A*(c1.dc+r*c2.dc);
            grad[b+2]=A*(c1.d2+r*c2.d2);
            grad[b+3]=A*(c1.d3+r*c2.d3);
            if (split) grad[b+4]=A*(c1.da+r*c2.da);
            if (calib){
              const sG=fcjComp(kGA[k],xi,x0,p2,p3).val + r*fcjComp(kGB[k],xi,x0+d,p2,p3).val;
              gG += A*(sG-shape)/hFD;
            }
          }
        }
        if (accum && calib){ grad[idxG]=gG; }
        let um=1, bgVal=0; for (let mm=0;mm<nb;mm++){ const t=pp[pp_n*N+mm]*um; m+=t; bgVal+=t; if(accum) grad[pp_n*N+mm]=um; um*=us[q]; }
        const res=m-ys[q], wq=ws[q]; cost+=wq*res*res;
        if (accum){ for (let a=0;a<P;a++){ const ga=grad[a]; if(ga===0) continue; Jtr[a]+=wq*ga*res; const gw=wq*ga, row=JtJ[a]; for(let bb=a;bb<P;bb++) row[bb]+=gw*grad[bb]; } }
        // Soft SNIP anchor: penalise the background straying from the SNIP estimate,
        // α·w·(bg−snip)². Only the background (polynomial) columns are involved.
        if (bgAnchor > 0){
          const rp = bgVal - snipS[q], wp = bgAnchor*wq; cost += wp*rp*rp;
          if (accum){
            const b0=pp_n*N;
            for (let a=b0;a<b0+nb;a++){ const ga=grad[a]; Jtr[a]+=wp*ga*rp; const gw=wp*ga, row=JtJ[a]; for(let bb=a;bb<b0+nb;bb++) row[bb]+=gw*grad[bb]; }
          }
        }
      }
      if (accum){ for(let a=0;a<P;a++) for(let bb=0;bb<a;bb++) JtJ[a][bb]=JtJ[bb][a]; }
      return cost;
    }
    let cost=evalAll(p,true), lambda=hp.lambda0, finalCost=cost;
    for (let iter=0; iter<hp.maxIter; iter++){
      let stepTaken=false;
      for (let tries=0; tries<8; tries++){
        const Ad=JtJ.map((row,a)=>{ const nr=Array.from(row); nr[a]*=(1+lambda); return nr; });
        const dp=solveLinear(Ad, Array.from(Jtr,v=>-v));
        if (!dp || dp.some(v=>!isFinite(v))){ lambda*=10; continue; }
        const pn=Float64Array.from(p); for(let a=0;a<P;a++) pn[a]+=dp[a];
        for (let k=0;k<N;k++){ const b=pp_n*k; pn[b]=Math.max(0,pn[b]); pn[b+1]=Math.max(posLo[k],Math.min(posHi[k],pn[b+1])); pn[b+2]=Math.max(1e-4,pn[b+2]); pn[b+3]=voigt?Math.max(0,pn[b+3]):Math.min(1,Math.max(0,pn[b+3])); if(split) pn[b+4]=Math.max(-3,Math.min(3,pn[b+4])); }
        if (calib){ pn[idxG]=Math.max(1e-3,Math.min(0.1,pn[idxG])); }
        const cn=evalAll(pn,false);
        if (cn<cost){ const rel=(cost-cn)/(cost||1); for(let a=0;a<P;a++) p[a]=pn[a]; cost=cn; finalCost=cn; lambda=Math.max(lambda*0.4,1e-12); stepTaken=true; evalAll(p,true); if(rel<hp.tol){iter=hp.maxIter;} break; }
        lambda*=10;
      }
      if (onProgress) onProgress((iter+1)/hp.maxIter);
      if ((iter & 3)===0) await new Promise(r=>setTimeout(r)); // yield so the progress bar repaints
      if (!stepTaken){ if (onProgress) onProgress(1); break; }  // converged → jump to 100%
    }
    if (calib){ const G=Math.max(1e-3,p[idxG]); asym.SL=G; asym.HL=G; }
    const coeffs=[]; for(let m=0;m<nb;m++) coeffs.push(p[pp_n*N+m]);
    const baseline=x.map(xv=>{ const u=(xv-xc)/xh; let um=1,s=0; for(let m=0;m<nb;m++){s+=coeffs[m]*um;um*=u;} return s; });
    const fits=active.map((pk,k)=>{ const b=pp_n*k, a2=p[b+2], a3=p[b+3], a=split?p[b+4]:0;
      const base = voigt ? {shape:'voigt', sigma:a2, gamma:a3, fwhm:voigtFWHM(a2,a3)}
                         : {shape:'pv',    fwhm:a2,  eta:a3};
      const fp = Object.assign({amp:p[b], pos:p[b+1]}, base);
      if (asym.on){ fp.asym=asym.mode; if (split){ fp.a=a; fp.fwhm=fp.fwhm*Math.cosh(a/2); } else { fp.SL=asym.SL; fp.HL=asym.HL; fp.nq=asym.nq; } }
      return fp; });
    if (fits.some(fp=>!isFinite(fp.fwhm)||fp.fwhm<=0||!isFinite(fp.pos))) return null;
    return {baseline, fits, cost:finalCost, calib: calib ? {SL:asym.SL, HL:asym.HL} : null, pRaw: Float64Array.from(p)};
  }

async function multiStartFit(x, y, active, snip, hp, onProgress){
    const voigt = (hp.profile||'voigt')==='voigt';

    // Shape starts: parameterised as (sigFrac, gamFrac) for voigt, etaInit for pV.
    // For voigt, sigFrac/gamFrac scale w₀ → different points on the FWHM iso-curve.
    const shapeStarts = voigt
      ? [{sigFrac:1.0, gamFrac:0.0}, {sigFrac:0.75, gamFrac:0.12}, {sigFrac:0.5, gamFrac:0.25},
         {sigFrac:0.25, gamFrac:0.38}, {sigFrac:0.0, gamFrac:0.5}]
      : [{etaInit:0.0}, {etaInit:0.25}, {etaInit:0.5}, {etaInit:0.75}, {etaInit:1.0}];

    // Width starts: initial peak width at 1..5 × the detected FWHM. In calibration
    // mode each of these runs already refines G from its start, so no separate G grid.
    const widthStarts = [{wScale:1},{wScale:2},{wScale:3},{wScale:4},{wScale:5}];

    const total = shapeStarts.length * widthStarts.length + 1; // +1 final all-points step
    let bestSeed = null, bestScore = Infinity, done = 0;

    // Cheap all-points score of a parameter vector: one forward evaluation, 0 LM steps.
    const scoreAllPoints = async (pRaw)=>{
      const r = await fitGlobal(x, y, active, snip, Object.assign({}, hp, {_seedP:pRaw, _allPoints:true, maxIter:0}), null);
      return r ? r.cost : Infinity;
    };

    for (const sc of shapeStarts){
      for (const wc of widthStarts){
        const hpTry = Object.assign({}, hp, sc, wc);
        const res = await fitGlobal(x, y, active, snip, hpTry, frac=>{
          if (onProgress) onProgress((done + frac) / total);
        });
        // Fix 1: rank candidates by cost on ALL points (the same objective the final
        // step optimises), not by the sub-sampled cost — otherwise the seed handed to
        // the final refinement is chosen against a different objective and the result
        // becomes start-dependent.
        if (res && res.pRaw){
          const s = await scoreAllPoints(res.pRaw);
          if (s < bestScore){ bestScore = s; bestSeed = res.pRaw; }
        }
        done++;
        if (onProgress) onProgress(done / total);
      }
    }
    // Final refinement: one fit on ALL points, seeded from the all-points-best candidate.
    let best = null;
    if (bestSeed){
      const hpFinal = Object.assign({}, hp, {_seedP: bestSeed, _allPoints: true,
        maxIter: Math.min(hp.maxIter||60, 40)});
      best = await fitGlobal(x, y, active, snip, hpFinal, frac=>{ if (onProgress) onProgress((done+frac)/total); });
    }
    if (onProgress) onProgress(1);
    return best;
  }

function reconstructFit(x, fps){
    const full = new Array(x.length).fill(0);
    const ka1  = new Array(x.length).fill(0);
    for (const fp of fps){
      if (!fp) continue;
      const d = ka2Delta(fp.pos);
      for (let j=0;j<x.length;j++){
        const k1 = fp.amp*compVal(fp, x[j], fp.pos);
        ka1[j]  += k1;
        full[j] += k1 + fp.amp*KA2_RATIO*compVal(fp, x[j], fp.pos+d);
      }
    }
    return {full, ka1};
  }

export {
  CU_KA1, CU_KA2, KA2_RATIO, INV_SQRT_PI, nearestIdx, refineIdx, pseudoVoigt, ka2Delta, doubletModel, solveLinear, lmRun, fitDoublet, cdiv, cef, voigtVal, voigtGrad, voigtFWHM, pvGrad, baseGrad, baseVal, fcjOffsets, compGrad, compVal, polyfitPow, fitGlobal, multiStartFit, reconstructFit
};
