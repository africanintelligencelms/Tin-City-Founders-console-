import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

// Run after npm run build. Isolated state: never reads or writes the real room.
//
// mixerLive tells the community screen whether to offer a way into mixer mode.
// It exists because nothing else can answer that question: activePhase always
// holds a value and defaults to "voting", so there is no "no event running"
// state to read from it.
const cwd = await mkdtemp(path.join(tmpdir(), 'tcf-mixer-live-'));
const port = 31985;
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

async function call(url, body, { host = false, expected = 200 } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(host ? { 'x-tcf-host': 'test-host' } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const result = await response.json();
  assert.equal(response.status, expected, url + ' -> ' + JSON.stringify(result));
  return result;
}

try {
  await start();

  // Off by default. Outside an event, the community screen must not offer a
  // door into a host-driven view with nothing behind it.
  assert.equal((await call('/api/session/state')).sessionState.mixerLive, false);

  // Only the host can flip it.
  await call('/api/session/state', { mixerLive: true }, { expected: 403 });
  assert.equal((await call('/api/session/state')).sessionState.mixerLive, false, 'an ungated request changed it');

  await call('/api/session/state', { mixerLive: true }, { host: true });
  assert.equal((await call('/api/session/state')).sessionState.mixerLive, true);

  // Visible to an anonymous visitor — that is the whole point of the flag.
  assert.equal((await call('/api/live/sync')).sessionState.mixerLive, true);

  // Setting an unrelated field must not disturb it.
  await call('/api/session/state', { phaseTitle: 'Something else' }, { host: true });
  assert.equal((await call('/api/session/state')).sessionState.mixerLive, true, 'an unrelated update cleared it');

  // Anything truthy/falsy coerces to a real boolean rather than being stored raw.
  await call('/api/session/state', { mixerLive: 0 }, { host: true });
  assert.strictEqual((await call('/api/session/state')).sessionState.mixerLive, false);

  // Survives a restart: an event running across a deploy stays running.
  await call('/api/session/state', { mixerLive: true }, { host: true });
  await stop(); await start();
  assert.equal((await call('/api/session/state')).sessionState.mixerLive, true, 'lost across a restart');

  console.log('PASS: off by default, host-gated, readable anonymously, survives unrelated updates, coerced to boolean, persists across a restart.');
} finally {
  await stop();
  await rm(cwd, { recursive: true, force: true });
}
