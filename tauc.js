import { fmtNum, csvLine, downloadZip, setupDropzone, renderUnifiedFileList, linspace, movingAverage, gradientArr, maxArr, minArr, fitLinear, tinv, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, truncTiltLabel, barLabelFit, barPlotXPad, barChipYmax } from './utils.js';
import { Plot } from './plot.js';

/* =========================================================
   TAUC MODULE
========================================================= */
(function(){
  let files = []; // {name,label,wl[],FR[],hv[]}  (each on its own native axis)
  let currIndex=0;                    // the sample every analysis card shows
  let bestRegsAll = [];
  let resPlot0=null, resPlot1=null, resPlot3=null;   // reused summary-plot instances (created once)
  // How Eg is read off the Tauc plot, and which of the two the bar chart shows.
  const EG_METHODS = [
    { key: 'x', label: 'x-axis',   name: 'Eg (x-axis)',   color: '#3aa0ff' },
    { key: 'b', label: 'baseline', name: 'Eg (baseline)', color: '#ff7a59' },
  ];
  let egSel = EG_METHODS.map(m=>m.key);
  // The Urbach analysis is opt-in: off, none of it is computed, drawn or exported.
  let urbachOn = false;

  const clampN = v => Math.max(1, Math.round(v));
  const clampM = v => Math.max(2, Math.round(v));
  // Two-sided 99% confidence: the 99.5% quantile of Student's t, the factor every
  // error reported here (Eg, E_U) is multiplied by.
  const T_Q = 0.995;

  // Best linear fit inside [x1,x2]: slide an M-point window and pick the one that
  // minimises NRMSE/R², where NRMSE = RMSE / (max-min of the window's y). Normalising
  // by the y-range makes the criterion robust — it locks onto the steep linear edge
  // instead of a flat low-value stretch that merely has a small absolute RMSE.
  // `Ys` is the curve as analysed: already smoothed.
  function scanRegr(hv, Ys, M, x1, x2){
    const lo = Math.min(x1,x2), hi=Math.max(x1,x2);
    const idxSel = [];
    for (let i=0;i<hv.length;i++) if (hv[i]>=lo && hv[i]<=hi) idxSel.push(i);
    let best = {slope:NaN,intercept:NaN,R2:NaN,RMSE:Infinity,NRMSE:Infinity,bestIdx:[],varM:NaN,varB:NaN,covMB:NaN};
    if (idxSel.length < M) return best;
    let bestScore = Infinity;
    for (let s=0; s<=idxSel.length-M; s++){
      const block = idxSel.slice(s, s+M);
      const yb = block.map(i=>Ys[i]);
      if (yb.some(v=>!isFinite(v))) continue;
      const xb = block.map(i=>hv[i]);
      const r = fitLinear(xb, yb);
      const range = Math.max(...yb) - Math.min(...yb);
      const nrmse = range>0 ? r.rmse/range : Infinity;
      const score = nrmse / r.R2;
      if (score < bestScore){
        bestScore = score;
        best = {slope:r.slope, intercept:r.intercept, R2:r.R2, RMSE:r.rmse, NRMSE:nrmse, bestIdx:block, varM:r.varM, varB:r.varB, covMB:r.covMB};
      }
    }
    return best;
  }

  /* Eg from the two Tauc fits: where the Tauc line crosses the x-axis, and where it
     crosses the baseline. Each error is the fit's own (co)variances carried through
     the formula, every term scaled by the t factor of the fit it comes from. */
  function taucEg(regs, regs2, M, M2){
    let Eg=NaN, EgErr=NaN, EgInt=NaN, EgIntErr=NaN;
    if ([regs.slope,regs.intercept,regs2.slope,regs2.intercept].every(isFinite)){
      const xInt = (regs2.intercept - regs.intercept)/(regs.slope - regs2.slope);
      const dxdb1 = -1/(regs.slope-regs2.slope), dxdb2 = 1/(regs.slope-regs2.slope);
      const dxdm1 = (regs2.intercept-regs.intercept)/Math.pow(regs.slope-regs2.slope,2);
      const dxdm2 = -dxdm1;
      const t1 = tinv(T_Q, M-2), t2 = tinv(T_Q, M2-2);
      const varX = dxdb1*dxdb1*regs.varB*t1*t1 + dxdb2*dxdb2*regs2.varB*t2*t2 +
                   dxdm1*dxdm1*regs.varM*t1*t1 + dxdm2*dxdm2*regs2.varM*t2*t2 +
                   2*dxdb1*dxdm1*regs.covMB*t1*t1 + 2*dxdb2*dxdm2*regs2.covMB*t2*t2;
      EgInt = xInt;
      EgIntErr = varX>0 ? Math.sqrt(varX) : NaN;
    }
    if (regs.slope !== 0 && isFinite(regs.slope)){
      Eg = -regs.intercept/regs.slope;
      if ([regs.varM,regs.varB,regs.covMB].every(isFinite)){
        const varEg = (regs.intercept**2/regs.slope**4)*regs.varM + (1/regs.slope**2)*regs.varB - 2*(regs.intercept/regs.slope**3)*regs.covMB;
        EgErr = varEg>=0 ? Math.sqrt(varEg)*tinv(T_Q, M-2) : NaN;
      }
    }
    return {Eg,EgErr,EgInt,EgIntErr};
  }
  /* The Urbach energy is the inverse of the tail's slope in ln F(R) against hν, so
     its error is the slope's, σ_m/m², times the same t factor. */
  function urbachEu(regs, M){
    const m = regs.slope;
    if (!isFinite(m) || m === 0) return { Eu: NaN, EuErr: NaN };
    const err = isFinite(regs.varM) && regs.varM >= 0 ? Math.sqrt(regs.varM)/(m*m)*tinv(T_Q, M-2) : NaN;
    return { Eu: 1/m, EuErr: err };
  }
  const fmtE = (v, e, unit, k = 3, scale = 1)=> !isFinite(v) ? '-'
    : isFinite(e) ? `${(v*scale).toFixed(k)} ± ${(e*scale).toFixed(k)} ${unit}` : `${(v*scale).toFixed(k)} ${unit}`;

  // ---- Auto-suggested Tauc interval lines ----
  // Second-derivative method. The Tauc region is the span where Y'' is NON-zero (a
  // linear/constant background has zero curvature, so it cancels). The "zero zones"
  // are the flat pre-edge (low E) and post-edge (high E) regions, |Y''| < ε with
  // ε = 10%·max|Y''|. The outer 10% of the energy range on each side is skimmed off
  // first: the tails are where the spectrum is noisiest and the moving averages are
  // one-sided, so neither ε nor the bounds are taken from them. The region bounds are
  // found from each end of what is kept inward: the first start of a sustained run of
  // CONT points with |Y''| >= ε (interpolated).
  const SUGG_THRESH = 0.10;   // ε as a fraction of max|Y''|
  const SUGG_CONT   = 25;     // required consecutive points above ε
  const SUGG_TAIL   = 0.10;   // fraction of the energy range skimmed off each end
  function curvatureEdge(c, p){
    const hv = c.hv, n = hv.length;
    if (n < 7) return null;
    const d2  = movingAverage(gradientArr(c.dYs, hv), p.N2);      // Y''
    // energy-ascending order of indices, so we can scan by energy regardless of layout
    const ord = [...Array(n).keys()].sort((a,b)=>hv[a]-hv[b]);
    const eLo = hv[ord[0]], eHi = hv[ord[n-1]], cut = SUGG_TAIL * (eHi - eLo);
    let a = 0, b = n-1;                                           // kept span, energy order
    while (a < n && hv[ord[a]] < eLo + cut) a++;
    while (b >= 0 && hv[ord[b]] > eHi - cut) b--;
    if (b - a < 2) return null;
    const ax = j => Math.abs(d2[ord[j]]);
    let A = 0; for (let j=a;j<=b;j++) A = Math.max(A, ax(j));
    const eps = SUGG_THRESH * (A || 1);
    const cross = (j,k) => { const t=(ax(j)-eps)/((ax(j)-ax(k))||1); return hv[ord[j]] + t*(hv[ord[k]]-hv[ord[j]]); };
    const inR = j => j>=a && j<=b;
    // sustained run of CONT points (from j, stepping dir) all with |Y''| >= eps
    const runGE = (j,dir) => { for (let m=0;m<SUGG_CONT;m++){ const jj=j+dir*m; if (!inR(jj) || ax(jj)<eps) return false; } return true; };
    let v1=hv[ord[a]], v2=hv[ord[b]];
    for (let j=a;j<=b;j++){ if (runGE(j,+1)){ v1 = j>a?cross(j-1,j):hv[ord[j]]; break; } }
    for (let j=b;j>=a;j--){ if (runGE(j,-1)){ v2 = j<b?cross(j+1,j):hv[ord[j]]; break; } }
    return { v1, v2 };
  }

  /* =========================================================
     ANALYSIS PANEL
     One card: the current sample's curve against hν, the interval lines that pick
     the regions to fit, the parameters beside it and what the fits give. Built from
     one recipe for every kind of analysis — Tauc on [F(R)hν]^a with a Tauc region
     and a baseline, Urbach on ln F(R) with one region — which the spec passed in
     describes. Each card keeps its own parameters, lines and all/one mode; its
     elements are its prefix plus the same suffixes (taucSvg, taucUSvg, ...).
  ========================================================= */
  const FIELD = { a:'A', N:'N', N2:'N2', M:'M', M2:'M2' };
  const CLAMP = { a: v => v, N: clampN, N2: clampN, M: clampM, M2: clampM };
  function makePanel(spec){
    const { prefix, keys, windows } = spec;
    const $ = id => document.getElementById(prefix + id);
    const P = {
      // ---- all/one analysis mode (single toggle) ----
      // 'shared': every sample uses one common parameter set AND one common set of
      //           interval lines. 'per': each sample is fully independent — its own
      //           parameters and interval-line positions.
      mode: 'shared',
      shared: { ...spec.defaults },                   // common params (shared mode)
      sharedVlines: {},                               // common interval lines (shared mode)
      per: [],                                        // per sample: {params..., vlines:{v1..}}
      suggested: false,                               // lines placed by a suggestion yet
    };
    let plot = null;
    let vlines = {};          // active interval lines (points at the current sample's set)
    let dragging = false;     // true while an interval line is being dragged
    let throttle = null;

    // The curve and the derivatives the panel works from, for sample i.
    function curves(i, p){
      const hv = files[i].hv;
      const Yraw = files[i].FR.map((v,k)=> spec.curve(v, hv[k], p));
      const Ys  = movingAverage(Yraw, p.N);
      const dYs = movingAverage(gradientArr(Ys, hv), p.N2);        // Y'
      return { hv, Yraw, Ys, dYs };
    }

    // Resolve the effective params for a given file index
    P.params = i =>{
      const s = P.shared;
      const src = (P.mode==='per') ? (P.per[i] || {}) : s;
      const out = {};
      for (const k of keys) out[k] = CLAMP[k](src[k] ?? s[k]);
      return out;
    };
    const defaultVlinesFor = i =>{
      const hv = files[i].hv, lo = minArr(hv), d = maxArr(hv) - lo;
      return spec.defaultLines(lo, d);
    };
    // The interval-line set used for sample i (shared object, or the sample's own)
    P.vlinesFor = i =>{
      if (P.mode==='shared') return P.sharedVlines;
      let pp = P.per[i]; if (!pp) pp = P.per[i] = {};
      if (!pp.vlines || !isFinite(pp.vlines.v1)) pp.vlines = defaultVlinesFor(i);
      return pp.vlines;
    };
    // Every fit of sample k, and what the spec makes of them.
    P.analyze = k =>{
      const p = P.params(k), vl = P.vlinesFor(k), c = curves(k, p);
      const fits = windows.map(w=> scanRegr(c.hv, c.Ys, p[w.M], vl[w.lo], vl[w.hi]));
      return { ...spec.results(fits, p), fits };
    };

    // ---- Auto-suggested interval-line positions ----
    // Where the lines go is the spec's to say: `suggest` places them for one sample,
    // `combine` makes one set for every sample out of theirs (all mode). Either is
    // kept inside the energy range it applies to.
    const clampTo = (lo, hi)=> l =>{ const o = {}; for (const k in l) o[k] = Math.max(lo, Math.min(hi, l[k])); return o; };
    function suggestOne(i){
      const p = P.params(i), l = spec.suggest(i, p, ()=> curves(i, p));
      if (!l) return null;
      const hv = files[i].hv, n = hv.length;
      return clampTo(Math.min(hv[0], hv[n-1]), Math.max(hv[0], hv[n-1]))(l);
    }
    function suggestShared(){
      const ss = files.map((f,i)=>suggestOne(i)).filter(Boolean);
      if (!ss.length) return null;
      let lo=Infinity, hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,minArr(f.hv)); hi=Math.max(hi,maxArr(f.hv)); });
      return clampTo(lo, hi)(spec.combine(ss));
    }
    // Apply suggestions to the whole workspace: every sample, whatever the mode; the
    // mode only decides whether they share one set of lines or each keep its own.
    P.autoSuggestAll = ()=>{
      if (!files.length) return;
      P.suggested = true;
      if (P.mode==='per'){ files.forEach((f,i)=>{ const s=suggestOne(i); if (s){ if(!P.per[i]) P.per[i]={}; P.per[i].vlines = s; } }); }
      else { const s = suggestShared(); if (s) P.sharedVlines = s; }
    };

    // Read the input fields into the active store (shared, or the current sample)
    function readInputsToStore(){
      const vals = {};
      for (const k of keys){
        const raw = $(FIELD[k]).value;
        if (k === 'a'){ const v = parseFloat(raw); if (isFinite(v)) vals.a = v; }
        else vals[k] = CLAMP[k](+raw || 0);
      }
      if (P.mode==='shared') Object.assign(P.shared, vals);
      else { const pp = P.per[currIndex] || (P.per[currIndex]={}); Object.assign(pp, vals); }
    }
    // Push the current sample's stored params into the input fields
    P.writeStoreToInputs = ()=>{
      const p = P.params(currIndex);
      for (const k of keys) $(FIELD[k]).value = p[k];
      if ($('NExp')) $('NExp').textContent = p.a;
    };
    P.syncModeButton = ()=>{ const c = $('ModeAll'); if (c) c.textContent = P.mode==='shared' ? 'all' : 'one'; };

    P.initPlot = ()=>{
      plot = new Plot($('Svg'), {xlabel:'hν (eV)', ylabelSvg: spec.yLabel(P.params(currIndex)), xTickStep:0.5, noYTickLabels:true});
      plot.attachTools(plot.svg.closest('.plot-wrap'));
      if (!isFinite(P.sharedVlines.v1)){
        const [lo, hi] = unionHv();
        P.sharedVlines = spec.defaultLines(lo, hi - lo);
      }
      P.update();
    };
    P.hasPlot = ()=> !!plot;

    P.update = preserveView =>{
      if (!plot || !files.length) return;
      vlines = P.vlinesFor(currIndex);   // point at the current sample's interval lines
      const p = P.params(currIndex);
      const c = curves(currIndex, p), hv = c.hv;
      $('CurrentLabel').textContent = files[currIndex].label;
      $('Idx').textContent = (currIndex+1)+'/'+files.length;

      // The derivatives are drawn rescaled onto the curve's own span, from the floor
      // the curve is drawn from: zero for Tauc, its own minimum for a log.
      const yLo = spec.zeroFloor ? 0 : minArr(c.Ys), yHi = maxArr(c.Ys);
      const onSpan = (arr, lo, hi)=> arr.map(v=> (hi-lo)>0 ? yLo + (v-lo)/(hi-lo)*(yHi-yLo) : v);
      const dYs = onSpan(c.dYs, minArr(c.dYs), maxArr(c.dYs));

      // Capture current zoom so it can be kept across redraws (the full range
      // set below stays as the "home" reset target)
      const prev = (preserveView && isFinite(plot.xmin)) ? {xmin:plot.xmin, xmax:plot.xmax, ymin:plot.ymin, ymax:plot.ymax} : null;
      const rLo = spec.zeroFloor ? 0 : minArr(c.Yraw), rHi = maxArr(c.Yraw), pad = spec.zeroFloor ? 0 : 0.05*(rHi - rLo);
      plot.setRange(minArr(hv), maxArr(hv), rLo - pad, spec.zeroFloor ? rHi*1.05 : rHi + pad);
      if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
      plot.clearData();
      plot.ylabelSvg = spec.yLabel(p) + ' (a. u.)';
      plot.drawAxes();
      // Named for the figure composer: this plot has no legend, so without these the
      // traces would reach it as "Series 1..n". Keyed by role, not by sample: the plot
      // shows one sample at a time, and a trace keeps its looks from one to the next.
      const nm = files[currIndex].label;
      // The grey XRPD draws its raw pattern in: white vanished on the light theme and on
      // the white of every exported image.
      plot.line(hv, c.Yraw, '#6a7585', 1,   undefined, { label: `${nm} raw`, key: 'raw' });
      plot.line(hv, c.Ys,  '#3aa0ff', 1.4,  undefined, { label: `${nm} smoothed`, key: 'smoothed' });
      plot.line(hv, dYs, '#5fcf6a', 1,    undefined, { label: `${nm} derivative`, key: 'derivative' });

      const fits = [];
      let tooSmall = false;
      windows.forEach((w, wi)=>{
        const lo = Math.min(vlines[w.lo], vlines[w.hi]), hi = Math.max(vlines[w.lo], vlines[w.hi]);
        const sel = hv.filter(v=> v>=lo && v<=hi).length;
        const reg = sel >= p[w.M] ? scanRegr(hv, c.Ys, p[w.M], vlines[w.lo], vlines[w.hi]) : null;
        fits.push(reg);
        $(w.stats[0]).textContent = reg && isFinite(reg.NRMSE) ? reg.NRMSE.toFixed(4) : '-';
        $(w.stats[1]).textContent = reg && isFinite(reg.R2) ? reg.R2.toFixed(4) : '-';
        if (!reg){ tooSmall = true; return; }
        if (reg.bestIdx.length){
          const xb = reg.bestIdx.map(i=>hv[i]);
          plot.line(xb, xb.map(x=>reg.slope*x+reg.intercept), w.color, 2.2, undefined, { label: `${nm} ${w.name}`, key: w.key });
          const xExt = linspace(minArr(hv), maxArr(hv), 100);
          plot.line(xExt, xExt.map(x=>reg.slope*x+reg.intercept), w.color, 1, '5,4',
                    { label: `${nm} ${w.name}, extended`, key: w.key + ' line' });
        }
      });
      $('Alert').innerHTML = tooSmall ? '<div class="alert warn">⚠ Interval too small: too few points for the regression!</div>' : '';
      spec.show($, P.analyze(currIndex));
      if (spec.marks) spec.marks(currIndex).forEach(r=> plot.vline(r.x, r.color, false, null, null, r));

      // While dragging a line: live-update only the interactive plot (below); the
      // summary plots refresh once, on release. onDrag sets dragging, onRelease clears it.
      const onDrag = k => v=>{ vlines[k]=v; dragging=true; throttledUpdate(); };
      const onRelease = k => v=>{ vlines[k]=v; dragging=false; P.update(true); hist.commit(); };
      windows.forEach(w=>{
        plot.vline(vlines[w.lo], w.color, true, onDrag(w.lo), onRelease(w.lo));
        plot.vline(vlines[w.hi], w.color, true, onDrag(w.hi), onRelease(w.hi));
      });

      if (!dragging && spec.onSettled) spec.onSettled();   // skip the heavy summaries mid-drag
    };
    function throttledUpdate(){
      if (throttle) return;
      throttle = requestAnimationFrame(()=>{ throttle=null; P.update(true); });
    }

    // Per-sample slots follow the file list.
    P.removeAt = i => P.per.splice(i, 1);
    P.move = (from, to)=>{ const [x] = P.per.splice(from, 1); P.per.splice(to, 0, x); };
    P.add = ()=> P.per.push({});
    P.clear = ()=>{ P.per = []; P.sharedVlines = {}; };
    P.fit = ()=>{ if (P.per.length !== files.length) P.per = files.map((_,i)=> P.per[i] || {}); };

    const clonePer = p => ({...p, vlines: p && p.vlines ? {...p.vlines} : undefined});
    P.snapshot = ()=>({ mode: P.mode, shared: {...P.shared}, sharedVlines: {...P.sharedVlines}, per: P.per.map(clonePer), suggested: P.suggested });
    P.restore = s =>{
      P.mode = (typeof s.mode==='string') ? s.mode : 'shared';   // older snapshots stored a per-field object
      P.shared = { ...spec.defaults, ...(s.shared || {}) };
      P.sharedVlines = s.sharedVlines ? {...s.sharedVlines} : (s.vlines ? {...s.vlines} : {});
      P.per = s.per ? s.per.map(clonePer) : files.map(()=>({}));
      // Snapshots from before the flag had their lines suggested whenever they had any.
      P.suggested = s.suggested != null ? !!s.suggested : isFinite((s.sharedVlines || s.vlines || {}).v1);
      // Backward compatibility with pre-all/one snapshots (params stored by input id)
      if (s.params){
        for (const k of keys){ const v = s.params[prefix + FIELD[k]]; if (v != null) P.shared[k] = k === 'a' ? parseFloat(v) : +v; }
      }
      P.fit();
      P.syncModeButton();
    };

    // Param updates apply on confirm (blur / Enter), not while typing. The exponent is
    // a <select>, so its change already is a deliberate choice; the numeric fields are
    // guarded (invalid input shakes + reverts) by guardNumberInputs, and their change
    // fires only once a valid value is committed. Changing the exponent rescales the
    // y-axis, so it does a full reset; the smoothing/window fields keep the zoom.
    keys.forEach(k=>{
      const el = $(FIELD[k]);
      el.addEventListener('change', ()=>{
        readInputsToStore();  // route the edit to shared or this sample's slot
        if (k === 'a' && $('NExp')) $('NExp').textContent = el.value;
        if (plot) P.update(k !== 'a');
        if (files.length) hist.commit();
      });
    });

    // Single all/one toggle: 'all' = one common param set + shared interval lines;
    // 'one' = every sample fully independent (params AND interval-line positions).
    $('ModeAll').addEventListener('click', ()=>{
      const mode = P.mode==='shared' ? 'per' : 'shared';
      P.mode = mode;
      if (mode==='per'){
        // Each sample becomes independent: params inherit the current shared values,
        // interval lines are re-proposed per sample.
        files.forEach((f,i)=>{
          const pp = P.per[i] || (P.per[i]={});
          keys.forEach(k=>{ if (pp[k]==null) pp[k]=P.shared[k]; });
          pp.vlines = suggestOne(i) || pp.vlines || defaultVlinesFor(i);
        });
      } else {
        // Back to a single shared set: re-propose the common lines.
        const s = suggestShared();
        if (s) P.sharedVlines = s;
      }
      P.syncModeButton();
      P.writeStoreToInputs();
      if (files.length){ if (plot) P.update(); hist.commit(); }
    });

    $('Prev').onclick = ()=>{ if (files.length) showSample((currIndex-1+files.length)%files.length); };
    $('Next').onclick = ()=>{ if (files.length) showSample((currIndex+1)%files.length); };

    // Re-propose interval-line positions on demand, for every sample.
    $('Suggest').onclick = ()=>{
      if (!files.length) return;
      P.autoSuggestAll();
      P.update(); hist.commit();
    };
    return P;
  }

  const sup = v => `<tspan baseline-shift="super" font-size="8">${v}</tspan>`;
  const URBACH_COLOR = '#ff7f0e';
  const TAUC_COLORS = { regs: '#ff5050', regs2: '#d050ff' };
  const tauc = makePanel({
    prefix: 'tauc',
    keys: ['a','N','N2','M','M2'],
    defaults: { a:0.5, N:1, N2:20, M:25, M2:100 },
    curve: (fr, hv, p)=> Math.pow(fr*hv, p.a),
    yLabel: p => `[F(R)·hν]${sup(p.a)}`,
    zeroFloor: true,
    windows: [
      { lo:'v1', hi:'v2', M:'M',  color: TAUC_COLORS.regs,  name:'Tauc region', key:'regs',  stats:['RMSE1','R21'] },
      { lo:'v3', hi:'v4', M:'M2', color: TAUC_COLORS.regs2, name:'baseline',    key:'regs2', stats:['RMSE2','R22'] },
    ],
    defaultLines: (lo, d)=> ({ v1: lo+0.6*d, v2: lo+0.8*d, v3: lo+0.2*d, v4: lo+0.4*d }),
    // Real bars use the OUTSIDE bounds (the whole non-zero-curvature span); the
    // baseline is placed just below where the edge starts.
    suggest: (i, p, curves)=>{ const e = curvatureEdge(curves(), p); return e && { v1: e.v1, v2: e.v2, v3: e.v1-0.85, v4: e.v1-0.1 }; },
    // Linear region [min(v1), max(v2)] over all samples, so every sample's edge lies
    // inside it (the window scan then finds each one's linear part); baseline computed
    // once from min(v1), below every edge.
    combine: ss =>{ const v1 = Math.min(...ss.map(s=>s.v1)), v2 = Math.max(...ss.map(s=>s.v2)); return { v1, v2, v3: v1-0.85, v4: v1-0.1 }; },
    results: (f, p)=> ({ ...taucEg(f[0], f[1], p.M, p.M2), regs: f[0], regs2: f[1] }),
    show: ($, r)=>{ $('Eg').textContent = fmtE(r.Eg, r.EgErr, 'eV'); $('EgInt').textContent = fmtE(r.EgInt, r.EgIntErr, 'eV'); },
    // The Urbach card marks this card's E_g, so it follows every settled change here.
    onSettled: ()=>{ updateTaucResults(); if (urbachOn && urbach.hasPlot()) urbach.update(true); },
  });
  const urbach = makePanel({
    prefix: 'taucU',
    keys: ['N','N2','M'],
    defaults: { N:1, N2:20, M:25 },
    curve: fr => fr > 0 ? Math.log(fr) : NaN,
    yLabel: ()=> 'ln[F(R)]',
    zeroFloor: false,
    windows: [
      { lo:'v1', hi:'v2', M:'M', color: URBACH_COLOR, name:'Urbach region', key:'regs', stats:['RMSE1','R21'] },
    ],
    defaultLines: (lo, d)=> ({ v1: lo+0.4*d, v2: lo+0.6*d }),
    /* The tail lies just below the gap, so the region is the eV under the Tauc
       analysis' own E_g (x-axis) for the sample; in all mode, under the lowest
       of them, so that it stays below every sample's gap. */
    suggest: i =>{ const eg = tauc.analyze(i).Eg; return isFinite(eg) ? { v1: eg - 1, v2: eg } : null; },
    combine: ss =>{ const v2 = Math.min(...ss.map(s=>s.v2)); return { v1: v2 - 1, v2 }; },
    results: (f, p)=> ({ ...urbachEu(f[0], p.M), regs: f[0] }),
    show: ($, r)=>{ $('Eu').textContent = fmtE(r.Eu, r.EuErr, 'meV', 1, 1000); },
    onSettled: ()=> renderUrbachRes(),
    // The sample's two Tauc gaps, dashed in the colours of the Tauc fits they come
    // from, so the tail can be read against where the gap is. Each label goes on the
    // outer side of the pair, as the two usually sit a few pixels apart.
    marks: i =>{
      const r = tauc.analyze(i), sub = '<tspan baseline-shift="sub" font-size="7">g</tspan>';
      const m = [{ v: r.Eg,    color: TAUC_COLORS.regs,  name: 'x-axis' },
                 { v: r.EgInt, color: TAUC_COLORS.regs2, name: 'baseline' }].filter(e=> isFinite(e.v));
      const lo = Math.min(...m.map(e=> e.v));
      return m.map(e=> ({ x: e.v, color: e.color, dash: '5,4', width: 1.2, side: e.v === lo && m.length > 1 ? -1 : 1,
        label: `E${sub} (${e.name}) = ${e.v.toFixed(3)} eV` }));
    },
  });
  const panels = [tauc, urbach];
  // The cards being worked in: the Urbach one only while its analysis is on.
  const livePanels = ()=> urbachOn ? panels : [tauc];
  // The Tauc parts of the Results and their CSVs come from the Tauc analysis.
  const getFileParams = i => tauc.params(i);

  // Every card shows the same sample, so stepping in one steps them all.
  function showSample(k){
    currIndex = k;
    livePanels().forEach(p=>{ p.writeStoreToInputs(); p.update(); });
  }

  // The Urbach card's switch, and what of the analysis hangs on it: the card's
  // workspace and its row of the Results.
  function syncUrbach(){
    const box = document.getElementById('taucUOn');
    document.getElementById('taucUrbach').classList.toggle('is-off', !urbachOn);
    box.checked = urbachOn;
    box.closest('label').title = `Switch the Urbach analysis ${urbachOn ? 'off' : 'on'}`;
    document.getElementById('taucResUrbach').style.display = urbachOn ? '' : 'none';
  }
  document.getElementById('taucUOn').addEventListener('change', e=>{
    urbachOn = e.target.checked;
    syncUrbach();
    if (urbachOn && files.length){
      // The first time on, its lines come from the gaps the Tauc card gives now.
      if (!urbach.suggested) urbach.autoSuggestAll();
      urbach.writeStoreToInputs();
      urbach.syncModeButton();
      // Out of the layout while off, so sized afresh; its settling draws its Results row.
      urbach.initPlot();
    }
    hist.commit();
  });

  // per-upload invalid names (files that were skipped); persists until all files are removed
  let invalidUploadNames = [];
  let taucUploadAlerts = '';
  let taucWarnDismissed = false;

  // Delegated click handling for dynamically generated alert dismiss buttons.
  document.getElementById('tab-tauc').addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if (!btn || !document.getElementById('tab-tauc').contains(btn)) return;
    switch (btn.dataset.action){
      case 'tauc-dismiss-invalid': invalidUploadNames=[]; rebuildTaucAlerts(); break;
      case 'tauc-dismiss-warn':    taucWarnDismissed=true; rebuildTaucAlerts(); break;
      case 'tauc-dismiss-upload':  taucUploadAlerts=''; rebuildTaucAlerts(); break;
    }
  });

  function rebuildTaucAlerts(){
    const warnNames = taucWarnDismissed ? [] : files.filter(f=>f.warn).map(f=>f.name);
    document.getElementById('taucAlerts').innerHTML =
      buildAlertsHtml(invalidUploadNames, warnNames, undefined, 'tauc-dismiss-invalid', 'tauc-dismiss-warn') + taucUploadAlerts;
  }

  function fileCallbacks(){
    return {
      onRemove(i){
        files.splice(i,1);
        panels.forEach(p=> p.removeAt(i));   // keep per-sample params aligned with files
        if (!files.length) invalidUploadNames = [];
        rebuildTaucAlerts();
        afterFilesChange();
      },
      onReorder(from, to){ const [x]=files.splice(from,1); files.splice(to,0,x); panels.forEach(p=> p.move(from, to)); rebuildTaucAlerts(); afterFilesChange(); },
      onLabelChange(i, v){ files[i].label=v; updateTaucResults(); hist.commit(); },
      onColorChange(i, v){ files[i].color=v; updateTaucResults(); hist.commit(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ files.length=0; panels.forEach(p=> p.clear()); invalidUploadNames=[]; taucUploadAlerts=''; taucWarnDismissed=false; rebuildTaucAlerts(); afterFilesChange(); },
    };
  }

  /* ---- Undo/redo: snapshot the reversible state (file order/labels/colors, the
     draggable line positions and the parameters of every analysis card). Raw spectra
     arrays are shared by reference; only metadata is cloned. The Tauc analysis keeps
     the top-level keys it always had, so older snapshots still restore into it. ---- */
  function taucSnapshot(){
    return {
      files: files.map(f=>({...f})),
      ...tauc.snapshot(),
      urbach: urbach.snapshot(),
      urbachOn,
      egSel: egSel.slice(),
    };
  }
  function taucRestore(s){
    files = s.files.map(f=>({...f}));
    tauc.restore(s);
    // Projects from before the Urbach card existed get its defaults; their lines are
    // suggested when the analysis is first switched on, as for a new project.
    urbach.restore(s.urbach || {});
    urbachOn = s.urbachOn === true;
    // Older snapshots had two charts and no choice: both methods on show.
    const eg = Array.isArray(s.egSel) ? s.egSel.filter(k=> EG_METHODS.some(m=>m.key===k)) : [];
    egSel = eg.length ? eg : EG_METHODS.map(m=>m.key);
    afterFilesChange();
    // Rebuild alerts for THIS tab's files: transient upload feedback (invalid /
    // already-loaded) belongs to the upload action, not the project, so clear it;
    // the non-standard-format warning is re-derived from the restored files' .warn
    // flags. Without this a restored/switched tab shows no alerts (or inherits the
    // previous tab's).
    invalidUploadNames = []; taucUploadAlerts = ''; taucWarnDismissed = false;
    rebuildTaucAlerts();
  }
  const hist = registerHistory('tauc', taucSnapshot, taucRestore);
  // Redraw on tab-visible/resize: re-fit at the current size, keeping the zoom.
  registerTabRedraw('tauc', ()=>{ if (files.length) livePanels().forEach(p=>{ if (p.hasPlot()) p.update(true); }); });

  setupDropzone('taucDropzone', 'taucFiles', async (fileList)=>{
    const hadFiles = files.length > 0;   // auto-suggest only on the first upload
    const existing = new Set(files.map(f=>f.name));
    const newInvalid = [];
    const alreadyLoaded = [];
    for (const f of fileList){
      if (existing.has(f.name)){ alreadyLoaded.push(f.name); continue; }
      existing.add(f.name);
      // f.text() auto-detects encoding (incl. UTF-16 via BOM); rawBytes keeps the
      // original bytes for byte-exact re-download.
      const rawBytes = new Uint8Array(await f.arrayBuffer());
      const text = await f.text();
      const rawLines = text.split(/\r?\n/).filter(l=>l.trim().length);
      if (!rawLines.length){ newInvalid.push(f.name); continue; }

      // Detect delimiter
      const sample = rawLines[0] + (rawLines[1]||'');
      const delim = sample.includes(';') ? ';' : sample.includes('\t') ? '\t' : ',';

      // Validate: all data rows must have exactly 2 non-empty columns
      let tooManyColumns = false, parsedCount = 0;
      for (const line of rawLines){
        const parts = line.split(delim).map(s=>s.trim());
        const nonEmpty = parts.filter(s=>s!=='');
        const a = parseFloat(nonEmpty[0]||''), b = parseFloat((nonEmpty[1]||'').replace(',','.'));
        if (isFinite(a) && isFinite(b)){
          parsedCount++;
          if (nonEmpty.length > 2){ tooManyColumns = true; break; }
        }
      }
      if (tooManyColumns || parsedCount === 0){ newInvalid.push(f.name); continue; }

      // Check standard header on second line
      const hp = (rawLines[1]||'').split(delim).map(s=>s.trim());
      const warn = !(hp.length >= 2 && /wavelength.*nm/i.test(hp[0]) && /f\s*\(r\)/i.test(hp[1]));

      // Parse data
      let wl=[], fr=[];
      for (const line of rawLines){
        const parts = line.split(delim).map(s=>s.trim());
        if (parts.length<2) continue;
        const a = parseFloat(parts[0].replace(',','.'));
        const b = parseFloat(parts[1].replace(',','.'));
        if (isFinite(a) && isFinite(b)){ wl.push(a); fr.push(b); }
      }
      if (wl.length){ files.push({name:f.name, label:f.name.replace(/\.[^.]+$/,''), wl, FR:fr, warn, color:nextColor(files), rawBytes}); panels.forEach(p=> p.add()); }
    }
    invalidUploadNames = newInvalid;
    taucWarnDismissed = false;
    taucUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'tauc-dismiss-upload') : '';
    rebuildTaucAlerts();
    afterFilesChange();
    // Once, when the first data lands: propose optimal interval-line positions.
    if (!hadFiles && files.length){ livePanels().forEach(p=>{ p.autoSuggestAll(); p.writeStoreToInputs(); p.update(); }); hist.commit(); }
  });

  const CARDS = ['taucWorkspace','taucUrbach','taucResults'];
  function afterFilesChange(){
    setTabLoaded('tauc', files.length);
    renderUnifiedFileList('taucFileTableWrap', files, fileCallbacks());
    if (files.length) setupAnalysis();
    else CARDS.forEach(id=> document.getElementById(id).style.display='none');
    hist.commit(); // baseline + file add/remove/reorder/palette
  }

  // Energy axis is just 1240/λ — each file stays on its own native grid
  function setupAnalysis(){
    files.forEach(f=>{ f.hv = f.wl.map(wl=>1240/wl); });
    if (currIndex >= files.length) currIndex = files.length-1;
    bestRegsAll = files.map(()=>null);
    if (currIndex < 0) currIndex = 0;
    CARDS.forEach(id=> document.getElementById(id).style.display='block');
    panels.forEach(p=>{
      p.fit();
      p.writeStoreToInputs();      // reflect the current sample's params in the inputs
      p.syncModeButton();
    });
    syncUrbach();
    // Urbach first, so the Tauc card's settling redraw of the Results is the last word.
    if (urbachOn) urbach.initPlot();
    tauc.initPlot();
  }

  // Union of all files' ranges (for shared overlay axes)
  function unionWl(){ let lo=Infinity,hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,minArr(f.wl)); hi=Math.max(hi,maxArr(f.wl)); }); return [lo,hi]; }
  function unionHv(){ let lo=Infinity,hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,minArr(f.hv)); hi=Math.max(hi,maxArr(f.hv)); }); return [lo,hi]; }

  function processAll(){
    bestRegsAll = files.map((f,k)=>{ const r = tauc.analyze(k); return {label:f.label, ...r}; });
  }

  function updateTaucResults(){
    if (!files.length) return;
    processAll();
    renderResView();
  }

  function renderResView(){
    // Effective exponent per file; when uniform, show it on the shared Tauc axis,
    // otherwise fall back to a generic "a" (samples may use different exponents).
    const aVals = files.map((f,k)=>getFileParams(k).a);
    const aUniform = aVals.every(v=>v===aVals[0]);
    const aLabel = aUniform ? aVals[0] : 'a';
    // Plot 0: F(R) vs λ — reuse one Plot instance (create + attach tools once).
    if (!resPlot0){
      resPlot0 = new Plot(document.getElementById('taucResSvg0'), {xlabel:'Wavelength (nm)', ylabel:'F(R) (a. u.)', xTickStep:50, noYTickLabels:true});
      resPlot0.attachTools(resPlot0.svg.closest('.plot-wrap'));
    }
    const plot0 = resPlot0; plot0.clearData();
    const leg0 = document.getElementById('taucResLegend0'); leg0.innerHTML='';
    let ymax0=-Infinity;
    files.forEach((f,k)=>{ ymax0=Math.max(ymax0,maxArr(f.FR)); });
    const [wl0, wl1] = unionWl();
    plot0.setRange(wl0, wl1, 0, ymax0);
    plot0.drawAxes();
    files.forEach((f,k)=>{
      plot0.line(f.wl, f.FR, f.color, 1.3, undefined, { label: f.label, key: f.name });
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${f.color}"></i>${f.label}`; leg0.appendChild(s);
    });

    // Plot 1: Tauc + regressions — reused instance; its y-label depends on the exponent.
    if (!resPlot1){
      resPlot1 = new Plot(document.getElementById('taucResSvg1'), {xlabel:'Energy (eV)', xTickStep:0.5, noYTickLabels:true});
      resPlot1.attachTools(resPlot1.svg.closest('.plot-wrap'));
    }
    const plot1 = resPlot1; plot1.clearData();
    plot1.ylabelSvg = `[F(R)·hν]<tspan baseline-shift="super" font-size="8">${aLabel}</tspan> (a. u.)`;
    const leg1 = document.getElementById('taucResLegend1'); leg1.innerHTML='';
    const Ys_all = files.map((f,k)=>{
      const fp = getFileParams(k);
      const Yraw = f.FR.map((v,i)=>Math.pow(v*f.hv[i], fp.a));
      return movingAverage(Yraw, fp.N);
    });
    const ymax1 = Math.max(...Ys_all.map(maxArr));
    const [hv0, hv1] = unionHv();
    plot1.setRange(hv0, hv1, 0, ymax1);
    plot1.drawAxes();
    files.forEach((f,k)=>{
      plot1.line(f.hv, Ys_all[k], f.color, 1.1, undefined, { label: f.label, key: f.name });
      const r = bestRegsAll[k];
      // regs fits the steep edge between the red lines (the Tauc region: its x-axis
      // intercept is Eg), regs2 the flat stretch between the magenta ones (the
      // baseline: where the two cross is Eg from the baseline).
      if (r && isFinite(r.regs.slope)){
        const xExt = linspace(hv0, hv1, 100);
        plot1.line(xExt, xExt.map(x=>r.regs.slope*x+r.regs.intercept), f.color, 1, '5,4',
                   { label: `${f.label} Tauc`, key: `${f.name}/regs line` });
      }
      if (r && isFinite(r.regs2.slope)){
        const xExt = linspace(hv0, hv1, 100);
        plot1.line(xExt, xExt.map(x=>r.regs2.slope*x+r.regs2.intercept), f.color, 1, '2,3',
                   { label: `${f.label} baseline`, key: `${f.name}/regs2 line` });
      }
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${f.color}"></i>${f.label}`; leg1.appendChild(s);
    });

    // Plot 2: Eg bar chart. With mixed exponents (per-sample mode) there is no single
    // Direct/Indirect qualifier, so drop it from the title and axis label.
    const egLabel = aUniform ? (aVals[0]===2 ? 'Direct' : 'Indirect') : '';
    const barTitleEl = document.getElementById('taucBarTitle');
    if (barTitleEl) barTitleEl.textContent = (egLabel ? egLabel+' ' : '') + 'Energy Band Gap';
    const leg2 = document.getElementById('taucResLegend2'); leg2.innerHTML='';
    renderEgSel();
    const vals = { x: bestRegsAll.map(r=>r.Eg),    b: bestRegsAll.map(r=>r.EgInt) };
    const errs = { x: bestRegsAll.map(r=>r.EgErr), b: bestRegsAll.map(r=>r.EgIntErr) };
    const shown = EG_METHODS.filter(m=> egSel.includes(m.key)).map(m=> ({ ...m, vals: vals[m.key], errs: errs[m.key] }));
    document.getElementById('taucBarAlert').innerHTML = shown.map(m=> negWarnHtml(m.vals, `E<sub>g</sub> (${m.label})`)).join('');
    const yLabel = `${egLabel ? egLabel+' ' : ''}Band Gap E<tspan baseline-shift="sub" font-size="8">g</tspan> (eV)`;
    if (drawValueBars(document.getElementById('taucResSvg2'), shown, { chips: document.getElementById('taucEgSel'), yLabel, digits: 3 }))
      leg2.innerHTML = shown.map(m=> `<span><i class="mk-box" style="background:${m.color}"></i>${m.name}</span>`).join('');

    renderUrbachRes();
  }

  // The Urbach row of the Results: every sample's ln F(R) with its Urbach fit, drawn
  // as the Tauc plot is, and E_U beside it as the gaps are.
  function renderUrbachRes(){
    if (!files.length || !urbachOn) return;
    const fits = files.map((f,k)=> urbach.analyze(k));
    if (!resPlot3){
      resPlot3 = new Plot(document.getElementById('taucResSvg3'), {xlabel:'Energy (eV)', ylabelSvg:'ln[F(R)] (a. u.)', xTickStep:0.5, noYTickLabels:true});
      resPlot3.attachTools(resPlot3.svg.closest('.plot-wrap'));
    }
    const plot3 = resPlot3; plot3.clearData();
    const leg3 = document.getElementById('taucResLegend3'); leg3.innerHTML='';
    const Ys = files.map((f,k)=> movingAverage(f.FR.map(v=> v > 0 ? Math.log(v) : NaN), urbach.params(k).N));
    const yLo = Math.min(...Ys.map(minArr)), yHi = Math.max(...Ys.map(maxArr)), pad = 0.05*(yHi - yLo);
    const [hv0, hv1] = unionHv();
    plot3.setRange(hv0, hv1, yLo - pad, yHi + pad);
    plot3.drawAxes();
    files.forEach((f,k)=>{
      plot3.line(f.hv, Ys[k], f.color, 1.1, undefined, { label: f.label, key: f.name });
      const r = fits[k].regs;
      if (isFinite(r.slope)){
        const xExt = linspace(hv0, hv1, 100);
        plot3.line(xExt, xExt.map(x=>r.slope*x+r.intercept), f.color, 1, '5,4',
                   { label: `${f.label} Urbach`, key: `${f.name}/regs line` });
      }
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${f.color}"></i>${f.label}`; leg3.appendChild(s);
    });

    // Plot 4: E_U bar chart, in meV as the Urbach card shows it.
    const leg4 = document.getElementById('taucResLegend4'); leg4.innerHTML='';
    const eu = { key: 'u', name: 'Eu', color: URBACH_COLOR, vals: fits.map(r=> r.Eu*1000), errs: fits.map(r=> r.EuErr*1000) };
    document.getElementById('taucEuAlert').innerHTML = negWarnHtml(eu.vals, 'E<sub>U</sub>');
    const yLabel = 'Urbach Energy E<tspan baseline-shift="sub" font-size="8">U</tspan> (meV)';
    if (drawValueBars(document.getElementById('taucResSvg4'), [eu], { yLabel, digits: 1 }))
      leg4.innerHTML = `<span><i class="mk-box" style="background:${eu.color}"></i>E<sub>U</sub></span>`;
  }

  // Negative values → one alert per series on show, under its chart, listing the
  // affected samples one per line. Live-computed → no X.
  function negWarnHtml(vals, what){
    const list = files.filter((f,k)=> isFinite(vals[k]) && vals[k] < 0).map(f=>f.label);
    return list.length ? `<div class="alert warn">⚠ Negative ${what} for:<br>${list.join('<br>')}</div>` : '';
  }

  /* One chart of a value per sample ± its error: GC's mean-rate chart (gc.js
     drawBarChart) step for step — sizes, margins, headroom, bar widths — so the charts
     look and resize alike. `shown` are the series side by side in each sample's slot,
     as GC pairs its gases: {name, color, vals[], errs[]}. `chips` is the plot's chip
     row, if it has one, which the value labels keep clear of. Nothing positive to show
     hides the chart; returns whether it was drawn. */
  function drawValueBars(barSvg, shown, { chips, yLabel, digits }){
    const barWrap = barSvg.closest('.plot-wrap');
    const n = files.length;
    const posVals = shown.flatMap(m=> m.vals).filter(v=>isFinite(v)&&v>0);
    if (!posVals.length){
      barSvg.style.display='none'; barWrap.style.display='none';
      return false;
    }
    barSvg.style.display=''; barWrap.style.display='';
    const has = k => shown.some(m=> isFinite(m.vals[k]) && m.vals[k] > 0);
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    const rect = barSvg.getBoundingClientRect();
    const svgW = rect.width || 640, svgH = rect.height || 640;
    // Narrow screens and many samples get steeper, shorter labels — see barLabelFit.
    const fit = barLabelFit(mctx, Math.max(60, svgW - 75), n);
    const labels = files.map(f=>truncTiltLabel(mctx, f.label, fit.cap));
    const labelWs = labels.map((lbl,k)=> has(k) ? mctx.measureText(lbl).width : 0);
    let maxLbl = 0; labelWs.forEach(w=>maxLbl=Math.max(maxLbl, w));
    const bottom = Math.min(Math.round(svgH*0.5), Math.round(26 + maxLbl*fit.sin));
    // Value label (vertical) above each bar, with reserved top headroom so it never clips.
    const fmtLab = (v,e)=> isFinite(e) ? `${v.toFixed(digits)}±${e.toFixed(digits)}` : v.toFixed(digits);
    const topOf = (v,e)=> v + (isFinite(e)?e:0);
    let maxValW = 0, maxTop = 0;
    for (const m of shown) for (let k=0;k<n;k++){
      const v = m.vals[k], e = m.errs[k];
      if (isFinite(v) && v>0){ maxValW = Math.max(maxValW, mctx.measureText(fmtLab(v,e)).width); maxTop = Math.max(maxTop, topOf(v,e)); }
    }
    const mTop = 15, gap = 6, plotH = svgH - mTop - bottom, reserve = gap + maxValW + 6;
    const frac = plotH > reserve ? (1 - reserve/plotH) : 0.5;
    const xpad = barPlotXPad(labelWs, n, svgW-75, fit.rot);   // widen only when a label would cross x=0
    const x0 = -xpad, x1 = n+1+xpad;
    // Widths shrink so a pair still fits the slot.
    const pxSlot = (svgW - 75) / (x1 - x0);
    const hw = shown.length > 1 ? Math.min(11, pxSlot*0.22) : Math.min(16, pxSlot*0.3);
    const dx = shown.length > 1 ? Math.min(12, pxSlot*0.24) : 0;
    const offOf = mi => (mi - (shown.length-1)/2) * dx * 2;
    const underChips = [];
    for (let k=0;k<n;k++) shown.forEach((m, mi)=>{ const v = m.vals[k], e = m.errs[k];
      if (isFinite(v) && v>0) underChips.push({ x:k+1, dx:offOf(mi), top:topOf(v,e), w:mctx.measureText(fmtLab(v,e)).width }); });
    const ymax = Math.max(Math.max(...posVals)*1.2, maxTop/frac,
      barChipYmax(chips, barSvg, underChips, { W:svgW, ml:55, mr:20, mTop, plotH, gap, x0, x1 }));
    const bp = new Plot(barSvg, {xlabel:'', ylabelSvg:yLabel, noXTickLabels:true, noXGrid:true, yGrid:true, margin:{l:55,r:20,t:mTop,b:bottom}});
    bp.setRange(x0, x1, 0, ymax||1);
    bp.drawAxes();
    for (let k=0;k<n;k++){
      if (!has(k)) continue;
      shown.forEach((m, mi)=>{
        const v = m.vals[k], e = m.errs[k];
        if (!(isFinite(v) && v>0)) return;
        const off = offOf(mi);
        drawBar(bp, k+1, v, m.color, hw, off, m.name);
        if (isFinite(e)) drawErrBar(bp, k+1, v, e, off);
        bp.barLabel(k+1, topOf(v,e), fmtLab(v,e), {gap, dx:off});
      });
      bp.tickLabel(k+1, labels[k], fit.rot, files[k].label, files[k].name);
    }
    bp.attachTools(barWrap);
    return true;
  }

  /* The two ways Eg is read, as GC's gases are: one chart, a chip per method to show or
     hide it, and never both hidden — the chart would be empty. */
  function renderEgSel(){
    const el = document.getElementById('taucEgSel');
    if (!el) return;
    el.innerHTML = EG_METHODS.map(m=>{
      const on = egSel.includes(m.key), only = on && egSel.length === 1;
      return `<button type="button" class="mode-chip plot-chip${on ? ' is-on' : ''}" data-eg="${m.key}"`
           + ` title="${only ? `${m.name} — the only one shown` : `Show / hide ${m.name}`}">${m.label}</button>`;
    }).join('');
  }
  document.getElementById('taucEgSel').addEventListener('click', e=>{
    const b = e.target.closest('[data-eg]');
    if (!b) return;
    const key = b.dataset.eg, on = egSel.includes(key);
    if (on && egSel.length === 1) return;
    egSel = EG_METHODS.map(m=>m.key).filter(k=> k === key ? !on : egSel.includes(k));
    renderResView();
    hist.commit();
  });

  // `name` names the series the bar belongs to, the way the legend under the chart
  // does, so the figure composer sees one series of bars rather than nameless ones.
  function drawBar(plot, xc, val, color, hw, dx, name){ plot.barPx(xc, 0, val, color, hw, dx, { label: name }); }
  function drawErrBar(plot, xc, val, err, dx){ plot.errbar(xc, val, err, dx); }

  // Assemble a "wide" CSV: each column is {h:header, v:[values]}, padded to the
  // longest so every sample keeps its own independent columns (no shared axis).
  function wideCsv(cols){
    const maxLen = Math.max(0, ...cols.map(c=>c.v.length));
    let t = csvLine(cols.map(c=>c.h));
    for (let i=0;i<maxLen;i++) t += csvLine(cols.map(c=> i<c.v.length ? c.v[i] : ''));
    return t;
  }
  function exportTaucZip(){
    if (!files.length) return [];
    const entries = [];
    // reflectance_FR.csv — (wavelength, F(R)) per sample
    {
      const cols=[];
      files.forEach(f=>{
        cols.push({h:'wavelength_nm_'+f.label, v:f.wl.map(x=>fmtNum(x,6))});
        cols.push({h:f.label,                  v:f.FR.map(x=>fmtNum(x,6))});
      });
      entries.push({name:'reflectance_FR.csv', text:wideCsv(cols)});
    }
    // tauc_plot.csv — per sample: energy, [F(R)·hν]^a, linear-region regression,
    // baseline regression (both evaluated on the sample's own energy grid)
    {
      const cols=[];
      files.forEach((f,k)=>{
        const r = bestRegsAll[k];
        cols.push({h:'energy_eV_'+f.label,       v:f.hv.map(x=>fmtNum(x,6))});
        cols.push({h:f.label,                    v:f.hv.map((hv,i)=>fmtNum(Math.pow(f.FR[i]*hv, getFileParams(k).a),6))});
        cols.push({h:f.label+'_reg_linear',      v:f.hv.map(hv=> (r&&r.regs)  ? fmtNum(r.regs.slope*hv  + r.regs.intercept, 6)  : '')});
        cols.push({h:f.label+'_reg_baseline',    v:f.hv.map(hv=> (r&&r.regs2) ? fmtNum(r.regs2.slope*hv + r.regs2.intercept, 6) : '')});
      });
      entries.push({name:'tauc_plot.csv', text:wideCsv(cols)});
    }
    // Eg.csv — bar-plot-like summary (one row per sample), both Eg estimates + errors
    {
      let t = csvLine(['Sample','Eg','Eg_err','Eg_baseline','Eg_baseline_err']);
      files.forEach((f,k)=>{
        const r = bestRegsAll[k];
        t += csvLine([f.label,
          r?fmtNum(r.Eg,6):'', r?fmtNum(r.EgErr,6):'', r?fmtNum(r.EgInt,6):'', r?fmtNum(r.EgIntErr,6):'']);
      });
      entries.push({name:'Eg.csv', text:t});
    }
    // urbach_plot.csv — per sample: energy, ln F(R) and the Urbach regression, on the
    // sample's own grid (F(R) ≤ 0 has no logarithm: left empty)
    if (urbachOn){
      const cols=[];
      files.forEach((f,k)=>{
        const r = urbach.analyze(k).regs;
        cols.push({h:'energy_eV_'+f.label,  v:f.hv.map(x=>fmtNum(x,6))});
        cols.push({h:f.label,               v:f.FR.map(v=> v > 0 ? fmtNum(Math.log(v),6) : '')});
        cols.push({h:f.label+'_reg_urbach', v:f.hv.map(hv=> isFinite(r.slope) ? fmtNum(r.slope*hv + r.intercept, 6) : '')});
      });
      entries.push({name:'urbach_plot.csv', text:wideCsv(cols)});
    }
    // Eu.csv — bar-plot-like summary, E_U and its error in meV as the chart shows them
    if (urbachOn){
      let t = csvLine(['Sample','Eu_meV','Eu_err_meV']);
      files.forEach((f,k)=>{
        const r = urbach.analyze(k);
        t += csvLine([f.label, isFinite(r.Eu)?fmtNum(r.Eu*1000,6):'', isFinite(r.EuErr)?fmtNum(r.EuErr*1000,6):'']);
      });
      entries.push({name:'Eu.csv', text:t});
    }
    // tauc_regression.csv — per-sample regression settings & results (the info that
    // is otherwise only readable off the Analysis plot). Endpoints are in eV, taken
    // from the best-fit window; R²/NRMSE are the fit-quality metrics for each line.
    {
      let t = csvLine(['Sample','Tauc Exponent','Smoothing points',
        'Tauc regression points','Tauc start (eV)','Tauc end (eV)','Tauc R^2','Tauc NRMSE',
        'Baseline regression points','Baseline start (eV)','Baseline end (eV)','Baseline R^2','Baseline NRMSE']);
      files.forEach((f,k)=>{
        const fp = getFileParams(k), r = bestRegsAll[k] || {};
        const span = (reg) => {
          const idx = reg && reg.bestIdx;
          if (!idx || !idx.length) return ['',''];
          let lo=Infinity, hi=-Infinity;
          idx.forEach(i=>{ const e=f.hv[i]; if(e<lo)lo=e; if(e>hi)hi=e; });
          return [fmtNum(lo,6), fmtNum(hi,6)];
        };
        const [ts,te] = span(r.regs), [bs,be] = span(r.regs2);
        t += csvLine([f.label, fp.a, fp.N, fp.M, ts, te,
          r.regs&&isFinite(r.regs.R2)?fmtNum(r.regs.R2,6):'', r.regs&&isFinite(r.regs.NRMSE)?fmtNum(r.regs.NRMSE,6):'',
          fp.M2, bs, be,
          r.regs2&&isFinite(r.regs2.R2)?fmtNum(r.regs2.R2,6):'', r.regs2&&isFinite(r.regs2.NRMSE)?fmtNum(r.regs2.NRMSE,6):'']);
      });
      entries.push({name:'analysis_info.csv', text:t});
    }
    return entries;
  }
  registerCsvExport('tauc', exportTaucZip);
})();

