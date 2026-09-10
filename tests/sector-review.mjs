import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

// Run after npm run build. Isolated state: never reads or writes the real room.
const cwd = await mkdtemp(path.join(tmpdir(), 'tcf-sector-review-test-'));
const port = 31997;
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
  const host=browser(), member=browser(), stranger=browser();
  await member('/api/attendees',{id:'suggesting-member',name:'Amina',whatsapp:'08012345678'});
  await stranger('/api/sector-suggestions',{name:'Health',description:''},401);
  await member('/api/sector-suggestions',{name:'Health',description:'Local clinics'},201);
  await member('/api/sector-suggestions',{name:'health',description:''},409);
  assert(!(await host('/api/categories')).categories.some(c=>c.name==='Health'));
  let suggestions=(await host('/api/sector-suggestions')).suggestions;
  await host(`/api/sector-suggestions/${suggestions[0].id}/review`,{action:'approve'});
  await host(`/api/sector-suggestions/${suggestions[0].id}/review`,{action:'approve'},409);
  assert((await host('/api/categories')).categories.some(c=>c.name==='Health'));
  await member('/api/sector-suggestions',{name:'Clinics',description:'Medical help'},201);
  suggestions=(await host('/api/sector-suggestions')).suggestions;
  await host(`/api/sector-suggestions/${suggestions[0].id}/review`,{action:'map',target:'Missing'},400);
  await host(`/api/sector-suggestions/${suggestions[0].id}/review`,{action:'map',target:'Health'});
  assert.equal((await member('/api/sector-suggestions/mine')).suggestions.find(s=>s.name==='Clinics').resolvedSector,'Health');
  assert.equal((await stranger('/api/sector-suggestions/mine')).suggestions.length,0);
  await member('/api/sector-suggestions',{name:'Unneeded',description:''},201);
  suggestions=(await host('/api/sector-suggestions')).suggestions;
  await host(`/api/sector-suggestions/${suggestions[0].id}/review`,{action:'dismiss'});
  const denied=await fetch(`http://127.0.0.1:${port}/api/sector-suggestions`);
  assert.equal(denied.status,403);
  const deniedDelete=await fetch(`http://127.0.0.1:${port}/api/categories/Health`,{method:'DELETE'});
  assert.equal(deniedDelete.status,403);
  const problem=(await member('/api/problems',{title:'Care',description:'Access',category:'Health'},201)).problem;
  await member('/api/categories/Health/vote',{});
  const round=(await host('/api/round/open',{kind:'category',durationHours:48})).round;
  await member('/api/round/vote',{roundId:round.id,selections:['Health']});
  await host('/api/categories/Health',{},400,'DELETE');
  await host('/api/categories/Health',{replacement:'Health'},400,'DELETE');
  await host('/api/categories/Health',{replacement:'Infrastructure'},200,'DELETE');
  assert.equal((await member('/api/problems')).problems.find(p=>p.id===problem.id).category,'Infrastructure');
  assert(!(await member('/api/votes/mine')).categories.includes('Health'));
  assert(!(await member('/api/votes/mine')).categories.includes('Infrastructure'));
  await host('/api/round/close',{});
  assert.equal((await host(`/api/round?round=${round.id}`)).round.results.find(r=>r.optionId==='Health').votes,1);
  await host('/api/categories',{name:'Unused',description:''},201);
  await host('/api/categories/Unused',{},200,'DELETE');
  await stop(); await start();
  assert(!(await host('/api/categories')).categories.some(c=>c.name==='Health'));
  const mine=(await member('/api/sector-suggestions/mine')).suggestions;
  assert.equal(mine.length,3);
  assert.equal(mine.find(s=>s.name==='Clinics').resolvedSector,'Infrastructure');
  console.log('PASS: member suggestions, privacy, host review, approval/mapping/dismissal, safe deletion, reassignment, vote removal, preserved ballot results and restart.');
} finally {
  await stop();
  assert(cwd.startsWith(path.join(tmpdir(),'tcf-sector-review-test-')));
  await rm(cwd,{recursive:true,force:true});
}
