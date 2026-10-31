const D2R = Math.PI/180, n = 10001, x = Float64Array.from({ length: n }, (_, i)=> 10 + 0.01*i);
const S = x.map(t=> Math.sin(t*D2R/2)), C = x.map(t=> Math.cos(t*D2R/2));
const N = 1024, re = Float64Array.from({ length: N }, (_, i)=> 1/(1 + ((i < N/2 ? i : N - i)/30)**2));
const lam = 1.5406, out = new Float64Array(n);
function lowerBound(a, v){ let lo = 0, hi = a.length; while (lo < hi){ const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; }
function A(tt, I){ // current (trig tables)
  const th0 = tt*D2R/2, s0 = Math.sin(th0), c1 = Math.cos(th0)*D2R/lam, half = 30*c1, dd = 2*half/N, edge = re[N >> 1];
  const at = m => re[m < 0 ? m + N : m >= N ? m - N : m];
  const xLo = 2*Math.asin(s0 - half*lam/2)/D2R, xHi = 2*Math.asin(s0 + half*lam/2)/D2R;
  let i = lowerBound(x, xLo), c = 0;
  for (; i < n; i++){
    if (x[i] > xHi) break;
    const dl = 2*(S[i] - s0)/lam;
    if (dl < -half || dl > half) continue;
    const f = dl/dd, m = Math.floor(f), u = f - m;
    const p0 = at(m - 1), p1 = at(m), p2 = at(m + 1), p3 = at(m + 2);
    const v = p1 + 0.5*u*(p2 - p0 + u*(2*p0 - 5*p1 + 4*p2 - p3 + u*(3*(p1 - p2) + p3 - p0)));
    out[i] += I*(v - edge)*C[i]*D2R/lam; c++;
  }
  return c;
}
const pad = new Float64Array(N + 8);
function B(tt, I){ // unwrapped padded copy, reciprocals
  const th0 = tt*D2R/2, s0 = Math.sin(th0), c1 = Math.cos(th0)*D2R/lam, half = 30*c1, dd = 2*half/N, edge = re[N >> 1];
  const H = N >> 1; // pad[k] = re at m = k - H - 2, m in [-H-2, H+5]
  for (let k = 0; k < N + 8; k++){ let m = k - H - 2; m = m < 0 ? m + N : m >= N ? m - N : m; pad[k] = re[m] - edge; }
  const xLo = 2*Math.asin(s0 - half*lam/2)/D2R, xHi = 2*Math.asin(s0 + half*lam/2)/D2R;
  const kf = 2/lam/dd, ki = I*D2R/lam, off = H + 2;
  let i = lowerBound(x, xLo), c = 0;
  for (; i < n; i++){
    if (x[i] > xHi) break;
    const f = (S[i] - s0)*kf;
    if (f < -H || f > H) continue;
    const m = Math.floor(f), u = f - m, k = m + off;
    const p0 = pad[k - 1], p1 = pad[k], p2 = pad[k + 1], p3 = pad[k + 2];
    const v = p1 + 0.5*u*(p2 - p0 + u*(2*p0 - 5*p1 + 4*p2 - p3 + u*(3*(p1 - p2) + p3 - p0)));
    out[i] += ki*v*C[i]; c++;
  }
  return c;
}
function Z(tt, I){ // pV-like reference: one division a point
  const half = 24, i0 = lowerBound(x, tt - half); let c = 0; const lk = 2/(Math.PI*0.6), l4 = 4/0.36;
  for (let i = i0; i < n; i++){ const xi = x[i]; if (xi > tt + half) break; const d = xi - tt; out[i] += I*(lk/(1 + l4*d*d)); c++; }
  return c;
}
for (const [nm, F] of [['A', A], ['B', B], ['Z', Z], ['A', A], ['B', B], ['Z', Z]]){
  let c = 0; const t0 = performance.now();
  for (let r = 0; r < 2000; r++) c += F(30 + (r % 70), 1);
  const ms = performance.now() - t0; console.log(nm, (1e6*ms/c).toFixed(2), 'ns/pt', c);
}
function D(tt, I){ // B with integer floor via offset
  const th0 = tt*D2R/2, s0 = Math.sin(th0), c1 = Math.cos(th0)*D2R/lam, half = 30*c1, dd = 2*half/N, edge = re[N >> 1];
  const H = N >> 1;
  for (let k = 0; k < N + 8; k++){ let m = k - H - 2; m = m < 0 ? m + N : m >= N ? m - N : m; pad[k] = re[m] - edge; }
  const xLo = 2*Math.asin(s0 - half*lam/2)/D2R, xHi = 2*Math.asin(s0 + half*lam/2)/D2R;
  const kf = 2/lam/dd, ki = I*D2R/lam, off = H + 2;
  let i = lowerBound(x, xLo), c = 0;
  for (; i < n; i++){
    if (x[i] > xHi) break;
    const g = (S[i] - s0)*kf + off;          // ≥ 2
    if (!(g >= 2 && g <= N + 2)) continue;
    const k = g | 0, u = g - k;
    const p0 = pad[k - 1], p1 = pad[k], p2 = pad[k + 1], p3 = pad[k + 2];
    const v = p1 + 0.5*u*(p2 - p0 + u*(2*p0 - 5*p1 + 4*p2 - p3 + u*(3*(p1 - p2) + p3 - p0)));
    out[i] += ki*v*C[i]; c++;
  }
  return c;
}
function L(tt, I){ // linear interpolation
  const th0 = tt*D2R/2, s0 = Math.sin(th0), c1 = Math.cos(th0)*D2R/lam, half = 30*c1, dd = 2*half/N, edge = re[N >> 1];
  const H = N >> 1;
  for (let k = 0; k < N + 8; k++){ let m = k - H - 2; m = m < 0 ? m + N : m >= N ? m - N : m; pad[k] = re[m] - edge; }
  const xLo = 2*Math.asin(s0 - half*lam/2)/D2R, xHi = 2*Math.asin(s0 + half*lam/2)/D2R;
  const kf = 2/lam/dd, ki = I*D2R/lam, off = H + 2;
  let i = lowerBound(x, xLo), c = 0;
  for (; i < n; i++){
    if (x[i] > xHi) break;
    const g = (S[i] - s0)*kf + off;
    if (!(g >= 2 && g <= N + 2)) continue;
    const k = g | 0, u = g - k;
    out[i] += ki*(pad[k] + u*(pad[k + 1] - pad[k]))*C[i]; c++;
  }
  return c;
}
for (const [nm, F] of [['D', D], ['L', L], ['D', D], ['L', L]]){
  let c = 0; const t0 = performance.now();
  for (let r = 0; r < 2000; r++) c += F(30 + (r % 70), 1);
  const ms = performance.now() - t0; console.log(nm, (1e6*ms/c).toFixed(2), 'ns/pt', c);
}
function E(tt, I){ // bit-identical to A: same f, u, values; integer floor; unwrapped copy
  const th0 = tt*D2R/2, s0 = Math.sin(th0), c1 = Math.cos(th0)*D2R/lam, half = 30*c1, dd = 2*half/N, edge = re[N >> 1];
  const H = N >> 1, off = H + 2;
  for (let k = 0; k < N + 8; k++){ let m = k - off; m = m < 0 ? m + N : m >= N ? m - N : m; pad[k] = re[m]; }
  const xLo = 2*Math.asin(s0 - half*lam/2)/D2R, xHi = 2*Math.asin(s0 + half*lam/2)/D2R;
  let i = lowerBound(x, xLo), c = 0;
  for (; i < n; i++){
    if (x[i] > xHi) break;
    const dl = 2*(S[i] - s0)/lam;
    if (dl < -half || dl > half) continue;
    const f = dl/dd, t = f | 0, m = t > f ? t - 1 : t, u = f - m, k = m + off;
    const p0 = pad[k - 1], p1 = pad[k], p2 = pad[k + 1], p3 = pad[k + 2];
    const v = p1 + 0.5*u*(p2 - p0 + u*(2*p0 - 5*p1 + 4*p2 - p3 + u*(3*(p1 - p2) + p3 - p0)));
    out[i] += I*(v - edge)*C[i]*D2R/lam; c++;
  }
  return c;
}
// identity check A vs E
{ const o1 = new Float64Array(n), o2 = new Float64Array(n); const sv = out;
  for (let r = 0; r < 50; r++){ out.fill(0); A(20 + 1.7*r, 3.3); o1.set(out); out.fill(0); E(20 + 1.7*r, 3.3); o2.set(out); for (let i = 0; i < n; i++) if (o1[i] !== o2[i]){ console.log('DIFF', r, i, o1[i], o2[i]); process.exit(1); } }
  console.log('E identical to A'); }
for (const [nm, F] of [['E', E], ['E', E]]){
  let c = 0; const t0 = performance.now();
  for (let r = 0; r < 2000; r++) c += F(30 + (r % 70), 1);
  const ms = performance.now() - t0; console.log(nm, (1e6*ms/c).toFixed(2), 'ns/pt', c);
}
