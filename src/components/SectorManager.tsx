import { SectorReview, type SectorRequest } from './SectorReview';
import React, { useState } from 'react';
import type { CategoryInfo } from '../types';

export const SectorManager: React.FC<{
  sectors: CategoryInfo[];
  request: SectorRequest;
  onSave: (original: string | null, name: string, description: string) => Promise<void>;
}> = ({ sectors, onSave, request }) => {
  const [deleting, setDeleting] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [original, setOriginal] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const select = (value: string) => {
    setDeleting(false); setReplacement('');
    const sector = sectors.find(s => s.name === value);
    setOriginal(sector?.name ?? null); setName(sector?.name || '');
    setDescription(sector?.description || ''); setFeedback('');
  };
  return <details className="m-3 p-4 rounded-2xl border border-emerald-700 bg-[#09251B] text-white">
    <summary className="font-bold cursor-pointer">Manage sectors</summary>
    <form className="mt-4 space-y-3" onSubmit={async e => {
      e.preventDefault(); if (saving) return;
      setSaving(true); setFeedback('');
      try { await onSave(original, name.trim(), description.trim()); setOriginal(name.trim()); setFeedback('Sector saved. Challenge forms and sector voting now use this list.'); }
      catch (error) { setFeedback(error instanceof Error ? error.message : 'Could not save the sector.'); }
      finally { setSaving(false); }
    }}>
      <label className="block text-sm">Create or edit<select aria-label="Sector to edit" disabled={saving} value={original || ''} onChange={e => select(e.target.value)} className="block w-full bg-[#09251B] border rounded-xl p-2 mt-1"><option value="">Create a new sector</option>{sectors.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select></label>
      <label className="block text-sm">Sector name<input aria-label="Sector name" required maxLength={80} disabled={saving} value={name} onChange={e => setName(e.target.value)} className="block w-full bg-white text-stone-900 rounded-xl p-3 mt-1" /></label>
      <label className="block text-sm">Description<textarea aria-label="Sector description" maxLength={1000} disabled={saving} value={description} onChange={e => setDescription(e.target.value)} rows={3} className="block w-full bg-white text-stone-900 rounded-xl p-3 mt-1" /></label>
      <p className="text-xs text-emerald-100">Renaming moves existing challenges and sector support votes to the new name. Existing ballots retain their original wording.</p>
      <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 rounded-xl bg-emerald-700 font-bold disabled:opacity-50">{saving ? 'Saving…' : original ? 'Save changes' : 'Create sector'}</button>
      {original && <div className="border-t border-emerald-700 pt-3">
        <button type="button" disabled={saving} className="underline text-amber-200" onClick={() => setDeleting(true)}>Delete selected sector</button>
        {deleting && <div className="space-y-3 mt-3"><p className="text-sm">Delete “{original}”? Its ongoing sector support votes will be removed. Past and current formal ballots keep their original options and results.</p>
          <p className="text-sm">{sectors.find(s => s.name === original)?.problemCount || 0} linked challenges. Choose a destination if any challenges are linked.</p>
          <select aria-label="Move challenges to sector" value={replacement} onChange={e => setReplacement(e.target.value)} className="block w-full bg-[#09251B] border rounded-lg p-2"><option value="">Select destination sector</option>{sectors.filter(s => s.name !== original).map(s => <option key={s.name}>{s.name}</option>)}</select>
          <div className="flex gap-3"><button type="button" disabled={saving || (!!sectors.find(s => s.name === original)?.problemCount && !replacement)} className="underline text-amber-200 disabled:opacity-50" onClick={async () => {
            setSaving(true); setFeedback('');
            try { await request(`/api/categories/${encodeURIComponent(original)}`, 'DELETE', { replacement: replacement || undefined }); select(''); setFeedback('Sector deleted.'); }
            catch (error) { setFeedback(error instanceof Error ? error.message : 'Could not delete sector.'); }
            finally { setSaving(false); }
          }}>Confirm deletion</button><button type="button" disabled={saving} onClick={() => setDeleting(false)}>Cancel</button></div>
        </div>}
      </div>}
      {feedback && <p role="status" className="text-sm text-amber-200">{feedback}</p>}
    </form>
    <SectorReview sectors={sectors} request={request} />
  </details>;
};
