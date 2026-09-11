import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Pure helpers, so this compiles the module and checks it directly — no server.
const compiled = await build({ entryPoints: ['src/utils/format.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { plural, getInitials, lagosDate } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));

// "1 ballots submitted" was on screen during a live event.
assert.equal(plural(1, 'ballot'), '1 ballot');
assert.equal(plural(0, 'ballot'), '0 ballots');
assert.equal(plural(2, 'ballot'), '2 ballots');
assert.equal(plural(1, 'squad commitment'), '1 squad commitment');
assert.equal(plural(3, 'squad commitment'), '3 squad commitments');
assert.equal(plural(2, 'person', 'people'), '2 people');

// These initials are already printed beside real members' names. This helper
// replaced two near-identical copies, and it takes the first TWO words rather
// than first-and-last on purpose: changing it would silently relabel the
// avatars of the four members whose names have three parts.
assert.equal(getInitials('Samuel Onimisi Solomon'), 'SO');
assert.equal(getInitials('Cordelia Pam'), 'CP');
assert.equal(getInitials('Sammy'), 'SA');
assert.equal(getInitials(''), 'TC');
assert.equal(getInitials('   '), 'TC');

// Every date the community reads is Nigerian time, whatever the server's clock.
assert.equal(lagosDate('2026-09-18T17:16:00.000Z', 'datetime'), '18 Sept 2026, 18:16');
assert.equal(lagosDate('2026-09-18T17:16:00.000Z'), '18 Sept 2026');
assert.equal(lagosDate('not a date'), '');

console.log('PASS: plurals, initials preserved for three-part names, Lagos dates and invalid input.');
