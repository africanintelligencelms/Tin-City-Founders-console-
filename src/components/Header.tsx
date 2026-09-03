import React, { useState, useRef, useEffect } from 'react';
import { NavigationTab, AttendeeProfile } from '../types';
import { 
  Vote, 
  Users, 
  Sparkles, 
  Timer, 
  Grid3X3, 
  Trophy, 
  Tv, 
  User, 
  Edit3, 
  Activity, 
  ChevronDown, 
  Flame, 
  Compass, 
  Check, 
  Radio,
  Smartphone
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  votedCount?: number;
  attendeeCount?: number;
  currentProfile: AttendeeProfile | null;
  onOpenProfile: () => void;
  onOpenAnalytics?: () => void;
  onSwitchToAudienceView?: () => void;
  syncStatus?: 'connected' | 'connecting' | 'reconnecting' | 'offline';
  latencyMs?: number | null;
  onReconnect?: () => void;
}

interface CoreTrackItem {
  id: NavigationTab;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  highlight?: boolean;
}

interface ActivationItem {
  id: NavigationTab;
  label: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  votedCount = 0,
  attendeeCount = 0,
  currentProfile,
  onOpenProfile,
  onOpenAnalytics,
  onSwitchToAudienceView,
  syncStatus = 'connected',
  latencyMs = 18,
  onReconnect
}) => {
  const [isActivationsOpen, setIsActivationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Core primary navigation tracks
  const coreTracks: CoreTrackItem[] = [
    { 
      id: 'voting', 
      label: 'Workspace & Voting', 
      shortLabel: 'Workspace',
      icon: Vote, 
      badge: votedCount > 0 ? `${votedCount}` : null 
    },
    { 
      id: 'attendees', 
      label: 'Founder Directory', 
      shortLabel: 'Directory',
      icon: Users, 
      badge: attendeeCount > 0 ? `${attendeeCount}` : null 
    },
    { 
      id: 'join', 
      label: 'Projector Stage', 
      shortLabel: 'Projector',
      icon: Tv, 
      badge: 'Stage',
      highlight: true 
    },
  ];

  // Transient social room activations
  const roomActivations: ActivationItem[] = [
    { 
      id: 'prompts', 
      label: 'Icebreaker Prompts', 
      tagline: 'Spicy convos & founder warmups',
      icon: Sparkles 
    },
    { 
      id: 'speed', 
      label: 'Speed-Founding', 
      tagline: '3-minute 1-on-1 sprint rounds',
      icon: Timer,
      badge: 'Timer'
    },
    { 
      id: 'bingo', 
      label: 'Founder Bingo', 
      tagline: '5-in-a-row room matchmaking',
      icon: Grid3X3 
    },
    { 
      id: 'score', 
      label: 'Live Scoreboard', 
      tagline: 'Room velocity & squad stats',
      icon: Trophy 
    },
  ];

  // Detect if an activation tab is currently active
  const activeActivation = roomActivations.find(a => a.id === activeTab);
  const isActivationActive = !!activeActivation;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsActivationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (n: string) => {
    if (!n) return 'TC';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const handleSelectActivation = (tabId: NavigationTab) => {
    setActiveTab(tabId);
    setIsActivationsOpen(false);
  };

  return (
    <header className="flex flex-col lg:flex-row items-center justify-between px-3 sm:px-6 lg:px-8 py-3 border-b-3 border-[#09251B] bg-white sticky top-0 z-40 gap-3 shadow-sm">
      {/* Brand Logo & Mobile Bar */}
      <div className="flex items-center justify-between w-full lg:w-auto gap-3">
        <div 
          onClick={() => setActiveTab('voting')} 
          className="cursor-pointer group flex items-center"
        >
          <BrandLogo variant="full" />
        </div>

        {/* Mobile: Room Live Status & Profile Button */}
        <div className="flex items-center gap-2 lg:hidden">
          {/* Mobile Live Sync Pill */}
          <button
            onClick={onReconnect}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-display font-bold ${
              syncStatus === 'connected'
                ? 'bg-[#EBF3EF] border-[#0D4734]/30 text-[#0D4734]'
                : syncStatus === 'offline'
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
            title="Click to sync state"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              syncStatus === 'connected' ? 'bg-emerald-600 animate-pulse' : syncStatus === 'offline' ? 'bg-rose-600' : 'bg-amber-500'
            }`} />
            <span>{syncStatus === 'connected' ? 'Live' : 'Sync'}</span>
          </button>

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
              className="flex items-center gap-1.5 p-1 bg-[#FAF8F4] border-2 border-[#09251B] rounded-xl cursor-pointer shadow-[2px_2px_0px_0px_#09251B]"
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
              className="bg-[#E5A93C] hover:bg-[#D4952B] text-[#09251B] border-2 border-[#09251B] font-display font-black text-xs px-2.5 py-1.5 rounded-xl shadow-[2px_2px_0px_0px_#09251B] cursor-pointer"
            >
              + Check In
            </button>
          )}
        </div>
      </div>

      {/* TWO-TIER NAVIGATION BAR */}
      <nav className="flex items-center gap-1.5 p-1.5 bg-[#F4EFE6]/90 border border-[#09251B]/20 rounded-2xl flex-wrap justify-center shadow-inner max-w-full">
        {/* Tier 1: Core Tracks (Workspace, Directory, Projector Stage) */}
        {coreTracks.map((track) => {
          const Icon = track.icon;
          const isActive = activeTab === track.id;
          return (
            <button
              key={track.id}
              onClick={() => setActiveTab(track.id)}
              className={`font-display tracking-tight text-xs sm:text-[13px] px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-1.5 relative select-none ${
                isActive
                  ? 'bg-[#0D4734] text-[#FAF6EE] font-extrabold shadow-md shadow-[#0D4734]/30 ring-1 ring-[#0D4734] scale-[1.02]'
                  : track.highlight
                  ? 'bg-amber-100/90 text-[#09251B] font-bold border border-amber-300/90 hover:bg-amber-200/90 hover:scale-[1.01]'
                  : 'text-[#09251B]/80 font-bold hover:text-[#0D4734] hover:bg-white/90 hover:shadow-sm'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] transition-colors ${
                isActive ? 'text-[#E5A93C]' : track.highlight ? 'text-amber-700' : 'text-[#09251B]/70'
              }`} />
              <span className="hidden sm:inline">{track.label}</span>
              <span className="sm:hidden">{track.shortLabel || track.label}</span>
              
              {track.badge && (
                <span className={`px-1.5 py-0.5 text-[10px] font-black rounded-full leading-none shadow-sm ${
                  isActive 
                    ? 'bg-[#E5A93C] text-[#09251B]' 
                    : track.highlight 
                    ? 'bg-[#0D4734] text-[#FAF6EE]' 
                    : 'bg-[#0D4734] text-[#FAF6EE]'
                }`}>
                  {track.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className="h-5 w-[1px] bg-[#09251B]/20 mx-0.5 hidden sm:block" />

        {/* Tier 2: Room Activations Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsActivationsOpen(prev => !prev)}
            className={`font-display tracking-tight text-xs sm:text-[13px] px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-1.5 select-none ${
              isActivationActive
                ? 'bg-[#0D4734] text-[#FAF6EE] font-extrabold shadow-md ring-1 ring-[#0D4734]'
                : isActivationsOpen
                ? 'bg-white text-[#0D4734] font-bold shadow-sm ring-1 ring-[#09251B]/20'
                : 'text-[#09251B]/80 font-bold hover:text-[#0D4734] hover:bg-white/90'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] ${
              isActivationActive ? 'text-[#E5A93C]' : 'text-[#09251B]/70'
            }`} />
            
            <span>
              {isActivationActive && activeActivation ? (
                <span className="flex items-center gap-1">
                  <span className="hidden md:inline">Activations:</span>
                  <span>{activeActivation.label}</span>
                </span>
              ) : (
                'Room Activations'
              )}
            </span>

            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isActivationsOpen ? 'rotate-180 text-[#E5A93C]' : 'text-slate-400'
            }`} />
          </button>

          {/* Activations Popover Dropdown Menu */}
          {isActivationsOpen && (
            <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 bg-white border-2 border-[#09251B] rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-1.5 border-b border-[#09251B]/10 mb-1">
                <div className="text-[10px] font-display font-black text-[#0D4734] uppercase tracking-wider">
                  Interactive Room Modules
                </div>
                <div className="text-[11px] text-[#09251B]/60 font-medium">
                  Networking, games & engagement
                </div>
              </div>

              <div className="space-y-1">
                {roomActivations.map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectActivation(item.id)}
                      className={`w-full text-left p-2.5 rounded-xl cursor-pointer transition-all duration-150 flex items-start gap-2.5 ${
                        isSelected 
                          ? 'bg-[#EBF3EF] border border-[#0D4734]/30 text-[#0D4734]' 
                          : 'hover:bg-[#F9F6F0] text-[#09251B]'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isSelected ? 'bg-[#0D4734] text-[#E5A93C]' : 'bg-[#FAF8F4] border border-[#09251B]/15 text-[#09251B]'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-black text-xs text-[#09251B]">
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#09251B]/60 font-medium truncate mt-0.5">
                          {item.tagline}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#0D4734] mt-1 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Desktop Controls: Live Sync Indicator + Live Room Analytics + Check-In Profile Badge */}
      <div className="hidden lg:flex items-center gap-2.5">
        {/* Live SSE Status Pill */}
        <button
          onClick={onReconnect}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-display font-bold transition-all cursor-pointer select-none ${
            syncStatus === 'connected'
              ? 'bg-[#EBF3EF] border-[#0D4734]/30 text-[#0D4734] hover:bg-[#DEF0E7]'
              : syncStatus === 'connecting' || syncStatus === 'reconnecting'
              ? 'bg-amber-50 border-amber-300 text-amber-900 animate-pulse'
              : 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
          }`}
          title={syncStatus === 'connected' ? `Real-time synchronization active (${latencyMs || 18}ms). Click to test sync.` : 'Click to reconnect live room stream'}
        >
          <span className="relative flex h-2 w-2">
            {syncStatus === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              syncStatus === 'connected' ? 'bg-emerald-600' : syncStatus === 'offline' ? 'bg-rose-600' : 'bg-amber-500'
            }`}></span>
          </span>
          <span className="text-[11px] font-black tracking-tight">
            {syncStatus === 'connected' ? (
              <span className="flex items-center gap-1">
                <span>Live Synced</span>
                {latencyMs !== null && latencyMs !== undefined && (
                  <span className="text-[10px] font-mono opacity-60">· {latencyMs}ms</span>
                )}
              </span>
            ) : syncStatus === 'offline' ? (
              'Offline · Retry'
            ) : (
              'Connecting...'
            )}
          </span>
        </button>

        {onSwitchToAudienceView && (
          <button
            onClick={onSwitchToAudienceView}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-700/40 bg-emerald-900/10 hover:bg-emerald-900/20 text-[#0D4734] text-xs font-display font-bold transition cursor-pointer"
            title="Preview Streamlined Audience Participation Mobile Remote"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden xl:inline">Audience Remote</span>
          </button>
        )}

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
