import { fmtNum, csvLine, setupDropzone, renderUnifiedFileList, includedOf, setIncluded, removeFileAt, moveFileTo, linspace, movingAverage, gradientArr, maxArr, minArr, fitLinear, tinv, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, barNames, barChipYmax, X_SVG, guardNumberInputs } from './utils.js';
import { Plot } from './plot.js';

/* =========================================================
   TAUC MODULE
========================================================= */
(function(){
  // Every file loaded, in list order; the analysis sees the included ones, `files`,
  // and every per-sample list the cards keep is aligned with those.
  let allFiles = []; // {name,label,wl[],FR[],hv[]}  (each on its own native axis)
  let files = [];
  let currIndex=0;                    // the sample every analysis card shows
  let resPlot0=null, resPlotLog=null; // the Kubelka-Munk summary plots (created once)
  // How Eg is read off the Tauc plot; each Tauc analysis picks which its bar chart shows.
  const EG_METHODS = [
    // Named E_g in plain text: a legend's sub run sits badly beside its swatch.
    { key: 'x', label: 'x-axis',   name: 'E_g (x-axis)',   color: '#3aa0ff' },
    { key: 'b', label: 'baseline', name: 'E_g (baseline)', color: '#ff7a59' },
  ];

  /* The two ways E_U is read, told apart as GC's gases are: from ln F(R) as it is, and
     with the reference Tauc card's baseline taken out of F(R) first (urbachSub). Lines
     keep the sample's colour, the subtracted ones dashed; bars take the pair's two
     colours. Each Urbach card shows one, the other or both, in its line plot and in its
     bar chart separately. */
  const URB_METHODS = [
    { key: 'p', label: 'plain',      name: 'E_U',              dash: '',    fitDash: '5,4', color: '#3aa0ff' },
    { key: 's', label: 'subtracted', name: 'E_U (subtracted)', dash: '5,4', fitDash: '2,3', color: '#ff7a59' },
  ];
  const URB_ALL = ()=> ({ l: URB_METHODS.map(m=> m.key), b: URB_METHODS.map(m=> m.key) });

  const clampN = v => Math.max(1, Math.round(v));
  const clampM = v => Math.max(2, Math.round(v));
  // Two-sided 99% confidence: the 99.5% quantile of Student's t, the factor every
  // error reported here (Eg, E_U) is multiplied by.
  const T_Q = 0.995;

  // Best linear fit inside [x1,x2]: slide an M-point window and pick the one that
  // minimises NRMSE/R², where NRMSE = RMSE / (max-min of the window's y). Normalising
  // by the y-range makes the criterion robust — it locks onto the steep linear edge
  // instead of a flat low-value stretch that merely has a small absolute RMSE.
  // `Ys` is the curve as analysed: already smoothed. The window is chosen on it, where
  // noise does not pick it, and the line fitted to `Yraw`, the data themselves, inside
  // it: fitted to smoothed values its residuals are averaged together, no longer
  // independent, and every error came out too small (a "99%" interval held the truth
  // 72% of the time at N = 5, 37% at N = 15). `n` is how many points it was fitted on.
  function scanRegr(hv, Ys, M, x1, x2, Yraw){
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
        best = {slope:r.slope, intercept:r.intercept, R2:r.R2, RMSE:r.rmse, NRMSE:nrmse, bestIdx:block, varM:r.varM, varB:r.varB, covMB:r.covMB, n:M};
      }
    }
    if (!Yraw || Yraw === Ys || !best.bestIdx.length) return best;
    const idx = best.bestIdx.filter(i=> isFinite(Yraw[i]));
    if (idx.length < 3) return {...best, slope:NaN, intercept:NaN, R2:NaN, NRMSE:Infinity, varM:NaN, varB:NaN, covMB:NaN, n:idx.length};
    const yr = idx.map(i=> Yraw[i]), r = fitLinear(idx.map(i=> hv[i]), yr), range = Math.max(...yr) - Math.min(...yr);
    return {slope:r.slope, intercept:r.intercept, R2:r.R2, RMSE:r.rmse, NRMSE: range > 0 ? r.rmse/range : Infinity,
            bestIdx:best.bestIdx, varM:r.varM, varB:r.varB, covMB:r.covMB, n:idx.length};
  }

  /* Eg from the two Tauc fits: where the Tauc line crosses the x-axis, and where it
     crosses the baseline. Each error is the fit's own (co)variances carried through
     the formula, every term scaled by the t factor of the fit it comes from. */
  function taucEg(regs, regs2, M, M2){
    let Eg=NaN, EgErr=NaN, EgInt=NaN, EgIntErr=NaN;
    if ([regs.slope,regs.intercept,regs2.slope,regs2.intercept].every(isFinite)){
      const xInt = (regs2.intercept - regs.intercept)/(regs.slope - regs2.slope);
      const dxdb1 = -1/(regs.slope-regs2.slope), dxdb2 = 1/(regs.slope-regs2.slope);
      // x = (b2 − b1)/(m1 − m2), so ∂x/∂m1 = −(b2 − b1)/(m1 − m2)² = −∂x/∂m2. With the
      // sign the other way the slope–intercept covariances, strongly negative this far
      // from hν = 0, added to the variance instead of taking from it.
      const dxdm1 = -(regs2.intercept-regs.intercept)/Math.pow(regs.slope-regs2.slope,2);
      const dxdm2 = -dxdm1;
      const t1 = tinv(T_Q, (regs.n || M)-2), t2 = tinv(T_Q, (regs2.n || M2)-2);
      const varX = dxdb1*dxdb1*regs.varB*t1*t1 + dxdb2*dxdb2*regs2.varB*t2*t2 +
                   dxdm1*dxdm1*regs.varM*t1*t1 + dxdm2*dxdm2*regs2.varM*t2*t2 +
                   2*dxdb1*dxdm1*regs.covMB*t1*t1 + 2*dxdb2*dxdm2*regs2.covMB*t2*t2;
      EgInt = xInt;
      EgIntErr = varX>0 ? Math.sqrt(varX) : NaN;
    }
    ({ x: Eg, err: EgErr } = xCross(regs, M));
    return {Eg,EgErr,EgInt,EgIntErr};
  }
  // Where a fitted line crosses y = 0, −b/m, and its error: the slope and intercept
  // variances and their covariance carried through, times the fit's t factor.
  function xCross(r, M){
    if (!(r.slope !== 0 && isFinite(r.slope))) return { x: NaN, err: NaN };
    const x = -r.intercept/r.slope;
    if (![r.varM, r.varB, r.covMB].every(isFinite)) return { x, err: NaN };
    const v = (r.intercept**2/r.slope**4)*r.varM + (1/r.slope**2)*r.varB - 2*(r.intercept/r.slope**3)*r.covMB;
    return { x, err: v >= 0 ? Math.sqrt(v)*tinv(T_Q, (r.n || M)-2) : NaN };
  }
  // The inverse of a fit's slope, and its error σ_m/m² times the fit's t factor.
  function invSlope(r, M){
    const m = r.slope;
    if (!isFinite(m) || m === 0) return { v: NaN, err: NaN };
    return { v: 1/m, err: isFinite(r.varM) && r.varM >= 0 ? Math.sqrt(r.varM)/(m*m)*tinv(T_Q, (r.n || M)-2) : NaN };
  }
  // The Urbach energy is the inverse of the tail's slope in ln F(R) against hν.
  function urbachEu(regs, M){ const s = invSlope(regs, M); return { Eu: s.v, EuErr: s.err }; }

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
     elements are its prefix plus the same suffixes (an1Svg, an2Svg, ...). A card
     folded out of sight (`hidden`) is not drawn: it is brought up to date when it
     is unfolded.
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
    let shown = -1;           // the sample the plot last drew

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
    // A spec with `ownLines` keeps every sample's lines its own whatever the mode, which
    // then decides the parameters alone; a sample with none yet starts from the common
    // set an older project kept, if there is one.
    P.vlinesFor = i =>{
      if (P.mode==='shared' && !spec.ownLines) return P.sharedVlines;
      let pp = P.per[i]; if (!pp) pp = P.per[i] = {};
      if (!pp.vlines || !isFinite(pp.vlines.v1))
        pp.vlines = spec.ownLines && isFinite(P.sharedVlines.v1) ? {...P.sharedVlines} : defaultVlinesFor(i);
      return pp.vlines;
    };
    // Every fit of sample k, and what the spec makes of them.
    P.analyze = k =>{
      const p = P.params(k), vl = P.vlinesFor(k), c = curves(k, p);
      const fits = windows.map(w=> scanRegr(c.hv, c.Ys, p[w.M], vl[w.lo], vl[w.hi], c.Yraw));
      return { ...spec.results(fits, p, k, vl), fits };
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
      if (P.mode==='per' || spec.ownLines){ files.forEach((f,i)=>{ const s=suggestOne(i); if (s){ if(!P.per[i]) P.per[i]={}; P.per[i].vlines = s; } }); }
      else { const s = suggestShared(); if (s) P.sharedVlines = s; }
    };
    // A setting that reshapes the curve (`suggestOn`) places the lines again where it
    // applies: for every sample in all mode, for the one on show in one mode.
    function resuggestEdited(){
      if (P.mode === 'per') P.suggestAt(currIndex);
      else P.autoSuggestAll();
    }
    // One sample's own lines placed again by the suggestion.
    P.suggestAt = i =>{ const s = suggestOne(i); if (s){ if (!P.per[i]) P.per[i] = {}; P.per[i].vlines = s; } };

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
      if ($('NExp')) $('NExp').textContent = spec.fmtA(p.a);
    };
    P.syncModeButton = ()=>{ const c = $('ModeAll'); if (c) c.textContent = P.mode==='shared' ? 'all' : 'one'; };

    P.initPlot = ()=>{
      if (spec.hidden && spec.hidden()){ plot = null; return; }
      plot = new Plot($('Svg'), {xlabel:'hν (eV)', ylabelSvg: spec.yLabel(P.params(currIndex)), xTickStep:0.5, noYTickLabels:true});
      plot.attachTools(plot.svg.closest('.plot-wrap'));
      // A spec whose lines are each sample's own has no common set to start.
      if (!spec.ownLines && !isFinite(P.sharedVlines.v1)){
        const [lo, hi] = unionHv();
        P.sharedVlines = spec.defaultLines(lo, hi - lo);
      }
      P.update();
    };
    P.hasPlot = ()=> !!plot;
    P.shownIndex = ()=> shown;

    P.update = preserveView =>{
      if (!plot || !files.length || (spec.hidden && spec.hidden())) return;
      shown = currIndex;
      vlines = P.vlinesFor(currIndex);   // point at the current sample's interval lines
      const p = P.params(currIndex);
      const c = curves(currIndex, p), hv = c.hv;
      $('CurrentLabel').textContent = files[currIndex].label;
      $('Idx').textContent = (currIndex+1)+'/'+files.length;

      // Capture current zoom so it can be kept across redraws (the full range
      // set below stays as the "home" reset target)
      const prev = (preserveView && isFinite(plot.xmin)) ? {xmin:plot.xmin, xmax:plot.xmax, ymin:plot.ymin, ymax:plot.ymax} : null;
      const rLo = spec.zeroFloor ? 0 : minArr(c.Yraw), rHi = maxArr(c.Yraw), pad = spec.zeroFloor ? 0 : 0.05*(rHi - rLo);
      plot.setRange(minArr(hv), maxArr(hv), rLo - pad, spec.zeroFloor ? rHi*1.05 : rHi + pad);
      if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
      plot.clearData();
      plot.ylabelSvg = spec.yLabel(p) + ' (a. u.)';
      plot.drawAxes();
      if (spec.bands) spec.bands(currIndex).forEach(b=> plot.vband(b.x0, b.x1, b.color, b.opacity));
      // Named for the figure composer: this plot has no legend, so without these the
      // traces would reach it as "Series 1..n". Keyed by role, not by sample: the plot
      // shows one sample at a time, and a trace keeps its looks from one to the next.
      const nm = files[currIndex].label;
      curveTraces(c).forEach(t=>
        plot.line(hv, t.ys, t.color, t.width, undefined, { label: `${nm} ${t.name}`, key: t.key }));

      const fits = [];
      let tooSmall = false;
      windows.forEach((w, wi)=>{
        const lo = Math.min(vlines[w.lo], vlines[w.hi]), hi = Math.max(vlines[w.lo], vlines[w.hi]);
        const sel = hv.filter(v=> v>=lo && v<=hi).length;
        const reg = sel >= p[w.M] ? scanRegr(hv, c.Ys, p[w.M], vlines[w.lo], vlines[w.hi], c.Yraw) : null;
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
      const res = P.analyze(currIndex);
      if (spec.extra) spec.extra(plot, res, hv, nm);
      spec.show($, res);

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
    // The curve as read, smoothed, and its derivative. The derivative is drawn rescaled
    // onto the curve's own span, from the floor the curve is drawn from: zero for
    // Tauc, its own minimum for a log.
    function curveTraces(c){
      const yLo = spec.zeroFloor ? 0 : minArr(c.Ys), yHi = maxArr(c.Ys);
      const onSpan = (arr, lo, hi)=> arr.map(v=> (hi-lo)>0 ? yLo + (v-lo)/(hi-lo)*(yHi-yLo) : v);
      // The grey XRPD draws its raw pattern in: white vanished on the light theme and on
      // the white of every exported image.
      return [
        { ys: c.Yraw, color: '#6a7585', width: 1,   name: 'raw',        key: 'raw' },
        { ys: c.Ys,   color: '#3aa0ff', width: 1.4, name: 'smoothed',   key: 'smoothed' },
        { ys: onSpan(c.dYs, minArr(c.dYs), maxArr(c.dYs)), color: '#5fcf6a', width: 1, name: 'derivative', key: 'derivative' },
      ];
    }
    function throttledUpdate(){
      if (throttle) return;
      throttle = requestAnimationFrame(()=>{ throttle=null; P.update(true); });
    }

    // Per-sample slots follow the file list (removed, moved, left out: see slots()).
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
      // Backward compatibility with pre-all/one snapshots (params stored by input id,
      // passed on keyed by the field's suffix: the cards' ids are not the ones they had).
      if (s.params){
        for (const k of keys){ const v = s.params[FIELD[k]]; if (v != null) P.shared[k] = k === 'a' ? parseFloat(v) : +v; }
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
        if (k === 'a' && $('NExp')) $('NExp').textContent = spec.fmtA(parseFloat(el.value));
        if (spec.suggestOn && spec.suggestOn.includes(k) && files.length) resuggestEdited();
        if (plot) P.update(k !== 'a');
        if (spec.onParams) spec.onParams();
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
          if (!spec.ownLines) pp.vlines = suggestOne(i) || pp.vlines || defaultVlinesFor(i);
        });
      } else if (!spec.ownLines){
        // Back to a single shared set: re-propose the common lines.
        const s = suggestShared();
        if (s) P.sharedVlines = s;
      }
      P.syncModeButton();
      P.writeStoreToInputs();
      if (spec.onParams) spec.onParams();
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
  /* The Tauc exponents, as [F(R)·hν]^a: the transition each stands for (`name`, the
     card's automatic name), and how it is written where it shows (the select, the
     axes); a fraction as such. */
  const EXPONENTS = [
    { a: 0.5, label: '0.5', gap: 'Indirect', name: 'allowed indirect' },
    { a: 2,   label: '2',   gap: 'Direct',   name: 'allowed direct' },
    { a: 2/3, label: '2/3', gap: 'Direct',   name: 'forbidden direct',   forbidden: true },
    { a: 1/3, label: '1/3', gap: 'Indirect', name: 'forbidden indirect', forbidden: true },
  ];
  const expOf = a => EXPONENTS.find(e=> Math.abs(e.a - a) < 1e-9);
  const fmtA = a =>{ const e = expOf(a); return e ? e.label : String(+(+a).toFixed(4)); };
  const URBACH_COLOR = '#ff7f0e';
  const TAUC_COLORS = { regs: '#ff5050', regs2: '#d050ff' };

  /* =========================================================
     ANALYSIS CARDS
     The workspace is a list of analysis cards, each a Tauc plot or an Urbach energy
     analysis, in the order the user put them; every card adds its pair of charts to
     the Results, in the same order. A card is an analysis record (below) and a panel
     built on its own DOM. It keeps the settings of both kinds, so switching it back
     and forth loses nothing. An Urbach card is read against a Tauc one, its
     reference: by default the nearest Tauc card above it, or one chosen by hand, or
     none.
  ========================================================= */
  // As the menus list them; the card titles set them in capitals.
  const KINDS = { tauc: 'Tauc Plot', urbach: 'Urbach Energy' };
  let analyses = [];          // in card order
  const live = new Map();     // id → { card, panel, res, resPlot }
  // While set, a settling panel leaves the Results alone: whoever set it redraws
  // them once, rather than once per card.
  let quiet = false;
  const quietly = fn =>{ const was = quiet; quiet = true; try { fn(); } finally { quiet = was; } };

  const nextId = ()=> analyses.reduce((m, a)=> Math.max(m, a.id), 0) + 1;
  // `base` is the name typed in, used while `nameAuto` is off; `name` is the one
  // shown, made unique. `ref` is the Tauc reference's id, picked by the default rule
  // while `refAuto` is on. `states` keeps the settings of the kind not on show.
  const newAnalysis = type => ({ id: nextId(), type, base: '', nameAuto: true, name: '', collapsed: false,
    ref: null, refAuto: true, egSel: EG_METHODS.map(m=>m.key), urbSel: URB_ALL(), states: {} });
  const byId = id => analyses.find(a=> a.id === id) || null;
  const panelOf = a => a && live.has(a.id) ? live.get(a.id).panel : null;
  const refPanel = a =>{ const r = byId(a.ref); return r && r.type === 'tauc' ? panelOf(r) : null; };
  const livePanels = ()=> analyses.map(panelOf).filter(Boolean);
  const isFolded = a => live.has(a.id) && live.get(a.id).card.classList.contains('is-folded');

  // A sample's Tauc linear region in eV: the window its Tauc fit settled on.
  function taucWindow(tp, i){
    if (!tp) return null;
    const idx = tp.analyze(i).regs.bestIdx;
    if (!idx || !idx.length) return null;
    const xs = idx.map(k=> files[i].hv[k]);
    return [Math.min(...xs), Math.max(...xs)];
  }
  // Where Urbach lines rest with nothing to go by: a quarter and three quarters in.
  const restLines = (lo, d)=> ({ v1: lo + 0.25*d, v2: lo + 0.75*d });

  function taucSpec(a){
    return {
      prefix: 'an' + a.id,
      keys: ['a','N','N2','M','M2'],
      defaults: { a:0.5, N:1, N2:20, M:25, M2:100 },
      curve: (fr, hv, p)=> Math.pow(fr*hv, p.a),
      // The exponent changes the curve the edge is found on, so the lines follow it.
      suggestOn: ['a'],
      yLabel: p => `[F(R)·hν]${sup(fmtA(p.a))}`,
      fmtA,
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
      hidden: ()=> isFolded(a),
      // The automatic name carries the exponent.
      onParams: ()=> refreshNames(),
      // The Urbach cards read against this one follow its linear region once a change
      // settles (a line released, a parameter confirmed), not while a line is dragged.
      onSettled: ()=>{
        if (quiet) return;
        renderAnalysisRes(a);
        follow(a);
        followers(a).forEach(refreshCard);
      },
    };
  }
  /* The Urbach tail with the reference Tauc card's baseline taken out. That baseline is
     a line in the Tauc plot, Y_b = m·hν + b in [F(R)·hν]^a, so in F(R) it is
     F_b = Y_b^(1/a) / hν where Y_b > 0, and nothing where it is not. It is subtracted in
     F(R), where absorptions add up, and what is left goes through the card's own
     treatment: ln (nothing where F(R) − F_b ≤ 0), smoothing over N, the window scan
     between the same lines, the line fitted to the unsmoothed values. Null with no
     reference, or no baseline fit in it. */
  function urbachSub(a, k, p, vl){
    const T = refPanel(a);
    if (!T || !files[k]) return null;
    const r = T.analyze(k).regs2, ta = T.params(k).a;
    if (!(isFinite(r.slope) && isFinite(r.intercept) && ta > 0)) return null;
    const hv = files[k].hv, FR = files[k].FR;
    const Fb = hv.map(e=>{ const y = r.slope*e + r.intercept; return y > 0 ? Math.pow(y, 1/ta)/e : 0; });
    const Yraw = FR.map((v, i)=> v - Fb[i] > 0 ? Math.log(v - Fb[i]) : NaN);
    const Ys = movingAverage(Yraw, p.N);
    const regs = scanRegr(hv, Ys, p.M, vl.v1, vl.v2, Yraw);
    // How many points between the lines lost their logarithm (F(R) ≤ F_b): with too
    // many there is no window to fit, and the card says why.
    const lo = Math.min(vl.v1, vl.v2), hi = Math.max(vl.v1, vl.v2);
    let inside = 0, lost = 0;
    hv.forEach((e, i)=>{ if (e >= lo && e <= hi){ inside++; if (!isFinite(Yraw[i])) lost++; } });
    return { Fb, Yraw, Ys, regs, inside, lost, ...urbachEu(regs, p.M) };
  }
  function urbachSpec(a){
    return {
      prefix: 'an' + a.id,
      keys: ['N','N2','M'],
      defaults: { N:1, N2:20, M:25 },
      curve: fr => fr > 0 ? Math.log(fr) : NaN,
      yLabel: ()=> 'ln[F(R)]',
      zeroFloor: false,
      windows: [
        { lo:'v1', hi:'v2', M:'M', color: URBACH_COLOR, name:'Urbach region', key:'regs', stats:['RMSE1','R21'] },
      ],
      defaultLines: restLines,
      /* The region is placed under the sample's Tauc linear region in the reference
         (the band on this plot): the window scan inside it then finds the tail's
         straightest stretch by itself. With no reference, or no region in it, the
         lines go back to rest. Each sample's tail sits where its own edge is, so its
         lines are its own in either mode, and all/one is about the parameters only. */
      ownLines: true,
      // The tail is below the edge: from 1 eV under the middle of the reference's Tauc
      // linear region up to where that region starts. Centred on it, half the region
      // lay above E_g, and the scan could lock onto the edge itself.
      suggest: i =>{
        const w = taucWindow(refPanel(a), i);
        if (!w){ const hv = files[i].hv, lo = minArr(hv); return restLines(lo, maxArr(hv) - lo); }
        return { v1: (w[0] + w[1]) / 2 - 1, v2: w[0] };
      },
      results: (f, p, k, vl)=> ({ ...urbachEu(f[0], p.M), regs: f[0], sub: urbachSub(a, k, p, vl) }),
      // The tail with the Tauc baseline taken out, on the same plot: its smoothed curve
      // and its fit, in the colours of the plain ones and dashed (the fit's extension
      // dotted, as the plain one's is dashed).
      extra: (plot, r, hv, nm)=>{
        const sb = r.sub;
        if (!sb) return;
        plot.line(hv, sb.Ys, '#3aa0ff', 1.4, '5,4', { label: `${nm} smoothed, subtracted`, key: 'smoothed subtracted' });
        const g = sb.regs;
        if (!g.bestIdx.length || !isFinite(g.slope)) return;
        const xb = g.bestIdx.map(i=> hv[i]);
        plot.line(xb, xb.map(x=> g.slope*x + g.intercept), URBACH_COLOR, 2.2, '5,4', { label: `${nm} Urbach region, subtracted`, key: 'regs subtracted' });
        const xExt = linspace(minArr(hv), maxArr(hv), 100);
        plot.line(xExt, xExt.map(x=> g.slope*x + g.intercept), URBACH_COLOR, 1, '2,3', { label: `${nm} Urbach region, subtracted, extended`, key: 'regs subtracted line' });
      },
      show: ($, r)=>{
        $('Eu').textContent = fmtE(r.Eu, r.EuErr, 'meV', 1, 1000);
        const sb = r.sub, g = sb && sb.regs;
        $('RMSE1s').textContent = g && isFinite(g.NRMSE) ? g.NRMSE.toFixed(4) : '-';
        $('R21s').textContent = g && isFinite(g.R2) ? g.R2.toFixed(4) : '-';
        $('EuS').textContent = sb ? fmtE(sb.Eu, sb.EuErr, 'meV', 1, 1000) : '-';
        $('LegSub').style.display = $('LegSubFit').style.display = sb ? '' : 'none';
        if (sb && !isFinite(g.slope) && sb.lost) $('Alert').insertAdjacentHTML('beforeend',
          `<div class="alert warn">⚠ No subtracted fit: the Tauc baseline lies above F(R) at ${sb.lost} of the ${sb.inside} points between the lines, where F(R) − F<sub>b</sub> has no logarithm.</div>`);
      },
      hidden: ()=> isFolded(a),
      onSettled: ()=>{ if (!quiet) renderAnalysisRes(a); },
      // The reference's linear region for the sample, shaded in the Tauc region's red
      // behind the curves: the tail is read against where the edge is, and below it.
      bands: i =>{
        const w = taucWindow(refPanel(a), i);
        return w ? [{ x0: w[0], x1: w[1], color: TAUC_COLORS.regs, opacity: 0.18 }] : [];
      },
    };
  }

  const SPECS = { tauc: taucSpec, urbach: urbachSpec };

  // Every card shows the same sample, so stepping in one steps them all. The Results
  // do not depend on which sample is on show.
  function showSample(k){
    currIndex = k;
    quietly(()=> livePanels().forEach(p=>{ p.writeStoreToInputs(); p.update(); }));
  }

  /* ---- Card markup ---- */
  const DL_ICON = `<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="15"/><polyline points="7 10.5 12 15.5 17 10.5"/><line x1="5" y1="20" x2="19" y2="20"/></svg>`;
  const INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/></svg>';
  const GRIP_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="19" y2="17"/></svg>';
  const CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  const CARD_INFO = `Each analysis card can be renamed in the field under its title (left empty, it goes back to the automatic name), turned into the other kind of analysis from its title, folded with the arrow, closed with the ×, and moved by dragging the ≡ grip; <b>+</b> below the cards adds another. Every card has its own pair of charts in the Results, under its name.`;
  const TAUC_INFO = `Drag the vertical lines to set the Tauc linear regression region (red) and the baseline (magenta), or press <b>✦ Suggest intervals</b> to place them automatically from the absorption edge (second-derivative method), for every sample: one common set in <b>all</b> mode, each sample its own in <b>one</b> mode. Within each interval the best fit is chosen by sliding a window (its size is the regression-window value) and minimising <b>NRMSE/R²</b>, where <b>NRMSE = RMSE / (y<sub>max</sub>−y<sub>min</sub>)</b> of the window. Normalising by the y-range keeps the fit on the steep linear part instead of a flat low-value stretch that only has a small absolute RMSE, so it is markedly more stable. E<sub>g</sub> is extracted from both the x-axis intersection and the baseline intersection of the regression line. The <b>Tauc exponent</b> is 2 for direct allowed transitions, 0.5 for indirect allowed, 2/3 for direct forbidden and 1/3 for indirect forbidden ones; changing it places the lines again, as Suggest does (every sample in <b>all</b> mode, the one on show in <b>one</b> mode). Energies are hν = hc/λ (hc = 1239.842 eV·nm). The curve is smoothed with a centred moving average to choose each window, and the line is then fitted to the unsmoothed data inside it: fitted to smoothed values, whose residuals are no longer independent, its errors would come out too small. <b>Errors</b>: each E<sub>g</sub> uncertainty is the regression's own, its slope and intercept variances and their covariance propagated through the formula, multiplied by <b>Student's t at 99% confidence</b> (two-sided, M − 2 degrees of freedom for each fit). E<sub>g</sub> from the baseline combines both fits and treats them as independent. ${CARD_INFO}`;
  const URBACH_INFO = `Below the band gap the absorption tail is exponential, F(R) ∝ exp(hν / E<sub>U</sub>), so <b>ln[F(R)]</b> against hν is a straight line of slope 1 / E<sub>U</sub>. The <b>Tauc reference</b> is the Tauc analysis this one is read against: its linear region is the red band on the plot, and <b>✦ Suggest intervals</b> places the Urbach region, for every sample, below it, where the tail is: from 1 eV under the middle of the Tauc linear region up to where that region starts; the regression window then finds the straightest stretch of the tail inside it by itself. The region follows the reference: when a sample's Tauc linear region moves (its lines, parameters, Suggest), the sample's Urbach region is placed on it again once the change is made (a Tauc line released, a value confirmed), and a new reference places them all. By default the reference is the nearest Tauc card above this one; one chosen by hand stays wherever the cards are moved. With <b>None</b> there is no band and nothing to follow, and the suggestion puts the lines at 25% and 75% of each sample's energy span. Drag the orange lines to set the region by hand: they stay until the reference's region moves again. The lines are always each sample's own: <b>all / one</b> here sets the parameters only. Within the region the best window of the regression-window size is chosen by minimising <b>NRMSE/R²</b> and fitted on the unsmoothed data, as for Tauc. <b>E<sub>U</sub> = 1 / slope</b>; its error is the slope's standard error carried through (σ<sub>m</sub> / m²), multiplied by <b>Student's t at 99% confidence</b> (two-sided, M − 2 degrees of freedom). Points with F(R) ≤ 0 have no logarithm and are left out. <b>Subtracted</b>: the same, with the reference's Tauc baseline taken out of F(R) first. That baseline is a line in the Tauc plot, Y<sub>b</sub> = m·hν + b in [F(R)·hν]<sup>a</sup>, so in F(R) it is <b>F<sub>b</sub> = Y<sub>b</sub><sup>1/a</sup> / hν</b> where Y<sub>b</sub> > 0 (nothing where it is not); ln[F(R) − F<sub>b</sub>] is smoothed and fitted between the same lines, by the same rules, for a second slope and E<sub>U</sub> (subtracted), whose error is its own fit's: the baseline's uncertainty is not carried into it. On the plot it is dashed (its curve and fit), and with no reference there is nothing to subtract. In the Results the chips on the Urbach plot and on the E<sub>U</sub> chart show the plain series, the subtracted one or both (the subtracted lines dashed, in the sample's colour), each chart its own. ${CARD_INFO}`;


  const navRow = p => `
          <div class="plot-nav-row">
            <div class="plot-nav-left">
              <button class="btn nav-arrow an-prev" id="${p}Prev" aria-label="Previous sample" title="Previous sample (&#8592;)">‹</button>
              <span id="${p}Idx" class="pill nav-count" style="margin:0">1/1</span>
              <button class="btn nav-arrow an-next" id="${p}Next" aria-label="Next sample" title="Next sample (&#8594;)">›</button>
              <span class="txt-caption" id="${p}CurrentLabel">—</span>
            </div>
          </div>`;
  // At the foot of the parameter column, after what it holds.
  const suggestBtn = (p, title)=> `
            <button class="btn plot-action-btn" id="${p}Suggest" title="${title}">&#10022; Suggest intervals</button>`;
  // The download names follow the analysis name (paintName); a CSV is offered only
  // where there is one to give.
  const plotWrap = (svgId, legendId, csv, extra = '')=> `
            <div class="plot-wrap">
              <svg class="plot" id="${svgId}"></svg>${extra}
              <button class="btn plot-dl-btn" data-dl-svg="${svgId}"${csv ? ' data-csv-mod="tauc" data-csv-names="-"' : ''} data-dl-name="${svgId}.svg" data-dl-legend="${legendId}">${DL_ICON}</button>
            </div>`;
  // An item [colour, text, attributes, dashed]: a dashed one gets a dashed key.
  const legend = (id, items)=> `<div class="legend" id="${id}">${items.map(([c, t, x, d])=> `<span${x || ''}>${d ? `<i class="mk-dash" style="color:${c}"></i>` : `<i style="background:${c}"></i>`}${t}</span>`).join('')}</div>`;

  function taucBody(p){
    return `
        <div class="row" style="align-items:flex-start">
          <div class="col mw520" style="flex:2">
            ${navRow(p)}
            ${plotWrap(p + 'Svg', p + 'Legend', true)}
            ${legend(p + 'Legend', [['#6a7585', 'original'], ['#3aa0ff', 'smoothed'], ['#5fcf6a', 'derivative'], ['#ff5050', 'Tauc linear region'], ['#d050ff', 'baseline']])}
          </div>
          <div class="col mw280" style="align-self:flex-start">
            <div class="txt-mini param-head aligned">Parameters <button type="button" class="mode-chip" id="${p}ModeAll" title="all: one common setup for every sample. one: each sample fully independent (parameters and interval lines).">all</button></div>
            <div class="param-grid">
              <label class="txt-label" for="${p}A">Tauc exponent</label>
              <select id="${p}A" class="pg-field an-exp">
                ${EXPONENTS.map(e=> `<option value="${e.a}"${e.a === 0.5 ? ' selected' : ''}>${e.label} (${e.name})</option>`).join('')}
              </select>
              <label class="txt-label" for="${p}N">[F(R)hν]<sup id="${p}NExp">0.5</sup> smoothing window</label>
              <input type="number" class="pg-field" id="${p}N" value="1" min="1">
              <label class="txt-label" for="${p}N2">Derivative smoothing window</label>
              <input type="number" class="pg-field" id="${p}N2" value="20" min="1">
              <label class="txt-label" for="${p}M">Tauc linear region regression window</label>
              <input type="number" class="pg-field" id="${p}M" value="25" min="2">
              <div class="pg-stat">NRMSE: <b id="${p}RMSE1">-</b></div>
              <div class="pg-stat">R²: <b id="${p}R21">-</b></div>
              <label class="txt-label" for="${p}M2">Baseline regression window</label>
              <input type="number" class="pg-field" id="${p}M2" value="100" min="2">
              <div class="pg-stat">NRMSE: <b id="${p}RMSE2">-</b></div>
              <div class="pg-stat">R²: <b id="${p}R22">-</b></div>
              <div class="pg-result">
                <div class="pg-stat">E<sub>g</sub> (x-axis): <b id="${p}Eg">-</b></div>
                <div class="pg-stat">E<sub>g</sub> (baseline): <b id="${p}EgInt">-</b></div>
              </div>
            </div>
            <div id="${p}Alert"></div>${suggestBtn(p, 'Propose optimal Tauc-region and baseline intervals from the absorption edge')}
          </div>
        </div>`;
  }
  function urbachBody(p){
    return `
        <div class="row" style="align-items:flex-start">
          <div class="col mw520" style="flex:2">
            ${navRow(p)}
            ${plotWrap(p + 'Svg', p + 'Legend', false)}
            ${legend(p + 'Legend', [['#6a7585', 'original'], ['#3aa0ff', 'smoothed'], ['#5fcf6a', 'derivative'], ['#ff7f0e', 'Urbach region'],
              ['#3aa0ff', 'smoothed, Tauc baseline subtracted', ` id="${p}LegSub"`, true], ['#ff7f0e', 'Urbach region, subtracted', ` id="${p}LegSubFit"`, true],
              ['rgba(255,80,80,0.35)', 'Tauc linear region', ` id="${p}LegBand"`]])}
          </div>
          <div class="col mw280" style="align-self:flex-start">
            <div class="txt-mini param-head aligned">Parameters <button type="button" class="mode-chip" id="${p}ModeAll" title="all: one set of parameters for every sample. one: each sample its own. The interval lines are always each sample's own.">all</button></div>
            <div class="param-grid">
              <label class="txt-label" for="${p}Ref">Tauc reference</label>
              <select id="${p}Ref" class="pg-field an-ref" title="The Tauc analysis whose linear region the Urbach region is placed on"></select>
              <label class="txt-label" for="${p}N">ln[F(R)] smoothing window</label>
              <input type="number" class="pg-field" id="${p}N" value="1" min="1">
              <label class="txt-label" for="${p}N2">Derivative smoothing window</label>
              <input type="number" class="pg-field" id="${p}N2" value="20" min="1">
              <label class="txt-label" for="${p}M">Urbach linear region regression window</label>
              <input type="number" class="pg-field" id="${p}M" value="25" min="2">
              <div class="pg-stat">NRMSE: <b id="${p}RMSE1">-</b></div>
              <div class="pg-stat">R²: <b id="${p}R21">-</b></div>
              <div class="pg-stat pg-gap" title="The fit with the reference Tauc card's baseline taken out of F(R)">NRMSE (subtracted): <b id="${p}RMSE1s">-</b></div>
              <div class="pg-stat" title="The fit with the reference Tauc card's baseline taken out of F(R)">R² (subtracted): <b id="${p}R21s">-</b></div>
              <div class="pg-result">
                <div class="pg-stat">E<sub>U</sub>: <b id="${p}Eu">-</b></div>
                <div class="pg-stat">E<sub>U</sub> (subtracted): <b id="${p}EuS">-</b></div>
              </div>
            </div>
            <div id="${p}Alert"></div>${suggestBtn(p, "Place the Urbach region from 1 eV below the middle of the reference's Tauc linear region to where that region starts (with no reference: at 25% and 75% of the span)")}
          </div>
        </div>`;
  }
  // The title is the kind, chosen in place; the name sits under it and stays in view
  // when the card is folded, the instructions open under the name.
  function cardHtml(a){
    const p = 'an' + a.id;
    return `
        <div class="an-head">
          <button type="button" class="an-ic an-grip" title="Drag to move this analysis" aria-label="Move analysis">${GRIP_SVG}</button>
          <h3 class="txt-head an-title">Analysis:<span class="an-kind"><button type="button" class="an-type" data-kind="${a.type}" aria-haspopup="menu" aria-expanded="false" title="Change the kind of analysis">${KINDS[a.type]}</button><button type="button" class="instr-info" aria-label="Toggle instructions" aria-expanded="false">${INFO_SVG}</button></span></h3>
          <span class="an-acts">
            <button type="button" class="an-ic an-close" title="Close this analysis" aria-label="Close analysis">${X_SVG(15)}</button>
            <button type="button" class="an-ic an-fold">${CHEVRON_SVG}</button>
          </span>
        </div>
        <input type="text" class="an-name" spellcheck="false" aria-label="Analysis name" title="The analysis name: its charts and files are named after it. Left empty, it goes back to the automatic one.">
        <div class="an-body">
          <div class="instr-block an-instr" style="display:none">${{ tauc: TAUC_INFO, urbach: URBACH_INFO }[a.type]}</div>
          ${{ tauc: taucBody, urbach: urbachBody }[a.type](p)}
        </div>`;
  }

  /* ---- Cards: build, place, fold, move ---- */
  const cardList = document.getElementById('taucAnalyses');
  const addBar = document.getElementById('taucAddBar');

  // The card and the panel on it. `place` puts the card in the page first: the panel
  // finds its elements there by id. Number fields are guarded before the panel
  // listens to them, so an invalid entry never reaches it.
  function buildCard(a, place){
    const card = document.createElement('div');
    card.className = 'card an-card' + (a.collapsed ? ' is-folded' : '');
    card.dataset.an = a.id;
    card.innerHTML = cardHtml(a);
    place(card);
    guardNumberInputs(card);
    const panel = makePanel(SPECS[a.type](a));
    if (a.states[a.type]) panel.restore(a.states[a.type]);
    else panel.fit();
    const prev = live.get(a.id);
    live.set(a.id, { card, panel, res: prev ? prev.res : null, resPlot: prev ? prev.resPlot : null });
    wireCard(a, card);
    syncFoldButton(a);
  }
  const mount = a => buildCard(a, card=> cardList.insertBefore(card, addBar));
  function unmount(id){
    const e = live.get(id);
    if (!e) return;
    e.card.remove();
    if (e.res) e.res.remove();
    live.delete(id);
  }
  const placeCards = ()=> analyses.forEach(a=> cardList.insertBefore(live.get(a.id).card, addBar));

  function wireCard(a, card){
    const q = s => card.querySelector(s);
    const kind = q('.an-type');
    kind.addEventListener('click', ()=> kindMenu.open(kind, t=> switchKind(a, t), { current: a.type }));
    const name = q('.an-name');
    name.addEventListener('change', ()=> rename(a, name.value));
    ['input', 'focus', 'blur'].forEach(t=> name.addEventListener(t, ()=> fitName(a)));
    name.addEventListener('keydown', e=>{
      if (e.key === 'Enter') name.blur();
      else if (e.key === 'Escape'){ name.value = a.name; name.blur(); }
    });
    q('.an-close').addEventListener('click', ()=> removeAnalysis(a));
    q('.an-fold').addEventListener('click', ()=> setFold(a, !a.collapsed));
    // Not initInstrCollapse's: that one wires the page's static blocks once, at load.
    const info = q('.instr-info'), instr = q('.an-instr');
    info.addEventListener('click', ()=>{
      const open = instr.style.display === 'none';
      instr.style.display = open ? '' : 'none';
      info.classList.toggle('is-on', open);
      info.setAttribute('aria-expanded', String(open));
    });
    q('.an-grip').addEventListener('pointerdown', e=> startMove(a, e));
    const ref = q('.an-ref');
    if (ref) ref.addEventListener('change', ()=> chooseRef(a, ref.value));
  }
  function syncFoldButton(a){
    const b = live.get(a.id).card.querySelector('.an-fold');
    b.title = a.collapsed ? 'Unfold this analysis' : 'Fold this analysis';
    b.setAttribute('aria-label', a.collapsed ? 'Unfold analysis' : 'Fold analysis');
    b.setAttribute('aria-expanded', String(!a.collapsed));
  }

  /* Folding animates the body's height. The card is marked folded from the start, so
     its panel stops drawing at once; .an-anim keeps the body laid out (and clipped)
     until the animation ends. One taken over midway starts from where it got to. */
  // Long enough, at ~600 px of body, to read as a slide rather than a jump; the curve
  // starts briskly and settles gently, and the content fades as it goes.
  const FOLD_MS = 320, FOLD_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
  function animateFold(card, fold){
    const body = card.querySelector(':scope > .an-body');
    if (!body._anim && card.classList.contains('is-folded') === fold) return;
    const from = body.getBoundingClientRect().height, fromO = +getComputedStyle(body).opacity;
    if (body._anim){ body._anim.cancel(); body._anim = null; }
    card.classList.toggle('is-folded', fold);
    card.classList.add('an-anim');
    const to = fold ? 0 : body.getBoundingClientRect().height;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(to - from) < 1){ card.classList.remove('an-anim'); return; }
    const an = body.animate([{ height: from + 'px', opacity: fold ? fromO : Math.min(fromO, 0.2) }, { height: to + 'px', opacity: fold ? 0 : 1 }],
      { duration: FOLD_MS, easing: FOLD_EASE });
    body._anim = an;
    an.onfinish = ()=>{ if (body._anim === an){ body._anim = null; card.classList.remove('an-anim'); } };
  }
  // A restore puts the folds where they were, without the animation.
  function applyFold(a){
    const card = live.get(a.id).card, body = card.querySelector(':scope > .an-body');
    if (body._anim){ body._anim.cancel(); body._anim = null; }
    card.classList.remove('an-anim');
    card.classList.toggle('is-folded', a.collapsed);
    syncFoldButton(a);
  }
  // A card out of sight was not drawn: bring it up to date as it comes back, with
  // the zoom it had if it is still on the same sample.
  function wake(a){
    const P = panelOf(a);
    if (!files.length || !P) return;
    P.writeStoreToInputs();
    quietly(()=> P.hasPlot() ? P.update(P.shownIndex() === currIndex) : P.initPlot());
  }
  function setFold(a, folded){
    a.collapsed = folded;
    syncFoldButton(a);
    animateFold(live.get(a.id).card, folded);
    if (!folded) wake(a);
    hist.commit();
  }

  /* Moving: the grip picks the card up. Every card folds for the move, so the list is
     short enough to see whole; the card held follows the pointer and the others make
     way as it passes their middles. On release each card gets back the fold it had.
     While the cards fold, and again while they unfold, the page scrolls to keep the
     card held where it is on screen: the folds would otherwise pull the list out of
     view, above it or below it. */
  let moving = null;
  const scrollNow = dy =>{ if (dy) window.scrollBy({ top: dy, behavior: 'instant' }); };
  function holdInView(card, ms){
    const y0 = card.getBoundingClientRect().top, end = performance.now() + ms;
    const loop = ()=>{ scrollNow(card.getBoundingClientRect().top - y0); if (performance.now() < end) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  function startMove(a, e){
    if (moving || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const card = live.get(a.id).card, top = card.getBoundingClientRect().top;
    moving = { card, y: e.clientY, dy: e.clientY - top, top, t: 0, raf: 0, folding: performance.now() + FOLD_MS + 40 };
    card.classList.add('an-moving');
    document.body.classList.add('an-dragging');
    analyses.forEach(x=> animateFold(live.get(x.id).card, true));
    const onMove = ev =>{ moving.y = ev.clientY; };
    const onUp = ()=>{
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      endMove();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    const loop = ()=>{ if (!moving) return; followMove(); moving.raf = requestAnimationFrame(loop); };
    loop();
  }
  function followMove(){
    const m = moving, card = m.card;
    if (performance.now() < m.folding) scrollNow(card.getBoundingClientRect().top - m.t - m.top);
    else {
      // Near the window's top or bottom the page scrolls, for a list taller than it.
      const EDGE = 48;
      if (m.y < EDGE) scrollNow(-10);
      else if (m.y > window.innerHeight - EDGE) scrollNow(10);
      const cards = [...cardList.querySelectorAll(':scope > .an-card')], i = cards.indexOf(card);
      const mid = c =>{ const r = c.getBoundingClientRect(); return r.top + r.height/2; };
      if (i > 0 && m.y < mid(cards[i-1])) cardList.insertBefore(card, cards[i-1]);
      else if (i < cards.length-1 && m.y > mid(cards[i+1])) cardList.insertBefore(card, cards[i+1].nextSibling);
    }
    // Under the pointer, wherever the layout and the scroll have put it meanwhile.
    const top = card.getBoundingClientRect().top - m.t;
    m.t = m.y - m.dy - top;
    card.style.transform = `translateY(${m.t}px)`;
  }
  function endMove(){
    const m = moving;
    moving = null;
    cancelAnimationFrame(m.raf);
    m.card.style.transform = '';
    m.card.classList.remove('an-moving');
    document.body.classList.remove('an-dragging');
    const order = [...cardList.querySelectorAll(':scope > .an-card')].map(c=> +c.dataset.an);
    const was = analyses.map(a=> a.id).join();
    analyses.sort((x, y)=> order.indexOf(x.id) - order.indexOf(y.id));
    holdInView(m.card, FOLD_MS + 40);
    analyses.forEach(x=>{ if (!x.collapsed) animateFold(live.get(x.id).card, false); });
    if (order.join() !== was){ afterCardsChange(); hist.commit(); }
  }

  /* ---- References and names ---- */
  // Point every Urbach card at its reference: one chosen by hand while it is still a
  // Tauc analysis, else the nearest Tauc card above it, else none. Returns the cards
  // whose reference changed.
  function fixRefs(){
    let above = null;
    const changed = [];
    analyses.forEach(a=>{
      if (a.type === 'tauc'){ above = a; return; }
      if (!a.refAuto && a.ref != null && !(byId(a.ref) && byId(a.ref).type === 'tauc')) a.refAuto = true;
      const ref = a.refAuto ? (above ? above.id : null) : a.ref;
      if (ref !== a.ref){ a.ref = ref; changed.push(a); }
    });
    return changed;
  }
  /* The Urbach region follows its reference: a sample whose Tauc linear region moves
     (a line released, parameters, Suggest, all/one) gets its Urbach lines placed on it
     again, and a new reference re-centres them all. Lines moved by hand stay until
     then. What each Tauc card's regions were is kept by file name, and taken afresh
     (`see`) whenever a state is loaded rather than edited, so loading moves nothing. */
  const followers = a => analyses.filter(u=> u.type === 'urbach' && u.ref === a.id && live.has(u.id));
  function regionsSeen(a){ const e = live.get(a.id); return e.seen || (e.seen = new Map()); }
  const regionKey = (a, i)=>{ const w = taucWindow(panelOf(a), i); return w ? w.join() : ''; };
  function see(a){
    if (a.type !== 'tauc' || !files.length) return;
    const seen = regionsSeen(a);
    files.forEach((f, i)=> seen.set(f.name, regionKey(a, i)));
  }
  // Re-centre the followers on the samples whose region moved.
  function follow(a){
    const seen = regionsSeen(a), moved = [];
    files.forEach((f, i)=>{
      const k = regionKey(a, i), was = seen.get(f.name);
      seen.set(f.name, k);
      if (was !== undefined && was !== k && k) moved.push(i);
    });
    if (moved.length) followers(a).forEach(u=> moved.forEach(i=> panelOf(u).suggestAt(i)));
  }
  // A card's view and its Results, after something outside it changed its data.
  function refreshCard(u){
    const U = panelOf(u);
    if (U.hasPlot() && !isFolded(u)) U.update(true);
    else renderAnalysisRes(u);
  }
  // An Urbach card given a new reference: placed on it (None leaves the lines be).
  function syncRefView(u){
    if (!files.length) return;
    if (refPanel(u)) panelOf(u).autoSuggestAll();
    refreshCard(u);
  }
  // What follows any change to the list of cards: references, names, Results order.
  function afterCardsChange(){
    const changed = fixRefs();
    refreshNames();
    placeRes();
    changed.forEach(syncRefView);
  }

  function autoName(a){
    if (a.type === 'tauc'){
      const P = panelOf(a);
      if (!P) return 'Tauc';
      const as = files.length ? files.map((f, i)=> P.params(i).a) : [P.params(0).a];
      // The transition the exponent stands for; mixed exponents (one mode) have none.
      const ex = as.every(v=> v === as[0]) && expOf(as[0]);
      return ex ? `Tauc: ${ex.name}` : 'Tauc';
    }
    const r = byId(a.ref);
    return r ? `Urbach · ${r.name}` : 'Urbach';
  }
  // Names are unique: a repeat gets " (2)", " (3)"... The Tauc ones are settled
  // first, since an Urbach card's automatic name carries its reference's.
  function refreshNames(){
    const used = new Set();
    const uniq = n =>{ let s = n, k = 2; while (used.has(s)) s = `${n} (${k++})`; used.add(s); return s; };
    ['tauc', 'urbach'].forEach(t=> analyses.filter(a=> a.type === t).forEach(a=>{
      a.name = uniq(a.nameAuto || !a.base ? autoName(a) : a.base);
    }));
    analyses.forEach(paintName);
    syncRefSelects();
  }
  function rename(a, v){
    v = v.trim();
    if (!v || v === autoName(a)){ a.nameAuto = true; a.base = ''; }
    else { a.nameAuto = false; a.base = v; }
    refreshNames();
    hist.commit();
  }
  // In file names: no path or reserved characters, and no comma (CSV names travel
  // comma-separated on their buttons). A colon, as in "Tauc: allowed direct", is
  // dropped rather than turned into "_", so the name still reads.
  const fileSafe = n => n.replace(/:/g, '').replace(/[\\/*?"<>|,]/g, '_');
  function nameDownloads(wrap, svgName, csvName){
    if (!wrap) return;
    wrap.querySelectorAll('.plot-dl-btn').forEach(b=>{ b.dataset.dlName = svgName; if (csvName) b.dataset.csvNames = csvName; });
    if (csvName) wrap.querySelectorAll('.plot-csv-btn').forEach(b=>{ b.dataset.csvNames = csvName; });
  }
  // The name field is as wide as the name, as the project name's is: from room for the
  // caret up to 3/4 of the card, past which the text scrolls (blurred, a "…").
  const nameCtx = document.createElement('canvas').getContext('2d');
  function fitName(a){
    const e = live.get(a.id);
    if (!e) return;
    const field = e.card.querySelector('.an-name'), cc = getComputedStyle(e.card);
    const room = e.card.clientWidth - parseFloat(cc.paddingLeft) - parseFloat(cc.paddingRight);
    if (room <= 0) return;   // not laid out (a hidden tab, no files yet): sized when shown
    const cs = getComputedStyle(field);
    nameCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const pad = 24;          // 2×9 padding + 2×1 border + a little caret slack
    field.style.width = Math.min(nameCtx.measureText(field.value).width + pad, room * 0.75) + 'px';
  }
  function paintName(a){
    const e = live.get(a.id);
    if (!e) return;
    const field = e.card.querySelector('.an-name');
    if (document.activeElement !== field) field.value = a.name;
    field.placeholder = autoName(a);
    fitName(a);
    const n = fileSafe(a.name), t = a.type === 'tauc';
    nameDownloads(e.card.querySelector('.plot-wrap'), `${n} - sample.svg`, t ? `${n} - analysis_info.csv` : '');
    if (e.res && e.res.dataset.kind === a.type){
      e.res.querySelector('.res-an-title').textContent = a.name;
      const [w1, w2] = e.res.querySelectorAll('.plot-wrap');
      nameDownloads(w1, `${n} - ${t ? 'Tauc' : 'Urbach'}_plot.svg`, `${n} - ${t ? 'tauc' : 'urbach'}_plot.csv`);
      nameDownloads(w2, `${n} - ${t ? 'Eg' : 'Eu'}_bar_chart.svg`, `${n} - ${t ? 'Eg' : 'Eu'}.csv`);
    }
  }
  function syncRefSelects(){
    const taucs = analyses.filter(a=> a.type === 'tauc');
    analyses.forEach(u=>{
      if (u.type !== 'urbach' || !live.has(u.id)) return;
      const p = 'an' + u.id, sel = document.getElementById(p + 'Ref');
      sel.replaceChildren(new Option('None', ''), ...taucs.map(t=> new Option(t.name, String(t.id))));
      sel.value = u.ref != null ? String(u.ref) : '';
      document.getElementById(p + 'LegBand').style.display = refPanel(u) ? '' : 'none';
    });
  }

  /* ---- Adding, closing, switching, choosing the reference ---- */
  // Bring a card's panel up to the files on show: inputs, plot, its Results.
  function startPanel(a){
    const P = panelOf(a);
    P.fit(); P.writeStoreToInputs(); P.syncModeButton();
    quietly(()=> P.initPlot());
    see(a);
    renderAnalysisRes(a);
  }
  function addAnalysis(type){
    const a = newAnalysis(type);
    analyses.push(a);
    mount(a);
    afterCardsChange();
    if (files.length){ panelOf(a).autoSuggestAll(); startPanel(a); }
    hist.commit();
    live.get(a.id).card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  // No confirmation: undo brings a closed card back.
  function removeAnalysis(a){
    unmount(a.id);
    analyses = analyses.filter(x=> x !== a);
    afterCardsChange();
    hist.commit();
  }
  // The card is rebuilt for the other kind in place, with that kind's settings if it
  // has had them; its first time as that kind, the lines are suggested.
  function switchKind(a, type){
    if (type === a.type || !KINDS[type]) return;
    const e = live.get(a.id);
    a.states[a.type] = e.panel.snapshot();
    a.type = type;
    buildCard(a, card=> e.card.replaceWith(card));
    afterCardsChange();
    if (files.length){ const P = panelOf(a); P.fit(); if (!P.suggested) P.autoSuggestAll(); startPanel(a); }
    hist.commit();
  }
  // A reference chosen by hand stays, wherever the cards are moved, while it is a Tauc card.
  function chooseRef(a, v){
    a.refAuto = false;
    a.ref = v === '' ? null : +v;
    afterCardsChange();
    syncRefView(a);
    hist.commit();
  }

  /* The kinds' menu, anchored as the composer's pickers are: the "+" bar opens it to
     add a card, a card's title to change its kind. The anchor again or a click
     anywhere else closes it, so does Escape; the anchor stays lit while it is open.
     A menu of our own rather than a <select>: the title's capitals would carry into
     a native list, which some systems draw with the select's own styling. */
  const kindMenu = (()=>{
    const el = document.createElement('div');
    el.className = 'an-menu';
    el.setAttribute('role', 'menu');
    el.hidden = true;
    el.innerHTML = Object.entries(KINDS).map(([k, l])=> `<button type="button" role="menuitem" data-kind="${k}">${l}</button>`).join('');
    document.body.appendChild(el);
    let anchor = null, pick = null, centred = false;
    const place = ()=>{
      const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8) top = r.top - h - 6;
      const left = centred ? r.left + r.width/2 - w/2 : r.left;
      el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, left)) + 'px';
      el.style.top = Math.max(8, top) + 'px';
    };
    const close = ()=>{
      el.hidden = true;
      if (anchor){ anchor.classList.remove('cp-anchored'); anchor.setAttribute('aria-expanded', 'false'); }
      anchor = pick = null;
    };
    const open = (a, onPick, { current, centre } = {})=>{
      if (anchor === a){ close(); return; }
      close();
      anchor = a; pick = onPick; centred = !!centre;
      el.querySelectorAll('[data-kind]').forEach(b=> b.classList.toggle('is-current', b.dataset.kind === current));
      el.hidden = false;
      a.classList.add('cp-anchored');
      a.setAttribute('aria-expanded', 'true');
      place();
    };
    el.addEventListener('click', e=>{
      const b = e.target.closest('[data-kind]');
      if (!b) return;
      const f = pick;
      close();
      f(b.dataset.kind);
    });
    document.addEventListener('pointerdown', e=>{
      if (!el.hidden && !el.contains(e.target) && !anchor.contains(e.target)) close();
    }, true);
    document.addEventListener('keydown', e=>{
      if (e.key === 'Escape' && !el.hidden){ e.stopPropagation(); close(); }
    }, true);
    window.addEventListener('scroll', ()=>{ if (!el.hidden) place(); }, true);
    window.addEventListener('resize', ()=>{ if (!el.hidden) place(); });
    return { open, close };
  })();
  const addBtn = document.getElementById('taucAddAn');
  addBtn.addEventListener('click', ()=> kindMenu.open(addBtn, addAnalysis, { centre: true }));

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
    const warnNames = taucWarnDismissed ? [] : allFiles.filter(f=>f.warn).map(f=>f.name);
    document.getElementById('taucAlerts').innerHTML =
      buildAlertsHtml(invalidUploadNames, warnNames, undefined, 'tauc-dismiss-invalid', 'tauc-dismiss-warn') + taucUploadAlerts;
  }

  // Per-sample lists follow the file list: the panels', and the ones each card keeps
  // for the kind it is not showing.
  function eachKeptState(fn){
    analyses.forEach(a=> Object.entries(a.states).forEach(([k, s])=>{ if (k !== a.type && s) fn(s); }));
  }
  // The same lists, each named by its card and kind, for the file list to keep
  // aligned with the included files. A file brought back in gets the parameters and
  // lines it left with, in each card that was there then; in a card added since, it
  // starts from the card's defaults, as a file uploaded into it does.
  const copyPer = p => p ? {...p, vlines: p.vlines ? {...p.vlines} : undefined} : {};
  function slots(){
    const out = [];
    analyses.forEach(a=>{
      Object.entries(a.states).forEach(([k, s])=>{ if (k !== a.type && s && s.per) out.push({ key: a.id + ':' + k, arr: s.per, make: copyPer }); });
      const P = panelOf(a);
      if (P) out.push({ key: a.id + ':' + a.type, arr: P.per, make: copyPer });
    });
    return out;
  }
  // The cards stay on the sample they showed when another is left out or taken in.
  function stayOn(f){ const k = includedOf(allFiles).indexOf(f); if (k >= 0) currIndex = k; }
  function fileCallbacks(){
    return {
      onRemove(i){
        removeFileAt(allFiles, i, slots());        // keep per-sample params aligned with files
        if (!allFiles.length) invalidUploadNames = [];
        rebuildTaucAlerts();
        afterFilesChange();
      },
      onReorder(from, to){
        moveFileTo(allFiles, from, to, slots());
        rebuildTaucAlerts(); afterFilesChange();
      },
      onInclude(i, on){ const was = files[currIndex]; setIncluded(allFiles, i, on, slots()); stayOn(was); afterFilesChange(); },
      onIncludeAll(on){ const was = files[currIndex]; allFiles.forEach((_, j)=> setIncluded(allFiles, j, on, slots())); stayOn(was); afterFilesChange(); },
      onLabelChange(i, v){ allFiles[i].label=v; renderResView(); hist.commit(); },
      onColorChange(i, v){ allFiles[i].color=v; renderResView(); hist.commit(); },
      onPaletteChange(colors){ allFiles.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){
        allFiles.length=0;
        livePanels().forEach(p=> p.clear());
        eachKeptState(s=>{ s.per = []; s.sharedVlines = {}; });
        invalidUploadNames=[]; taucUploadAlerts=''; taucWarnDismissed=false; rebuildTaucAlerts(); afterFilesChange();
      },
    };
  }

  /* ---- Undo/redo: snapshot the reversible state — file order/labels/colors, and
     every analysis card: its kind, name, fold, reference, and the line positions and
     parameters of both its kinds. Raw spectra arrays are shared by reference; only
     metadata is cloned. ---- */
  const clone = o => JSON.parse(JSON.stringify(o));
  function taucSnapshot(){
    return {
      files: allFiles.map(f=>({...f})),
      analyses: analyses.map(a=>{
        const states = {};
        Object.entries(a.states).forEach(([k, s])=>{ if (k !== a.type && s) states[k] = clone(s); });
        states[a.type] = panelOf(a).snapshot();
        return { id: a.id, type: a.type, base: a.base, nameAuto: a.nameAuto, collapsed: a.collapsed,
          ref: a.ref, refAuto: a.refAuto, egSel: a.egSel.slice(), urbSel: { l: a.urbSel.l.slice(), b: a.urbSel.b.slice() }, states };
      }),
    };
  }
  // Projects from before the analysis cards had one Tauc analysis, kept at the top
  // level, and an Urbach one beside it: the Tauc card comes first, and the Urbach one,
  // if it was on, follows it, read against it.
  function legacyAnalyses(s){
    const params = s.params ? Object.fromEntries(Object.entries(s.params)
      .filter(([k])=> /^tauc(?!U)/.test(k)).map(([k, v])=> [k.slice(4), v])) : undefined;
    const list = [{ id: 1, type: 'tauc', egSel: s.egSel,
      states: { tauc: { mode: s.mode, shared: s.shared, sharedVlines: s.sharedVlines, vlines: s.vlines, per: s.per, suggested: s.suggested, params } } }];
    if (s.urbachOn === true) list.push({ id: 2, type: 'urbach', states: { urbach: s.urbach || {} } });
    return list;
  }
  function readAnalysis(s){
    const eg = Array.isArray(s.egSel) ? s.egSel.filter(k=> EG_METHODS.some(m=> m.key === k)) : [];
    // Projects from before the subtraction show both, as a new card does.
    const us = sec =>{ const v = s.urbSel && Array.isArray(s.urbSel[sec]) ? s.urbSel[sec].filter(k=> URB_METHODS.some(m=> m.key === k)) : []; return v.length ? v : URB_METHODS.map(m=> m.key); };
    return {
      id: s.id, type: KINDS[s.type] ? s.type : 'tauc',
      base: typeof s.base === 'string' ? s.base : '', nameAuto: s.nameAuto !== false, name: '',
      collapsed: s.collapsed === true, ref: Number.isInteger(s.ref) ? s.ref : null, refAuto: s.refAuto !== false,
      egSel: eg.length ? eg : EG_METHODS.map(m=>m.key), urbSel: { l: us('l'), b: us('b') },
      states: Object.fromEntries(Object.entries(clone(s.states || {})).filter(([k])=> KINDS[k])),
    };
  }
  /* A card whose id and kind are both still there is kept, and its panel restored, so
     an undo does not rebuild the whole list; any other is built afresh. A kept record
     is updated in place: the card's handlers hold on to it. */
  function loadAnalyses(list){
    // A card of a kind there is no more (the debug defect band, taken out) is left
    // out, as are the settings a card kept for one.
    list = list.filter(s=> s && (s.type == null || KINDS[s.type]));
    const old = new Map(analyses.map(a=> [a.id, a]));
    const seen = new Set();
    let free = list.reduce((m, s)=> Number.isInteger(s.id) ? Math.max(m, s.id) : m, 0) + 1;
    const next = list.map(src=>{
      const s = readAnalysis(src);
      if (!Number.isInteger(s.id) || s.id < 1 || seen.has(s.id)) s.id = free++;
      seen.add(s.id);
      const a = old.get(s.id);
      if (a && a.type === s.type && live.has(a.id)){
        old.delete(a.id);
        Object.assign(a, s);
        live.get(a.id).panel.restore(a.states[a.type] || {});
        applyFold(a);
        return a;
      }
      return s;
    });
    // Left in `old`: gone, or back as the other kind.
    old.forEach(a=> unmount(a.id));
    analyses = next;
    analyses.forEach(a=>{ if (!live.has(a.id)) mount(a); });
    placeCards();
    fixRefs();
    refreshNames();
    placeRes();
  }
  function taucRestore(s){
    allFiles = s.files.map(f=>({...f}));
    files = includedOf(allFiles);
    loadAnalyses(Array.isArray(s.analyses) ? s.analyses : legacyAnalyses(s));
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
  registerTabRedraw('tauc', ()=>{
    if (!files.length) return;
    analyses.forEach(fitName);
    quietly(()=> livePanels().forEach(p=>{ if (p.hasPlot()) p.update(true); }));
    renderResView();
  });

  setupDropzone('taucDropzone', 'taucFiles', async (fileList)=>{
    const hadFiles = allFiles.length > 0;   // auto-suggest only on the first upload
    const existing = new Set(allFiles.map(f=>f.name));
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
      if (wl.length){
        // A new file comes in included, so it goes last among the included as well.
        const file = {name:f.name, label:f.name.replace(/\.[^.]+$/,''), wl, FR:fr, warn, color:nextColor(allFiles), rawBytes};
        allFiles.push(file); files.push(file);
        livePanels().forEach(p=> p.add());
        eachKeptState(s=>{ if (s.per) s.per.push({}); });
      }
    }
    invalidUploadNames = newInvalid;
    taucWarnDismissed = false;
    taucUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'tauc-dismiss-upload') : '';
    rebuildTaucAlerts();
    afterFilesChange();
    // Once, when the first data lands: propose optimal interval-line positions. The
    // Tauc cards go first: the Urbach ones are placed on their regions.
    if (!hadFiles && files.length){
      quietly(()=> ['tauc', 'urbach'].forEach(t=> analyses.filter(a=> a.type === t).forEach(a=>{
        const P = panelOf(a); P.autoSuggestAll(); P.writeStoreToInputs(); P.update();
      })));
      analyses.forEach(see);
      refreshNames();
      renderResView();
      hist.commit();
    }
  });

  const SHOWN = ['taucAnalyses','taucResults'];
  function afterFilesChange(){
    files = includedOf(allFiles);
    setTabLoaded('tauc', allFiles.length);
    renderUnifiedFileList('taucFileTableWrap', allFiles, fileCallbacks());
    if (files.length) setupAnalysis();
    else { SHOWN.forEach(id=> document.getElementById(id).style.display='none'); refreshNames(); }
    hist.commit(); // baseline + file add/remove/reorder/palette
  }

  // Energy axis is hc/λ — each file stays on its own native grid. hc in eV·nm to the
  // digits a third decimal of E_g needs: 1240 put every energy 0.013% high.
  const HC = 1239.842;
  function setupAnalysis(){
    files.forEach(f=>{ f.hv = f.wl.map(wl=>HC/wl); });
    if (currIndex >= files.length) currIndex = files.length-1;
    if (currIndex < 0) currIndex = 0;
    SHOWN.forEach(id=> document.getElementById(id).style.display='block');
    // Every panel fitted to the files before any is drawn: an Urbach card's band is
    // read off its reference, which may sit below it.
    livePanels().forEach(p=> p.fit());
    quietly(()=> livePanels().forEach(p=>{
      p.writeStoreToInputs();      // reflect the current sample's params in the inputs
      p.syncModeButton();
      p.initPlot();
    }));
    analyses.forEach(see);
    refreshNames();
    renderResView();
  }

  // Union of all files' ranges (for shared overlay axes)
  function unionWl(){ let lo=Infinity,hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,minArr(f.wl)); hi=Math.max(hi,maxArr(f.wl)); }); return [lo,hi]; }
  function unionHv(){ let lo=Infinity,hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,minArr(f.hv)); hi=Math.max(hi,maxArr(f.hv)); }); return [lo,hi]; }

  /* ---- Results: the Kubelka-Munk plot, then each card's pair of charts under its
     name, in card order ---- */
  const resList = document.getElementById('taucResList');
  function resHtml(a){
    const p = 'an' + a.id, t = a.type === 'tauc';
    return `
        <h4 class="res-an-title"></h4>
        <div class="row res-row">
          <div class="col">
            <p class="txt-caption">${t ? 'Tauc Plot' : 'Urbach Plot'}</p>
            ${plotWrap(p + 'R1', p + 'RL1', true, t ? '' : `\n              <span class="plot-chips" id="${p}UrbSelL"></span>`)}
            <div id="${p}RL1" class="legend"></div>
          </div>
          <div class="col">
            <p class="txt-caption" id="${p}BarTitle">${t ? 'Energy Band Gap' : 'Urbach Energy'}</p>
            ${plotWrap(p + 'R2', p + 'RL2', true, `\n              <span class="plot-chips" id="${p}${t ? 'EgSel' : 'UrbSelB'}"></span>`)}
            <div id="${p}RL2" class="legend"></div>
            <div id="${p}RA" class="bar-alert"></div>
          </div>
        </div>`;
  }
  // A card's section of the Results, made for its kind (again, if the kind changed).
  // Named before anything is drawn in it: the plots' CSV buttons are built from the
  // names their download buttons carry.
  function ensureRes(a){
    const e = live.get(a.id);
    if (e.res && e.res.dataset.kind === a.type) return e.res;
    if (e.res) e.res.remove();
    const sec = document.createElement('div');
    sec.className = 'res-an';
    sec.dataset.an = a.id;
    sec.dataset.kind = a.type;
    sec.innerHTML = resHtml(a);
    e.res = sec;
    e.resPlot = null;
    placeRes();
    paintName(a);
    return sec;
  }
  const placeRes = ()=> analyses.forEach(a=>{ const e = live.get(a.id); if (e && e.res) resList.appendChild(e.res); });

  function renderResView(){
    if (!files.length) return;
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
    renderLogView();
    analyses.forEach(renderAnalysisRes);
  }
  // F(R) against hν on a log y-axis: the absorption edge and the tail below it, over
  // the decades they span, on the energy axis the analyses work on. The plot draws
  // log10 F(R); a point with F(R) ≤ 0 has none and is left out.
  function renderLogView(){
    if (!resPlotLog){
      // A wider left margin than the default 55: powers of ten are wider tick labels
      // than numbers, and in an export (type ×1.6) they reached the axis title.
      resPlotLog = new Plot(document.getElementById('taucResSvgLog'), {xlabel:'Energy (eV)', ylabel:'F(R) (a. u.)', xTickStep:0.5, yLog:true, margin:{l:66,r:20,t:15,b:40}});
      resPlotLog.attachTools(resPlotLog.svg.closest('.plot-wrap'));
    }
    const p = resPlotLog; p.clearData();
    const leg = document.getElementById('taucResLegendLog'); leg.innerHTML='';
    const logs = files.map(f=> f.FR.map(v=> v > 0 ? Math.log10(v) : NaN));
    let lo = Infinity, hi = -Infinity;
    logs.forEach(a=> a.forEach(v=>{ if (isFinite(v)){ lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    if (!isFinite(lo)){ lo = -1; hi = 0; }
    const pad = 0.04 * Math.max(hi - lo, 0.1), [hv0, hv1] = unionHv();
    p.setRange(hv0, hv1, lo - pad, hi + pad);
    p.drawAxes();
    files.forEach((f,k)=>{
      // The composer takes F(R) itself and draws it on a log axis of its own, which
      // can then be switched off like any other.
      p.line(f.hv, logs[k], f.color, 1.3, undefined, { label: f.label, key: f.name, raw: { xs: f.hv, ys: f.FR } });
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${f.color}"></i>${f.label}`; leg.appendChild(s);
    });
  }
  function renderAnalysisRes(a){
    if (!files.length || !live.has(a.id)) return;
    ensureRes(a);
    if (a.type === 'tauc') drawTaucRes(a); else drawUrbachRes(a);
  }
  // The section's own plot of every sample (reused while the section lasts).
  function resPlotOf(a, opts){
    const e = live.get(a.id), svg = document.getElementById('an' + a.id + 'R1');
    if (!e.resPlot || e.resPlot.svg !== svg){
      e.resPlot = new Plot(svg, opts);
      e.resPlot.attachTools(svg.closest('.plot-wrap'));
    }
    return e.resPlot;
  }

  // A Tauc card's pair: every sample's Tauc curve with its two fits, and the gaps.
  function drawTaucRes(a){
    const P = panelOf(a), p = 'an' + a.id, $ = id => document.getElementById(p + id);
    const fits = files.map((f,k)=> P.analyze(k));
    // Effective exponent per file; when uniform, show it on the shared Tauc axis,
    // otherwise fall back to a generic "a" (samples may use different exponents).
    const aVals = files.map((f,k)=> P.params(k).a);
    const aUniform = aVals.every(v=>v===aVals[0]);
    const aLabel = aUniform ? fmtA(aVals[0]) : 'a';

    const plot1 = resPlotOf(a, {xlabel:'Energy (eV)', xTickStep:0.5, noYTickLabels:true});
    plot1.clearData();
    plot1.ylabelSvg = `[F(R)·hν]${sup(aLabel)} (a. u.)`;
    const leg1 = $('RL1'); leg1.innerHTML='';
    const Ys_all = files.map((f,k)=>{
      const fp = P.params(k);
      const Yraw = f.FR.map((v,i)=>Math.pow(v*f.hv[i], fp.a));
      return movingAverage(Yraw, fp.N);
    });
    const ymax1 = Math.max(...Ys_all.map(maxArr));
    const [hv0, hv1] = unionHv();
    plot1.setRange(hv0, hv1, 0, ymax1);
    plot1.drawAxes();
    files.forEach((f,k)=>{
      plot1.line(f.hv, Ys_all[k], f.color, 1.1, undefined, { label: f.label, key: f.name });
      const r = fits[k];
      // regs fits the steep edge between the red lines (the Tauc region: its x-axis
      // intercept is Eg), regs2 the flat stretch between the magenta ones (the
      // baseline: where the two cross is Eg from the baseline).
      if (isFinite(r.regs.slope)){
        const xExt = linspace(hv0, hv1, 100);
        plot1.line(xExt, xExt.map(x=>r.regs.slope*x+r.regs.intercept), f.color, 1, '5,4',
                   { label: `${f.label} Tauc`, key: `${f.name}/regs line` });
      }
      if (isFinite(r.regs2.slope)){
        const xExt = linspace(hv0, hv1, 100);
        plot1.line(xExt, xExt.map(x=>r.regs2.slope*x+r.regs2.intercept), f.color, 1, '2,3',
                   { label: `${f.label} baseline`, key: `${f.name}/regs2 line` });
      }
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${f.color}"></i>${f.label}`; leg1.appendChild(s);
    });

    // The Eg bar chart. With mixed exponents (per-sample mode) there is no single
    // Direct/Indirect qualifier, so drop it from the title and axis label. A forbidden
    // transition says so in the title only: the axis has no room for it on a phone.
    const ex = aUniform ? expOf(aVals[0]) : null, egLabel = ex ? ex.gap : '';
    $('BarTitle').textContent = (egLabel ? (ex.forbidden ? 'Forbidden ' : '') + egLabel + ' ' : '') + 'Energy Band Gap';
    const leg2 = $('RL2'); leg2.innerHTML='';
    renderEgSel(a);
    const vals = { x: fits.map(r=>r.Eg),    b: fits.map(r=>r.EgInt) };
    const errs = { x: fits.map(r=>r.EgErr), b: fits.map(r=>r.EgIntErr) };
    const shown = EG_METHODS.filter(m=> a.egSel.includes(m.key)).map(m=> ({ ...m, vals: vals[m.key], errs: errs[m.key] }));
    $('RA').innerHTML = shown.map(m=> negWarnHtml(m.vals, `E<sub>g</sub> (${m.label})`)).join('');
    const yLabel = `${egLabel ? egLabel+' ' : ''}Band Gap E<tspan baseline-shift="sub" font-size="8">g</tspan> (eV)`;
    if (drawValueBars($('R2'), shown, { chips: $('EgSel'), yLabel, digits: 3 }))
      leg2.innerHTML = shown.map(m=> `<span><i class="mk-box" style="background:${m.color}"></i>${m.name}</span>`).join('');
  }

  // An Urbach card's pair: every sample's ln F(R) with its Urbach fit, drawn as the
  // Tauc plot is, and E_U beside it as the gaps are — each plain, with the Tauc baseline
  // subtracted, or both, as the chips on each say.
  function drawUrbachRes(a){
    const P = panelOf(a), p = 'an' + a.id, $ = id => document.getElementById(p + id);
    const fits = files.map((f,k)=> P.analyze(k));
    const curves = files.map((f,k)=> ({
      p: movingAverage(f.FR.map(v=> v > 0 ? Math.log(v) : NaN), P.params(k).N),
      s: fits[k].sub ? fits[k].sub.Ys : null,
    }));
    const fitOf = (k, m)=> m.key === 'p' ? fits[k].regs : fits[k].sub && fits[k].sub.regs;
    // What each chart can show: the subtracted series only where a reference gave one.
    const canL = { p: true, s: curves.some(c=> c.s && c.s.some(isFinite)) };
    const vals = { p: fits.map(r=> r.Eu*1000), s: fits.map(r=> r.sub ? r.sub.Eu*1000 : NaN) };
    const errs = { p: fits.map(r=> r.EuErr*1000), s: fits.map(r=> r.sub ? r.sub.EuErr*1000 : NaN) };
    const canB = { p: true, s: vals.s.some(v=> isFinite(v) && v > 0) };
    renderUrbSel(a, canL, canB);
    const showL = URB_METHODS.filter(m=> urbOn(a, 'l', canL).includes(m.key));
    const showB = URB_METHODS.filter(m=> urbOn(a, 'b', canB).includes(m.key));

    const plot3 = resPlotOf(a, {xlabel:'Energy (eV)', ylabelSvg:'ln[F(R)] (a. u.)', xTickStep:0.5, noYTickLabels:true});
    plot3.clearData();
    const leg3 = $('RL1'); leg3.innerHTML='';
    /* The y-range is the plain curves', as it was, whenever they are on show: a
       subtracted curve runs down without end where F(R) − F_b goes to zero, below the
       tail, and that part is clipped. Shown alone, the subtracted curves are ranged
       from each one's Urbach region up, the bottom at their 5th percentile there. */
    let yLo = Infinity, yHi = -Infinity;
    if (showL.some(m=> m.key === 'p')) curves.forEach(c=>{
      const v = c.p.filter(isFinite);
      if (v.length){ yLo = Math.min(yLo, minArr(v)); yHi = Math.max(yHi, maxArr(v)); }
    });
    else curves.forEach((c, k)=>{
      if (!c.s) return;
      const vl = P.vlinesFor(k), from = Math.min(vl.v1, vl.v2);
      const v = c.s.filter((y, i)=> isFinite(y) && files[k].hv[i] >= from).sort((x, y)=> x - y);
      if (v.length){ yLo = Math.min(yLo, v[Math.floor(0.05*(v.length - 1))]); yHi = Math.max(yHi, v[v.length - 1]); }
    });
    if (!(yLo < yHi)){ yLo = 0; yHi = 1; }
    const pad = 0.05*(yHi - yLo);
    const [hv0, hv1] = unionHv();
    plot3.setRange(hv0, hv1, yLo - pad, yHi + pad);
    plot3.drawAxes();
    const xExt = linspace(hv0, hv1, 100);
    files.forEach((f,k)=>{
      showL.forEach(m=>{
        const ys = curves[k][m.key];
        if (!ys) return;
        const name = showL.length > 1 && m.key === 's' ? `${f.label} (subtracted)` : f.label;
        plot3.line(f.hv, ys, f.color, 1.1, m.dash || undefined, { label: name, key: m.key === 'p' ? f.name : `${f.name}/sub` });
        const r = fitOf(k, m);
        if (r && isFinite(r.slope))
          plot3.line(xExt, xExt.map(x=>r.slope*x+r.intercept), f.color, 1, m.fitDash,
                     { label: `${name} Urbach`, key: m.key === 'p' ? `${f.name}/regs line` : `${f.name}/sub regs line` });
        const key = m.dash ? `<i class="mk-dash" style="color:${f.color}"></i>` : `<i style="background:${f.color}"></i>`;
        const s=document.createElement('span'); s.innerHTML=`${key}${name}`; leg3.appendChild(s);
      });
    });

    // The E_U bar chart, in meV as the Urbach card shows it: the plain and the
    // subtracted E_U side by side in each sample's slot, as the gaps' two are.
    const leg4 = $('RL2'); leg4.innerHTML='';
    const shown = showB.map(m=> ({ ...m, vals: vals[m.key], errs: errs[m.key] }));
    $('RA').innerHTML = shown.map(m=> negWarnHtml(m.vals, m.key === 'p' ? 'E<sub>U</sub>' : 'E<sub>U</sub> (subtracted)')).join('');
    const yLabel = 'Urbach Energy E<tspan baseline-shift="sub" font-size="8">U</tspan> (meV)';
    if (drawValueBars($('R2'), shown, { chips: $('UrbSelB'), yLabel, digits: 1 }))
      leg4.innerHTML = shown.map(m=> `<span><i class="mk-box" style="background:${m.color}"></i>${m.name}</span>`).join('');
  }
  /* The chips of an Urbach card's two charts, one row each, GC's gas chips over again:
     a series the data cannot give (no reference: nothing subtracted) is there but
     disabled, and never are both off. */
  // The series a chart shows: those chosen that the data can give, else the plain one.
  // The choice itself is kept, so a series that comes back is shown again.
  function urbOn(a, sec, can){
    const eff = a.urbSel[sec].filter(k=> can[k]);
    return eff.length ? eff : ['p'];
  }
  function renderUrbSel(a, canL, canB){
    for (const [sec, can] of [['l', canL], ['b', canB]]){
      const el = document.getElementById('an' + a.id + (sec === 'l' ? 'UrbSelL' : 'UrbSelB'));
      if (!el) continue;
      const eff = urbOn(a, sec, can);
      el.innerHTML = URB_METHODS.map(m=>{
        const on = eff.includes(m.key), only = on && eff.length === 1;
        const title = !can[m.key] ? 'Nothing subtracted: the card has no Tauc reference, or its baseline has no fit'
                    : only ? `${m.label} — the only one shown` : `Show / hide ${m.label}`;
        return `<button type="button" class="mode-chip plot-chip${on ? ' is-on' : ''}" data-urb="${m.key}" data-sec="${sec}"`
             + ` title="${title}"${can[m.key] ? '' : ' disabled'}>${m.label}</button>`;
      }).join('');
    }
  }
  resList.addEventListener('click', e=>{
    const b = e.target.closest('[data-urb]'), sec = b && b.closest('.res-an');
    const a = sec && byId(+sec.dataset.an);
    if (!a || b.disabled) return;
    const s = b.dataset.sec, key = b.dataset.urb;
    // What is on show, of what can be: a click never leaves a chart with nothing.
    const on = [...b.parentElement.querySelectorAll('.plot-chip.is-on')].map(x=> x.dataset.urb);
    const isOn = on.includes(key);
    if (isOn && on.length === 1) return;
    a.urbSel[s] = URB_METHODS.map(m=> m.key).filter(k=> k === key ? !isOn : on.includes(k));
    renderAnalysisRes(a);
    hist.commit();
  });

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
    // How the names are cut and tilted — see barNames.
    const fit = barNames(mctx, files.map(f=> f.label), Math.max(60, svgW - 75), 55, files.map((f,k)=> has(k)));
    const labels = fit.labels;
    const labelWs = labels.map((lbl,k)=> has(k) ? mctx.measureText(lbl).width : 0);
    let maxLbl = 0; labelWs.forEach(w=>maxLbl=Math.max(maxLbl, w));
    const bottom = Math.round(26 + maxLbl*fit.sin);
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
    // Fixed at [0, n+1]: the names are made to fit it, not the other way round.
    const x0 = 0, x1 = n+1;
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
     hide it, and never both hidden — the chart would be empty. Each Tauc card has its
     own choice. */
  function renderEgSel(a){
    const el = document.getElementById('an' + a.id + 'EgSel');
    if (!el) return;
    el.innerHTML = EG_METHODS.map(m=>{
      const on = a.egSel.includes(m.key), only = on && a.egSel.length === 1;
      return `<button type="button" class="mode-chip plot-chip${on ? ' is-on' : ''}" data-eg="${m.key}"`
           + ` title="${only ? `${m.name} — the only one shown` : `Show / hide ${m.name}`}">${m.label}</button>`;
    }).join('');
  }
  resList.addEventListener('click', e=>{
    const b = e.target.closest('[data-eg]'), sec = b && b.closest('.res-an');
    const a = sec && byId(+sec.dataset.an);
    if (!a) return;
    const key = b.dataset.eg, on = a.egSel.includes(key);
    if (on && a.egSel.length === 1) return;
    a.egSel = EG_METHODS.map(m=>m.key).filter(k=> k === key ? !on : a.egSel.includes(k));
    renderAnalysisRes(a);
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
  // The reflectance once, then each card's files, prefixed with its name.
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
    // FR_vs_energy.csv — (energy, F(R)) per sample: the log-scale plot's data, as values
    {
      const cols=[];
      files.forEach(f=>{
        cols.push({h:'energy_eV_'+f.label, v:f.hv.map(x=>fmtNum(x,6))});
        cols.push({h:f.label,              v:f.FR.map(x=>fmtNum(x,6))});
      });
      entries.push({name:'FR_vs_energy.csv', text:wideCsv(cols)});
    }
    analyses.forEach(a=>{
      const P = panelOf(a);
      if (!P) return;
      const n = fileSafe(a.name), fits = files.map((f,k)=> P.analyze(k));
      if (a.type === 'tauc') entries.push(...taucCsvs(n, P, fits));
      else entries.push(...urbachCsvs(n, P, fits));
    });
    return entries;
  }
  function taucCsvs(n, P, fits){
    const entries = [];
    // tauc_plot.csv — per sample: energy, [F(R)·hν]^a, linear-region regression,
    // baseline regression (both evaluated on the sample's own energy grid)
    {
      const cols=[];
      files.forEach((f,k)=>{
        const r = fits[k];
        cols.push({h:'energy_eV_'+f.label,       v:f.hv.map(x=>fmtNum(x,6))});
        // The curve as plotted and fitted: smoothed with the card's window.
        const fp = P.params(k), Ys = movingAverage(f.FR.map((v,i)=> Math.pow(v*f.hv[i], fp.a)), fp.N);
        cols.push({h:f.label,                    v:Ys.map(v=> fmtNum(v,6))});
        cols.push({h:f.label+'_reg_linear',      v:f.hv.map(hv=> fmtNum(r.regs.slope*hv  + r.regs.intercept, 6))});
        cols.push({h:f.label+'_reg_baseline',    v:f.hv.map(hv=> fmtNum(r.regs2.slope*hv + r.regs2.intercept, 6))});
      });
      entries.push({name:`${n} - tauc_plot.csv`, text:wideCsv(cols)});
    }
    // Eg.csv — bar-plot-like summary (one row per sample), both Eg estimates + errors
    {
      let t = csvLine(['Sample','Eg','Eg_err','Eg_baseline','Eg_baseline_err']);
      files.forEach((f,k)=>{
        const r = fits[k];
        t += csvLine([f.label, fmtNum(r.Eg,6), fmtNum(r.EgErr,6), fmtNum(r.EgInt,6), fmtNum(r.EgIntErr,6)]);
      });
      entries.push({name:`${n} - Eg.csv`, text:t});
    }
    // analysis_info.csv — per-sample regression settings & results (the info that
    // is otherwise only readable off the Analysis plot). Endpoints are in eV, taken
    // from the best-fit window; R²/NRMSE are the fit-quality metrics for each line.
    {
      let t = csvLine(['Sample','Tauc Exponent','Smoothing points',
        'Tauc regression points','Tauc start (eV)','Tauc end (eV)','Tauc R^2','Tauc NRMSE',
        'Baseline regression points','Baseline start (eV)','Baseline end (eV)','Baseline R^2','Baseline NRMSE']);
      files.forEach((f,k)=>{
        const fp = P.params(k), r = fits[k];
        const span = (reg) => {
          const idx = reg && reg.bestIdx;
          if (!idx || !idx.length) return ['',''];
          let lo=Infinity, hi=-Infinity;
          idx.forEach(i=>{ const e=f.hv[i]; if(e<lo)lo=e; if(e>hi)hi=e; });
          return [fmtNum(lo,6), fmtNum(hi,6)];
        };
        const [ts,te] = span(r.regs), [bs,be] = span(r.regs2);
        t += csvLine([f.label, +fp.a.toFixed(6), fp.N, fp.M, ts, te,
          isFinite(r.regs.R2)?fmtNum(r.regs.R2,6):'', isFinite(r.regs.NRMSE)?fmtNum(r.regs.NRMSE,6):'',
          fp.M2, bs, be,
          isFinite(r.regs2.R2)?fmtNum(r.regs2.R2,6):'', isFinite(r.regs2.NRMSE)?fmtNum(r.regs2.NRMSE,6):'']);
      });
      entries.push({name:`${n} - analysis_info.csv`, text:t});
    }
    return entries;
  }
  function urbachCsvs(n, P, fits){
    const entries = [];
    // urbach_plot.csv — per sample: energy, ln F(R) and the Urbach regression, on the
    // sample's own grid (F(R) ≤ 0 has no logarithm: left empty)
    {
      const cols=[];
      files.forEach((f,k)=>{
        const r = fits[k].regs;
        cols.push({h:'energy_eV_'+f.label,  v:f.hv.map(x=>fmtNum(x,6))});
        // As plotted and fitted: smoothed with the card's window.
        const Ys = movingAverage(f.FR.map(v=> v > 0 ? Math.log(v) : NaN), P.params(k).N);
        cols.push({h:f.label,               v:Ys.map(v=> isFinite(v) ? fmtNum(v,6) : '')});
        cols.push({h:f.label+'_reg_urbach', v:f.hv.map(hv=> isFinite(r.slope) ? fmtNum(r.slope*hv + r.intercept, 6) : '')});
        // With the reference Tauc card's baseline taken out of F(R) (empty with none).
        const sb = fits[k].sub, g = sb && sb.regs;
        cols.push({h:f.label+'_subtracted',            v:f.hv.map((_, i)=> sb && isFinite(sb.Ys[i]) ? fmtNum(sb.Ys[i],6) : '')});
        cols.push({h:f.label+'_reg_urbach_subtracted', v:f.hv.map(hv=> g && isFinite(g.slope) ? fmtNum(g.slope*hv + g.intercept, 6) : '')});
      });
      entries.push({name:`${n} - urbach_plot.csv`, text:wideCsv(cols)});
    }
    // Eu.csv — bar-plot-like summary, E_U and its error in meV as the chart shows them
    {
      let t = csvLine(['Sample','Eu_meV','Eu_err_meV','Eu_subtracted_meV','Eu_subtracted_err_meV']);
      const meV = v => isFinite(v) ? fmtNum(v*1000,6) : '';
      files.forEach((f,k)=>{
        const r = fits[k], sb = r.sub || {};
        t += csvLine([f.label, meV(r.Eu), meV(r.EuErr), meV(sb.Eu), meV(sb.EuErr)]);
      });
      entries.push({name:`${n} - Eu.csv`, text:t});
    }
    return entries;
  }
  registerCsvExport('tauc', exportTaucZip);

  // A new project starts with one Tauc card.
  analyses = [newAnalysis('tauc')];
  analyses.forEach(a=> mount(a));
  refreshNames();
})();
