/* =========================================================
   SEM IMAGES — reading the files dropped, off the page's thread

   sem.js sends each file's bytes ({ seq, buf, name }); this reads it whole
   (sem-read.js readFile: its id, the image, its reduced copy, its default crop's
   statistics and group card) and sends it back, the arrays handed over, not copied:
   { seq, id, r (its pixels null), px (the pixels where they are a copy, else null: they
   are the bytes'), small, st, card, buf (the bytes themselves, back) }, or { seq, error }
   with the reason it is not taken (a SemReadError), or { seq, fault, kind } for anything
   else (out of memory). One file at a time, in the order sent. One worker for every SEM
   tab (sem.js), let go when none has read for a while. To v517 it made the file's
   base64 too, and sent a copy of the pixels where they were the bytes.
========================================================= */
import { readFile, SemReadError } from './sem-read.js';

self.onmessage = e =>{
  const { seq, buf, name } = e.data;
  try {
    const out = readFile(new Uint8Array(buf), name), px = out.r.view ? null : out.r.pixels;
    const move = [buf, out.small.px.buffer, out.st.hist.buffer, out.card.px.buffer];
    if (px) move.push(px.buffer);
    self.postMessage({ seq, id: out.id, r: { ...out.r, pixels: null }, px, small: out.small, st: out.st, card: out.card, buf }, move);
  } catch(err){
    self.postMessage(err instanceof SemReadError ? { seq, error: err.message } : { seq, fault: String(err && err.message || err), kind: err && err.name });
  }
};
