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
const SETTINGS_KEY = 'datatreat-settings';
const settings = { decimal: '.', field: ';', plotFmt: 'png' };
// Settings (image format + CSV decimal/field) persist across sessions, like the theme.
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  if (saved && typeof saved === 'object') Object.assign(settings, saved);
} catch(e){}
if (settings.decimal === ',' && settings.field === ',') settings.field = ';'; // guard invalid combo
function saveSettings(){ try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch(e){} }

function fmtNum(v, decimals){
  if (!isFinite(v)) return '';
  return v.toFixed(decimals).replace('.', settings.decimal);
}
function csvJoin(vals){ return vals.join(settings.field); }
function csvLine(vals){ return csvJoin(vals) + '\n'; }

(function initSettings(){
  const decSel = document.getElementById('settingDecimal');
  const fldSel = document.getElementById('settingField');
  const fmtSel = document.getElementById('settingPlotFmt');
  // Reflect the (possibly restored) settings in the controls.
  decSel.value = settings.decimal;
  fldSel.value = settings.field;
  fmtSel.value = settings.plotFmt;

  function validate(){
    const d = decSel.value, f = fldSel.value;
    if (d === ',' && f === ','){
      // revert whichever was just changed to a safe default
      if (settings.decimal === ',') decSel.value = '.';
      else fldSel.value = ';';
    }
    settings.decimal = decSel.value;
    settings.field   = fldSel.value;
    saveSettings();
  }

  decSel.addEventListener('change', validate);
  fldSel.addEventListener('change', validate);
  fmtSel.addEventListener('change', ()=>{ settings.plotFmt = fmtSel.value; saveSettings(); });
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
// Make a filename safe for every OS's zip extractor: strip characters illegal
// on Windows (< > : " / \ | ? *) and control chars, and de-duplicate collisions
// (duplicate names make Windows reject the archive with "incorrect parameter").
function _zipSafeNames(entries){
  const seen = Object.create(null);
  return entries.map(e=>{
    let name = String(e.name == null ? 'file' : e.name)
      .replace(/[\x00-\x1f\x7f<>:"/\\|?*]+/g, '_')
      .replace(/^[.\s]+|[.\s]+$/g, '')      // no leading/trailing dots or spaces
      .slice(0, 200) || 'file';
    const key = name.toLowerCase();
    if (seen[key] !== undefined){
      const n = ++seen[key];
      const dot = name.lastIndexOf('.');
      name = (dot > 0 ? name.slice(0,dot) : name) + '_' + n + (dot > 0 ? name.slice(dot) : '');
    } else seen[key] = 0;
    return { ...e, name };
  });
}
function zipBlob(entries){
  entries = _zipSafeNames(entries);
  const enc = new TextEncoder();
  const chunks = [];   // file-data + local headers, concatenated
  const central = [];  // central-directory records
  let offset = 0;
  const u16 = v => new Uint8Array([v&0xFF, (v>>>8)&0xFF]);
  const u32 = v => new Uint8Array([v&0xFF, (v>>>8)&0xFF, (v>>>16)&0xFF, (v>>>24)&0xFF]);
  // A *valid* DOS date/time — a zero date (day 0/month 0) makes strict
  // extractors (macOS Archive Utility, Windows Explorer) reject the archive.
  const d = new Date();
  const dosTime = ((d.getHours()<<11) | (d.getMinutes()<<5) | (d.getSeconds()>>1)) & 0xFFFF;
  const dosDate = (((d.getFullYear()-1980)<<9) | ((d.getMonth()+1)<<5) | d.getDate()) & 0xFFFF;
  const FLAG = 0x0800; // filenames are UTF-8
  for (const e of entries){
    const nameBytes = enc.encode(e.name);
    // entry carries either text (string) or bytes (Uint8Array / number[])
    const data = e.bytes != null
      ? (e.bytes instanceof Uint8Array ? e.bytes : Uint8Array.from(e.bytes))
      : enc.encode(e.text);
    const crc = _crc32(data);
    const local = [
      u32(0x04034b50), u16(20), u16(FLAG), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0),
      nameBytes, data
    ];
    local.forEach(b=>chunks.push(b));
    const localSize = 30 + nameBytes.length + data.length;
    central.push([
      u32(0x02014b50), u16(20), u16(20), u16(FLAG), u16(0), u16(dosTime), u16(dosDate),
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

// Download raw bytes verbatim (byte-for-byte identical to the original upload).
function downloadBytes(filename, bytes){
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const url = URL.createObjectURL(new Blob([arr], {type:'application/octet-stream'}));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);}, 200);
}

function makeDownloadLink(container, filename, text, label){
  const b = document.createElement('button');
  b.className = 'btn btn-sm';
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
// A perfect 1:1 cross with rounded stroke caps (replaces the plain ✕ glyph).
// Inked box 15×15, centred on (12,12) — same size as the download glyph below.
const X_SVG = (size=14)=> `<svg class="x-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="4.5" y1="4.5" x2="19.5" y2="19.5"/><line x1="4.5" y1="19.5" x2="19.5" y2="4.5"/></svg>`;
// Download glyph, inked box 15×15 centred on (12,12) so it matches the X exactly.
const DL_SVG = (size=15)=> `<svg class="dl-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="4.5" x2="12" y2="15"/><polyline points="7 10.5 12 15 17 10.5"/><line x1="4.5" y1="19.5" x2="19.5" y2="19.5"/></svg>`;

function renderUnifiedFileList(containerId, files, callbacks, extraCols){
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (!files.length){ wrap.innerHTML=''; return; }

  const ec = extraCols || [];
  // colgroup: drag 5%, FILE 44%, LABEL 43%, extraCols (auto), actions fixed 58px
  // (a fixed width guarantees the download+remove icons fit even on narrow phones)
  let colgroup = `<colgroup><col style="width:5%"><col style="width:44%"><col style="width:43%">`;
  for (let i = 0; i < ec.length; i++) colgroup += `<col>`;
  colgroup += `<col style="width:58px"></colgroup>`;
  const grip = `<svg class="grip-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="2.5" y1="5" x2="13.5" y2="5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/><line x1="2.5" y1="11" x2="13.5" y2="11"/></svg>`;

  let html = `<div class="table-wrap-box"><table>${colgroup}<thead><tr><th></th><th><div class="file-head"><button class="palette-pick-btn" title="Apply color palette"></button><span>FILE</span></div></th><th>SAMPLE LABEL</th>`;
  ec.forEach(c=> html += `<th>${String(c.header).toUpperCase()}</th>`);
  const dlIcon = DL_SVG(15);
  const xIcon = X_SVG(15);
  html += `<th class="row-acts" style="text-align:right;white-space:nowrap"><button class="download-all del-bare dl-bare" title="Download all (zip)">${dlIcon}</button><button class="remove-all del-bare is-danger" title="Remove all">${xIcon}</button></th></tr></thead><tbody>`;

  files.forEach((f, i)=>{
    const swatch = f.color ? `<button class="color-swatch" data-i="${i}" data-color="${f.color}" style="background:${f.color}" title="Pick color"></button>` : '';
    html += `<tr class="file-row" data-i="${i}">`;
    html += `<td class="drag-cell"><span class="drag-handle" title="Drag to reorder">${grip}</span></td>`;
    html += `<td class="fname" title="${f.name}"><span class="fname-inner">${swatch}<span class="fname-text">${f.name}</span></span></td>`;
    html += `<td><input type="text" class="label-input file-label" data-i="${i}" value="${f.label.replace(/"/g,'&quot;')}"></td>`;
    ec.forEach(c=> html += `<td>${c.render(f, i)}</td>`);
    html += `<td class="row-acts" style="text-align:right;white-space:nowrap"><button class="dl-file del-bare dl-bare idle-dim" data-i="${i}" title="Download file">${dlIcon}</button><button class="del del-bare row-del is-danger idle-dim" data-i="${i}" title="Remove">${xIcon}</button></td>`;
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  wrap.innerHTML = html;

  // Removing files (all or one) is treated as an ordinary edit to the project — it
  // updates the draft rather than discarding it — so this only confirms the action.
  wrap.querySelector('.remove-all').addEventListener('click', async ()=>{
    if (!await confirmBanner('Are you sure to remove all files?')) return;
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
    // Removing a single file is a plain edit — no confirmation, even for the last one.
    btn.addEventListener('click', e=>{ if (callbacks.onRemove) callbacks.onRemove(+e.currentTarget.dataset.i); });
  });
  // Per-file download of the original uploaded content, byte-for-byte. A file
  // keeps its original bytes in `rawBytes`, or a `rawFiles` list (e.g. EPR's
  // .dsc + .dta pair), or legacy decoded text in `raw` (older sessions).
  const originalsOf = f => {
    if (f.rawFiles && f.rawFiles.length)
      return f.rawFiles.map(rf=> rf.bytes != null ? { name:rf.name, bytes:rf.bytes } : { name:rf.name, text:rf.data ?? rf.text });
    if (f.rawBytes != null) return [{ name:f.name, bytes:f.rawBytes }];
    if (f.raw != null) return [{ name:f.name, text:f.raw }];
    return [];
  };
  wrap.querySelectorAll('.dl-file').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const f = files[+e.currentTarget.dataset.i];
      if (!f) return;
      const orig = originalsOf(f);
      if (!orig.length){ alert('The original file for “'+f.name+'” is not available.'); return; }
      if (orig.length === 1){
        if (orig[0].bytes != null) downloadBytes(orig[0].name, orig[0].bytes);
        else downloadBlob(orig[0].name, orig[0].text);
      } else downloadZip((f.label||f.name)+'.zip', orig);
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
// Redraw only the visible tab's plots (on window resize). Hidden tabs render at
// size 0, so redrawing them would be wasted work / could corrupt their view; they
// are redrawn when shown (see goTab). Flag the others so they refresh on show.
function redrawAll(){
  const fn = _tabRedraw[_activeTab];
  if (fn){ try{ fn(); }catch(e){} }
  for (const m in _tabRedraw){ if (m !== _activeTab) _needsRedraw[m] = true; }
}
const VALID_TABS = ['home','tauc','xrd','gc','epr','projects','settings'];
const TAB_TITLES = { home:'DataTreat', tauc:'DataTreat · UV-Vis DRS', xrd:'DataTreat · XRPD', gc:'DataTreat · GC', epr:'DataTreat · EPR', projects:'DataTreat · Projects', settings:'DataTreat · Settings' };
let _activeTab = 'home';
function goTab(tab, fromHash){
  if (!VALID_TABS.includes(tab)) tab = 'home';
  _activeTab = tab;
  document.querySelectorAll('#nav button').forEach(b=>{
    const on = b.dataset.tab===tab;
    b.classList.toggle('is-on', on);
    if (b.hasAttribute('role')) b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.id==='tab-'+tab));
  // Plots drawn while their tab was hidden (background session restore, or any
  // resize/edit while another tab was showing) are sized to 0 or stale; redraw
  // whenever a module tab becomes visible so its charts always fit the viewport.
  if (_tabRedraw[tab]){
    _needsRedraw[tab] = false;
    requestAnimationFrame(()=>{ try { _tabRedraw[tab](); } catch(e){} });
  }
  if (MODULES.includes(tab)) normalizeProjIcons(tab); // size icons now the tab is visible
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
  // `silent` records the state without firing change listeners — used for the
  // baseline commit after a programmatic restore (not a user edit).
  commit(silent){
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
    if (silent) return;
    // Fire (and clear) any one-shot change listeners for a real, recorded change.
    if (this._onceListeners && this._onceListeners.length){
      const cbs = this._onceListeners; this._onceListeners = [];
      cbs.forEach(cb=>{ try { cb(); } catch(e){} });
    }
    // Persistent change listeners (e.g. autosave).
    if (this._listeners) this._listeners.forEach(cb=>{ try { cb(); } catch(e){} });
  }
  onceCommit(cb){ (this._onceListeners || (this._onceListeners = [])).push(cb); }
  onCommit(cb){ (this._listeners || (this._listeners = [])).push(cb); }
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
// ← / → navigate samples in the active module (mirror the on-screen ‹ › buttons).
const SAMPLE_NAV = { tauc:['taucPrev','taucNext'], xrd:['xrdPrev','xrdNext'] };
document.addEventListener('keydown', e=>{
  if (e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement, tag = el && el.tagName;
  if (tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT' || (el && el.isContentEditable)) return;
  const nav = SAMPLE_NAV[_activeTab];
  if (!nav) return;
  const btn = document.getElementById(e.key==='ArrowLeft' ? nav[0] : nav[1]);
  if (btn && btn.offsetParent!==null){ btn.click(); e.preventDefault(); }
});
// Sticky "back to top" button — visible only once the page is scrolled down.
(function initScrollTop(){
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;
  const onScroll = ()=> btn.classList.toggle('visible', window.scrollY > 280);
  window.addEventListener('scroll', onScroll, { passive:true });
  btn.addEventListener('click', ()=> window.scrollTo({ top:0, behavior:'smooth' }));
  onScroll();
})();
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
  if (btn) btn.classList.toggle('has-data', !!has);   // the nav dot tracks actual data
  refreshProjBar(tab);
}
// Project-bar buttons show when the module has files OR a non-empty project name —
// hidden only when both are empty. (Save/export still refuse an empty file list.)
function refreshProjBar(tab){
  const nameInp = document.querySelector('.project-name-input[data-module="'+tab+'"]');
  const named = !!(nameInp && nameInp.value.trim());
  const has = !!document.querySelector('#nav button[data-tab="'+tab+'"].has-data');
  const show = has || named;
  document.querySelectorAll('.project-bar .proj-btn[data-module="'+tab+'"], '
    + '.project-bar[data-module="'+tab+'"] .proj-del, .project-bar[data-module="'+tab+'"] .proj-new')
    .forEach(b=>{ b.style.visibility = show ? 'visible' : 'hidden'; });
  if (show) normalizeProjIcons(tab);
}

/* Normalize a module's project icons so every icon's minimal bounding box is the
   same size and centred in its button. Measures each icon's inked bbox (getBBox)
   and transforms it to centre (12,12) at a common target extent. Idempotent. */
const PROJ_ICON_TARGET = 18;
// Center an icon's inked content at (12,12). If `forceScale` is given, use it
// (so one icon can match another's exact scale); otherwise scale so the icon's
// larger side equals PROJ_ICON_TARGET. Returns the scale used.
function fitIcon(svg, forceScale){
  if (!svg) return null;
  const NS = 'http://www.w3.org/2000/svg';
  let g = svg.querySelector('g.icon-fit');
  if (!g){
    g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'icon-fit');
    while (svg.firstChild) g.appendChild(svg.firstChild);
    g.querySelectorAll('*').forEach(el=> el.setAttribute('vector-effect','non-scaling-stroke'));
    svg.appendChild(g);
  }
  g.removeAttribute('transform');
  let bb; try { bb = g.getBBox(); } catch(e){ return null; }
  if (!bb.width || !bb.height) return null; // not rendered yet (hidden tab)
  const s = forceScale || (PROJ_ICON_TARGET / Math.max(bb.width, bb.height));
  const cx = bb.x + bb.width/2, cy = bb.y + bb.height/2;
  g.setAttribute('transform', `translate(12 12) scale(${s.toFixed(4)}) translate(${(-cx).toFixed(3)} ${(-cy).toFixed(3)})`);
  return s;
}
function normalizeProjIcons(mod){
  requestAnimationFrame(()=>{
    const q = cls => document.querySelector('.project-bar .'+cls+'[data-module="'+mod+'"] .proj-svg');
    fitIcon(q('proj-save')); fitIcon(q('proj-saveas'));
    const csvScale = fitIcon(q('proj-csv'));
    // Exception: the JSON icon is the CSV icon with different text — render it at
    // the exact same scale so the arrow and font match CSV, not the equal-box rule.
    if (csvScale) fitIcon(q('proj-json'), csvScale);
    document.querySelectorAll('.project-bar[data-module="'+mod+'"] .proj-del .proj-svg, .project-bar[data-module="'+mod+'"] .proj-new .proj-svg')
      .forEach(svg=> fitIcon(svg));
  });
}

/* CSV export registry — each module registers a builder returning its list of
   {name,text} CSV entries. The group button zips them all; per-plot/table buttons
   pick a subset by name. */
const _csvExport = {};
function registerCsvExport(mod, buildFn){ _csvExport[mod] = buildFn; }
function runCsvExport(mod){
  const b = _csvExport[mod]; if (!b) return;
  const e = b(); if (e && e.length) downloadZip(mod+'_export.zip', e);
}
// Download a subset of a module's CSVs by file name: a single file downloads as a
// .csv, several bundle into a .zip.
function downloadCsvFiles(mod, names){
  const b = _csvExport[mod]; if (!b) return;
  const all = b() || [];
  const sel = all.filter(e=>names.includes(e.name));
  if (!sel.length) return;
  if (sel.length === 1) downloadBlob(sel[0].name, sel[0].text);
  else downloadZip(mod+'_export.zip', sel);
}
// The project CSV icon, reused on every per-view download button.
const CSV_BTN_ICON = `<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><text x="12" y="11" font-size="8.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" style="font-family:sans-serif">CSV</text><line x1="6" y1="18" x2="15" y2="18"/><polyline points="12.5 15.5 16 18 12.5 20.5"/></svg>`;
// Build a toolbar CSV button (same look/size as the other plot tool buttons, icon
// normalised to the minimum-circumscribed-square rule). Downloads `names` for `mod`.
function makeCsvButton(mod, names, title){
  const btn = document.createElement('button');
  btn.className = 'btn plot-tool-btn plot-csv-btn';
  btn.title = title || 'Download CSV';
  btn.dataset.csvMod = mod;
  btn.dataset.csvNames = names;
  btn.innerHTML = CSV_BTN_ICON;
  requestAnimationFrame(()=>fitIcon(btn.querySelector('svg')));
  return btn;
}
// Normalise any CSV icons that are now visible (idempotent; hidden ones retry later).
function fitCsvIcons(root){
  (root||document).querySelectorAll('.plot-csv-btn svg, .table-csv-btn svg').forEach(s=>fitIcon(s));
}
// One delegated handler drives every per-view CSV button.
document.addEventListener('click', e=>{
  const btn = e.target.closest('[data-csv-mod]');
  // The image-download button carries data-csv-mod only as the source for building
  // the separate CSV button — it must NOT itself export CSVs (it downloads the image).
  if (!btn || btn.classList.contains('plot-dl-btn')) return;
  const names = (btn.dataset.csvNames||'').split(',').map(s=>s.trim()).filter(Boolean);
  downloadCsvFiles(btn.dataset.csvMod, names);
});
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
  const root = document.documentElement;
  const changing = persist && root.getAttribute('data-theme') !== theme;
  if (persist){ try { localStorage.setItem(THEME_KEY, theme); } catch(e){} }
  const commit = ()=>{
    root.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f3f5f6' : '#0e1316');
    const sel = document.getElementById('settingTheme');
    if (sel) sel.value = theme;
  };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (changing && !reduced && document.startViewTransition){
    // One GPU-composited cross-fade of the whole viewport — uniform and smooth,
    // unlike per-element colour transitions (which repaint hundreds of nodes and
    // stutter at uneven rates).
    document.startViewTransition(commit);
  } else if (changing && !reduced){
    // Fallback for browsers without View Transitions: scoped per-element cross-fade.
    root.classList.add('theme-anim');
    clearTimeout(applyTheme._t);
    applyTheme._t = setTimeout(()=>root.classList.remove('theme-anim'), 320);
    commit();
  } else {
    commit();
  }
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
const MODULE_LABELS = { tauc:'UV-Vis DRS', xrd:'XRPD', gc:'GC', epr:'EPR' };
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
  st.commit(true); // fresh baseline (silent: a restore is not a user edit → no autosave)
  // Plots just drawn may be sized wrong if the tab is hidden; redraw on show.
  if (_activeTab === mod){ if (_tabRedraw[mod]) requestAnimationFrame(()=>{ try { _tabRedraw[mod](); } catch(e){} }); }
  else { _needsRedraw[mod] = true; }
}
// Run cb once, the next time the module records a real change (edit/add/remove…).
function onModuleChangeOnce(mod, cb){
  const st = _histories[mod];
  if (st) st.onceCommit(cb);
}
// Persistent: fire cb on every real change commit of a module (used for autosave).
function onModuleChange(mod, cb){
  const st = _histories[mod];
  if (st) st.onCommit(cb);
}
// Temporarily load `state` into a module, run fn (e.g. build its CSV export from
// the loaded globals), then restore the previous state — all with history frozen
// so it doesn't commit, reset undo, or fire change listeners. Lets us export a
// saved project's CSVs without disturbing what's currently open.
function runWithModuleState(mod, state, fn){
  const st = _histories[mod];
  if (!st) return;
  const backup = st._snap();
  st._busy = true;
  try { st._restore(state); fn(); }
  finally { try { st._restore(backup); } finally { st._busy = false; } }
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
   NUMERIC INPUT VALIDATION FEEDBACK
   Values out of range are already clamped in the analysis code, but silently.
   These helpers correct the *displayed* value on blur and flash the field
   (reusing the .field-invalid red + shake animation) so the user notices.
========================================================= */
function flashFieldInvalid(el){
  el.classList.remove('field-invalid');
  void el.offsetWidth;                 // reflow so the shake animation restarts
  el.classList.add('field-invalid');
  clearTimeout(el._flashT);
  el._flashT = setTimeout(()=>el.classList.remove('field-invalid'), 450);
}
// Guard one input so it only ever commits a valid value: views update on confirm
// (blur / Enter), and any invalid entry (empty, non-numeric, out of range, or a
// non-integer where one is required) shakes the field and snaps it back to the
// last value that was successfully confirmed — never a live/partial update.
function guardNumericInput(el, opts){
  if (!el) return;
  const { min=null, max=null, integer=false, def=null } = opts || {};
  const parse = ()=>{ const v = parseFloat(String(el.value).trim().replace(',', '.')); return isFinite(v) ? v : NaN; };
  // Seed the "last confirmed" value from the field's initial (valid) content.
  const seed = parse();
  el._lastValid = isFinite(seed) ? seed : (def!=null ? def : (min!=null ? min : 0));
  // Re-seed on focus so programmatic value changes (session restore, param sync)
  // become the new revert target without every setter having to notify us.
  el.addEventListener('focus', ()=>{ const v = parse(); if (isFinite(v)) el._lastValid = v; });
  el.addEventListener('change', e=>{
    const raw = String(el.value).trim().replace(',', '.');
    const v = parseFloat(raw);
    const bad = raw==='' || !isFinite(v)
      || (integer && !Number.isInteger(v))
      || (min!=null && v<min) || (max!=null && v>max);
    if (bad){
      // Reject: shake, restore the last confirmed value, and keep the invalid
      // entry from reaching the module's own listeners (so views stay untouched).
      flashFieldInvalid(el);
      el.value = String(el._lastValid);
      e.stopImmediatePropagation();
      return;
    }
    el._lastValid = v;
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles:true })); // let input-based consumers re-read
  });
  el.addEventListener('keydown', e=>{ if (e.key==='Enter') el.blur(); });
}
// Auto-wire every <input type="number"> under root, reading bounds from its
// min/max attributes (step decides integer-ness). Covers most module fields.
function guardNumberInputs(root){
  (root || document).querySelectorAll('input[type="number"]').forEach(el=>{
    const min = el.getAttribute('min')!==null && el.min!=='' ? +el.min : null;
    const max = el.getAttribute('max')!==null && el.max!=='' ? +el.max : null;
    const stepAttr = el.getAttribute('step');
    const integer = !stepAttr || Number.isInteger(+stepAttr);
    const def = el.defaultValue!=='' && isFinite(+el.defaultValue) ? +el.defaultValue : (min!=null ? min : 0);
    guardNumericInput(el, { min, max, integer, def });
  });
}
// Apply to all number inputs present in the page (modals included).
guardNumberInputs(document);

/* =========================================================
   CUSTOM DATE-TIME FIELD  (GG/MM/AAAA hh:mm, 24h)
   Fully custom so no browser-native picker chrome appears anywhere. The field is
   made of individually focusable segments — Tab/Shift-Tab move one segment at a
   time, digits type in place, ↑/↓ increment. A calendar button opens an in-app
   modal styled like the rest of the UI.
========================================================= */
const DT_SEGS = [
  { key:'day',   len:2, min:1, max:31,   ph:'GG'   },
  { key:'month', len:2, min:1, max:12,   ph:'MM'   },
  { key:'year',  len:4, min:1900, max:2100, ph:'AAAA' },
  { key:'hour',  len:2, min:0, max:23,   ph:'hh'   },
  { key:'min',   len:2, min:0, max:59,   ph:'mm'   },
];
const DT_SEP = { day:'/', month:'/', year:' ', hour:':' }; // separator drawn after each segment
function dtDaysInMonth(y,m){ return new Date(y, m, 0).getDate(); } // m: 1-12
function createDateTimeField(initial, onChange){
  let val = { day:null, month:null, year:null, hour:null, min:null };
  const load = d => { if (d instanceof Date && !isNaN(d)) val = { day:d.getDate(), month:d.getMonth()+1, year:d.getFullYear(), hour:d.getHours(), min:d.getMinutes() }; };
  load(initial);

  const wrap = document.createElement('div');
  wrap.className = 'dt-field';
  const segEls = {};
  DT_SEGS.forEach(s=>{
    const el = document.createElement('span');
    el.className = 'dt-seg'; el.tabIndex = 0; el.dataset.seg = s.key;
    el.setAttribute('role','spinbutton'); el.setAttribute('aria-label', s.key);
    segEls[s.key] = el; wrap.appendChild(el);
    if (DT_SEP[s.key] != null){ const sep = document.createElement('span'); sep.className='dt-sep'; sep.textContent = DT_SEP[s.key]; wrap.appendChild(sep); }
  });
  const calBtn = document.createElement('button');
  calBtn.type='button'; calBtn.className='dt-cal-btn'; calBtn.tabIndex=-1; calBtn.setAttribute('aria-label','Open calendar');
  calBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2.5"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>';
  wrap.appendChild(calBtn);

  const pad = (n,l)=>String(n).padStart(l,'0');
  function render(){
    DT_SEGS.forEach(s=>{
      const v = val[s.key], el = segEls[s.key];
      if (v==null){ el.textContent = s.ph; el.classList.add('empty'); }
      else { el.textContent = pad(v, s.len); el.classList.remove('empty'); }
    });
  }
  function currentDate(){
    if (DT_SEGS.some(s=>val[s.key]==null)) return null;
    const d = Math.min(val.day, dtDaysInMonth(val.year, val.month));
    return new Date(val.year, val.month-1, d, val.hour, val.min, 0, 0);
  }
  function emit(){ const d = currentDate(); if (d) onChange(d); }

  const idxOf = k => DT_SEGS.findIndex(s=>s.key===k);
  const moveSeg = (k, dir)=>{ const i=idxOf(k)+dir; if (i>=0 && i<DT_SEGS.length) segEls[DT_SEGS[i].key].focus(); };
  let buf = '';
  DT_SEGS.forEach(s=>{
    const el = segEls[s.key];
    el.addEventListener('focus', ()=>{ buf=''; el.classList.add('sel'); });
    el.addEventListener('blur', ()=>{ el.classList.remove('sel'); emit(); });
    el.addEventListener('keydown', e=>{
      if (e.key>='0' && e.key<='9'){
        e.preventDefault();
        buf = (buf.length>=s.len ? e.key : buf + e.key);
        let n = parseInt(buf,10);
        if (n > s.max){ n = parseInt(e.key,10); buf = e.key; }
        val[s.key] = Math.max(s.min, n); render();
        if (buf.length>=s.len || n*10 > s.max){ buf=''; moveSeg(s.key,+1); }
      } else if (e.key==='ArrowUp' || e.key==='ArrowDown'){
        e.preventDefault();
        const step = e.key==='ArrowUp' ? 1 : -1;
        let v = (val[s.key]==null) ? (step>0? s.min : s.max) : val[s.key]+step;
        if (v > s.max) v = s.min; if (v < s.min) v = s.max;
        val[s.key]=v; buf=''; render(); emit();
      } else if (e.key==='ArrowLeft'){ e.preventDefault(); moveSeg(s.key,-1); }
      else if (e.key==='ArrowRight'){ e.preventDefault(); moveSeg(s.key,+1); }
      else if (e.key==='Backspace' || e.key==='Delete'){ e.preventDefault(); val[s.key]=null; buf=''; render(); }
      // Tab falls through to the browser (moves to the next focusable segment)
      e.stopPropagation(); // keep global arrow-nav / undo shortcuts from firing
    });
  });
  calBtn.addEventListener('click', ()=> openDateModal(currentDate() || new Date(), d=>{ load(d); render(); emit(); }));

  render();
  return { el: wrap, get: currentDate, set: d=>{ load(d); render(); } };
}

// In-app modal calendar (month grid + time steppers). Calls onPick(Date) on OK.
function openDateModal(baseDate, onPick){
  const view = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const sel = new Date(baseDate);
  const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop dt-modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal-box dt-modal'; backdrop.appendChild(modal);
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const WD = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  const p2 = n => String(n).padStart(2,'0');
  function build(){
    const y=view.getFullYear(), m=view.getMonth();
    let cells='';
    const startDow = (new Date(y,m,1).getDay()+6)%7;      // 0 = Monday
    const dim = dtDaysInMonth(y, m+1);
    const today = new Date();
    for (let i=0;i<startDow;i++) cells += '<span class="dt-day empty"></span>';
    for (let d=1; d<=dim; d++){
      const isSel = sel.getFullYear()===y && sel.getMonth()===m && sel.getDate()===d;
      const isToday = today.getFullYear()===y && today.getMonth()===m && today.getDate()===d;
      cells += `<button type="button" class="dt-day${isSel?' sel':''}${isToday?' today':''}" data-day="${d}">${d}</button>`;
    }
    modal.innerHTML = `
      <div class="dt-modal-head">
        <button type="button" class="dt-nav" data-nav="-1" aria-label="Previous month">&#8249;</button>
        <span class="dt-title">${MONTHS[m]} ${y}</span>
        <button type="button" class="dt-nav" data-nav="1" aria-label="Next month">&#8250;</button>
      </div>
      <div class="dt-grid dt-week">${WD.map(d=>`<span class="dt-wd">${d}</span>`).join('')}</div>
      <div class="dt-grid dt-days">${cells}</div>
      <div class="dt-time">
        <span class="dt-time-lbl">Time</span>
        <span class="dt-time-field"><button type="button" class="dt-step" data-t="h" data-d="1">&#9650;</button><b>${p2(sel.getHours())}</b><button type="button" class="dt-step" data-t="h" data-d="-1">&#9660;</button></span>
        <b class="dt-colon">:</b>
        <span class="dt-time-field"><button type="button" class="dt-step" data-t="m" data-d="1">&#9650;</button><b>${p2(sel.getMinutes())}</b><button type="button" class="dt-step" data-t="m" data-d="-1">&#9660;</button></span>
      </div>
      <div class="dt-modal-foot"><button type="button" class="btn dt-cancel">Cancel</button><button type="button" class="btn primary dt-ok">OK</button></div>`;
  }
  function close(){ document.removeEventListener('keydown', onKey); backdrop.remove(); }
  function onKey(e){ if (e.key==='Escape') close(); }
  build();
  modal.addEventListener('click', e=>{
    const nav = e.target.closest('.dt-nav');
    if (nav){ view.setMonth(view.getMonth() + (+nav.dataset.nav)); build(); return; }
    const day = e.target.closest('.dt-day');
    if (day && !day.classList.contains('empty')){ sel.setFullYear(view.getFullYear(), view.getMonth(), +day.dataset.day); build(); return; }
    const step = e.target.closest('.dt-step');
    if (step){ const d=+step.dataset.d;
      if (step.dataset.t==='h') sel.setHours((sel.getHours()+d+24)%24);
      else sel.setMinutes((sel.getMinutes()+d+60)%60);
      build(); return; }
    if (e.target.closest('.dt-cancel')){ close(); return; }
    if (e.target.closest('.dt-ok')){ onPick(new Date(sel)); close(); return; }
  });
  backdrop.addEventListener('click', e=>{ if (e.target===backdrop) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
}

/* =========================================================
   CONFIRM BANNER (in-site, non-native)
========================================================= */
// In-site replacement for window.confirm(): a top-centered banner reusing the
// PWA-toast styling. Returns a Promise<boolean> (true = confirmed).
// Only one banner is shown at a time; a second call cancels the first.
let _confirmBannerEl = null;
// Two-button banner by default: resolves true (confirm) / false (cancel or X).
// Passing altLabel adds a middle secondary button and turns it three-way, resolving
// 'alt' when that button is clicked (e.g. Save / Don't save / Cancel).
function confirmBanner(message, confirmLabel, altLabel){
  return new Promise(resolve=>{
    if (_confirmBannerEl){ _confirmBannerEl.remove(); _confirmBannerEl = null; }
    const t = document.createElement('div');
    t.className = 'pwa-toast pwa-confirm';
    t.setAttribute('role', 'alertdialog');
    t.setAttribute('aria-live', 'assertive');
    const msg = document.createElement('span'); msg.textContent = message;
    const ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'btn primary';
    ok.textContent = confirmLabel || 'Remove';
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'pwa-toast-x'; x.setAttribute('aria-label', 'Cancel');
    x.innerHTML = '&#10005;';
    t.appendChild(msg);
    let alt = null;
    if (altLabel){
      alt = document.createElement('button');
      alt.type = 'button'; alt.className = 'btn';
      alt.textContent = altLabel;
      t.appendChild(alt);
    }
    t.appendChild(ok); t.appendChild(x);
    document.body.appendChild(t);
    _confirmBannerEl = t;
    requestAnimationFrame(()=> t.classList.add('show'));
    const done = (val)=>{
      if (_confirmBannerEl !== t){ resolve(val); return; }
      _confirmBannerEl = null;
      document.removeEventListener('keydown', onKey);
      t.classList.remove('show');
      setTimeout(()=> t.remove(), 200);
      resolve(val);
    };
    const onKey = e=>{ if (e.key === 'Escape') done(false); };
    ok.addEventListener('click', ()=> done(true));
    if (alt) alt.addEventListener('click', ()=> done('alt'));
    x.addEventListener('click', ()=> done(false));
    document.addEventListener('keydown', onKey);
  });
}

/* =========================================================
   ALERT HELPERS
========================================================= */
// dismissInvalidAction / dismissWarnAction are data-action values handled by the
// owning tab's delegated click listener; when omitted, the button just removes its
// own alert inline (no global handler needed).
function buildAlertsHtml(invalidNames, warnNames, warnHeader, dismissInvalidAction, dismissWarnAction){
  const makeX = act => act
    ? `<button class="alert-dismiss is-danger" data-action="${act}" title="Dismiss">${X_SVG(13)}</button>`
    : `<button class="alert-dismiss is-danger" onclick="this.closest('.alert').remove()" title="Dismiss">${X_SVG(13)}</button>`;
  let html = '';
  if (invalidNames.length)
    html += '<div class="alert bad">✕ Invalid file(s):<br>' + invalidNames.join('<br>') + makeX(dismissInvalidAction) + '</div>';
  if (warnNames.length)
    html += '<div class="alert warn">⚠ ' + (warnHeader || 'Non-standard format — verify these files:') + '<br>' + warnNames.join('<br>') + makeX(dismissWarnAction) + '</div>';
  return html;
}

function nextColor(existingFiles){
  const used = new Set(existingFiles.map(f=>f.color));
  for (let i=0; i<COLORS.length*2; i++){ const c=colorOf(i); if (!used.has(c)) return c; }
  return colorOf(existingFiles.length);
}

/* Truncate a 30°-tilted bar-chart axis label (adding an ellipsis) so it fits both:
   • horizontally within one bar slot — `barSpacing/cos30` — i.e. the longest label
     that, at the plot's width, doesn't run past the y-axis line; and
   • vertically within a fixed fraction of the chart height — so every barplot caps
     labels to the SAME relative tilted height, whatever its size (mctx is a canvas
     2D context with the label font already set). */
const TILT_LABEL_HEIGHT_FRAC = 0.15;   // max tilted-label height as a fraction of the chart height
function truncTiltLabel(mctx, text, barSpacing, chartH){
  const cos30 = Math.cos(Math.PI/6), sin30 = Math.sin(Math.PI/6);
  const maxW = Math.min(barSpacing / cos30, TILT_LABEL_HEIGHT_FRAC * chartH / sin30);
  if (mctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && mctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/* =========================================================
   COLLAPSIBLE INSTRUCTIONS
   Each .instr-block is toggled by a small info icon placed next to the card's
   title. Always starts collapsed on load; the choice is not remembered.
========================================================= */
(function initInstrCollapse(){
  const INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/></svg>';
  document.querySelectorAll('.instr-block').forEach((block, i)=>{
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
    let collapsed = true;   // always start closed; the choice is not remembered
    const apply = ()=>{
      block.style.display = collapsed ? 'none' : '';
      btn.classList.toggle('is-on', !collapsed); // highlighted while instructions are shown
      btn.setAttribute('aria-expanded', String(!collapsed));
    };
    apply();
    btn.addEventListener('click', ()=>{ collapsed = !collapsed; apply(); });
  });
})();

export {
  COLORS, colorOf, CP_PRESETS, ColorPickerUI, colorPickerUI, CP_PALETTES, PalettePickerUI, palettePickerUI, settings, fmtNum, csvJoin, csvLine, downloadBlob, downloadBytes, downloadZip, zipBlob, makeDownloadLink, X_SVG, DL_SVG, parseNumber, detectDelim, splitCSVLine, setupDropzone, renderUnifiedFileList, linspace, interpLinear, movingAverage, gradientArr, cumtrapz, meanArr, stdArr, maxArr, minArr, fitLinear, betacf, logGamma, betainc, tcdf, tinv, VALID_TABS, goTab, setTabLoaded, moduleHasData, registerHistory, buildAlertsHtml, nextColor, MODULES, MODULE_LABELS, getModuleState, restoreModuleState, onModuleChangeOnce, onModuleChange, runWithModuleState, registerTabRedraw, redrawAll, registerCsvExport, runCsvExport, downloadCsvFiles, makeCsvButton, fitCsvIcons, applyTheme, currentTheme, guardNumericInput, createDateTimeField, flashFieldInvalid, truncTiltLabel, confirmBanner, normalizeProjIcons, refreshProjBar
};
