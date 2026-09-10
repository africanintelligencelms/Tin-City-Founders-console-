import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

// Run after npm run build. Isolated state: never reads or writes the real room.
const cwd = await mkdtemp(path.join(tmpdir(), 'tcf-squad-test-'));
const port = 31992;
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
  const host = browser(), member = browser(), recovered = browser(), other = browser();
  await member('/api/attendees', {id:'squad-member', name:'Amina', whatsapp:'08012345678'});
  await other('/api/attendees', {id:'other-member', name:'Amina'});
  const problems = (await member('/api/problems')).problems;
  const problemId = problems[0].id;
  await member(`/api/problems/${problemId}/join-squad`, {skill:42},400);
  const joined = await member(`/api/problems/${problemId}/join-squad`, {skill:'Engineering',name:'Spoofed'});
  assert.equal(joined.problem.squadMembers[0].name,'Amina');
  assert.equal(joined.problem.squadMembers[0].superpower,'Engineering');
  await member(`/api/problems/${problemId}/join-squad`, {skill:'Design'},409);
  await host('/api/round/open',{kind:'problem',allowSquadSignup:'yes'},400);
  let round=(await host('/api/round/open',{kind:'problem',durationHours:48,allowSquadSignup:false})).round;
  await member('/api/round/join-squad',{roundId:round.id,optionId:round.options[0].id,skill:'Design'},409);
  await host('/api/round/close',{});
  round=(await host('/api/round/open',{kind:'problem',durationHours:48})).round;
  const request={roundId:round.id,optionId:round.options[0].id,skill:'Engineering'};
  await browser()('/api/round/join-squad',request,401);
  await member('/api/round/join-squad',{...request,skill:''},400);
  await member('/api/round/join-squad',{...request,optionId:'missing'},404);
  await member('/api/round/join-squad',request);
  await member('/api/round/join-squad',request);
  await other('/api/round/join-squad',{...request,skill:'Design'});
  round=(await member('/api/round')).round;
  assert.equal(round.options[0].squadMembers.length,2);
  assert.equal(round.ballotsCast,0,'Squad signup must not cast a ballot');
  assert(!JSON.stringify(round).includes('2348012345678'));
  await stop(); await start();
  await recovered('/api/profile/recover',{whatsapp:'+2348012345678'});
  assert.equal((await recovered('/api/round')).round.options[0].squadMembers.length,2);
  assert.equal((await recovered('/api/problems')).problems[0].squadMembers[0].superpower,'Engineering');
  await recovered('/api/round/join-squad',{...request,leave:true});
  assert.equal((await host('/api/round')).round.options[0].squadMembers[0].id,'other-member');
  await host('/api/round/close',{});
  await recovered('/api/round/join-squad',request);
  await host('/api/round/open',{kind:'category',durationHours:24});
  const archived=await recovered('/api/round/join-squad',{...request,leave:true});
  assert.equal(archived.archived,true);
  assert.equal(archived.round.options[0].squadMembers.length,1);
  console.log('PASS: skills, duplicate names, idempotent round membership, disabled signup, no implied ballot, privacy, restart, recovery, closed and archived squads.');
} finally {
  await stop();
  assert(cwd.startsWith(path.join(tmpdir(),'tcf-squad-test-')));
  await rm(cwd,{recursive:true,force:true});
}
