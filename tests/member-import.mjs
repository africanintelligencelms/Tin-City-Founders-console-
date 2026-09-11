import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

// Run after npm run build. Isolated state: never reads or writes the real room.
const cwd = await mkdtemp(path.join(tmpdir(), 'tcf-import-test-'));
const port = 31993;
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

  const members = [
    { name: 'Ada Obi', organization: 'GridFarm', tags: ['Tech / Software'], stage: 'Building / pre-launch',
      bio: 'Sensors for smallholder farms', giveAsk: 'An intro to agronomists', location: 'Jos',
      whatsapp: '08011111111', link: 'instagram.com/adaobi', listed: true, checkedInAt: '2026-08-01T09:00:00.000Z' },
    { name: 'Bala Musa', organization: 'PayRail', tags: ['Fintech'], stage: 'Growing / established',
      location: 'Bukuru', whatsapp: '0802 222 2222', listed: false },
    { name: 'Chidi Eze', organization: 'StudioC', tags: ['Creative / Media'], location: 'Jos', whatsapp: '+2348033333333' },
    { name: '', whatsapp: '08044444444' },                       // no name
    { name: 'Bad Number', whatsapp: '12' },                       // unusable phone
    { name: 'Ada Obi', organization: 'GridFarm Ltd', whatsapp: '+234 801 111 1111', giveAsk: 'Updated ask' } // same number as row 0
  ];

  // The import is host-only.
  await stranger('/api/admin/import-members', { members }, 403);

  const report = await host('/api/admin/import-members', { members });
  assert.equal(report.created, 3, JSON.stringify(report.results));
  assert.equal(report.merged, 1);   // the duplicate number folded into Ada
  assert.equal(report.skipped, 2);  // no name, unusable phone
  assert.equal(report.total, 3);

  // The merge updated the existing record rather than making a second Ada.
  const listed = (await stranger('/api/attendees')).attendees;
  assert.equal(listed.length, 3);
  const ada = listed.find(a => a.name === 'Ada Obi');
  assert.equal(ada.organization, 'GridFarm Ltd');
  assert.equal(ada.giveAsk, 'Updated ask');
  assert.equal(ada.bio, 'Sensors for smallholder farms');           // untouched by the merge row
  assert.equal(ada.link, 'https://instagram.com/adaobi');
  assert.equal(ada.stage, 'Building / pre-launch');
  assert.equal(ada.checkedInAt, '2026-08-01T09:00:00.000Z');        // the form's timestamp, not now
  assert.equal(ada.listed, true);
  assert.equal(listed.find(a => a.name === 'Bala Musa').listed, false);
  assert.equal(listed.find(a => a.name === 'Chidi Eze').listed, true); // default when unanswered

  // No phone number reaches a public payload.
  for (const endpoint of ['/api/attendees', '/api/live/sync']) {
    const body = JSON.stringify(await stranger(endpoint));
    for (const number of ['08011111111', '+2348011111111', '2348022222222', '+2348033333333']) {
      assert(!body.includes(number), endpoint + ' leaked ' + number);
    }
    assert(!body.includes('memberContacts'), endpoint + ' leaked the recovery map');
  }

  // THE REGRESSION THIS ROUTE EXISTS FOR.
  // Importing through POST /api/attendees would stamp the importer's voter id on
  // every row, so each member would recover onto the SAME cookie and the first
  // vote cast would consume everyone else's. Each imported member must recover
  // onto an identity of their own.
  const cookies = [];
  for (const number of ['08011111111', '08022222222', '08033333333']) {
    const device = browser();
    const recovered = await device('/api/profile/recover', { whatsapp: number });
    cookies.push(recovered.cookie);
  }
  assert.equal(new Set(cookies).size, 3, 'imported members share a voter identity: ' + JSON.stringify(cookies));

  // And their votes count separately rather than deduping against each other.
  const sector = (await stranger('/api/live/sync')).categories[0].name;
  // autoUpvote:false so the author does not add a vote of their own and the
  // count below is exactly the three imported members.
  const problem = await host('/api/problems', { title: 'Power', description: 'Grid instability', category: sector, submittedBy: 'Host', autoUpvote: false }, 201);
  const problemId = problem.problem?.id || problem.id;
  for (const cookie of cookies) {
    await fetch(`http://127.0.0.1:${port}/api/problems/${problemId}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ voterName: 'Member' })
    });
  }
  const counted = (await stranger('/api/problems')).problems.find(p => p.id === problemId);
  assert.equal(counted.upvotes, 3, 'three members voted but ' + counted.upvotes + ' counted');

  // An imported row is owned, so a stranger cannot claim it the way an
  // ownerless pre-import row can.
  await stranger('/api/attendees', { id: ada.id, name: 'Ada Obi', bio: 'hijacked' }, 403);

  // Survives a restart.
  await stop(); await start();
  const returning = browser();
  const again = await returning('/api/profile/recover', { whatsapp: '08011111111' });
  assert.equal(again.attendee.organization, 'GridFarm Ltd');
  assert.equal((await returning('/api/profile/me')).attendee.stage, 'Building / pre-launch');

  console.log('PASS: host gate, merge on number, field mapping, listed flag, phone privacy, distinct voter identities, vote independence, claim resistance, restart.');
} finally {
  await stop();
  await rm(cwd, { recursive: true, force: true });
}
