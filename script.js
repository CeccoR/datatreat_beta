/* =========================================================
   GENERIC UTILITIES
========================================================= */
const COLORS = [
  '#3aa0ff','#ff7a59','#5fcf6a','#d050ff','#ffcc4d','#ff5050','#4dd0e1','#c0ca33','#9575cd','#f06292',
  '#ff9800','#00bcd4','#8bc34a','#e91e63','#00897b','#ff5722','#1565c0','#f9a825','#6a1b9a','#558b2f',
  '#bf360c','#006064','#4527a0','#2e7d32','#ad1457','#0277bd','#6d4c41','#37474f','#e53935','#039be5',
  '#7b1fa2','#43a047','#fb8c00','#00838f','#c62828','#1976d2',
];
function colorOf(i){return COLORS[i % COLORS.length];}

/* =========================================================
   CUSTOM COLOR PICKER
========================================================= */
const CP_PRESETS = [
  '#e74c3c','#e67e22','#f39c12','#f1c40f','#2ecc71','#1abc9c',
  '#3498db','#2980b9','#9b59b6','#8e44ad','#e91e63','#c2185b',
  '#ff6b6b','#ffa94d','#ffe066','#8ce99a','#63e6be','#74c0fc',
  '#da77f2','#f783ac','#ffb347','#a5d8ff','#b197fc','#ffd43b',
  '#c0392b','#bf360c','#d35400','#7d3c98','#1565c0','#006064',
  '#ffffff','#bdc3c7','#95a5a6','#7f8c8d','#34495e','#2c3e50',
];
function _hexToRgb(hex){
  hex = hex.replace(/^#/,'');
  if (hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const n = parseInt(hex,16);
  return {r:(n>>16)&255, g:(n>>8)&255, b:n&255};
}
function _rgbToHex(r,g,b){
  return '#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
}
function _rgbToHsv(r,g,b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0, s=max===0?0:d/max, v=max;
  if(d){
    if(max===r) h=((g-b)/d+6)%6;
    else if(max===g) h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h/=6;
  }
  return {h,s,v};
}
function _hsvToRgb(h,s,v){
  const i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
  let r,g,b;
  switch(i%6){
    case 0:r=v;g=t;b=p;break; case 1:r=q;g=v;b=p;break;
    case 2:r=p;g=v;b=t;break; case 3:r=p;g=q;b=v;break;
    case 4:r=t;g=p;b=v;break; default:r=v;g=p;b=q;break;
  }
  return {r:Math.round(r*255),g:Math.round(g*255),b:Math.round(b*255)};
}

class ColorPickerUI {
  constructor(){
    this._onChange = null;
    this._hsv = {h:0,s:1,v:1};
    this._anchorBtn = null;
    this._build();
    document.addEventListener('pointerdown', e=>{
      if (this._el.style.display==='none') return;
      if (!this._el.contains(e.target) && e.target !== this._anchorBtn)
        this.close();
    }, true);
  }
  _build(){
    const el = document.createElement('div');
    el.className = 'cp-popup';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="cp-map"><div class="cp-cursor"></div></div>
      <div class="cp-hue"><div class="cp-hue-thumb"></div></div>
      <div class="cp-bottom">
        <div class="cp-preview"></div>
        <div class="cp-hex-wrap"><span>#</span><input class="cp-hex" type="text" maxlength="6" spellcheck="false" autocomplete="off"></div>
      </div>
      <div class="cp-rgb">
        <div class="cp-rgb-row"><span>R</span><input type="range" class="cp-slider cp-r-sl" min="0" max="255"><input type="number" class="cp-num" min="0" max="255"></div>
        <div class="cp-rgb-row"><span>G</span><input type="range" class="cp-slider cp-g-sl" min="0" max="255"><input type="number" class="cp-num" min="0" max="255"></div>
        <div class="cp-rgb-row"><span>B</span><input type="range" class="cp-slider cp-b-sl" min="0" max="255"><input type="number" class="cp-num" min="0" max="255"></div>
      </div>
      <div class="cp-presets">${CP_PRESETS.map(c=>`<div class="cp-preset" style="background:${c}" title="${c}" data-color="${c}"></div>`).join('')}</div>`;
    document.body.appendChild(el);
    this._el = el;
    this._map = el.querySelector('.cp-map');
    this._cursor = el.querySelector('.cp-cursor');
    this._hue = el.querySelector('.cp-hue');
    this._hueThumb = el.querySelector('.cp-hue-thumb');
    this._preview = el.querySelector('.cp-preview');
    this._hexIn = el.querySelector('.cp-hex');
    this._rSl = el.querySelector('.cp-r-sl');
    this._gSl = el.querySelector('.cp-g-sl');
    this._bSl = el.querySelector('.cp-b-sl');
    const nums = el.querySelectorAll('.cp-num');
    this._rNum = nums[0]; this._gNum = nums[1]; this._bNum = nums[2];

    // 2D map — pointer drag
    const onMapMove = e=>{
      const r = this._map.getBoundingClientRect();
      this._hsv.s = Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
      this._hsv.v = Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height));
      this._emit();
    };
    this._map.addEventListener('pointerdown', e=>{
      e.preventDefault(); this._map.setPointerCapture(e.pointerId); onMapMove(e);
      this._map.addEventListener('pointermove', onMapMove);
      this._map.addEventListener('pointerup', ()=>this._map.removeEventListener('pointermove', onMapMove), {once:true});
    });

    // Hue slider — pointer drag
    const onHueMove = e=>{
      const r = this._hue.getBoundingClientRect();
      this._hsv.h = Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
      this._emit();
    };
    this._hue.addEventListener('pointerdown', e=>{
      e.preventDefault(); this._hue.setPointerCapture(e.pointerId); onHueMove(e);
      this._hue.addEventListener('pointermove', onHueMove);
      this._hue.addEventListener('pointerup', ()=>this._hue.removeEventListener('pointermove', onHueMove), {once:true});
    });

    // RGB range sliders
    const onSlider = ()=>{
      this._hsv = _rgbToHsv(+this._rSl.value, +this._gSl.value, +this._bSl.value);
      this._emit();
    };
    [this._rSl, this._gSl, this._bSl].forEach(s=>s.addEventListener('input', onSlider));

    // RGB number inputs
    const onNum = ()=>{
      const clamp = v=>Math.max(0,Math.min(255,+v||0));
      this._hsv = _rgbToHsv(clamp(this._rNum.value), clamp(this._gNum.value), clamp(this._bNum.value));
      this._emit();
    };
    [this._rNum, this._gNum, this._bNum].forEach(n=>n.addEventListener('change', onNum));

    // Hex input
    this._hexIn.addEventListener('input', ()=>{
      const v = this._hexIn.value.replace(/[^0-9a-fA-F]/g,'');
      if (v.length===6 || v.length===3){
        this._hsv = _rgbToHsv(...Object.values(_hexToRgb('#'+v)));
        this._updateUI(true);
        if (this._onChange) this._onChange(_rgbToHex(...Object.values(_hsvToRgb(this._hsv.h,this._hsv.s,this._hsv.v))));
      }
    });

    // Preset swatches
    el.querySelectorAll('.cp-preset').forEach(p=>p.addEventListener('click', ()=>{
      this._hsv = _rgbToHsv(...Object.values(_hexToRgb(p.dataset.color)));
      this._emit();
    }));
  }

  _emit(){
    this._updateUI(false);
    const {r,g,b} = _hsvToRgb(this._hsv.h, this._hsv.s, this._hsv.v);
    if (this._onChange) this._onChange(_rgbToHex(r,g,b));
  }

  _updateUI(skipHex){
    const {h,s,v} = this._hsv;
    const {r,g,b} = _hsvToRgb(h,s,v);
    const hex = _rgbToHex(r,g,b);
    const hueColor = `hsl(${Math.round(h*360)},100%,50%)`;
    this._map.style.background = `linear-gradient(to bottom,transparent,#000),linear-gradient(to right,#fff,${hueColor})`;
    this._cursor.style.left = (s*100)+'%';
    this._cursor.style.top = ((1-v)*100)+'%';
    this._hueThumb.style.left = (h*100)+'%';
    this._preview.style.background = hex;
    if (!skipHex) this._hexIn.value = hex.slice(1).toUpperCase();
    this._rSl.value = r; this._gSl.value = g; this._bSl.value = b;
    this._rNum.value = r; this._gNum.value = g; this._bNum.value = b;
    this._rSl.style.setProperty('--cp-grad',`linear-gradient(to right,rgb(0,${g},${b}),rgb(255,${g},${b}))`);
    this._gSl.style.setProperty('--cp-grad',`linear-gradient(to right,rgb(${r},0,${b}),rgb(${r},255,${b}))`);
    this._bSl.style.setProperty('--cp-grad',`linear-gradient(to right,rgb(${r},${g},0),rgb(${r},${g},255))`);
  }

  open(anchorBtn, currentColor, onChange){
    this._anchorBtn = anchorBtn;
    this._onChange = onChange;
    this._hsv = _rgbToHsv(...Object.values(_hexToRgb(currentColor)));
    this._updateUI(false);
    this._el.style.display = 'block';
    const rect = anchorBtn.getBoundingClientRect();
    const pw = this._el.offsetWidth || 260, ph = this._el.offsetHeight || 430;
    let left = rect.right + 10, top = rect.top - 4;
    if (left + pw > window.innerWidth - 8) left = rect.left - pw - 10;
    if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
    this._el.style.left = Math.max(8,left)+'px';
    this._el.style.top = Math.max(8,top)+'px';
  }

  close(){
    this._el.style.display = 'none';
    this._onChange = null;
    this._anchorBtn = null;
  }
}

const colorPickerUI = new ColorPickerUI();

/* =========================================================
   PALETTE PICKER
========================================================= */
const CP_PALETTES = [
  { name: 'DataTreat',    colors: ['#3aa0ff','#ff7a59','#5fcf6a','#d050ff','#ffcc4d','#ff5050','#4dd0e1','#c0ca33','#9575cd','#f06292'] },
  { name: 'Tableau',      colors: ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ac'] },
  { name: 'D3 Cat10',     colors: ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'] },
  { name: 'Okabe-Ito',    colors: ['#e69f00','#56b4e9','#009e73','#f0e442','#0072b2','#d55e00','#cc79a7','#000000'] },
  { name: 'Set1',         colors: ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#a65628','#f781bf','#999999'] },
  { name: 'Set2',         colors: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f','#e5c494','#b3b3b3'] },
  { name: 'Pastel',       colors: ['#fbb4ae','#b3cde3','#ccebc5','#decbe4','#fed9a6','#ffffcc','#e5d8bd','#fddaec','#f2f2f2'] },
];

class PalettePickerUI {
  constructor(){
    this._onChange = null;
    this._anchorBtn = null;
    this._build();
    document.addEventListener('pointerdown', e=>{
      if (this._el.style.display==='none') return;
      if (!this._el.contains(e.target) && e.target !== this._anchorBtn) this.close();
    }, true);
  }
  _build(){
    const el = document.createElement('div');
    el.className = 'pp-popup';
    el.style.display = 'none';
    el.innerHTML = CP_PALETTES.map((p,i)=>{
      const swatches = Array.from({length:12}, (_,k)=>
        `<span class="pp-swatch" style="background:${p.colors[k%p.colors.length]}"></span>`).join('');
      return `<div class="pp-row" data-idx="${i}"><span class="pp-name">${p.name}</span><div class="pp-swatches">${swatches}</div></div>`;
    }).join('');
    document.body.appendChild(el);
    this._el = el;
    el.querySelectorAll('.pp-row').forEach(row=>{
      row.addEventListener('click', ()=>{
        if (this._onChange) this._onChange(CP_PALETTES[+row.dataset.idx].colors);
        this.close();
      });
    });
  }
  open(anchorBtn, onChange){
    this._anchorBtn = anchorBtn;
    this._onChange = onChange;
    this._el.style.display = 'block';
    const rect = anchorBtn.getBoundingClientRect();
    const pw = this._el.offsetWidth || 236, ph = this._el.offsetHeight || 260;
    let left = rect.right + 10, top = rect.top - 4;
    if (left + pw > window.innerWidth - 8) left = rect.left - pw - 10;
    if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
    this._el.style.left = Math.max(8,left)+'px';
    this._el.style.top = Math.max(8,top)+'px';
  }
  close(){ this._el.style.display='none'; this._onChange=null; this._anchorBtn=null; }
}

const palettePickerUI = new PalettePickerUI();

/* =========================================================
   SETTINGS
========================================================= */
const settings = { decimal: '.', field: ';', plotFmt: 'png' };

function fmtNum(v, decimals){
  if (!isFinite(v)) return '';
  return v.toFixed(decimals).replace('.', settings.decimal);
}
function csvJoin(vals){ return vals.join(settings.field); }
function csvLine(vals){ return csvJoin(vals) + '\n'; }

(function initSettings(){
  const decSel = document.getElementById('settingDecimal');
  const fldSel = document.getElementById('settingField');

  function validate(){
    const d = decSel.value, f = fldSel.value;
    if (d === ',' && f === ','){
      // revert whichever was just changed to a safe default
      if (settings.decimal === ',') decSel.value = '.';
      else fldSel.value = ';';
    }
    settings.decimal = decSel.value;
    settings.field   = fldSel.value;
  }

  decSel.addEventListener('change', validate);
  fldSel.addEventListener('change', validate);
  const fmtSel = document.getElementById('settingPlotFmt');
  fmtSel.addEventListener('change', ()=>{ settings.plotFmt = fmtSel.value; });
})();

function downloadBlob(filename, text){
  const blob = new Blob([text], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);}, 200);
}
function makeDownloadLink(container, filename, text, label){
  const b = document.createElement('button');
  b.className = 'btn secondary small';
  b.style.marginRight = '8px'; b.style.marginBottom='6px';
  b.textContent = label || ('Download ' + filename);
  b.onclick = ()=>downloadBlob(filename, text);
  container.appendChild(b);
}

function parseNumber(s, decSepIsComma){
  if (s === undefined || s === null) return NaN;
  s = String(s).trim();
  if (decSepIsComma) s = s.replace(',', '.');
  return parseFloat(s);
}

function detectDelim(line){
  const counts = {';':0, ',':0, '\t':0};
  for (const c of line){ if (counts.hasOwnProperty(c)) counts[c]++; }
  let best=';', bestN=-1;
  for (const k in counts){ if (counts[k]>bestN){bestN=counts[k]; best=k;} }
  return bestN>0 ? best : ',';
}

function splitCSVLine(line, delim){
  return line.split(delim).map(s=>s.trim().replace(/^"|"$/g,''));
}

/* =========================================================
   SHARED FILE DROPZONE
========================================================= */
function setupDropzone(dropzoneId, inputId, onFiles){
  const dz = document.getElementById(dropzoneId);
  const input = document.getElementById(inputId);
  if (!dz || !input) return;

  dz.addEventListener('click', ()=> input.click());

  input.addEventListener('change', ()=>{
    if (input.files.length) {
      const fileArr = Array.from(input.files);
      input.value = ''; // reset before async processing so same file can be re-added after removal
      onFiles(fileArr);
    }
  });

  ['dragenter','dragover'].forEach(evt=>{
    dz.addEventListener(evt, e=>{
      e.preventDefault(); e.stopPropagation();
      dz.classList.add('dragover');
    });
  });
  ['dragleave','dragend'].forEach(evt=>{
    dz.addEventListener(evt, e=>{
      e.preventDefault(); e.stopPropagation();
      dz.classList.remove('dragover');
    });
  });
  dz.addEventListener('drop', e=>{
    e.preventDefault(); e.stopPropagation();
    dz.classList.remove('dragover');
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) onFiles(dt.files);
  });
}

/* =========================================================
   UNIFIED FILE LIST RENDERER
   files: array of objects with at least {name, label}
   callbacks: {onRemove(i), onMoveUp(i), onMoveDown(i), onLabelChange(i, newLabel)}
   extraCols: optional array of {header, render(file,i)} for additional columns
========================================================= */
function renderUnifiedFileList(containerId, files, callbacks, extraCols){
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (!files.length){ wrap.innerHTML=''; return; }

  const ec = extraCols || [];
  const phantomBtns = `<button style="opacity:0;pointer-events:none">↑</button><button style="opacity:0;pointer-events:none">↓</button>`;
  // colgroup: FILE=40%, LABEL+extraCols share remaining 40%, actions=20%
  let colgroup = `<colgroup><col style="width:40%">`;
  for (let i = 0; i < 1 + ec.length; i++) colgroup += `<col>`;
  colgroup += `<col style="width:20%"></colgroup>`;
  let html = `<div class="table-wrap-box"><table>${colgroup}<thead><tr><th><div style="display:flex;align-items:center;gap:5px"><button class="palette-pick-btn" title="Apply color palette"></button>FILE</div></th><th>LABEL</th>`;
  ec.forEach(c=> html += `<th>${c.header}</th>`);
  html += `<th><div class="file-actions" style="display:flex;gap:4px;align-items:center;visibility:visible;white-space:nowrap">${phantomBtns}<button class="remove-all del" title="Remove all">✕</button></div></th></tr></thead><tbody>`;

  files.forEach((f, i)=>{
    const swatch = f.color ? `<button class="color-swatch" data-i="${i}" data-color="${f.color}" style="background:${f.color}" title="Pick color"></button>` : '';
    html += `<tr class="file-row" data-i="${i}">`;
    html += `<td class="fname" title="${f.name}">${swatch}${f.name}</td>`;
    html += `<td><input class="label-input file-label" data-i="${i}" value="${f.label.replace(/"/g,'&quot;')}"></td>`;
    ec.forEach(c=> html += `<td>${c.render(f, i)}</td>`);
    html += `<td><div class="file-actions">`;
    if (i > 0) html += `<button class="move-up" data-i="${i}" title="Move up">↑</button>`;
    else html += `<button disabled style="opacity:.2" title="Move up">↑</button>`;
    if (i < files.length-1) html += `<button class="move-dn" data-i="${i}" title="Move down">↓</button>`;
    else html += `<button disabled style="opacity:.2" title="Move down">↓</button>`;
    html += `<button class="del" data-i="${i}" title="Remove">✕</button>`;
    html += `</div></td></tr>`;
  });
  html += `</tbody></table></div>`;
  wrap.innerHTML = html;

  wrap.querySelector('.remove-all').addEventListener('click', ()=>{
    if (callbacks.onRemoveAll) callbacks.onRemoveAll();
  });
  const palBtn = wrap.querySelector('.palette-pick-btn');
  if (palBtn) palBtn.addEventListener('click', e=>{
    e.stopPropagation();
    palettePickerUI.open(palBtn, colors=>{
      if (callbacks.onPaletteChange) callbacks.onPaletteChange(colors);
    });
  });
  wrap.querySelectorAll('.color-swatch').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      colorPickerUI.open(btn, btn.dataset.color, color=>{
        btn.style.background = color;
        btn.dataset.color = color;
        if (callbacks.onColorChange) callbacks.onColorChange(+btn.dataset.i, color);
      });
    });
  });
  wrap.querySelectorAll('.file-label').forEach(inp=>{
    inp.addEventListener('input', e=>{
      if (callbacks.onLabelChange) callbacks.onLabelChange(+e.target.dataset.i, e.target.value);
    });
  });
  wrap.querySelectorAll('.move-up').forEach(btn=>{
    btn.addEventListener('click', e=>{ if (callbacks.onMoveUp) callbacks.onMoveUp(+e.target.dataset.i); });
  });
  wrap.querySelectorAll('.move-dn').forEach(btn=>{
    btn.addEventListener('click', e=>{ if (callbacks.onMoveDown) callbacks.onMoveDown(+e.target.dataset.i); });
  });
  wrap.querySelectorAll('.del').forEach(btn=>{
    btn.addEventListener('click', e=>{ if (callbacks.onRemove) callbacks.onRemove(+e.target.dataset.i); });
  });
}

function linspace(a,b,n){
  if (n<=1) return [a];
  const out = new Array(n);
  for (let i=0;i<n;i++) out[i] = a + (b-a)*i/(n-1);
  return out;
}
function interpLinear(xs, ys, xq){
  const n = xs.length;
  const out = new Array(xq.length).fill(NaN);
  for (let i=0;i<xq.length;i++){
    const x = xq[i];
    if (x < xs[0] || x > xs[n-1]) continue;
    let lo=0, hi=n-1;
    while (hi-lo>1){
      const mid=(lo+hi)>>1;
      if (xs[mid] <= x) lo=mid; else hi=mid;
    }
    const x0=xs[lo], x1=xs[hi], y0=ys[lo], y1=ys[hi];
    out[i] = (x1===x0) ? y0 : y0 + (y1-y0)*(x-x0)/(x1-x0);
  }
  return out;
}
function movingAverage(y, N){
  N = Math.max(1, Math.round(N));
  if (N<=1) return y.slice();
  const n = y.length;
  const out = new Array(n);
  for (let i=0;i<n;i++){
    let lo = i - Math.floor((N-1)/2);
    let hi = i + Math.ceil((N-1)/2);
    lo = Math.max(0, lo); hi = Math.min(n-1, hi);
    let s=0,c=0;
    for (let k=lo;k<=hi;k++){ s+=y[k]; c++; }
    out[i] = s/c;
  }
  return out;
}
function gradientArr(y, x){
  const n = y.length; const out = new Array(n);
  for (let i=0;i<n;i++){
    if (i===0) out[i] = (y[1]-y[0])/(x[1]-x[0]);
    else if (i===n-1) out[i] = (y[n-1]-y[n-2])/(x[n-1]-x[n-2]);
    else out[i] = (y[i+1]-y[i-1])/(x[i+1]-x[i-1]);
  }
  return out;
}
function cumtrapz(x, y){
  const n=x.length; const out=new Array(n); out[0]=0;
  for (let i=1;i<n;i++){
    out[i] = out[i-1] + 0.5*(y[i]+y[i-1])*(x[i]-x[i-1]);
  }
  return out;
}
function meanArr(a){ return a.reduce((s,v)=>s+v,0)/a.length; }
function stdArr(a){
  if (a.length<2) return 0;
  const m = meanArr(a);
  const v = a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1);
  return Math.sqrt(v);
}
function maxArr(a){ return a.reduce((m,v)=> isFinite(v)&&v>m?v:m, -Infinity); }
function minArr(a){ return a.reduce((m,v)=> isFinite(v)&&v<m?v:m, Infinity); }

function fitLinear(x,y){
  const n = x.length;
  if (n<2) return {slope:NaN,intercept:NaN,rmse:Infinity,R2:NaN,varM:NaN,varB:NaN,covMB:NaN};
  let sx=0,sy=0,sxx=0,sxy=0;
  for (let i=0;i<n;i++){ sx+=x[i]; sy+=y[i]; sxx+=x[i]*x[i]; sxy+=x[i]*y[i]; }
  const meanX = sx/n, meanY = sy/n;
  const Sxx = sxx - n*meanX*meanX;
  const Sxy = sxy - n*meanX*meanY;
  const slope = Sxy/Sxx;
  const intercept = meanY - slope*meanX;
  let ssres=0;
  for (let i=0;i<n;i++){ const r = y[i]-(slope*x[i]+intercept); ssres += r*r; }
  const rmse = Math.sqrt(ssres/n);
  let sstot=0; for (let i=0;i<n;i++){ sstot += (y[i]-meanY)*(y[i]-meanY); }
  const R2 = sstot===0 ? 1 : 1 - ssres/sstot;
  const dof = Math.max(1, n-2);
  const sigma2 = ssres/dof;
  const XtX00 = sxx, XtX01 = sx, XtX11 = n;
  const det = XtX00*XtX11 - XtX01*XtX01;
  let varM=NaN, varB=NaN, covMB=NaN;
  if (Math.abs(det) > 1e-12){
    const inv00 = XtX11/det, inv01 = -XtX01/det, inv11 = XtX00/det;
    varM = sigma2*inv00; varB = sigma2*inv11; covMB = sigma2*inv01;
  }
  return {slope, intercept, rmse, R2, varM, varB, covMB};
}

function betacf(x,a,b){
  const MAXIT=200, EPS=3e-16, FPMIN=1e-300;
  let qab=a+b, qap=a+1, qam=a-1;
  let c=1, d=1-qab*x/qap;
  if (Math.abs(d)<FPMIN) d=FPMIN;
  d=1/d; let h=d;
  for (let m=1;m<=MAXIT;m++){
    const m2=2*m;
    let aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d; if (Math.abs(d)<FPMIN) d=FPMIN;
    c=1+aa/c; if (Math.abs(c)<FPMIN) c=FPMIN;
    d=1/d; h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d; if (Math.abs(d)<FPMIN) d=FPMIN;
    c=1+aa/c; if (Math.abs(c)<FPMIN) c=FPMIN;
    d=1/d; const del=d*c; h*=del;
    if (Math.abs(del-1)<EPS) break;
  }
  return h;
}
function logGamma(x){
  const g=7, c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (x<0.5) return Math.log(Math.PI/Math.sin(Math.PI*x)) - logGamma(1-x);
  x-=1; let a=c[0]; const t=x+g+0.5;
  for (let i=1;i<g+2;i++) a+=c[i]/(x+i);
  return 0.5*Math.log(2*Math.PI)+(x+0.5)*Math.log(t)-t+Math.log(a);
}
function betainc(x,a,b){
  if (x<=0) return 0; if (x>=1) return 1;
  const bt = Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log(1-x));
  if (x < (a+1)/(a+b+2)) return bt*betacf(x,a,b)/a;
  return 1 - bt*betacf(1-x,b,a)/b;
}
function tcdf(t, df){
  const x = df/(df+t*t);
  const p = betainc(x, df/2, 0.5);
  return t>0 ? 1-0.5*p : 0.5*p;
}
function tinv(p, df){
  let lo=0, hi=1000;
  for (let i=0;i<100;i++){
    const mid=(lo+hi)/2;
    const cp = tcdf(mid, df);
    if (cp < p) lo=mid; else hi=mid;
  }
  return (lo+hi)/2;
}

/* tab navigation */
document.getElementById('nav').addEventListener('click', e=>{
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  goTab(btn.dataset.tab);
});
document.querySelectorAll('.home-card').forEach(c=>{
  c.addEventListener('click', ()=>goTab(c.dataset.go));
});
document.querySelectorAll('.home-settings-link[data-tab]').forEach(c=>{
  c.addEventListener('click', ()=>goTab(c.dataset.tab));
});
function goTab(tab){
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.id==='tab-'+tab));
}

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
    this.svg.appendChild(defs); this.svg.appendChild(this.gAxes); this.svg.appendChild(this.gData); this.svg.appendChild(this.gOverlay);
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
  tickLabel(xv, text){
    const entry = {type:'ticklabel', xv, text};
    this._stored.push(entry);
    return this._renderTickLabel(entry);
  }
  _renderTickLabel(entry){
    const {h}=this.size(); const m=this.margin;
    const t = svgEl('text',{x:this.px(entry.xv), y:h-m.b+28, 'font-size':10, fill:'#93a0b0', 'text-anchor':'middle', 'class':'plot-tick'});
    t.textContent = entry.text;
    this.gAxes.appendChild(t);
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
      let dragging = false;
      const move = (clientX)=>{
        const rect = this.svg.getBoundingClientRect();
        let xv2 = this.invX(clientX - rect.left);
        xv2 = Math.max(this.xmin, Math.min(this.xmax, xv2));
        entry.xv = xv2;
        if (entry.onDrag) entry.onDrag(xv2);
      };
      hit.addEventListener('pointerdown', e=>{ dragging = true; e.preventDefault(); e.stopPropagation(); });
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
      }
      else { wrapEl.appendChild(col); }
    }
    const div = document.createElement('div');
    div.className = 'plot-tool-btns';
    const panBtn = document.createElement('button');
    panBtn.className = 'btn secondary plot-tool-btn';
    panBtn.title = 'Pan';
    panBtn.innerHTML = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`;
    const zoomBtn = document.createElement('button');
    zoomBtn.className = 'btn secondary plot-tool-btn';
    zoomBtn.title = 'Zoom area';
    zoomBtn.innerHTML = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="22" y2="22"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>`;
    const snapBtn = document.createElement('button');
    snapBtn.className = 'btn secondary plot-tool-btn';
    snapBtn.title = 'Download current view';
    snapBtn.innerHTML = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
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
      } else if (P._mode === 'zoom' && zoomStart && zoomRect){
        const svgRect = svg.getBoundingClientRect();
        const cx=e.clientX-svgRect.left, cy=e.clientY-svgRect.top;
        zoomRect.setAttribute('x', Math.min(cx,zoomStart.cx));
        zoomRect.setAttribute('y', Math.min(cy,zoomStart.cy));
        zoomRect.setAttribute('width', Math.abs(cx-zoomStart.cx));
        zoomRect.setAttribute('height', Math.abs(cy-zoomStart.cy));
      }
    });

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
window.addEventListener('resize', ()=>{ if (window._redrawAll) window._redrawAll(); });
window._redrawAll = ()=>{
  if (window._taucRedraw) window._taucRedraw();
  if (window._xrdRedraw) window._xrdRedraw();
  if (window._eprRedraw) window._eprRedraw();
  if (window._gcRedraw) window._gcRedraw();
};

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
  workSvg.querySelectorAll('.plot-goverlay').forEach(el=>{ while(el.firstChild) el.removeChild(el.firstChild); });

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

/* =========================================================
   ALERT HELPERS
========================================================= */
function buildAlertsHtml(invalidNames, warnNames, warnHeader, dismissInvalidFn, dismissWarnFn){
  const makeX = fn => `<button class="alert-dismiss" onclick="${fn||"this.closest('.alert').remove()"}" title="Dismiss">✕</button>`;
  let html = '';
  if (invalidNames.length)
    html += '<div class="alert bad">✕ Invalid file(s):<br>' + invalidNames.join('<br>') + makeX(dismissInvalidFn) + '</div>';
  if (warnNames.length)
    html += '<div class="alert warn">⚠ ' + (warnHeader || 'Non-standard format — verify these files:') + '<br>' + warnNames.join('<br>') + makeX(dismissWarnFn) + '</div>';
  return html;
}

function nextColor(existingFiles){
  const used = new Set(existingFiles.map(f=>f.color));
  for (let i=0; i<COLORS.length*2; i++){ const c=colorOf(i); if (!used.has(c)) return c; }
  return colorOf(existingFiles.length);
}

/* =========================================================
   TAUC MODULE
========================================================= */
(function(){
  let files = []; // {name,label,wl[],FR[],hv[]}  (each on its own native axis)
  let currIndex=0;
  let plot;
  let vlines = {};
  let bestRegsAll = [];
  // per-upload invalid names (files that were skipped); persists until all files are removed
  let invalidUploadNames = [];
  let taucUploadAlerts = '';
  let taucWarnDismissed = false;

  window.dismissTaucInvalid = function(){ invalidUploadNames=[]; rebuildTaucAlerts(); };
  window.dismissTaucWarn    = function(){ taucWarnDismissed=true; rebuildTaucAlerts(); };
  window.dismissTaucUpload  = function(){ taucUploadAlerts=''; rebuildTaucAlerts(); };

  function rebuildTaucAlerts(){
    const warnNames = taucWarnDismissed ? [] : files.filter(f=>f.warn).map(f=>f.name);
    document.getElementById('taucAlerts').innerHTML =
      buildAlertsHtml(invalidUploadNames, warnNames, undefined, 'dismissTaucInvalid()', 'dismissTaucWarn()') + taucUploadAlerts;
  }

  function fileCallbacks(){
    return {
      onRemove(i){
        files.splice(i,1);
        if (!files.length) invalidUploadNames = [];
        rebuildTaucAlerts();
        afterFilesChange();
      },
      onMoveUp(i){ if(i>0){[files[i-1],files[i]]=[files[i],files[i-1]]; rebuildTaucAlerts(); afterFilesChange();} },
      onMoveDown(i){ if(i<files.length-1){[files[i],files[i+1]]=[files[i+1],files[i]]; rebuildTaucAlerts(); afterFilesChange();} },
      onLabelChange(i, v){ files[i].label=v; updateTaucResults(); },
      onColorChange(i, v){ files[i].color=v; updateTaucResults(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ files.length=0; invalidUploadNames=[]; taucUploadAlerts=''; taucWarnDismissed=false; vlines={}; rebuildTaucAlerts(); afterFilesChange(); },
    };
  }

  setupDropzone('taucDropzone', 'taucFiles', async (fileList)=>{
    const existing = new Set(files.map(f=>f.name));
    const newInvalid = [];
    const alreadyLoaded = [];
    for (const f of fileList){
      if (existing.has(f.name)){ alreadyLoaded.push(f.name); continue; }
      existing.add(f.name);
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
      if (wl.length) files.push({name:f.name, label:f.name.replace(/\.[^.]+$/,''), wl, FR:fr, warn, color:nextColor(files)});
    }
    invalidUploadNames = newInvalid;
    taucWarnDismissed = false;
    taucUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'dismissTaucUpload()') : '';
    rebuildTaucAlerts();
    afterFilesChange();
  });

  function afterFilesChange(){
    renderUnifiedFileList('taucFileTableWrap', files, fileCallbacks());
    if (files.length) setupAnalysis();
    else {
      document.getElementById('taucWorkspace').style.display='none';
      document.getElementById('taucResults').style.display='none';
      document.getElementById('taucExportCard').style.display='none';
    }
  }

  // Energy axis is just 1240/λ — each file stays on its own native grid
  function setupAnalysis(){
    files.forEach(f=>{ f.hv = f.wl.map(wl=>1240/wl); });
    if (currIndex >= files.length) currIndex = files.length-1;
    bestRegsAll = files.map(()=>null);
    document.getElementById('taucWorkspace').style.display='block';
    document.getElementById('taucResults').style.display='block';
    document.getElementById('taucExportCard').style.display='block';
    initTaucPlot();
  }

  // Union of all files' ranges (for shared overlay axes)
  function unionWl(){ let lo=Infinity,hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,minArr(f.wl)); hi=Math.max(hi,maxArr(f.wl)); }); return [lo,hi]; }
  function unionHv(){ let lo=Infinity,hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,minArr(f.hv)); hi=Math.max(hi,maxArr(f.hv)); }); return [lo,hi]; }

  function initTaucPlot(){
    plot = new Plot(document.getElementById('taucSvg'), {xlabel:'hν (eV)', ylabelSvg:'[F(R)·hν]<tspan baseline-shift="super" font-size="8">a</tspan>', xTickStep:0.5, noYTickLabels:true});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    const [hvMin, hvMax] = unionHv();
    if (!isFinite(vlines.v1)){
      vlines.v1 = hvMin + 0.6*(hvMax-hvMin);
      vlines.v2 = hvMin + 0.8*(hvMax-hvMin);
      vlines.v3 = hvMin + 0.2*(hvMax-hvMin);
      vlines.v4 = hvMin + 0.4*(hvMax-hvMin);
    }
    updateTaucView();
  }

  function curParams(){
    return {
      a: parseFloat(document.getElementById('taucA').value),
      N: Math.max(1, Math.round(+document.getElementById('taucN').value||1)),
      N2: Math.max(1, Math.round(+document.getElementById('taucN2').value||1)),
      M: Math.max(2, Math.round(+document.getElementById('taucM').value||2)),
      M2: Math.max(2, Math.round(+document.getElementById('taucM2').value||2)),
    };
  }

  function scanRegr(hv, frArr, a, N, M, x1, x2){
    const Yraw = frArr.map((v,i)=>Math.pow(v*hv[i], a));
    const Ys = movingAverage(Yraw, N);
    const lo = Math.min(x1,x2), hi=Math.max(x1,x2);
    const idxSel = [];
    for (let i=0;i<hv.length;i++) if (hv[i]>=lo && hv[i]<=hi) idxSel.push(i);
    let best = {slope:NaN,intercept:NaN,R2:NaN,RMSE:Infinity,bestIdx:[],varM:NaN,varB:NaN,covMB:NaN};
    if (idxSel.length < M) return best;
    let bestScore = Infinity;
    for (let s=0; s<=idxSel.length-M; s++){
      const block = idxSel.slice(s, s+M);
      const yb = block.map(i=>Ys[i]);
      if (yb.some(v=>!isFinite(v))) continue;
      const xb = block.map(i=>hv[i]);
      const r = fitLinear(xb, yb);
      const score = r.rmse / r.R2;
      if (score < bestScore){
        bestScore = score;
        best = {slope:r.slope, intercept:r.intercept, R2:r.R2, RMSE:r.rmse, bestIdx:block, varM:r.varM, varB:r.varB, covMB:r.covMB};
      }
    }
    return best;
  }

  function analyzeOneFile(hv, frArr, a,N,M,x1,x2,M2,x3,x4){
    const regs = scanRegr(hv, frArr, a, N, M, x1, x2);
    const regs2 = scanRegr(hv, frArr, a, N, M2, x3, x4);
    let Eg=NaN, EgErr=NaN, EgInt=NaN, EgIntErr=NaN;
    if ([regs.slope,regs.intercept,regs2.slope,regs2.intercept].every(isFinite)){
      const xInt = (regs2.intercept - regs.intercept)/(regs.slope - regs2.slope);
      const dxdb1 = -1/(regs.slope-regs2.slope), dxdb2 = 1/(regs.slope-regs2.slope);
      const dxdm1 = (regs2.intercept-regs.intercept)/Math.pow(regs.slope-regs2.slope,2);
      const dxdm2 = -dxdm1;
      const t1 = tinv(0.995, M-2), t2 = tinv(0.995, M2-2);
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
        EgErr = varEg>=0 ? Math.sqrt(varEg)*tinv(0.995, M-2) : NaN;
      }
    }
    return {Eg,EgErr,EgInt,EgIntErr,regs,regs2};
  }

  function processAll(p){
    bestRegsAll = files.map((f,k)=>{
      const r = analyzeOneFile(f.hv, f.FR, p.a, p.N, p.M, vlines.v1, vlines.v2, p.M2, vlines.v3, vlines.v4);
      return {label:f.label, ...r};
    });
  }

  function updateTaucView(preserveView){
    if (!plot || !files.length) return;
    const p = curParams();
    const hv = files[currIndex].hv, frArr = files[currIndex].FR;
    document.getElementById('taucCurrentLabel').textContent = files[currIndex].label;
    document.getElementById('taucIdx').textContent = (currIndex+1)+'/'+files.length;

    const Yraw = frArr.map((v,i)=>Math.pow(v*hv[i], p.a));
    const Ys = movingAverage(Yraw, p.N);
    let dY = gradientArr(Ys, hv);
    let dYs = movingAverage(dY, p.N2);
    const dmin = minArr(dYs), dmax = maxArr(dYs), ymax = maxArr(Ys);
    dYs = dYs.map(v=> (dmax-dmin)>0 ? (v-dmin)/(dmax-dmin)*ymax : v);

    // Capture current zoom so it can be kept across redraws (the full range
    // set below stays as the "home" reset target)
    const prev = (preserveView && isFinite(plot.xmin)) ? {xmin:plot.xmin, xmax:plot.xmax, ymin:plot.ymin, ymax:plot.ymax} : null;
    plot.setRange(minArr(hv), maxArr(hv), 0, maxArr(Yraw)*1.05);
    if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
    plot.clearData();
    plot.ylabelSvg = `[F(R)·hν]<tspan baseline-shift="super" font-size="8">${p.a}</tspan> (a.u.)`;
    plot.drawAxes();
    plot.line(hv, Yraw, '#ffffff', 1);
    plot.line(hv, Ys, '#3aa0ff', 1.4);
    plot.line(hv, dYs, '#5fcf6a', 1);

    const lo1=Math.min(vlines.v1,vlines.v2), hi1=Math.max(vlines.v1,vlines.v2);
    const lo2=Math.min(vlines.v3,vlines.v4), hi2=Math.max(vlines.v3,vlines.v4);
    const sel1 = hv.filter(v=>v>=lo1&&v<=hi1).length;
    const sel2 = hv.filter(v=>v>=lo2&&v<=hi2).length;
    const alertDiv = document.getElementById('taucAlert');
    alertDiv.innerHTML='';

    if (sel1>=p.M){
      const regs = scanRegr(hv, frArr, p.a, p.N, p.M, vlines.v1, vlines.v2);
      document.getElementById('taucRMSE1').textContent = isFinite(regs.RMSE)? regs.RMSE.toExponential(3): '-';
      document.getElementById('taucR21').textContent = isFinite(regs.R2)? regs.R2.toFixed(3): '-';
      if (regs.bestIdx.length){
        const xb = regs.bestIdx.map(i=>hv[i]);
        const yb = xb.map(x=>regs.slope*x+regs.intercept);
        plot.line(xb, yb, '#ff5050', 2.2);
        const xExt = linspace(minArr(hv), maxArr(hv), 100);
        plot.line(xExt, xExt.map(x=>regs.slope*x+regs.intercept), '#ff5050', 1, '5,4');
      }
    } else {
      document.getElementById('taucRMSE1').textContent='-'; document.getElementById('taucR21').textContent='-';
      alertDiv.innerHTML = '<div class="alert warn">⚠ Interval too small: too few points for the regression!</div>';
    }
    if (sel2>=p.M2){
      const regs2 = scanRegr(hv, frArr, p.a, p.N, p.M2, vlines.v3, vlines.v4);
      document.getElementById('taucRMSE2').textContent = isFinite(regs2.RMSE)? regs2.RMSE.toExponential(3): '-';
      document.getElementById('taucR22').textContent = isFinite(regs2.R2)? regs2.R2.toFixed(3): '-';
      if (regs2.bestIdx.length){
        const xb = regs2.bestIdx.map(i=>hv[i]);
        const yb = xb.map(x=>regs2.slope*x+regs2.intercept);
        plot.line(xb, yb, '#d050ff', 2.2);
        const xExt = linspace(minArr(hv), maxArr(hv), 100);
        plot.line(xExt, xExt.map(x=>regs2.slope*x+regs2.intercept), '#d050ff', 1, '5,4');
      }
    } else {
      document.getElementById('taucRMSE2').textContent='-'; document.getElementById('taucR22').textContent='-';
      if (!alertDiv.innerHTML) alertDiv.innerHTML = '<div class="alert warn">⚠ Interval too small: too few points for the regression!</div>';
    }

    const res = analyzeOneFile(hv, frArr, p.a, p.N, p.M, vlines.v1, vlines.v2, p.M2, vlines.v3, vlines.v4);
    document.getElementById('taucEg').textContent = isFinite(res.Eg) ? (isFinite(res.EgErr) ? `${res.Eg.toFixed(3)} ± ${res.EgErr.toFixed(3)} eV` : `${res.Eg.toFixed(3)} eV`) : '-';
    document.getElementById('taucEgInt').textContent = isFinite(res.EgInt) ? (isFinite(res.EgIntErr) ? `${res.EgInt.toFixed(3)} ± ${res.EgIntErr.toFixed(3)} eV` : `${res.EgInt.toFixed(3)} eV`) : '-';

    plot.vline(vlines.v1, '#ff5050', true, v=>{vlines.v1=v; throttledUpdate();}, v=>{vlines.v1=v; updateTaucView(true);});
    plot.vline(vlines.v2, '#ff5050', true, v=>{vlines.v2=v; throttledUpdate();}, v=>{vlines.v2=v; updateTaucView(true);});
    plot.vline(vlines.v3, '#d050ff', true, v=>{vlines.v3=v; throttledUpdate();}, v=>{vlines.v3=v; updateTaucView(true);});
    plot.vline(vlines.v4, '#d050ff', true, v=>{vlines.v4=v; throttledUpdate();}, v=>{vlines.v4=v; updateTaucView(true);});

    updateTaucResults();
  }

  function updateTaucResults(){
    if (!files.length) return;
    const p = curParams();
    processAll(p);
    renderResView(p);
    renderEgTable();
  }

  let throttle=null;
  function throttledUpdate(){
    if (throttle) return;
    throttle = requestAnimationFrame(()=>{ throttle=null; updateTaucView(true); });
  }

  // Live param updates — keep the current zoom (except when changing the
  // exponent, which rescales the y-axis, so a full reset is clearer there)
  ['taucA','taucN','taucN2','taucM','taucM2'].forEach(id=>{
    document.getElementById(id).addEventListener('input', ()=>{
      if (id==='taucA') document.getElementById('taucNExp').textContent = document.getElementById('taucA').value;
      if(plot) updateTaucView(id!=='taucA');
    });
  });

  document.getElementById('taucPrev').onclick = ()=>{ if (!files.length) return; currIndex=(currIndex-1+files.length)%files.length; updateTaucView(); };
  document.getElementById('taucNext').onclick = ()=>{ if (!files.length) return; currIndex=(currIndex+1)%files.length; updateTaucView(); };
  window._taucRedraw = ()=>{ if (plot && files.length) updateTaucView(true); };

  function renderEgTable(){
    const wrap = document.getElementById('taucEgTableWrap');
    let html = '<table><colgroup><col style="width:44%"><col style="width:28%"><col style="width:28%"></colgroup><thead><tr><th rowspan="2">Label</th><th colspan="2" style="text-align:center">E<sub>g</sub> (eV)</th></tr><tr><th style="text-align:center">x-axis</th><th style="text-align:center">baseline</th></tr></thead><tbody>';
    bestRegsAll.forEach(r=>{
      const egNeg = isFinite(r.Eg) && r.Eg < 0;
      const egiNeg = isFinite(r.EgInt) && r.EgInt < 0;
      const eg = isFinite(r.Eg)
        ? (egNeg
            ? `<span style="color:var(--warn)">⚠ ${r.Eg.toFixed(3)}</span>`
            : (isFinite(r.EgErr) ? `${r.Eg.toFixed(3)} ± ${r.EgErr.toFixed(3)}` : r.Eg.toFixed(3)))
        : '—';
      const egi = isFinite(r.EgInt)
        ? (egiNeg
            ? `<span style="color:var(--warn)">⚠ ${r.EgInt.toFixed(3)}</span>`
            : (isFinite(r.EgIntErr) ? `${r.EgInt.toFixed(3)} ± ${r.EgIntErr.toFixed(3)}` : r.EgInt.toFixed(3)))
        : '—';
      html += `<tr><td>${r.label}</td><td>${eg}</td><td>${egi}</td></tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function renderResView(p){
    // Plot 0: F(R) vs λ
    const plot0 = new Plot(document.getElementById('taucResSvg0'), {xlabel:'Wavelength (nm)', ylabel:'F(R) (a.u.)', xTickStep:50, noYTickLabels:true});
    const leg0 = document.getElementById('taucResLegend0'); leg0.innerHTML='';
    let ymax0=-Infinity;
    files.forEach((f,k)=>{ ymax0=Math.max(ymax0,maxArr(f.FR)); });
    const [wl0, wl1] = unionWl();
    plot0.setRange(wl0, wl1, 0, ymax0);
    plot0.drawAxes();
    files.forEach((f,k)=>{
      plot0.line(f.wl, f.FR, f.color, 1.3);
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${f.color}"></i>${f.label}`; leg0.appendChild(s);
    });
    plot0.attachTools(plot0.svg.closest('.plot-wrap'));

    // Plot 1: Tauc + regressions
    const plot1 = new Plot(document.getElementById('taucResSvg1'), {xlabel:'Energy (eV)', ylabelSvg:`[F(R)·hν]<tspan baseline-shift="super" font-size="8">${p.a}</tspan> (a.u.)`, xTickStep:0.5, noYTickLabels:true});
    const leg1 = document.getElementById('taucResLegend1'); leg1.innerHTML='';
    const Ys_all = files.map((f,k)=>{
      const Yraw = f.FR.map((v,i)=>Math.pow(v*f.hv[i], p.a));
      return movingAverage(Yraw, p.N);
    });
    const ymax1 = Math.max(...Ys_all.map(maxArr));
    const [hv0, hv1] = unionHv();
    plot1.setRange(hv0, hv1, 0, ymax1);
    plot1.drawAxes();
    files.forEach((f,k)=>{
      plot1.line(f.hv, Ys_all[k], f.color, 1.1);
      const r = bestRegsAll[k];
      if (r && isFinite(r.regs.slope)){
        const xExt = linspace(hv0, hv1, 100);
        plot1.line(xExt, xExt.map(x=>r.regs.slope*x+r.regs.intercept), f.color, 1, '5,4');
      }
      if (r && isFinite(r.regs2.slope)){
        const xExt = linspace(hv0, hv1, 100);
        plot1.line(xExt, xExt.map(x=>r.regs2.slope*x+r.regs2.intercept), f.color, 1, '2,3');
      }
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${f.color}"></i>${f.label}`; leg1.appendChild(s);
    });
    plot1.attachTools(plot1.svg.closest('.plot-wrap'));

    // Plot 2: Eg bar chart
    const aVal = document.getElementById('taucA').value;
    const egLabel = aVal === '2' ? 'Direct' : 'Indirect';
    const barTitleEl = document.getElementById('taucBarTitle');
    if (barTitleEl) barTitleEl.textContent = egLabel + ' Energy Band Gap';
    const leg2 = document.getElementById('taucResLegend2'); leg2.innerHTML='';
    const barAlertDiv = document.getElementById('taucBarAlert'); barAlertDiv.innerHTML='';
    const egs = bestRegsAll.map(r=>r.Eg), egErrs = bestRegsAll.map(r=>r.EgErr);
    const egInts = bestRegsAll.map(r=>r.EgInt), egIntErrs = bestRegsAll.map(r=>r.EgIntErr);
    const n = files.length;
    // Collect negative Eg warnings
    const negWarns = [];
    for (let k=0;k<n;k++){
      if (isFinite(egs[k]) && egs[k]<0) negWarns.push(`⚠ Eg (x-axis) is negative for "${files[k].label}"!`);
      if (isFinite(egInts[k]) && egInts[k]<0) negWarns.push(`⚠ Eg (baseline) is negative for "${files[k].label}"!`);
    }
    const posVals = egs.concat(egInts).filter(v=>isFinite(v)&&v>0);
    const noChart = !posVals.length;
    if (negWarns.length) barAlertDiv.innerHTML = negWarns.map((w,i)=>`<div class="alert warn"${noChart&&!i?' style="margin-top:0"':''}>${w}</div>`).join('');
    const barSvg = document.getElementById('taucResSvg2');
    const barWrap = barSvg.closest('.plot-wrap');
    if (noChart){
      barSvg.style.display='none'; barWrap.style.display='none';
    } else {
      barSvg.style.display=''; barWrap.style.display='';
      const plot2 = new Plot(barSvg, {xlabel:'', ylabelSvg:`${egLabel} Band Gap E<tspan baseline-shift="sub" font-size="8">g</tspan> (eV)`, noXTickLabels:true});
      const ymax2 = Math.max(...posVals)*1.3;
      plot2.setRange(0, n+1, 0, ymax2||1);
      plot2.drawAxes();
      for (let k=0;k<n;k++){
        const xc = k+1;
        if (isFinite(egs[k])&&egs[k]>0){
          const x0=xc-0.18, x1=xc-0.02;
          drawBar(plot2,x0,x1,egs[k],'#3aa0ff');
          if (isFinite(egErrs[k])) drawErrBar(plot2,(x0+x1)/2,egs[k],egErrs[k]);
        }
        if (isFinite(egInts[k])&&egInts[k]>0){
          const x0=xc+0.02, x1=xc+0.18;
          drawBar(plot2,x0,x1,egInts[k],'#ff7a59');
          if (isFinite(egIntErrs[k])) drawErrBar(plot2,(x0+x1)/2,egInts[k],egIntErrs[k]);
        }
        plot2.tickLabel(xc, files[k].label);
      }
      plot2.attachTools(barSvg.closest('.plot-wrap'));
      leg2.innerHTML=`<span><i style="background:#3aa0ff"></i>Eg (x-axis)</span><span><i style="background:#ff7a59"></i>Eg (baseline)</span>`;
    }
    // Align the table panel with the first visible content in the left col
    const _leftCol = barSvg.closest('.col');
    const _rightCol = _leftCol && _leftCol.nextElementSibling;
    if (_rightCol) requestAnimationFrame(()=>{
      const rowTop = _leftCol.parentElement.getBoundingClientRect().top;
      let targetTop = rowTop;
      for (const child of _leftCol.children){
        const r = child.getBoundingClientRect();
        if (r.height > 0){ targetTop = r.top; break; }
      }
      _rightCol.style.marginTop = Math.max(0, Math.round(targetTop - rowTop)) + 'px';
    });
  }
  function drawBar(plot, x0, x1, val, color){ plot.bar(x0, x1, 0, val, color); }
  function drawErrBar(plot, xc, val, err){ plot.errbar(xc, val, err); }

  document.getElementById('taucExportBtn').onclick = ()=>{
    const p = curParams();
    const wrap = document.getElementById('taucDownloads'); wrap.innerHTML='';
    const maxLen = Math.max(...files.map(f=>f.wl.length));
    // FR.csv — one (wavelength, F(R)) column pair per sample (native axes)
    let h1=[]; files.forEach(f=>h1.push('wavelength_nm_'+f.label, f.label));
    let t1 = csvLine(h1);
    for (let i=0;i<maxLen;i++){
      const row=[];
      files.forEach(f=>{ if (i<f.wl.length) row.push(fmtNum(f.wl[i],6), fmtNum(f.FR[i],6)); else row.push('',''); });
      t1 += csvLine(row);
    }
    downloadBlob('FR.csv', t1);
    makeDownloadLink(wrap, 'FR.csv', t1, 'FR.csv');
    // FRhva.csv — one (energy, [F(R)·hν]^a) column pair per sample
    let h2=[]; files.forEach(f=>h2.push('energy_eV_'+f.label, f.label));
    let t2 = csvLine(h2);
    for (let i=0;i<maxLen;i++){
      const row=[];
      files.forEach(f=>{ if (i<f.hv.length) row.push(fmtNum(f.hv[i],6), fmtNum(Math.pow(f.FR[i]*f.hv[i], p.a),6)); else row.push('',''); });
      t2 += csvLine(row);
    }
    downloadBlob('FRhva.csv', t2);
    makeDownloadLink(wrap, 'FRhva.csv', t2, 'FRhva.csv');
    // regressions.csv
    let t3 = csvLine(['Label','m1','Var_m1','m2','Var_m2','q1','Var_q1','q2','Var_q2','Cov_mq1','Cov_mq2']);
    bestRegsAll.forEach(r=>{
      t3 += csvLine([r.label, fmtNum(r.regs.slope,8), fmtNum(r.regs.varM,8), fmtNum(r.regs2.slope,8), fmtNum(r.regs2.varM,8), fmtNum(r.regs.intercept,8), fmtNum(r.regs.varB,8), fmtNum(r.regs2.intercept,8), fmtNum(r.regs2.varB,8), fmtNum(r.regs.covMB,8), fmtNum(r.regs2.covMB,8)]);
    });
    downloadBlob('regressions.csv', t3);
    makeDownloadLink(wrap, 'regressions.csv', t3, 'regressions.csv');
    // Eg_values.csv
    let t4 = csvLine(['Label','Eg','Eg_err','Eg_int','Eg_int_err']);
    bestRegsAll.forEach(r=>{ t4 += csvLine([r.label, fmtNum(r.Eg,6), fmtNum(r.EgErr,6), fmtNum(r.EgInt,6), fmtNum(r.EgIntErr,6)]); });
    downloadBlob('Eg_values.csv', t4);
    makeDownloadLink(wrap, 'Eg_values.csv', t4, 'Eg_values.csv');
  };
})();

/* =========================================================
   XRD MODULE
========================================================= */
(function(){
  let files = []; // {name, label, x[], y[], color}
  let curIdx = 0;  // shared navigator index (analysis + peaks table)
  let processed = []; // per file: {smoothed, baseline, subtracted, peaks}
  let manualPeaks = []; // per file: array of manually added 2θ positions
  let removedPeaks = []; // per file: array of removed peaks' detected 2θ positions
  // Persistent last fit per file: {fits:[fp...], baseline:[...over native x], rwp}.
  // Survives smoothing/baseline/peak-search changes and navigation; only cleared by
  // deleting that file or running a new fit on it.
  let savedFits = [];
  // Peak marker colours
  const PEAK_BASE = '#3f9d54';   // darker green, base
  const PEAK_HOVER = '#5fcf6a';  // brighter green, transient hover
  const PEAK_SEL  = '#ffffff';   // white, permanent selection
  // Per-panel selection/hover state — the Analysis table talks only to the Analysis
  // plot, the Fitting table only to the Fitting plot.
  const panels = {
    a: { wrap:'xrdPeakTableWrap', box:'xrdPeakBox',    sel:null, hov:null, plot:()=>anaPlot },
    f: { wrap:'xrdFitTableWrap',  box:'xrdFitPeakBox', sel:null, hov:null, plot:()=>fitPlot },
  };
  let resPlot;
  let xrdUploadAlerts = '';

  // Per-field mode: 'shared' | 'per'. Defaults: peak-search fields per-sample, rest shared.
  const paramMode = { N:'shared', blWin:'shared', pkHeight:'per', pkProm:'per', pkDist:'per', K:'shared', lambda:'shared' };
  // Which mode key controls each stored field
  const FIELD_MODE = { N:'N', blWin:'blWin', pkHeight:'pkHeight', pkProm:'pkProm', pkDist:'pkDist', K:'K', lambda:'lambda' };

  // Shared param values (defaults)
  const shared = { N:10, blWin:150, pkHeight:5, pkProm:3, pkDist:0.3, K:0.9, lambda:1.540598 };

  // Per-sample param overrides (indexed by file idx)
  let perParams = []; // array of {N, blWin, pkHeight, pkProm, pkDist, K, lambda}

  // Crystallite-size / Scherrer constants and state
  const SCHERRER_K = 0.9;
  const CU_KA1 = 1.540598; // Å
  const CU_KA2 = 1.544426; // Å
  const KA2_RATIO = 0.5;   // Iα2 / Iα1
  let standardName = '';    // file.name selected as instrumental standard ('' = none)

  window.dismissXrdUpload = function(){ xrdUploadAlerts=''; rebuildXrdAlerts(); };

  // Global-fit hyperparameters (editable in the modal)
  const fitHP = { profile:'pv', asym:false, asymMode:'split', SL:0.02, HL:0.02, calib:false, bgDegree:4, maxIter:80, tol:1e-12, lambda0:1e-3, bgAnchor:0.3 };
  // Dedicated hyperparameters for the instrumental-standard fit (FCJ + calibration always on)
  const stdHP = { profile:'voigt', asym:true, asymMode:'fcj', calib:true, SL:0.02, HL:0.02, bgDegree:4, maxIter:60, tol:1e-12, lambda0:1e-3, bgAnchor:0.3 };

  function rebuildXrdAlerts(){
    document.getElementById('xrdAlerts').innerHTML = xrdUploadAlerts;
  }

  function fileCallbacks(){
    return {
      onRemove(i){ files.splice(i,1); perParams.splice(i,1); processed.splice(i,1); manualPeaks.splice(i,1); removedPeaks.splice(i,1); savedFits.splice(i,1); afterFilesChange(); },
      onMoveUp(i){ if(i>0){[files[i-1],files[i]]=[files[i],files[i-1]]; [perParams[i-1],perParams[i]]=[perParams[i],perParams[i-1]]; [processed[i-1],processed[i]]=[processed[i],processed[i-1]]; [manualPeaks[i-1],manualPeaks[i]]=[manualPeaks[i],manualPeaks[i-1]]; [removedPeaks[i-1],removedPeaks[i]]=[removedPeaks[i],removedPeaks[i-1]]; [savedFits[i-1],savedFits[i]]=[savedFits[i],savedFits[i-1]]; afterFilesChange();} },
      onMoveDown(i){ if(i<files.length-1){[files[i],files[i+1]]=[files[i+1],files[i]]; [perParams[i],perParams[i+1]]=[perParams[i+1],perParams[i]]; [processed[i],processed[i+1]]=[processed[i+1],processed[i]]; [manualPeaks[i],manualPeaks[i+1]]=[manualPeaks[i+1],manualPeaks[i]]; [removedPeaks[i],removedPeaks[i+1]]=[removedPeaks[i+1],removedPeaks[i]]; [savedFits[i],savedFits[i+1]]=[savedFits[i+1],savedFits[i]]; afterFilesChange();} },
      onLabelChange(i, v){ files[i].label=v; renderPeakTable(); updateXrdResults(); },
      onColorChange(i, v){ files[i].color=v; updateXrdResults(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ files.length=0; processed=[]; perParams=[]; manualPeaks=[]; removedPeaks=[]; savedFits=[]; panels.a.sel=panels.a.hov=panels.f.sel=panels.f.hov=null; xrdUploadAlerts=''; rebuildXrdAlerts(); afterFilesChange(); },
    };
  }

  setupDropzone('xrdDropzone', 'xrdFiles', async (fileList)=>{
    const existing = new Set(files.map(f=>f.name));
    const alreadyLoaded = [];
    for (const f of fileList){
      if (existing.has(f.name)){ alreadyLoaded.push(f.name); continue; }
      existing.add(f.name);
      const text = await f.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      const positions = xml.getElementsByTagName('positions');
      let start=null, end=null;
      for (const pos of positions){
        if (pos.getAttribute('axis')==='2Theta'){
          start = parseFloat(pos.getElementsByTagName('startPosition')[0].textContent);
          end   = parseFloat(pos.getElementsByTagName('endPosition')[0].textContent);
          break;
        }
      }
      const intensNode = xml.getElementsByTagName('intensities')[0];
      if (!intensNode || start===null) continue;
      const y = intensNode.textContent.trim().split(/\s+/).map(Number);
      const ymin = minArr(y);
      const yCorr = y.map(v=>v-ymin);
      const x = linspace(start, end, y.length);
      // Keep each file on its own native 2θ axis — no resampling
      files.push({name:f.name, label:f.name.replace(/\.[^.]+$/,''), x, y:yCorr, color:nextColor(files)});
      perParams.push({...shared});
      manualPeaks.push([]);
      removedPeaks.push([]);
    }
    xrdUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'dismissXrdUpload()') : '';
    rebuildXrdAlerts();
    afterFilesChange();
  });

  // Union of all files' 2θ ranges (for shared plot axes)
  function unionRange(){
    let lo = Infinity, hi = -Infinity;
    for (const f of files){ lo = Math.min(lo, f.x[0]); hi = Math.max(hi, f.x[f.x.length-1]); }
    return [isFinite(lo)?lo:0, isFinite(hi)?hi:1];
  }

  // Rebuild the instrumental-standard dropdown from the current file list
  function populateStandardSelect(){
    const sel = document.getElementById('xrdStandard');
    if (!sel) return;
    if (standardName && !files.some(f=>f.name===standardName)) standardName = '';
    sel.innerHTML = '<option value="">None</option>' +
      files.map(f=>`<option value="${f.name.replace(/"/g,'&quot;')}">${f.label}</option>`).join('');
    sel.value = standardName;
  }

  function afterFilesChange(){
    renderUnifiedFileList('xrdFileTableWrap', files, fileCallbacks());
    if (files.length){
      document.getElementById('xrdWorkspace').style.display='block';
      document.getElementById('xrdFitCard').style.display='block';
      document.getElementById('xrdResults').style.display='block';
      document.getElementById('xrdExportCard').style.display='block';
      if (curIdx >= files.length) curIdx = files.length-1;
      populateStandardSelect();
      reprocessAll();
      writeStoreToInputs();
      updateXrdAnalysis();
      updateXrdFitting();
      updateXrdResults();
    } else {
      ['xrdWorkspace','xrdFitCard','xrdResults','xrdExportCard'].forEach(id=>{ document.getElementById(id).style.display='none'; });
    }
  }

  // Get params for a specific file index (respects per-field shared/per mode)
  function getFileParams(i){
    const pp = perParams[i] || {};
    const g = k => paramMode[k]==='shared' ? shared[k] : (pp[k] ?? shared[k]);
    return { N:g('N'), blWin:g('blWin'), pkHeight:g('pkHeight'), pkProm:g('pkProm'), pkDist:g('pkDist'), K:g('K'), lambda:g('lambda') };
  }

  // Read inputs into the appropriate store for curIdx
  // Parse a decimal field tolerant of comma separators; only fall back on a genuinely empty/invalid value
  function numField(id, def){
    const raw = String(document.getElementById(id).value).trim().replace(',', '.');
    if (raw === '') return def;
    const v = parseFloat(raw);
    return isNaN(v) ? def : v;
  }

  // input id ↔ stored field key
  const FIELD_INPUT = { N:'xrdSmooth', blWin:'xrdBlWin', pkHeight:'xrdPkHeight', pkProm:'xrdPkProm', pkDist:'xrdPkDist', K:'xrdK', lambda:'xrdLambda' };
  const FIELD_MIN   = { N:1, blWin:1, pkHeight:0, pkProm:0, pkDist:0, K:1e-6, lambda:1e-6 };
  const FIELD_DEF   = { N:10, blWin:150, pkHeight:5, pkProm:3, pkDist:0.3, K:0.9, lambda:1.540598 };

  function readInputsToStore(){
    for (const key in FIELD_INPUT){
      const v = Math.max(FIELD_MIN[key], numField(FIELD_INPUT[key], FIELD_DEF[key]));
      if (paramMode[key]==='shared') shared[key] = v;
      else { if (!perParams[curIdx]) perParams[curIdx] = {}; perParams[curIdx][key] = v; }
    }
  }

  // Push stored values for curIdx into the input fields
  function writeStoreToInputs(){
    const p = getFileParams(curIdx);
    for (const key in FIELD_INPUT) document.getElementById(FIELD_INPUT[key]).value = p[key];
  }

  // SNIP baseline: iteratively clip peaks downward
  function computeBaseline(y, halfWin){
    const n = y.length;
    const z = Float64Array.from(y);
    for (let w = halfWin; w >= 1; w--){
      for (let i = w; i < n-w; i++){
        const avg = (z[i-w] + z[i+w]) / 2;
        if (avg < z[i]) z[i] = avg;
      }
    }
    return Array.from(z);
  }

  // Compute prominence of each local maximum
  function peakProminence(y, idx){
    const h = y[idx];
    let leftBase = h, rightBase = h;
    for (let i=idx-1; i>=0; i--){ if (y[i]<leftBase) leftBase=y[i]; if (y[i]>h) break; }
    for (let i=idx+1; i<y.length; i++){ if (y[i]<rightBase) rightBase=y[i]; if (y[i]>h) break; }
    return h - Math.max(leftBase, rightBase);
  }

  // Find peaks with height + prominence thresholds and min-distance NMS
  function findPeaks(x, y, minHeightPct, minPromPct, minDistDeg){
    const mx = maxArr(y);
    if (!mx) return [];
    const minH = mx * minHeightPct / 100;
    const minP = mx * minPromPct   / 100;
    const step = x.length > 1 ? (x[x.length-1]-x[0])/(x.length-1) : 1;
    const minDistPts = minDistDeg / step;
    const candidates = [];
    for (let i=1; i<y.length-1; i++){
      if (y[i]>y[i-1] && y[i]>=y[i+1] && y[i]>=minH){
        const prom = peakProminence(y, i);
        if (prom >= minP) candidates.push({pos:x[i], height:y[i], prominence:prom, idx:i});
      }
    }
    candidates.sort((a,b)=>b.height-a.height);
    const used = new Uint8Array(y.length);
    const out = [];
    for (const c of candidates){
      if (used[c.idx]) continue;
      out.push(c);
      const lo = Math.max(0, Math.round(c.idx-minDistPts));
      const hi = Math.min(y.length-1, Math.round(c.idx+minDistPts));
      for (let j=lo; j<=hi; j++) used[j]=1;
    }
    out.sort((a,b)=>a.pos-b.pos);
    return out;
  }

  // Nearest data-grid index for a 2θ position on the given axis
  function nearestIdx(x, pos){
    if (!x || !x.length) return 0;
    const span = (x[x.length-1]-x[0]) || 1;
    const t = (pos-x[0])/span*(x.length-1);
    return Math.max(0, Math.min(x.length-1, Math.round(t)));
  }


  // Refine to the local maximum within ±win points
  function refineIdx(y, idx, win){
    let best = idx;
    const lo = Math.max(0, idx-win), hi = Math.min(y.length-1, idx+win);
    for (let j=lo; j<=hi; j++) if (y[j] > y[best]) best = j;
    return best;
  }

  // FWHM (in degrees 2θ) by half-maximum interpolation around a peak
  function computeFWHM(x, y, idx0){
    const idx = refineIdx(y, idx0, 3);
    const half = y[idx] / 2;
    if (!(half > 0)) return NaN;
    let l = idx; while (l > 0 && y[l] > half) l--;
    if (y[l] > half) return NaN; // no left crossing in range
    const xl = (y[l+1]===y[l]) ? x[l] : x[l] + (half-y[l])/(y[l+1]-y[l])*(x[l+1]-x[l]);
    let r = idx; while (r < y.length-1 && y[r] > half) r++;
    if (y[r] > half) return NaN; // no right crossing
    const xr = (y[r]===y[r-1]) ? x[r] : x[r-1] + (half-y[r-1])/(y[r]-y[r-1])*(x[r]-x[r-1]);
    return Math.abs(xr - xl);
  }

  /* ---------- True Kα1/Kα2 doublet deconvolution (pseudo-Voigt profile fit) ---------- */
  // pseudo-Voigt: η·Lorentzian + (1-η)·Gaussian, both with the same FWHM
  function pseudoVoigt(xi, x0, fwhm, eta){
    const t = (xi-x0)*(xi-x0) / (fwhm*fwhm);
    const g = Math.exp(-4*Math.LN2*t);
    const l = 1 / (1 + 4*t);
    return eta*l + (1-eta)*g;
  }
  // Kα1/Kα2 separation Δ(2θ) in degrees at a given 2θ position
  function ka2Delta(twoTheta){
    const th = (twoTheta/2)*Math.PI/180;
    return 2*((CU_KA2-CU_KA1)/CU_KA1)*Math.tan(th)*180/Math.PI;
  }
  // params = [A, x0, fwhm, eta, bg]; doublet = A·(pV(Kα1) + ½·pV(Kα2)) + bg
  function doubletModel(par, xi){
    const A=par[0], x0=par[1], fw=par[2], eta=par[3], bg=par[4]||0, d=ka2Delta(x0);
    return A*(pseudoVoigt(xi,x0,fw,eta) + KA2_RATIO*pseudoVoigt(xi,x0+d,fw,eta)) + bg;
  }
  // Solve A·z = b (square, small) by Gaussian elimination with partial pivot
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
  // One Levenberg–Marquardt run from a given start; returns {p, cost}
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
  // Fit the doublet over a local window with a multi-start over η; returns peak params
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

  /* ---------- Global whole-pattern fit: Σ Voigt doublets + polynomial background ---------- */
  // Humlíček w4 complex error function w(x+iy), y>=0  → returns [Re, Im]
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
  // Voigt shape (area·const absorbed into amplitude) value at xi; centre x0, Gaussian σ, Lorentzian γ
  function voigtVal(xi, x0, sigma, gamma){
    const a = sigma*Math.SQRT2; const u=(xi-x0)/a, v=gamma/a;
    return cef(u, v)[0];
  }
  // Voigt value + analytic derivatives wrt (x0, sigma, gamma) via w'(z) = -2z·w + 2i/√π
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
  // FWHM (°2θ) of a Voigt from σ,γ — Olivero & Longbothum approximation
  function voigtFWHM(sigma, gamma){
    const fG = 2*sigma*Math.sqrt(2*Math.LN2), fL = 2*gamma;
    return 0.5346*fL + Math.sqrt(0.2166*fL*fL + fG*fG);
  }
  // pseudo-Voigt value + derivatives (used only by the local fallback fit)
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
  // Base symmetric shape value + derivatives, normalised to {val,dx0,d2,d3}
  // (d2 = ∂/∂(first width); d3 = ∂/∂(second param: γ for Voigt, η for pV))
  function baseGrad(profile, xi, c, p2, p3){
    if (profile==='voigt'){ const g=voigtGrad(xi,c,p2,p3); return {val:g.val,dx0:g.dx0,d2:g.dsig,d3:g.dgam}; }
    const g=pvGrad(xi,c,p2,p3); return {val:g.val,dx0:g.dx0,d2:g.dw,d3:g.deta};
  }
  function baseVal(profile, xi, c, p2, p3){
    return profile==='voigt' ? voigtVal(xi,c,p2,p3) : pseudoVoigt(xi,c,p2,p3);
  }
  // FCJ-type axial-divergence kernel offsets (°2θ) + weights for a peak at pos.
  // ε drawn from the convolution of the sample (S/L) and slit (H/L) extents (trapezoid),
  // mapped to apparent angle by cos(2θ')=cos(2θ)/cos²ε (FCJ); folds direction around 90°.
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
  // One doublet-component value+grad at centre c, with optional asymmetry. asym={on,mode,SL,HL,nq}
  // returns {val, dc, d2, d3, da}
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
  // Value-only version (for reconstruction) using a stored fit object fp
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

  // Least-squares polynomial (powers of normalised u) fit of yv(x) — for background init
  function polyfitPow(xs, yv, xc, xh, deg){
    const nb=deg+1, A=Array.from({length:nb},()=>new Array(nb).fill(0)), b=new Array(nb).fill(0);
    for (let i=0;i<xs.length;i++){
      const u=(xs[i]-xc)/xh; const pw=new Array(nb); let um=1; for(let m=0;m<nb;m++){pw[m]=um;um*=u;}
      for (let a=0;a<nb;a++){ b[a]+=pw[a]*yv[i]; for(let c=0;c<nb;c++) A[a][c]+=pw[a]*pw[c]; }
    }
    return solveLinear(A,b) || new Array(nb).fill(0);
  }
  // active: [{A0,x0,w0}]; fit raw y with Voigt/pseudo-Voigt doublets (optional asymmetry)
  // + poly background. params per peak = [A, x0, p2, p3] (+ a when split asymmetry).
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

  // Multi-start wrapper: tries several starting configs and returns the lowest-cost result.
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

  function reprocessOne(i){
    const p = getFileParams(i);
    const x = files[i].x;
    const yraw       = files[i].y;
    const smoothed   = movingAverage(yraw, p.N);                       // display + detection
    const snip       = computeBaseline(smoothed, p.blWin);             // SNIP baseline (estimate/fallback/standard)
    const detSub     = smoothed.map((v,j)=>Math.max(0, v-snip[j]));    // for peak search + classic FWHM
    // Peak detection on the smoothed, SNIP-subtracted profile (robust to noise)
    const peaks      = findPeaks(x, detSub, p.pkHeight, p.pkProm, p.pkDist);
    // Re-inject manually added peaks (survive param changes, cleared on reset)
    (manualPeaks[i]||[]).forEach(pos=>{
      const idx = nearestIdx(x, pos);
      peaks.push({pos, height:detSub[idx], prominence:peakProminence(detSub, idx), idx, manual:true});
    });
    peaks.sort((a,b)=>a.pos-b.pos);
    // detPos = detected position (stable identity, independent of fit on/off)
    peaks.forEach(pk=>{ pk.detPos = pk.pos; });
    // Apply persistent removals (matched by detected position, with a small tolerance)
    const rem = removedPeaks[i] || [];
    const remTol = Math.min(0.1, (p.pkDist || 0.3) * 0.45);
    peaks.forEach(pk=>{ pk.removed = rem.some(v=>Math.abs(v-pk.detPos) < remTol); });

    // Classic analysis only (SNIP baseline, half-maximum FWHM). The Voigt/pV global
    // fit is applied on top, on demand, by runFit() when the Fit button is pressed.
    peaks.forEach(pk=>{
      if (pk.removed){ pk.fit=null; pk.fwhm=NaN; pk.fwhmClassic=NaN; pk.fwhmFit=undefined; pk.fitPos=undefined; return; }
      pk.fit=null; pk.fwhmClassic=computeFWHM(x, detSub, pk.idx); pk.fwhmFit=undefined; pk.fwhm=pk.fwhmClassic; pk.fitPos=undefined;
    });
    const subtracted = detSub;
    const rawSub     = yraw.map((v,j)=>v-snip[j]);
    processed[i]     = {smoothed, baseline:snip, snip, subtracted, rawSub, peaks};
  }

  // Instrumental FWHM (deg) at a given 2θ, linearly interpolated from the
  // selected standard's measured peaks (0 when no standard is set)
  function instrBeta(twoTheta){
    if (!standardName) return 0;
    const si = files.findIndex(f=>f.name===standardName);
    if (si < 0 || !processed[si]) return 0;
    const pts = processed[si].peaks
      .filter(p=>!p.removed && isFinite(p.fwhm))
      .map(p=>({x:p.pos, b:p.fwhm}))
      .sort((a,b)=>a.x-b.x);
    if (!pts.length) return 0;
    if (twoTheta <= pts[0].x) return pts[0].b;
    if (twoTheta >= pts[pts.length-1].x) return pts[pts.length-1].b;
    for (let k=0; k<pts.length-1; k++){
      if (twoTheta >= pts[k].x && twoTheta <= pts[k+1].x){
        const t = (twoTheta-pts[k].x)/(pts[k+1].x-pts[k].x);
        return pts[k].b + (pts[k+1].b-pts[k].b)*t;
      }
    }
    return pts[pts.length-1].b;
  }

  // Scherrer size (nm) from a FWHM (deg) at 2θ pos, with editable K and λ (Å)
  function scherrerD(betaDeg, pos, K, lam){
    if (!isFinite(betaDeg) || betaDeg <= 0) return NaN;
    const bRad = betaDeg * Math.PI/180, thRad = (pos/2) * Math.PI/180;
    return (K * lam / (bRad * Math.cos(thRad))) / 10; // nm (λ in Å → /10)
  }
  // Size WITHOUT instrumental correction (raw β)
  function sizeRaw(betaDeg, pos, K, lam){ return scherrerD(betaDeg, pos, K, lam); }
  // Size WITH instrumental correction: β² = β_obs² − β_instr²
  function sizeCorr(betaDeg, pos, K, lam){
    if (!isFinite(betaDeg) || betaDeg <= 0) return NaN;
    const bInstr = instrBeta(pos);
    return scherrerD(Math.sqrt(Math.max(0, betaDeg*betaDeg - bInstr*bInstr)), pos, K, lam);
  }

  function reprocessAll(){
    processed = [];
    for (let i=0; i<files.length; i++) reprocessOne(i);
  }

  let anaPlot = null;
  let fitPlot = null;   // fitting-tab main plot
  let residPlot = null; // short plot of fit − signal residual (in the fitting card)

  // Reconstruct the full doublet model and the Kα1-only component over an axis,
  // from a plain list of fit objects (fp).
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

  // ---- ANALYSIS plot: raw, smoothed, SNIP baseline, peaks (no fit) ----
  function updateXrdAnalysis(preserveView){
    if (!files.length || !processed.length) return;
    if (curIdx >= files.length) curIdx = files.length-1;
    document.getElementById('xrdCurrentLabel').textContent = files[curIdx].label;
    document.getElementById('xrdIdx').textContent = (curIdx+1)+'/'+files.length;

    const prev = (preserveView && anaPlot) ? {xmin:anaPlot.xmin, xmax:anaPlot.xmax, ymin:anaPlot.ymin, ymax:anaPlot.ymax} : null;
    const f  = files[curIdx];
    const pr = processed[curIdx];
    const mx = maxArr(pr.smoothed) || 1;

    const ndense = Math.min(20000, Math.max(4000, f.x.length*10));
    const dense  = linspace(f.x[0], f.x[f.x.length-1], ndense);
    const baseD  = interpLinear(f.x, pr.baseline, dense);

    const svgEl = document.getElementById('xrdSvg');
    const plot  = new Plot(svgEl, {xlabel:'2θ (°)', ylabel:'Intensity (a.u.)', noYTickLabels:true});
    plot.attachTools(svgEl.closest('.plot-wrap'));
    plot.setRange(minArr(f.x), maxArr(f.x), 0, 1.1);
    if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
    plot.drawAxes();
    plot.line(f.x, f.y.map(v=>v/mx),         '#6a7585', 1);
    plot.line(f.x, pr.smoothed.map(v=>v/mx), '#3aa0ff', 1.4);
    plot.line(dense, baseD.map(v=>v/mx),     '#ff9933', 1.2);
    const drawnPos = [];
    for (const pk of pr.peaks){
      if (pk.removed) continue;
      if (drawnPos.some(v=>Math.abs(v-pk.pos)<1e-9)) continue;
      drawnPos.push(pk.pos);
      plot.vline(pk.pos, PEAK_BASE, false);
    }
    anaPlot = plot;
    plot._onView = ()=> applySelectionHighlight();
    applySelectionHighlight();
  }

  // ---- FITTING plot: raw as open circles + peaks; with a saved fit → baseline,
  // Kα components and residual. Independent of the Analysis live view. ----
  function updateXrdFitting(preserveView){
    if (!files.length || !processed.length) return;
    if (curIdx >= files.length) curIdx = files.length-1;
    document.getElementById('xrdFitLabel').textContent = files[curIdx].label;
    document.getElementById('xrdFitIdx').textContent = (curIdx+1)+'/'+files.length;
    updateStdButtons();

    const prev = (preserveView && fitPlot) ? {xmin:fitPlot.xmin, xmax:fitPlot.xmax, ymin:fitPlot.ymin, ymax:fitPlot.ymax} : null;
    const f  = files[curIdx];
    const pr = processed[curIdx];
    const mx = maxArr(pr.smoothed) || 1;
    const sf = savedFits[curIdx];
    const doFit = !!(sf && sf.fits && sf.fits.length);

    const svgEl = document.getElementById('xrdFitSvg');
    const plot  = new Plot(svgEl, {xlabel:'2θ (°)', ylabel:'Intensity (a.u.)', noYTickLabels:true});
    plot.attachTools(svgEl.closest('.plot-wrap'));
    plot.setRange(minArr(f.x), maxArr(f.x), 0, 1.1);
    if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
    plot.drawAxes();
    // Raw data as unconnected open circles
    plot.points(f.x, f.y.map(v=>v/mx), '#6a7585', 1.7);
    if (doFit){
      const ndense = Math.min(20000, Math.max(4000, f.x.length*10));
      const dense  = linspace(f.x[0], f.x[f.x.length-1], ndense);
      const baseD  = interpLinear(f.x, sf.baseline, dense);
      const recD = reconstructFit(dense, sf.fits);
      plot.line(dense, baseD.map(v=>v/mx),                                 '#ff9933', 1.2);
      plot.line(dense, recD.full.map((v,j)=>(v+baseD[j])/mx),              '#ff5050', 1);
      plot.line(dense, recD.ka1.map((v,j)=>(v+baseD[j])/mx),               '#b07cff', 1.4);
      plot.line(dense, recD.full.map((v,j)=>(v-recD.ka1[j]+baseD[j])/mx),  '#5fb0d0', 1.1);
    }
    // Peak markers: fitted positions once a fit exists, otherwise the inherited
    // Analysis peak-search positions (initial state).
    const markPos = doFit ? sf.fits.map(fp=>fp.pos) : pr.peaks.filter(pk=>!pk.removed).map(pk=>pk.pos);
    const drawnPos = [];
    for (const pos of markPos){
      if (drawnPos.some(v=>Math.abs(v-pos)<1e-9)) continue;
      drawnPos.push(pos);
      plot.vline(pos, PEAK_BASE, false);
    }
    fitPlot = plot;
    plot._onView = ()=>{ if (residPlot){ residPlot.xmin=plot.xmin; residPlot.xmax=plot.xmax; residPlot._refresh(); } applySelectionHighlight(); };
    applySelectionHighlight();

    ['xrdLegBl','xrdLegFit','xrdLegKa1','xrdLegKa2'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display=doFit?'':'none'; });
    const residBlock = document.getElementById('xrdResidBlock');
    if (residBlock) residBlock.style.display = doFit ? '' : 'none';
    if (!doFit){ residPlot = null; return; }

    const recX = reconstructFit(f.x, sf.fits);
    let rwpN=0, rwpD=0;
    for (let j=0;j<f.x.length;j++){
      const w = 1/Math.max(f.y[j], 1);
      const d = f.y[j] - (recX.full[j] + sf.baseline[j]);
      rwpN += w*d*d; rwpD += w*f.y[j]*f.y[j];
    }
    const rwp = rwpD>0 ? Math.sqrt(rwpN/rwpD)*100 : NaN;
    sf.rwp = rwp;
    const capEl = document.getElementById('xrdResidCaption');
    if (capEl) capEl.textContent = 'Fit residual (doublet fit − signal)' + (isFinite(rwp) ? ` — Rwp = ${rwp.toFixed(1)}%` : '');

    const resid = recX.full.map((v,j)=>(v - (f.y[j]-sf.baseline[j]))/mx);
    let rmax = 0; for (const v of resid) rmax = Math.max(rmax, Math.abs(v));
    rmax = rmax>0 ? rmax*1.1 : 1;
    const rp = new Plot(document.getElementById('xrdResidSvg'), {xlabel:'2θ (°)', ylabel:'', noYTickLabels:true, noInteraction:true, margin:{l:55,r:20,t:8,b:30}});
    rp.setRange(minArr(f.x), maxArr(f.x), -rmax, rmax);
    rp.xmin = plot.xmin; rp.xmax = plot.xmax;
    rp.drawAxes();
    rp.line([f.x[0], f.x[f.x.length-1]], [0,0], '#5b6472', 1);
    rp.line(f.x, resid, '#ff5050', 1);
    residPlot = rp;
  }

  // Enable the standard-fit buttons only when the current sample is the chosen standard
  function updateStdButtons(){
    const isStd = files.length && files[curIdx] && files[curIdx].name===standardName;
    ['xrdFitStdBtn','xrdStdSettings'].forEach(id=>{ const b=document.getElementById(id); if(b){ b.disabled=!isStd; b.style.opacity=isStd?'':'0.5'; b.style.cursor=isStd?'':'not-allowed'; } });
  }

  const nearestLine = (lines, pos)=>{ let best=null,bd=Infinity; if(pos!=null) for(const el of lines){ const d=Math.abs(el._value-pos); if(d<bd){bd=d;best=el;} } return bd<0.6?best:null; };

  // Recolour one panel's plot vlines from its own selection/hover state.
  function highlightPanel(key){
    const P = panels[key], plot = P.plot(); if (!plot) return;
    const lines = [...plot.gOverlay.querySelectorAll('line')].filter(el=>el._value!==undefined);
    const selEl = nearestLine(lines, P.sel);
    const hovEl = nearestLine(lines, P.hov);
    lines.forEach(el=>{
      if (el===selEl){ el.setAttribute('stroke',PEAK_SEL); el.setAttribute('stroke-width',1.8); }
      else if (el===hovEl){ el.setAttribute('stroke',PEAK_HOVER); el.setAttribute('stroke-width',1.8); }
      else { el.setAttribute('stroke',PEAK_BASE); el.setAttribute('stroke-width',1); }
    });
  }
  // Refresh both plots' highlights (used after a full redraw)
  function applySelectionHighlight(){ highlightPanel('a'); highlightPanel('f'); }

  // Toggle the transient 'hovering' class on the row nearest that panel's hover pos.
  function updateRowHoverPanel(key){
    const P = panels[key], wrap = document.getElementById(P.wrap); if (!wrap) return;
    const rows = [...wrap.querySelectorAll('.peak-row')];
    let best=null, bd=Infinity;
    if (P.hov!=null) for (const r of rows){ const d=Math.abs(parseFloat(r.dataset.pos)-P.hov); if(d<bd){bd=d;best=r;} }
    rows.forEach(r=>r.classList.toggle('hovering', r===best && bd<0.6));
  }

  // Transient hover for a panel (peak + associated row), distinct from selection.
  function setHoverPanel(key, pos){
    const P = panels[key];
    if (pos===P.hov) return;
    P.hov = pos;
    highlightPanel(key);
    updateRowHoverPanel(key);
  }
  // Permanent selection toggle for a panel.
  function selectPanel(key, pos){
    const P = panels[key];
    P.sel = (P.sel!=null && Math.abs(pos-P.sel)<1e-9) ? null : pos;
    renderPeakTable(); applySelectionHighlight();
  }

  // Stacked, baseline-subtracted overview. `curves[k]` holds each sample's raw
  // (un-offset) trace on its own x axis; null entries (e.g. no fit) are skipped.
  function drawStackedResults(svgId, legendId, curves){
    const norm = document.getElementById('xrdNorm').value;
    const n = files.length, baseOf = k => -k * 1.1;
    let Y = curves.map(c=>c ? c.slice() : null);
    if (norm === 'local'){
      Y = Y.map((y,k)=> y ? y.map(v=>v/(maxArr(y)||1)+baseOf(k)+0.05) : null);
    } else {
      const gmax = Math.max(1, ...Y.filter(Boolean).map(maxArr));
      Y = Y.map((y,k)=> y ? y.map(v=>v/gmax+baseOf(k)+0.05) : null);
    }
    const plot = new Plot(document.getElementById(svgId), {xlabel:'2θ (°)', ylabel:'Intensity (a.u.)', noYTickLabels:true});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    const legend = document.getElementById(legendId); legend.innerHTML='';
    const [ux0, ux1] = unionRange();
    plot.setRange(ux0, ux1, baseOf(n-1), baseOf(0)+1.1);
    plot.drawAxes();
    Y.forEach((y,k)=>{
      if (!y) return;
      plot.line(files[k].x, y, files[k].color, 1.3);
      const s=document.createElement('span');
      s.innerHTML=`<i style="background:${files[k].color}"></i>${files[k].label}`;
      legend.appendChild(s);
    });
    return plot;
  }

  function updateXrdResults(){
    if (!files.length || !processed.length) return;
    // Analysis: smoothed − SNIP baseline
    resPlot = drawStackedResults('xrdResSvg', 'xrdResLegend', processed.map(pr=>pr.subtracted));
    // Fitting: reconstructed Kα doublet above the fit baseline (samples with a fit)
    const fitCurves = files.map((f,k)=>{
      const sf = savedFits[k];
      if (!sf || !sf.fits || !sf.fits.length) return null;
      return reconstructFit(f.x, sf.fits).full;
    });
    drawStackedResults('xrdResFitSvg', 'xrdResFitLegend', fitCurves);
    renderPeakTable();
  }

  function renderPeakTable(){ renderAnalysisTable(); renderFitTable(); }

  // Classic (peak-search) table: 2θ, rel intensity, prominence, classic FWHM, size.
  // With a standard selected, size is shown both without and with correction.
  function renderAnalysisTable(){
    if (!files.length || !processed.length) return;
    const isStd = files[curIdx].name === standardName;
    const fp = getFileParams(curIdx);
    document.getElementById('xrdPkLabel').textContent = files[curIdx].label + (isStd ? ' (standard)' : '');
    const allPks = processed[curIdx] ? processed[curIdx].peaks : [];
    const wrap = document.getElementById('xrdPeakTableWrap');
    const resetBtn = document.getElementById('xrdPkReset');
    const hasManual = (manualPeaks[curIdx]||[]).length > 0;
    const hasRemoved = (removedPeaks[curIdx]||[]).length > 0;
    resetBtn.style.display = (hasRemoved || hasManual) ? '' : 'none';

    const pks = allPks.filter(p=>!p.removed);
    if (!pks.length){ wrap.innerHTML='<p style="color:var(--muted);margin:6px 0">No peaks found with current parameters.</p>'; return; }
    const maxH = Math.max(...pks.map(p=>p.height));
    const showCorr = !!standardName && !isStd;
    let html='<table><thead><tr><th>#</th><th>2θ (°)</th><th>Rel. intensity</th><th>FWHM (°)</th><th>Size (nm)</th>'+(showCorr?'<th>Size corr. (nm)</th>':'')+'<th></th></tr></thead><tbody>';
    pks.forEach((pk,i)=>{
      const fwhm = pk.fwhmClassic;
      const sizeRawCell = isStd ? '—' : fmtCell(sizeRaw(fwhm, pk.detPos, fp.K, fp.lambda));
      const corrCell = showCorr ? `<td>${fmtCell(sizeCorr(fwhm, pk.detPos, fp.K, fp.lambda))}</td>` : '';
      const sel = panels.a.sel!=null && Math.abs(pk.pos-panels.a.sel)<1e-9 ? ' selected' : '';
      html+=`<tr class="peak-row${pk.manual?' manual-peak':''}${sel}" data-pos="${pk.pos}" data-det="${pk.detPos}"><td>${i+1}</td><td>${pk.pos.toFixed(3)}</td><td>${(pk.height/maxH*100).toFixed(1)}%</td><td>${isFinite(fwhm)?fwhm.toFixed(3):'—'}</td><td>${sizeRawCell}</td>${corrCell}<td style="text-align:right"><button class="peak-del" data-det="${pk.detPos}" title="Remove peak">✕</button></td></tr>`;
    });
    html+='</tbody></table>';
    wrap.innerHTML=html;

    wrap.querySelectorAll('.peak-row').forEach(row=>{
      const pos = parseFloat(row.dataset.pos);
      row.addEventListener('mouseenter', ()=> setHoverPanel('a', pos));
      row.addEventListener('mouseleave', ()=> setHoverPanel('a', null));
      row.addEventListener('click', e=>{
        if (e.target.closest('.peak-del')) return;
        selectPanel('a', pos);
      });
    });
    wrap.querySelectorAll('.peak-del').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const det = parseFloat(btn.dataset.det);
        if (!removedPeaks[curIdx]) removedPeaks[curIdx] = [];
        if (!removedPeaks[curIdx].some(v=>Math.abs(v-det)<1e-6)) removedPeaks[curIdx].push(det);
        reprocessOne(curIdx); updateXrdAnalysis(true); updateXrdFitting(true); renderPeakTable();
      });
    });
  }

  // Fitted table (fitting card): everything derived from the last fit's peaks.
  function renderFitTable(){
    if (!files.length) return;
    const wrap = document.getElementById('xrdFitTableWrap');
    if (!wrap) return;
    const isStd = files[curIdx].name === standardName;
    const fp = getFileParams(curIdx);
    document.getElementById('xrdFitPkLabel').textContent = files[curIdx].label + (isStd ? ' (standard)' : '');
    const sf = savedFits[curIdx];
    if (!sf || !sf.fits || !sf.fits.length){ wrap.innerHTML='<p style="color:var(--muted);margin:6px 0">No fit yet — press Fit sample.</p>'; return; }
    const f = files[curIdx];
    // Reconstruct the fitted model on the native axis to get heights/prominences
    const rec = reconstructFit(f.x, sf.fits);
    const fits = sf.fits.map(fpk=>{
      // Snap to the actual crest near the fitted position: nearestIdx often lands one
      // grid point off the true maximum, which makes the uphill neighbour exceed it and
      // yields a spurious prominence of 0.
      let idx = nearestIdx(f.x, fpk.pos);
      const win = Math.max(2, Math.round((fpk.fwhm||0.2) / ((f.x[f.x.length-1]-f.x[0])/(f.x.length-1)) ));
      for (let s=-win; s<=win; s++){ const j=idx+s; if (j>=0 && j<rec.full.length && rec.full[j] > rec.full[idx]) idx=j; }
      return { pos:fpk.pos, fwhm:fpk.fwhm, idx, height:rec.full[idx] };
    }).sort((a,b)=>a.pos-b.pos);
    const maxH = Math.max(...fits.map(p=>p.height)) || 1;
    const showCorr = !!standardName && !isStd;
    // Which fitted row is closest to the current selection (for highlight parity with analysis)
    let selIdx=-1, selBd=Infinity;
    if (panels.f.sel!=null) fits.forEach((pk,i)=>{ const d=Math.abs(pk.pos-panels.f.sel); if(d<selBd){selBd=d;selIdx=i;} });
    if (selBd>=0.6) selIdx=-1;
    let html='<table><thead><tr><th>#</th><th>2θ (°)</th><th>Rel. intensity</th><th>FWHM (°)</th><th>Size (nm)</th>'+(showCorr?'<th>Size corr. (nm)</th>':'')+'</tr></thead><tbody>';
    fits.forEach((pk,i)=>{
      const sizeRawCell = isStd ? '—' : fmtCell(sizeRaw(pk.fwhm, pk.pos, fp.K, fp.lambda));
      const corrCell = showCorr ? `<td>${fmtCell(sizeCorr(pk.fwhm, pk.pos, fp.K, fp.lambda))}</td>` : '';
      html+=`<tr class="peak-row${i===selIdx?' selected':''}" data-pos="${pk.pos}"><td>${i+1}</td><td>${pk.pos.toFixed(3)}</td><td>${(pk.height/maxH*100).toFixed(1)}%</td><td>${isFinite(pk.fwhm)?pk.fwhm.toFixed(3):'—'}</td><td>${sizeRawCell}</td>${corrCell}</tr>`;
    });
    html+='</tbody></table>';
    if (isFinite(sf.rwp)) html+=`<p style="color:var(--muted);font-size:11px;margin:4px 0 0">Rwp = ${sf.rwp.toFixed(1)}%</p>`;
    wrap.innerHTML=html;
    // Same click-to-select mechanic as the analysis table (no delete here)
    wrap.querySelectorAll('.peak-row').forEach(row=>{
      const pos = parseFloat(row.dataset.pos);
      row.addEventListener('mouseenter', ()=> setHoverPanel('f', pos));
      row.addEventListener('mouseleave', ()=> setHoverPanel('f', null));
      row.addEventListener('click', ()=> selectPanel('f', pos));
    });
  }
  const fmtCell = v => isFinite(v) ? v.toFixed(1) : '—';

  // Per-field shared/per-sample toggles (one segmented control per editable field)
  const TOGGLE_FIELD = { xrdModeN:'N', xrdModeBl:'blWin', xrdModeH:'pkHeight', xrdModeP:'pkProm', xrdModeD:'pkDist', xrdModeK:'K', xrdModeL:'lambda' };
  Object.entries(TOGGLE_FIELD).forEach(([tid, key])=>{
    document.querySelectorAll('#'+tid+' button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#'+tid+' button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        paramMode[key] = btn.dataset.m;
        // Seed a per-sample override from the current shared value so switching to
        // 'per' doesn't lose the displayed number
        if (btn.dataset.m==='per'){ if(!perParams[curIdx]) perParams[curIdx]={}; if(perParams[curIdx][key]===undefined) perParams[curIdx][key]=shared[key]; }
        writeStoreToInputs();
      });
    });
  });

  // Param change listeners — store then reprocess
  ['xrdNorm'].forEach(id=>{
    document.getElementById(id).addEventListener('input', ()=>{
      if (files.length){ updateXrdResults(); }
    });
  });
  // Fit hyperparameters modal
  const numOr = (id, def)=>{ const v=parseFloat(String(document.getElementById(id).value).replace(',','.')); return isFinite(v)?v:def; };
  document.getElementById('xrdFitSettings').onclick = ()=>{ document.getElementById('xrdHpFromCurrent').checked = !!fitHP.fromCurrent; document.getElementById('xrdHpBgAnchor').value = fitHP.bgAnchor; document.getElementById('xrdFitModal').style.display='flex'; syncAsymUI(); };
  document.getElementById('xrdHpClose').onclick    = ()=>{ document.getElementById('xrdFitModal').style.display='none'; };
  // Standard fit settings modal
  document.getElementById('xrdStdSettings').onclick = ()=>{
    document.getElementById('xrdStdProfile').value = stdHP.profile;
    document.getElementById('xrdStdG').value = (0.5*(stdHP.SL+stdHP.HL)).toFixed(4);
    document.getElementById('xrdStdBgAnchor').value = stdHP.bgAnchor;
    document.getElementById('xrdStdFromCurrent').checked = !!stdHP.fromCurrent;
    document.getElementById('xrdStdModal').style.display='flex';
  };
  document.getElementById('xrdStdClose').onclick = ()=>{ document.getElementById('xrdStdModal').style.display='none'; };
  document.getElementById('xrdStdApply').onclick = ()=>{
    stdHP.profile  = document.getElementById('xrdStdProfile').value;
    stdHP.bgDegree = Math.max(0, Math.min(12, Math.round(numOr('xrdStdDeg',4))));
    stdHP.maxIter  = Math.max(5, Math.min(2000, Math.round(numOr('xrdStdIter',60))));
    stdHP.tol      = Math.max(1e-12, numOr('xrdStdTol',1e-12));
    stdHP.lambda0  = Math.max(1e-12, numOr('xrdStdLambda',1e-3));
    stdHP.bgAnchor = Math.max(0, numOr('xrdStdBgAnchor',0.3));
    stdHP.fromCurrent = document.getElementById('xrdStdFromCurrent').checked;
    document.getElementById('xrdStdModal').style.display='none';
  };
  document.getElementById('xrdFitModal').addEventListener('click', e=>{ if (e.target.id==='xrdFitModal') e.currentTarget.style.display='none'; });
  // Asymmetry model options are always visible; the checkbox just enables them,
  // and the FCJ geometry fields show only for the FCJ model
  const syncAsymUI = ()=>{
    const on = document.getElementById('xrdHpAsym').checked;
    document.getElementById('xrdHpAsymOpts').style.opacity = on ? '1' : '0.45';
    document.getElementById('xrdHpAsymMode').disabled = !on;
    document.getElementById('xrdHpFcj').style.display = (document.getElementById('xrdHpAsymMode').value==='fcj') ? '' : 'none';
  };
  document.getElementById('xrdHpAsym').addEventListener('change', syncAsymUI);
  document.getElementById('xrdHpAsymMode').addEventListener('change', syncAsymUI);
  document.getElementById('xrdHpApply').onclick = ()=>{
    fitHP.profile  = document.getElementById('xrdHpProfile').value;
    fitHP.asym     = document.getElementById('xrdHpAsym').checked;
    fitHP.asymMode = document.getElementById('xrdHpAsymMode').value;
    fitHP.SL       = Math.max(0, numOr('xrdHpSL',0.02));
    fitHP.HL       = Math.max(0, numOr('xrdHpHL',0.02));
    fitHP.calib    = false; // calibration is done via the dedicated standard fit
    fitHP.bgDegree = Math.max(0, Math.min(12, Math.round(numOr('xrdHpDeg',4))));
    fitHP.maxIter  = Math.max(5, Math.min(2000, Math.round(numOr('xrdHpIter',80))));
    fitHP.tol      = Math.max(1e-12, numOr('xrdHpTol',1e-12));
    fitHP.lambda0  = Math.max(1e-12, numOr('xrdHpLambda',1e-3));
    fitHP.bgAnchor = Math.max(0, numOr('xrdHpBgAnchor',0.3));
    fitHP.fromCurrent = document.getElementById('xrdHpFromCurrent').checked;
    document.getElementById('xrdFitModal').style.display='none';
    // Settings are only saved; the fit runs when the Fit button is pressed.
  };

  /* ---------- Fit button + progress bar ---------- */
  let fitBusy = false;
  function showProg(frac){
    const w=document.getElementById('xrdFitProgWrap'), b=document.getElementById('xrdFitProgBar');
    if (w) w.style.display=''; if (b) b.style.width=Math.max(0,Math.min(1,frac))*100+'%';
  }
  function hideProg(){ const w=document.getElementById('xrdFitProgWrap'), b=document.getElementById('xrdFitProgBar'); if(w)w.style.display='none'; if(b)b.style.width='0%'; }

  // Fit one file index with the given hyperparameters; returns the calib G if any.
  async function fitOneFile(i, hp, onProgress){
    const x=files[i].x, y=files[i].y, pr=processed[i];
    if (!pr) return null;
    const sf = savedFits[i];
    let init, snipSeed;
    if (hp.fromCurrent && sf && sf.fits && sf.fits.length){
      // Continue from the last fit: seed peaks from the fitted positions/widths + its baseline
      init = sf.fits.map(fp=>({A0:Math.max(1e-6, fp.amp), x0:fp.pos, w0:(isFinite(fp.fwhm)&&fp.fwhm>0)?fp.fwhm:0.2}));
      snipSeed = sf.baseline;
    } else {
      // Default: restart from the SNIP baseline and the current peak search (manual kept)
      const active = pr.peaks.filter(pk=>!pk.removed);
      if (!active.length) return null;
      init = active.map(pk=>{ const g=computeFWHM(x, pr.subtracted, pk.idx); return {A0:Math.max(1e-6, pr.subtracted[pk.idx]||1), x0:pk.pos, w0:(isFinite(g)&&g>0)?g:0.2}; });
      snipSeed = pr.snip;
    }
    if (!init.length) return null;
    // The fit result lives only in savedFits — the Analysis pr stays SNIP-based & live.
    const res = await multiStartFit(x, y, init, snipSeed, hp, onProgress);
    if (res){
      saveFit(i, res.fits, res.baseline);
      return res.calib || null;
    }
    // fallback: per-peak local pseudo-Voigt fit on the SNIP-subtracted raw
    const rawSubSnip=y.map((v,j)=>v-snipSeed[j]);
    const fbFits=[];
    init.forEach(pk=>{ const idx=nearestIdx(x, pk.x0); const fit=fitDoublet(x, rawSubSnip, idx, pk.w0); if(fit) fbFits.push(fit); });
    if (fbFits.length) saveFit(i, fbFits, snipSeed);
    return null;
  }

  // Persist the last fit for a file (deep copy so later param changes can't mutate it)
  function saveFit(i, fits, baseline){
    savedFits[i] = { fits: fits.map(fp=>Object.assign({}, fp)), baseline: Array.from(baseline) };
  }

  // Generic driver: fit a list of file indices with hp, manage button/progress UI.
  async function runFit(indices, hp, btnId, busyLabel){
    if (fitBusy || !files.length || !indices.length) return;
    fitBusy = true;
    const btn=document.getElementById(btnId); const lbl=btn?btn.textContent:'';
    if(btn){ btn.disabled=true; btn.textContent=busyLabel||'Fitting…'; }
    showProg(0);
    try {
      const n=indices.length;
      for (let s=0; s<n; s++){
        const calib = await fitOneFile(indices[s], hp, frac=>showProg((s+frac)/n));
        // propagate a calibrated geometry to the sample hyperparameters + both modals
        if (calib){
          fitHP.SL=calib.SL; fitHP.HL=calib.HL; stdHP.SL=calib.SL; stdHP.HL=calib.HL;
          ['xrdHpSL','xrdStdG'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=calib.SL.toFixed(4); });
          const hl=document.getElementById('xrdHpHL'); if(hl) hl.value=calib.HL.toFixed(4);
        }
        showProg((s+1)/n);
      }
      showProg(1);
    } finally {
      setTimeout(hideProg, 250);
      if(btn){ btn.disabled=false; btn.textContent=lbl; }
      fitBusy=false;
      updateXrdFitting(true); updateXrdResults(); renderPeakTable();
    }
  }
  const standardIdx = ()=> files.findIndex(f=>f.name===standardName);
  document.getElementById('xrdFitSampleBtn').onclick = ()=> runFit([curIdx], fitHP, 'xrdFitSampleBtn', 'Fitting…');
  document.getElementById('xrdFitAllBtn').onclick    = ()=> runFit(files.map((_,i)=>i), fitHP, 'xrdFitAllBtn', 'Fitting…');
  document.getElementById('xrdFitStdBtn').onclick    = ()=>{
    const si=standardIdx();
    if (si<0){ alert('Select an instrumental standard first (Instrumental standard dropdown).'); return; }
    runFit([si], stdHP, 'xrdFitStdBtn', 'Calibrating…');
  };
  // Instrumental standard changes size columns + enables the standard-fit buttons
  document.getElementById('xrdStandard').addEventListener('change', e=>{
    standardName = e.target.value;
    if (files.length){ updateStdButtons(); renderPeakTable(); }
  });
  ['xrdSmooth','xrdBlWin','xrdPkHeight','xrdPkProm','xrdPkDist','xrdK','xrdLambda'].forEach(id=>{
    const el = document.getElementById(id);
    const isSizeOnly = (id==='xrdK' || id==='xrdLambda'); // K/λ don't affect processing
    const isPeakSearch = (id==='xrdPkHeight' || id==='xrdPkProm' || id==='xrdPkDist');
    const key = { xrdSmooth:'N', xrdBlWin:'blWin', xrdPkHeight:'pkHeight', xrdPkProm:'pkProm', xrdPkDist:'pkDist', xrdK:'K', xrdLambda:'lambda' }[id];
    const apply = ()=>{
      if (!files.length) return;
      readInputsToStore();
      writeStoreToInputs();
      if (isSizeOnly){ renderPeakTable(); return; } // only the Scherrer size changes
      // Peak deletions reset only when this peak-search field changes
      if (isPeakSearch){
        if (paramMode[key]==='shared') removedPeaks = removedPeaks.map(()=>[]);
        else removedPeaks[curIdx] = [];
      }
      if (paramMode[key]==='shared') reprocessAll(); else reprocessOne(curIdx);
      updateXrdAnalysis(true);      // analysis is live
      updateXrdFitting(true);       // refresh inherited peaks / initial state (keeps last fit)
      updateXrdResults();
    };
    el.addEventListener('change', apply);
    el.addEventListener('keydown', e=>{ if (e.key==='Enter') el.blur(); });
  });

  // Run fn while keeping the card the user is currently looking at fixed in the
  // viewport: if a redraw (e.g. a table with a different row count) shifts the
  // layout, compensate the scroll so the viewed content stays put.
  function withScrollAnchor(fn){
    const vh = window.innerHeight, cy = vh/2;
    const cards = ['xrdWorkspace','xrdFitCard','xrdResults'].map(id=>document.getElementById(id)).filter(el=>el && el.offsetParent!==null);
    let anchor = cards.find(c=>{ const r=c.getBoundingClientRect(); return r.top<=cy && r.bottom>=cy; })
              || cards.find(c=>{ const r=c.getBoundingClientRect(); return r.bottom>0 && r.top<vh; });
    const before = anchor ? anchor.getBoundingClientRect().top : null;
    fn();
    if (anchor && before!=null){ const d = anchor.getBoundingClientRect().top - before; if (Math.abs(d)>0.5) window.scrollBy(0, d); }
  }

  function navigate(delta){
    if (!files.length) return;
    setAddMode(false);
    panels.a.sel=panels.a.hov=panels.f.sel=panels.f.hov=null;
    curIdx = (curIdx + delta + files.length) % files.length;
    writeStoreToInputs();
    withScrollAnchor(()=>{ updateXrdAnalysis(); updateXrdFitting(); renderPeakTable(); });
  }

  document.getElementById('xrdPrev').onclick = ()=> navigate(-1);
  document.getElementById('xrdNext').onclick = ()=> navigate(1);
  document.getElementById('xrdFitPrev').onclick = ()=> navigate(-1);
  document.getElementById('xrdFitNext').onclick = ()=> navigate(1);

  // Reset peaks: drop manual + removed peaks and re-run the search for the current file
  document.getElementById('xrdPkReset').onclick = ()=>{
    if (!files.length) return;
    manualPeaks[curIdx] = [];
    removedPeaks[curIdx] = [];
    reprocessOne(curIdx);
    updateXrdAnalysis(true);
    updateXrdFitting(true);
    renderPeakTable();
  };

  /* ---------- Add-peak mode ---------- */
  let addMode = false;
  let addIdx = null; // current data-grid index of the guide
  const addBtn  = document.getElementById('xrdAddPeak');
  const xrdSvgEl = document.getElementById('xrdSvg');

  function clearAddGuide(){ xrdSvgEl.querySelectorAll('.add-guide').forEach(e=>e.remove()); }

  // Range of grid indices currently visible in the analysis plot
  function visibleIdxRange(){
    const x = files[curIdx].x;
    const a = nearestIdx(x, anaPlot.xmin), b = nearestIdx(x, anaPlot.xmax);
    return [Math.min(a,b), Math.max(a,b)];
  }

  // Draw the guide line/marker/label at the current addIdx
  function drawAddGuide(){
    clearAddGuide();
    if (!addMode || !anaPlot || !processed[curIdx] || addIdx==null) return;
    const m = anaPlot.margin; const {w,h} = anaPlot.size();
    const pr = processed[curIdx];
    const mxv = maxArr(pr.smoothed) || 1;
    const xv = files[curIdx].x[addIdx];
    const yval = pr.smoothed[addIdx] / mxv;     // value of the (blue) smoothed curve
    const px = anaPlot.px(xv), py = anaPlot.py(yval);
    anaPlot.svg.appendChild(svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'#ffd24a','stroke-width':1.5,'stroke-dasharray':'4,3','pointer-events':'none','class':'add-guide'}));
    anaPlot.svg.appendChild(svgEl('circle',{cx:px,cy:py,r:3.5,fill:'#ffd24a','pointer-events':'none','class':'add-guide'}));
    const flip = px > w - m.r - 110;
    const t = svgEl('text',{x:px+(flip?-8:8),y:m.t+14,'font-size':11,fill:'#ffd24a','text-anchor':flip?'end':'start','pointer-events':'none','class':'add-guide'});
    t.textContent = `2θ=${xv.toFixed(3)}, y=${yval.toFixed(3)}`;
    anaPlot.svg.appendChild(t);
  }

  function setAddMode(on){
    addMode = !!on;
    addBtn.classList.toggle('active', addMode);
    xrdSvgEl.style.cursor = addMode ? 'crosshair' : '';
    if (addMode && anaPlot) anaPlot.setMode(null); // disable pan/zoom while placing
    if (!addMode){ addIdx = null; clearAddGuide(); }
  }

  function confirmAdd(){
    if (addIdx==null) return;
    if (!manualPeaks[curIdx]) manualPeaks[curIdx] = [];
    manualPeaks[curIdx].push(files[curIdx].x[addIdx]);
    setAddMode(false);
    reprocessOne(curIdx);
    updateXrdAnalysis(true);
    updateXrdFitting(true);
    renderPeakTable();
  }

  addBtn.onclick = ()=>{ if (files.length) setAddMode(!addMode); };

  xrdSvgEl.addEventListener('pointermove', e=>{
    if (!addMode || !anaPlot || !processed[curIdx]) return;
    const rect = anaPlot.svg.getBoundingClientRect();
    let xv = anaPlot.invX(e.clientX - rect.left);
    xv = Math.max(anaPlot.xmin, Math.min(anaPlot.xmax, xv));
    addIdx = nearestIdx(files[curIdx].x, xv);
    drawAddGuide();
  });

  xrdSvgEl.addEventListener('pointerleave', ()=>{ if (addMode) clearAddGuide(); });

  xrdSvgEl.addEventListener('pointerdown', e=>{
    if (!addMode || !anaPlot || e.button!==0) return;
    e.preventDefault(); e.stopPropagation();
    const rect = anaPlot.svg.getBoundingClientRect();
    let xv = anaPlot.invX(e.clientX - rect.left);
    xv = Math.max(anaPlot.xmin, Math.min(anaPlot.xmax, xv));
    addIdx = nearestIdx(files[curIdx].x, xv);
    confirmAdd();
  }, true); // capture: run before the Plot's own pointerdown handler

  document.addEventListener('keydown', e=>{
    if (!addMode) return;
    if (e.key==='Escape'){ setAddMode(false); return; }
    if (e.key==='ArrowLeft' || e.key==='ArrowRight'){
      e.preventDefault();
      const [lo,hi] = visibleIdxRange();
      if (addIdx==null) addIdx = nearestIdx((anaPlot.xmin+anaPlot.xmax)/2);
      addIdx = Math.max(lo, Math.min(hi, addIdx + (e.key==='ArrowRight'?1:-1)));
      drawAddGuide();
    } else if (e.key==='Enter'){
      e.preventDefault();
      confirmAdd();
    }
  });

  // Plot-side peak hover + click-to-select (mirror of the table interaction).
  // Bound once per SVG; acts only when no pan/zoom tool is armed and not adding a peak.
  function attachPeakInteractions(svgEl, key){
    const isAnalysis = key==='a';
    const blocked = (plot)=> !plot || plot._mode || (isAnalysis && addMode);
    const nearestVline = (plot, clientX)=>{
      const lines=[...plot.gOverlay.querySelectorAll('line')].filter(el=>el._value!==undefined);
      const cx = clientX - svgEl.getBoundingClientRect().left;
      let best=null, bd=Infinity;
      for (const el of lines){ const d=Math.abs(plot.px(el._value)-cx); if(d<bd){bd=d;best=el;} }
      return (best && bd<8) ? best._value : null;
    };
    svgEl.addEventListener('pointermove', e=>{
      const plot = svgEl._plot; if (blocked(plot)){ return; }
      setHoverPanel(key, nearestVline(plot, e.clientX));
    });
    svgEl.addEventListener('pointerleave', ()=>{ setHoverPanel(key, null); });
    svgEl.addEventListener('click', ()=>{
      const plot = svgEl._plot; if (blocked(plot)) return;
      if (panels[key].hov!=null) selectPanel(key, panels[key].hov); // clicked a peak → (de)select it
      else clearSelection(key);                                     // clicked empty area → deselect
    });
  }
  // Deselect when clicking anywhere in the table's dark container box that isn't a peak row
  function attachTableDeselect(key){
    const box = document.getElementById(panels[key].box);
    if (box) box.addEventListener('click', e=>{ if (!e.target.closest('.peak-row')) clearSelection(key); });
  }
  function clearSelection(key){ if (panels[key].sel!=null){ panels[key].sel=null; renderPeakTable(); applySelectionHighlight(); } }
  attachPeakInteractions(xrdSvgEl, 'a');
  attachPeakInteractions(document.getElementById('xrdFitSvg'), 'f');
  attachTableDeselect('a');
  attachTableDeselect('f');

  window._xrdRedraw = ()=>{ if (files.length){ updateXrdAnalysis(true); updateXrdFitting(true); updateXrdResults(); } };

  document.getElementById('xrdSave').onclick = ()=>{
    if (!files.length) return;
    const norm = document.getElementById('xrdNorm').value;
    // Main diffraction data CSV (baseline-subtracted, normalised, all samples)
    let Y = processed.map(pr=>pr.subtracted.slice());
    if (norm==='local') Y=Y.map(y=>{ const mx=maxArr(y)||1; return y.map(v=>v/mx); });
    else { const gmax=Math.max(...Y.map(maxArr))||1; Y=Y.map(y=>y.map(v=>v/gmax)); }
    // Each sample keeps its own 2θ axis → one (2Theta, intensity) column pair per sample
    const header=[]; files.forEach(f=>header.push('2Theta_'+f.label, f.label));
    let t=csvLine(header);
    const maxLen=Math.max(...files.map(f=>f.x.length));
    for (let i=0;i<maxLen;i++){
      const row=[];
      files.forEach((f,k)=>{
        if (i<f.x.length) row.push(fmtNum(f.x[i],6), fmtNum(Y[k][i],6));
        else row.push('','');
      });
      t+=csvLine(row);
    }
    downloadBlob('xrd_output.csv', t);
    const wrap=document.getElementById('xrdDownloads'); wrap.innerHTML='';
    makeDownloadLink(wrap,'xrd_output.csv',t,'xrd_output.csv');
    // Per-sample peak list CSVs (excluding peaks removed in the table)
    processed.forEach((pr,k)=>{
      const pks = pr.peaks.filter(pk=>!pk.removed);
      if (!pks.length) return;
      const isStd = files[k].name === standardName;
      const kp = getFileParams(k);
      const maxH=Math.max(...pks.map(pk=>pk.height))||1;
      let pt=csvLine(['2Theta','RelIntensity','FWHM_deg','Size_nm','Size_corr_nm']);
      pks.forEach(pk=>{
        const Draw = isStd ? NaN : sizeRaw(pk.fwhmClassic, pk.detPos, kp.K, kp.lambda);
        const Dcorr= isStd ? NaN : sizeCorr(pk.fwhmClassic, pk.detPos, kp.K, kp.lambda);
        pt+=csvLine([fmtNum(pk.pos,6),fmtNum(pk.height/maxH,6),
                     isFinite(pk.fwhmClassic)?fmtNum(pk.fwhmClassic,5):'',
                     isFinite(Draw)?fmtNum(Draw,3):'', isFinite(Dcorr)?fmtNum(Dcorr,3):'']);
      });
      const fname=files[k].label+'_peaks.csv';
      downloadBlob(fname, pt);
      makeDownloadLink(wrap, fname, pt, fname);
    });
    // Per-sample last-fit CSVs: observed + fit total and its components (bkgnd, Kα1, Kα2)
    files.forEach((f,k)=>{
      const sf = savedFits[k];
      if (!sf || !sf.fits || !sf.fits.length) return;
      const rec = reconstructFit(f.x, sf.fits); // {full, ka1} in raw intensity units
      let ft = csvLine(['2Theta','Observed','Fit_total','Background','Ka1','Ka2']);
      for (let j=0;j<f.x.length;j++){
        const bg=sf.baseline[j]||0, ka1=rec.ka1[j], ka2=rec.full[j]-rec.ka1[j];
        ft += csvLine([fmtNum(f.x[j],6), fmtNum(f.y[j],6), fmtNum(bg+rec.full[j],6),
                       fmtNum(bg,6), fmtNum(ka1,6), fmtNum(ka2,6)]);
      }
      const fn=f.label+'_fit.csv';
      downloadBlob(fn, ft);
      makeDownloadLink(wrap, fn, ft, fn);
    });
  };
})();

/* =========================================================
   EPR MODULE
========================================================= */
(function(){
  let files = []; // {name, label, b[], a[]}
  let lastY = [];
  // pending unpaired files: stem → {dta: File|null, dsc: File|null}
  let pending = {};
  let loadAlerts = '';
  let uploadAlerts = '';

  window.dismissEprInvalid = function(){ loadAlerts=''; rebuildAlerts(); };
  window.dismissEprUpload  = function(){ uploadAlerts=''; rebuildAlerts(); };

  function fileCallbacks(){
    return {
      onRemove(i){
        files.splice(i,1);
        if (!files.length) loadAlerts = '';
        rebuildAlerts();
        afterFilesChange();
      },
      onMoveUp(i){ if(i>0){[files[i-1],files[i]]=[files[i],files[i-1]]; afterFilesChange();} },
      onMoveDown(i){ if(i<files.length-1){[files[i],files[i+1]]=[files[i+1],files[i]]; afterFilesChange();} },
      onLabelChange(i, v){ files[i].label=v; updateEpr(); },
      onColorChange(i, v){ files[i].color=v; updateEpr(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ files.length=0; pending={}; loadAlerts=''; uploadAlerts=''; rebuildAlerts(); afterFilesChange(); },
    };
  }

  function rebuildAlerts(){
    document.getElementById('eprAlerts').innerHTML = loadAlerts + uploadAlerts;
    renderPendingTable();
  }

  function renderPendingTable(){
    const wrap = document.getElementById('eprPendingWrap');
    const entries = Object.entries(pending);
    if (!entries.length){ wrap.innerHTML = ''; return; }
    const phantoms = `<button style="opacity:0;pointer-events:none">↑</button><button style="opacity:0;pointer-events:none">↓</button>`;
    const rows = entries.map(([stem, pair]) => {
      const dtaCell = pair.dta ? `<span style="color:var(--good)">✓ .DTA</span>` : `<span style="color:var(--bad)">✗ .DTA</span>`;
      const dscCell = pair.dsc ? `<span style="color:var(--good)">✓ .DSC</span>` : `<span style="color:var(--bad)">✗ .DSC</span>`;
      const esc = stem.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
      return `<tr class="pending-row"><td class="fname">${stem}</td><td>${dtaCell}</td><td>${dscCell}</td><td><div class="file-actions">${phantoms}<button class="pending-del" data-stem="${esc}" onclick="eprRemovePending(this.dataset.stem)">✕</button></div></td></tr>`;
    }).join('');
    const colgroup = `<colgroup><col style="width:40%"><col style="width:20%"><col style="width:20%"><col style="width:20%"></colgroup>`;
    const header = `<tr><th>FILE</th><th>.DTA</th><th>.DSC</th><th><div class="file-actions" style="display:flex;gap:4px;align-items:center;visibility:visible;white-space:nowrap">${phantoms}<button class="pending-del-all" onclick="eprRemoveAllPending()">✕</button></div></th></tr>`;
    wrap.innerHTML = `<div style="background:#3a2c0f;border:1px solid #5a430f;border-radius:8px;padding:0 8px 8px;margin-top:10px"><div style="padding:8px 0 6px;font-size:12px;color:var(--warn)">⚠ Waiting for pair:</div><table class="pending-table" style="table-layout:fixed;width:100%">${colgroup}<thead>${header}</thead><tbody>${rows}</tbody></table></div>`;
  }

  window.eprRemovePending = function(stem){ delete pending[stem]; renderPendingTable(); };
  window.eprRemoveAllPending = function(){ for (const k of Object.keys(pending)) delete pending[k]; renderPendingTable(); };

  function parseDsc(text){
    const p = {};
    for (const line of text.split(/\r?\n/)){
      const m = line.match(/^(\w+)\s+(.*)/);
      if (m) p[m[1]] = m[2].trim();
    }
    return p;
  }

  function buildBAxis(p){
    const npts  = parseInt(p.XPTS);
    const xmin  = parseFloat(p.XMIN);  // Gauss
    const xwid  = parseFloat(p.XWID);  // Gauss
    const mwfq  = parseFloat(p.MWFQ);  // Hz
    const b = [];
    for (let i = 0; i < npts; i++)
      b.push((xmin + xwid * i / (npts - 1)) / mwfq * 9.5e8);
    return b;
  }

  async function processPair(stem, dtaFile, dscFile){
    const dscText = await dscFile.text();
    const p = parseDsc(dscText);
    const npts = parseInt(p.XPTS);
    if (!npts){ return null; }

    const bigEndian = (p.BSEQ || 'BIG') !== 'LIT';
    const dtaBuf = await dtaFile.arrayBuffer();
    const view = new DataView(dtaBuf);
    const s = [];
    for (let i = 0; i < npts; i++)
      s.push(view.getFloat64(i * 8, !bigEndian));

    const b = buildBAxis(p);

    // linear baseline correction
    const n = s.length;
    const slope = (s[n-1] - s[0]) / (b[n-1] - b[0] || 1);
    const a = s.map((v, i) => v - (s[0] + slope * (b[i] - b[0])));

    return { name: stem, label: stem, b, a };
  }

  setupDropzone('eprDropzone', 'eprFiles', async (fileList)=>{
    const existingStems = new Set(files.map(f=>f.name));
    const invalidFiles = [];
    const alreadyLoaded = [];

    for (const f of fileList){
      const ext  = f.name.split('.').pop().toLowerCase();
      const stem = f.name.replace(/\.[^.]+$/, '');
      if (ext !== 'dta' && ext !== 'dsc'){ invalidFiles.push(f.name); continue; }
      if (existingStems.has(stem)){ alreadyLoaded.push(f.name); continue; }
      if (!pending[stem]) pending[stem] = {dta: null, dsc: null};
      if (ext === 'dta') pending[stem].dta = f;
      else               pending[stem].dsc = f;
    }

    // Try to process complete pairs
    for (const [stem, pair] of Object.entries(pending)){
      if (pair.dta && pair.dsc){
        const result = await processPair(stem, pair.dta, pair.dsc);
        if (result){ result.color = nextColor(files); files.push(result); existingStems.add(stem); }
        else { invalidFiles.push(stem); }
        delete pending[stem];
      }
    }

    loadAlerts = invalidFiles.length ? buildAlertsHtml(invalidFiles, [], undefined, 'dismissEprInvalid()') : '';
    uploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'dismissEprUpload()') : '';
    rebuildAlerts();
    afterFilesChange();
  });

  function afterFilesChange(){
    renderUnifiedFileList('eprFileTableWrap', files, fileCallbacks());
    if (files.length){
      document.getElementById('eprWorkspace').style.display='block';
      document.getElementById('eprExportCard').style.display='block';
      updateEpr();
    } else {
      document.getElementById('eprWorkspace').style.display='none';
      document.getElementById('eprExportCard').style.display='none';
      rebuildAlerts();
    }
  }

  function updateEpr(){
    if (!files.length) return;
    const N = +document.getElementById('eprSmooth').value || 1;
    const norm = document.getElementById('eprNorm').value;
    let Y = files.map(f=>movingAverage(f.a, N));
    const plot = new Plot(document.getElementById('eprSvg'), {xlabel:'Magnetic Field (mT)', ylabel:'Intensity (a.u.)', noYTickLabels:true});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    const legend = document.getElementById('eprLegend'); legend.innerHTML='';
    const n = Y.length;
    const baseOf = k => (n-1-k)*1.1;
    const allB = files.flatMap(f=>f.b);
    if (norm==='local'){
      Y = Y.map((y,k)=>{ const mn=minArr(y),mx=maxArr(y); const sc=mx===mn?0:1.0/(mx-mn); return y.map(v=>(v-mn)*sc+baseOf(k)+0.05); });
    } else {
      Y = Y.map(y=>{ const m=minArr(y); return y.map(v=>v-m); });
      const gmax = Math.max(...Y.map(maxArr));
      Y = Y.map((y,k)=>{ const mid=maxArr(y)/(2*gmax); return y.map(v=>v/gmax+baseOf(k)+0.55-mid); });
    }
    plot.setRange(minArr(allB), maxArr(allB), baseOf(n-1), baseOf(0)+1.1);
    plot.drawAxes();
    Y.forEach((y,k)=>{
      plot.line(files[k].b, y, files[k].color, 1.3);
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${files[k].color}"></i>${files[k].label}`; legend.appendChild(s);
    });
    lastY = Y;
  }

  ['eprNorm','eprSmooth'].forEach(id=>{
    document.getElementById(id).addEventListener('input', ()=>{ if(files.length) updateEpr(); });
  });
  window._eprRedraw = ()=>{ if (files.length) updateEpr(); };

  document.getElementById('eprSave').onclick = ()=>{
    updateEpr();
    const Y = lastY.map(y=>{ const y0=y[0]??0; return y.map(v=>v-y0); });
    const maxLen = Math.max(...files.map(f=>f.b.length));
    let header=[];
    for (let k=0;k<files.length;k++){ header.push('Bfield_'+(k+1)); header.push(files[k].label); }
    let t = csvLine(header);
    for (let i=0;i<maxLen;i++){
      let row=[];
      for (let k=0;k<files.length;k++){
        row.push(files[k].b[i]!=null ? fmtNum(files[k].b[i],6) : '');
        row.push(Y[k][i]!=null ? fmtNum(Y[k][i],6) : '');
      }
      t += csvLine(row);
    }
    downloadBlob('epr_output.csv', t);
    const wrap = document.getElementById('eprDownloads'); wrap.innerHTML='';
    makeDownloadLink(wrap, 'epr_output.csv', t, 'epr_output.csv');
  };
})();

/* =========================================================
   GC MODULE
========================================================= */
(function(){
  let files=[]; // {name, label, injDates:[Date], h2:[number]}
  let ms=[], Qs=[], lightOnDates=[];
  let dataTables=[];
  let plot1, plot2;
  let plateauStart=0, plateauEnd=24;
  let costResults=[];
  let loadAlerts='';
  let gcUploadAlerts='';

  function rebuildGcAlerts(){ document.getElementById('gcAlerts').innerHTML = loadAlerts + gcUploadAlerts; }

  window.dismissGcInvalid = function(){ loadAlerts=''; rebuildGcAlerts(); };
  window.dismissGcUpload  = function(){ gcUploadAlerts=''; rebuildGcAlerts(); };

  function parseGCDate(str){
    const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let [_, mo, da, yr, hh, mi, se, ap] = m;
    hh = +hh; if (/pm/i.test(ap) && hh<12) hh+=12; if (/am/i.test(ap) && hh===12) hh=0;
    return new Date(+yr, +mo-1, +da, hh, +mi, +se);
  }

  function fileCallbacks(){
    return {
      onRemove(i){
        files.splice(i,1); ms.splice(i,1); Qs.splice(i,1); lightOnDates.splice(i,1);
        if (!files.length) loadAlerts = '';
        afterFilesChange();
      },
      onMoveUp(i){
        if(i>0){
          [files[i-1],files[i]]=[files[i],files[i-1]];
          [ms[i-1],ms[i]]=[ms[i],ms[i-1]];
          [Qs[i-1],Qs[i]]=[Qs[i],Qs[i-1]];
          [lightOnDates[i-1],lightOnDates[i]]=[lightOnDates[i],lightOnDates[i-1]];
          afterFilesChange();
        }
      },
      onMoveDown(i){
        if(i<files.length-1){
          [files[i],files[i+1]]=[files[i+1],files[i]];
          [ms[i],ms[i+1]]=[ms[i+1],ms[i]];
          [Qs[i],Qs[i+1]]=[Qs[i+1],Qs[i]];
          [lightOnDates[i],lightOnDates[i+1]]=[lightOnDates[i+1],lightOnDates[i]];
          afterFilesChange();
        }
      },
      onLabelChange(i, v){ files[i].label=v; computeAndRenderGc(); },
      onColorChange(i, v){ files[i].color=v; computeAndRenderGc(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ files.length=0; ms.length=0; Qs.length=0; lightOnDates.length=0; loadAlerts=''; gcUploadAlerts=''; rebuildGcAlerts(); document.getElementById('gcLightAlert').innerHTML=''; afterFilesChange(); },
    };
  }

  setupDropzone('gcDropzone', 'gcFiles', async (fileList)=>{
    const existing = new Set(files.map(f=>f.name));
    const invalidFiles=[];
    const alreadyLoaded=[];
    for (const f of fileList){
      if (existing.has(f.name)){ alreadyLoaded.push(f.name); continue; }
      existing.add(f.name);
      const text = await f.text();
      const lines = text.split(/\r?\n/).filter(l=>l.trim().length);
      if (!lines.length){ invalidFiles.push(f.name); continue; }
      const delim = lines[0].includes(';') ? ';' : (lines[0].includes(',')? ',' : '\t');
      const header = splitCSVLine(lines[0], delim);
      const idxDate = header.findIndex(h=>h.toLowerCase().includes('injection date'));
      const idxH2   = header.findIndex(h=>{ const lo=h.toLowerCase(); return lo.includes('h2') && lo.includes('%mol'); });
      if (idxDate<0 || idxH2<0){ invalidFiles.push(f.name); continue; }
      const injDates=[], h2=[];
      for (let i=1;i<lines.length;i++){
        const parts = splitCSVLine(lines[i], delim);
        const d = parseGCDate(parts[idxDate]||'');
        const v = parseFloat((parts[idxH2]||'').replace(',','.'));
        if (d && isFinite(v)){ injDates.push(d); h2.push(v); }
      }
      if (!injDates.length){ invalidFiles.push(f.name); continue; }
      const sorted = injDates.slice().sort((a,b)=>a-b);
      files.push({name:f.name, label:f.name.replace(/\.[^.]+$/,''), injDates, h2, color:nextColor(files)});
      ms.push(15); Qs.push(2);
      lightOnDates.push(new Date(sorted[0]));
    }
    loadAlerts = buildAlertsHtml(invalidFiles, [], undefined, 'dismissGcInvalid()');
    gcUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'dismissGcUpload()') : '';
    rebuildGcAlerts();
    afterFilesChange();
  });

  function toLocalInputValue(d){
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function afterFilesChange(){
    renderUnifiedFileList('gcFileTableWrap', files, fileCallbacks());
    renderGcParamTable();
    if (files.length){
      document.getElementById('gcResults').style.display='block';
      document.getElementById('gcExportCard').style.display='block';
      computeAndRenderGc();
    } else {
      document.getElementById('gcResults').style.display='none';
      document.getElementById('gcResultsBar').style.display='none';
      document.getElementById('gcExportCard').style.display='none';
      rebuildGcAlerts();
      document.getElementById('gcLightAlert').innerHTML = '';
    }
  }

  function renderGcParamTable(){
    const wrap = document.getElementById('gcParamTableWrap');
    if (!files.length){ wrap.innerHTML=''; return; }
    const cg = `<colgroup><col style="width:40%"><col style="width:10%"><col style="width:10%"><col style="width:20%"><col style="width:20%"></colgroup>`;
    let html = `<div class="table-wrap-box"><table>${cg}<thead><tr><th>Label</th><th>m (g)</th><th>Q (mL/min)</th><th>Light-on date/time</th><th></th></tr></thead><tbody>`;
    files.forEach((f,i)=>{
      html += `<tr>
        <td class="fname" title="${f.label}">${f.label}</td>
        <td><input data-i="${i}" class="gcM" type="number" min="0.001" step="0.1" value="${ms[i]}" style="width:100%"></td>
        <td><input data-i="${i}" class="gcQ" type="number" min="0.001" step="0.1" value="${Qs[i]}" style="width:100%"></td>
        <td><input data-i="${i}" class="gcDate" type="datetime-local" value="${toLocalInputValue(lightOnDates[i])}" style="width:100%"></td>
        <td></td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    wrap.innerHTML = html;
    wrap.querySelectorAll('.gcM').forEach(inp=>inp.addEventListener('input', e=>{
      const v=+e.target.value; if (v>=0.001) ms[+e.target.dataset.i]=v; computeAndRenderGc();
    }));
    wrap.querySelectorAll('.gcQ').forEach(inp=>inp.addEventListener('input', e=>{
      const v=+e.target.value; if (v>=0.001) Qs[+e.target.dataset.i]=v; computeAndRenderGc();
    }));
    wrap.querySelectorAll('.gcDate').forEach(inp=>inp.addEventListener('input', e=>{
      lightOnDates[+e.target.dataset.i]=new Date(e.target.value); computeAndRenderGc();
    }));
  }

  ['gcPlateauStart','gcPlateauEnd'].forEach(id=>{
    document.getElementById(id).addEventListener('input', ()=>{
      plateauStart = +document.getElementById('gcPlateauStart').value;
      plateauEnd   = +document.getElementById('gcPlateauEnd').value;
      if (dataTables.length) updateRegression();
    });
  });

  function computeAndRenderGc(){
    if (!files.length) return;
    plateauStart = +document.getElementById('gcPlateauStart').value;
    plateauEnd   = +document.getElementById('gcPlateauEnd').value;
    const lightOnAlertNames=[];
    dataTables = files.map((f,h)=>{
      const pairs = f.injDates.map((d,i)=>({d, v:f.h2[i]})).sort((a,b)=>a.d-b.d);
      const lightOn = lightOnDates[h];
      let idxBefore = -1;
      for (let i=0;i<pairs.length;i++) if (pairs[i].d < lightOn) idxBefore = i;
      let h2New;
      if (idxBefore<0){ lightOnAlertNames.push(f.name); h2New=0; } else h2New = pairs[idxBefore].v;
      pairs.push({d: lightOn, v: h2New});
      pairs.sort((a,b)=>a.d-b.d);
      const tHours = pairs.map(p=>(p.d - lightOn)/3600000);
      const h2pct = pairs.map(p=>p.v);
      const F = Qs[h]/1000*60/22.41396954;
      const h2F = h2pct.map(v=> v/100*F*1e6);
      const h2Fm = h2F.map(v=> v/ms[h]);
      const h2FmInt = cumtrapz(tHours, h2Fm);
      return {t:tHours, h2pct, h2F, h2Fm, h2FmInt, label:f.label, color:f.color};
    });
    document.getElementById('gcLightAlert').innerHTML = lightOnAlertNames.length
      ? `<div class="alert warn">⚠ Light-on time is before first injection in:<br>${lightOnAlertNames.join('<br>')}</div>` : '';
    document.getElementById('gcAlerts').innerHTML = loadAlerts + gcUploadAlerts;
    renderGcPlots();
  }

  function renderGcPlots(){
    const legend = document.getElementById('gcLegend'); legend.innerHTML='';
    let allT = dataTables.flatMap(d=>d.t);
    const tmin = Math.min(0, minArr(allT)), tmax = maxArr(allT);

    plot1 = new Plot(document.getElementById('gcSvg1'), {xlabel:'Time (h)', ylabel:'H₂ Rate (mmol/h/g)'});
    let ymax1 = Math.max(...dataTables.map(d=>maxArr(d.h2Fm))), ymin1 = Math.min(...dataTables.map(d=>minArr(d.h2Fm)));
    plot1.setRange(tmin, tmax, ymin1, ymax1*1.05);
    plot1.drawAxes();
    dataTables.forEach((d,k)=>{
      plot1.line(d.t, d.h2Fm, d.color, 1.3);
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${d.color}"></i>${d.label}`; legend.appendChild(s);
    });
    plot1.attachTools(plot1.svg.closest('.plot-wrap'));

    plot2 = new Plot(document.getElementById('gcSvg2'), {xlabel:'Time (h)', ylabel:'Cumulative H₂ (mmol/g)'});
    let ymax2 = Math.max(...dataTables.map(d=>maxArr(d.h2FmInt)));
    plot2.setRange(tmin, tmax, 0, ymax2*1.05);  // tmin already ≤ 0
    plot2.drawAxes();
    dataTables.forEach(d=> plot2.line(d.t, d.h2FmInt, d.color, 1.3));
    plot2.attachTools(plot2.svg.closest('.plot-wrap'));

    updateRegression();
  }

  function drawGcVlines(){
    [plot1, plot2].forEach(p=>{
      if (!p) return;
      p.clearOverlay();
      p.vline(plateauStart, '#fff', false);
      p.vline(plateauEnd,   '#fff', false);
    });
  }

  window._gcRedraw = ()=>{ if (dataTables.length) renderGcPlots(); };

  function updateRegression(){
    const xStart = Math.min(plateauStart, plateauEnd);
    const xEnd   = Math.max(plateauStart, plateauEnd);
    costResults = dataTables.map(d=>{
      // Find first index with t >= xStart and last index with t <= xEnd
      let startIdx = -1, endIdx = -1;
      for (let i=0;i<d.t.length;i++){
        if (d.t[i] >= xStart && startIdx < 0) startIdx = i;
        if (d.t[i] <= xEnd) endIdx = i;
      }
      if (startIdx < 0 || endIdx < 0 || startIdx >= endIdx) return {label:d.label, cost:NaN, dt:NaN};
      const dt = d.t[endIdx] - d.t[startIdx];
      if (dt === 0) return {label:d.label, cost:NaN, dt:NaN};
      const rate = (d.h2FmInt[endIdx] - d.h2FmInt[startIdx]) / dt;
      return {label:d.label, cost:rate, dt};
    });
    // Redraw data lines then overlay vlines
    plot1.clearData(); dataTables.forEach(d=> plot1.line(d.t, d.h2Fm, d.color, 1.3));
    plot2.clearData(); dataTables.forEach(d=> plot2.line(d.t, d.h2FmInt, d.color, 1.3));
    drawGcVlines();
    renderPlateauTable();
    drawBarChart();
  }

  function renderPlateauTable(){
    const wrap = document.getElementById('gcPlateauTableWrap');
    let html = '<table><thead><tr><th>Label</th><th>Mean integral rate (mmol/h/g)</th></tr></thead><tbody>';
    costResults.forEach(c=> html += `<tr><td>${c.label}</td><td>${isFinite(c.cost)?c.cost.toFixed(4):'-'}</td></tr>`);
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function drawBarChart(){
    const barCard = document.getElementById('gcResultsBar');
    const finite = costResults.filter(c=>isFinite(c.cost));
    if (!finite.length){ barCard.style.display='none'; return; }
    barCard.style.display='block';
    const svg = document.getElementById('gcSvgBar');
    const barPlot = new Plot(svg, {xlabel:'', ylabel:'H₂ Rate (mmol/h/g)', noXTickLabels:true});
    const ymax = Math.max(...finite.map(c=>c.cost))*1.2;
    barPlot.setRange(0, costResults.length+1, 0, ymax||1);
    barPlot.drawAxes();
    costResults.forEach((c,k)=>{
      if (!isFinite(c.cost)) return;
      barPlot.bar(k+1-0.16, k+1+0.16, 0, c.cost, dataTables[k].color);
      barPlot.tickLabel(k+1, c.label);
    });
    barPlot.attachTools(svg.closest('.plot-wrap'));
  }

  document.getElementById('gcSaveCsv').onclick = ()=>{
    const wrap = document.getElementById('gcDownloads'); wrap.innerHTML='';
    dataTables.forEach(d=>{
      let t = csvLine(['Time (h)','H2 (mol%)','H2 (umol/h)','H2 (mmol/h/g)','Cumulative H2 (mmol/g)']);
      for (let i=0;i<d.t.length;i++){
        t += csvLine([d.t[i],d.h2pct[i],d.h2F[i],d.h2Fm[i],d.h2FmInt[i]].map(v=>fmtNum(v,5)));
      }
      downloadBlob(d.label+'_output.csv', t);
      makeDownloadLink(wrap, d.label+'_output.csv', t, d.label+'_output.csv');
    });
    let t2 = csvLine(['Label','Mean integral rate (mmol/h/g)','Interval duration (h)']);
    costResults.forEach(c=> t2 += csvLine([c.label, fmtNum(c.cost,6), fmtNum(c.dt,4)]));
    downloadBlob('H2_rates.csv', t2);
    makeDownloadLink(wrap, 'H2_rates.csv', t2, 'H2_rates.csv');
  };
})();
