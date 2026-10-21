/* =========================================================
   SEM IMAGES — reading the files dropped, off the page's thread

   sem.js sends each file's bytes ({ seq, buf, name }); this reads it whole
   (sem-read.js readFile: its id, the image, its reduced copy, its default crop's
   statistics and group card, its base64) and sends it back, the arrays handed over,
   not copied: { seq, id, r, small, st, card, b64 }, or { seq, error } with the reason
   it is not taken (a SemReadError), or { seq, fault, kind } for anything else (out of
   memory). One file at a time, in the order sent.
========================================================= */
import { readFile, SemReadError } from './sem-read.js';

self.onmessage = e =>{
  const { seq, buf, name } = e.data;
  try {
    const out = readFile(new Uint8Array(buf), name), move = [out.r.pixels.buffer, out.small.px.buffer, out.st.hist.buffer, out.card.px.buffer];
    self.postMessage({ seq, ...out }, move);
  } catch(err){
    self.postMessage(err instanceof SemReadError ? { seq, error: err.message } : { seq, fault: String(err && err.message || err), kind: err && err.name });
  }
};
