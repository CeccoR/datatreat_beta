/* db.js's encode/decode, in Node (no browser): the form a module state takes in IndexedDB
   and in a .datatreat file. Bytes are base64; a byte array held in several places (the
   scans of one XRDML file share its bytes) is written once and comes back as one array;
   dates and other typed arrays come back as before; the older forms still decode. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.btoa ??= s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob ??= s => Buffer.from(s, 'base64').toString('binary');
const { encode, decode } = await import('../db.js');
const roundTrip = v => decode(JSON.parse(JSON.stringify(encode(v))));

test('bytes held in several places are written once and come back as one array', ()=>{
  const a = new Uint8Array(3000).map((_, i)=> i * 7), b = new Uint8Array([9, 8]);
  const st = { files: [{ raw: a }, { raw: a }, { raw: b }, { raw: a }] };
  const enc = encode(st);
  const text = JSON.stringify(enc);
  assert.equal(text.split(Buffer.from(a).toString('base64')).length - 1, 1, 'the shared bytes written more than once');
  assert.deepEqual(enc.files[1].raw, { __t: 'u8', ref: enc.files[0].raw.id });
  assert.equal(enc.files[2].raw.id, undefined, 'bytes used once carry no id');
  const back = roundTrip(st);
  assert.ok(back.files[0].raw instanceof Uint8Array);
  assert.equal(back.files[0].raw, back.files[1].raw);
  assert.equal(back.files[0].raw, back.files[3].raw);
  assert.notEqual(back.files[0].raw, back.files[2].raw);
  assert.deepEqual([...back.files[3].raw], [...a]);
  assert.deepEqual([...back.files[2].raw], [9, 8]);
});

test('a reference met before its bytes still finds them', ()=>{
  const a = new Uint8Array([1, 2, 3]);
  const enc = JSON.parse(JSON.stringify(encode({ files: [{ raw: a }, { raw: a }] })));
  enc.files.reverse();
  const back = decode(enc);
  assert.deepEqual([...back.files[0].raw], [1, 2, 3]);
  assert.equal(back.files[0].raw, back.files[1].raw);
});

test('dates, other typed arrays and plain values', ()=>{
  const back = roundTrip({ d: new Date(1700000000000), f: new Float64Array([1.5, -2]), s: 'x', n: null, k: [1, [2]] });
  assert.ok(back.d instanceof Date);
  assert.equal(back.d.getTime(), 1700000000000);
  assert.deepEqual(back.f, [1.5, -2]);
  assert.deepEqual([back.s, back.n, back.k], ['x', null, [1, [2]]]);
});

test('the older forms decode: v471–v484 bytes, arrays of numbers, a dangling reference', ()=>{
  assert.deepEqual([...decode({ __t: 'u8', v: Buffer.from([4, 5]).toString('base64') })], [4, 5]);
  assert.deepEqual(decode({ raw: [1, 2, 3] }).raw, [1, 2, 3]);
  const dangling = decode({ __t: 'u8', ref: 7 });
  assert.ok(dangling instanceof Uint8Array);
  assert.equal(dangling.length, 0);
  assert.equal(decode({ __t: 'u8', v: '%%not base64' }).length, 0);
});
