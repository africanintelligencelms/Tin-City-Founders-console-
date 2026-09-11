import assert from 'node:assert/strict';
import { build } from 'esbuild';
const compiled=await build({entryPoints:['src/utils/whatsapp.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {roundBroadcast,voterShareText,withheldFromBroadcast}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const now=Date.parse('2026-09-10T10:00:00Z');
const round={id:'round/a',title:'Build *together*',kind:'problem',status:'open',options:[{id:'a',label:'First'},{id:'b',label:'Second'}],maxSelections:2,ballotsCast:2,openedAt:now,endsAt:new Date(now+25*3600000).toISOString(),allowSquadSignup:true};
const launch=roundBroadcast(round,'launch','https://console.tincityfounders.com/?host=SECRET',now);
assert(launch.includes('round=round%2Fa'));assert(!launch.includes('SECRET'));assert(launch.includes('WAT (Lagos)'));
const reminder=roundBroadcast(round,'reminder','https://example.com',now);
assert(reminder.includes('25h 0m left'));assert(reminder.includes('2 members have voted'));assert(!reminder.includes('First'));
assert.throws(()=>roundBroadcast(round,'results','https://example.com',now));
assert.throws(()=>roundBroadcast(round,'launch','https://example.com',now+26*3600000));
round.status='revealed';round.results=[{optionId:'a',label:'First',votes:2,share:1},{optionId:'b',label:'Second',votes:2,share:1}];
round.options[0].squadMembers=[{id:'member',name:'Amina',superpower:'Engineering',whatsapp:'PRIVATE'}];
const results=roundBroadcast(round,'results','https://example.com',now);
assert(results.includes('Tied for first'));assert(results.includes('Amina — Engineering'));assert(!results.includes('PRIVATE'));assert(results.includes('over 100%'));
round.ballotsCast=0;round.results=round.results.map(r=>({...r,votes:0,share:0}));round.allowSquadSignup=false;
const empty=roundBroadcast(round,'results','https://example.com',now);
assert(empty.includes('there is no winner'));assert(!empty.includes('and join a squad'));
// Community-only members: present in the app, withheld from a message that
// leaves it. The host is told who, by name, rather than people vanishing.
round.ballotsCast=2;round.results=[{optionId:'a',label:'First',votes:2,share:1},{optionId:'b',label:'Second',votes:0,share:0}];round.allowSquadSignup=true;
round.options[0].squadMembers=[{id:'att-public',name:'Amina',superpower:'Engineering'},{id:'att-private',name:'Bello',superpower:'Design'}];
const withNobodyWithheld=roundBroadcast(round,'results','https://example.com',now);
assert(withNobodyWithheld.includes('Amina'));assert(withNobodyWithheld.includes('Bello'));
const withheld=roundBroadcast(round,'results','https://example.com',now,{withheldIds:['att-private']});
assert(withheld.includes('Amina — Engineering'),'public member dropped');
assert(!withheld.includes('Bello'),'community-only member leaked into the broadcast');
assert(!withheld.includes('Design'),'community-only skill leaked into the broadcast');
assert.deepEqual(withheldFromBroadcast(round,['att-private']),[{id:'att-private',name:'Bello'}]);
assert.deepEqual(withheldFromBroadcast(round,[]),[]);
assert.deepEqual(withheldFromBroadcast(round,['att-nobody']),[],'reports someone not in this ballot');
// Withholding everyone in an option drops the option heading too, rather than
// leaving an empty squad title implying the members are hidden.
const allWithheld=roundBroadcast(round,'results','https://example.com',now,{withheldIds:['att-public','att-private']});
assert(allWithheld.includes('No squad members yet.'));assert(!allWithheld.includes('Amina'));
// An omitted audience argument must behave exactly as before.
assert.equal(roundBroadcast(round,'results','https://example.com',now),withNobodyWithheld);

console.log('PASS: launch, live reminder duration, closed-results guard, ties, zero votes, multi-select percentages, skills, safe public links, and community-only withholding.');

const ballot={roundId:round.id,hasVoted:true,selections:['a','b']};
assert.equal(voterShareText(round,{...ballot,hasVoted:false},'https://example.com',now),'');
assert.equal(voterShareText(round,{...ballot,roundId:'different'},'https://example.com',now),'');
round.status='open';round.ballotsCast=3;
const share=voterShareText(round,ballot,'https://example.com/?host=SECRET',now);
assert(share.includes('My choices: First; Second'));assert(share.includes('3 members have voted'));
assert(share.includes('WAT (Lagos)'));assert(share.includes('round=round%2Fa'));assert(!share.includes('SECRET'));
const changed=voterShareText(round,{...ballot,selections:['b']},'https://example.com',now);
assert(changed.includes('My choice: Second'));assert(!changed.includes('First'));
assert(voterShareText(round,ballot,'https://example.com',now+26*3600000).includes('Voting has ended'));
round.endsAt=undefined;
assert(voterShareText(round,ballot,'https://example.com',now).includes('while voting is open'));
round.status='revealed';
assert(!voterShareText(round,ballot,'https://example.com',now).includes('Cast your vote'));
console.log('PASS: voter share eligibility, exact ballot links, multiple/updated choices, deadline expiry, manual rounds and host-key exclusion.');
