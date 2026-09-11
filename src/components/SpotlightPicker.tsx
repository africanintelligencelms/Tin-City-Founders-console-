import React, { useState } from 'react';
import type { AttendeeProfile, Spotlight } from '../types';

// The host's half of the spotlight. The other half is a member ballot: open a
// round with kind 'member' and the winner is promoted automatically when it
// closes, so this is only for naming someone directly.
export const SpotlightPicker: React.FC<{
  attendees: AttendeeProfile[];
  spotlight: Spotlight | null;
  onPick: (memberId: string, note: string, days: number) => Promise<void>;
  onClear: () => Promise<void>;
}> = ({ attendees, spotlight, onPick, onClear }) => {
  const [memberId, setMemberId] = useState('');
  const [note, setNote] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const button = 'px-3 py-2 rounded-xl border border-emerald-600 text-sm font-bold disabled:opacity-40';

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true); setFeedback('');
    try { await action(); setFeedback(done); setNote(''); }
    catch (e) { setFeedback(e instanceof Error ? e.message : 'That did not work.'); }
    finally { setBusy(false); }
  };

  return <details className="m-3 p-4 rounded-2xl border border-emerald-700 bg-[#09251B] text-white">
    <summary className="cursor-pointer font-bold">Weekly spotlight</summary>
    <div className="mt-4 space-y-3">
      <p className="text-xs text-emerald-100">
        {spotlight
          ? `Running now: ${spotlight.name} (${spotlight.source === 'voted' ? 'voted for by the community' : 'picked by you'}). Naming someone else retires this one into the history.`
          : 'Nobody is in the spotlight. Name someone here, or open a Spotlight ballot and the winner is promoted automatically when voting closes.'}
      </p>

      <label className="block text-sm">Member
        <select aria-label="Spotlight member" className="block w-full min-w-0 bg-[#09251B] border rounded-lg p-2" value={memberId} onChange={e => setMemberId(e.target.value)}>
          <option value="">Choose a member…</option>
          {[...attendees].sort((a, b) => a.name.localeCompare(b.name)).map(a =>
            <option key={a.id} value={a.id}>
              {a.name}{a.organization ? ` — ${a.organization}` : ''}{a.listed === false ? ' · community only' : ''}
            </option>)}
        </select>
      </label>

      <label className="block text-sm">Why them (optional)
        <input aria-label="Spotlight note" maxLength={400} value={note} onChange={e => setNote(e.target.value)}
          className="block w-full bg-[#09251B] border rounded-lg p-2" placeholder="Shipped the pilot this month" />
      </label>

      <label className="block text-sm">Run for
        <select aria-label="Spotlight duration" className="block w-full bg-[#09251B] border rounded-lg p-2" value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={7}>A week</option>
          <option value={14}>Two weeks</option>
          <option value={30}>A month</option>
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={!memberId || busy}
          onClick={() => run(() => onPick(memberId, note, days), 'Spotlight set.')}>Set spotlight</button>
        {spotlight && <button type="button" className={button} disabled={busy}
          onClick={() => run(onClear, 'Spotlight cleared.')}>Clear it</button>}
      </div>
      {feedback && <p role="status" className="text-sm text-amber-200">{feedback}</p>}
    </div>
  </details>;
};
