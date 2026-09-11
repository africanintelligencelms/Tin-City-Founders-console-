import React, { useState, useEffect } from 'react';
import { X, MapPin, Handshake, Check } from 'lucide-react';
import { normalizePhone } from '../utils/phone';
import { AttendeeProfile } from '../types';
import { POPULAR_SKILLS, JOS_LOCATIONS } from '../data/profileTags';

interface AudienceProfileSheetProps {
  isOpen: boolean;
  currentProfile: AttendeeProfile | null;
  onClose: () => void;
  onRecoverProfile: () => void;
  onSignOut: () => Promise<void>;
  onSaveProfile: (profile: AttendeeProfile) => Promise<void>;
}

const STAGES = [
  'Just an idea',
  'Building / pre-launch',
  'Launched / early traction',
  'Growing / established',
  'Student / exploring',
  'I invest in or support founders'
];

export const AudienceProfileSheet: React.FC<AudienceProfileSheetProps> = ({
  isOpen,
  currentProfile,
  onClose,
  onRecoverProfile,
  onSignOut,
  onSaveProfile
}) => {
  const [name, setName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#0D4734');
  const [organization, setOrganization] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [link, setLink] = useState('');
  const [stage, setStage] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [giveAsk, setGiveAsk] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');

  // Refill from the live profile each time the sheet is opened, so a half-typed
  // draft that was abandoned last time never resurfaces as if it were saved.
  useEffect(() => {
    if (!isOpen) return;
    setName(currentProfile?.name || '');
    setAvatarColor(currentProfile?.avatarColor || '#0D4734');
    setOrganization(currentProfile?.organization || '');
    setLinkedin(currentProfile?.linkedin || '');
    setLink(currentProfile?.link || '');
    setStage(currentProfile?.stage || '');
    setConfirmSignOut(false);
    setWhatsapp(currentProfile?.whatsapp || '');
    setError('');
    setGiveAsk(currentProfile?.giveAsk || '');
    setTitle(currentProfile?.title || '');
    setTags(currentProfile?.tags ? [...currentProfile.tags] : []);
    setLocation(currentProfile?.location || '');
    setBio(currentProfile?.bio || '');
  }, [isOpen, currentProfile]);

  // Escape closes without saving, same as the X.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !currentProfile) return null;

  const toggleTag = (tag: string) => {
    setTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const toggleLocation = (loc: string) => {
    setLocation(prev => (prev === loc ? '' : loc));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Blank stays blank. A trimmed-empty field is saved as empty, never
    // backfilled with a plausible-sounding default.
    setError('');
    setSaving(true);
    try {
    await onSaveProfile({
      ...currentProfile,
      name: name.trim(), avatarColor, organization: organization.trim(), linkedin: linkedin.trim(),
      link: link.trim(), stage,
      whatsapp: normalizePhone(whatsapp),
      title: title.trim(),
      tags: tags.map(t => t.trim()).filter(Boolean),
      giveAsk: giveAsk.trim(),
      location: location.trim(),
      bio: bio.trim()
    });
    onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#FAF6EE] text-stone-900 flex flex-col animate-in fade-in duration-150">
      {/* Sticky top bar — closing here discards, and says so. */}
      <header className="shrink-0 bg-[#0D4734] text-white px-4 py-3 flex items-center justify-between gap-3 shadow-md">
        <div className="min-w-0">
          <h2 className="text-base font-display font-black leading-tight truncate">Your Profile</h2>
          <p className="text-[11px] text-emerald-200/90 truncate">
            Keep your name up to date. Everything else is optional.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close without saving"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900/50 hover:bg-emerald-900/80 border border-emerald-400/30 text-xs font-bold cursor-pointer active:scale-95 transition"
        >
          <X className="w-4 h-4" />
          <span>Close</span>
        </button>
      </header>

      <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-xl mx-auto w-full space-y-5">
            <section className="space-y-3">
              <label className="block text-sm font-bold">Display name<input aria-label="Display name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} className="block w-full border rounded-xl p-3 mt-1" /></label>
              <fieldset><legend className="text-sm font-bold mb-2">Avatar colour</legend><div className="flex flex-wrap gap-2">{['#0D4734','#E5A93C','#BF7E1D','#166E52','#C85A28','#0F6B5C'].map((color, i) => <button key={color} type="button" aria-label={['Forest green','Plateau gold','Ochre','Emerald','Terracotta','Teal'][i]} aria-pressed={avatarColor === color} onClick={() => setAvatarColor(color)} style={{backgroundColor:color}} className="w-11 h-11 rounded-xl border-2 border-stone-500 text-white">{avatarColor === color ? '✓' : ''}</button>)}</div></fieldset>
              <label className="block text-sm font-bold">Organization / venture<input aria-label="Organization / venture" maxLength={160} value={organization} onChange={e => setOrganization(e.target.value)} className="block w-full border rounded-xl p-3 mt-1" /></label>
              <label className="block text-sm font-bold">LinkedIn profile<input aria-label="LinkedIn profile" placeholder="https://www.linkedin.com/in/your-name" value={linkedin} onChange={e => setLinkedin(e.target.value)} className="block w-full border rounded-xl p-3 mt-1" /></label>
              <label className="block text-sm font-bold">Instagram or website<input aria-label="Instagram or website" maxLength={300} placeholder="instagram.com/yourhandle" value={link} onChange={e => setLink(e.target.value)} className="block w-full border rounded-xl p-3 mt-1" /></label>
              <label className="block text-sm font-bold">Stage
                <select aria-label="Stage" value={stage} onChange={e => setStage(e.target.value)} className="block w-full border rounded-xl p-3 mt-1 bg-white">
                  <option value="">Not saying</option>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <p className="text-xs text-stone-600">Your organization, links and stage appear in the member directory.</p>
            </section>

            <section className="space-y-2 bg-white p-4 rounded-2xl border border-stone-300">
              <label htmlFor="profile-whatsapp" className="block text-sm font-bold">WhatsApp number (optional)</label>
              <p id="phone-help" className="text-xs text-stone-600">Add your WhatsApp number to access your profile on another device. It won't appear in the public directory.</p>
              <input id="profile-whatsapp" type="tel" autoComplete="tel" aria-describedby="phone-help" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="08012345678 or +2348012345678" className="w-full px-3 py-3 rounded-xl border border-stone-300" />
              <button type="button" onClick={onRecoverProfile} className="text-xs font-bold text-[#0D4734] underline">Already have another profile? Find it</button>
              <p className="text-xs text-stone-500">Use this number with “Already joined?” next time. No verification code is required.</p>
            </section>
            <section className="rounded-xl border p-4 space-y-2">
              <button type="button" disabled={saving} className="font-bold underline" onClick={() => setConfirmSignOut(true)}>Sign out / switch profile</button>
              {confirmSignOut && <div><p className="text-sm">{currentProfile.whatsapp ? 'Your saved profile and votes will remain. Use your saved phone number to sign back in.' : 'No phone number is saved. Add and save one first if you want to recover this profile after signing out.'}</p><div className="flex gap-3 mt-2"><button type="button" disabled={saving} className="font-bold underline" onClick={async () => { setSaving(true); setError(''); try { await onSignOut(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign out.'); } finally { setSaving(false); } }}>Sign out now</button><button type="button" disabled={saving} onClick={() => setConfirmSignOut(false)}>Stay signed in</button></div></div>}
            </section>
            {/* GIVE & ASK — the one field worth a stranger's attention at a mixer. */}
            <section className="bg-white rounded-2xl border-2 border-[#0D4734] shadow-[3px_3px_0px_0px_#09251B] p-4 space-y-2">
              <label htmlFor="profile-give-ask" className="flex items-center gap-2 text-[#0D4734]">
                <Handshake className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-sm font-display font-black">Give &amp; Ask</span>
              </label>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                What can you offer the community, and what do you need? This appears in the member directory.
              </p>
              <textarea
                id="profile-give-ask"
                value={giveAsk}
                onChange={e => setGiveAsk(e.target.value)}
                rows={4}
                placeholder="Give: intros to potato farmers in Bokkos. Ask: a backend dev for two weekends."
                className="w-full px-3 py-2.5 rounded-xl border-2 border-stone-300 bg-stone-50 text-sm font-medium placeholder:text-stone-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0D4734] resize-none"
              />
            </section>

            {/* Role / venture */}
            <section className="space-y-2">
              <label
                htmlFor="profile-title"
                className="block text-xs font-display font-bold uppercase tracking-wide text-stone-700"
              >
                Role
              </label>
              <input
                id="profile-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Founder, AgriGrid"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm font-medium placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#0D4734]"
              />
            </section>

            {/* Skills — tap to toggle. Same vocabulary the pitch wizard asks for. */}
            <section className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-display font-bold uppercase tracking-wide text-stone-700">
                  What you do
                </span>
                <span className="text-[11px] text-stone-500">
                  {tags.length > 0 ? `${tags.length} selected` : 'Tap any that fit'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SKILLS.map(skill => {
                  const active = tags.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleTag(skill)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                        active
                          ? 'bg-[#0D4734] border-[#09251B] text-white'
                          : 'bg-white border-stone-300 text-stone-700 hover:border-[#0D4734]'
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5 stroke-[3] text-amber-400" />}
                      <span>{skill}</span>
                    </button>
                  );
                })}
              </div>
              {/* Anything typed elsewhere (or on an earlier build) stays selectable/removable. */}
              {tags.filter(t => !POPULAR_SKILLS.includes(t)).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {tags
                    .filter(t => !POPULAR_SKILLS.includes(t))
                    .map(custom => (
                      <button
                        key={custom}
                        type="button"
                        onClick={() => toggleTag(custom)}
                        className="px-3 py-2 rounded-xl text-xs font-bold border border-[#09251B] bg-[#0D4734] text-white flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <X className="w-3.5 h-3.5 stroke-[3] text-amber-400" />
                        <span>{custom}</span>
                      </button>
                    ))}
                </div>
              )}
            </section>

            {/* Where in Plateau */}
            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wide text-stone-700">
                <MapPin className="w-3.5 h-3.5 text-[#0D4734]" />
                <span>Where you are based</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {JOS_LOCATIONS.map(loc => {
                  const active = location === loc;
                  return (
                    <button
                      key={loc}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleLocation(loc)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-95 ${
                        active
                          ? 'bg-amber-400 border-[#09251B] text-[#09251B]'
                          : 'bg-white border-stone-300 text-stone-700 hover:border-[#0D4734]'
                      }`}
                    >
                      {loc}
                    </button>
                  );
                })}
              </div>
              {location && !JOS_LOCATIONS.includes(location) && (
                <button
                  type="button"
                  onClick={() => setLocation('')}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-[#09251B] bg-amber-400 text-[#09251B] flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <X className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{location}</span>
                </button>
              )}
            </section>

            {/* Bio — last, and deliberately quiet. */}
            <section className="space-y-2 pb-2">
              <label
                htmlFor="profile-bio"
                className="block text-[11px] font-bold uppercase tracking-wide text-stone-500"
              >
                Anything else (optional)
              </label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                placeholder="A line about you, if you feel like it."
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-xs text-stone-700 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-stone-400 resize-none"
              />
            </section>
          </div>
        </div>

        {/* Sticky footer. Skipping is as easy as saving, and looks it. */}
        <div className="shrink-0 border-t border-stone-300 bg-[#FAF6EE] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && <p role="alert" className="max-w-xl mx-auto mb-3 text-sm text-red-700">{error}</p>}
          <div className="max-w-xl mx-auto w-full flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-200 cursor-pointer"
            >
              Skip
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#0D4734] hover:bg-[#166E52] text-white text-sm font-display font-black border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] cursor-pointer active:translate-y-0.5 transition"
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
