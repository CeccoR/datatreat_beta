/* Escaping: text from outside (file names, labels, every field of an imported project)
   never becomes markup. For each module, a payload that would make an element <i data-x>
   if it were put into markup unescaped goes:
     F  into the file names (the EPR pair keeps one base name),
     A  into every string of the module's exported project, imported back and opened,
     B  as A, and every lone number replaced by the payload too.
   No element may come of it anywhere. Page errors fail F and A; under B a project of
   nonsense numbers may fail to draw (a known XRPD error on its sample index), so they are
   reported, not failed on, and so is a B project its module cannot open (v484: it opens
   empty, with a banner). A project changed after its export is a doubtful file: the
   import asks first, and is told to import it anyway. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, openModule, loadFiles, poke, injected, exportProject, projectFile, importProject, openProject, banner, answer, PAYLOAD, MODS } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

const SKIP = new Set(['__t', 'type']);
// The payload before every string; with `nums`, in place of every number not in an array.
function mutate(v, nums, key){
  if (Array.isArray(v)) return v.map(x=> typeof x === 'number' ? x : mutate(x, nums, key));
  if (v && typeof v === 'object'){ const o = {}; for (const k in v) o[k] = SKIP.has(k) ? v[k] : mutate(v[k], nums, k); return o; }
  if (typeof v === 'string') return PAYLOAD + v;
  if (nums && typeof v === 'number' && key !== 'id') return PAYLOAD + v;
  return v;
}
const uniq = a => [...new Set(a)];

for (const mod of MODS){
  test(`${mod}: payload in file names, in an imported project's strings and numbers`, async t=>{
    const { page, errors, close } = await env.page();
    try {
      // F: file names.
      await openModule(page, mod);
      const named = env.fx.files[mod].map(p=> ({ name: `x"'><i data-x=1>` + path.basename(p), mimeType: 'application/octet-stream', buffer: fs.readFileSync(p) }));
      await loadFiles(page, mod, named);
      await poke(page);
      assert.deepEqual(await injected(page), [], 'F: an element made from a file name');
      assert.deepEqual(uniq(errors), [], 'F: page errors');
      // The project, exported as it is now.
      const { obj } = await exportProject(page);
      for (const [pass, nums] of [['A', false], ['B', true]]){
        const e0 = errors.length, name = `Fuzz ${mod} ${pass}`;
        const f = projectFile(env, `fz-${mod}-${pass}.datatreat`, { ...obj, title: PAYLOAD + name, state: mutate(obj.state, nums) });
        const asked = await importProject(page, f, { expectDoubt: true });
        assert.match(asked.text, /changed after DataTreat signed it/, `${pass}: the import's question`);
        assert.deepEqual(await injected(page), [], `${pass}: an element in the Projects list`);
        await openProject(page, mod, name);
        const damaged = await banner(page);
        if (damaged) await answer(page, 'ok');
        await poke(page);
        assert.deepEqual(await injected(page), [], `${pass}: an element in the module`);
        const errs = uniq(errors.slice(e0));
        if (pass === 'A'){
          assert.equal(damaged, null, 'A: the project with its strings marked did not open');
          assert.deepEqual(errs, [], 'A: page errors');
        } else {
          if (damaged) t.diagnostic(`B (numbers replaced) opened empty, not failed on: ${damaged.text}`);
          if (errs.length) t.diagnostic(`B (numbers replaced) page errors, not failed on: ${errs.slice(0, 4).join(' | ')}`);
        }
      }
    } finally { await close(); }
  });
}
