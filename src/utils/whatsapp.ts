import type { VotingRound, MyRoundBallot } from '../types';

export type BroadcastKind = 'launch' | 'reminder' | 'results';
const clean = (value: string) => value.replace(/[\r\n*_~`]/g, ' ').replace(/\s+/g, ' ').trim();

export function voterShareText(round: VotingRound, ballot: MyRoundBallot, origin: string, now = Date.now()) {
  if (!ballot.hasVoted || ballot.roundId !== round.id) return '';
  const link = `${new URL(origin).origin}/?mode=community&round=${encodeURIComponent(round.id)}`;
  const choices = round.options.filter(o => ballot.selections.includes(o.id)).map(o => clean(o.label));
  const closed = round.status !== 'open' || (!!round.endsAt && now >= Date.parse(round.endsAt));
  const invitation = closed ? 'Voting has ended. See the ballot and results:' : round.endsAt
    ? `Cast your vote before ${new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(round.endsAt))} WAT (Lagos):`
    : 'Cast your vote while voting is open:';
  return `✅ I voted in "${clean(round.title)}" in the TCF Community Pulse.${choices.length ? `\nMy choice${choices.length > 1 ? 's' : ''}: ${choices.join('; ')}` : ''}\n\n${round.ballotsCast} member${round.ballotsCast === 1 ? ' has' : 's have'} voted.\n${invitation}\n👉 ${link}`;
}

export function roundBroadcast(round: VotingRound, kind: BroadcastKind, origin: string, now = Date.now()) {
  const link = `${new URL(origin).origin}/?mode=community&round=${encodeURIComponent(round.id)}`;
  const title = clean(round.title);
  const deadline = round.endsAt
    ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(round.endsAt)) + ' WAT (Lagos)'
    : 'The host will close voting manually';
  const expired = round.status !== 'open' || (!!round.endsAt && now >= Date.parse(round.endsAt));
  if (kind !== 'results' && expired) throw new Error('Voting has ended. Use the results message once the final tally is available.');
  if (kind === 'launch') return `📣 *TCF COMMUNITY PULSE IS LIVE*\n\n*Question:* ${title}\n\n${round.options.map((o, i) => `${i + 1}. ${clean(o.label)}`).join('\n')}\n\n👉 *Cast your vote:* ${link}\n⏳ *Voting closes:* ${deadline}`;
  if (kind === 'reminder') {
    const minutes = round.endsAt ? Math.max(0, Math.ceil((Date.parse(round.endsAt) - now) / 60000)) : null;
    const remaining = minutes === null ? '' : ` · ${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
    return `⏳ *TCF VOTING REMINDER${remaining}*\n\n*${title}*\n${round.ballotsCast} member${round.ballotsCast === 1 ? ' has' : 's have'} voted.\n\nMake your voice count.\n*Voting closes:* ${deadline}\n👉 ${link}`;
  }
  if (round.status === 'open' || !round.results) throw new Error('Final results are available after the round closes.');
  const sorted = [...round.results].sort((a, b) => b.votes - a.votes);
  const top = sorted.filter(r => r.votes === sorted[0]?.votes);
  const outcome = !round.ballotsCast ? 'No ballots were cast; there is no winner.'
    : top.length > 1 ? `*Tied for first:* ${top.map(r => clean(r.label)).join('; ')}`
    : `*Top choice:* ${clean(top[0].label)}`;
  const breakdown = sorted.map(r => `${sorted.findIndex(entry => entry.votes === r.votes) + 1}. ${clean(r.label)} — ${r.votes} vote${r.votes === 1 ? '' : 's'} (${Math.round(r.share * 100)}%)`).join('\n');
  const squads = round.options.filter(o => o.squadMembers?.length).map(o => `*${clean(o.label)}*\n${o.squadMembers!.map(m => `• ${clean(m.name)} — ${clean(m.superpower || 'Skill not added yet')}`).join('\n')}`).join('\n\n');
  return `🏆 *TCF FINAL RESULTS: ${title}*\n\n*Ballots cast:* ${round.ballotsCast}\n${outcome}\n\n${breakdown}${round.maxSelections > 1 ? '\nPercentages are per voter; multiple choices can total over 100%.' : ''}\n\n👥 *EXECUTION SQUADS*\n${squads || 'No squad members yet.'}\n\n👉 View results${round.allowSquadSignup !== false ? ' and join a squad' : ''}: ${link}`;
}
