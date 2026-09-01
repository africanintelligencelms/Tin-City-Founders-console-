import React, { useState } from 'react';
import { AttendeeProfile } from '../types';
import { Sparkles, Tag, MapPin, X, Check, ArrowRight, Lightbulb } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface FounderCheckInModalProps {
  currentProfile: AttendeeProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (profile: AttendeeProfile) => void;
  isFirstCheckIn?: boolean;
}

const PRESET_TAGS = [
  'AI & Software',
  'Agro-Tech & Cold Chain',
  'Fintech & Payments',
  'Hardware & Solar',
  'Product & UX Design',
  'Founder / CEO',
  'Student / Builder',
  'DevOps & Cloud',
  'Investor / Grants',
  'Logistics & Supply',
  'Marketing & Growth',
  'Gov & Civic Tech'
];

const PRESET_LOCATIONS = [
  'Rayfield, Jos',
  'Jos South (Vom/Bukuru)',
  'Jos North / Central',
  'Anglo Jos (Tech Corridor)',
  'University of Jos / PLASU',
  'Bokkos / Mangu Ag Zone',
  'Remote / Other'
];

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
  const [title, setTitle] = useState<string>(currentProfile?.title || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    currentProfile?.tags && currentProfile.tags.length > 0 ? currentProfile.tags : ['Founder / CEO']
  );
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [bio, setBio] = useState<string>(currentProfile?.bio || '');
  const [giveAsk, setGiveAsk] = useState<string>(currentProfile?.giveAsk || '');
  const [location, setLocation] = useState<string>(currentProfile?.location || 'Rayfield, Jos');
  const [avatarColor, setAvatarColor] = useState<string>(currentProfile?.avatarColor || '#0D4734');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    const trimmed = customTagInput.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
      setCustomTagInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name or founder handle.');
      return;
    }

    const profile: AttendeeProfile = {
      id: currentProfile?.id || `att-${Date.now()}`,
      name: name.trim(),
      title: title.trim() || 'Tin City Founder',
      tags: selectedTags.length > 0 ? selectedTags : ['Founder / CEO'],
      bio: bio.trim(),
      giveAsk: giveAsk.trim(),
      location,
      avatarColor,
      checkedInAt: currentProfile?.checkedInAt || new Date().toISOString()
    };

    onSaveProfile(profile);
    onClose();
  };

  const getInitials = (n: string) => {
    if (!n) return 'TC';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08291E]/80 backdrop-blur-sm overflow-y-auto">
      <div 
        className="bg-white border-4 border-[#09251B] rounded-3xl w-full max-w-xl p-6 sm:p-8 my-8 shadow-[10px_10px_0px_0px_#09251B] relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        {!isFirstCheckIn && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-xl border-2 border-[#09251B] bg-[#FAF8F4] hover:bg-[#EBF3EF] text-[#09251B] flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}

        {/* Header Badge & Diamond Mark */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <BrandLogo variant="icon-only" size="md" />
          </div>

          <div className="inline-flex items-center gap-1.5 bg-[#E5A93C] text-[#09251B] border-2 border-[#09251B] px-3 py-1 rounded-full text-xs font-display font-black tracking-wider uppercase mb-2 shadow-[2px_2px_0px_0px_#09251B]">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>{isFirstCheckIn ? 'Welcome to Jos Meetup' : 'Founder Profile'}</span>
          </div>

          <h2 className="font-display font-black text-2xl sm:text-3xl text-[#09251B]">
            {isFirstCheckIn ? (
              <>
                JOIN THE <span className="text-[#0D4734] underline decoration-[#E5A93C] decoration-4">CONSOLE</span>
              </>
            ) : (
              'UPDATE YOUR PROFILE & TAGS'
            )}
          </h2>
          <p className="text-xs sm:text-sm text-[#09251B]/70 font-medium mt-1">
            Tag your skills & startup focus so founders in the room can find and connect with you tonight.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border-2 border-rose-500 text-rose-800 text-xs font-bold p-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar & Color Picker */}
          <div className="flex items-center gap-4 p-3 bg-[#FAF8F4] border-2 border-[#09251B] rounded-2xl">
            <div 
              className="w-14 h-14 rounded-2xl border-2 border-[#09251B] flex items-center justify-center text-[#FAF6EE] font-display font-black text-xl shadow-[3px_3px_0px_0px_#09251B] shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {getInitials(name)}
            </div>
            <div className="flex-1">
              <span className="block text-xs font-display font-black text-[#09251B] uppercase mb-1.5">
                Badge Color:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setAvatarColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-6 h-6 rounded-full border-2 border-[#09251B] transition-transform cursor-pointer ${
                      avatarColor === c.hex ? 'scale-125 ring-2 ring-[#0D4734] ring-offset-1' : 'hover:scale-110'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Name & Startup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wide mb-1">
                Your Name / Handle *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="e.g. Pamela Dung or Gyang K."
                required
                className="w-full px-3.5 py-2.5 bg-white border-2 border-[#09251B] rounded-xl text-[#09251B] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0D4734] shadow-[2px_2px_0px_0px_#09251B]"
              />
            </div>

            <div>
              <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wide mb-1">
                Role / Venture
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Founder @ AgriPlateau"
                className="w-full px-3.5 py-2.5 bg-white border-2 border-[#09251B] rounded-xl text-[#09251B] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0D4734] shadow-[2px_2px_0px_0px_#09251B]"
              />
            </div>
          </div>

          {/* Tags Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-display font-black text-[#09251B] uppercase tracking-wide flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#0D4734]" />
                <span>Select Your Tags / Skills</span>
              </label>
              <span className="text-[11px] font-bold text-[#0D4734]">
                {selectedTags.length} selected
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2 max-h-32 overflow-y-auto p-1.5 bg-[#FAF8F4] border-2 border-[#09251B]/20 rounded-xl">
              {PRESET_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#0D4734] text-[#FAF6EE] border-[#09251B] shadow-[2px_2px_0px_0px_#09251B]'
                        : 'bg-white text-[#09251B] border-slate-300 hover:border-[#09251B]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3] text-[#E5A93C]" />}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Tag Input */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="Add custom tag (e.g. Lapidary, Drone Ops)..."
                className="flex-1 px-3 py-1.5 bg-white border-2 border-[#09251B] rounded-lg text-xs font-bold text-[#09251B] focus:outline-none focus:ring-1 focus:ring-[#0D4734]"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="bg-[#FAF8F4] hover:bg-[#EBF3EF] text-[#09251B] border-2 border-[#09251B] font-display font-black text-xs px-3 py-1.5 rounded-lg cursor-pointer transition shadow-[1px_1px_0px_0px_#09251B]"
              >
                + Add Tag
              </button>
            </div>
          </div>

          {/* Location Hub */}
          <div>
            <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wide mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#0D4734]" />
              <span>Plateau Base / Hub</span>
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border-2 border-[#09251B] rounded-xl text-[#09251B] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0D4734] shadow-[2px_2px_0px_0px_#09251B]"
            >
              {PRESET_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Bio / What I'm Building */}
          <div>
            <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wide mb-1">
              Short Bio / What you're building (Optional)
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Scaling solar cold storage for Irish potato farmers in Bokkos."
              maxLength={140}
              className="w-full px-3.5 py-2 bg-white border-2 border-[#09251B] rounded-xl text-[#09251B] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0D4734] shadow-[2px_2px_0px_0px_#09251B]"
            />
          </div>

          {/* Give & Ask */}
          <div>
            <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wide mb-1 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-[#E5A93C] fill-current" />
              <span>Give & Ask (Optional)</span>
            </label>
            <input
              type="text"
              value={giveAsk}
              onChange={(e) => setGiveAsk(e.target.value)}
              placeholder="Give: IoT advice. Ask: Introductions to farm co-ops in Jos."
              maxLength={160}
              className="w-full px-3.5 py-2 bg-white border-2 border-[#09251B] rounded-xl text-[#09251B] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0D4734] shadow-[2px_2px_0px_0px_#09251B]"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              className="w-full sm:flex-1 bg-[#0D4734] hover:bg-[#125B43] text-[#FAF6EE] font-display font-black text-sm px-6 py-3.5 rounded-2xl border-3 border-[#09251B] shadow-[4px_4px_0px_0px_#09251B] flex items-center justify-center gap-2 cursor-pointer transition hover:scale-[1.01]"
            >
              <span>{isFirstCheckIn ? 'ENTER THE CONSOLE & ACTIVITIES' : 'SAVE PROFILE'}</span>
              <ArrowRight className="w-4 h-4 stroke-[3] text-[#E5A93C]" />
            </button>

            {isFirstCheckIn && (
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-3 text-xs font-display font-bold text-[#09251B]/70 hover:text-[#09251B] underline cursor-pointer"
              >
                Explore as Guest
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
