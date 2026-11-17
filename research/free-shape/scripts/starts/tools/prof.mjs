import { runCase, loadMethod } from '../../harness/lib.mjs';
const m = await loadMethod(process.argv[2]);
const t = Date.now(); runCase({ id: process.argv[3] || 'box-plate110', seed: 1, methods: [m] }); console.log('ms', Date.now() - t);
