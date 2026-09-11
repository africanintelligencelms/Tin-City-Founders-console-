import React, { useEffect, useState } from 'react';
import type { VotingRound, AttendeeProfile } from '../types';
import { roundBroadcast, withheldFromBroadcast, type BroadcastKind } from '../utils/whatsapp';

export const WhatsAppBroadcastDeck: React.FC<{ rounds: VotingRound[]; attendees?: AttendeeProfile[] }> = ({ rounds, attendees = [] }) => {
  const [selected, setSelected] = useState('');
  const [kind, setKind] = useState<BroadcastKind>('launch');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  // Default ON. These members asked that their details not leave the platform,
  // so the safe state is the one you have to deliberately turn off — and the
  // notice below names everyone withheld, so nothing is decided behind the host.
  const [withholdPrivate, setWithholdPrivate] = useState(true);
  const round = rounds.find(r => r.id === selected) || rounds[0];
  const privateIds = attendees.filter(a => a.listed === false).map(a => a.id);
  const affected = round ? withheldFromBroadcast(round, privateIds) : [];
  useEffect(() => { setMessage(''); setFeedback(''); }, [round?.id, round?.status, round?.endsAt, withholdPrivate]);
  const generate = () => {
    try {
      const text = roundBroadcast(round, kind, window.location.origin, Date.now(),
        { withheldIds: withholdPrivate ? privateIds : [] });
      setMessage(text); setFeedback(''); return text;
    }
    catch (e) { setMessage(''); setFeedback(e instanceof Error ? e.message : 'Could not generate message.'); return ''; }
  };
  if (!round) return null;
  const button = 'px-3 py-2 rounded-xl border border-emerald-600 text-sm font-bold disabled:opacity-40';
  return <details className="m-3 p-4 rounded-2xl border border-emerald-700 bg-[#09251B] text-white">
    <summary className="cursor-pointer font-bold">WhatsApp broadcast deck</summary>
    <div className="mt-4 space-y-3">
      <p className="text-xs text-emerald-100">Prepare a message, review it, then copy or open WhatsApp to choose where to share it.</p>
      {kind === 'results' && affected.length > 0 && <div className="rounded-xl border border-amber-400 bg-amber-950/40 p-3 space-y-2">
        <p className="text-sm font-bold text-amber-100">{affected.length} community-only member{affected.length === 1 ? '' : 's'} in this ballot</p>
        <p className="text-xs text-amber-100">{affected.map(m => m.name).join(', ')} asked that their details stay inside the community. A WhatsApp message leaves it.</p>
        <label className="flex items-start gap-2 text-xs text-amber-50">
          <input type="checkbox" className="mt-0.5" checked={withholdPrivate} onChange={e => setWithholdPrivate(e.target.checked)} />
          <span>Leave them out of the squad list. Untick to include them — your call and theirs, but ask them first.</span>
        </label>
      </div>}
      <label className="block text-sm">Ballot<select aria-label="Broadcast ballot" className="block w-full min-w-0 bg-[#09251B] border rounded-lg p-2" value={round.id} onChange={e => { setSelected(e.target.value); setMessage(''); setFeedback(''); }}>{rounds.map(r => <option key={r.id} value={r.id}>{r.title} · {r.status === 'open' ? 'Open' : 'Closed'}</option>)}</select></label>
      <label className="block text-sm">Message type<select aria-label="Broadcast message type" className="block w-full bg-[#09251B] border rounded-lg p-2" value={kind} onChange={e => { setKind(e.target.value as BroadcastKind); setMessage(''); setFeedback(''); }}><option value="launch">Launch</option><option value="reminder">Reminder</option><option value="results">Final results and squads</option></select></label>
      <button type="button" className={button} onClick={generate}>Prepare / refresh message</button>
      {message && <><textarea aria-label="WhatsApp message preview" readOnly value={message} rows={12} className="block w-full bg-white text-stone-900 rounded-xl p-3 text-sm" /><div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={async () => { try { await navigator.clipboard.writeText(message); setFeedback('Copied. Paste it into your WhatsApp group.'); } catch { setFeedback('Copy is unavailable. Select and copy the preview text manually.'); } }}>Copy message</button>
        <a className={button} href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>
      </div><p className="text-xs text-emerald-100">Refresh before sharing to include the latest turnout, deadline and squad members.</p></>}
      {feedback && <p role="status" className="text-sm text-amber-200">{feedback}</p>}
    </div>
  </details>;
};
