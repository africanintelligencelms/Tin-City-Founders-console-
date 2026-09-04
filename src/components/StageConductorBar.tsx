import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio, Megaphone, Send, Lock, Unlock, QrCode, Copy, Check, Users,
  Sparkles, Vote, Award, Handshake, Compass, ChevronDown, ChevronUp,
  X, AlertCircle, PlayCircle, ExternalLink, Square, Trophy, Loader2, Download
} from 'lucide-react';
import {
  RoomPhase, RoomSessionState, ToastNotification, RoundKind,
  PlateauProblem, CategoryInfo, TrusteeCandidate, VotingRound, RoundOption
} from '../types';
import { sounds } from '../utils/soundEffects';

interface StageConductorBarProps {
  sessionState: RoomSessionState;
  onUpdateSessionState: (partial: Partial<RoomSessionState>) => Promise<void>;
  onBroadcastAnnouncement: (message: string) => Promise<void>;
  connectedClientsCount?: number;
  onNotify?: (toast: Omit<ToastNotification, 'id'>) => void;
  onOpenQRModal?: () => void;
  isCompact?: boolean;
  // Round lifecycle — the host picks the ballot type each round.
  onOpenRound?: (opts: { kind: RoundKind; title: string; maxSelections: number; optionIds?: string[] }) => Promise<void>;
  onCloseRound?: () => Promise<void>;
  onClearRound?: () => Promise<void>;
  // Pulls the whole room down as a JSON file the host can restore from.
  onDownloadBackup?: () => Promise<void>;
  // The three candidate pools, so the host can put a shortlist on the ballot
  // instead of everything. Mirrors buildRoundOptions() on the server.
  problems?: PlateauProblem[];
  categories?: CategoryInfo[];
  trusteeCandidates?: TrusteeCandidate[];
  // Most recently archived round — powers the "Top 3 from last round" shortcut.
  lastRound?: VotingRound | null;
}

const PHASES: Array<{
  id: RoomPhase;
  num: number;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}> = [
  {
    id: 'welcome',
    num: 1,
    label: 'Welcome & Check-In',
    shortLabel: 'Check-In',
    description: 'Directs audience to 10-second attendee check-in & room directory.',
    icon: Users,
    accentColor: 'from-emerald-700 to-teal-800'
  },
  {
    id: 'problem_pitch',
    num: 2,
    label: 'Pitch Floor & Reactions',
    shortLabel: 'Pitches',
    description: 'Spotlights live problem pitches with real-time audience reaction bursts.',
    icon: PlayCircle,
    accentColor: 'from-amber-700 to-orange-800'
  },
  {
    id: 'voting',
    num: 3,
    label: 'Live Problem Voting',
    shortLabel: 'Problem Voting',
    description: 'Opens 1-tap deduplicated upvoting and sector priority selection.',
    icon: Vote,
    accentColor: 'from-emerald-800 to-green-900'
  },
  {
    id: 'trustee_election',
    num: 4,
    label: 'Trustee Matrix (CAMA)',
    shortLabel: 'Trustees',
    description: 'Directs phones to the 12 statutory trustee seats and R-N-T ratings.',
    icon: Award,
    accentColor: 'from-blue-800 to-indigo-950'
  },
  {
    id: 'squad_commit',
    num: 5,
    label: 'Squad Lock-In & WhatsApp',
    shortLabel: 'Squads',
    description: 'Prompts attendees to lock into action squads and join group chats.',
    icon: Handshake,
    accentColor: 'from-purple-800 to-slate-900'
  },
  {
    id: 'free_roam',
    num: 6,
    label: 'Free Roam (Unlocked)',
    shortLabel: 'Free Roam',
    description: 'Unlocks all tabs so attendees can explore directory, bingo, and tools.',
    icon: Compass,
    accentColor: 'from-slate-700 to-slate-900'
  }
];

export const StageConductorBar: React.FC<StageConductorBarProps> = ({
  sessionState,
  onUpdateSessionState,
  onBroadcastAnnouncement,
  connectedClientsCount = 1,
  onNotify,
  onOpenQRModal,
  isCompact = false,
  onOpenRound,
  onCloseRound,
  onClearRound,
  onDownloadBackup,
  problems = [],
  categories = [],
  trusteeCandidates = [],
  lastRound = null
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(!isCompact);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState<boolean>(false);
  const [broadcastText, setBroadcastText] = useState<string>('');
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState<boolean>(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const [roundKind, setRoundKind] = useState<RoundKind>('problem');
  const [roundTitle, setRoundTitle] = useState<string>('');
  const [roundPicks, setRoundPicks] = useState<number>(1);
  // Stored as EXCLUSIONS, not selections: an empty set means "everything is on
  // the ballot", so the default matches the old behaviour and anything that
  // arrives mid-setup (a late problem, a fresh nomination) is included too.
  const [excludedOptionIds, setExcludedOptionIds] = useState<string[]>([]);
  const [isRoundBusy, setIsRoundBusy] = useState<boolean>(false);
  const [isBackupBusy, setIsBackupBusy] = useState<boolean>(false);

  const activePhaseInfo = PHASES.find(p => p.id === sessionState.activePhase) || PHASES[2];
  const activeRound = sessionState.activeRound || null;

  // Each phase suggests the ballot type it usually needs; the host can still override.
  const PHASE_DEFAULT_KIND: Partial<Record<RoomPhase, RoundKind>> = {
    voting: 'problem',
    problem_pitch: 'problem',
    trustee_election: 'trustee',
    squad_commit: 'problem'
  };

  const ROUND_KINDS: Array<{ id: RoundKind; label: string; hint: string }> = [
    { id: 'problem', label: 'Problems', hint: 'Every problem on the board' },
    { id: 'category', label: 'Sectors', hint: 'Every sector category' },
    { id: 'trustee', label: 'Trustees', hint: 'Every nominated trustee' }
  ];

  const runRoundAction = async (fn?: () => Promise<void>) => {
    if (!fn) return;
    setIsRoundBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error('Round action failed:', err);
      if (onNotify) {
        onNotify({
          type: 'info',
          title: 'Round action failed',
          message: err instanceof Error ? err.message : 'The server rejected that round action.',
          duration: 5000
        });
      }
    } finally {
      setIsRoundBusy(false);
    }
  };

  // Moving phases re-arms the ballot type that phase normally votes on.
  useEffect(() => {
    if (activeRound) return;
    const suggested = PHASE_DEFAULT_KIND[sessionState.activePhase];
    if (suggested) setRoundKind(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState.activePhase, activeRound?.id]);

  // The pool the server would build for this kind (see buildRoundOptions in server.ts).
  const availableOptions: RoundOption[] = useMemo(() => {
    if (roundKind === 'problem') {
      return problems.map(p => ({ id: p.id, label: p.title, sublabel: p.category }));
    }
    if (roundKind === 'category') {
      return categories.map(c => ({ id: c.name, label: c.name, sublabel: c.description }));
    }
    return trusteeCandidates.map(c => ({ id: c.id, label: c.name, sublabel: c.titleOrOrg }));
  }, [roundKind, problems, categories, trusteeCandidates]);

  const excludedSet = useMemo(() => new Set(excludedOptionIds), [excludedOptionIds]);
  const selectedOptionIds = useMemo(
    () => availableOptions.map(o => o.id).filter(id => !excludedSet.has(id)),
    [availableOptions, excludedSet]
  );

  // Switching the ballot type starts a fresh, everything-selected shortlist.
  useEffect(() => {
    setExcludedOptionIds([]);
  }, [roundKind]);

  const toggleOption = (id: string) => {
    setExcludedOptionIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };
  const selectAllOptions = () => { sounds.playTapSound(); setExcludedOptionIds([]); };
  const selectNoOptions = () => { sounds.playTapSound(); setExcludedOptionIds(availableOptions.map(o => o.id)); };

  // Results come back sorted highest-first, so the top 3 are just the first 3
  // that still exist in the current pool.
  const topThreeIds = useMemo(() => {
    if (!lastRound || lastRound.kind !== roundKind || !Array.isArray(lastRound.results)) return [];
    const live = new Set(availableOptions.map(o => o.id));
    return lastRound.results.map(r => r.optionId).filter(id => live.has(id)).slice(0, 3);
  }, [lastRound, roundKind, availableOptions]);

  const canUseTopThree = topThreeIds.length >= 2;

  const selectTopThree = () => {
    if (!canUseTopThree) return;
    sounds.playTapSound();
    const keep = new Set(topThreeIds);
    setExcludedOptionIds(availableOptions.map(o => o.id).filter(id => !keep.has(id)));
  };

  const handleOpenRound = async () => {
    if (selectedOptionIds.length < 2) return;
    sounds.playTapSound();
    const kindLabel = ROUND_KINDS.find(k => k.id === roundKind)?.label || roundKind;
    const isEverything = selectedOptionIds.length === availableOptions.length;
    await runRoundAction(() =>
      onOpenRound!({
        kind: roundKind,
        title: roundTitle.trim() || `Live ${kindLabel} vote`,
        maxSelections: Math.max(1, roundPicks),
        // Omitting the field is how the server reads "the whole pool".
        ...(isEverything ? {} : { optionIds: selectedOptionIds })
      })
    );
    setRoundTitle('');
    setExcludedOptionIds([]);
  };

  // Audience Link (points directly to audience remote mode)
  const getAudienceUrl = () => {
    try {
      const origin = window.location.origin;
      return `${origin}?mode=audience`;
    } catch {
      return '/?mode=audience';
    }
  };

  const handleSelectPhase = async (phase: RoomPhase) => {
    if (phase === sessionState.activePhase) return;
    sounds.playTapSound();
    try {
      await onUpdateSessionState({ activePhase: phase });
      const phaseObj = PHASES.find(p => p.id === phase);
      if (onNotify && phaseObj) {
        onNotify({
          type: 'success',
          title: `Room Switched to ${phaseObj.label}`,
          message: `All connected phones are now on the ${phaseObj.label} view.`,
          duration: 3500
        });
      }
    } catch (err) {
      console.error('Failed to change phase:', err);
    }
  };

  const handleToggleLockNav = async () => {
    sounds.playTapSound();
    const nextState = !sessionState.allowAudienceNavigation;
    try {
      await onUpdateSessionState({ allowAudienceNavigation: nextState });
      if (onNotify) {
        onNotify({
          type: 'info',
          title: nextState ? 'Audience Navigation Unlocked' : 'Audience Locked to Stage',
          message: nextState 
            ? 'Attendees can freely switch tabs on their devices.' 
            : 'Audience phones are strictly synced to the host conductor phase.',
          duration: 3500
        });
      }
    } catch (err) {
      console.error('Failed to toggle lock:', err);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    setIsSubmittingBroadcast(true);
    try {
      await onBroadcastAnnouncement(broadcastText.trim());
      sounds.playSquadJoinedSound();
      setBroadcastText('');
      setIsBroadcastOpen(false);
      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'Alert Broadcast to All Screens',
          message: 'Your message was sent to all connected audience phones.',
          duration: 4000
        });
      }
    } catch (err) {
      console.error('Failed to broadcast:', err);
    } finally {
      setIsSubmittingBroadcast(false);
    }
  };

  const handleDownloadBackup = async () => {
    if (!onDownloadBackup) return;
    sounds.playTapSound();
    setIsBackupBusy(true);
    try {
      await onDownloadBackup();
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleCopyAudienceLink = () => {
    try {
      navigator.clipboard.writeText(getAudienceUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const audienceUrl = getAudienceUrl();
  const qrImage = `https://quickchart.io/qr?text=${encodeURIComponent(audienceUrl)}&size=300&margin=2&dark=0D4734&light=FFFFFF`;

  return (
    <>
      {/* Conductor Bar Container */}
      <div className="bg-[#09251B] border-y lg:border lg:rounded-2xl border-emerald-800/40 text-white shadow-xl overflow-hidden transition-all duration-300">
        {/* Top Control Bar Header */}
        <div className="px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3 bg-black/25">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-mono font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span>STAGE CONDUCTOR</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/80">
              <span className="text-white/40">Active Phase:</span>
              <span className="font-bold text-amber-300 font-display">
                {activePhaseInfo.num}. {activePhaseInfo.label}
              </span>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2">
            {/* Connected Audience Counter */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-xs text-white/90 font-mono" title="Active live devices synced">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>{connectedClientsCount} online</span>
            </div>

            {/* Instant Broadcast Alert Button */}
            <button
              onClick={() => setIsBroadcastOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-bold font-display transition cursor-pointer active:scale-95"
              title="Broadcast instant alert to all audience phones"
            >
              <Megaphone className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden xs:inline">Broadcast Alert</span>
            </button>

            {/* Room Backup — the failsafe if the host platform restarts and
                loses the in-memory room. Saves a file that can be dropped in
                as .data/room_state.json on a laptop. */}
            {onDownloadBackup && (
              <button
                onClick={handleDownloadBackup}
                disabled={isBackupBusy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/85 hover:text-white text-xs font-bold font-display transition cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download the whole room as a file. Restore it by saving it as .data/room_state.json on the backup machine."
              >
                {isBackupBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white/70" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-emerald-200" />
                )}
                <span className="hidden md:inline">Download room backup</span>
                <span className="md:hidden sr-only">Download room backup</span>
              </button>
            )}

            {/* Audience QR Code Button */}
            <button
              onClick={() => (onOpenQRModal ? onOpenQRModal() : setIsQRModalOpen(true))}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-700/60 hover:bg-emerald-600 border border-emerald-400/30 text-white text-xs font-bold font-display transition cursor-pointer active:scale-95"
              title="Show audience join QR code"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden sm:inline">Audience Join QR</span>
            </button>

            {/* Lock Nav Toggle */}
            <button
              onClick={handleToggleLockNav}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-display transition cursor-pointer ${
                sessionState.allowAudienceNavigation
                  ? 'bg-white/10 border-white/20 text-white/70 hover:bg-white/15'
                  : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-xs'
              }`}
              title={sessionState.allowAudienceNavigation ? 'Audience can freely roam. Click to lock them to stage.' : 'Audience locked to active phase. Click to unlock.'}
            >
              {sessionState.allowAudienceNavigation ? (
                <>
                  <Unlock className="w-3 h-3 text-white/60" />
                  <span className="hidden md:inline">Nav Unlocked</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span className="hidden md:inline">Locked to Stage</span>
                </>
              )}
            </button>

            {/* Expand / Collapse Button */}
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
              title={isExpanded ? 'Collapse stage controls' : 'Expand stage controls'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expandable Phase Selector Matrix */}
        {isExpanded && (
          <div className="p-3 sm:p-4 bg-[#0D382A]/90 border-t border-emerald-800/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono tracking-wider uppercase text-emerald-300 font-bold">
                Direct Room Session Phase (Instantly updates all attendee phones):
              </span>
              <span className="text-[11px] text-white/60 font-medium">
                1-tap room sync via SSE
              </span>
            </div>

            {/* 6 Stage Phase Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {PHASES.map(phase => {
                const Icon = phase.icon;
                const isActive = sessionState.activePhase === phase.id;

                return (
                  <button
                    key={phase.id}
                    onClick={() => handleSelectPhase(phase.id)}
                    className={`relative p-2.5 sm:p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 border-amber-300 text-white shadow-lg ring-2 ring-amber-300/60 scale-[1.02]'
                        : 'bg-[#09251B]/80 hover:bg-[#09251B] border-emerald-800/50 text-white/80 hover:text-white hover:border-emerald-600'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider shadow-xs">
                        LIVE
                      </span>
                    )}

                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-emerald-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-mono font-bold opacity-60">
                        0{phase.num}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-display font-black leading-tight mb-0.5">
                        {phase.shortLabel}
                      </div>
                      <div className="text-[10px] text-white/60 line-clamp-1 leading-tight">
                        {phase.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ---------------- Voting Round Lifecycle ---------------- */}
            {(onOpenRound || onCloseRound) && (
              <div className="mt-4 pt-4 border-t border-emerald-800/40">
                {!activeRound && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono tracking-wider uppercase text-amber-300 font-bold">
                        Open a Voting Round (takes over every phone):
                      </span>
                      <span className="text-[11px] text-white/60 font-medium">
                        Phase stays where it is
                      </span>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex gap-1.5">
                        {ROUND_KINDS.map(k => (
                          <button
                            key={k.id}
                            onClick={() => { setRoundKind(k.id); sounds.playTapSound(); }}
                            title={k.hint}
                            className={`px-3 py-2 rounded-xl border text-xs font-display font-bold transition cursor-pointer ${
                              roundKind === k.id
                                ? 'bg-amber-400 border-amber-300 text-black'
                                : 'bg-[#09251B]/80 border-emerald-800/50 text-white/75 hover:text-white hover:border-emerald-600'
                            }`}
                          >
                            {k.label}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={roundTitle}
                        onChange={e => setRoundTitle(e.target.value)}
                        placeholder={`Round title (optional) — e.g. "Which problem do we fund first?"`}
                        maxLength={120}
                        className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-[#09251B]/80 border border-emerald-800/50 text-white text-xs placeholder:text-white/30 focus:outline-hidden focus:border-emerald-500"
                      />

                      <label className="flex items-center gap-1.5 text-[11px] text-white/60">
                        Picks
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={roundPicks}
                          onChange={e => setRoundPicks(Math.max(1, Number(e.target.value) || 1))}
                          className="w-14 px-2 py-2 rounded-xl bg-[#09251B]/80 border border-emerald-800/50 text-white text-xs text-center focus:outline-hidden focus:border-emerald-500"
                        />
                      </label>

                      <button
                        onClick={handleOpenRound}
                        disabled={isRoundBusy || !onOpenRound || selectedOptionIds.length < 2}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/40 text-[#071912] text-xs font-display font-black transition cursor-pointer disabled:cursor-not-allowed active:scale-95"
                      >
                        {isRoundBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Vote className="w-4 h-4" />}
                        Open Round
                      </button>
                    </div>

                    {/* ---- What goes on the ballot (all ticked by default) ---- */}
                    <div className="mt-2 rounded-xl bg-[#09251B]/60 border border-emerald-800/40 p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono tracking-wider uppercase text-emerald-300 font-bold">
                          On the ballot: {selectedOptionIds.length} of {availableOptions.length}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={selectAllOptions}
                            className="px-2.5 py-1 rounded-lg border border-emerald-800/50 bg-[#09251B]/80 text-white/75 hover:text-white hover:border-emerald-600 text-[11px] font-display font-bold transition cursor-pointer"
                          >
                            All
                          </button>
                          <button
                            onClick={selectNoOptions}
                            className="px-2.5 py-1 rounded-lg border border-emerald-800/50 bg-[#09251B]/80 text-white/75 hover:text-white hover:border-emerald-600 text-[11px] font-display font-bold transition cursor-pointer"
                          >
                            None
                          </button>
                          <button
                            onClick={selectTopThree}
                            disabled={!canUseTopThree}
                            title={
                              canUseTopThree
                                ? `Shortlist the top scorers from "${lastRound?.title}"`
                                : 'No closed round of this type to shortlist from yet'
                            }
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-400/50 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25 disabled:opacity-35 disabled:cursor-not-allowed text-[11px] font-display font-bold transition cursor-pointer"
                          >
                            <Trophy className="w-3 h-3" />
                            Top 3 from last round
                          </button>
                        </div>
                      </div>

                      {availableOptions.length === 0 ? (
                        <div className="text-[11px] text-white/50 py-1">
                          Nothing to put on this ballot yet.
                        </div>
                      ) : (
                        <div className="max-h-40 overflow-y-auto pr-1 space-y-0.5">
                          {availableOptions.map(o => {
                            const checked = !excludedSet.has(o.id);
                            return (
                              <label
                                key={o.id}
                                className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleOption(o.id)}
                                  className="mt-0.5 w-3.5 h-3.5 shrink-0 accent-emerald-400 cursor-pointer"
                                />
                                <span className="min-w-0">
                                  <span className={`block text-[11px] font-bold leading-tight truncate ${checked ? 'text-white' : 'text-white/40'}`}>
                                    {o.label}
                                  </span>
                                  {o.sublabel && (
                                    <span className="block text-[10px] text-white/40 leading-tight truncate">
                                      {o.sublabel}
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {selectedOptionIds.length < 2 && (
                        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-300 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          Tick at least 2 options — a round needs two things to choose between.
                        </div>
                      )}
                    </div>
                  </>
                )}

                {activeRound && activeRound.status === 'open' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-300 mb-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                        </span>
                        Round Open · {activeRound.kind}
                      </div>
                      <div className="font-display font-black text-sm truncate">{activeRound.title}</div>
                      <div className="text-white/50 text-[11px]">
                        {activeRound.ballotsCast} ballot{activeRound.ballotsCast === 1 ? '' : 's'} in ·{' '}
                        {activeRound.options.length} options · max {activeRound.maxSelections} pick
                        {activeRound.maxSelections === 1 ? '' : 's'}
                      </div>
                    </div>
                    <button
                      onClick={() => { sounds.playTapSound(); runRoundAction(onCloseRound); }}
                      disabled={isRoundBusy}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black text-xs font-display font-black transition cursor-pointer active:scale-95"
                    >
                      {isRoundBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                      Close & Reveal
                    </button>
                  </div>
                )}

                {activeRound && activeRound.status === 'revealed' && (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300 mb-0.5">
                          <Trophy className="w-3.5 h-3.5" />
                          Results Showing
                        </div>
                        <div className="font-display font-black text-sm truncate">{activeRound.title}</div>
                        <div className="text-white/50 text-[11px]">
                          {activeRound.ballotsCast} ballot{activeRound.ballotsCast === 1 ? '' : 's'} counted
                        </div>
                      </div>
                      <button
                        onClick={() => { sounds.playTapSound(); runRoundAction(onClearRound); }}
                        disabled={isRoundBusy}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-display font-black transition cursor-pointer active:scale-95"
                      >
                        {isRoundBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4" />}
                        Back to Room
                      </button>
                    </div>

                    <div className="space-y-1">
                      {(activeRound.results || []).slice(0, 3).map((r, i) => (
                        <div key={r.optionId} className="flex items-center gap-2 text-xs">
                          <span className="text-white/35 font-mono w-4">{i + 1}</span>
                          <span className="flex-1 truncate font-semibold">{r.label}</span>
                          <span className="font-mono font-bold text-amber-300">{r.votes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Broadcast Announcement Modal */}
      {isBroadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#FAF6EE] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-emerald-900/20 text-stone-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-black text-[#0D4734]">
                    Broadcast Alert to All Phones
                  </h3>
                  <p className="text-xs text-stone-600">
                    Instantly displays a prominent banner on all connected audience screens.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBroadcastOpen(false)}
                className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-display font-bold uppercase text-stone-700 mb-1.5">
                  Announcement Message
                </label>
                <textarea
                  value={broadcastText}
                  onChange={e => setBroadcastText(e.target.value)}
                  placeholder="e.g. 🚨 Voting for Problem 1 closes in 2 minutes! Cast your upvote now."
                  rows={3}
                  maxLength={180}
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0D4734] resize-none"
                />
                <div className="flex justify-between items-center mt-1 text-[11px] text-stone-500 font-mono">
                  <span>Quick presets below or type custom</span>
                  <span>{180 - broadcastText.length} left</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "⏱️ 2 minutes remaining to cast your vote!",
                  "🤝 Action Squads are now forming. Commit to a challenge!",
                  "🎤 Next Founder Pitch starting on stage in 30 seconds.",
                  "⚖️ Trustee nomination matrix is now open for endorsements.",
                  "💡 Check in with your Give & Ask to appear on the live board."
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setBroadcastText(preset)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-200/80 hover:bg-stone-300 text-stone-800 transition cursor-pointer text-left"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsBroadcastOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!broadcastText.trim() || isSubmittingBroadcast}
                  className="px-5 py-2 rounded-xl bg-[#0D4734] hover:bg-[#166E52] text-white text-xs font-display font-black flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingBroadcast ? 'Broadcasting...' : 'Broadcast to All Phones'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audience QR Code Modal */}
      {isQRModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#FAF6EE] rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-emerald-900/20 text-stone-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-[#0D4734] text-white font-bold">
                Audience Remote Link
              </span>
              <button
                onClick={() => setIsQRModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-xl font-display font-black text-[#0D4734] mb-1">
              Join Audience Live View
            </h3>
            <p className="text-xs text-stone-600 mb-4">
              Scan with your phone camera to participate in live voting, reactions, and squads.
            </p>

            <div className="bg-white p-4 rounded-2xl border-2 border-stone-300 inline-block shadow-inner mb-4">
              <img
                src={qrImage}
                alt="Audience Join QR"
                className="w-56 h-56 mx-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="bg-stone-200/70 p-2 rounded-xl flex items-center justify-between text-xs font-mono text-stone-700 mb-4 overflow-hidden">
              <span className="truncate mr-2">{audienceUrl}</span>
              <button
                onClick={handleCopyAudienceLink}
                className="p-1.5 rounded-lg bg-white shadow-xs hover:bg-stone-100 text-[#0D4734] cursor-pointer"
                title="Copy URL"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex gap-2">
              <a
                href={audienceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-xs font-bold text-stone-800 flex items-center justify-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test in Tab</span>
              </a>
              <button
                onClick={() => setIsQRModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-[#0D4734] hover:bg-[#166E52] text-xs font-display font-black text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
