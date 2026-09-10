import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

// Run after npm run build. Isolated state: never reads or writes the real room.
const cwd = await mkdtemp(path.join(tmpdir(), 'tcf-profile-edit-test-'));
const port = 31995;
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
  const member=browser(), other=browser();
  const profile={id:'editing-member',name:'Old Name',whatsapp:'08012345678'};
  await member('/api/attendees',profile);
  const problem=(await member('/api/problems')).problems[0];
  await member(`/api/problems/${problem.id}/join-squad`,{skill:'Engineering'});
  const round=(await member('/api/round/open',{kind:'problem',durationHours:48})).round;
  await member('/api/round/join-squad',{roundId:round.id,optionId:round.options[0].id,skill:'Design'});
  await member('/api/round/vote',{roundId:round.id,selections:[round.options[0].id]});
  for (const linkedin of ['javascript:alert(1)','https://linkedin.com.evil.test/in/name','https://example.com/in/name']) await member('/api/attendees',{...profile,linkedin},400);
  await member('/api/attendees',{...profile,avatarColor:'red'},400);
  const edited={...profile,name:'New Name',organization:'Plateau Labs',linkedin:'www.linkedin.com/in/new-name?tracking=1',avatarColor:'#0F6B5C'};
  const saved=await member('/api/attendees',edited);
  assert.equal(saved.attendee.linkedin,'https://www.linkedin.com/in/new-name');
  assert.equal(saved.attendee.organization,'Plateau Labs');
  assert.equal((await member('/api/problems')).problems[0].squadMembers[0].name,'New Name');
  assert.equal((await member('/api/round')).round.options[0].squadMembers[0].name,'New Name');
  assert.equal((await member('/api/round')).myBallot.hasVoted,true);
  await other('/api/attendees',edited,403);
  await member('/api/profile/signout',{});
  assert.equal((await member('/api/profile/me')).attendee,null);
  assert.equal((await member('/api/round')).myBallot.hasVoted,false);
  await member('/api/attendees',edited,403);
  await member('/api/profile/recover',{whatsapp:'08012345678'});
  assert.equal((await member('/api/round')).myBallot.hasVoted,true);
  assert.equal((await member('/api/profile/me')).attendee.organization,'Plateau Labs');
  await stop(); await start();
  assert.equal((await member('/api/profile/me')).attendee.avatarColor,'#0F6B5C');
  await member('/api/attendees',{...edited,organization:'',linkedin:''});
  assert.equal((await member('/api/profile/me')).attendee.linkedin,'');
  console.log('PASS: profile editing, URL validation, name propagation, identity preservation, sign-out isolation, recovery, restart and clearing optional fields.');
} finally {
  await stop();
  assert(cwd.startsWith(path.join(tmpdir(),'tcf-profile-edit-test-')));
  await rm(cwd,{recursive:true,force:true});
}
