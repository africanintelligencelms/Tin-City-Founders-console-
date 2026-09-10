import React, { useEffect, useState } from 'react';
import type { AttendeeProfile, MyRoundBallot, VotingRound } from '../types';
import { RoundTakeover } from './RoundTakeover';
import { SquadJoin, SquadRoster } from './SquadJoin';

export const CommunityBallot: React.FC<{
  roundId: string; profile: AttendeeProfile | null; onJoin: () => void;
}> = ({ roundId, profile, onJoin }) => {
  const [data, setData] = useState<{ round: VotingRound; myBallot: MyRoundBallot } | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`/api/round?round=${encodeURIComponent(roundId)}`, { cache: 'no-store', signal: controller.signal });
        const next = await response.json();
        if (cancelled) return;
        if (!response.ok) { setData(null); setError(next.error || 'Could not load this ballot.'); return; }
        setData(next); setError(''); setOnline(true);
      } catch {
        if (!cancelled) { setOnline(false); setError('Connection lost. Reconnect to refresh this ballot.'); }
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [roundId, profile?.id, revision]);

  const save = async (url: string, body: unknown) => {
    if (!profile) { onJoin(); throw new Error('Join the community first.'); }
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const next = await response.json();
    if (!response.ok) { setRevision(r => r + 1); throw new Error(next.error || 'Could not save.'); }
    if (next.myBallot) setData(previous => previous ? { ...previous, round: next.round, myBallot: next.myBallot } : previous);
    else if (next.round) setData(previous => previous ? { ...previous, round: next.round } : previous);
    setRevision(r => r + 1);
  };
  const round = data?.round.id === roundId ? data.round : null;
  const link = `${window.location.origin}/?mode=community&round=${encodeURIComponent(roundId)}`;
  return <div>
    <div className="mb-4"><a className="text-sm font-bold underline" href={link}>Link to this ballot</a><p className="text-xs text-stone-600">Copy this link to return to this round or share it.</p></div>
    {error && <p role="alert" className="text-red-700 mb-4">{error} <button className="underline" onClick={() => setRevision(r => r + 1)}>Retry</button></p>}
    {!round && !error && <p>Loading ballot…</p>}
    {round && data && <>
      <RoundTakeover embedded round={round} myBallot={data.myBallot} voterName={profile?.name}
        onSubmitBallot={selections => save('/api/round/vote', { roundId, selections, voterName: profile?.name })}
        syncStatus={online ? 'connected' : 'offline'} onReconnect={() => setRevision(r => r + 1)} />
      {round.allowSquadSignup !== false && <section className="mt-6 space-y-4"><h2 className="text-xl font-bold">Execution squads</h2><p className="text-sm">Volunteer your skills for an option. Squad signup stays open after voting ends.</p>
        {round.options.map(option => <article key={option.id} className="bg-white border rounded-2xl p-5"><h3 className="font-bold">{option.label}</h3><SquadRoster members={option.squadMembers} /><SquadJoin joined={!!option.squadMembers?.some(m => m.id === profile?.id)} initialSkill={profile?.tags?.[0]} onChange={skill => save('/api/round/join-squad', { roundId, optionId: option.id, skill, leave: skill === undefined })} /></article>)}
      </section>}
    </>}
  </div>;
}
