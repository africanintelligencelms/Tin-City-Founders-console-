import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

// Run after npm run build. Isolated state: never reads or writes the real room.
const cwd = await mkdtemp(path.join(tmpdir(), 'tcf-profile-test-'));
const port = 31987;
let server;
async function start() {
  server = spawn(process.execPath, [path.resolve('dist/server.cjs')], {
    cwd, env: { ...process.env, PORT: String(port), NODE_ENV: 'production', SEED_ROOM: '1', HOST_KEY: 'test-host' },
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
function browser() {
  let cookie = '';
  return async (url, body, expected = 200) => {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie, 'x-tcf-host': 'test-host' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  };
}
try {
  await start();
  const first = browser(), second = browser(), stranger = browser();
  const profile = { id: 'test-member', name: 'Test Member', avatarColor: '#0D4734' };
  await first('/api/attendees', profile);
  const saved = await first('/api/attendees', { ...profile, whatsapp: '0801 234 5678', bio: 'Restored bio' });
  assert.equal(saved.attendee.whatsapp, '+2348012345678');
  assert(!JSON.stringify(saved.attendees).includes('+2348012345678'));
  await stranger('/api/attendees', { id: 'other', name: 'Test Member' });
  await stranger('/api/attendees', { id: 'other', name: 'Test Member', whatsapp: '+2348012345678' }, 409);
  await stranger('/api/attendees', { id: 'other', name: 'Test Member', whatsapp: '123' }, 400);
  await stranger('/api/attendees', { ...profile, whatsapp: '+2348099999999' }, 403);
  const problems = (await first('/api/problems')).problems;
  const problemId = problems[0].id;
  await first(`/api/problems/${problemId}/vote`, { voterName: profile.name });
  await first(`/api/problems/${problemId}/join-squad`, { voterName: profile.name });
  const opened = await first('/api/round/open', { kind: 'problem', title: 'Recovery test' });
  await first('/api/round/vote', { roundId: opened.round.id, selections: [opened.round.options[0].id] });
  const mine = await first('/api/votes/mine');
  const recovered = await second('/api/profile/recover', { whatsapp: '002348012345678' });
  assert.equal(recovered.attendee.id, profile.id);
  assert.equal(recovered.attendee.bio, 'Restored bio');
  assert.deepEqual(await second('/api/votes/mine'), mine);
  assert.equal((await second('/api/round')).myBallot.hasVoted, true);
  for (const endpoint of ['/api/attendees', '/api/live/sync']) {
    const publicData = JSON.stringify(await stranger(endpoint));
    assert(!publicData.includes('+2348012345678'), endpoint + ' leaked phone');
    assert(!publicData.includes('memberContacts'), endpoint + ' leaked recovery map');
  }
  await stranger('/api/profile/recover', { whatsapp: '+2348099999999' }, 404);
  await second('/api/attendees', { ...recovered.attendee, whatsapp: '+44 7700 900123' });
  await stranger('/api/profile/recover', { whatsapp: '08012345678' }, 404);
  await stop(); await start();
  const third = browser();
  assert.equal((await third('/api/profile/recover', { whatsapp: '+44 (7700) 900123' })).attendee.id, profile.id);
  assert.deepEqual(await third('/api/votes/mine'), mine);
  assert.equal((await third('/api/profile/me')).attendee.whatsapp, '+447700900123');
  assert.equal((await third('/api/round')).myBallot.hasVoted, true);
  console.log('PASS: quick entry, formatting, duplicate names/numbers, privacy, cross-device votes and squads, number changes, restart persistence.');
} finally {
  await stop();
  await rm(cwd, { recursive: true, force: true });
}
