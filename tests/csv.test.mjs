/* CSV export: the project bar's zip, for every module, read with an RFC 4180 parser under
   the field separator of the Settings (';', then ','), a sample label carrying both
   separators and a quote. Every file parses, is rectangular (one field count for all its
   rows), has data rows of numbers, and the label comes back whole wherever it is written.
   The Projects list's CSV of a saved project is the same as the project bar's. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, openModule, loadFiles, download, readZip, parseCsv, settle, saveAs, keep, MODS } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const LABEL = 'a;b "c", d';
const isNum = s => /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s);
// The settings' field separator, chosen on the Settings page; back to the project tab after.
async function fieldSep(page, sep){
  await page.click('#nav button[data-tab="settings"]');
  await page.selectOption('#settingField', sep);
  await page.locator('#tabBar .ptab').first().locator('.ptab-label').click();
  await settle(page);
}
function check(mod, sep, entries){
  assert.ok(entries.length > 0, 'an empty zip');
  let labelSeen = false;
  for (const e of entries){
    const text = e.data.toString('utf8'), what = `${mod} ${JSON.stringify(sep)} ${e.name}`;
    assert.match(e.name, /\.csv$/, what);
    let rows;
    try { rows = parseCsv(text, sep); } catch(x){ keep(`csv/${mod}/${e.name}`, text); assert.fail(`${what}: ${x.message}`); }
    assert.ok(rows.length >= 2, `${what}: no data row`);
    const widths = new Set(rows.map(r=> r.length));
    assert.equal(widths.size, 1, `${what}: rows of ${[...widths].join(', ')} fields`);
    const cells = rows.slice(1).flat().filter(c=> c !== '');
    assert.ok(cells.filter(isNum).length >= cells.length/3, `${what}: hardly any numbers in its data rows`);
    // The label, whole: a field of its own, or inside a header's field.
    if (rows.some(r=> r.some(c=> c.includes(LABEL)))) labelSeen = true;
    assert.ok(!rows.some(r=> r.some(c=> /(^|[^a])b "c", d/.test(c) && !c.includes(LABEL))), `${what}: the label cut up`);
  }
  assert.ok(labelSeen, `${mod} ${JSON.stringify(sep)}: the label is in no file`);
}

for (const mod of MODS){
  test(`${mod}: the CSV zip parses, under ';' and ','`, async ()=>{
    const { page, errors, close } = await env.page();
    try {
      await openModule(page, mod);
      await loadFiles(page, mod, env.fx.files[mod]);
      const lab = page.locator(`#${mod}FileTableWrap .file-label`).first();
      await lab.fill(LABEL); await lab.press('Enter'); await settle(page);
      for (const sep of [';', ',']){
        if (sep !== ';') await fieldSep(page, sep);
        const z = await download(page, ()=> page.click('.proj-csv'));
        assert.equal(z.name, mod + '_export.zip');
        check(mod, sep, readZip(z.buf));
      }
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}

test('the Projects list exports the same CSVs as the project bar', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', env.fx.files.gc);
    await saveAs(page, 'Csv');
    const bar = readZip((await download(page, ()=> page.click('.proj-csv'))).buf);
    await page.click('#nav button[data-tab="projects"]');
    const list = readZip((await download(page, ()=> page.locator('#sessListWrap tr.sess-row .pr-csv').first().click())).buf);
    assert.deepEqual(list.map(e=> e.name), bar.map(e=> e.name));
    list.forEach((e, i)=> assert.ok(e.data.equals(bar[i].data), e.name + ' differs'));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
