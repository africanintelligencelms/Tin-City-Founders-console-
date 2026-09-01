import React from 'react';
import { NavigationTab, AttendeeProfile } from '../types';
import { Vote, Users, Sparkles, Timer, Grid3X3, Trophy, QrCode, User, Edit3, Tv, Activity, Radio } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  votedCount?: number;
  attendeeCount?: number;
  currentProfile: AttendeeProfile | null;
  onOpenProfile: () => void;
  onOpenAnalytics?: () => void;
}

interface TabItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  highlight?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  votedCount = 0,
  attendeeCount = 0,
  currentProfile,
  onOpenProfile,
  onOpenAnalytics
}) => {
  const tabs: TabItem[] = [
    { id: 'voting', label: 'Voting & Topics', icon: Vote, badge: votedCount > 0 ? `${votedCount}` : null },
    { id: 'attendees', label: 'Who\'s In The Room', icon: Users, badge: attendeeCount > 0 ? `${attendeeCount}` : null },
    { id: 'prompts', label: 'Icebreakers', icon: Sparkles },
    { id: 'speed', label: 'Speed-Founding', icon: Timer },
    { id: 'bingo', label: 'Founder Bingo', icon: Grid3X3 },
    { id: 'score', label: 'Scoreboard', icon: Trophy },
    { id: 'join', label: 'Projector / QR', icon: Tv, highlight: true },
  ];

  const getInitials = (n: string) => {
    if (!n) return 'TC';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <header className="flex flex-col lg:flex-row items-center justify-between px-4 sm:px-8 py-3.5 border-b-3 border-[#09251B] bg-white sticky top-0 z-40 gap-3.5 shadow-sm">
      {/* Brand / Logo */}
      <div className="flex items-center justify-between w-full lg:w-auto gap-4">
        <div 
          onClick={() => setActiveTab('voting')} 
          className="cursor-pointer group"
        >
          <BrandLogo variant="full" />
        </div>

        {/* Mobile: Room Live Status & Profile CTA */}
        <div className="flex items-center gap-2 lg:hidden">
          {onOpenAnalytics && (
            <button
              onClick={onOpenAnalytics}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#EBF3EF] border border-[#0D4734]/30 rounded-xl text-xs font-display font-bold text-[#0D4734] shadow-xs active:scale-95 transition cursor-pointer"
              title="Click to open Room Live Analytics"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{attendeeCount} Live</span>
              <Activity className="w-3 h-3 text-[#0D4734]" />
            </button>
          )}

          {currentProfile ? (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 p-1.5 bg-[#FAF8F4] border-2 border-[#09251B] rounded-xl cursor-pointer shadow-[2px_2px_0px_0px_#09251B]"
            >
              <div 
                className="w-7 h-7 rounded-lg border border-[#09251B] flex items-center justify-center text-white font-display font-black text-xs"
                style={{ backgroundColor: currentProfile.avatarColor || '#0D4734' }}
              >
                {getInitials(currentProfile.name)}
              </div>
              <Edit3 className="w-3.5 h-3.5 text-[#09251B] mr-1" />
            </button>
          ) : (
            <button
              onClick={onOpenProfile}
              className="bg-[#E5A93C] hover:bg-[#D4952B] text-[#09251B] border-2 border-[#09251B] font-display font-black text-xs px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_0px_#09251B] cursor-pointer"
            >
              + Tag Profile
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 sm:gap-1.5 p-1 bg-[#F4EFE6]/80 border border-[#09251B]/20 rounded-2xl flex-wrap justify-center shadow-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as NavigationTab)}
              className={`font-display tracking-tight text-xs sm:text-[13px] px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-1.5 relative select-none ${
                isActive
                  ? 'bg-[#0D4734] text-[#FAF6EE] font-extrabold shadow-md shadow-[#0D4734]/30 ring-1 ring-[#0D4734] scale-[1.02]'
                  : tab.highlight
                  ? 'bg-amber-100/80 text-[#09251B] font-bold border border-amber-300/80 hover:bg-amber-200/80 hover:scale-[1.01]'
                  : 'text-[#09251B]/80 font-bold hover:text-[#0D4734] hover:bg-white/90 hover:shadow-sm'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] transition-colors ${
                isActive ? 'text-[#E5A93C]' : tab.highlight ? 'text-amber-700' : 'text-[#09251B]/60'
              }`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`px-1.5 py-0.5 text-[10px] font-black rounded-full leading-none shadow-sm ${
                  isActive ? 'bg-[#E5A93C] text-[#09251B]' : 'bg-[#0D4734] text-[#FAF6EE]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Desktop Controls: Room Live Analytics Pill + Profile Badge */}
      <div className="hidden lg:flex items-center gap-3">
        {onOpenAnalytics && (
          <button
            onClick={onOpenAnalytics}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-[#EBF3EF] to-[#DEF0E7] hover:from-[#DEF0E7] hover:to-[#D2EADB] border border-[#0D4734]/30 rounded-xl text-xs font-display font-bold text-[#0D4734] shadow-xs hover:shadow transition-all duration-150 cursor-pointer active:scale-95 group"
            title="Click to view real-time Room Intelligence & Collective Visualizations"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
            </span>
            <div className="text-left">
              <span className="block font-black text-[#0D4734] text-xs leading-none">
                {attendeeCount} Founders In Room
              </span>
              <span className="block text-[9px] font-mono text-[#09251B]/70 tracking-tight">
                Live Room Analytics
              </span>
            </div>
            <Activity className="w-3.5 h-3.5 text-[#0D4734] group-hover:scale-110 transition-transform" />
          </button>
        )}

        {currentProfile ? (
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 px-3 py-1.5 bg-white hover:bg-[#F9F6F0] border border-[#09251B]/25 hover:border-[#0D4734] rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 group"
            title="Click to edit your tags and bio"
          >
            <div 
              className="w-7 h-7 rounded-lg border border-[#09251B]/30 flex items-center justify-center text-white font-display font-black text-[11px] shadow-sm"
              style={{ backgroundColor: currentProfile.avatarColor || '#0D4734' }}
            >
              {getInitials(currentProfile.name)}
            </div>
            <div className="text-left">
              <div className="font-display font-black text-xs text-[#09251B] flex items-center gap-1 leading-tight">
                <span className="truncate max-w-[110px]">{currentProfile.name}</span>
                <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-[#0D4734] transition-colors" />
              </div>
              <span className="block text-[10px] font-bold text-[#0D4734] truncate max-w-[120px]">
                {currentProfile.tags?.[0] || currentProfile.title || 'Checked in'}
              </span>
            </div>
          </button>
        ) : (
          <button
            onClick={onOpenProfile}
            className="bg-gradient-to-r from-[#E5A93C] to-[#D4952B] hover:from-[#D4952B] hover:to-[#C38520] text-[#09251B] font-display font-black text-xs px-3.5 py-2 rounded-xl border border-[#09251B]/30 shadow-sm hover:shadow-md flex items-center gap-1.5 cursor-pointer transition-all duration-200 active:scale-95"
          >
            <User className="w-3.5 h-3.5" />
            <span>Check In / Tag Bio</span>
          </button>
        )}
      </div>
    </header>
  );
};
