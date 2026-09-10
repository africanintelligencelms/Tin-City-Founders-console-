import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

// Run after npm run build. Isolated state: never reads or writes the real room.
const cwd = await mkdtemp(path.join(tmpdir(), 'tcf-sector-test-'));
const port = 31996;
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
  return async (url, body, expected = 200, method) => {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
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
  const host=browser(), voter=browser();
  const unauthorized=await fetch(`http://127.0.0.1:${port}/api/categories`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Denied',description:''})});
  assert.equal(unauthorized.status,403);
  await host('/api/categories',{name:'Health & Care',description:'Community health'},201);
  await host('/api/categories',{name:'health & care',description:''},409);
  for (const name of ['', '__proto__', 'All', 'x'.repeat(81)]) await host('/api/categories',{name,description:''},400);
  const created=await voter('/api/problems',{title:'Clinic access',description:'Better access',category:'Health & Care'},201);
  await voter('/api/categories/Health%20%26%20Care/vote',{});
  const round=(await host('/api/round/open',{kind:'category',durationHours:48})).round;
  await voter('/api/round/vote',{roundId:round.id,selections:['Health & Care']});
  await host('/api/categories/Health%20%26%20Care',{name:'Healthcare',description:'Updated description'},200,'PATCH');
  const sectors=(await host('/api/categories')).categories;
  assert(!sectors.some(c=>c.name==='Health & Care'));
  assert.equal(sectors.find(c=>c.name==='Healthcare').upvotes,1);
  assert.equal(sectors.find(c=>c.name==='Healthcare').problemCount,1);
  assert((await voter('/api/votes/mine')).categories.includes('Healthcare'));
  assert.equal((await voter('/api/problems')).problems.find(p=>p.id===created.problem.id).category,'Healthcare');
  await voter('/api/categories/Healthcare/vote',{},409);
  await voter('/api/problems',{title:'Stale submission',description:'Old form',category:'Health & Care'},400);
  await host('/api/categories/Healthcare',{name:'Infrastructure',description:''},409,'PATCH');
  await host('/api/round/close',{});
  const saved=(await host(`/api/round?round=${round.id}`)).round;
  assert.equal(saved.results.find(r=>r.optionId==='Health & Care').votes,1);
  await stop(); await start();
  assert.equal((await host('/api/categories')).categories.find(c=>c.name==='Healthcare').description,'Updated description');
  await voter('/api/categories/Healthcare/vote',{increment:false});
  assert.equal((await host('/api/categories')).categories.find(c=>c.name==='Healthcare').upvotes,0);
  console.log('PASS: host-only creation, duplicate validation, renamed challenges and votes, frozen ballot wording, stale submission rejection, restart and vote retraction.');
} finally {
  await stop();
  assert(cwd.startsWith(path.join(tmpdir(),'tcf-sector-test-')));
  await rm(cwd,{recursive:true,force:true});
}
