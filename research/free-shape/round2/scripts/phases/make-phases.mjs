/* Writes the eleven fictitious phases of round 2, one per Laue class, as CIFs with their
   symmetry operators written out (cif/<id>.cif). All are symmorphic P groups, so the
   operators are the point group's matrices in the cell's basis, closed here from a few
   generators. Each phase: Zn at the origin (one per cell: no finer lattice) and O on one
   site whose orbit has exactly the class's symmetry — where the class is a merohedry of
   its lattice (4/m, -3, -3m, 6/m, m-3) the O site breaks the holohedry, else the engine,
   which takes the symmetry from the atoms (prepPhase → structureCell), would find the
   higher class (those sites are placed for short distances not under 1.4 Å and a strong
   difference between the intensities of reflections the holohedry, not the class, makes
   equivalent). Cells of 52–56 Å³, the low end of the 50–90 Å³ asked: in the search every
   member is drawn with its own width, so a pattern's cost goes with its members, about
   3.4 members per Å³ in 10–130° whatever the class (README).
   The pilot (../pilot, research/free-shape/round2/PILOT.md) scaled the three costliest
   cells, P-1, P2/m and Pmmm, by 0.8 in every length (`scale`): their long model lists
   (the free angles stretch them) made an evaluation 1.5–4× the others'. The first cells
   are kept in cif-v1/. Run: node make-phases.mjs */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);

// Generators on fractional coordinates (rows: x', y', z' as combinations of x, y, z).
const I = [-1, 0, 0, 0, -1, 0, 0, 0, -1];
const G = {
  '2y': [-1, 0, 0, 0, 1, 0, 0, 0, -1], '2z': [-1, 0, 0, 0, -1, 0, 0, 0, 1], '2x': [1, 0, 0, 0, -1, 0, 0, 0, -1],
  '4z': [0, -1, 0, 1, 0, 0, 0, 0, 1],
  '3z': [0, -1, 0, 1, -1, 0, 0, 0, 1],           // hexagonal axes: −y, x−y, z
  '6z': [1, -1, 0, 1, 0, 0, 0, 0, 1],            // x−y, x, z
  '2110': [0, 1, 0, 1, 0, 0, 0, 0, -1],          // y, x, −z (P-3m1, P6/mmm)
  '3111': [0, 0, 1, 1, 0, 0, 0, 1, 0],           // z, x, y
};
export const PHASES = [
  { id: 'P-1',    laue: '-1',    sg: 'P -1',      it: 2,   gens: [],                 cell: [3.55, 3.87, 4.19, 96, 104, 90], scale: 0.8,
    O: [[0.30, 0.25, 0.40]], why: 'γ 90°: [100] ⟂ [010], the one pair of perpendicular rows a held frame needs; α, β break every other symmetry' },
  { id: 'P2m',    laue: '2/m',   sg: 'P 1 2/m 1', it: 10,  gens: ['2y'],             cell: [3.82, 3.28, 4.37, 90, 100, 90], scale: 0.8,
    O: [[0.30, 0, 0.70]] },
  { id: 'Pmmm',   laue: 'mmm',   sg: 'P m m m',   it: 47,  gens: ['2z', '2y'],       cell: [3.36, 3.59, 4.32, 90, 90, 90], scale: 0.8,
    O: [[0.5, 0.5, 0.5]] },
  { id: 'P4m',    laue: '4/m',   sg: 'P 4/m',     it: 83,  gens: ['4z'],             cell: [3.50, 3.50, 4.32, 90, 90, 90],
    O: [[0.30, 0.20, 0.5]] },
  { id: 'P4mmm',  laue: '4/mmm', sg: 'P 4/m m m', it: 123, gens: ['4z', '2x'],       cell: [3.91, 3.91, 3.41, 90, 90, 90],
    O: [[0.5, 0.5, 0.5]] },
  { id: 'P-3',    laue: '-3',    sg: 'P -3',      it: 147, gens: ['3z'],             cell: [3.46, 3.46, 5.10, 90, 90, 120],
    O: [[0.35, 0.30, 0.30]] },
  { id: 'P-3m1',  laue: '-3m',   sg: 'P -3 m 1',  it: 164, gens: ['3z', '2110'],     cell: [3.28, 3.28, 5.64, 90, 90, 120],
    O: [[1/3, 2/3, 0.27]] },
  { id: 'P6m',    laue: '6/m',   sg: 'P 6/m',     it: 175, gens: ['6z'],             cell: [4.10, 4.10, 3.64, 90, 90, 120],
    O: [[0.45, 0.15, 0.5]] },
  { id: 'P6mmm',  laue: '6/mmm', sg: 'P 6/m m m', it: 191, gens: ['6z', '2110'],     cell: [3.59, 3.59, 4.69, 90, 90, 120],
    O: [[1/3, 2/3, 0.5]] },
  { id: 'Pm-3',   laue: 'm-3',   sg: 'P m -3',    it: 200, gens: ['2z', '2y', '3111'], cell: [3.75, 3.75, 3.75, 90, 90, 90],
    O: [[0.27, 0, 0.5]] },
  { id: 'Pm-3m',  laue: 'm-3m',  sg: 'P m -3 m',  it: 221, gens: ['4z', '3111'],     cell: [3.73, 3.73, 3.73, 90, 90, 90],
    O: [[0.5, 0.5, 0.5]] },
];

const mul = (A, B) => [0, 1, 2].flatMap(i=> [0, 1, 2].map(j=> A[3*i]*B[j] + A[3*i + 1]*B[3 + j] + A[3*i + 2]*B[6 + j]));
export function closeGroup(gens){
  const out = [[1, 0, 0, 0, 1, 0, 0, 0, 1]], key = M => M.join();
  const seen = new Set(out.map(key));
  for (let grew = true; grew;){
    grew = false;
    for (const A of [...out]) for (const g of [...gens, I]){ const M = mul(A, g); if (!seen.has(key(M))){ seen.add(key(M)); out.push(M); grew = true; } }
  }
  return out;
}
const term = (c, n) => c === 0 ? '' : (c > 0 ? '+' : '-') + (Math.abs(c) === 1 ? '' : Math.abs(c)) + n;
const opText = M => [0, 1, 2].map(i=> { const s = term(M[3*i], 'x') + term(M[3*i + 1], 'y') + term(M[3*i + 2], 'z'); return s.startsWith('+') ? s.slice(1) : s; }).join(',');
// The orbit of a fractional position under the operators (mod 1).
const orbit = (ops, p) => {
  const out = [], k = v => v.map(t=> ((Math.round(t*1e6)/1e6 % 1) + 1) % 1).map(t=> t.toFixed(5)).join();
  const seen = new Set();
  for (const R of ops){ const q = [0, 1, 2].map(i=> R[3*i]*p[0] + R[3*i + 1]*p[1] + R[3*i + 2]*p[2]); if (!seen.has(k(q))){ seen.add(k(q)); out.push(q); } }
  return out;
};
const f = x => +x.toFixed(6) + '';

if (import.meta.url === 'file://' + process.argv[1]){
  fs.mkdirSync(path.join(HERE, 'cif'), { recursive: true });
  for (const p of PHASES){
    const ops = closeGroup(p.gens.map(g=> G[g]));
    const nO = p.O.reduce((t, o)=> t + orbit(ops, o).length, 0);
    // (scale: every length × it, the angles and the atoms' fractional coordinates kept)
    const s = p.scale || 1, [a, b, c] = p.cell.slice(0, 3).map(x=> x*s), [al, be, ga] = p.cell.slice(3);
    const len = x => s === 1 ? x.toFixed(2) : f(x);
    const txt = `data_fs2_${p.id.replace(/[^A-Za-z0-9]/g, '_')}
_chemical_name_common 'fictitious ZnO${nO > 1 ? nO : ''}, Laue class ${p.laue} (free-shape round 2)'
_chemical_formula_sum 'Zn1 O${nO}'
_cell_formula_units_Z 1
_cell_length_a ${len(a)}
_cell_length_b ${len(b)}
_cell_length_c ${len(c)}
_cell_angle_alpha ${al}
_cell_angle_beta ${be}
_cell_angle_gamma ${ga}
_space_group_name_H-M_alt '${p.sg}'
_space_group_IT_number ${p.it}
loop_
_space_group_symop_operation_xyz
${ops.map(M=> `'${opText(M)}'`).join('\n')}
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
_atom_site_U_iso_or_equiv
Zn1 Zn 0 0 0 1 0.0063
${p.O.map((o, i)=> `O${i + 1} O ${o.map(f).join(' ')} 1 0.0080`).join('\n')}
`;
    fs.writeFileSync(path.join(HERE, 'cif', p.id + '.cif'), txt);
    console.log(p.id.padEnd(7), p.laue.padEnd(6), 'ops', String(ops.length).padStart(2), 'O per cell', nO);
  }
}
