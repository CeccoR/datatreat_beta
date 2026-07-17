import { settings, redrawAll, makeCsvButton, fitCsvIcons } from './utils.js';

/* =========================================================
   SVG PLOT HELPER (shared)
========================================================= */
function niceStep(rough){
  if (rough <= 0) return 1;
  const exp = Math.floor(Math.log10(rough));
  const f = rough / Math.pow(10, exp);
  const nice = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return nice * Math.pow(10, exp);
}
function niceTicks(min, max, n){
  if (max <= min) return [min];
  const step = niceStep((max - min) / n);
  const start = Math.ceil(min / step - 1e-9) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 1e-9; v += step){
    const r = Math.round(v / step) * step;
    if (r >= min - step * 1e-9 && r <= max + step * 1e-9) ticks.push(r);
  }
  return ticks;
}
function fixedTicks(min, max, step){
  const ticks = [];
  const start = Math.ceil(min / step - 1e-9) * step;
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}
function fmtTick(v){
  if (Math.abs(v) < 1e-10) return '0';
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 100)  return parseFloat(v.toFixed(1)) + '';
  if (abs >= 10)   return parseFloat(v.toFixed(2)) + '';
  if (abs >= 1)    return parseFloat(v.toFixed(3)) + '';
  if (abs >= 0.1)  return parseFloat(v.toFixed(4)) + '';
  return parseFloat(v.toPrecision(3)) + '';
}
function svgEl(tag, attrs){
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
class Plot{
  constructor(svg, opts){
    this.svg = svg;
    this._opts = opts || {};
    this.margin = this._opts.margin || {l:55,r:20,t:15,b:40};
    this.xlabel = this._opts.xlabel||''; this.ylabel = this._opts.ylabel||''; this.ylabelSvg = this._opts.ylabelSvg||'';
    this.noXTickLabels = this._opts.noXTickLabels || false;
    this.noYTickLabels = this._opts.noYTickLabels || false;
    this.svg.innerHTML='';
    this._clipId = 'pc-' + (svg.id || Math.random().toString(36).slice(2));
    const defs = svgEl('defs',{});
    const cp = svgEl('clipPath',{id: this._clipId});
    this._clipRect = svgEl('rect',{x:0,y:0,width:0,height:0});
    cp.appendChild(this._clipRect); defs.appendChild(cp);
    this.gAxes = svgEl('g',{'class':'plot-gaxes'});
    this.gData = svgEl('g',{'class':'plot-gdata','clip-path':`url(#${this._clipId})`});
    this.gOverlay = svgEl('g',{'class':'plot-goverlay','clip-path':`url(#${this._clipId})`});
    this.gCross = svgEl('g',{'class':'plot-cross','pointer-events':'none'});
    this.svg.appendChild(defs); this.svg.appendChild(this.gAxes); this.svg.appendChild(this.gData); this.svg.appendChild(this.gOverlay); this.svg.appendChild(this.gCross);
    this.svg._plot = this;
    this._stored = [];
    this._mode = null;
    this._onModeChange = null;
    this._initInteraction();
  }
  size(){
    const r = this.svg.getBoundingClientRect();
    return {w: r.width||900, h: r.height||480};
  }
  setRange(xmin,xmax,ymin,ymax){
    if (xmax===xmin) xmax=xmin+1; if (ymax===ymin) ymax=ymin+1;
    this.xmin=xmin; this.xmax=xmax; this.ymin=ymin; this.ymax=ymax;
    this._origXmin=xmin; this._origXmax=xmax; this._origYmin=ymin; this._origYmax=ymax;
    this._stored=[];
  }
  clearData(){
    this._stored=[]; this.gData.innerHTML=''; this.gOverlay.innerHTML='';
  }
  clearOverlay(){
    this._stored = this._stored.filter(e=>e.type!=='vline');
    this.gOverlay.innerHTML='';
  }
  setMode(mode){
    if (mode!=='pan' && mode!=='zoom') mode = null; // enforce a single, valid state
    this._mode = mode;
    const active = mode==='pan' || mode==='zoom';
    this.svg.style.cursor = mode==='pan' ? 'move' : mode==='zoom' ? 'crosshair' : '';
    // Suppress text selection whenever a tool is armed (not just while dragging),
    // on both the SVG and the wrapper, so stray clicks can't select page text.
    this.svg.style.userSelect = this.svg.style.webkitUserSelect = active ? 'none' : '';
    const wrap = this.svg.closest('.plot-wrap');
    if (wrap){ wrap.style.userSelect = wrap.style.webkitUserSelect = active ? 'none' : ''; wrap.classList.toggle('tool-armed', active); }
    if (this._onModeChange) this._onModeChange(mode);
  }
  px(x){ const {w}=this.size(); const m=this.margin; return m.l + (x-this.xmin)/(this.xmax-this.xmin)*(w-m.l-m.r); }
  py(y){ const {h}=this.size(); const m=this.margin; return h-m.b - (y-this.ymin)/(this.ymax-this.ymin)*(h-m.t-m.b); }
  invX(px){ const {w}=this.size(); const m=this.margin; return this.xmin + (px-m.l)/(w-m.l-m.r)*(this.xmax-this.xmin); }
  invY(py){ const {h}=this.size(); const m=this.margin; return this.ymin + (h-m.b-py)/(h-m.t-m.b)*(this.ymax-this.ymin); }
  drawAxes(){
    this.gAxes.innerHTML='';
    const {w,h} = this.size(); const m=this.margin;
    this._clipRect.setAttribute('x', m.l); this._clipRect.setAttribute('y', m.t);
    this._clipRect.setAttribute('width', Math.max(1,w-m.l-m.r)); this._clipRect.setAttribute('height', Math.max(1,h-m.t-m.b));
    this.gAxes.appendChild(svgEl('rect',{x:m.l,y:m.t,width:Math.max(1,w-m.l-m.r),height:Math.max(1,h-m.t-m.b),fill:'none',stroke:'#3a414c','class':'plot-border'}));
    const xTicks = this._opts.xTickStep ? fixedTicks(this.xmin, this.xmax, this._opts.xTickStep) : niceTicks(this.xmin, this.xmax, 5);
    const drawXTick = (xv, anchor)=>{
      const px = this.px(xv);
      this.gAxes.appendChild(svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'#262c35','class':'plot-grid'}));
      if (!this.noXTickLabels){
        const t = svgEl('text',{x:px,y:h-m.b+16,'font-size':10,fill:'#93a0b0','text-anchor':anchor||'middle','class':'plot-tick'});
        t.textContent = fmtTick(xv); this.gAxes.appendChild(t);
      }
    };
    for (const xv of xTicks) drawXTick(xv);
    if (this._opts.xTickEdges){
      const span = this.xmax - this.xmin;
      const tol = span * 0.05;
      if (!xTicks.some(v=>Math.abs(v-this.xmin)<tol)) drawXTick(this.xmin, 'start');
      if (!xTicks.some(v=>Math.abs(v-this.xmax)<tol)) drawXTick(this.xmax, 'end');
    }
    if (!this.noYTickLabels){
      for (const yv of niceTicks(this.ymin, this.ymax, 5)){
        const py = this.py(yv);
        const t = svgEl('text',{x:m.l-6,y:py+3,'font-size':10,fill:'#93a0b0','text-anchor':'end','class':'plot-tick'});
        t.textContent = fmtTick(yv); this.gAxes.appendChild(t);
      }
    }
    const xl = svgEl('text',{x:w/2,y:h-4,'font-size':11,fill:'#c4ccd6','text-anchor':'middle','class':'plot-label'}); xl.textContent=this.xlabel;
    const yl = svgEl('text',{x:12,y:h/2,'font-size':11,fill:'#c4ccd6','text-anchor':'middle',transform:`rotate(-90 12 ${h/2})`,'class':'plot-label'});
    if(this.ylabelSvg) yl.innerHTML=this.ylabelSvg; else yl.textContent=this.ylabel;
    this.gAxes.appendChild(xl); this.gAxes.appendChild(yl);
  }
  line(xs, ys, color, width, dash){
    const entry = {type:'line', xs, ys, color, width, dash};
    this._stored.push(entry);
    return this._renderLine(entry);
  }
  // Open-circle scatter (unconnected). Only points within the x-view are drawn.
  points(xs, ys, color, r){
    const entry = {type:'points', xs, ys, color, r:r||2};
    this._stored.push(entry);
    return this._renderPoints(entry);
  }
  _renderPoints(entry){
    const g = svgEl('g',{}); const rr = entry.r;
    for (let i=0;i<entry.xs.length;i++){
      const xv=entry.xs[i], yv=entry.ys[i];
      if (!isFinite(xv)||!isFinite(yv)) continue;
      if (xv<this.xmin||xv>this.xmax) continue; // cull off-view for speed
      g.appendChild(svgEl('circle',{cx:this.px(xv).toFixed(2), cy:this.py(yv).toFixed(2), r:rr, fill:'none', stroke:entry.color, 'stroke-width':1}));
    }
    this.gData.appendChild(g);
    return g;
  }
  _renderLine(entry){
    let d='';
    for (let i=0;i<entry.xs.length;i++){
      if (!isFinite(entry.xs[i])||!isFinite(entry.ys[i])) continue;
      d += (d===''?'M':'L') + this.px(entry.xs[i]).toFixed(2) + ',' + this.py(entry.ys[i]).toFixed(2) + ' ';
    }
    const p = svgEl('path',{d, fill:'none', stroke:entry.color, 'stroke-width':entry.width||1.5});
    if (entry.dash) p.setAttribute('stroke-dasharray', entry.dash);
    this.gData.appendChild(p);
    return p;
  }
  bar(x0, x1, y0, y1, color){
    const entry = {type:'bar', x0, x1, y0, y1, color};
    this._stored.push(entry);
    return this._renderBar(entry);
  }
  _renderBar(entry){
    const px0=this.px(entry.x0), px1=this.px(entry.x1);
    const py0=this.py(entry.y0), py1=this.py(entry.y1);
    const r = svgEl('rect',{x:Math.min(px0,px1), y:Math.min(py0,py1), width:Math.abs(px1-px0), height:Math.abs(py0-py1), fill:entry.color});
    this.gData.appendChild(r);
    return r;
  }
  errbar(xc, yval, yerr){
    const entry = {type:'errbar', xc, yval, yerr};
    this._stored.push(entry);
    this._renderErrbar(entry);
  }
  _renderErrbar(entry){
    const x=this.px(entry.xc), y1=this.py(entry.yval-entry.yerr), y2=this.py(entry.yval+entry.yerr);
    this.gData.appendChild(svgEl('line',{x1:x,x2:x,y1,y2,stroke:'#fff','stroke-width':1.2,'class':'plot-errbar'}));
    this.gData.appendChild(svgEl('line',{x1:x-4,x2:x+4,y1,y2:y1,stroke:'#fff','stroke-width':1.2,'class':'plot-errbar'}));
    this.gData.appendChild(svgEl('line',{x1:x-4,x2:x+4,y1:y2,y2,stroke:'#fff','stroke-width':1.2,'class':'plot-errbar'}));
  }
  tickLabel(xv, text, rot){
    const entry = {type:'ticklabel', xv, text, rot: rot||0};
    this._stored.push(entry);
    return this._renderTickLabel(entry);
  }
  _renderTickLabel(entry){
    const {h}=this.size(); const m=this.margin;
    const x = this.px(entry.xv);
    if (entry.rot){
      // Tilted labels: anchor at the tick's right end so long names don't overlap
      const y = h-m.b+14;
      const t = svgEl('text',{x, y, 'font-size':10, fill:'#93a0b0', 'text-anchor':'end', 'class':'plot-tick', transform:`rotate(-${entry.rot} ${x} ${y})`});
      t.textContent = entry.text;
      this.gAxes.appendChild(t);
      return t;
    }
    const t = svgEl('text',{x, y:h-m.b+28, 'font-size':10, fill:'#93a0b0', 'text-anchor':'middle', 'class':'plot-tick'});
    t.textContent = entry.text;
    this.gAxes.appendChild(t);
    return t;
  }
  // Value label anchored at data coords, drawn rotated (default vertical, reading
  // upward) a few px above the point — used for the numeric value above a bar. Lives
  // in gData so it tracks pan/zoom; colour comes from CSS (.plot-errlabel).
  barLabel(xv, yval, text, opts){
    const entry = Object.assign({type:'barlabel', xv, yval, text}, opts||{});
    this._stored.push(entry);
    return this._renderBarLabel(entry);
  }
  _renderBarLabel(entry){
    const x = this.px(entry.xv);
    const y = this.py(entry.yval) - (entry.gap!=null ? entry.gap : 6);
    const rot = entry.rot!=null ? entry.rot : 90;   // vertical, reading upward
    const t = svgEl('text',{x, y, 'font-size':entry.size||10, 'text-anchor':'start',
      'dominant-baseline':'central', 'class':'plot-errlabel', 'pointer-events':'none',
      transform:`rotate(-${rot} ${x} ${y})`});
    t.textContent = entry.text;
    this.gData.appendChild(t);
    return t;
  }
  vline(xv, color, draggable, onDrag, onDragEnd){
    const entry = {type:'vline', xv, color, draggable, onDrag, onDragEnd};
    this._stored.push(entry);
    return this._renderVline(entry);
  }
  _renderVline(entry){
    const {h}=this.size(); const m=this.margin;
    const x0 = this.px(entry.xv);
    const line = svgEl('line',{x1:x0,x2:x0,y1:m.t,y2:h-m.b,stroke:entry.color,'stroke-width':2,'pointer-events':'none'});
    this.gOverlay.appendChild(line);
    if (entry.draggable){
      const hit = svgEl('line',{x1:x0,x2:x0,y1:m.t,y2:h-m.b,stroke:'transparent','stroke-width':16,'cursor':'ew-resize'});
      this.gOverlay.appendChild(hit);
      // Grip dot near the top for an easy drag target
      const grip = svgEl('circle',{cx:x0, cy:m.t+15, r:7.5, fill:entry.color, 'cursor':'ew-resize'});
      this.gOverlay.appendChild(grip);
      let dragging = false;
      const move = (clientX)=>{
        const rect = this.svg.getBoundingClientRect();
        let xv2 = this.invX(clientX - rect.left);
        xv2 = Math.max(this.xmin, Math.min(this.xmax, xv2));
        entry.xv = xv2;
        if (entry.onDrag) entry.onDrag(xv2);
      };
      const startDrag = e=>{ dragging = true; e.preventDefault(); e.stopPropagation(); };
      hit.addEventListener('pointerdown', startDrag);
      grip.addEventListener('pointerdown', startDrag);
      // Listen on svg + window so dragging survives gOverlay clears during redraws
      this.svg.addEventListener('pointermove', e=>{ if (dragging) move(e.clientX); });
      window.addEventListener('pointerup', ()=>{ if (dragging){ dragging = false; if (entry.onDragEnd) entry.onDragEnd(entry.xv); } });
    }
    line._value = entry.xv;
    return line;
  }
  _redrawFromStored(){
    this.gData.innerHTML=''; this.gOverlay.innerHTML='';
    for (const e of this._stored){
      if (e.type==='line') this._renderLine(e);
      else if (e.type==='points') this._renderPoints(e);
      else if (e.type==='bar') this._renderBar(e);
      else if (e.type==='errbar') this._renderErrbar(e);
      else if (e.type==='ticklabel') this._renderTickLabel(e);
      else if (e.type==='barlabel') this._renderBarLabel(e);
      else if (e.type==='vline') this._renderVline(e);
    }
  }
  _refresh(){ this.drawAxes(); this._redrawFromStored(); if (this._onView) this._onView(); }
  attachTools(wrapEl){
    const old = wrapEl.querySelector('.plot-tool-btns');
    if (old) old.remove();
    // Group the download button + tool buttons into a single column
    let col = wrapEl.querySelector('.plot-btn-col');
    if (!col){
      col = document.createElement('div');
      col.className = 'plot-btn-col';
      const dlBtn = wrapEl.querySelector('.plot-dl-btn');
      if (dlBtn){
        wrapEl.insertBefore(col, dlBtn); col.appendChild(dlBtn);
        dlBtn.addEventListener('mousedown', ()=>dlBtn.classList.add('active'));
        dlBtn.addEventListener('mouseup', ()=>dlBtn.classList.remove('active'));
        dlBtn.addEventListener('mouseleave', ()=>dlBtn.classList.remove('active'));
        // A CSV download button (same look/size), if this plot declares its CSVs.
        if (dlBtn.dataset.csvMod && dlBtn.dataset.csvNames)
          col.appendChild(makeCsvButton(dlBtn.dataset.csvMod, dlBtn.dataset.csvNames));
      }
      else { wrapEl.appendChild(col); }
    }
    const div = document.createElement('div');
    div.className = 'plot-tool-btns';
    const panBtn = document.createElement('button');
    panBtn.className = 'btn secondary plot-tool-btn';
    panBtn.title = 'Pan';
    panBtn.innerHTML = `<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><line x1="12" y1="4" x2="12" y2="20"/><path d="M6.5 9.5 4 12l2.5 2.5M17.5 9.5 20 12l-2.5 2.5M9.5 6.5 12 4l2.5 2.5M9.5 17.5 12 20l2.5-2.5"/></svg>`;
    const zoomBtn = document.createElement('button');
    zoomBtn.className = 'btn secondary plot-tool-btn';
    zoomBtn.title = 'Zoom area';
    zoomBtn.innerHTML = `<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6"/><line x1="14.8" y1="14.8" x2="20" y2="20"/><line x1="7.5" y1="10.5" x2="13.5" y2="10.5"/><line x1="10.5" y1="7.5" x2="10.5" y2="13.5"/></svg>`;
    const snapBtn = document.createElement('button');
    snapBtn.className = 'btn secondary plot-tool-btn';
    snapBtn.title = 'Download current view';
    snapBtn.innerHTML = `<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5a1.5 1.5 0 0 1 1.5-1.5h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 9.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3"/></svg>`;
    snapBtn.addEventListener('mousedown', ()=>snapBtn.classList.add('active'));
    snapBtn.addEventListener('mouseup',   ()=>snapBtn.classList.remove('active'));
    snapBtn.addEventListener('mouseleave',()=>snapBtn.classList.remove('active'));
    snapBtn.onclick = ()=>{
      const dlBtn = col.querySelector('.plot-dl-btn');
      const legEl = dlBtn && dlBtn.dataset.dlLegend ? document.getElementById(dlBtn.dataset.dlLegend) : null;
      const baseName = dlBtn && dlBtn.dataset.dlName ? dlBtn.dataset.dlName.replace(/\.[^.]+$/, '') : 'plot';
      downloadSvgClean(this.svg, baseName+'_current.svg', legEl, true);
    };

    const sync = (mode)=>{
      panBtn.classList.toggle('active', mode==='pan');
      zoomBtn.classList.toggle('active', mode==='zoom');
    };
    panBtn.onclick = ()=>{ this.setMode(this._mode==='pan'?null:'pan'); };
    zoomBtn.onclick = ()=>{ this.setMode(this._mode==='zoom'?null:'zoom'); };
    this._onModeChange = sync;
    div.appendChild(snapBtn);
    div.appendChild(panBtn);
    div.appendChild(zoomBtn);
    col.appendChild(div);
    // Re-assert the current mode onto the freshly built buttons/cursor so a re-run
    // of attachTools (e.g. on data refresh) can't leave a stale/partial state.
    this.setMode(this._mode || null);
    // Normalise the CSV icon now that the plot (and its button) is on-screen.
    fitCsvIcons(col);
  }
  _clearCrosshair(){ if (this.gCross) this.gCross.innerHTML=''; }
  // Draw a thin crosshair + a coordinate readout at the pointer (data coordinates via invX/invY)
  _drawCrosshair(clientX, clientY){
    if (!this.gCross) return;
    const {w,h}=this.size(); const m=this.margin;
    const rect=this.svg.getBoundingClientRect();
    const cx=clientX-rect.left, cy=clientY-rect.top;
    if (cx<m.l || cx>w-m.r || cy<m.t || cy>h-m.b){ this._clearCrosshair(); return; }
    const xv=this.invX(cx), yv=this.invY(cy);
    const fmt=v=>{ const a=Math.abs(v); return a>=1000?v.toFixed(0):a>=1?v.toFixed(3):v.toPrecision(3); };
    this.gCross.innerHTML='';
    const add=(tag,at)=>{ this.gCross.appendChild(svgEl(tag,at)); };
    add('line',{x1:cx,x2:cx,y1:m.t,y2:h-m.b,stroke:'#c4ccd6','stroke-width':1,'stroke-dasharray':'4,3','opacity':0.75,'class':'plot-crosshair'});
    add('line',{x1:m.l,x2:w-m.r,y1:cy,y2:cy,stroke:'#c4ccd6','stroke-width':1,'stroke-dasharray':'4,3','opacity':0.75,'class':'plot-crosshair'});
    const nearRight = cx > w - m.r - 140;
    const tx = nearRight ? m.l+8 : w-m.r-8;
    const anchor = nearRight ? 'start' : 'end';
    const t=svgEl('text',{x:tx,y:m.t+14,'font-size':12,'text-anchor':anchor,fill:'#f0f4f6',stroke:'#0b0f12','stroke-width':3.5,'paint-order':'stroke','font-family':'monospace','class':'plot-readout'});
    t.textContent = `x ${fmt(xv)}   y ${fmt(yv)}`;
    this.gCross.appendChild(t);
  }
  _initInteraction(){
    // View-only plots (e.g. the residual strip) get no pan/zoom interaction at all.
    if (this._opts.noInteraction) return;
    const svg = this.svg;
    // Bind the pointer listeners ONCE per <svg> element. A new Plot on the same svg
    // just becomes svg._plot (updated in the constructor); all handlers act on the
    // current svg._plot. This avoids stacking stale listeners from old instances,
    // which was the source of the pan/zoom ghost-state bugs.
    if (svg._interactionBound) return;
    svg._interactionBound = true;
    let pan = null, zoomStart = null, zoomRect = null;

    svg.addEventListener('pointerdown', e=>{
      const P = svg._plot; if (!P) return;
      if (e.button !== 0) return;
      if (e.target.closest('.plot-goverlay')) return;
      if (P._mode === 'pan'){
        pan = {x:e.clientX, y:e.clientY, xmin:P.xmin, xmax:P.xmax, ymin:P.ymin, ymax:P.ymax};
        svg.setPointerCapture(e.pointerId);
        svg.style.cursor = 'move';
      } else if (P._mode === 'zoom'){
        const svgRect = svg.getBoundingClientRect();
        zoomStart = {cx: e.clientX - svgRect.left, cy: e.clientY - svgRect.top};
        svg.setPointerCapture(e.pointerId);
        zoomRect = svgEl('rect',{x:zoomStart.cx,y:zoomStart.cy,width:0,height:0,fill:'rgba(100,160,255,0.12)',stroke:'rgba(100,160,255,0.7)','stroke-width':1,'pointer-events':'none'});
        P.gOverlay.appendChild(zoomRect);
      }
    });

    svg.addEventListener('pointermove', e=>{
      const P = svg._plot; if (!P) return;
      if (P._mode === 'pan' && pan){
        const {w,h}=P.size(); const m=P.margin;
        const dx=(e.clientX-pan.x)/(w-m.l-m.r)*(pan.xmax-pan.xmin);
        const dy=(e.clientY-pan.y)/(h-m.t-m.b)*(pan.ymax-pan.ymin);
        P.xmin=pan.xmin-dx; P.xmax=pan.xmax-dx;
        P.ymin=pan.ymin+dy; P.ymax=pan.ymax+dy;
        P._refresh();
        P._clearCrosshair();
      } else if (P._mode === 'zoom' && zoomStart && zoomRect){
        const svgRect = svg.getBoundingClientRect();
        const cx=e.clientX-svgRect.left, cy=e.clientY-svgRect.top;
        zoomRect.setAttribute('x', Math.min(cx,zoomStart.cx));
        zoomRect.setAttribute('y', Math.min(cy,zoomStart.cy));
        zoomRect.setAttribute('width', Math.abs(cx-zoomStart.cx));
        zoomRect.setAttribute('height', Math.abs(cy-zoomStart.cy));
      } else if (P._mode){
        P._clearCrosshair(); // pan/zoom tool armed → no position readout
      } else {
        P._drawCrosshair(e.clientX, e.clientY); // hover readout (no tool active)
      }
    });
    svg.addEventListener('pointerleave', ()=>{ const P = svg._plot; if (P) P._clearCrosshair(); });

    const endDrag = ()=>{ pan=null; zoomStart=null; if (zoomRect){ zoomRect.remove(); zoomRect=null; } };

    svg.addEventListener('pointerup', e=>{
      const P = svg._plot; if (!P){ endDrag(); return; }
      if (P._mode === 'zoom' && zoomStart){
        const svgRect = svg.getBoundingClientRect();
        const cx=e.clientX-svgRect.left, cy=e.clientY-svgRect.top;
        const dw=Math.abs(cx-zoomStart.cx), dh=Math.abs(cy-zoomStart.cy);
        if (zoomRect){ zoomRect.remove(); zoomRect=null; }
        if (dw > 5 && dh > 5){
          const x1=P.invX(Math.min(cx,zoomStart.cx)), x2=P.invX(Math.max(cx,zoomStart.cx));
          const y1=P.invY(Math.min(cy,zoomStart.cy)), y2=P.invY(Math.max(cy,zoomStart.cy));
          P.xmin=Math.min(x1,x2); P.xmax=Math.max(x1,x2);
          P.ymin=Math.min(y1,y2); P.ymax=Math.max(y1,y2);
          P._refresh();
        }
      }
      endDrag();
    });

    svg.addEventListener('pointercancel', ()=>{
      const P = svg._plot; endDrag();
      if (P) svg.style.cursor = P._mode==='pan'?'move':P._mode==='zoom'?'crosshair':'';
    });

    svg.addEventListener('dblclick', e=>{
      const P = svg._plot; if (!P || !P._mode || e.target.closest('.plot-goverlay')) return;
      P.xmin=P._origXmin; P.xmax=P._origXmax;
      P.ymin=P._origYmin; P.ymax=P._origYmax;
      P._refresh();
    });
  }
}
// Coalesce the burst of resize events fired during a window drag into one redraw
// per animation frame — otherwise each event triggers a full synchronous redraw
// and the drag feels like it hangs for seconds.
let _resizeRAF = null;
window.addEventListener('resize', ()=>{
  if (_resizeRAF) return;
  _resizeRAF = requestAnimationFrame(()=>{ _resizeRAF = null; redrawAll(); });
});

function downloadSvgClean(svgNode, filename, legendEl, currentView){
  const ns = 'http://www.w3.org/2000/svg';
  const plotObj = svgNode._plot || null;
  const bbox = svgNode.getBoundingClientRect();
  const w = bbox.width || 900; const h = bbox.height || 480;
  const m = plotObj ? plotObj.margin : {l:55,r:20,t:15,b:40};

  let workSvg;
  if (plotObj && !currentView){
    // Synchronously render the live plot at the original (full) range, clone it,
    // then restore the current range. No repaint happens between, so the user
    // never sees the live plot change.
    const cur = {xmin:plotObj.xmin, xmax:plotObj.xmax, ymin:plotObj.ymin, ymax:plotObj.ymax};
    plotObj.xmin = plotObj._origXmin; plotObj.xmax = plotObj._origXmax;
    plotObj.ymin = plotObj._origYmin; plotObj.ymax = plotObj._origYmax;
    plotObj._refresh();
    workSvg = svgNode.cloneNode(true);
    plotObj.xmin = cur.xmin; plotObj.xmax = cur.xmax;
    plotObj.ymin = cur.ymin; plotObj.ymax = cur.ymax;
    plotObj._refresh();
  } else {
    workSvg = svgNode.cloneNode(true);
  }
  workSvg.querySelectorAll('.plot-goverlay, .plot-cross').forEach(el=>{ while(el.firstChild) el.removeChild(el.firstChild); });

  workSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  workSvg.setAttribute('font-family', 'Arial, sans-serif');

  workSvg.querySelectorAll('.plot-grid').forEach(el=>el.remove());
  workSvg.querySelectorAll('.plot-border').forEach(el=>el.setAttribute('stroke','#333333'));
  workSvg.querySelectorAll('.plot-errbar').forEach(el=>el.setAttribute('stroke','#333333'));
  workSvg.querySelectorAll('.plot-tick').forEach(el=>{
    el.setAttribute('fill','#333333');
    el.setAttribute('font-family','Arial, sans-serif');
    el.setAttribute('font-size', Math.round(parseFloat(el.getAttribute('font-size')||10) * 1.6));
  });
  workSvg.querySelectorAll('.plot-label').forEach(el=>{
    el.setAttribute('fill','#333333');
    el.setAttribute('font-family','Arial, sans-serif');
    el.setAttribute('font-size', Math.round(parseFloat(el.getAttribute('font-size')||11) * 1.6));
  });

  // Add tick marks (primary + secondary, inner + outer, mirrored on all sides)
  if (plotObj){
    const gAxes = workSvg.querySelector('.plot-gaxes');
    const PO = 5, PI = 4;   // primary outer/inner length (px)
    const SO = 3, SI = 2.5; // secondary outer/inner length
    const TS = '#333333';
    const rx1 = currentView ? plotObj.xmin : plotObj._origXmin;
    const rx2 = currentView ? plotObj.xmax : plotObj._origXmax;
    const ry1 = currentView ? plotObj.ymin : plotObj._origYmin;
    const ry2 = currentView ? plotObj.ymax : plotObj._origYmax;
    const toSvgX = xv => m.l + (xv-rx1)/(rx2-rx1)*(w-m.l-m.r);
    const toSvgY = yv => h-m.b - (yv-ry1)/(ry2-ry1)*(h-m.t-m.b);
    const addLine = (x1,y1,x2,y2,sw) => gAxes.appendChild(svgEl('line',{x1,y1,x2,y2,stroke:TS,'stroke-width':sw}));

    if (!plotObj.noXTickLabels){
      const xTicks = plotObj._opts.xTickStep
        ? fixedTicks(rx1, rx2, plotObj._opts.xTickStep)
        : niceTicks(rx1, rx2, 5);
      for (const xv of xTicks){
        const px = toSvgX(xv);
        if (px < m.l-1 || px > w-m.r+1) continue;
        addLine(px,h-m.b+PO, px,h-m.b-PI, 1.2); // bottom
        addLine(px,m.t-PO,   px,m.t+PI,   1.2); // top
      }
      if (xTicks.length >= 2){
        const step = xTicks[1]-xTicks[0];
        for (let xv = xTicks[0]-step/2; xv <= rx2+step/2; xv += step){
          const px = toSvgX(xv);
          if (px < m.l-1 || px > w-m.r+1) continue;
          addLine(px,h-m.b+SO, px,h-m.b-SI, 0.9);
          addLine(px,m.t-SO,   px,m.t+SI,   0.9);
        }
      }
    }

    if (!plotObj.noYTickLabels){
      const yTicks = niceTicks(ry1, ry2, 5);
      for (const yv of yTicks){
        const py = toSvgY(yv);
        if (py < m.t-1 || py > h-m.b+1) continue;
        addLine(m.l-PO,   py, m.l+PI,   py, 1.2); // left
        addLine(w-m.r+PO, py, w-m.r-PI, py, 1.2); // right
      }
      if (yTicks.length >= 2){
        const step = yTicks[1]-yTicks[0];
        for (let yv = yTicks[0]-step/2; yv <= ry2+step/2; yv += step){
          const py = toSvgY(yv);
          if (py < m.t-1 || py > h-m.b+1) continue;
          addLine(m.l-SO,   py, m.l+SI,   py, 0.9);
          addLine(w-m.r+SO, py, w-m.r-SI, py, 0.9);
        }
      }
    }
  }

  // Parse legend
  const legItems = [];
  if (legendEl) legendEl.querySelectorAll('span').forEach(span=>{
    const col = span.querySelector('i') ? span.querySelector('i').style.background : '#888';
    const txt = span.textContent.trim();
    if (txt) legItems.push({col, txt});
  });
  const fontSize = 15, iH = 13, rowH = 24, legPadT = 12, legMarginL = 56, gap = 22;
  // Measure label widths precisely so legend entries never overlap
  const measCtx = document.createElement('canvas').getContext('2d');
  measCtx.font = `${fontSize}px Arial, sans-serif`;
  const rows = []; let row = [], rx = legMarginL;
  for (const item of legItems){
    const tw = measCtx.measureText(item.txt).width;
    const iw = iH + 5 + tw + gap;
    if (row.length && rx + iw > w-10){ rows.push(row); row=[]; rx=legMarginL; }
    row.push({item, x:rx}); rx+=iw;
  }
  if (row.length) rows.push(row);
  const legH = rows.length ? legPadT + rows.length*rowH + 8 : 0;
  const totalH = h + legH;

  // Slight padding to prevent label clipping at edges
  const padL = 8, padT = 6;
  workSvg.setAttribute('viewBox', `${-padL} ${-padT} ${w+padL} ${totalH+padT}`);
  workSvg.setAttribute('width', w+padL); workSvg.setAttribute('height', totalH+padT);

  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('x',-padL); bg.setAttribute('y',-padT);
  bg.setAttribute('width',w+padL); bg.setAttribute('height',totalH+padT);
  bg.setAttribute('fill','#ffffff');
  workSvg.insertBefore(bg, workSvg.firstChild);

  if (rows.length){
    const legG = document.createElementNS(ns,'g');
    rows.forEach((r,ri)=>{
      const cy = h + legPadT + ri*rowH + iH;
      r.forEach(({item,x})=>{
        const rect = document.createElementNS(ns,'rect');
        rect.setAttribute('x',x); rect.setAttribute('y',cy-iH+2);
        rect.setAttribute('width',iH); rect.setAttribute('height',iH);
        rect.setAttribute('fill',item.col); rect.setAttribute('rx',2); legG.appendChild(rect);
        const t = document.createElementNS(ns,'text');
        t.setAttribute('x',x+iH+5); t.setAttribute('y',cy+2);
        t.setAttribute('font-size',fontSize); t.setAttribute('fill','#333333');
        t.setAttribute('font-family','Arial, sans-serif'); t.textContent=item.txt;
        legG.appendChild(t);
      });
    });
    workSvg.appendChild(legG);
  }

  const svgStr = new XMLSerializer().serializeToString(workSvg);
  const fmt = settings.plotFmt || 'png';
  const baseName = filename.replace(/\.[^.]+$/, '');
  if (fmt === 'svg'){
    const blob = new Blob([svgStr],{type:'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=baseName+'.svg';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  } else {
    const mimeMap = {png:'image/png', jpeg:'image/jpeg', webp:'image/webp'};
    const mime = mimeMap[fmt] || 'image/png';
    const scale = 2;
    const cW = (w+padL)*scale, cH = (totalH+padT)*scale;
    const canvas = document.createElement('canvas');
    canvas.width = cW; canvas.height = cH;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    const img = new Image();
    const svgBlob = new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);
    img.onload = ()=>{
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      const a = document.createElement('a');
      a.download = baseName+'.'+fmt;
      a.href = canvas.toDataURL(mime, fmt==='jpeg'?0.92:undefined);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };
    img.src = svgUrl;
  }
}
document.addEventListener('click', e=>{
  const btn = e.target.closest('[data-dl-svg]');
  if (!btn) return;
  const el = document.getElementById(btn.dataset.dlSvg);
  const legEl = btn.dataset.dlLegend ? document.getElementById(btn.dataset.dlLegend) : null;
  if (el) downloadSvgClean(el, btn.dataset.dlName || btn.dataset.dlSvg+'.svg', legEl);
});


export {
  niceStep, niceTicks, fixedTicks, fmtTick, svgEl, Plot, downloadSvgClean
};
