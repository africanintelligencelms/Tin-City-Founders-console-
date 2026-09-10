import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

// Run after npm run build. Isolated state: never reads or writes the real room.
const cwd = await mkdtemp(path.join(tmpdir(), 'tcf-ballot-test-'));
const port = 31993;
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
  const host=browser(), voter=browser(), observer=browser(), second=browser();
  let round=(await host('/api/round/open',{kind:'problem',durationHours:48,maxSelections:2})).round;
  const url=`/api/round?round=${encodeURIComponent(round.id)}`;
  assert.equal((await observer(url)).round.results,undefined);
  assert(!(await observer('/api/round/history')).rounds.some(r=>r.id===round.id));
  await voter('/api/round/vote',{roundId:round.id,selections:[round.options[0].id,round.options[1].id]});
  const voted=await voter(url);
  assert.equal(voted.round.results[0].votes,1);
  assert.equal(voted.round.results[0].share,1);
  assert.equal(voted.round.results[1].share,1);
  assert.equal((await observer(url)).round.results,undefined);
  const publicState=await observer('/api/session/state');
  assert(!JSON.stringify(publicState).includes('"results"'),'Live result leaked into shared state');
  await second('/api/round/vote',{roundId:round.id,selections:[round.options[0].id]});
  assert.equal((await voter(url)).round.results[1].share,0.5);
  await voter('/api/round/vote',{roundId:round.id,selections:[round.options[1].id]});
  assert.equal((await voter(url)).round.results[0].votes,1);
  await observer('/api/round?round=missing',undefined,404);
  await host('/api/round/close',{});
  const recent=(await observer('/api/round/history')).rounds;
  assert.equal(recent[0].id,round.id);
  assert.equal(recent[0].ballotsCast,2);
  const closed=await observer(url);
  assert.equal(closed.round.results.length,round.options.length);
  await host('/api/round/open',{kind:'category',durationHours:24});
  const archived=await observer(url);
  assert.equal(archived.round.id,round.id);
  assert.equal(archived.round.status,'revealed');
  await voter('/api/round/vote',{roundId:round.id,selections:[round.options[0].id]},409);
  for (let i=0; i<21; i++) {
    await host('/api/round/close',{});
    await host('/api/round/open',{kind:'category',durationHours:24});
  }
  await stop(); await start();
  const history=(await observer('/api/round/history')).rounds;
  assert(history.length>20);
  assert.equal(new Set(history.map(r=>r.id)).size,history.length);
  assert(history.some(r=>r.id===round.id));
  assert(history.every((r,i)=>i===0 || history[i-1].closedAt>=r.closedAt));
  assert.equal((await observer(url)).round.id,round.id);
  assert.equal((await observer(url)).round.results[0].votes,1);
  const response=await fetch(`http://127.0.0.1:${port}${url}`);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  console.log('PASS: pre-vote privacy, voter-only live percentages, changed votes, multi-select denominator, exact archived links, unknown links, stale vote rejection, restart and cache protection.');
} finally {
  await stop();
  assert(cwd.startsWith(path.join(tmpdir(),'tcf-ballot-test-')));
  await rm(cwd,{recursive:true,force:true});
}
