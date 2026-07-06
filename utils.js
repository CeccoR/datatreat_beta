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
// --- Minimal ZIP writer (store / no compression) -------------------------
// Bundles a list of {name, text} entries into a single .zip Blob. Pure client
// side, no dependencies. Uses the "stored" method so no deflate is needed.
const _CRC_TABLE = (()=>{
  const t = new Uint32Array(256);
  for (let n=0;n<256;n++){ let c=n; for (let k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1); t[n]=c>>>0; }
  return t;
})();
function _crc32(bytes){
  let c = 0xFFFFFFFF;
  for (let i=0;i<bytes.length;i++) c = _CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c>>>8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipBlob(entries){
  const enc = new TextEncoder();
  const chunks = [];   // file-data + local headers, concatenated
  const central = [];  // central-directory records
  let offset = 0;
  const u16 = v => new Uint8Array([v&0xFF, (v>>>8)&0xFF]);
  const u32 = v => new Uint8Array([v&0xFF, (v>>>8)&0xFF, (v>>>16)&0xFF, (v>>>24)&0xFF]);
  for (const e of entries){
    const nameBytes = enc.encode(e.name);
    // entry carries either text (string) or bytes (Uint8Array / number[])
    const data = e.bytes != null
      ? (e.bytes instanceof Uint8Array ? e.bytes : Uint8Array.from(e.bytes))
      : enc.encode(e.text);
    const crc = _crc32(data);
    const local = [
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0),
      nameBytes, data
    ];
    local.forEach(b=>chunks.push(b));
    const localSize = 30 + nameBytes.length + data.length;
    central.push([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes
    ]);
    offset += localSize;
  }
  const centralStart = offset;
  const centralParts = [];
  central.forEach(rec=>{ rec.forEach(b=>centralParts.push(b)); });
  const centralSize = central.reduce((s,rec)=> s + rec.reduce((a,b)=>a+b.length,0), 0);
  const end = [
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralSize), u32(centralStart), u16(0)
  ];
  return new Blob([...chunks, ...centralParts, ...end], {type:'application/zip'});
}
function downloadZip(filename, entries){
  const url = URL.createObjectURL(zipBlob(entries));
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

  // Show a "Loading…" state on the dropzone while onFiles (async parsing) runs,
  // so large XRDML files or big batches don't look like a frozen UI.
  const runFiles = (files)=>{
    dz.classList.add('dz-loading');
    let ret;
    try { ret = onFiles(files); } finally {
      Promise.resolve(ret).finally(()=> dz.classList.remove('dz-loading'));
    }
  };

  dz.addEventListener('click', ()=>{ if (!dz.classList.contains('dz-loading')) input.click(); });

  input.addEventListener('change', ()=>{
    if (input.files.length) {
      const fileArr = Array.from(input.files);
      input.value = ''; // reset before async processing so same file can be re-added after removal
      runFiles(fileArr);
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
    if (dt && dt.files && dt.files.length) runFiles(dt.files);
  });
}

/* =========================================================
   UNIFIED FILE LIST RENDERER
   files: array of objects with at least {name, label}
   callbacks: {onRemove(i), onReorder(from,to), onRemoveAll(), onLabelChange(i,newLabel),
               onColorChange(i,color), onPaletteChange(colors)}
   extraCols: optional array of {header, render(file,i)} for additional columns
========================================================= */
function renderUnifiedFileList(containerId, files, callbacks, extraCols){
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (!files.length){ wrap.innerHTML=''; return; }

  const ec = extraCols || [];
  // colgroup: drag 5%, FILE 44%, LABEL 43%, extraCols (auto), actions 8% (dl + remove)
  let colgroup = `<colgroup><col style="width:5%"><col style="width:44%"><col style="width:43%">`;
  for (let i = 0; i < ec.length; i++) colgroup += `<col>`;
  colgroup += `<col style="width:8%"></colgroup>`;
  const grip = `<svg class="grip-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="2.5" y1="5" x2="13.5" y2="5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/><line x1="2.5" y1="11" x2="13.5" y2="11"/></svg>`;

  let html = `<div class="table-wrap-box"><table>${colgroup}<thead><tr><th></th><th><div style="display:flex;align-items:center;gap:5px"><button class="palette-pick-btn" title="Apply color palette"></button>FILE</div></th><th>SAMPLE LABEL</th>`;
  ec.forEach(c=> html += `<th>${String(c.header).toUpperCase()}</th>`);
  // Same download glyph as the plot/image export buttons, scaled to match the ✕
  const dlIcon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="4" x2="12" y2="15"/><polyline points="7,11 12,16 17,11"/><line x1="5" y1="19" x2="19" y2="19"/></svg>`;
  html += `<th style="text-align:right;white-space:nowrap"><button class="download-all del-bare dl-bare" title="Download all (zip)">${dlIcon}</button><button class="remove-all del-bare" title="Remove all">✕</button></th></tr></thead><tbody>`;

  files.forEach((f, i)=>{
    const swatch = f.color ? `<button class="color-swatch" data-i="${i}" data-color="${f.color}" style="background:${f.color}" title="Pick color"></button>` : '';
    html += `<tr class="file-row" data-i="${i}">`;
    html += `<td class="drag-cell"><span class="drag-handle" title="Drag to reorder">${grip}</span></td>`;
    html += `<td class="fname" title="${f.name}">${swatch}${f.name}</td>`;
    html += `<td><input type="text" class="label-input file-label" data-i="${i}" value="${f.label.replace(/"/g,'&quot;')}"></td>`;
    ec.forEach(c=> html += `<td>${c.render(f, i)}</td>`);
    html += `<td style="text-align:right;white-space:nowrap"><button class="dl-file del-bare dl-bare" data-i="${i}" title="Download file">${dlIcon}</button><button class="del del-bare row-del" data-i="${i}" title="Remove">✕</button></td>`;
    html += `</tr>`;
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
  wrap.querySelectorAll('.row-del').forEach(btn=>{
    btn.addEventListener('click', e=>{ if (callbacks.onRemove) callbacks.onRemove(+e.currentTarget.dataset.i); });
  });
  // Per-file download of the original uploaded content. A file keeps either
  // `raw` (single text file) or `rawFiles` (e.g. EPR's .dsc + binary .dta pair).
  const originalsOf = f => f.rawFiles && f.rawFiles.length
    ? f.rawFiles.map(rf=> rf.bytes != null ? { name:rf.name, bytes:rf.bytes } : { name:rf.name, text:rf.data ?? rf.text })
    : (f.raw != null ? [{ name:f.name, text:f.raw }] : []);
  wrap.querySelectorAll('.dl-file').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const f = files[+e.currentTarget.dataset.i];
      if (!f) return;
      const orig = originalsOf(f);
      if (!orig.length){ alert('The original file for “'+f.name+'” is not available.'); return; }
      if (orig.length === 1 && orig[0].text != null) downloadBlob(orig[0].name, orig[0].text);
      else downloadZip((f.label||f.name)+'.zip', orig);
    });
  });
  // Download all originals as a single zip
  const dlAll = wrap.querySelector('.download-all');
  if (dlAll) dlAll.addEventListener('click', ()=>{
    const entries = files.flatMap(originalsOf);
    if (!entries.length){ alert('No original files are available to download.'); return; }
    downloadZip('files.zip', entries);
  });

  // Drag-to-reorder via pointer events (works with both mouse and touch): grab the
  // handle and drag the row over another; the row under the pointer is the target.
  const rows = [...wrap.querySelectorAll('.file-row')];
  const rowAtY = (y)=>{
    for (const r of rows){ const b=r.getBoundingClientRect(); if (y>=b.top && y<=b.bottom) return r; }
    // beyond the last row → drop at the end
    if (rows.length){ const last=rows[rows.length-1].getBoundingClientRect(); if (y>last.bottom) return rows[rows.length-1]; }
    return null;
  };
  let drag = null; // { from }
  rows.forEach(row=>{
    const handle = row.querySelector('.drag-handle');
    handle.addEventListener('pointerdown', e=>{
      e.preventDefault();
      drag = { from: +row.dataset.i };
      row.classList.add('dragging');
      try { handle.setPointerCapture(e.pointerId); } catch(_){}
    });
    handle.addEventListener('pointermove', e=>{
      if (!drag) return;
      const target = rowAtY(e.clientY);
      rows.forEach(r=> r.classList.toggle('drag-over', r===target && +r.dataset.i!==drag.from));
    });
    const finish = (e)=>{
      if (!drag) return;
      const target = rowAtY(e.clientY);
      const to = target ? +target.dataset.i : null;
      const from = drag.from;
      rows.forEach(r=> r.classList.remove('drag-over', 'dragging'));
      drag = null;
      if (to!=null && to!==from && callbacks.onReorder) callbacks.onReorder(from, to);
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', ()=>{ rows.forEach(r=> r.classList.remove('drag-over','dragging')); drag = null; });
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
const _tabRedraw = {}, _needsRedraw = {};
// A module registers how to redraw its current view; goTab calls it the first
// time the tab becomes visible after a session restore flagged it.
function registerTabRedraw(mod, fn){ _tabRedraw[mod] = fn; }
const VALID_TABS = ['home','tauc','xrd','gc','epr','sessions','settings'];
const TAB_TITLES = { home:'DataTreat', tauc:'DataTreat · DRS UV-Vis', xrd:'DataTreat · XRPD', gc:'DataTreat · GC', epr:'DataTreat · EPR', sessions:'DataTreat · Sessions', settings:'DataTreat · Settings' };
let _activeTab = 'home';
function goTab(tab, fromHash){
  if (!VALID_TABS.includes(tab)) tab = 'home';
  _activeTab = tab;
  document.querySelectorAll('#nav button').forEach(b=>{
    const on = b.dataset.tab===tab;
    b.classList.toggle('active', on);
    if (b.hasAttribute('role')) b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.id==='tab-'+tab));
  // A module whose plots were drawn while its tab was hidden (e.g. a session
  // opened into a background tab) sized them to 0; redraw once now it's visible.
  if (_needsRedraw[tab] && _tabRedraw[tab]){
    _needsRedraw[tab] = false;
    requestAnimationFrame(()=>{ try { _tabRedraw[tab](); } catch(e){} });
  }
  // Reflect the current section in the URL hash (so reloads and shared #xrd links land here)
  if (!fromHash && location.hash.slice(1) !== tab) location.hash = tab;
  document.title = TAB_TITLES[tab] || 'DataTreat'; // ease finding the right tab among many windows
  if (tab === 'home') requestAnimationFrame(sizeHomeTiles); // re-fit tiles after any resize while away
}

/* =========================================================
   UNDO / REDO — per-module snapshot stacks (command pattern)
   A module registers a snapshot()/restore() pair; it calls checkpoint()
   just before a reversible change. Ctrl/⌘+Z undoes, Ctrl/⌘+Y (or ⇧+Z)
   redoes, acting on the module of the currently active tab.
========================================================= */
class UndoStack {
  constructor(snapshot, restore, limit=80){
    this._snap = snapshot; this._restore = restore; this._limit = limit;
    this.states = []; this.index = -1; this._busy = false;
  }
  // Record the CURRENT state (called after a reversible change, and once as baseline).
  commit(){
    if (this._busy) return;
    const snap = this._snap();
    const cur = this.index >= 0 ? this.states[this.index] : null;
    // Skip commits that don't actually change anything (avoids dead undo steps).
    if (cur && JSON.stringify(cur) === JSON.stringify(snap)) return;
    // Drop any redo branch, then append the new state.
    if (this.index < this.states.length - 1) this.states.length = this.index + 1;
    this.states.push(snap);
    if (this.states.length > this._limit) this.states.shift();
    this.index = this.states.length - 1;
    // Fire (and clear) any one-shot change listeners for a real, recorded change.
    if (this._onceListeners && this._onceListeners.length){
      const cbs = this._onceListeners; this._onceListeners = [];
      cbs.forEach(cb=>{ try { cb(); } catch(e){} });
    }
  }
  onceCommit(cb){ (this._onceListeners || (this._onceListeners = [])).push(cb); }
  _apply(i){ this.index = i; this._busy = true; try { this._restore(this.states[i]); } finally { this._busy = false; } }
  performUndo(){ if (this.index <= 0) return false; this._apply(this.index - 1); return true; }
  performRedo(){ if (this.index >= this.states.length - 1) return false; this._apply(this.index + 1); return true; }
  reset(){ this.states.length = 0; this.index = -1; }
}
const _histories = {};
function registerHistory(key, snapshot, restore){
  const st = new UndoStack(snapshot, restore);
  _histories[key] = st;
  return st;
}
document.addEventListener('keydown', e=>{
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  const isUndo = k==='z' && !e.shiftKey;
  const isRedo = k==='y' || (k==='z' && e.shiftKey);
  if (!isUndo && !isRedo) return;
  // Let the browser handle native text undo while editing a field
  const el = document.activeElement, tag = el && el.tagName;
  if (tag==='INPUT' || tag==='TEXTAREA' || (el && el.isContentEditable)) return;
  const st = _histories[_activeTab];
  if (!st) return;
  const did = isUndo ? st.performUndo() : st.performRedo();
  if (did) e.preventDefault();
});
// Give every module tab a permanent (invisible) round SVG dot so its slot is
// always reserved — the tab width never changes when the badge appears.
(function initTabDots(){
  ['tauc','xrd','gc','epr'].forEach(tab=>{
    const btn = document.querySelector('#nav button[data-tab="'+tab+'"]');
    if (!btn || btn.querySelector('.tab-dot')) return;
    btn.classList.add('has-dot-slot');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dot.setAttribute('class', 'tab-dot');
    dot.setAttribute('viewBox', '0 0 10 10');
    dot.setAttribute('aria-hidden', 'true');
    dot.innerHTML = '<circle cx="5" cy="5" r="4.2" fill="currentColor"/>';
    btn.appendChild(dot);
  });
})();
// Toggle the "data loaded" dot's visibility (the slot is already reserved).
function setTabLoaded(tab, has){
  const btn = document.querySelector('#nav button[data-tab="'+tab+'"]');
  if (btn) btn.classList.toggle('has-data', !!has);
  // The section's floppy "Save session" button only appears once data is loaded
  const save = document.querySelector('.section-head .session-save-btn[data-module="'+tab+'"]');
  if (save) save.style.visibility = has ? 'visible' : 'hidden';
}
// Does a module currently hold loaded data? (drives the replace-on-open confirm)
function moduleHasData(mod){
  const btn = document.querySelector('#nav button[data-tab="'+mod+'"]');
  return !!(btn && btn.classList.contains('has-data'));
}

/* =========================================================
   THEME — light / dark, remembered, defaulting to the OS preference.
   The initial attribute is set by an inline <head> script (no flash); here we
   wire the header toggle and the settings selector, and persist the choice.
========================================================= */
const THEME_KEY = 'datatreat-theme';
function currentTheme(){ return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
function applyTheme(theme, persist){
  theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (persist){ try { localStorage.setItem(THEME_KEY, theme); } catch(e){} }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f3f5f6' : '#0e1316');
  const sel = document.getElementById('settingTheme');
  if (sel) sel.value = theme;
}
(function initTheme(){
  applyTheme(currentTheme(), false); // sync meta + settings select to the pre-painted attribute
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', ()=> applyTheme(currentTheme()==='light' ? 'dark' : 'light', true));
  document.addEventListener('change', e=>{ if (e.target && e.target.id==='settingTheme') applyTheme(e.target.value, true); });
  // Follow OS changes only while the user hasn't made an explicit choice
  if (window.matchMedia){
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', ev=>{
      let saved=null; try { saved = localStorage.getItem(THEME_KEY); } catch(e){}
      if (!saved) applyTheme(ev.matches ? 'light' : 'dark', false);
    });
  }
})();

/* Module state access for the session manager: reuse each module's registered
   undo snapshot()/restore() as the canonical serialize/deserialize. */
const MODULES = ['tauc','xrd','gc','epr'];
const MODULE_LABELS = { tauc:'DRS UV-Vis', xrd:'XRPD', gc:'GC', epr:'EPR' };
function getModuleState(mod){
  const st = _histories[mod];
  return st ? st._snap() : null;
}
function restoreModuleState(mod, state){
  const st = _histories[mod];
  if (!st) return;
  st._busy = true;
  try { st._restore(state); } finally { st._busy = false; }
  st.reset();
  st.commit(); // fresh baseline so undo/redo start clean from the loaded session
  // Plots just drawn may be sized wrong if the tab is hidden; redraw on show.
  if (_activeTab === mod){ if (_tabRedraw[mod]) requestAnimationFrame(()=>{ try { _tabRedraw[mod](); } catch(e){} }); }
  else { _needsRedraw[mod] = true; }
}
// Run cb once, the next time the module records a real change (edit/add/remove…).
function onModuleChangeOnce(mod, cb){
  const st = _histories[mod];
  if (st) st.onceCommit(cb);
}

// Size each home card so its square icon tile spans 90% of the (common) card
// height, centered, with equal top/bottom/left insets. The tile is absolutely
// positioned (so it can't inflate the height); a few passes converge on a shared
// height H that fits the tallest description. A cap keeps it from running away
// when a narrow text column would otherwise grow unbounded.
function sizeHomeTiles(){
  const cards = [...document.querySelectorAll('.home-card')];
  if (!cards.length || cards[0].getBoundingClientRect().height <= 0) return; // hidden
  // On narrow screens a plain CSS layout (small fixed tile) is used instead — clear
  // any inline sizing so those rules apply.
  if (window.innerWidth <= 600){
    cards.forEach(c=>{
      c.style.height = ''; c.style.paddingLeft = '';
      const ic = c.querySelector('.home-card-icon');
      ic.style.left = ''; ic.style.width = ''; ic.style.height = '';
    });
    return;
  }
  const GAP = 16, CAP = 120, B = 1; // B = card border width (kept out of the insets)
  // inset from the padding box so the visible top/bottom (via centering) and left
  // gaps are equal once the 1px border is accounted for.
  const insetOf = (H, tile)=> (H - 2*B - tile) / 2;
  let H = 100;
  for (let pass=0; pass<6; pass++){
    const tile = Math.min(CAP, 0.9*H);
    const padLeft = insetOf(H, tile) + tile + GAP;
    let maxText = 0;
    cards.forEach(c=>{
      c.style.height = 'auto';
      c.style.paddingLeft = padLeft + 'px';
      maxText = Math.max(maxText, c.querySelector('.home-card-text').getBoundingClientRect().height);
    });
    H = Math.max(tile, maxText) / 0.9;
  }
  const tile = Math.min(CAP, 0.9*H), inset = insetOf(H, tile), padLeft = inset + tile + GAP;
  cards.forEach(c=>{
    c.style.height = H.toFixed(2) + 'px';
    c.style.paddingLeft = padLeft.toFixed(2) + 'px';
    const ic = c.querySelector('.home-card-icon');
    ic.style.left = inset.toFixed(2) + 'px';
    ic.style.width = tile.toFixed(2) + 'px';
    ic.style.height = tile.toFixed(2) + 'px';
  });
}
requestAnimationFrame(sizeHomeTiles);
window.addEventListener('load', sizeHomeTiles);
window.addEventListener('resize', ()=>requestAnimationFrame(sizeHomeTiles));
// Deep-link support: honour the initial hash and react to hash changes / back-forward
window.addEventListener('hashchange', ()=>{ goTab(location.hash.slice(1), true); });
(function initHashRoute(){
  const t = location.hash.slice(1);
  if (t && VALID_TABS.includes(t)) goTab(t, true);
})();

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
   COLLAPSIBLE INSTRUCTIONS
   Each .instr-block is toggled by a small info icon placed next to the card's
   title. Open by default; the collapsed choice is remembered per block.
========================================================= */
(function initInstrCollapse(){
  const INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/></svg>';
  document.querySelectorAll('.instr-block').forEach((block, i)=>{
    const section = block.closest('section.tab');
    const key = 'datatreat-instr-' + (section ? section.id : 's') + '-' + i;
    // Attach the toggle to the nearest preceding heading; fall back to inline.
    // The heading may be wrapped (e.g. in a .section-head flex row), so also
    // look for a heading nested inside a preceding sibling.
    let heading = null, prev = block.previousElementSibling;
    while (prev){
      if (/^H[1-3]$/.test(prev.tagName)){ heading = prev; break; }
      const inner = prev.querySelector && prev.querySelector('h1,h2,h3');
      if (inner){ heading = inner; break; }
      prev = prev.previousElementSibling;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'instr-info';
    btn.setAttribute('aria-label', 'Toggle instructions');
    btn.innerHTML = INFO_SVG;
    if (heading) heading.appendChild(btn);
    else block.parentNode.insertBefore(btn, block);
    let collapsed = false;
    try { collapsed = localStorage.getItem(key) === 'collapsed'; } catch(e){}
    const apply = ()=>{
      block.style.display = collapsed ? 'none' : '';
      btn.classList.toggle('active', !collapsed); // highlighted while instructions are shown
      btn.setAttribute('aria-expanded', String(!collapsed));
    };
    apply();
    btn.addEventListener('click', ()=>{ collapsed = !collapsed; try { localStorage.setItem(key, collapsed ? 'collapsed' : 'open'); } catch(e){} apply(); });
  });
})();

export {
  COLORS, colorOf, CP_PRESETS, ColorPickerUI, colorPickerUI, CP_PALETTES, PalettePickerUI, palettePickerUI, settings, fmtNum, csvJoin, csvLine, downloadBlob, downloadZip, zipBlob, makeDownloadLink, parseNumber, detectDelim, splitCSVLine, setupDropzone, renderUnifiedFileList, linspace, interpLinear, movingAverage, gradientArr, cumtrapz, meanArr, stdArr, maxArr, minArr, fitLinear, betacf, logGamma, betainc, tcdf, tinv, VALID_TABS, goTab, setTabLoaded, moduleHasData, registerHistory, buildAlertsHtml, nextColor, MODULES, MODULE_LABELS, getModuleState, restoreModuleState, onModuleChangeOnce, registerTabRedraw, applyTheme, currentTheme
};
