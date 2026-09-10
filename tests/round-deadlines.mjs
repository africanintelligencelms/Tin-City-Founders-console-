import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

// Run after npm run build. Isolated state: never reads or writes the real room.
const cwd = await mkdtemp(path.join(tmpdir(), 'tcf-deadline-test-'));
const port = 31990;
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
  const host = browser();
  for (const durationHours of [0, -1, 721, "48", null]) await host('/api/round/open', { kind: 'problem', durationHours }, 400);
  await host('/api/round/open', { kind: 'problem', endsAt: 'not-a-date' }, 400);
  await host('/api/round/open', { kind: 'problem', endsAt: new Date(Date.now()-1000).toISOString() }, 400);
  let round = (await host('/api/round/open', { kind: 'problem', durationHours: 48 })).round;
  assert.equal(Date.parse(round.endsAt) - round.openedAt, 48*3600000);
  const originalEnd = round.endsAt;
  let denied = await fetch(`http://127.0.0.1:${port}/api/round/extend`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roundId:round.id})});
  assert.equal(denied.status,403);
  await host('/api/round/extend', {roundId:'stale'},409);
  round = (await host('/api/round/extend', {roundId:round.id})).round;
  assert.equal(Date.parse(round.endsAt)-Date.parse(originalEnd),24*3600000);
  await host('/api/round/vote',{roundId:round.id,selections:[round.options[0].id]});
  await stop(); await start();
  assert.equal((await host('/api/round')).round.endsAt,round.endsAt);
  // Simulate a deadline passing while the server is offline, using only isolated fixture state.
  await stop();
  const statePath=path.join(cwd,'.data','room_state.json');
  const state=JSON.parse(await readFile(statePath,'utf8'));
  state.activeRound.endsAt=new Date(Date.now()-1000).toISOString();
  await writeFile(statePath,JSON.stringify(state));
  await start();
  const closed=(await host('/api/round')).round;
  assert.equal(closed.status,'revealed'); assert.equal(closed.ballotsCast,1);
  assert.equal(closed.results[0].votes,1);
  assert.equal(closed.closedAt,Date.parse(state.activeRound.endsAt));
  await host('/api/round/vote',{roundId:closed.id,selections:[closed.options[1].id]},409);
  await host('/api/round/extend',{roundId:closed.id},409);
  await stop(); await start();
  assert.equal((await host('/api/round')).round.id,closed.id);
  // Background expiry emits a close event without a polling request.
  const stream=await fetch(`http://127.0.0.1:${port}/api/live/stream`);
  const reader=stream.body.getReader();
  round=(await host('/api/round/open',{kind:'category',endsAt:new Date(Date.now()+1800).toISOString()})).round;
  let events='';
  const timeout=setTimeout(()=>reader.cancel(),6000);
  while(!events.includes('event: ROUND_CLOSED')) {
    const part=await reader.read(); if(part.done) break;
    events+=new TextDecoder().decode(part.value);
  }
  clearTimeout(timeout); await reader.cancel();
  assert(events.includes('event: ROUND_CLOSED'));
  assert.equal((await host('/api/round')).round.status,'revealed');
  await host('/api/round/vote',{roundId:round.id,selections:[round.options[0].id]},409);
  // Old clients still get manual mixer rounds and the original reveal timer.
  round=(await host('/api/round/open',{kind:'problem'})).round;
  assert.equal(round.endsAt,undefined);
  await host('/api/round/close',{revealMs:50});
  await new Promise(r=>setTimeout(r,100));
  assert.equal((await host('/api/round')).round,null);
  console.log('PASS: deadline validation, host-only extension, restart recovery, preserved results, SSE auto-close, late vote rejection, and manual mixer compatibility.');
} finally {
  await stop();
  assert(path.resolve(cwd).startsWith(path.resolve(tmpdir())+path.sep+'tcf-deadline-test-'));
  await rm(cwd,{recursive:true,force:true});
}
