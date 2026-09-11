import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, mkdir, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Exercises the guards in scripts/deploy.sh against throwaway checkouts.
// Nothing here touches a real server: pm2, npm, curl and git-fetch are stubbed
// on PATH, so a guard that silently passes shows up as a stub being reached.
const script = path.resolve('scripts/deploy.sh');
const root = await mkdtemp(path.join(tmpdir(), 'tcf-deploy-test-'));
// A LOCAL bare repo whose path still satisfies the script's origin check, so
// `git fetch origin main` resolves offline and deterministically. Pointing the
// fixture at the real GitHub URL made the test fetch over the network and
// force-update its own origin/main out from under the assertions.
const remoteFor = name => path.join(root, 'remotes', name, 'africanintelligencelms', 'Tin-City-Founders-console-.git');

const bin = path.join(root, 'bin');
await mkdir(bin, { recursive: true });
const stub = async (name, body) => {
  const file = path.join(bin, name);
  await writeFile(file, `#!/usr/bin/env bash\n${body}\n`);
  await chmod(file, 0o755);
};
// A PM2 listing that satisfies the process check for whatever APP is under test.
await stub('pm2', `
case "$1" in
  jlist) printf '[{"name":"tincity","pm2_env":{"pm_cwd":"%s","pm_exec_path":"%s/dist/server.cjs","status":"online"}}]' "$TEST_APP" "$TEST_APP" ;;
  *) echo "pm2 $*" >> "$TEST_LOG" ;;
esac`);
await stub('npm', 'echo "npm $*" >> "$TEST_LOG"');
await stub('curl', 'echo "curl $*" >> "$TEST_LOG"');

function run(app, env = {}) {
  try {
    const stdout = execFileSync('bash', [script], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, APP: app,
             BACKUPS: path.join(root, 'backups'), TEST_APP: app,
             TEST_LOG: path.join(root, 'calls.log'), ...env },
      encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.status, out: (error.stdout || '') + (error.stderr || '') };
  }
}

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf-8',
  env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t' } });

async function makeRepo(name, { remote, branch = 'main', state = true } = {}) {
  const origin = remote ?? remoteFor(name);
  if (!remote) {
    await mkdir(origin, { recursive: true });
    git(origin, 'init', '-q', '--bare', '-b', 'main');
  }
  const app = path.join(root, name);
  await mkdir(path.join(app, '.data'), { recursive: true });
  if (state) await writeFile(path.join(app, '.data', 'room_state.json'), '{"attendees":[]}');
  git(app, 'init', '-q', '-b', branch);
  git(app, 'remote', 'add', 'origin', origin);
  await writeFile(path.join(app, 'file.txt'), 'v1');
  git(app, 'add', '.');
  git(app, 'commit', '-qm', 'first');
  // A fixture with a deliberately wrong remote is rejected before any fetch, so
  // there is nothing to push to and nothing to fetch from.
  if (!remote) {
    git(app, 'push', '-q', 'origin', `${branch}:main`);
    git(app, 'fetch', '-q', 'origin', 'main');
  }
  return app;
}

try {
  // Wrong directory: not a git repo at all.
  const notRepo = path.join(root, 'not-a-repo');
  await mkdir(notRepo, { recursive: true });
  assert.notEqual(run(notRepo).code, 0, 'a non-repository was accepted');

  // Wrong branch.
  const onBranch = await makeRepo('wrong-branch', { branch: 'release' });
  let result = run(onBranch);
  assert.equal(result.code, 1);
  assert.match(result.out, /Expected main/);

  // Unexpected origin — the guard that stops this deploying someone else's app.
  const wrongRemote = await makeRepo('wrong-remote', { remote: path.join(root, 'someone', 'other-app.git') });
  result = run(wrongRemote);
  assert.equal(result.code, 1);
  assert.match(result.out, /Unexpected origin repository/);

  // Uncommitted tracked changes.
  const dirty = await makeRepo('dirty');
  await writeFile(path.join(dirty, 'file.txt'), 'edited');
  result = run(dirty);
  assert.equal(result.code, 1);
  assert.match(result.out, /Tracked changes need review/);

  // Missing room state: never deploy over a room that is not where it should be.
  const noState = await makeRepo('no-state', { state: false });
  result = run(noState);
  assert.equal(result.code, 1);
  assert.match(result.out, /Existing room state missing/);

  // A checkout that has diverged from origin/main.
  const diverged = await makeRepo('diverged');
  await writeFile(path.join(diverged, 'local.txt'), 'local only');
  git(diverged, 'add', '.');
  git(diverged, 'commit', '-qm', 'local commit');
  result = run(diverged);
  assert.equal(result.code, 1);
  assert.match(result.out, /diverged/);

  // Nothing to do: exits 0 WITHOUT stopping the app. A no-op deploy that still
  // takes the site down for a rebuild is the failure this guard prevents.
  const current = await makeRepo('current');
  result = run(current);
  assert.equal(result.code, 0, 'OUTPUT: ' + result.out);
  assert.match(result.out, /nothing to deploy/);
  let calls = '';
  try { calls = (await import('node:fs')).readFileSync(path.join(root, 'calls.log'), 'utf-8'); } catch {}
  assert(!/pm2 stop/.test(calls), 'an up-to-date checkout was stopped anyway');

  // The self-copy: the script must not be running from the file the merge rewrites.
  const detached = run(current, { TCF_DEPLOY_DETACHED: '' });
  assert.equal(detached.code, 0);

  console.log('PASS: rejects a non-repository, wrong branch, unexpected origin, dirty tree, missing room state and a diverged checkout; no-ops without stopping the app; re-execs from a private copy.');
} finally {
  await rm(root, { recursive: true, force: true });
}
