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
function toSeconds(v, unit){
  const u = String(unit || '').trim().toLowerCase();
  return /^(ms|milli)/.test(u) ? v/1000 : /^(µs|μs|us|micro)/.test(u) ? v/1e6 : /^min/.test(u) ? v*60 : v;
}

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

/* Monochromator crystals: the lattice (Å; hexagonal [a, c]) and the reflection used when
   the file names none. The polarisation ratio K = I_π/I_σ of one reflection at 2θ_M is
   cos²2θ_M for a mosaic crystal (kinematic: graphite, LiF) and |cos2θ_M| for a perfect one
   (dynamical: the Darwin width, and with it the integrated reflectivity, scales with the
   polarisation factor: Ge, Si, quartz; International Tables C §6.2.2). A bent Johansson
   crystal stays perfect: the planes turn by depth/radius ≈ 1 µm/0.4 m over an extinction
   depth, far below the Darwin width. Further reflections of a mosaic crystal multiply K;
   in a perfect channel-cut they repeat the same angle and leave it, and a second
   channel-cut set the other way (4 reflections, Bartels) squares it. A perfect crystal
   before the sample passes Kα1 alone: the Kα1–Kα2 separation (124″ at Ge 111) is about
   eight Darwin widths (16″). Lattices at room temperature: Ge 5.6579, Si 5.43102,
   LiF 4.0263, α-quartz 4.9134/5.4052, graphite 2.4612/6.7078 (d(002) 3.3539, the
   engine's default). */
// (A symbol stands alone, or after a count: "Ge(111)", "2xGe(220)", not "Edge" or "Slit".)
const sym = s => new RegExp(`(?:^|[^a-z]|\\dx)${s}(?![a-z])`, 'i');
const MONO_CRYSTALS = [
  { re: /quartz|sio2/i, name: 'quartz', hex: [4.9134, 5.4052], hkl: [1, 0, 1], perfect: true },
  { re: /graphite|hopg|pyrolytic|^\s*c\s*$/i, name: 'graphite', hex: [2.4612, 6.7078], hkl: [0, 0, 2], perfect: false },
  { re: new RegExp(sym('ge').source + '|germanium', 'i'), name: 'Ge', cubic: 5.6579, hkl: [1, 1, 1], perfect: true },
  { re: new RegExp(sym('si').source + '|silicon', 'i'), name: 'Si', cubic: 5.43102, hkl: [1, 1, 1], perfect: true },
  { re: sym('lif'), name: 'LiF', cubic: 4.0263, hkl: [2, 0, 0], perfect: false },
];
// A reflection written in a name or a crystal's text: "Ge(220)", "4xGe220", "Graphite (002)",
// "quartz (10-11)" (h k i l: i dropped).
const HKL_RE = /\(\s*(-?\d)\s*,?\s*(-?\d)\s*,?\s*(?:-?\d\s*,?\s*)?(-?\d)\s*\)|(?:ge|si)\s*(\d)(\d)(\d)(?!\d)/i;
// K of n reflections hkl of a crystal at λ; NaN when λ/2d ≥ 1.
function monoPolarisation(kind, hkl, n, lam){
  const [h, k, l] = hkl;
  const d = kind.cubic ? kind.cubic/Math.sqrt(h*h + k*k + l*l)
    : 1/Math.sqrt(4/3*(h*h + h*k + k*k)/(kind.hex[0]**2) + l*l/(kind.hex[1]**2));
  const st = lam/(2*d), tm = st > 0 && st < 1 ? 2*Math.asin(st) : NaN, c = Math.abs(Math.cos(tm));
  return { tm, K: kind.perfect ? (n >= 4 ? c*c : c) : Math.pow(c*c, n) };
}
// One monochromator element: its crystal, reflection and count from <crystal>, <hkl> and
// <numberOfReflections>, else from its name. A reflection that cannot diffract λ gives way
// to the crystal's usual one (`unreachable` names it); a crystal not recognised is taken
// as graphite (002), flagged `assumed`.
const COUNT_WORDS = { two: 2, double: 2, three: 3, four: 4 };
function readMonochromator(A, el, side, lam1){
  const name = A.attr(el, 'name') || '', crText = textOf(A, kid(A, el, 'crystal'));
  const hklEl = kid(A, el, 'hkl'), nEl = kid(A, el, 'numberOfReflections');
  let kind = MONO_CRYSTALS.find(c=> c.re.test(crText)) || MONO_CRYSTALS.find(c=> c.re.test(name)) || null;
  let hkl = hklEl ? ['h', 'k', 'l'].map(t=> numOf(A, kid(A, hklEl, t))) : null, hklGiven = true;
  if (!(hkl && hkl.every(Number.isFinite) && hkl.some(v=> v))){
    const m = (crText + ' ' + name).match(HKL_RE);
    hkl = m ? (m[1] !== undefined ? m.slice(1, 4) : m.slice(4, 7)).map(Number) : null;
  }
  if (!hkl && kind){ hkl = kind.hkl; hklGiven = false; }
  // the count: '2xGe(220)', '4-bounce', 'four-bounce', a Bartels (two channel-cuts: 4)
  let n = nEl ? Math.round(numOf(A, nEl)) : NaN;
  if (!(n >= 1)){
    const m = name.match(/(\d)\s*x\s*(?:ge|si|graphite|c\b)|(\d|two|double|three|four)[-\s]?(?:bounce|crystal|reflection)/i);
    n = m ? (m[1] ? +m[1] : +m[2] || COUNT_WORDS[m[2].toLowerCase()]) : /bartels/i.test(name) ? 4 : 1;
  }
  let p = kind && hkl ? monoPolarisation(kind, hkl, n, lam1) : null, assumed = false, unreachable = null;
  if (kind && !(p && Number.isFinite(p.tm))){
    unreachable = `${kind.name}(${hkl.join('')})`; hkl = kind.hkl; hklGiven = false;
    p = monoPolarisation(kind, hkl, n, lam1);
  }
  if (!(p && Number.isFinite(p.tm))){
    kind = MONO_CRYSTALS.find(c=> c.name === 'graphite'); hkl = kind.hkl; n = 1; assumed = true;
    p = monoPolarisation(kind, hkl, n, lam1);
  }
  return { side, name: name || null, crystal: kind.name + '(' + hkl.join('') + ')', given: crText || null,
    perfect: kind.perfect, reflections: n, hklGiven, assumed, unreachable, twoTheta: fin(p.tm/RAD), K: fin(p.K) };
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
  // A value outside (0, 10) Å is no X-ray wavelength (a unit slip: 154.06 with no unit);
  // the warning names it, rather than saying the file has none.
  const bad = [];
  const lam = name =>{
    const e = kid(A, wl, name), v = toAngstrom(numOf(A, e), unitOf(A, e));
    if (v > 0 && v < 10) return v;
    if (e && name !== 'kBeta' && A.text(e).trim()) bad.push(`${name} ${A.text(e).trim()}${unitOf(A, e) ? ' ' + unitOf(A, e) : ''}`);
    return NaN;
  };
  let lam1 = lam('kAlpha1'), lam2 = lam('kAlpha2'), kBeta = lam('kBeta');
  const noLam = what => bad.length ? `${bad.join(', ')} in the file, not a wavelength between 0 and 10 Å` : `No ${what} in the file`;
  let ratio = numOf(A, kid(A, wl, 'ratioKAlpha2KAlpha1'));
  const tube = find(A, inc, 'xRayTube');
  // The tube's name carries the anode too ("PW3373/10 Cu LFF"), for a file without <anodeMaterial>.
  let anode = textOf(A, kid(A, tube, 'anodeMaterial')) || (String(attrOf(A, tube, 'name') || '').match(/\b(Cu|Co|Mo|Cr|Fe|Ag|W|Rh)\b/) || [])[1] || null;
  if (anode) anode = anode[0].toUpperCase() + anode.slice(1).toLowerCase();
  if (!(lam1 > 0)){
    const known = ANODE_LINES[anode] ? anode : 'Cu', L = ANODE_LINES[known];
    [lam1, lam2, kBeta] = L; ratio = 0.5;
    warnings.push(`${noLam('wavelength')}: ${known} Kα assumed (Kα₁ ${L[0]} Å, Kα₂ ${L[1]} Å, Kα₂/Kα₁ 0.5)`
      + (anode && !ANODE_LINES[anode] ? ` (no line table for a ${anode} anode)` : ''));
  } else if (!(lam2 > 0)){
    // Kα1 alone: a monochromatic beam. λ2 = λ1 with a zero ratio adds nothing to the
    // pattern and leaves no consumer with an undefined second position.
    lam2 = lam1; ratio = 0;
    warnings.push(`${noLam('Kα₂')}: a single wavelength is modelled`);
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
  // <hybridMonochromator>…): its crystal, reflection and count (from its elements, else its
  // name) give the polarisation K for the LP factor, a crystal on each side the product.
  // The side matters for Kα2: a perfect crystal before the sample passes Kα1 alone.
  const monoD = find(A, dif, /monochromator/i), monoI = find(A, inc, /monochromator/i);
  const monoEl = monoD || monoI;
  const monos = [monoI && readMonochromator(A, monoI, 'incident', lam1), monoD && readMonochromator(A, monoD, 'diffracted', lam1)].filter(Boolean);
  const monoLabel = M => `${M.side === 'incident' ? 'Incident' : 'Diffracted'}-beam monochromator${M.name ? ` ("${M.name}")` : ''}`;
  for (const M of monos){
    if (M.assumed) warnings.push(`${monoLabel(M)}: crystal ${M.given ? `"${M.given}" ` : ''}not recognised, graphite (002) assumed for the polarisation (K = ${M.K.toFixed(3)})`);
    else if (M.unreachable) warnings.push(`${monoLabel(M)}: ${M.unreachable} cannot reflect λ = ${+lam1.toFixed(5)} Å, ${M.crystal} assumed for the polarisation (K = ${M.K.toFixed(3)})`);
    // (graphite reflects with its (002) alone: no doubt to report)
    else if (!M.hklGiven && M.crystal !== 'graphite(002)') warnings.push(`${monoLabel(M)}: no reflection given, ${M.crystal} assumed for the polarisation (K = ${M.K.toFixed(3)})`);
  }
  // A perfect crystal before the sample: Kα1 alone, whatever ratio the file gives.
  const perfectI = monos.find(M=> M.side === 'incident' && M.perfect && !M.assumed);
  if (perfectI && lam2 !== lam1 && ratio > 0){
    warnings.push(`${monoLabel(perfectI)}: ${perfectI.crystal} passes Kα₁ alone, so the file's Kα₂/Kα₁ ratio of ${ratio} is not used`);
    ratio = 0;
  }

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
  const countingTime = ctEl ? toSeconds(numOf(A, ctEl), unitOf(A, ctEl)) : NaN;
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
  // (a crystal not recognised before the sample: Kα2 kept, as the file says, but in doubt)
  const unknownI = monos.find(M=> M.side === 'incident' && M.assumed);
  if (unknownI && ratio > 0)
    warnings.push(`${monoLabel(unknownI)}: it usually passes Kα₁ alone, but the file gives a Kα₂/Kα₁ ratio of ${ratio} (check it)`);

  return {
    lam1, lam2, kBeta: fin(kBeta), ratio, anode, intended: attrOf(A, wl, 'intended'),
    radius, radiusDiffracted: fin(radiusD),
    divergence, antiScatter, soller, mask: fin(mask), filter,
    monochromator: !!monoEl, monoSide: monoD ? 'diffracted' : monoI ? 'incident' : null, monoName: attrOf(A, monoEl, 'name'),
    // K = I_π/I_σ of the monochromators together (the product of both sides'); each one's reading
    monoK: monos.length ? monos.reduce((k, M)=> k*M.K, 1) : undefined, monochromators: monos,
    detector, scan, sampleMode, countingTime: fin(countingTime), unit: attrOf(A, yEl, 'unit'),
    warnings,
  };
}

/* =========================================================
   THE SCAN: 2θ, the intensities and their variance (xrd.js's loader)
   2θ from the 2Theta <positions>: start and end (an even grid) or <listPositions>; a
   <commonPosition> alone means 2θ stood still (an ω or rocking scan): refused. The
   intensities: <intensities>, already on the unattenuated scale (the instrument multiplied
   the attenuated points by their factor when it wrote them), or the raw <counts> of XRDML
   2.x, multiplied here by the <beamAttenuationFactors>. var(y) = y·m, m the factor that
   turns one count into the units of y: the attenuation factor, over the counting time when
   y is a rate. Counts over unequal times (<countingTimes>: a pre-set-counts scan, whose
   counts sit about the preset at every point) make a pattern only as rates, so they are
   divided by their times. A rate with no counting time at all: the time is estimated from
   the noise, with a note.
   → { x, y, varMul (null when m is 1 throughout), unit, rate, mode, notes } or { error }.
========================================================= */
const listOf = (A, n)=> n ? A.text(n).trim().split(/\s+/).map(Number) : [];
// Intensities per second: cps, counts/s(ec), per second, s-1, s⁻¹, Hz. Up to v426 any '/s' or
// 'per' ('counts/step', 'percent'): counts read as a rate take one count as 1/t, which
// nothing catches for t > 1 s; on a 2-count background counted 10 s that put the background
// 1.7 counts low and B 2–4.6 esd off (corundum, ZnO). A rate the pattern misses errs as
// much, except beyond t = 2 s, where buildModel's noise check corrects it.
const RATE_UNIT = /cps|hz|(\/\s*|\bper\s*)s(ec(ond)?s?)?\b|\bs\s*\^?[-⁻][1¹]/i;
// The count scale m (one count in the units of y; 1/t for a rate) from the noise. For Poisson
// counts the second difference d = y₋ − 2y + y₊ has variance m·(μ₋ + 4μ + μ₊) ≈ 6m·ȳ, so
// d²/(6ȳ) is m times a χ²₁ variable, whose median is 0.4549. The median over the points
// ignores the peaks (where the curvature adds to d) as long as they hold fewer than half of
// them. (buildModel checks a pattern's stated count with it too.)
function noiseCountScale(y){
  const z = [];
  for (let i = 1; i < y.length - 1; i++){
    const s = (y[i-1] + y[i] + y[i+1])/3;
    if (s > 0) z.push((y[i-1] - 2*y[i] + y[i+1])**2/(6*s));
  }
  if (z.length < 10) return NaN;
  z.sort((a, b)=> a - b);
  return z[z.length >> 1]/0.454936;
}
function readScan(A, doc){
  const meas = A.name(doc) === 'xrdMeasurement' ? doc : find(A, doc, 'xrdMeasurement');
  const scan = meas && (kid(A, meas, 'scan') || find(A, meas, 'scan'));
  const dp = scan && (kid(A, scan, 'dataPoints') || find(A, scan, 'dataPoints'));
  if (!dp) return { error: 'no scan data' };
  const yEl = kid(A, dp, 'intensities') || kid(A, dp, 'counts');
  if (!yEl) return { error: 'no <intensities> or <counts>' };
  const raw = listOf(A, yEl), n = raw.length;
  if (n < 2) return { error: 'fewer than two points' };
  // 2θ
  let x = null, fixed = NaN, why = 'no 2θ positions';
  for (const p of A.kids(dp)){
    if (A.name(p) !== 'positions' || A.attr(p, 'axis') !== '2Theta') continue;
    const u = unitOf(A, p), s = kid(A, p, 'startPosition'), e = kid(A, p, 'endPosition'), lp = kid(A, p, 'listPositions'), cp = kid(A, p, 'commonPosition');
    if (s || e){
      const a = toDeg(numOf(A, s), u), b = toDeg(numOf(A, e), u);
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) x = Array.from({ length: n }, (_, i)=> a + (b - a)*i/(n - 1));
      else why = a === b ? `2θ starts and ends at ${a}°` : 'no valid 2θ start and end';
    } else if (lp){
      const v = listOf(A, lp).map(t=> toDeg(t, u));
      if (v.length === n && v.every(Number.isFinite)) x = v;
      else why = `${v.length} 2θ positions for ${n} intensities`;
    } else if (cp) fixed = toDeg(numOf(A, cp), u);
    break;
  }
  if (!x) return { error: Number.isFinite(fixed) ? `2θ fixed at ${fixed}° (a scan of another axis, not a powder pattern)` : why };
  // the counting times, in seconds
  const ctEl = kid(A, dp, 'commonCountingTime'), tsEl = kid(A, dp, 'countingTimes');
  let t = ctEl ? toSeconds(numOf(A, ctEl), unitOf(A, ctEl)) : NaN, ts = null;
  if (tsEl){
    const v = listOf(A, tsEl).map(s=> toSeconds(s, unitOf(A, tsEl)));
    if (v.length === n && v.every(s=> s > 0)){
      if (v.some(s=> Math.abs(s - v[0]) > 1e-9*v[0])) ts = v;
      else if (!(t > 0)) t = v[0];
    }
  }
  const mode = attrOf(A, scan, 'mode'), unit = A.attr(yEl, 'unit') || '', rate = RATE_UNIT.test(unit);
  const preset = /pre-?set\s*counts/i.test(mode || '');
  if (preset && !ts && !rate)
    return { error: 'a pre-set-counts scan without its per-point counting times (its counts are about the preset everywhere)' };
  const attIn = listOf(A, kid(A, dp, 'beamAttenuationFactors'));
  const att = attIn.length === n && attIn.every(v=> v > 0) ? attIn : null;
  const notes = [], isCounts = A.name(yEl) === 'counts';
  // (as rates the pattern is right; only the weights need each point's time)
  if (preset && !ts) notes.push(`a pre-set-counts scan in ${unit} without its per-point counting times: weighed as if every point were counted for the same time`);
  // Factors that cannot be used: raw counts would stay attenuated (refused); <intensities>
  // are right, only their variance is then the unattenuated one.
  if (attIn.length && !att){
    const why = attIn.length !== n ? `${attIn.length} attenuation factors for ${n} points` : 'attenuation factors that are not all positive numbers';
    if (isCounts) return { error: `raw <counts> with ${why}: the attenuated points cannot be corrected` };
    notes.push(`${why}: ignored, the attenuated points weighed as if counted unattenuated`);
  }
  const y = new Array(n), m = new Array(n);
  for (let i = 0; i < n; i++){
    const a = att ? att[i] : 1;
    y[i] = isCounts ? raw[i]*a : raw[i];
    m[i] = a;
    if (ts && !rate){ y[i] /= ts[i]; m[i] /= ts[i]; }
    else if (rate) m[i] = a/(ts ? ts[i] : t);
  }
  if (ts && !rate) notes.push(`counts over unequal counting times${mode ? ` (${mode})` : ''}: loaded as counts per second`);
  if (rate && !ts && !(t > 0)){
    const s = noiseCountScale(y);
    if (s > 0){
      for (let i = 0; i < n; i++) m[i] = (att ? att[i] : 1)*s;
      notes.push(`intensities in ${unit} with no counting time: ${+(1/s).toPrecision(3)} s per point estimated from the noise, for the weights`);
    } else return { error: `intensities in ${unit} with no counting time, and none could be estimated` };
  }
  const varMul = m.some(v=> v !== 1) ? m : null;
  return { x, y, varMul, unit, rate: rate || !!ts, mode, notes };
}

/* =========================================================
   ENTRY POINTS
========================================================= */
// A parsed DOM Document (DOMParser, 'text/xml'), its root, or the <xrdMeasurement> element.
function readXrdmlInstrument(xmlDoc){
  if (!xmlDoc) return null;
  return readInstrument(DOM_ACCESS, xmlDoc);
}

/* The text of an XML file from its bytes, its encoding found as the XML specification's
   appendix F says: a byte-order mark (UTF-8, UTF-16 LE or BE), else UTF-16 by the zero
   byte beside each of the first two characters ('<' 00 '?' 00), else the declaration's
   encoding="…", else UTF-8. Bytes that read as ASCII cannot be UTF-16, so a declared
   UTF-16 is then ignored (a UTF-8 file written from a .NET string declares it).
   (Blob.text() and a bare TextDecoder decode UTF-8 alone.) */
function decodeXml(bytes){
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let enc = 'utf-8';
  if (b[0] === 0xff && b[1] === 0xfe || b[0] && b[1] === 0 && b[2] && b[3] === 0) enc = 'utf-16le';
  else if (b[0] === 0xfe && b[1] === 0xff || b[0] === 0 && b[1] && b[2] === 0 && b[3]) enc = 'utf-16be';
  else if (!(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf)){
    const head = String.fromCharCode(...b.subarray(0, 200));
    const m = /^\s*<\?xml[^>]*\bencoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(head);
    if (m && !/^(utf-?(16|32)|ucs-?[24])/i.test(m[1])) enc = m[1];
  }
  try { return new TextDecoder(enc).decode(b); }
  catch(e){ return new TextDecoder('utf-8').decode(b); }   // an encoding the engine does not know
}
const asText = t => t instanceof ArrayBuffer || ArrayBuffer.isView(t) ? decodeXml(t instanceof ArrayBuffer ? new Uint8Array(t) : new Uint8Array(t.buffer, t.byteOffset, t.byteLength)) : t;
const isXrdml = t => typeof t === 'string' && /<(?:[\w.-]+:)?xrdMeasurement[\s>]/.test(t);

// The raw file: a string, or its bytes (any encoding decodeXml finds).
function readXrdmlInstrumentText(text){
  text = asText(text);
  if (!isXrdml(text)) return null;
  return readInstrument(LITE_ACCESS, parseXmlLite(text));
}
// The scan (readScan): from a parsed DOM Document, or from the raw file.
function readXrdmlScan(xmlDoc){
  return xmlDoc ? readScan(DOM_ACCESS, xmlDoc) : { error: 'no document' };
}
function readXrdmlScanText(text){
  text = asText(text);
  return isXrdml(text) ? readScan(LITE_ACCESS, parseXmlLite(text)) : { error: 'not an .xrdml file' };
}

export { readXrdmlInstrument, readXrdmlInstrumentText, readXrdmlScan, readXrdmlScanText, decodeXml, noiseCountScale };
