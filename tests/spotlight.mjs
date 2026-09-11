import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

// Run after npm run build. Isolated state: never reads or writes the real room.
const cwd = await mkdtemp(path.join(tmpdir(), 'tcf-spotlight-'));
const port = 31989;
let server;
async function start() {
  server = spawn(process.execPath, [path.resolve('dist/server.cjs')], {
    cwd, env: { ...process.env, PORT: String(port), NODE_ENV: 'production', HOST_KEY: 'test-host' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  let log = '';
  server.stdout.on('data', d => { log += d; });
  server.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 100; i++) {
    if (log.includes('Real-Time Server running')) return;
    if (server.exitCode !== null) throw new Error(log);
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server did not start: ' + log);
}
async function stop() { if (server && server.exitCode === null) { const done = once(server, 'exit'); server.kill(); await done; } }

function browser({ host = false } = {}) {
  let cookie = '';
  return async (url, body, expected = 200, method) => {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(host ? { 'x-tcf-host': 'test-host' } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const result = await response.json();
    assert.equal(response.status, expected, url + ' -> ' + JSON.stringify(result));
    return { ...result, cookie };
  };
}

try {
  await start();
  const host = browser({ host: true });
  const stranger = browser();

  await host('/api/admin/import-members', { members: [
    { name: 'Ada Obi', organization: 'GridFarm', stage: 'Building / pre-launch', bio: 'Sensors', giveAsk: 'Agronomists', whatsapp: '08011111111', location: 'Jos' },
    { name: 'Bala Musa', organization: 'PayRail', whatsapp: '08022222222', listed: false },
    { name: 'Chidi Eze', organization: 'StudioC', whatsapp: '08033333333' }
  ] });
  const members = (await stranger('/api/attendees')).attendees;
  const id = name => members.find(m => m.name === name).id;

  // ---------- the picked path ----------
  assert.equal((await stranger('/api/spotlight')).spotlight, null);
  await stranger('/api/spotlight', { memberId: id('Ada Obi') }, 403);
  await host('/api/spotlight', { memberId: 'att-nobody' }, 404);
  await host('/api/spotlight', { memberId: id('Ada Obi'), days: 0 }, 400);
  await host('/api/spotlight', { memberId: id('Ada Obi'), days: 91 }, 400);
  await host('/api/spotlight', { memberId: id('Ada Obi'), note: 'x'.repeat(401) }, 400);

  const picked = await host('/api/spotlight', { memberId: id('Ada Obi'), note: 'Shipped the pilot' });
  assert.equal(picked.spotlight.source, 'picked');
  assert.equal(picked.spotlight.name, 'Ada Obi');
  assert.equal(picked.spotlight.organization, 'GridFarm');
  assert.equal(picked.spotlight.note, 'Shipped the pilot');
  assert.ok(picked.spotlight.endsAt, 'a picked spotlight gets a clock');

  // A community-only member can hold the spotlight — it runs inside the app,
  // which is what they consented to. The flag travels with the record.
  const priv = await host('/api/spotlight', { memberId: id('Bala Musa') });
  assert.equal(priv.spotlight.listed, false);
  // Replacing retires the previous one into history rather than dropping it.
  let state = await stranger('/api/spotlight');
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].name, 'Ada Obi');
  assert.ok(state.history[0].endedAt);

  // ---------- the record is a copy, not a reference ----------
  const ada = browser();
  await ada('/api/profile/recover', { whatsapp: '08011111111' });
  await ada('/api/attendees', { id: id('Ada Obi'), name: 'Ada Obi-Nwosu', organization: 'GridFarm International' });
  state = await stranger('/api/spotlight');
  assert.equal(state.history[0].name, 'Ada Obi', 'history rewrote itself when the member edited their profile');
  assert.equal(state.history[0].organization, 'GridFarm');

  // And it survives the member being removed from the directory entirely.
  await host(`/api/attendees/${id('Ada Obi')}`, undefined, 200, 'DELETE');
  state = await stranger('/api/spotlight');
  assert.equal(state.history[0].name, 'Ada Obi', 'history lost a spotlight when the member left');

  await host('/api/spotlight', undefined, 200, 'DELETE');
  await host('/api/spotlight', undefined, 409, 'DELETE');   // nothing running
  assert.equal((await stranger('/api/spotlight')).spotlight, null);
  assert.equal((await stranger('/api/spotlight')).history.length, 2);

  // ---------- the voted path ----------
  const opened = await host('/api/round/open', { kind: 'member', title: 'Spotlight this week', maxSelections: 1, durationHours: 168 });
  assert.equal(opened.round.options.length, 2, 'the ballot is built from the directory');
  const bala = opened.round.options.find(o => o.label === 'Bala Musa');
  const chidi = opened.round.options.find(o => o.label === 'Chidi Eze');

  // A tie must promote nobody rather than inventing a winner from ballot order.
  for (const [number, choice] of [['08022222222', bala], ['08033333333', chidi]]) {
    const device = browser();
    await device('/api/profile/recover', { whatsapp: number });
    await device('/api/round/vote', { roundId: opened.round.id, selections: [choice.id] });
  }
  await host('/api/round/close', { roundId: opened.round.id });
  assert.equal((await stranger('/api/spotlight')).spotlight, null, 'a tie promoted someone');

  // A clear winner is promoted automatically on close.
  await host('/api/round', undefined, 200, 'DELETE');
  const second = await host('/api/round/open', { kind: 'member', title: 'Spotlight, again', maxSelections: 1, durationHours: 168 });
  const target = second.round.options.find(o => o.label === 'Chidi Eze');
  for (const number of ['08022222222', '08033333333']) {
    const device = browser();
    await device('/api/profile/recover', { whatsapp: number });
    await device('/api/round/vote', { roundId: second.round.id, selections: [target.id] });
  }
  await host('/api/round/close', { roundId: second.round.id });
  const won = (await stranger('/api/spotlight')).spotlight;
  assert.equal(won.name, 'Chidi Eze');
  assert.equal(won.source, 'voted');
  assert.equal(won.votes, 2);
  assert.equal(won.roundId, second.round.id);
  assert.equal(Math.round((Date.parse(won.endsAt) - won.startedAt) / 86400000), 7, 'a 168h ballot gives a 7 day spotlight');

  // A ballot nobody voted in promotes nobody.
  await host('/api/round', undefined, 200, 'DELETE');
  await host('/api/spotlight', undefined, 200, 'DELETE');
  const empty = await host('/api/round/open', { kind: 'member', title: 'Nobody votes', maxSelections: 1 });
  await host('/api/round/close', { roundId: empty.round.id });
  assert.equal((await stranger('/api/spotlight')).spotlight, null, 'an empty ballot promoted someone');
  await host('/api/round', undefined, 200, 'DELETE');

  // ---------- no contact details in the public payload ----------
  for (const endpoint of ['/api/spotlight', '/api/live/sync']) {
    const body = JSON.stringify(await stranger(endpoint));
    for (const number of ['08022222222', '+2348022222222', '+2348033333333']) {
      assert(!body.includes(number), endpoint + ' leaked ' + number);
    }
  }

  // ---------- the clock, and a restart ----------
  await host('/api/spotlight', { memberId: id('Chidi Eze'), days: 0.00002 });   // ~1.7s
  assert.ok((await stranger('/api/spotlight')).spotlight);
  await new Promise(r => setTimeout(r, 2600));
  assert.equal((await stranger('/api/spotlight')).spotlight, null, 'an expired spotlight is still showing');
  const retired = (await stranger('/api/spotlight')).history[0];
  assert.equal(retired.name, 'Chidi Eze');

  await host('/api/spotlight', { memberId: id('Chidi Eze'), note: 'Survives a restart' });
  await stop(); await start();
  const after = await browser()('/api/spotlight');
  assert.equal(after.spotlight.name, 'Chidi Eze');
  assert.equal(after.spotlight.note, 'Survives a restart');
  assert.ok(after.history.length >= 4);

  console.log('PASS: host gate, picked path, voted path, ties and empty ballots promote nobody, history is a copy that outlives edits and deletions, community-only eligibility, contact privacy, the clock, and restart.');
} finally {
  await stop();
  await rm(cwd, { recursive: true, force: true });
}
