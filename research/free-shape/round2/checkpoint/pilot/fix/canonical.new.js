/* canonical(id, solid) → { type, dims, axes, R, normal, second, labels, families }: the
   solid's frame in the class's fundamental zone, as a whole.
   1. The normal: the principal axis (principalAxis, the engine's most telling axis). The
      second axis: of the other two, the one of larger extent; where their extents are
      equal (a square box's two edges, a cube's), each in turn (the body's own symmetry).
   2. The normal goes where canonicalDir puts it: over the class's rotations G (and those
      choices), the G·n nearest its family's first member. Among the G that do so equally
      (within 10⁻⁹ rad: the stabiliser, four of them for a plate normal on a 4-fold), the
      second axis decides by the lattice row it lies on or nearest: of the members of its
      family, the one nearest G·e, and of those the first by the direction order (dirCmp);
      then G·e nearest that member; remaining ties by dirCmp on the normal, then the
      second axis. Where the candidates' normals or second axes come from different
      families (a cube's three axes, a square's two edges), the simpler family goes first
      (Σ indices², then dirCmp). Every key is the row an axis lies on or nearest, so a frame
      on the lattice and the same frame turned a little read the same: the zone's
      boundaries lie where an axis is equally near two rows, away from the lattice frames.
      (The first form placed the second axis nearest its family's first member, which is
      equidistant from several images when that member is the normal's own row, ⟨100⟩ about
      [100] in m−3m: there a 0.01° turn chose another image, 30–90° away.)
   3. Each axis is given in the sense toward its row; the third axis is the cross product
      that keeps the frame proper (R, as the engine's quaternions need).
   4. The slots: within each class of interchangeable slots (CLASSES: a box's or an
      ellipsoid's three, a section's two), the normal takes the first, then the second
      axis, then the third; the dimensions go with their axes. A body relabelled (its
      slots permuted within a class, with their dimensions) gives one canonical form.
   A cylinder's or spheroid's frame is its axis alone: the canonical axis, with x along
   (axis × z_Cartesian), or along x_Cartesian when the axis is along z.
   Idempotent, and equal for frames related by the class's rotations or the body's own
   symmetry, for relabelled bodies, and for lattice frames turned 10⁻⁶° and 0.01° (test.mjs). */
export function canonical(id, solid, rots = laueRotations(id)){
  const q = phaseQ(id), ax = solid.axes.map(unit), type = solid.type;
  const p = principalAxis(solid);
  if (REVOLUTION.has(type)){
    const c = canonicalDir(id, ax[2], rots), z = c.vec;
    const ref = Math.abs(z[2]) < 0.99 ? [0, 0, 1] : [1, 0, 0];
    const x = unit(cross(z, ref)), y = cross(z, x);
    return { type, dims: [...solid.dims], axes: [x, y, z], R: fromCols([x, y, z]), normal: 2, second: null, labels: [null, null, c.label], families: [null, null, c.family] };
  }
  const others = [0, 1, 2].filter(i=> i !== p);
  const same = (i, j) => Math.abs(lg(solid.dims[i]) - lg(solid.dims[j])) < 1e-12;
  const seconds = same(others[0], others[1]) ? others : [solid.dims[others[0]] >= solid.dims[others[1]] ? others[0] : others[1]];
  // a cube: every axis may be the normal
  const normals = [0, 1, 2].every(i=> same(i, p)) ? [0, 1, 2] : [p];
  const rep = new Map(), repOf = i => rep.get(i) || (rep.set(i, familyRep(id, ax[i], rots)), rep.get(i));
  const mem = new Map(), membersOf = i => mem.get(i) || (mem.set(i, familyMembers(repOf(i), rots)), mem.get(i));
  // the simpler family first: Σ of its indices squared, then the direction order
  const famCmp = (a, b) => (a.cx - b.cx) || dirCmp(lattCoords(q, a.vec), lattCoords(q, b.vec));
  // the member of slot i's family nearest v, in its nicer sense
  const rowOf = (i, v) => { let m = null, c = -1; for (const u of membersOf(i)){ const d = Math.abs(dot(u, v)); if (d > c + 1e-12){ c = d; m = u; } } return signed(q, m); };
  // the sense toward a row; normal to it (a tie the sign cannot break), the nicer sense
  const toward = (v, r) => Math.abs(dot(v, r)) < 1e-9 ? signed(q, v) : dot(v, r) < 0 ? v.map(t=> -t) : v;
  let best = null;
  for (const G of rots) for (const pn of normals) for (const s of (normals.length > 1 ? [0, 1, 2].filter(i=> i !== pn) : seconds)){
    const rn = repOf(pn), re = repOf(s);
    const n = toward(unit(mv(G, ax[pn])), rn.vec), v = unit(mv(G, ax[s])), m = rowOf(s, v), e = toward(v, m);
    const an = angle(n, rn.vec), ae = angle(e, m);
    const cand = { n, e, m, an, ae, tn: lattCoords(q, n), te: lattCoords(q, e), tm: lattCoords(q, m), rn, re, pn, s };
    if (best){
      const fn = famCmp(rn, best.rn);
      if (fn > 0) continue;
      if (!fn){
        const dn = an - best.an;
        if (dn > 1e-9) continue;
        if (Math.abs(dn) <= 1e-9){
          const fe = famCmp(re, best.re) || dirCmp(cand.tm, best.tm);
          if (fe > 0) continue;
          if (!fe){
            const de = ae - best.ae;
            if (de > 1e-9) continue;
            if (Math.abs(de) <= 1e-9){ const c = dirCmp(cand.tn, best.tn); if (c > 0 || (c === 0 && dirCmp(cand.te, best.te) >= 0)) continue; }
          }
        }
      }
    }
    best = cand;
  }
  // the slots: the normal first in its class, then the second axis, then the third (a
  // cube's or a square's tied slots hold equal extents, whichever axis took them)
  const cls = CLASSES[type], clsOf = i => cls.find(c=> c.includes(i));
  const taken = new Set(), take = i => { const sl = clsOf(i).find(k=> !taken.has(k)); taken.add(sl); return sl; };
  const sP = take(normals.length > 1 ? p : p), sS = take(best.s === best.pn ? seconds[0] : best.s), sT = [0, 1, 2].find(k=> !taken.has(k));
  const tSrc = [0, 1, 2].find(i=> i !== best.pn && i !== best.s);
  const dims = []; dims[sP] = solid.dims[best.pn]; dims[sS] = solid.dims[best.s]; dims[sT] = solid.dims[tSrc];
  const cyc = (sS - sP + 3) % 3 === 1;
  const C = []; C[sP] = best.n; C[sS] = best.e; C[sT] = unit(cyc ? cross(best.n, best.e) : cross(best.e, best.n));
  const fam = []; fam[sP] = best.rn.label; fam[sS] = best.re.label; fam[sT] = null;
  return { type, dims, axes: C, R: fromCols(C), normal: sP, second: sS, labels: C.map(c=> dirLabel(q, c)), families: fam };
}
