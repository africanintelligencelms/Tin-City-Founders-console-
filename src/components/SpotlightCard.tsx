import React from 'react';
import { Star } from 'lucide-react';
import type { Spotlight } from '../types';

const when = (value?: number) => value
  ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeZone: 'Africa/Lagos' }).format(new Date(value))
  : '';

// The member's details are read from the spotlight record, never looked up in
// the directory: a past spotlight has to keep reading as it did that week even
// after the member edits their profile or leaves.
export const SpotlightCard: React.FC<{ spotlight: Spotlight | null; history?: Spotlight[] }> = ({ spotlight, history = [] }) => {
  if (!spotlight && !history.length) return null;
  return <section className="m-3 rounded-2xl border border-[#E5A93C] bg-[#0D4734] text-white overflow-hidden">
    {spotlight ? <div className="p-4 space-y-2">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#E5A93C]">
        <Star className="w-4 h-4" aria-hidden="true" /> Spotlight this week
      </p>
      <h2 className="text-2xl font-bold">{spotlight.name}</h2>
      {(spotlight.organization || spotlight.stage) && <p className="text-sm text-emerald-100">
        {[spotlight.organization, spotlight.stage].filter(Boolean).join(' · ')}
      </p>}
      {spotlight.bio && <p className="text-sm">{spotlight.bio}</p>}
      {spotlight.giveAsk && <p className="text-sm"><span className="font-bold text-[#E5A93C]">Asking for: </span>{spotlight.giveAsk}</p>}
      {spotlight.note && <p className="text-sm italic text-emerald-100">“{spotlight.note}”</p>}
      {spotlight.link && <a href={spotlight.link} target="_blank" rel="noopener noreferrer" className="inline-block text-sm underline break-all">{spotlight.link}</a>}
      <p className="text-xs text-emerald-200">
        {spotlight.source === 'voted'
          ? `Chosen by the community — ${spotlight.votes} vote${spotlight.votes === 1 ? '' : 's'}`
          : 'Chosen by the host'}
        {spotlight.startedAt ? ` · since ${when(spotlight.startedAt)}` : ''}
      </p>
    </div> : <div className="p-4">
      <p className="text-sm text-emerald-100">No spotlight running right now.</p>
    </div>}

    {history.length > 0 && <details className="border-t border-emerald-800 px-4 py-3">
      <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-emerald-200">
        Past spotlights ({history.length})
      </summary>
      <ul className="mt-2 space-y-1">
        {history.map(past => <li key={past.id} className="text-sm text-emerald-100">
          <span className="font-bold text-white">{past.name}</span>
          {past.organization ? ` — ${past.organization}` : ''}
          <span className="text-xs text-emerald-300"> · {past.source === 'voted' ? 'voted' : 'picked'}{past.endedAt ? ` · ended ${when(past.endedAt)}` : ''}</span>
        </li>)}
      </ul>
    </details>}
  </section>;
};
