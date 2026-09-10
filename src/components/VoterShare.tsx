import React, { useState } from 'react';
import type { VotingRound, MyRoundBallot } from '../types';
import { useRoundExpired } from './RoundDeadline';
import { voterShareText } from '../utils/whatsapp';

export const VoterShare: React.FC<{ round: VotingRound; ballot: MyRoundBallot }> = ({ round, ballot }) => {
  const { now } = useRoundExpired(round);
  const [feedback, setFeedback] = useState('');
  const message = voterShareText(round, ballot, window.location.origin, now);
  if (!message) return null;
  return <details className="my-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4">
    <summary className="cursor-pointer font-bold text-sm">📲 Share to WhatsApp Group</summary>
    <p className="text-xs mt-3 mb-2">This message includes your ballot choices. Review it before sharing.</p>
    <textarea aria-label="Your vote sharing message" readOnly rows={7} value={message} className="block w-full rounded-lg p-3 text-sm bg-white text-stone-900" />
    <div className="flex flex-wrap gap-2 mt-3">
      <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm font-bold">Open WhatsApp</a>
      <button type="button" className="rounded-lg border border-emerald-400/40 px-4 py-2 text-sm font-bold" onClick={async () => { try { await navigator.clipboard.writeText(message); setFeedback('Copied. Paste it into your WhatsApp group.'); } catch { setFeedback('Select and copy the preview text manually.'); } }}>Copy message</button>
    </div>
    {feedback && <p role="status" className="text-xs mt-2">{feedback}</p>}
  </details>;
};
