/* GC's injection dates, which the instrument writes month/day, 'M/D/YYYY h:mm:ss AM|PM':
   - a date that does not exist is taken for none: a month 1–12, a day up to its month's
     length (2/29/2024 is one, 2/29/2025 not), the hour 1–12 with AM or PM (12:00 AM is
     midnight, 12:00 PM noon), minutes and seconds 0–59. To v509 the Date rolled over:
     13/10/2025 was 10 January 2026, 2/30/2025 2 March, 13:00:00 PM 1 PM;
   - the order found per file: month/day where every date exists so, and where every day is
     12 or less (either way: the instrument's order); day/month where some do not and every
     one does, its times going on as the rows do, back by an hour at most (a clock put back
     at the end of summer time), said (13/10/2025, 31/12/2025 across midnight and the year's
     end, the fall-back night); month/day in any other, a row whose date does not exist so
     left out, said with how many: one whose dates fail both ways (31/2 among 13/10 and
     14/10), a month/day file with one date mistyped day first (16/10 among 10/5 and 10/6),
     whose times day first would go back months. The times read so increase as the rows
     go, as the instrument's do (the fall-back night apart); a day/month file reads to the
     dates of its month/day twin;
   - a file left with no injection: refused with why when a row with a value went for its
     date, the rest counted; by its name alone when no row had a value, as at v509;
   - the fixture as before: its dates, no key more in its record, no alert;
   - the alert dismissed by its button for the files on show, through undo and redo, and
     said again for a file dropped since; a project reopened says it again; one edited by
     hand puts nothing in it but `true` and a whole count, and a name in it as text. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { start, openModule, loadFiles, settle, moduleState, undo, PAYLOAD, injected } from './helpers.mjs';

let env;
before(async ()=>{ env = await start(); });
after(()=> env && env.close());

// A GC export of these injection dates, H2 at 0.1 %mol more on each row.
const gc = (name, dates)=> ({ name, mimeType: 'text/csv',
  buffer: Buffer.from('Injection date,H2 (B) [%Mol]\n' + dates.map((d, i)=> `${d},${(0.1 + i/10).toFixed(2)}`).join('\n') + '\n') });
/* Each file, its dates, and what it should read to: the dates (UTC, the tests' time zone)
   and H2 of the rows kept, day/month or not, the rows left out. */
const CASES = [
  ['dm.csv', ['12/10/2025 11:30:00 PM', '12/10/2025 11:45:00 PM', '13/10/2025 12:00:00 AM', '13/10/2025 12:15:00 AM'],
    ['2025-10-12T23:30:00', '2025-10-12T23:45:00', '2025-10-13T00:00:00', '2025-10-13T00:15:00'], [0.1, 0.2, 0.3, 0.4], true, 0],
  ['dm-twin.csv', ['10/12/2025 11:30:00 PM', '10/12/2025 11:45:00 PM', '10/13/2025 12:00:00 AM', '10/13/2025 12:15:00 AM'],
    ['2025-10-12T23:30:00', '2025-10-12T23:45:00', '2025-10-13T00:00:00', '2025-10-13T00:15:00'], [0.1, 0.2, 0.3, 0.4], false, 0],
  ['feb30.csv', ['2/28/2025 9:00:00 AM', '2/30/2025 9:15:00 AM', '3/1/2025 9:30:00 AM'],
    ['2025-02-28T09:00:00', '2025-03-01T09:30:00'], [0.1, 0.3], false, 1],
  ['ye-md.csv', ['12/31/2025 11:30:00 PM', '12/31/2025 11:45:00 PM', '1/1/2026 12:00:00 AM', '1/1/2026 12:15:00 AM'],
    ['2025-12-31T23:30:00', '2025-12-31T23:45:00', '2026-01-01T00:00:00', '2026-01-01T00:15:00'], [0.1, 0.2, 0.3, 0.4], false, 0],
  ['ye-dm.csv', ['31/12/2025 11:30:00 PM', '31/12/2025 11:45:00 PM', '1/1/2026 12:00:00 AM', '1/1/2026 12:15:00 AM'],
    ['2025-12-31T23:30:00', '2025-12-31T23:45:00', '2026-01-01T00:00:00', '2026-01-01T00:15:00'], [0.1, 0.2, 0.3, 0.4], true, 0],
  ['noon.csv', ['10/20/2026 11:59:59 AM', '10/20/2026 12:00:00 PM', '10/20/2026 12:30:00 PM', '10/20/2026 1:00:00 PM'],
    ['2026-10-20T11:59:59', '2026-10-20T12:00:00', '2026-10-20T12:30:00', '2026-10-20T13:00:00'], [0.1, 0.2, 0.3, 0.4], false, 0],
  ['midnight.csv', ['10/19/2026 11:59:59 PM', '10/20/2026 12:00:00 AM', '10/20/2026 12:30:00 AM', '10/20/2026 1:00:00 AM'],
    ['2026-10-19T23:59:59', '2026-10-20T00:00:00', '2026-10-20T00:30:00', '2026-10-20T01:00:00'], [0.1, 0.2, 0.3, 0.4], false, 0],
  ['leap.csv', ['2/28/2024 11:00:00 PM', '2/29/2024 1:00:00 AM', '3/1/2024 1:00:00 AM'],
    ['2024-02-28T23:00:00', '2024-02-29T01:00:00', '2024-03-01T01:00:00'], [0.1, 0.2, 0.3], false, 0],
  ['noleap.csv', ['2/28/2025 11:00:00 PM', '2/29/2025 1:00:00 AM', '3/1/2025 1:00:00 AM'],
    ['2025-02-28T23:00:00', '2025-03-01T01:00:00'], [0.1, 0.3], false, 1],
  // 13:00 PM, 0:30 AM, 60 minutes, 60 seconds; then an hour of 12 or less and its date
  ['clock.csv', ['10/20/2026 9:00:00 AM', '10/20/2026 13:00:00 PM', '10/20/2026 0:30:00 AM', '10/20/2026 10:60:00 AM', '10/20/2026 10:00:60 AM', '10/20/2026 10:00:00 AM'],
    ['2026-10-20T09:00:00', '2026-10-20T10:00:00'], [0.1, 0.6], false, 4],
  // Every day 12 or less: either way, so the instrument's (2 and 3 January, not February).
  ['ambiguous.csv', ['1/2/2026 11:45:00 PM', '1/3/2026 12:00:00 AM', '1/3/2026 12:15:00 AM'],
    ['2026-01-02T23:45:00', '2026-01-03T00:00:00', '2026-01-03T00:15:00'], [0.1, 0.2, 0.3], false, 0],
  // Day first, and a 31 February that is no date either way: not every date exists day
  // first, so month/day, the instrument's, and the 3 rows that do not exist so left out.
  ['mixed.csv', ['12/10/2025 11:45:00 PM', '13/10/2025 12:00:00 AM', '31/2/2025 12:15:00 AM', '14/10/2025 12:30:00 AM'],
    ['2025-12-10T23:45:00'], [0.1], false, 3],
  // 3 dates exist month first, 5 day first, not all either way: month/day, its times going
  // on (day first they would go back from 5 October to 13 May).
  ['mixed2.csv', ['5/10/2025 9:00:00 AM', '5/10/2025 9:15:00 AM', '13/5/2025 9:30:00 AM', '13/5/2025 9:45:00 AM', '14/5/2025 10:00:00 AM', '5/31/2025 10:15:00 AM'],
    ['2025-05-10T09:00:00', '2025-05-10T09:15:00', '2025-05-31T10:15:00'], [0.1, 0.2, 0.6], false, 3],
  // 5 and 6 October month/day, one date mistyped day first: every one exists day first, but
  // its times would go May, October, June; month/day, the typo left out.
  ['typo.csv', ['10/5/2025 11:45:00 PM', '16/10/2025 12:00:00 AM', '10/6/2025 12:15:00 AM', '10/6/2025 12:30:00 AM'],
    ['2025-10-05T23:45:00', '2025-10-06T00:15:00', '2025-10-06T00:30:00'], [0.1, 0.3, 0.4], false, 1],
];
/* The night summer time ends, day first: the clock put back from 3 to 2 AM, the times go
   back 45 minutes (2:45, then 2:00 again), not more than an hour: still day/month. */
const FALLBACK = ['25/10/2026 1:45:00 AM', '25/10/2026 2:30:00 AM', '25/10/2026 2:45:00 AM', '25/10/2026 2:00:00 AM', '25/10/2026 2:15:00 AM', '25/10/2026 2:30:00 AM'];
// The fixture, as a buffer: a drop's files are all paths or all buffers.
const fixture = ()=> ({ name: path.basename(env.fx.files.gc[0]), mimeType: 'text/csv', buffer: fs.readFileSync(env.fx.files.gc[0]) });
const files = st => Object.fromEntries(st.files.map(f=> [f.name, f]));
const alerts = page => page.$$eval('#gcAlerts .alert', els=> els.map(e=> e.innerText.split('\n').map(s=> s.trim()).filter(Boolean)));
const DATES_HEAD = '⚠ Injection dates (the instrument writes them month/day):';
const datesAlert = async page => (await alerts(page)).find(a=> a[0] === DATES_HEAD) || null;
// A module's state put in as a tab opening a project puts it, and the state as a project file holds it (db.js).
const restore = (page, st)=> page.evaluate(async st=>{
  const u = await import('./utils.js'), db = await import('./db.js');
  u.restoreModuleState('gc', db.decode(st));
  for (let i = 0; i < 2; i++) await new Promise(r=> requestAnimationFrame(r));
}, st).then(()=> settle(page));
const encoded = page => page.evaluate(async ()=>{ const u = await import('./utils.js'), db = await import('./db.js'); return db.encode(u.getModuleState('gc')); });

test('dates that do not exist left out and said, a day/month file found and said, month/day files as before', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    // Refused: no date that exists; one row with a value whose date does not, the others with
    // no gas value; no gas value in any row, 2/30 or not (by its name, as at v509).
    const empty = (name, dates, hasValue = ()=> false)=> ({ name, mimeType: 'text/csv',
      buffer: Buffer.from('Injection date,H2 (B) [%Mol]\n' + dates.map((d, i)=> `${d},${hasValue(i) ? '0.5' : ''}`).join('\n') + '\n') });
    const ev = ['10/20/2026 9:00:00 AM', '10/20/2026 9:15:00 AM', '10/20/2026 9:30:00 AM', '2/30/2026 9:45:00 AM'];
    await loadFiles(page, 'gc', [fixture(), ...CASES.map(([n, d])=> gc(n, d)), gc('fallback.csv', FALLBACK),
      gc('none.csv', ['13/13/2025 9:00:00 AM', '0/5/2025 9:15:00 AM']), empty('badval.csv', ev, i=> i === 3), empty('emptyplusbad.csv', ev)], 1 + CASES.length);
    // (a drop's files are listed together: the fixture and the cases waited for, fallback.csv asked below)
    const by = files(await moduleState(page, 'gc', true));
    for (const [n, , dates, h2, dm, bad] of CASES){
      const f = by[n];
      assert.ok(f, n + ' not loaded');
      assert.deepEqual(f.injDates.map(d=> d.slice(0, 19)), dates, n + ': the dates');
      assert.deepEqual(f.gas.h2, h2, n + ': H2 of the rows kept');
      const t = f.injDates.map(d=> Date.parse(d));
      assert.ok(t.every((x, i)=> !i || x > t[i - 1]), n + ': the times increase');
      assert.equal(f.dayMonth, dm || undefined, n + ': day/month');
      assert.equal(f.badDates, bad || undefined, n + ': the rows left out');
      assert.equal(f.emptyRows, 0, n);
    }
    assert.deepEqual(by['dm.csv'].injDates, by['dm-twin.csv'].injDates, 'day/month reads to the dates of its month/day twin');
    const fb = by['fallback.csv'];
    assert.ok(fb, 'fallback.csv: read, not refused');
    assert.deepEqual(fb.injDates.map(d=> d.slice(0, 19)), ['2026-10-25T01:45:00', '2026-10-25T02:30:00', '2026-10-25T02:45:00', '2026-10-25T02:00:00', '2026-10-25T02:15:00', '2026-10-25T02:30:00'], 'the fall-back night: day/month');
    assert.equal(fb.dayMonth, true);
    assert.equal(fb.badDates, undefined);
    // The fixture as the instrument writes it: every 15 min from 9:00 AM on 20 October 2026, no key more.
    const fx = by['alpha.csv'];
    assert.deepEqual(fx.injDates, Array.from({ length: 24 }, (_, i)=> new Date(Date.UTC(2026, 9, 20, 9, 15*i)).toISOString()));
    assert.deepEqual(Object.keys(fx).sort(), ['color', 'emptyRows', 'gas', 'injDates', 'label', 'name', 'rawBytes']);
    for (const n of ['none.csv', 'badval.csv', 'emptyplusbad.csv']) assert.ok(!(n in by), n + ': no injection, not loaded');
    // Said: the file refused with why, then each file read day first or with rows left out.
    const al = await alerts(page);
    assert.deepEqual(al.find(a=> /Invalid file/.test(a[0])), ['✕ Invalid file(s):',
      'none.csv (no injection to read: 2 rows with an injection date that does not exist)',
      'badval.csv (no injection to read: 1 row with an injection date that does not exist, 3 with no gas value)',
      'emptyplusbad.csv']);
    assert.deepEqual(await datesAlert(page), [DATES_HEAD,
      'dm.csv: dates read as day/month (as month/day, some do not exist)',
      'feb30.csv: 1 row left out: its injection date does not exist (as month/day)',
      'ye-dm.csv: dates read as day/month (as month/day, some do not exist)',
      'noleap.csv: 1 row left out: its injection date does not exist (as month/day)',
      'clock.csv: 4 rows left out: their injection date does not exist (as month/day)',
      'mixed.csv: 3 rows left out: their injection date does not exist (as month/day)',
      'mixed2.csv: 3 rows left out: their injection date does not exist (as month/day)',
      'typo.csv: 1 row left out: its injection date does not exist (as month/day)',
      'fallback.csv: dates read as day/month (as month/day, some do not exist)']);
    // The analysis takes them as any other: a card's Results drawn, no page error.
    assert.ok(await page.locator('#gcResultsBar').isVisible());
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('the dates alert: dismissed for the files on show, through undo and redo; said for a file dropped since', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [fixture(), gc('dm.csv', CASES[0][1]), gc('feb30.csv', CASES[2][1])]);
    assert.equal((await datesAlert(page)).length, 3);
    await page.click('#gcAlerts [data-action="gc-dismiss-dates"]');
    await settle(page);
    assert.equal(await datesAlert(page), null, 'dismissed');
    await loadFiles(page, 'gc', [gc('apr31.csv', ['4/30/2025 11:45:00 PM', '4/31/2025 12:00:00 AM', '5/1/2025 12:15:00 AM'])]);
    assert.deepEqual(await datesAlert(page), [DATES_HEAD, 'apr31.csv: 1 row left out: its injection date does not exist (as month/day)'], 'the new file alone');
    await undo(page);
    assert.equal(await datesAlert(page), null, 'undone: the files on show dismissed');
    await undo(page, true);
    assert.deepEqual(await datesAlert(page), [DATES_HEAD, 'apr31.csv: 1 row left out: its injection date does not exist (as month/day)'], 'redone');
    // The file removed: nothing left to say.
    await page.locator('#gcFileTableWrap tr.file-row').nth(3).locator('.row-del').click();
    await settle(page);
    assert.equal(await datesAlert(page), null, 'its file removed');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('a project reopened says it again; one edited by hand puts only true and a whole count in it', async ()=>{
  const { page, errors, close } = await env.page();
  try {
    await openModule(page, 'gc');
    await loadFiles(page, 'gc', [gc('dm.csv', CASES[0][1]), gc('feb30.csv', CASES[2][1])]);
    await page.click('#gcAlerts [data-action="gc-dismiss-dates"]');
    await settle(page);
    const st = await encoded(page);
    await restore(page, st);
    const by = files(await moduleState(page, 'gc'));
    assert.equal(by['dm.csv'].dayMonth, true);
    assert.equal(by['feb30.csv'].badDates, 1);
    assert.deepEqual(await datesAlert(page), [DATES_HEAD,
      'dm.csv: dates read as day/month (as month/day, some do not exist)',
      'feb30.csv: 1 row left out: its injection date does not exist (as month/day)'], 'reopened: said again');
    // By hand: anything but true and a whole count above 0 says nothing; a name is text.
    const notTrue = [PAYLOAD, 'true', 1, null, {}], notCount = [PAYLOAD, '3', 1.5, -2, 0, true, null, { n: 3 }];
    const edited = JSON.parse(JSON.stringify(st)), [f0, f1] = edited.files;
    edited.files = [...notTrue.map(v=> ({ dayMonth: v })), ...notCount.map(v=> ({ badDates: v }))].map((o, i)=> ({ ...(i % 2 ? f1 : f0), dayMonth: undefined, badDates: undefined, ...o, name: `${PAYLOAD} ${i}.csv` }));
    edited.files.push({ ...f0, name: PAYLOAD + '.csv', dayMonth: true, badDates: 2 });
    await restore(page, edited);
    assert.equal(await page.locator('#gcFileTableWrap tr.file-row').count(), notTrue.length + notCount.length + 1);
    assert.deepEqual(await datesAlert(page), [DATES_HEAD, `${PAYLOAD}.csv: dates read as day/month (as month/day, some do not exist); 2 rows left out: their injection date does not exist (as day/month)`]);
    assert.deepEqual(await injected(page), [], 'nothing from the project made markup');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
