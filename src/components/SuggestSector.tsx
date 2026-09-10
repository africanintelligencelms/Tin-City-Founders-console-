import React, { useState } from 'react';

export const SuggestSector: React.FC = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mine, setMine] = useState<Array<{ id: string; name: string; status: string; resolvedSector?: string }>>([]);
  const refresh = async () => {
    try { const response = await fetch('/api/sector-suggestions/mine', { cache: 'no-store' }); if (!response.ok) throw new Error(); const data = await response.json(); setMine(data.suggestions); }
    catch { setMessage('Could not refresh your suggestions. Please try again.'); }
  };
  return <details onToggle={e => { if (e.currentTarget.open) void refresh(); }} className="bg-white text-stone-900 border rounded-xl p-4 my-4">
    <summary className="cursor-pointer font-bold text-sm">Sector missing? Suggest one</summary>
    <p className="text-xs my-3">A host will review your suggestion. It becomes available after approval. You can use an existing sector for your challenge in the meantime.</p>
    <label className="block text-sm">Suggested sector<input aria-label="Suggested sector name" maxLength={80} value={name} onChange={e => setName(e.target.value)} className="block w-full border rounded-lg p-2" /></label>
    <label className="block text-sm mt-2">Why is it needed?<textarea aria-label="Sector suggestion reason" maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} className="block w-full border rounded-lg p-2" /></label>
    <button type="button" disabled={busy || !name.trim()} className="bg-emerald-800 text-white px-4 py-2 rounded-lg mt-3 disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage('');
      try {
        const response = await fetch('/api/sector-suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not submit.');
        setName(''); setDescription(''); setMessage('Suggestion sent to the host for review.'); await refresh();
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not connect. Please try again.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Sending…' : 'Submit suggestion'}</button>
    {message && <p role="status" className="text-sm mt-2">{message}</p>}
    <button type="button" onClick={refresh} className="block underline text-xs mt-3">Refresh my suggestions</button>
    {!!mine.length && <ul className="text-sm mt-2 space-y-1">{mine.map(s => <li key={s.id}>{s.name}: {s.status === 'pending' ? 'Awaiting review' : s.status === 'dismissed' ? 'Not approved' : !s.resolvedSector ? 'Previously reviewed; sector no longer listed' : `${s.status === 'mapped' ? 'Use existing sector' : 'Approved'}: ${s.resolvedSector}`}</li>)}</ul>}
  </details>;
};
