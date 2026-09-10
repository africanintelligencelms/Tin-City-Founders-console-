import { useState } from 'react';
import type { SquadMember } from '../types';

const skills = ['Product', 'Engineering', 'Design', 'Capital / Investment', 'Operations', 'Growth / Marketing', 'Domain expertise'];

export function SquadJoin({ joined, disabled, initialSkill, onChange }: {
  joined: boolean; disabled?: boolean; initialSkill?: string;
  onChange: (skill?: string) => Promise<void>;
}) {
  const [choosing, setChoosing] = useState(false);
  const [skill, setSkill] = useState(initialSkill || skills[0]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async (value?: string) => {
    setSaving(true); setError('');
    try { await onChange(value); setChoosing(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  };
  const style = 'px-4 py-2.5 rounded-xl border border-[#0D4734]/25 text-sm font-bold disabled:opacity-50';
  return <div>
    {!choosing ? <button type="button" disabled={disabled || saving} aria-pressed={joined} className={style} onClick={() => joined ? void save() : setChoosing(true)}>{joined ? 'Leave squad' : 'Join squad'}</button> : <div className="rounded-xl border p-3 space-y-2 bg-white text-[#09251B]">
      <label className="block text-sm font-bold">How will you help?
        <select autoFocus aria-label="Your squad skill" value={skill} onChange={e => setSkill(e.target.value)} className="block w-full border rounded-lg p-2 mt-2">
          {!skills.includes(skill) && <option>{skill}</option>}
          {skills.map(value => <option key={value}>{value}</option>)}
        </select>
      </label>
      <p className="text-xs">Your name and skill will appear in the squad list.</p>
      <div className="flex gap-2"><button type="button" className={style} disabled={disabled || saving} onClick={() => void save(skill)}>{saving ? 'Saving…' : 'Confirm join'}</button><button type="button" className={style} disabled={saving} onClick={() => setChoosing(false)}>Cancel</button></div>
    </div>}
    {error && <p role="alert" className="text-sm text-red-700 mt-2">{error}</p>}
  </div>;
}

export function SquadRoster({ members = [], legacyNames = [] }: { members?: SquadMember[]; legacyNames?: string[] }) {
  const legacy = legacyNames.filter(name => !members.some(m => m.name === name));
  return <ul className="text-sm space-y-1 my-2">
    {members.map(m => <li key={m.id}>{m.name} · {m.superpower || 'Skill not added yet'}</li>)}
    {legacy.map(name => <li key={name}>{name} · Skill not added yet</li>)}
    {!members.length && !legacy.length && <li>Be the first to join.</li>}
  </ul>;
}
