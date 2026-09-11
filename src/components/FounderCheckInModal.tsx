import React, { useState, useEffect } from 'react';
import { AttendeeProfile } from '../types';
import { X, ArrowRight } from 'lucide-react';

interface FounderCheckInModalProps {
  currentProfile: AttendeeProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (profile: AttendeeProfile) => Promise<void>;
  isFirstCheckIn?: boolean;
  initialRecovery?: boolean;
}

const AVATAR_COLORS = [
  { name: 'TCF Forest Green', hex: '#0D4734' },
  { name: 'Plateau Gold', hex: '#E5A93C' },
  { name: 'Deep Ochre', hex: '#BF7E1D' },
  { name: 'Emerald Pine', hex: '#166E52' },
  { name: 'Warm Terracotta', hex: '#C85A28' },
  { name: 'Rich Teal', hex: '#0F6B5C' }
];

export const FounderCheckInModal: React.FC<FounderCheckInModalProps> = ({
  currentProfile,
  isOpen,
  onClose,
  onSaveProfile,
  initialRecovery = false,
  isFirstCheckIn = false
}) => {
  const [recovering, setRecovering] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string>(currentProfile?.name || '');
  const [avatarColor, setAvatarColor] = useState<string>(currentProfile?.avatarColor || '#0D4734');
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setName(currentProfile?.name || '');
      setAvatarColor(currentProfile?.avatarColor || '#0D4734');
      setShowColorPicker(false);
      setError('');
      setRecovering(initialRecovery);
      setPhone('');
    }
  }, [isOpen, currentProfile, initialRecovery]);

  // Escape closes, matching the challenge detail and the profile sheet.
  useEffect(() => {
    if (!isOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (recovering) {
      setBusy(true);
      setError('');
      try {
        const res = await fetch('/api/profile/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp: phone }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not find your profile.');
        localStorage.setItem('tcf_my_profile', JSON.stringify(data.attendee));
        localStorage.removeItem('tcf_user_votes');
        localStorage.removeItem('tcf_user_commits');
        window.location.reload();
      } catch (err) { setError(err instanceof Error ? err.message : 'Could not connect. Please try again.'); }
      finally { setBusy(false); }
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name to join the session.');
      return;
    }

    // Check-in is name + badge colour, nothing more. Everything else is carried
    // through untouched from whatever the attendee already set in the profile
    // sheet — and left genuinely blank if they never set it. Inventing a title,
    // a tag or a town here is what made every directory card read the same.
    const profile: AttendeeProfile = {
      ...currentProfile,
      id: currentProfile?.id || `att-${crypto.randomUUID()}`,
      name: name.trim(),
      title: currentProfile?.title || '',
      tags: currentProfile?.tags || [],
      bio: currentProfile?.bio || '',
      giveAsk: currentProfile?.giveAsk || '',
      location: currentProfile?.location || '',
      avatarColor,
      checkedInAt: currentProfile?.checkedInAt || new Date().toISOString()
    };

    setBusy(true);
    try { await onSaveProfile(profile); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  };

  const getInitials = (n: string) => {
    if (!n.trim()) return 'TC';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  return (
    // Dismissible by backdrop and Escape. This modal used to be forced open over
    // the page on every first visit with neither escape, which made the first
    // frame a wall rather than the community.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09251B]/80 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
      role="presentation"
    >
      <div 
        className="bg-white border-3 border-[#09251B] rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-[8px_8px_0px_0px_#09251B] relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar: Close Button */}
        <div className="flex justify-end mb-1">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Heading */}
        <div className="mb-5">
          <h2 className="font-display font-black text-2xl text-[#09251B] tracking-tight">
            {recovering ? 'Welcome back' : isFirstCheckIn ? 'Welcome to Tin City Founders' : 'Founder Profile'}
          </h2>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border-2 border-rose-400 text-rose-800 text-xs font-bold p-2.5 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {recovering ? (
            <div className="space-y-3">
              <label htmlFor="recover-phone" className="block text-sm font-bold">Your saved WhatsApp number</label>
              <input id="recover-phone" type="tel" autoComplete="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678 or +2348012345678" className="w-full px-3 py-3 rounded-xl border-2 border-[#09251B]" />
              <p className="text-xs text-stone-600">Use the number you previously added in Your Profile. No verification code is required.</p>
            </div>
          ) : (<>
          {/* Name & Avatar Preview */}
          <div className="flex items-center gap-3">
            {/* Clickable Avatar to toggle color */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-12 h-12 rounded-2xl border-2 border-[#09251B] flex items-center justify-center text-white font-display font-black text-base shadow-[2px_2px_0px_0px_#09251B] transition hover:scale-105 cursor-pointer"
                style={{ backgroundColor: avatarColor }}
                title="Click to customize badge color"
              >
                {getInitials(name)}
              </button>
            </div>

            <div className="flex-1">
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="Your Name *"
                aria-label="Your Name"
                required
                className="w-full px-3.5 py-3 bg-stone-50 border-2 border-[#09251B] rounded-xl text-[#09251B] text-sm font-bold placeholder:text-stone-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0D4734]"
              />
            </div>
          </div>

          {/* Color palette picker (dropdown/toggle) */}
          {showColorPicker && (
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-stone-600">Badge color:</span>
              <div className="flex items-center gap-2">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => { setAvatarColor(c.hex); setShowColorPicker(false); }}
                    style={{ backgroundColor: c.hex }}
                    className={`w-5 h-5 rounded-full border border-stone-800 transition cursor-pointer ${
                      avatarColor === c.hex ? 'scale-125 ring-2 ring-[#0D4734] ring-offset-1' : 'hover:scale-110'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          )}

          </>)}
          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit" disabled={busy}
              className="w-full bg-[#0D4734] hover:bg-[#125B43] text-white font-display font-black text-sm py-3.5 px-6 rounded-2xl border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] flex items-center justify-center gap-2 cursor-pointer transition active:translate-y-0.5"
            >
              <span>{busy ? 'Please wait…' : recovering ? 'Find my profile' : isFirstCheckIn ? 'Join Community' : 'Save Profile'}</span>
              <ArrowRight className="w-4 h-4 stroke-[3] text-amber-400" />
            </button>

            <button type="button" disabled={busy} onClick={() => { setRecovering(!recovering); setError(''); }} className="w-full py-2 text-sm font-bold text-[#0D4734] underline">
              {recovering ? 'Back to quick entry' : 'Already joined? Find your profile'}
            </button>
            {/* The "Browse as Guest (Read-Only)" link that used to sit here was
                both the only way out and inaccurate — a guest can read every
                challenge, member and result. The modal now closes on the X, the
                backdrop or Escape, so an escape hatch styled as an apology is
                worse than none. */}
          </div>
        </form>
      </div>
    </div>
  );
};
