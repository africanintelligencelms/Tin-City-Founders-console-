import React, { useState, useEffect } from 'react';
import { X, MapPin, Handshake, Check } from 'lucide-react';
import { AttendeeProfile } from '../types';
import { POPULAR_SKILLS, JOS_LOCATIONS } from '../data/profileTags';

interface AudienceProfileSheetProps {
  isOpen: boolean;
  currentProfile: AttendeeProfile | null;
  onClose: () => void;
  onSaveProfile: (profile: AttendeeProfile) => void;
}

/**
 * The audience profile sheet.
 *
 * Check-in stays name-only on purpose. Everything richer lives here, behind the
 * profile control in the audience header, as a separate full-screen surface that
 * covers the participation view and then gets out of the way. Nothing is added
 * to the default audience screen: the room was told last time that the phone UI
 * was too complex, so this only exists while somebody has deliberately opened it.
 *
 * Every field is optional and every field starts blank unless the attendee
 * previously typed something. Nothing here invents a title, a tag or a town.
 */
export const AudienceProfileSheet: React.FC<AudienceProfileSheetProps> = ({
  isOpen,
  currentProfile,
  onClose,
  onSaveProfile
}) => {
  const [giveAsk, setGiveAsk] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');

  // Refill from the live profile each time the sheet is opened, so a half-typed
  // draft that was abandoned last time never resurfaces as if it were saved.
  useEffect(() => {
    if (!isOpen) return;
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Blank stays blank. A trimmed-empty field is saved as empty, never
    // backfilled with a plausible-sounding default.
    onSaveProfile({
      ...currentProfile,
      title: title.trim(),
      tags: tags.map(t => t.trim()).filter(Boolean),
      giveAsk: giveAsk.trim(),
      location: location.trim(),
      bio: bio.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#FAF6EE] text-stone-900 flex flex-col animate-in fade-in duration-150">
      {/* Sticky top bar — closing here discards, and says so. */}
      <header className="shrink-0 bg-[#0D4734] text-white px-4 py-3 flex items-center justify-between gap-3 shadow-md">
        <div className="min-w-0">
          <h2 className="text-base font-display font-black leading-tight truncate">Your Profile</h2>
          <p className="text-[11px] text-emerald-200/90 truncate">
            All optional. Fill in what you want people to know.
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
            {/* Who this is. Read-only here — the name and badge colour belong to check-in. */}
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-black text-lg text-white shrink-0"
                style={{ backgroundColor: currentProfile.avatarColor || '#0D4734' }}
              >
                {currentProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-display font-black text-[#09251B] truncate">
                  {currentProfile.name}
                </div>
                <div className="text-[11px] text-stone-500">Checked in</div>
              </div>
            </div>

            {/* GIVE & ASK — the one field worth a stranger's attention at a mixer. */}
            <section className="bg-white rounded-2xl border-2 border-[#0D4734] shadow-[3px_3px_0px_0px_#09251B] p-4 space-y-2">
              <label htmlFor="profile-give-ask" className="flex items-center gap-2 text-[#0D4734]">
                <Handshake className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-sm font-display font-black">Give &amp; Ask</span>
              </label>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                What can you offer the room, and what do you need from it? This is what shows up
                on the big screen and in the directory.
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
                Role / Venture
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
          <div className="max-w-xl mx-auto w-full flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-200 cursor-pointer"
            >
              Skip
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-[#0D4734] hover:bg-[#166E52] text-white text-sm font-display font-black border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] cursor-pointer active:translate-y-0.5 transition"
            >
              Save Profile
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
