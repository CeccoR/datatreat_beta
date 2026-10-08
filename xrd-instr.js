/* =========================================================
   XRD INSTRUMENT (Rietveld)
   The instrument as a PANalytical .xrdml header describes it: wavelengths and the
   Kα2/Kα1 ratio, goniometer radius, slits, filter or monochromator, detector, scan.
   The Rietveld model takes λ, the ratio, the radius and the monochromator from here;
   the warnings say when a value had to be assumed, or when the file describes a
   geometry the model does not handle (transmission, an uncoupled scan, an automatic
   slit). Two entry points, one field logic:
   - readXrdmlInstrument(doc): a parsed Document (the page has DOMParser);
   - readXrdmlInstrumentText(text): the raw file (Node, a Worker), through a small
     tolerant XML reader.
   The logic sees the tree only through a five-function accessor, so the two cannot
   drift apart. No DOM required. Not an .xrdml → null.
   Numbers the file does not give are left undefined (not null, not NaN), so isFinite,
   `??` and `||` all read them as missing.
========================================================= */

const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const RAD = Math.PI/180;

// [Kα1, Kα2, Kβ] in Å, for a file that names its anode but carries no <usedWavelength>:
// Cu exactly as X'Pert Data Collector writes it, the others the usual tabulated values
// (Bearden, Rev. Mod. Phys. 39 (1967) 78). With no anode either, Cu — by far the
// commonest laboratory tube.
const ANODE_LINES = {
  Cu: [1.540598, 1.544426, 1.392250],
  Co: [1.788965, 1.792850, 1.620790],
  Mo: [0.709300, 0.713590, 0.632288],
  Cr: [2.289700, 2.293606, 2.084870],
  Fe: [1.936042, 1.939980, 1.756610],
  Ag: [0.559407, 0.563798, 0.497069],
};

// ---- numbers and units ----
// A decimal from the file; a decimal comma is tolerated (hand-edited or localised exports).
function num(s){
  const t = s == null ? '' : String(s).trim();
  if (!t) return NaN;
  return Number(/^[-+]?\d*,\d+$/.test(t) ? t.replace(',', '.') : t);
}
const fin = v => Number.isFinite(v) ? v : undefined;
const NUM_RE = '(\\d+(?:[.,]\\d+)?)';
function toMm(v, unit){
  const u = String(unit || 'mm').trim().toLowerCase();
  return u === 'um' || u === 'µm' || u === 'μm' ? v/1000 : u === 'cm' ? v*10 : u === 'm' ? v*1000 : v;
}
function toAngstrom(v, unit){
  const u = String(unit || '').trim().toLowerCase();
  return u === 'nm' ? v*10 : u === 'pm' ? v/100 : v;
}
const toDeg = (v, unit)=> /^rad/i.test(String(unit || '').trim()) ? v/RAD : v;
const toRad = (v, unit)=> /^(deg|°)/i.test(String(unit || '').trim()) ? v*RAD : v;

// An angle in a component's name: "Slit Fixed 1/2°" → 0.5, "1/4°", "1°", "0.5 deg".
// PANalytical names fixed slits this way and gives only their height in mm, so the name
// is the one place the nominal angle is written.
const DEG_IN_NAME = new RegExp(NUM_RE + '(?:\\s*/\\s*' + NUM_RE + ')?\\s*Â?(?:°|º|˚|deg(?:rees?)?\\b)', 'i');
function degFromName(name){
  const m = String(name || '').match(DEG_IN_NAME);
  if (!m) return NaN;
  const a = num(m[1]), b = m[2] ? num(m[2]) : 1;
  return b > 0 ? a/b : NaN;
}
function mmFromName(name){
  const m = String(name || '').match(new RegExp(NUM_RE + '\\s*mm\\b', 'i'));
  return m ? num(m[1]) : NaN;
}

/* =========================================================
   ACCESSORS
   kids: element children; name: local name (XRDML puts every element in a default
   namespace, without prefixes); attr: a plain attribute or null; xsiType: the xsi:type
   attribute, whatever prefix the file bound to the XML-Schema-instance namespace;
   text: the text content.
========================================================= */
const DOM_ACCESS = {
  kids: n => n.children ? Array.from(n.children) : Array.from(n.childNodes || []).filter(c=> c.nodeType === 1),
  name: n => n.localName || String(n.nodeName || '').replace(/^.*:/, ''),
  attr: (n, a)=> n.getAttribute ? n.getAttribute(a) : null,
  // getAttributeNS answers '' rather than null in older engines, hence the ||.
  xsiType: n => !n.getAttribute ? null : (n.getAttributeNS && n.getAttributeNS(XSI, 'type')) || n.getAttribute('xsi:type'),
  text: n => n.textContent || '',
};

const liteText = n => n.kids.length ? n.parts.join('') + n.kids.map(liteText).join('') : n.parts.join('');
const LITE_ACCESS = {
  kids: n => n.kids,
  name: n => n.name,
  attr: (n, a)=> Object.prototype.hasOwnProperty.call(n.attrs, a) ? n.attrs[a] : null,
  xsiType(n){
    for (const k in n.attrs){
      const i = k.indexOf(':');
      if (i > 0 && k.slice(i+1) === 'type' && n.ns[k.slice(0, i)] === XSI) return n.attrs[k];
    }
    return LITE_ACCESS.attr(n, 'xsi:type');
  },
  text: liteText,
};

/* The small XML reader: elements, attributes, text and CDATA; comments, processing
   instructions and the DOCTYPE skipped; the predefined entities and character references
   decoded; namespace prefixes tracked only so xsi:type can be found under another prefix.
   Tolerant — a stray end tag closes back to its element or is ignored — because a header
   half-read beats none. It stops at the end of the first <xrdMeasurement>: the later
   measurements of a multi-scan file are never tokenised. */
const ENTITIES = { lt:'<', gt:'>', amp:'&', quot:'"', apos:"'" };
function decode(s){
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e)=>{
    const k = e.toLowerCase();
    if (k[0] !== '#') return ENTITIES[k];
    const c = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return c >= 0 && c <= 0x10ffff ? String.fromCodePoint(c) : m;
  });
}
const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<[?!][^>]*>|<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const ATTR = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
function parseXmlLite(text){
  const doc = { name:'#document', attrs:{}, ns:{}, kids:[], parts:[] };
  const stack = [doc], re = new RegExp(TOKEN.source, 'g');
  let last = 0, m;
  while ((m = re.exec(text))){
    const top = stack[stack.length-1];
    if (m.index > last) top.parts.push(decode(text.slice(last, m.index)));
    last = re.lastIndex;
    if (m[1] !== undefined){ top.parts.push(m[1]); continue; }
    if (!m[3]) continue;
    const local = m[3].replace(/^.*:/, '');
    if (m[2]){
      let i = stack.length-1;
      while (i > 0 && stack[i].name !== local) i--;
      if (i > 0){ stack.length = i; if (local === 'xrdMeasurement') break; }
      continue;
    }
    const attrs = {};
    let ns = top.ns, own = null;
    for (const a of m[4].matchAll(ATTR)){
      const v = decode(a[2] !== undefined ? a[2] : a[3]);
      attrs[a[1]] = v;
      if (a[1].startsWith('xmlns:')) (own || (own = { ...ns }))[a[1].slice(6)] = v;
    }
    const el = { name: local, attrs, ns: own || ns, kids: [], parts: [] };
    top.kids.push(el);
    if (!m[5]) stack.push(el);
  }
  return doc;
}

/* =========================================================
   FIELD LOGIC (shared)
========================================================= */
function kid(A, n, name){
  if (!n) return null;
  for (const c of A.kids(n)) if (A.name(c) === name) return c;
  return null;
}
// Depth-first, the first element under n whose local name is `test` (or passes it, a RegExp).
function find(A, n, test){
  if (!n) return null;
  for (const c of A.kids(n)){
    const nm = A.name(c);
    if (typeof test === 'string' ? nm === test : test.test(nm)) return c;
    const d = find(A, c, test);
    if (d) return d;
  }
  return null;
}
const textOf = (A, n)=> n ? A.text(n).trim() : '';
const numOf = (A, n)=> n ? num(A.text(n)) : NaN;
const unitOf = (A, n)=> (n && A.attr(n, 'unit')) || '';
const attrOf = (A, n, a)=> (n && A.attr(n, a)) || null;

/* A slit: its kind from xsi:type (fixedDivergenceSlitType, programmable…, automatic…),
   else from its name; its nominal angle from the name ("Slit Fixed 1/2°"), from an
   element given in degrees, or from its height at a known distance; its opening (height)
   in mm. A constant irradiated length means automatic operation whatever the hardware
   is called — the opening then follows θ, so there is no single angle, and mm holds the
   irradiated length instead. */
function readSlit(A, el){
  if (!el) return null;
  const name = A.attr(el, 'name') || '', xsiType = A.xsiType(el) || '';
  let deg = degFromName(name), height = NaN, irr = NaN, dist = NaN;
  for (const c of A.kids(el)){
    const nm = A.name(c), u = unitOf(A, c), v = numOf(A, c);
    if (!Number.isFinite(v)) continue;
    if (/irradiated/i.test(nm)) irr = toMm(v, u);
    else if (/distance/i.test(nm)) dist = toMm(v, u);
    else if (/^(deg|°|rad)/i.test(u)){ if (!Number.isFinite(deg)) deg = toDeg(v, u); }
    else if (nm === 'height' && !Number.isFinite(height)) height = toMm(v, u);
  }
  if (!Number.isFinite(height)) height = mmFromName(name);
  if (!Number.isFinite(deg) && height > 0 && dist > 0) deg = 2*Math.atan(height/(2*dist))/RAD;
  let type = /automatic/i.test(xsiType) ? 'automatic' : /programmable/i.test(xsiType) ? 'programmable'
    : /fixed/i.test(xsiType) ? 'fixed'
    : /auto/i.test(name) ? 'automatic' : /programm/i.test(name) ? 'programmable'
    : /fix/i.test(name) || Number.isFinite(deg) ? 'fixed' : null;
  if (irr > 0 && type !== 'fixed') type = 'automatic';
  const auto = type === 'automatic';
  return { type, deg: auto ? undefined : fin(deg), mm: fin(auto ? irr : height), name: name || null,
    xsiType: xsiType || null, irradiatedLength: fin(irr) };
}

// A Soller slit's opening in rad: the <opening> element, else the name ("Soller 0.04 rad.").
function readSoller(A, el){
  if (!el) return undefined;
  const o = kid(A, el, 'opening');
  let v = o ? toRad(numOf(A, o), unitOf(A, o)) : NaN;
  if (!Number.isFinite(v)){ const m = String(A.attr(el, 'name') || '').match(new RegExp(NUM_RE + '\\s*rad', 'i')); if (m) v = num(m[1]); }
  return fin(v);
}

function readInstrument(A, doc){
  const meas = A.name(doc) === 'xrdMeasurement' ? doc : find(A, doc, 'xrdMeasurement');
  if (!meas) return null;
  const warnings = [];
  const inc = kid(A, meas, 'incidentBeamPath'), dif = kid(A, meas, 'diffractedBeamPath');

  // ---- wavelengths: λ, the Kα2/Kα1 ratio, and the anode they come from ----
  const wl = kid(A, meas, 'usedWavelength');
  const lam = name =>{ const e = kid(A, wl, name), v = toAngstrom(numOf(A, e), unitOf(A, e)); return v > 0 && v < 10 ? v : NaN; };
  let lam1 = lam('kAlpha1'), lam2 = lam('kAlpha2'), kBeta = lam('kBeta');
  let ratio = numOf(A, kid(A, wl, 'ratioKAlpha2KAlpha1'));
  const tube = find(A, inc, 'xRayTube');
  // The tube's name carries the anode too ("PW3373/10 Cu LFF"), for a file without <anodeMaterial>.
  let anode = textOf(A, kid(A, tube, 'anodeMaterial')) || (String(attrOf(A, tube, 'name') || '').match(/\b(Cu|Co|Mo|Cr|Fe|Ag|W|Rh)\b/) || [])[1] || null;
  if (anode) anode = anode[0].toUpperCase() + anode.slice(1).toLowerCase();
  if (!(lam1 > 0)){
    const known = ANODE_LINES[anode] ? anode : 'Cu', L = ANODE_LINES[known];
    [lam1, lam2, kBeta] = L; ratio = 0.5;
    warnings.push(`No wavelength in the file: ${known} Kα assumed (Kα₁ ${L[0]} Å, Kα₂ ${L[1]} Å, Kα₂/Kα₁ 0.5)`
      + (anode && !ANODE_LINES[anode] ? ` (no line table for a ${anode} anode)` : ''));
  } else if (!(lam2 > 0)){
    // Kα1 alone: a monochromatic beam. λ2 = λ1 with a zero ratio adds nothing to the
    // pattern and leaves no consumer with an undefined second position.
    lam2 = lam1; ratio = 0;
    warnings.push('No Kα₂ in the file: a single wavelength is modelled');
  } else if (!(ratio >= 0 && ratio <= 1)){
    warnings.push(`${Number.isFinite(ratio) ? `Kα₂/Kα₁ ratio ${ratio} out of range` : 'No Kα₂/Kα₁ ratio in the file'}: 0.5 assumed`);
    ratio = 0.5;
  }

  // ---- goniometer radius (mm): the specimen displacement in mm is read through it ----
  const radOf = e =>{ const v = toMm(numOf(A, e), unitOf(A, e)); return v > 0 ? v : NaN; };
  const radiusD = radOf(kid(A, dif, 'radius'));
  let radius = radOf(kid(A, inc, 'radius'));
  if (!(radius > 0)) radius = radiusD;
  if (!(radius > 0)){ radius = 240; warnings.push('No goniometer radius in the file: 240 mm assumed (the specimen displacement in mm depends on it)'); }

  // ---- optics ----
  const divEl = find(A, inc, 'divergenceSlit');
  const divergence = readSlit(A, divEl) || { type: null, deg: undefined, mm: undefined, name: null, xsiType: null, irradiatedLength: undefined };
  const antiScatter = { incident: readSlit(A, find(A, inc, 'antiScatterSlit')), diffracted: readSlit(A, find(A, dif, 'antiScatterSlit')) };
  const soller = { incident: readSoller(A, find(A, inc, 'sollerSlit')), diffracted: readSoller(A, find(A, dif, 'sollerSlit')) };
  const maskEl = find(A, inc, 'mask'), maskW = kid(A, maskEl, 'width');
  let mask = maskW ? toMm(numOf(A, maskW), unitOf(A, maskW)) : NaN;
  if (maskEl && !Number.isFinite(mask)) mask = mmFromName(A.attr(maskEl, 'name'));
  const fEl = find(A, dif, 'filter') || find(A, inc, 'filter'), fT = kid(A, fEl, 'thickness');
  const filter = fEl ? { material: textOf(A, kid(A, fEl, 'material')) || null, thickness: fin(fT ? toMm(numOf(A, fT), unitOf(A, fT)) : NaN),
    name: attrOf(A, fEl, 'name') } : null;
  // Any monochromator element counts (<diffractedBeamMonochromator>, <monochromator>,
  // <hybridMonochromator>…): its polarisation enters the LP factor. The side matters for
  // Kα2 — an incident-beam crystal usually passes Kα1 alone, a diffracted-beam one does not.
  const monoD = find(A, dif, /monochromator/i), monoI = find(A, inc, /monochromator/i);
  const monoEl = monoD || monoI;

  // ---- detector ----
  const detEl = find(A, dif, 'detector'), alEl = kid(A, detEl, 'activeLength');
  let activeLength = alEl ? numOf(A, alEl) : NaN;
  // An active length in mm is an angle at the detector's radius.
  activeLength = /^mm$/i.test(unitOf(A, alEl)) ? activeLength/(radiusD > 0 ? radiusD : radius)/RAD : toDeg(activeLength, unitOf(A, alEl));
  const detector = { name: attrOf(A, detEl, 'name'), type: (detEl && A.xsiType(detEl)) || null,
    mode: textOf(A, kid(A, detEl, 'mode')) || null, activeLength: fin(activeLength) };

  // ---- the (first) scan ----
  const scanEl = kid(A, meas, 'scan'), dp = kid(A, scanEl, 'dataPoints');
  const ctEl = kid(A, dp, 'commonCountingTime');
  let countingTime = ctEl ? numOf(A, ctEl) : NaN;
  if (/^ms/i.test(unitOf(A, ctEl))) countingTime /= 1000;
  const yEl = kid(A, dp, 'intensities') || kid(A, dp, 'counts');
  const scan = { mode: attrOf(A, scanEl, 'mode'), axis: attrOf(A, scanEl, 'scanAxis') };
  const sampleMode = A.attr(meas, 'sampleMode') || null;

  // ---- what the Bragg–Brentano model cannot take at face value ----
  // (Warnings are fragments with no full stop and no inner semicolon: the card joins them with '; '.)
  if (sampleMode && !/^reflection$/i.test(sampleMode))
    warnings.push(`Sample mode "${sampleMode}": the model is Bragg–Brentano reflection, whose Lorentz–polarisation and displacement terms do not hold here`);
  if (scan.axis && !/^gonio$/i.test(scan.axis))
    warnings.push(`Scan axis "${scan.axis}": the model assumes a coupled θ–2θ (Gonio) scan, which Bragg–Brentano focusing needs`);
  if (divergence.type === 'automatic')
    warnings.push(`Automatic divergence slit${divergence.irradiatedLength ? ` (irradiated length ${divergence.irradiatedLength} mm)` : ''}: the intensities grow as sinθ against a fixed slit, which the model does not correct yet (the data need dividing by sinθ)`);
  else if (divergence.type === 'programmable')
    warnings.push(`Programmable divergence slit with no irradiated length in the file: modelled as a fixed slit${divergence.deg ? ` of ${+divergence.deg.toFixed(4)}°` : ''} (if it ran in automatic mode, the data need dividing by sinθ)`);
  else if (!divergence.type)
    warnings.push(divEl ? `Divergence slit of unknown kind${divergence.name ? ` ("${divergence.name}")` : ''}: a fixed slit is assumed` : 'No divergence slit in the file: a fixed slit is assumed');
  if (monoI && !monoD && ratio > 0)
    warnings.push(`Incident-beam monochromator${attrOf(A, monoI, 'name') ? ` ("${attrOf(A, monoI, 'name')}")` : ''}: it usually passes Kα₁ alone, but the file gives a Kα₂/Kα₁ ratio of ${ratio} (check it)`);

  return {
    lam1, lam2, kBeta: fin(kBeta), ratio, anode, intended: attrOf(A, wl, 'intended'),
    radius, radiusDiffracted: fin(radiusD),
    divergence, antiScatter, soller, mask: fin(mask), filter,
    monochromator: !!monoEl, monoSide: monoD ? 'diffracted' : monoI ? 'incident' : null, monoName: attrOf(A, monoEl, 'name'),
    detector, scan, sampleMode, countingTime: fin(countingTime), unit: attrOf(A, yEl, 'unit'),
    warnings,
  };
}

/* =========================================================
   ENTRY POINTS
========================================================= */
// A parsed DOM Document (DOMParser, 'text/xml'), its root, or the <xrdMeasurement> element.
function readXrdmlInstrument(xmlDoc){
  if (!xmlDoc) return null;
  return readInstrument(DOM_ACCESS, xmlDoc);
}

// The raw file: a string, or its bytes (UTF-8, or UTF-16 with a byte-order mark).
function readXrdmlInstrumentText(text){
  if (text instanceof ArrayBuffer) text = new Uint8Array(text);
  if (text instanceof Uint8Array){
    const le = text[0] === 0xff && text[1] === 0xfe, be = text[0] === 0xfe && text[1] === 0xff;
    text = new TextDecoder(le ? 'utf-16le' : be ? 'utf-16be' : 'utf-8').decode(text);
  }
  if (typeof text !== 'string' || !/<(?:[\w.-]+:)?xrdMeasurement[\s>]/.test(text)) return null;
  return readInstrument(LITE_ACCESS, parseXmlLite(text));
}

export { readXrdmlInstrument, readXrdmlInstrumentText };
