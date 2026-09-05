import React, { useState, useEffect } from 'react';
import { AttendeeProfile } from '../types';
import { X, ArrowRight } from 'lucide-react';

interface FounderCheckInModalProps {
  currentProfile: AttendeeProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (profile: AttendeeProfile) => void;
  isFirstCheckIn?: boolean;
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
  isFirstCheckIn = false
}) => {
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
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name to join the session.');
      return;
    }

    // Check-in is name + badge colour, nothing more. Everything else is carried
    // through untouched from whatever the attendee already set in the profile
    // sheet — and left genuinely blank if they never set it. Inventing a title,
    // a tag or a town here is what made every directory card read the same.
    const profile: AttendeeProfile = {
      id: currentProfile?.id || `att-${Date.now()}`,
      name: name.trim(),
      title: currentProfile?.title || '',
      tags: currentProfile?.tags || [],
      bio: currentProfile?.bio || '',
      giveAsk: currentProfile?.giveAsk || '',
      location: currentProfile?.location || '',
      avatarColor,
      checkedInAt: currentProfile?.checkedInAt || new Date().toISOString()
    };

    onSaveProfile(profile);
    onClose();
  };

  const getInitials = (n: string) => {
    if (!n.trim()) return 'TC';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09251B]/80 backdrop-blur-xs overflow-y-auto">
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
            {isFirstCheckIn ? 'Welcome to the Meetup' : 'Founder Profile'}
          </h2>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border-2 border-rose-400 text-rose-800 text-xs font-bold p-2.5 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full bg-[#0D4734] hover:bg-[#125B43] text-white font-display font-black text-sm py-3.5 px-6 rounded-2xl border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] flex items-center justify-center gap-2 cursor-pointer transition active:translate-y-0.5"
            >
              <span>{isFirstCheckIn ? 'Join Live Session' : 'Save Profile'}</span>
              <ArrowRight className="w-4 h-4 stroke-[3] text-amber-400" />
            </button>

            {isFirstCheckIn && (
              <button
                type="button"
                onClick={onClose}
                className="w-full text-center text-xs text-stone-500 hover:text-stone-800 font-medium py-1.5 cursor-pointer"
              >
                Browse as Guest (Read-Only)
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
