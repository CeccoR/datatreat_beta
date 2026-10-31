/* =========================================================
   XRD SHARED NUMERICS — the small numerics and number formats the XRPD modules share:
   Gauss–Legendre nodes, a bisection, a 3×3 inverse (in two forms); Miller indices, esds
   and angles as text. Up to v479 each module had its own copy of them (the 3×3 inverse
   nine times, Miller indices with three different minus signs).
   Pure functions: no DOM, importable by the page, a Worker and Node.
========================================================= */

/* ---------- quadratures ---------- */
// Gauss–Legendre nodes t and weights w of order n on [−1, 1], by Newton's method on P_n,
// kept per n (xrd-rietveld's FCJ nodes, xrd-broad's log-normal averages): the most recently
// used, up to GL_KEEP nodes in all (16 bytes a node: 16 MB). A pass holds its lines' counts
// (4 to 4000 nodes each), so it asks for the same few orders at every calc: 12 orders, 144
// nodes, over a standard and five samples without Sollers; sharp lines under a large
// asymmetry, 25–505 orders, up to 570 000 nodes (a monoclinic cell at (S + H)/L 0.2), whose
// first calc takes 30 s and the next 0.5 s, from here. Up to v486 every order ever asked for
// was kept, in a worker that lives as long as its card: up to 8 million nodes (128 MB).
const GL_CACHE = new Map(), GL_KEEP = 1 << 20;
let glHeld = 0;
function gaussLegendre(n){
  let g = GL_CACHE.get(n);
  // (the latest at the end of the map's order: the oldest goes first)
  if (g){ GL_CACHE.delete(n); GL_CACHE.set(n, g); return g; }
  const t = new Float64Array(n), w = new Float64Array(n);
  for (let i = 0; i < n; i++){
    let z = Math.cos(Math.PI*(i + 0.75)/(n + 0.5)), dp = 1;
    for (let it = 0; it < 100; it++){
      let p0 = 1, p1 = 0;
      for (let j = 1; j <= n; j++){ const p2 = p1; p1 = p0; p0 = ((2*j - 1)*z*p1 - (j - 1)*p2)/j; }
      dp = n*(z*p0 - p1)/(z*z - 1);
      const dz = p0/dp; z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    t[i] = z; w[i] = 2/((1 - z*z)*dp*dp);
  }
  g = { t, w }; GL_CACHE.set(n, g); glHeld += n;
  while (glHeld > GL_KEEP && GL_CACHE.size > 1){ const k = GL_CACHE.keys().next().value; glHeld -= k; GL_CACHE.delete(k); }
  return g;
}

/* ---------- small numerics ---------- */
// First index with x[i] ≥ v (x ascending).
function lowerBound(x, v){
  let lo = 0, hi = x.length;
  while (lo < hi){ const mid = (lo + hi) >> 1; if (x[mid] < v) lo = mid + 1; else hi = mid; }
  return lo;
}
// The determinant and the inverse of a 3×3 matrix (row-major array of 9), by cofactors.
function det3(m){
  return m[0]*(m[4]*m[8]-m[5]*m[7]) - m[1]*(m[3]*m[8]-m[5]*m[6]) + m[2]*(m[3]*m[7]-m[4]*m[6]);
}
function inv3(m){
  const d = det3(m);
  return [
    (m[4]*m[8]-m[5]*m[7])/d, (m[2]*m[7]-m[1]*m[8])/d, (m[1]*m[5]-m[2]*m[4])/d,
    (m[5]*m[6]-m[3]*m[8])/d, (m[0]*m[8]-m[2]*m[6])/d, (m[2]*m[3]-m[0]*m[5])/d,
    (m[3]*m[7]-m[4]*m[6])/d, (m[1]*m[6]-m[0]*m[7])/d, (m[0]*m[4]-m[1]*m[3])/d,
  ];
}
// The same inverse as the engine has always written it (xrd-rietveld's frames and shapes,
// xrd-broad's fault tables, the worker's strain planes): a cofactor's minus sign outside
// its difference, −(b·i − c·h), where inv3 (the cell metric, the symmetry search) swaps
// the terms, c·h − b·i. The two agree but in the sign of an exact zero: −0 here, +0
// there. Nothing shown depends on that sign (String, toFixed and JSON print both as 0);
// each keeps its own form so that no output changes bit for bit (one form for both turns
// −0 to +0, or back, in the shapes' cells and axes or in the metric's Gs and Bm).
function inv3n(m){
  const [a, b, c, d, e, f, g, h, i] = m, A = e*i - f*h, Bc = -(d*i - f*g), C = d*h - e*g, det = a*A + b*Bc + c*C;
  return [A/det, -(b*i - c*h)/det, (b*f - c*e)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e - b*d)/det];
}

/* ---------- numbers as text ---------- */
// Miller indices or a direction, [1, -1, 0] → '1-10': a negative index with an ASCII
// minus, as the settings' fault families and the shapes' directions have always written
// it (the 3D view draws it as a bar over the index); with an index of two digits, the
// three apart ('1 -1 11'), or (1, -1, 11) and (1, -11, 1) would read alike. Up to v479
// the results' faults, texture and strain lines had '−' (U+2212), and the peak-widths
// table, the Williamson–Hall plot and the order tests a bar (U+0305) over the last digit
// (−12 read 12̅, as 1 and −2 would).
const hklText = t => t.some(x=> x <= -10 || x >= 10) ? t.join(' ') : t.map(x=> x < 0 ? '-' + (-x) : String(x)).join('');

// 3.9151(8): the value to the esd's first significant digit (two when that digit is
// 1), the esd in brackets in units of the last digit shown. The esd is rounded first:
// one rounded up to the next leading digit keeps one digit (0.0096 gives 1.50(1), not
// 1.500(10)); a last digit left of the units rounds the value there (100(300), not
// 125(314)). An esd under 10⁻¹⁵ of the value is below what a double holds (and past
// 100 decimals toFixed throws): the value alone, as without an esd — six significant
// digits (up to v479 the peak-widths table and its tests gave four). Number.isFinite: a
// NaN saved with a project comes back as null, which the global isFinite takes for 0 (and
// null.toPrecision throws).
function fmtEsd(v, e, unit = ''){
  if (!Number.isFinite(v)) return '—';
  const p = Math.floor(Math.log10(e)), n = e/Math.pow(10, p) < 2 ? 2 : 1;
  if (!(Number.isFinite(e) && e > 1e-15*Math.abs(v)) || n - 1 - p > 100) return (+v.toPrecision(6)).toString() + unit;
  let d = n - 1 - p, k = Math.round(e*Math.pow(10, d));
  if (k >= (n === 2 ? 20 : 10)){ k = Math.round(k/10); d--; }
  if (d >= 0) return v.toFixed(d) + '(' + k + ')' + unit;
  const s = Math.pow(10, -d);
  return String(Math.round(v/s)*s) + '(' + k*s + ')' + unit;
}

// An angular esd in degrees, as the results and the 3D view's labels give it: one
// significant figure under 0.095° (a rod's 0.04° is not a flat ±0.0°), one decimal to
// 9.95°, whole degrees past it; an angle off an axis with one decimal, 0 under 0.05°.
const fmtDeg = x => !(x > 0) ? '0' : x < 0.095 ? String(+x.toPrecision(1)) : x < 9.95 ? x.toFixed(1) : String(Math.round(x));
const fmtOff = x => x < 0.05 ? '0' : x.toFixed(1);

export { gaussLegendre, lowerBound, det3, inv3, inv3n, hklText, fmtEsd, fmtDeg, fmtOff };
