import React, { useEffect, useState } from 'react';
import type { RoundKind, RoundResultEntry } from '../types';

interface PastRound {
  id: string; title: string; kind: RoundKind; openedAt: number; closedAt?: number;
  ballotsCast: number; results: RoundResultEntry[]; squadMembersCount: number;
}
const labels = { problem: 'Challenges', category: 'Sectors', trustee: 'Trustees', member: 'Spotlight' };
const date = (value: number) => new Intl.DateTimeFormat('en-NG', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos'
}).format(new Date(value));

export const PastBallots: React.FC<{ onOpen: (id: string) => void }> = ({ onOpen }) => {
  const [rounds, setRounds] = useState<PastRound[]>([]);
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch('/api/round/history', { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Could not load past ballots.'); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setRounds(data.rounds); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message || 'Could not load past ballots.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const filtered = rounds.filter(r => (kind === 'all' || r.kind === kind) && r.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <section aria-label="Past ballots">
    <h2 className="text-2xl font-bold">Past ballots</h2>
    <p className="text-sm text-stone-600 mt-2 mb-5">Browse completed votes, final results and execution squads. Newest results appear first. Dates are in Nigerian time (WAT).</p>
    <div className="flex flex-wrap gap-3 mb-5">
      <input aria-label="Search past ballots" placeholder="Search ballot titles" value={query} onChange={e => setQuery(e.target.value)} className="border rounded-xl p-3 min-w-0 flex-1 bg-white" />
      <select aria-label="Filter past ballots" value={kind} onChange={e => setKind(e.target.value)} className="border rounded-xl p-3 bg-white"><option value="all">All ballot types</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button className="border rounded-xl px-4 py-2 font-bold" disabled={loading} onClick={() => setRevision(r => r + 1)}>Refresh</button>
    </div>
    {loading && <p role="status">Loading past ballots…</p>}
    {error && <p role="alert" className="text-red-700">{error} Use Refresh to try again.</p>}
    {!loading && !error && !filtered.length && <p>{rounds.length ? 'No ballots match your search or filter.' : 'No completed ballots yet. Closed ballots will appear here.'}</p>}
    {!loading && !error && <div className="grid md:grid-cols-2 gap-4">{filtered.map(round => {
      const topVotes = Math.max(0, ...round.results.map(r => r.votes));
      const leaders = round.results.filter(r => r.votes === topVotes);
      return <article key={round.id} className="bg-white rounded-2xl border p-5">
        <p className="text-xs font-bold text-emerald-800">{labels[round.kind]} · Closed</p>
        <h3 className="text-xl font-bold my-2">{round.title}</h3>
        <p className="text-xs text-stone-600">Opened: {date(round.openedAt)}<br />Closed: {round.closedAt ? date(round.closedAt) : 'Date unavailable'}</p>
        <p className="text-sm my-3">{round.ballotsCast} ballots · {round.squadMembersCount} squad signups</p>
        <p className="text-sm mb-4">{!round.ballotsCast ? 'No ballots cast.' : `${leaders.length > 1 ? 'Tied for first' : 'Top choice'}: ${leaders.map(r => r.label).join('; ')}`}</p>
        <a href={`/?mode=community&round=${encodeURIComponent(round.id)}`} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onOpen(round.id); } }} className="inline-block bg-[#0D4734] text-white rounded-xl px-4 py-2 font-bold text-sm">View results and squads</a>
      </article>;
    })}</div>}
  </section>;
};
