/* The CIF's composition check (xrd-cryst.js checkComposition), read in the app's page as the
   Rietveld card reads a CIF (xrd-rv-model.js prepPhase). pymatgen writes
   _chemical_formula_sum for the whole cell ('Ti4 O8') and _cell_formula_units_Z per reduced
   formula (_chemical_formula_structural TiO2, Z 4): up to v536 a right file was said to fill
   the cell with Ti 4, O 8 where Ti4O8 × Z = 4 is Ti 16, O 32. From v537 the cell passes if
   it holds the structural formula × Z, the sum × Z (the CIF standard) or the sum as the whole
   cell; the warning stays when none fits, and names the structural formula. The file is
   synthetic, anatase-like: I4₁/amd in origin choice 2, its 32 operations listed one by one as
   pymatgen lists them, Ti on 4a (0, 3/4, 1/8; at 0, 0, 0, its origin-1 place, it fills 8c),
   O on 8e (0, 3/4, 0.3333: z ≈ 0.208 in origin choice 1). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// I4₁/amd, origin choice 2 (International Tables A, No. 141): the 16 operations, then the
// same with the I centring (+½, +½, +½).
const OPS = ['x, y, z', '-x+1/2, -y, z+1/2', '-y+1/4, x+3/4, z+1/4', 'y+1/4, -x+1/4, z+3/4',
  '-x+1/2, y, -z+1/2', 'x, -y, -z', 'y+1/4, x+3/4, -z+1/4', '-y+1/4, -x+1/4, -z+3/4',
  '-x, -y, -z', 'x+1/2, y, -z+1/2', 'y+3/4, -x+1/4, -z+3/4', '-y+3/4, x+3/4, -z+1/4',
  'x+1/2, -y, z+1/2', '-x, y, z', '-y+3/4, -x+1/4, z+3/4', 'y+3/4, x+3/4, z+1/4'];
const ALL = [...OPS, ...OPS.map(op=> op.split(', ').map(t=> t + '+1/2').join(', '))];
// A CIF as pymatgen's CifWriter writes it (type symbols with their charges, the sites'
// multiplicities, no displacement parameters).
const cif = ({ sum = 'Ti4 O8', structural = 'TiO2', Z = 4, ti = '0.00000000  0.75000000  0.12500000' } = {})=> `# generated using pymatgen
data_TiO2
_symmetry_space_group_name_H-M   I4_1/amd
_cell_length_a   3.78450000
_cell_length_b   3.78450000
_cell_length_c   9.51430000
_cell_angle_alpha   90.00000000
_cell_angle_beta   90.00000000
_cell_angle_gamma   90.00000000
_symmetry_Int_Tables_number   141
${structural ? `_chemical_formula_structural   ${structural}\n` : ''}_chemical_formula_sum   '${sum}'
_cell_volume   136.26763900
${Z ? `_cell_formula_units_Z   ${Z}\n` : ''}loop_
 _symmetry_equiv_pos_site_id
 _symmetry_equiv_pos_as_xyz
${ALL.map((op, i)=> `  ${i + 1}  '${op}'`).join('\n')}
loop_
 _atom_type_symbol
 _atom_type_oxidation_number
  Ti4+  4.0
  O2-  -2.0
loop_
 _atom_site_type_symbol
 _atom_site_label
 _atom_site_symmetry_multiplicity
 _atom_site_fract_x
 _atom_site_fract_y
 _atom_site_fract_z
 _atom_site_occupancy
  Ti4+  Ti0  4  ${ti}  1
  O2-  O1  8  0.00000000  0.75000000  0.33330000  1
`;

test('a pymatgen CIF (formula sum for the whole cell, Z per formula unit) is not warned about; a real mismatch is', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    const read = cases => page.evaluate(async cases=>{
      const M = await import('./xrd-rv-model.js');
      return cases.map(([name, text])=>{ const p = M.prepPhase(text, name); return { name: p.name, n: p.atoms.length, warnings: p.warnings }; });
    }, cases);
    const fill = w => w.filter(t=> /symmetry operations fill|multiplicities differ/.test(t));
    const [pmg, noZ, std, asCell, bad, badSum, origin1] = await read([
      ['pymatgen.cif', cif()],
      ['noZ.cif', cif({ Z: null })],
      // The CIF standard: the sum per formula unit.
      ['standard.cif', cif({ structural: null, sum: 'Ti O2' })],
      // The sum read as the whole cell, whatever the Z.
      ['ascell.cif', cif({ Z: 8 })],
      // TiO2 × 8, Ti8O16 × 8 and Ti8O16 as the cell: none is Ti 4, O 8.
      ['bad.cif', cif({ Z: 8, sum: 'Ti8 O16' })],
      ['badsum.cif', cif({ structural: null, Z: 8, sum: 'Ti8 O16' })],
      // Ti at its origin-choice-1 place with origin-2 operations: twice the Ti.
      ['origin1.cif', cif({ ti: '0 0 0' })],
    ]);
    assert.equal(pmg.name, 'TiO2');
    assert.equal(pmg.n, 12, 'Ti 4, O 8 in the cell');
    assert.deepEqual(pmg.warnings, ['No displacement parameter for Ti0, O1: B = 0.5 Å² assumed.'], 'no composition warning: ' + pmg.warnings.join(' | '));
    for (const r of [noZ, std, asCell]) assert.deepEqual(fill(r.warnings), [], r.name + ': ' + r.warnings.join(' | '));
    // The structural formula × Z named first, then what else was compared.
    assert.deepEqual(fill(bad.warnings), ['The symmetry operations fill the cell with Ti 4, O 8, but TiO2 × Z = 8 is Ti 8, O 16 (every element 0.5× the formula: Z is wrong, or the coordinates belong to another origin choice or setting than the operations). Nor is it Ti8O16 (_chemical_formula_sum) × Z, Ti 64, O 128, nor Ti8O16 as the whole cell.']);
    assert.deepEqual(fill(badSum.warnings), ['The symmetry operations fill the cell with Ti 4, O 8, but Ti8O16 × Z = 8 is Ti 64, O 128 (every element 0.063× the formula: Z is wrong, or the coordinates belong to another origin choice or setting than the operations). Nor is it Ti8O16 as the whole cell.']);
    assert.equal(fill(origin1.warnings).length, 1);
    assert.match(fill(origin1.warnings)[0], /^Site multiplicities differ from the CIF's: Ti0 8 \(CIF 4\)\. The symmetry operations fill the cell with Ti 8, O 8, but TiO2 × Z = 4 is Ti 4, O 8\. .* Nor is it Ti4O8 \(_chemical_formula_sum\) × Z, Ti 16, O 32, nor Ti4O8 as the whole cell\.$/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
