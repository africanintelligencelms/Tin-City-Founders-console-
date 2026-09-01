import React, { useState } from 'react';
import { AttendeeProfile } from '../types';
import { Users, Search, MapPin, Lightbulb, Sparkles, UserPlus, CheckCircle } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface AttendeeDirectoryProps {
  attendees: AttendeeProfile[];
  currentProfile: AttendeeProfile | null;
  onOpenCheckIn: () => void;
  onConnectWithFounder?: (founderName: string) => void;
}

export const AttendeeDirectory: React.FC<AttendeeDirectoryProps> = ({
  attendees,
  currentProfile,
  onOpenCheckIn,
  onConnectWithFounder
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');
  const [connectedIds, setConnectedIds] = useState<string[]>([]);

  // Collect all unique tags
  const allTags = Array.from(
    new Set(attendees.flatMap(a => a.tags || []))
  ).filter(Boolean);

  // Filter attendees
  const filteredAttendees = attendees.filter(attendee => {
    const matchesSearch = 
      attendee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attendee.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (attendee.bio && attendee.bio.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (attendee.giveAsk && attendee.giveAsk.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (attendee.location && attendee.location.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = 
      selectedTagFilter === 'ALL' || 
      (attendee.tags && attendee.tags.includes(selectedTagFilter));

    return matchesSearch && matchesTag;
  });

  const getInitials = (n: string) => {
    if (!n) return 'TC';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const handleSayHi = (attendee: AttendeeProfile) => {
    if (!connectedIds.includes(attendee.id)) {
      setConnectedIds([...connectedIds, attendee.id]);
      if (onConnectWithFounder) {
        onConnectWithFounder(attendee.name);
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white border-4 border-[#09251B] rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_#09251B]">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-[#E5A93C] text-[#09251B] border-2 border-[#09251B] px-3 py-1 rounded-full text-xs font-display font-black tracking-wider uppercase mb-2 shadow-[2px_2px_0px_0px_#09251B]">
            <Users className="w-3.5 h-3.5" />
            <span>ROOM DIRECTORY · {attendees.length} FOUNDERS CHECKED IN</span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl text-[#09251B]">
            WHO'S IN THE <span className="text-[#0D4734] underline decoration-[#E5A93C] decoration-8">ROOM TONIGHT</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#09251B]/70 font-medium mt-1 max-w-xl">
            Discover fellow Plateau founders, engineers, and creatives. Filter by tags or search for specific Give & Asks to spark collaborations right now.
          </p>
        </div>

        <button
          onClick={onOpenCheckIn}
          className="bg-gradient-to-r from-[#F59E0B] via-[#E5A93C] to-[#D97706] hover:from-[#E5A93C] hover:to-[#B45309] text-[#09251B] font-display font-black text-xs sm:text-sm px-5 sm:px-6 py-3 sm:py-3.5 rounded-2xl border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] hover:shadow-[4px_4px_0px_0px_#09251B] flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 shrink-0 hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]"
        >
          <Sparkles className="w-4 h-4 fill-current" />
          <span>{currentProfile ? 'Edit My Profile & Tags' : '+ Check In As Founder'}</span>
        </button>
      </div>

      {/* Search & Tag Filter Bar */}
      <div className="space-y-3.5 mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0D4734]/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by founder name, skills, tags, give/asks, or Jos area..."
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-[#09251B]/25 focus:border-[#0D4734] rounded-2xl text-[#09251B] text-xs sm:text-sm font-semibold placeholder-[#09251B]/40 focus:outline-none focus:ring-2 focus:ring-[#0D4734]/20 shadow-sm transition-all"
          />
        </div>

        {/* Tag Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setSelectedTagFilter('ALL')}
            className={`text-xs font-display font-bold px-3.5 py-1.5 rounded-xl border transition-all duration-150 whitespace-nowrap cursor-pointer ${
              selectedTagFilter === 'ALL'
                ? 'bg-[#0D4734] text-[#FAF6EE] border-[#0D4734] shadow-sm font-extrabold'
                : 'bg-white text-[#09251B] border-[#09251B]/20 hover:border-[#09251B]/40 hover:bg-[#FAF8F4]'
            }`}
          >
            All Tags ({attendees.length})
          </button>
          {allTags.map((tag) => {
            const count = attendees.filter(a => a.tags?.includes(tag)).length;
            const isSelected = selectedTagFilter === tag;
            return (
              <button
                key={tag}
                onClick={() => setSelectedTagFilter(tag)}
                className={`text-xs font-display font-bold px-3 py-1.5 rounded-xl border transition-all duration-150 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#0D4734] text-[#FAF6EE] border-[#0D4734] shadow-sm font-extrabold'
                    : 'bg-white text-[#09251B] border-[#09251B]/20 hover:border-[#09251B]/40 hover:bg-[#FAF8F4]'
                }`}
              >
                <span>{tag}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${isSelected ? 'bg-[#E5A93C] text-[#09251B]' : 'bg-[#FAF8F4] text-[#0D4734]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Attendees Grid */}
      {filteredAttendees.length === 0 ? (
        <div className="bg-white border-4 border-[#09251B] rounded-3xl p-12 text-center shadow-[6px_6px_0px_0px_#09251B]">
          <Users className="w-12 h-12 text-[#0D4734]/40 mx-auto mb-3" />
          <h3 className="font-display font-black text-xl text-[#09251B]">No founders found matching this filter</h3>
          <p className="text-xs text-[#09251B]/60 mt-1 max-w-sm mx-auto">
            Try clearing your search query or selecting "ALL TAGS" to view everyone checked in.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedTagFilter('ALL'); }}
            className="mt-4 bg-[#0D4734] text-[#FAF6EE] font-display font-black text-xs px-5 py-2.5 rounded-xl border-2 border-[#09251B] shadow-[2px_2px_0px_0px_#09251B] cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAttendees.map((attendee) => {
            const isMe = currentProfile?.id === attendee.id;
            const isConnected = connectedIds.includes(attendee.id);

            return (
              <div
                key={attendee.id}
                className={`bg-white border-4 border-[#09251B] rounded-3xl p-6 shadow-[6px_6px_0px_0px_#09251B] flex flex-col justify-between transition-transform hover:-translate-y-0.5 relative ${
                  isMe ? 'ring-3 ring-[#E5A93C]' : ''
                }`}
              >
                {isMe && (
                  <span className="absolute top-4 right-4 bg-[#FEF7EB] text-[#0D4734] border-2 border-[#09251B] text-[10px] font-display font-black px-2.5 py-0.5 rounded-full uppercase shadow-[1px_1px_0px_0px_#09251B]">
                    YOU
                  </span>
                )}

                <div>
                  {/* Founder Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-13 h-13 rounded-2xl border-2 border-[#09251B] flex items-center justify-center text-white font-display font-black text-lg shadow-[3px_3px_0px_0px_#09251B] shrink-0"
                      style={{ backgroundColor: attendee.avatarColor || '#0D4734' }}
                    >
                      {getInitials(attendee.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-black text-lg sm:text-xl text-[#09251B] truncate">
                        {attendee.name}
                      </h3>
                      <p className="text-xs font-bold text-[#0D4734] truncate">
                        {attendee.title}
                      </p>
                      {attendee.location && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#09251B]/60 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#0D4734]" />
                          <span>{attendee.location}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {attendee.tags && attendee.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {attendee.tags.map((tag) => (
                        <span
                          key={tag}
                          onClick={() => setSelectedTagFilter(tag)}
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#FAF8F4] text-[#0D4734] border border-[#0D4734]/30 hover:border-[#09251B] cursor-pointer transition"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bio */}
                  {attendee.bio && (
                    <p className="text-xs text-[#09251B]/90 font-medium mb-3 leading-relaxed bg-[#FAF8F4] p-3 rounded-xl border border-[#09251B]/10">
                      "{attendee.bio}"
                    </p>
                  )}

                  {/* Give & Ask */}
                  {attendee.giveAsk && (
                    <div className="mb-4 bg-[#FEF7EB] border-2 border-[#E5A93C]/60 rounded-xl p-3 text-xs text-[#09251B] font-medium flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-[#BF7E1D] shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-display font-black uppercase text-[10px] tracking-wider text-[#0D4734] block">
                          Give & Ask:
                        </strong>
                        <span>{attendee.giveAsk}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-[#09251B]/15 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-mono text-[#09251B]/60">
                    Checked in {attendee.checkedInAt ? new Date(attendee.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                  </span>

                  {!isMe && (
                    <button
                      onClick={() => handleSayHi(attendee)}
                      className={`text-xs font-display font-bold px-3.5 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                        isConnected
                          ? 'bg-[#EBF3EF] text-[#0D4734] border-[#0D4734]/30 shadow-xs font-extrabold'
                          : 'bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] hover:from-[#E5A93C] hover:to-[#D97706] text-[#09251B] border-amber-600 shadow-sm hover:shadow'
                      }`}
                    >
                      {isConnected ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-[#0D4734]" />
                          <span>Connected</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Say Hi / Connect</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
