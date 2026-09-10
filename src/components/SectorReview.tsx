import React, { useEffect, useState } from 'react';
import type { CategoryInfo } from '../types';

export type SectorRequest = (path: string, method: string, body?: unknown) => Promise<any>;
export const SectorReview: React.FC<{ sectors: CategoryInfo[]; request: SectorRequest }> = ({ sectors, request }) => {
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; description: string; submittedBy: string }>>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const refresh = async () => {
    setBusy(true); setFeedback('');
    try { setSuggestions((await request('/api/sector-suggestions', 'GET')).suggestions); }
    catch (e) { setFeedback(e instanceof Error ? e.message : 'Could not load suggestions.'); }
    finally { setBusy(false); }
  };
  const review = async (id: string, action: string) => {
    setBusy(true); setFeedback('');
    try { setSuggestions((await request(`/api/sector-suggestions/${encodeURIComponent(id)}/review`, 'POST', { action, target: targets[id] })).suggestions); setFeedback('Suggestion reviewed.'); }
    catch (e) { setFeedback(e instanceof Error ? e.message : 'Could not review suggestion.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, []);
  return <section className="border-t border-emerald-700 mt-5 pt-4 space-y-3">
    <h3 className="font-bold">Member sector suggestions</h3><button type="button" disabled={busy} className="underline text-sm" onClick={refresh}>Refresh suggestions</button>
    {suggestions.map(s => <article key={s.id} className="border border-emerald-700 rounded-xl p-3 space-y-2"><h4 className="font-bold">{s.name}</h4><p className="text-xs">Suggested by {s.submittedBy}</p><p className="text-sm whitespace-pre-wrap">{s.description}</p>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className="underline" onClick={() => review(s.id, 'approve')}>Approve new sector</button><button type="button" disabled={busy} className="underline" onClick={() => review(s.id, 'dismiss')}>Dismiss</button></div>
      <select aria-label={`Existing sector for ${s.name}`} value={targets[s.id] || ''} onChange={e => setTargets(t => ({ ...t, [s.id]: e.target.value }))} className="bg-[#09251B] border rounded-lg p-2 w-full"><option value="">Choose an existing sector</option>{sectors.map(c => <option key={c.name}>{c.name}</option>)}</select>
      <button type="button" disabled={busy || !targets[s.id]} className="underline disabled:opacity-50" onClick={() => review(s.id, 'map')}>Map to selected sector</button>
    </article>)}
    {!busy && !suggestions.length && <p className="text-sm">No pending suggestions.</p>}{feedback && <p role="status" className="text-sm text-amber-200">{feedback}</p>}
  </section>;
};
