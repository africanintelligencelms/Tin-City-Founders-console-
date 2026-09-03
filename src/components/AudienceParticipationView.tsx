import React, { useState, useEffect, useMemo } from 'react';
import { 
  Vote, Users, Sparkles, Plus, ThumbsUp, CheckCircle2, ChevronRight,
  ExternalLink, Search, Filter, Megaphone, Send, Award, Handshake, 
  MapPin, Shield, Check, Flame, Lightbulb, Heart, ArrowUpRight, Compass,
  Radio, X, RefreshCw, Smartphone, Laptop
} from 'lucide-react';
import { 
  PlateauProblem, AttendeeProfile, TrusteeCandidate, CategoryInfo, 
  MyVotes, RoomSessionState, ToastNotification, NavigationTab 
} from '../types';
import { sounds } from '../utils/soundEffects';

interface AudienceParticipationViewProps {
  problems: PlateauProblem[];
  attendees: AttendeeProfile[];
  trusteeCandidates: TrusteeCandidate[];
  categories: CategoryInfo[];
  currentProfile: AttendeeProfile | null;
  myVotes: MyVotes;
  sessionState: RoomSessionState;
  syncStatus: 'connected' | 'connecting' | 'reconnecting' | 'offline';
  latencyMs?: number | null;
  onVoteProblem: (id: string, commit: boolean, name?: string) => void;
  onVoteCategory: (categoryName: string) => void;
  onVoteTrustee: (candidateId: string) => void;
  onOpenCheckIn: () => void;
  onSaveProfile: (profile: AttendeeProfile) => void;
  onSwitchToFullConsole: () => void;
  onReconnect: () => void;
  onNotify: (toast: Omit<ToastNotification, 'id'>) => void;
  onSubmitProblem: (prob: any) => void;
  onNominateTrustee?: (data: any) => void;
}

export const AudienceParticipationView: React.FC<AudienceParticipationViewProps> = ({
  problems,
  attendees,
  trusteeCandidates,
  categories,
  currentProfile,
  myVotes,
  sessionState,
  syncStatus,
  latencyMs = 18,
  onVoteProblem,
  onVoteCategory,
  onVoteTrustee,
  onOpenCheckIn,
  onSaveProfile,
  onSwitchToFullConsole,
  onReconnect,
  onNotify,
  onSubmitProblem,
  onNominateTrustee
}) => {
  // Navigation for Free Roam mode
  const [audienceSubTab, setAudienceSubTab] = useState<'voting' | 'directory' | 'trustees' | 'squads'>('voting');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('All');
  const [isSubmitPitchOpen, setIsSubmitPitchOpen] = useState(false);
  const [pitchTitle, setPitchTitle] = useState('');
  const [pitchDesc, setPitchDesc] = useState('');
  const [pitchCategory, setPitchCategory] = useState('Agro-Tech & Cold Chain');

  // Floating live emoji bursts
  const [reactionBursts, setReactionBursts] = useState<Array<{ id: string; emoji: string; x: number }>>([]);

  // Send quick reaction to live stage
  const handleSendReaction = async (emoji: string) => {
    sounds.playTapSound();
    
    // Add local visual burst
    const burstId = `b-${Date.now()}-${Math.random()}`;
    const randomX = Math.floor(Math.random() * 60) + 20; // 20% to 80% width
    setReactionBursts(prev => [...prev, { id: burstId, emoji, x: randomX }]);
    setTimeout(() => {
      setReactionBursts(prev => prev.filter(b => b.id !== burstId));
    }, 1800);

    // Send to server SSE broadcast
    try {
      await fetch('/api/session/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, author: currentProfile?.name || 'Audience' })
      });
    } catch {}
  };

  // Filtered problems list
  const filteredProblems = useMemo(() => {
    return problems.filter(p => {
      const matchSearch = !searchQuery || 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSector = selectedSector === 'All' || p.category === selectedSector;
      return matchSearch && matchSector;
    });
  }, [problems, searchQuery, selectedSector]);

  // Current problem being pitched (pinned or top problem)
  const currentPitchProblem = useMemo(() => {
    if (sessionState.pinnedProblemId) {
      const found = problems.find(p => p.id === sessionState.pinnedProblemId);
      if (found) return found;
    }
    return problems[0] || null;
  }, [problems, sessionState.pinnedProblemId]);

  // Committed squads for this attendee
  const myCommittedProblems = useMemo(() => {
    return problems.filter(p => myVotes.squads.includes(p.id) || (currentProfile && p.collaborators.includes(currentProfile.name)));
  }, [problems, myVotes.squads, currentProfile]);

  // Quick Submit Pitch Handler
  const handleQuickSubmitPitch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pitchTitle.trim() || !pitchDesc.trim()) return;

    onSubmitProblem({
      title: pitchTitle.trim(),
      description: pitchDesc.trim(),
      category: pitchCategory,
      author: currentProfile?.name || 'Jos Innovator',
      isCommit: true
    });

    sounds.playSquadJoinedSound();
    setPitchTitle('');
    setPitchDesc('');
    setIsSubmitPitchOpen(false);

    onNotify({
      type: 'problem_submitted',
      title: 'Problem Pitch Submitted!',
      message: 'Your challenge has been added to the room voting queue.',
      duration: 4000
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-stone-900 flex flex-col font-sans pb-24 selection:bg-[#0D4734] selection:text-white relative overflow-x-hidden">
      {/* Floating Reaction Bursts Container */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactionBursts.map(b => (
          <div
            key={b.id}
            className="absolute bottom-20 text-3xl sm:text-4xl animate-in fade-in slide-in-from-bottom-8 duration-700 pointer-events-none drop-shadow-md select-none"
            style={{
              left: `${b.x}%`,
              animation: 'reactionFly 1.8s ease-out forwards'
            }}
          >
            {b.emoji}
          </div>
        ))}
      </div>

      {/* Top Streamlined Mobile Header */}
      <header className="sticky top-0 z-40 bg-[#0D4734] text-white shadow-md border-b border-emerald-800">
        <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* Brand Logo & Live Room Sync Indicator */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-800/80 border border-emerald-400/40 flex items-center justify-center text-amber-300 font-display font-black text-base shadow-xs">
              TC
            </div>
            <div>
              <div className="text-xs font-display font-black tracking-tight leading-tight flex items-center gap-1">
                <span>Tin City Founders</span>
                <span className="text-[10px] font-mono px-1 py-0.2 bg-amber-400/20 text-amber-300 rounded font-bold">
                  AUDIENCE
                </span>
              </div>
              {/* Connection Pill */}
              <button
                onClick={onReconnect}
                className="flex items-center gap-1 text-[10px] font-mono opacity-80 hover:opacity-100 transition cursor-pointer"
                title="Real-time SSE Connection"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : syncStatus === 'offline' ? 'bg-rose-400' : 'bg-amber-400'
                }`} />
                <span>{syncStatus === 'connected' ? `Live Synced (${latencyMs}ms)` : 'Reconnecting...'}</span>
              </button>
            </div>
          </div>

          {/* Right Controls: Profile / Check-in & Switch to Console */}
          <div className="flex items-center gap-2">
            {currentProfile ? (
              <button
                onClick={onOpenCheckIn}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-800/70 hover:bg-emerald-800 border border-emerald-500/30 text-xs font-display font-bold cursor-pointer"
              >
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: currentProfile.avatarColor || '#166E52' }}
                >
                  {currentProfile.name.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[80px] truncate text-amber-100">{currentProfile.name.split(' ')[0]}</span>
              </button>
            ) : (
              <button
                onClick={onOpenCheckIn}
                className="px-3 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#09251B] text-xs font-display font-black shadow-xs cursor-pointer active:scale-95"
              >
                Check In
              </button>
            )}

            {/* Switch to Full Console View */}
            <button
              onClick={onSwitchToFullConsole}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
              title="Switch to Full Desktop Console View"
            >
              <Laptop className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stage Conductor Active Status Strip */}
        <div className="bg-[#09251B] px-4 py-1.5 border-t border-emerald-900/60 flex items-center justify-between text-xs text-white/90">
          <div className="flex items-center gap-1.5 truncate">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
            <span className="text-[11px] font-mono text-emerald-300 uppercase font-bold shrink-0">
              Stage Host:
            </span>
            <span className="font-display font-bold text-amber-200 truncate">
              {sessionState.activePhase === 'welcome' && '1. Welcome & Founder Check-In'}
              {sessionState.activePhase === 'problem_pitch' && '2. Problem Pitch Floor'}
              {sessionState.activePhase === 'voting' && '3. Live Problem & Sector Voting'}
              {sessionState.activePhase === 'trustee_election' && '4. 12 Founding Trustee Matrix (CAMA)'}
              {sessionState.activePhase === 'squad_commit' && '5. Action Squad Lock-In'}
              {sessionState.activePhase === 'free_roam' && '6. Free Roam Mode (Unlocked)'}
            </span>
          </div>

          <div className="text-[10px] font-mono text-white/50 shrink-0 ml-2">
            {problems.length} challenges · {attendees.length} in room
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-xl mx-auto w-full px-4 pt-4 space-y-4">
        {/* Host Live Broadcast Announcement Card (If active) */}
        {sessionState.announcement && (
          <div className="p-3.5 rounded-2xl bg-amber-500 text-stone-950 shadow-lg border-2 border-amber-300 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-2.5">
              <Megaphone className="w-5 h-5 text-stone-950 shrink-0 mt-0.5 animate-bounce" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-black/15 px-2 py-0.5 rounded">
                    Stage Announcement
                  </span>
                  <span className="text-[10px] font-mono opacity-70">Just now</span>
                </div>
                <p className="text-sm font-display font-black leading-snug mt-1 text-stone-950">
                  {sessionState.announcement.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 1: WELCOME & CHECK-IN */}
        {sessionState.activePhase === 'welcome' && (
          <div className="space-y-4">
            {/* Quick Check-In CTA or Checked-in Digital Badge */}
            {!currentProfile ? (
              <div className="bg-white rounded-2xl p-5 border border-emerald-900/15 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-[#0D4734]">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-display font-black">
                    Welcome to Tin City Founders Assembly!
                  </h2>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Join <strong>{attendees.length} founders, builders, and ecosystem leaders</strong> in Jos. Take 15 seconds to check in with your name and Give/Ask to unlock real-time voting and squad matching.
                </p>
                <button
                  onClick={onOpenCheckIn}
                  className="w-full py-3 rounded-xl bg-[#0D4734] hover:bg-[#166E52] text-white text-sm font-display font-black flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 transition"
                >
                  <Users className="w-4 h-4" />
                  <span>Check In My Profile (15s)</span>
                </button>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-[#0D4734] to-[#09251B] text-white rounded-2xl p-4 shadow-md border border-emerald-700/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                    Official Attendee Pass
                  </span>
                  <span className="text-[10px] font-mono text-white/60">Verified in Jos</span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-lg text-white shadow-inner"
                    style={{ backgroundColor: currentProfile.avatarColor || '#166E52' }}
                  >
                    {currentProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-display font-black leading-tight text-white">
                      {currentProfile.name}
                    </h3>
                    <p className="text-xs text-emerald-200 font-medium">
                      {currentProfile.title || 'Plateau Innovator'}
                    </p>
                    {currentProfile.location && (
                      <div className="flex items-center gap-1 text-[11px] text-white/70 mt-0.5">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        <span>{currentProfile.location}</span>
                      </div>
                    )}
                  </div>
                </div>
                {currentProfile.giveAsk && (
                  <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 text-xs text-white/90 mt-2">
                    <span className="font-bold text-amber-300">Give & Ask: </span>
                    <span>{currentProfile.giveAsk}</span>
                  </div>
                )}
              </div>
            )}

            {/* Who is in the room quick feed */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-bold uppercase text-stone-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#0D4734]" />
                  <span>Who's in the Room ({attendees.length})</span>
                </h3>
                <span className="text-[10px] text-stone-500 font-mono">Live check-ins</span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {attendees.map(att => (
                  <div key={att.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 truncate">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: att.avatarColor || '#0D4734' }}
                      >
                        {att.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-display font-black text-stone-900 truncate">
                          {att.name}
                        </div>
                        <div className="text-[11px] text-stone-600 truncate">
                          {att.title}
                        </div>
                      </div>
                    </div>
                    {att.location && (
                      <span className="text-[10px] font-mono text-stone-500 px-2 py-0.5 rounded bg-stone-200 shrink-0">
                        {att.location.split(' ')[0]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PHASE 2: PROBLEM PITCH FLOOR */}
        {sessionState.activePhase === 'problem_pitch' && (
          <div className="space-y-4">
            {/* Spotlight Pitch Card */}
            {currentPitchProblem ? (
              <div className="bg-white rounded-2xl p-5 border-2 border-[#0D4734] shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 font-black">
                    🎙️ CURRENT STAGE PITCH
                  </span>
                  <span className="text-xs font-mono font-bold text-stone-500">
                    {currentPitchProblem.upvotes} Upvotes · {currentPitchProblem.commitments} Squad
                  </span>
                </div>

                <h2 className="text-base font-display font-black text-[#0D4734] leading-snug">
                  {currentPitchProblem.title}
                </h2>

                <p className="text-xs text-stone-700 leading-relaxed">
                  {currentPitchProblem.description}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#0D4734] font-bold text-[11px]">
                    {currentPitchProblem.category}
                  </span>
                  <span className="text-stone-500 text-[11px]">
                    Pitched by: <strong>{currentPitchProblem.submittedBy}</strong>
                  </span>
                </div>

                {/* 1-Tap Fast Pitch Support Buttons */}
                <div className="pt-2 grid grid-cols-2 gap-2 border-t border-stone-100">
                  <button
                    onClick={() => onVoteProblem(currentPitchProblem.id, false)}
                    className={`py-2.5 rounded-xl border text-xs font-display font-black flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                      myVotes.problems.includes(currentPitchProblem.id)
                        ? 'bg-[#0D4734] text-white border-[#0D4734]'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>{myVotes.problems.includes(currentPitchProblem.id) ? 'Upvoted ✓' : 'Upvote Pitch'}</span>
                  </button>

                  <button
                    onClick={() => onVoteProblem(currentPitchProblem.id, true)}
                    className={`py-2.5 rounded-xl text-xs font-display font-black flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                      myVotes.squads.includes(currentPitchProblem.id)
                        ? 'bg-amber-500 text-stone-950 shadow-sm'
                        : 'bg-[#0D4734] hover:bg-[#166E52] text-white shadow-sm'
                    }`}
                  >
                    <Handshake className="w-4 h-4" />
                    <span>{myVotes.squads.includes(currentPitchProblem.id) ? 'In Squad ✓' : 'Join Action Squad'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
                No active pitches yet. Be the first to pitch below!
              </div>
            )}

            {/* Submit Quick 60s Pitch Button */}
            <button
              onClick={() => setIsSubmitPitchOpen(true)}
              className="w-full py-3 rounded-xl bg-white border-2 border-dashed border-[#0D4734]/50 hover:border-[#0D4734] text-[#0D4734] text-xs font-display font-black flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 transition"
            >
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>Submit a 60-Second Plateau Problem Pitch</span>
            </button>
          </div>
        )}

        {/* PHASE 3: LIVE PROBLEM VOTING & SECTOR PRIORITIES */}
        {sessionState.activePhase === 'voting' && (
          <div className="space-y-4">
            {/* Sector Priority Carousel */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-display font-bold uppercase text-stone-700">
                  Tap to Prioritize Plateau Sectors:
                </span>
                <span className="text-[10px] font-mono text-stone-500">1 vote per sector</span>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                {categories.map(cat => {
                  const isVoted = myVotes.categories.includes(cat.name);
                  return (
                    <button
                      key={cat.name}
                      onClick={() => onVoteCategory(cat.name)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-display font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        isVoted
                          ? 'bg-[#0D4734] text-white border-[#0D4734] shadow-xs scale-[1.02]'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isVoted ? 'bg-amber-400 text-stone-950' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {cat.upvotes}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search & Sector Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search challenges..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 bg-white text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0D4734]"
                />
              </div>

              <select
                value={selectedSector}
                onChange={e => setSelectedSector(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-display font-bold text-stone-700 focus:outline-hidden"
              >
                <option value="All">All Sectors</option>
                {categories.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Problem Cards Deck */}
            <div className="space-y-3">
              {filteredProblems.map((prob, idx) => {
                const hasUpvoted = myVotes.problems.includes(prob.id);
                const hasCommitted = myVotes.squads.includes(prob.id);

                return (
                  <div 
                    key={prob.id}
                    className={`bg-white rounded-2xl p-4 border transition-all shadow-xs space-y-2.5 ${
                      hasCommitted
                        ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                        : hasUpvoted
                        ? 'border-emerald-700/60'
                        : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                          #{idx + 1}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-[#0D4734] font-bold">
                          {prob.category}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        prob.status === 'Active Squad' ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {prob.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-display font-black text-[#0D4734] leading-snug">
                      {prob.title}
                    </h3>

                    <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                      {prob.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-stone-500 font-mono">
                      <span>Submitted by {prob.submittedBy.split(' ')[0]}</span>
                      <span>{prob.commitments} founders in squad</span>
                    </div>

                    {/* Action Buttons: 1-Tap Upvote & 1-Tap Squad Commit */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100">
                      <button
                        onClick={() => onVoteProblem(prob.id, false)}
                        className={`py-2 px-3 rounded-xl border text-xs font-display font-black flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                          hasUpvoted
                            ? 'bg-[#0D4734] text-white border-[#0D4734]'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{hasUpvoted ? `Upvoted (${prob.upvotes})` : `Upvote (${prob.upvotes})`}</span>
                      </button>

                      <button
                        onClick={() => onVoteProblem(prob.id, true)}
                        className={`py-2 px-3 rounded-xl text-xs font-display font-black flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                          hasCommitted
                            ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                            : 'bg-[#0D4734] hover:bg-[#166E52] text-white shadow-xs'
                        }`}
                      >
                        <Handshake className="w-3.5 h-3.5" />
                        <span>{hasCommitted ? 'In Squad ✓' : 'Join Squad'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE 4: TRUSTEE SELECTION MATRIX (CAMA 2020) */}
        {sessionState.activePhase === 'trustee_election' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-[#0D4734] to-[#09251B] text-white rounded-2xl p-4 shadow-sm space-y-1">
              <span className="text-[10px] font-mono uppercase bg-amber-400 text-black px-2 py-0.5 rounded font-black">
                CAMA 2020 Statutory Election
              </span>
              <h2 className="text-sm font-display font-black text-amber-200">
                12 Founding Trustees Voting Matrix
              </h2>
              <p className="text-xs text-white/80 leading-relaxed">
                Evaluating candidate reliability, network doors, and trust for the formal legal incorporation of Tin City Founders.
              </p>
            </div>

            {/* Trustee Candidates List */}
            <div className="space-y-3">
              {trusteeCandidates.map(cand => {
                const isEndorsed = myVotes.trustees.includes(cand.id);

                return (
                  <div 
                    key={cand.id}
                    className={`bg-white rounded-2xl p-4 border transition-all shadow-xs space-y-2.5 ${
                      isEndorsed ? 'border-amber-500 ring-2 ring-amber-400/20' : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-emerald-100 text-[#0D4734]">
                          Seat {cand.seatNumber}
                        </span>
                        <span className="text-xs font-display font-black text-stone-900">
                          {cand.name}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        ⭐ {cand.votes} Votes
                      </span>
                    </div>

                    <div className="text-xs text-stone-600 font-medium">
                      {cand.titleOrOrg}
                    </div>

                    {/* R-N-T Test Ratings Badge */}
                    <div className="flex items-center gap-2 text-[10px] font-mono bg-stone-50 p-2 rounded-xl border border-stone-200">
                      <span className="text-emerald-700 font-bold">R-Score: {cand.scoreR}/5</span>
                      <span className="text-blue-700 font-bold">N-Score: {cand.scoreN}/5</span>
                      <span className="text-purple-700 font-bold">T-Score: {cand.scoreT}/5</span>
                    </div>

                    {/* Endorse Button */}
                    <button
                      onClick={() => onVoteTrustee(cand.id)}
                      className={`w-full py-2 rounded-xl text-xs font-display font-black flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
                        isEndorsed
                          ? 'bg-amber-400 text-stone-950 font-black shadow-xs'
                          : 'bg-[#0D4734] hover:bg-[#166E52] text-white shadow-xs'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>{isEndorsed ? 'Endorsed by You ✓' : 'Endorse for Statutory Trustee'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE 5: ACTION SQUAD LOCK-IN & WHATSAPP */}
        {sessionState.activePhase === 'squad_commit' && (
          <div className="space-y-4">
            <div className="bg-[#0D4734] text-white rounded-2xl p-4 shadow-sm space-y-1">
              <span className="text-[10px] font-mono uppercase bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                Sprint Kickoff
              </span>
              <h2 className="text-base font-display font-black text-amber-300">
                Action Squads & WhatsApp Handover
              </h2>
              <p className="text-xs text-white/85 leading-relaxed">
                Connect directly with your committed sprint team and start building prototypes for Plateau State.
              </p>
            </div>

            {/* My Committed Squads */}
            <div className="space-y-3">
              <h3 className="text-xs font-display font-bold uppercase text-stone-700">
                My Committed Action Squads ({myCommittedProblems.length})
              </h3>

              {myCommittedProblems.length > 0 ? (
                myCommittedProblems.map(prob => (
                  <div key={prob.id} className="bg-white rounded-2xl p-4 border border-emerald-600 shadow-xs space-y-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-[#0D4734] font-bold">
                      {prob.category}
                    </span>
                    <h4 className="text-sm font-display font-black text-[#0D4734]">
                      {prob.title}
                    </h4>
                    <div className="text-xs text-stone-600">
                      <strong>Squad Members:</strong> {prob.collaborators.join(', ')}
                    </div>
                    <a
                      href="https://chat.whatsapp.com/TinCityFoundersGroup"
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-display font-black flex items-center justify-center gap-1.5 shadow-sm mt-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Join Jos Sprint WhatsApp Group</span>
                    </a>
                  </div>
                ))
              ) : (
                <div className="p-5 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
                  You haven't joined a squad yet. Switch to problem voting to commit to a local challenge!
                </div>
              )}
            </div>
          </div>
        )}

        {/* PHASE 6: FREE ROAM (UNLOCKED) */}
        {sessionState.activePhase === 'free_roam' && (
          <div className="space-y-4">
            {/* Sub-Navigation Pills */}
            <div className="flex gap-1 p-1 bg-stone-200 rounded-xl">
              {[
                { id: 'voting', label: 'Challenges' },
                { id: 'trustees', label: 'Trustees' },
                { id: 'directory', label: 'Directory' },
                { id: 'squads', label: 'My Squads' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAudienceSubTab(tab.id as any)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-display font-black transition cursor-pointer ${
                    audienceSubTab === tab.id ? 'bg-white text-[#0D4734] shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Render selected free roam sub-tab */}
            {audienceSubTab === 'voting' && (
              <div className="space-y-3">
                {problems.map(prob => (
                  <div key={prob.id} className="bg-white rounded-2xl p-4 border border-stone-200 space-y-2">
                    <h3 className="text-xs font-display font-black text-[#0D4734]">{prob.title}</h3>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-stone-500">{prob.upvotes} upvotes</span>
                      <button
                        onClick={() => onVoteProblem(prob.id, false)}
                        className="px-3 py-1 bg-[#0D4734] text-white rounded-lg font-bold text-xs"
                      >
                        Upvote
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {audienceSubTab === 'trustees' && (
              <div className="space-y-3">
                {trusteeCandidates.map(cand => (
                  <div key={cand.id} className="bg-white rounded-2xl p-4 border border-stone-200 space-y-1">
                    <div className="text-xs font-display font-black text-stone-900">Seat {cand.seatNumber}: {cand.name}</div>
                    <div className="text-[11px] text-stone-600">{cand.titleOrOrg}</div>
                    <button
                      onClick={() => onVoteTrustee(cand.id)}
                      className="mt-2 w-full py-1.5 bg-amber-400 text-stone-950 font-black rounded-lg text-xs"
                    >
                      Endorse ({cand.votes})
                    </button>
                  </div>
                ))}
              </div>
            )}

            {audienceSubTab === 'directory' && (
              <div className="space-y-2">
                {attendees.map(att => (
                  <div key={att.id} className="bg-white rounded-xl p-3 border border-stone-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-stone-900">{att.name}</div>
                      <div className="text-[11px] text-stone-600">{att.title}</div>
                    </div>
                    <span className="text-[10px] font-mono text-stone-500">{att.location}</span>
                  </div>
                ))}
              </div>
            )}

            {audienceSubTab === 'squads' && (
              <div className="space-y-3">
                {myCommittedProblems.map(p => (
                  <div key={p.id} className="bg-white rounded-xl p-3 border border-emerald-600">
                    <div className="text-xs font-bold text-[#0D4734]">{p.title}</div>
                    <div className="text-[11px] text-stone-600 mt-1">{p.collaborators.length} collaborators</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Persistent Bottom Live Reaction Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-xl px-4 py-2.5">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-1 sm:gap-2">
          <span className="text-[11px] font-display font-black text-stone-600 hidden xs:inline shrink-0">
            React:
          </span>

          {/* Quick Reaction Emojis */}
          {[
            { emoji: '🔥', label: 'Fire' },
            { emoji: '💡', label: 'Brilliant' },
            { emoji: '👏', label: 'Applause' },
            { emoji: '🚀', label: 'Build' },
            { emoji: '⭐', label: 'Star' }
          ].map(r => (
            <button
              key={r.emoji}
              onClick={() => handleSendReaction(r.emoji)}
              className="flex-1 py-1.5 px-2 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-amber-100 text-lg sm:text-xl flex items-center justify-center transition cursor-pointer active:scale-125 select-none"
              title={`Send ${r.label} reaction to stage`}
            >
              <span>{r.emoji}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Submit Pitch Modal */}
      {isSubmitPitchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#FAF6EE] rounded-2xl max-w-md w-full p-5 shadow-2xl border border-emerald-900/20 text-stone-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-display font-black text-[#0D4734]">
                Pitch a Plateau Challenge
              </h3>
              <button
                onClick={() => setIsSubmitPitchOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickSubmitPitch} className="space-y-3">
              <div>
                <label className="block text-xs font-display font-bold uppercase text-stone-700 mb-1">
                  Challenge Title
                </label>
                <input
                  type="text"
                  value={pitchTitle}
                  onChange={e => setPitchTitle(e.target.value)}
                  placeholder="e.g. Solar Irrigation for Tomato Farmers in Vom"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0D4734]"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase text-stone-700 mb-1">
                  Sector Category
                </label>
                <select
                  value={pitchCategory}
                  onChange={e => setPitchCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:outline-hidden"
                >
                  {categories.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase text-stone-700 mb-1">
                  Problem Description & Solution Vision
                </label>
                <textarea
                  value={pitchDesc}
                  onChange={e => setPitchDesc(e.target.value)}
                  rows={3}
                  placeholder="What is broken in Jos / Plateau, and what kind of startup solution or squad can fix it?"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0D4734] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsSubmitPitchOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0D4734] hover:bg-[#166E52] text-white text-xs font-display font-black cursor-pointer shadow-sm active:scale-95"
                >
                  Submit Challenge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
