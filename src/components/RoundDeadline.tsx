import { useEffect, useState } from 'react';
import { lagosDate } from '../utils/format';
import type { VotingRound } from '../types';

export function useRoundExpired(round: VotingRound) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); };
  }, [round.endsAt]);
  return { now, expired: !!round.endsAt && now >= Date.parse(round.endsAt) };
}

export function RoundDeadline({ round }: { round: VotingRound }) {
  const { now, expired } = useRoundExpired(round);
  if (!round.endsAt) return null;
  const minutes = Math.max(0, Math.ceil((Date.parse(round.endsAt) - now) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  const formatted = lagosDate(round.endsAt, 'datetime');
  return <div className="text-sm mt-2">
    <p className="font-bold">{round.status !== 'open' ? 'Voting closed' : expired ? 'Voting has ended · confirming results' : `Closes in ${days ? `${days}d ` : ''}${hours}h ${minutes % 60}m`}</p>
    <p className="text-xs opacity-75">Deadline: {formatted} WAT (Lagos)</p>
  </div>;
}
