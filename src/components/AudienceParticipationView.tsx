import React, { useState, useEffect, useMemo } from 'react';
import { 
  Vote, Users, Sparkles, Plus, ThumbsUp, CheckCircle2, ChevronRight,
  ExternalLink, Megaphone, Send, Award, Handshake, 
  MapPin, Shield, Check, Flame, Lightbulb, Heart, ArrowUpRight, Compass,
  X, RefreshCw, Smartphone, Eye
} from 'lucide-react';
import { 
  PlateauProblem, AttendeeProfile, TrusteeCandidate, CategoryInfo, 
  MyVotes, RoomSessionState, ToastNotification, NavigationTab, VotingRound, MyRoundBallot
} from '../types';
import { sounds } from '../utils/soundEffects';

interface AudienceParticipationViewProps {
  problems?: PlateauProblem[];
  attendees?: AttendeeProfile[];
  trusteeCandidates?: TrusteeCandidate[];
  categories?: CategoryInfo[];
  currentProfile?: AttendeeProfile | null;
  myVotes?: MyVotes;
  sessionState?: RoomSessionState;
  // True outside a host-driven round. Voting is fully locked in that state;
  // contributing content (pitching a problem, nominating a trustee) is still
  // allowed in the phases that call for it - see the capability gates below.
  readOnly?: boolean;
  // Explicit flag indicating whether voting is currently open
  isVotingOpen?: boolean;
  // Ballot sync for active rounds
  myRoundBallot?: MyRoundBallot;
  onSubmitBallot?: (selections: string[]) => Promise<void> | void;
  // The most recently archived round. Shown as a quiet summary so a phone that
  // was offline through the whole reveal window still learns what happened.
  lastRound?: VotingRound | null;
  syncStatus?: 'connected' | 'connecting' | 'reconnecting' | 'offline';
  latencyMs?: number | null;
  onVoteProblem?: (id: string, commit: boolean, name?: string) => void;
  onVoteCategory?: (categoryName: string) => void;
  onVoteTrustee?: (candidateId: string) => void;
  onOpenCheckIn?: () => void;
  onSaveProfile?: (profile: AttendeeProfile) => void;
  onSwitchToFullConsole?: () => void;
  onReconnect?: () => void;
  onNotify?: (toast: Omit<ToastNotification, 'id'>) => void;
  onSubmitProblem?: (prob: any) => void;
  onNominateTrustee?: (data: any) => void;
}

export const AudienceParticipationView: React.FC<AudienceParticipationViewProps> = ({
  problems = [],
  attendees = [],
  trusteeCandidates = [],
  categories = [],
  currentProfile = null,
  myVotes = { problems: [], squads: [], categories: [], trustees: [] },
  sessionState = {
    activePhase: 'voting',
    phaseTitle: 'Live Plateau Problem Voting',
    announcement: null,
    pinnedProblemId: undefined,
    allowAudienceNavigation: true,
    activeRound: null,
    updatedAt: Date.now()
  } as RoomSessionState,
  readOnly = false,
  isVotingOpen: propsIsVotingOpen,
  myRoundBallot,
  onSubmitBallot,
  lastRound = null,
  syncStatus = 'connected',
  latencyMs = 18,
  onVoteProblem = (_id: string, _commit: boolean, _name?: string) => {},
  onVoteCategory = (_cat: string) => {},
  onVoteTrustee = (_candId: string) => {},
  onOpenCheckIn = () => {},
  onSaveProfile = (_profile: AttendeeProfile) => {},
  onSwitchToFullConsole = () => {},
  onReconnect = () => {},
  onNotify = (_toast: Omit<ToastNotification, 'id'>) => {},
  onSubmitProblem = (_prob: any) => {},
  onNominateTrustee = (_data: any) => {}
}) => {
  // Navigation for Free Roam mode
  const [audienceSubTab, setAudienceSubTab] = useState<'voting' | 'directory' | 'trustees' | 'squads'>('voting');
  const [isSubmitPitchOpen, setIsSubmitPitchOpen] = useState(false);
  const [pitchTitle, setPitchTitle] = useState('');
  const [pitchDesc, setPitchDesc] = useState('');
  const [pitchCategory, setPitchCategory] = useState('Agro-Tech & Cold Chain');

  // Trustee nomination from the floor
  const [isNominateOpen, setIsNominateOpen] = useState(false);
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeTitle, setNomineeTitle] = useState('');
  const [nomineeWhy, setNomineeWhy] = useState('');
  const [nomineeContact, setNomineeContact] = useState('');

  // Expanded problem descriptions toggle
  const [expandedProblemIds, setExpandedProblemIds] = useState<Record<string, boolean>>({});
  const toggleExpandProblem = (id: string) => {
    setExpandedProblemIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  // All problems
  const filteredProblems = problems;

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

  // Lowest founding seat (1-12) with no nominee yet. A nomination posted
  // against an occupied seat REPLACES its holder server-side, so the floor is
  // only ever allowed to fill an empty one; null means all 12 are taken.
  const nextFreeSeat = useMemo(() => {
    const taken = new Set(trusteeCandidates.map(c => c.seatNumber));
    for (let seat = 1; seat <= 12; seat++) {
      if (!taken.has(seat)) return seat;
    }
    return null;
  }, [trusteeCandidates]);

  // Effective attendees list: includes attendees from server plus the current checked-in attendee if not yet synced
  const effectiveAttendees = useMemo(() => {
    if (currentProfile && !attendees.some(a => a.id === currentProfile.id || a.name.toLowerCase() === currentProfile.name.toLowerCase())) {
      return [currentProfile, ...attendees];
    }
    return attendees;
  }, [attendees, currentProfile]);

  // ---- Capability gates -------------------------------------------------
  // Voting is host-driven: an open round, nothing else. Free roam does not
  // unlock ballots — it unlocks the contribution gates further down.
  const isVotingOpen = propsIsVotingOpen !== undefined
    ? propsIsVotingOpen
    : Boolean(
        (sessionState.activeRound && sessionState.activeRound.status === 'open') ||
        !readOnly
      );

  // Upvotes, sector votes and trustee endorsements: governed by isVotingOpen.
  const votingLocked = !isVotingOpen;

  // Background styling: reddish/yellowish/orange when voting is closed, clean neutral when open.
  const pageBgClass = !isVotingOpen ? 'bg-[#FFF0E6]' : 'bg-[#FAF6EE]';
  const stickyBgClass = !isVotingOpen ? 'bg-[#FFF0E6] border-orange-200/80' : 'bg-[#FAF6EE] border-stone-200/70';
  const cardBorderClass = !isVotingOpen ? 'border-orange-200/80' : 'border-stone-200';

  const phase = sessionState.activePhase;

  // ---- Round results ----------------------------------------------------
  // Between "Close & Reveal" and "Back to Room" the round is still the ACTIVE
  // round, with status 'revealed' and its tally attached. That is the reveal
  // moment for the whole room, so it feeds the same card that later shows the
  // archived round — just louder while it is live.
  const revealedRound =
    sessionState.activeRound && sessionState.activeRound.status === 'revealed'
      ? sessionState.activeRound
      : null;
  const resultsRound = revealedRound || lastRound;
  const isLiveReveal = Boolean(revealedRound);
  const myResultPicks =
    resultsRound && myRoundBallot?.roundId === resultsRound.id
      ? (myRoundBallot.selections || [])
      : [];
  const myResultLabels = (resultsRound?.results || [])
    .filter(r => myResultPicks.includes(r.optionId))
    .map(r => r.label);

  // Contribution: open in the phase that calls for it, plus free roam.
  const canSubmitProblem = !readOnly || phase === 'problem_pitch' || phase === 'voting' || phase === 'free_roam';
  const canNominateTrustee = !readOnly || phase === 'trustee_election' || phase === 'free_roam';
  // Squad joining is a commitment, not a ballot: forming squads IS the point of
  // the squad_commit phase, so it cannot be locked behind a voting round.
  const canJoinSquad = !readOnly || phase === 'squad_commit' || phase === 'free_roam';

  // What the "floor is open" banner is allowed to promise, in run-of-show order.
  const openFloorActions = [
    canSubmitProblem && 'submit a Plateau problem',
    canJoinSquad && 'join an action squad',
    canNominateTrustee && 'nominate a founding trustee'
  ].filter(Boolean) as string[];

  const blockedByRound = () => {
    sounds.playTapSound();
    onNotify({
      type: 'info',
      title: 'Voting is currently closed',
      message: 'Upvoting is locked. The host will open live voting from the stage when ready.',
      duration: 3500
    });
  };

  const blockedForPhase = (what: string) => {
    sounds.playTapSound();
    onNotify({
      type: 'info',
      title: `${what} is closed right now`,
      message: 'The host opens this later in the run of show. Everything on screen stays live meanwhile.',
      duration: 3500
    });
  };

  // onVoteProblem already merges the tap into this device's round ballot when a
  // round is open. Posting [id] here as well would overwrite that merge with a
  // single selection, so the tap goes through one path only.
  const guardedVoteProblem = (id: string, commit: boolean, name?: string) => {
    if (votingLocked) return blockedByRound();
    onVoteProblem(id, commit, name);
  };

  // Squad commit/leave has its own gate. Kept separate from guardedVoteProblem
  // on purpose: that one function serves both the plain upvote (round-only) and
  // the commit path, and only the commit path follows canJoinSquad.
  const guardedJoinSquad = (id: string, name?: string) => {
    if (!canJoinSquad) return blockedForPhase('Squad joining');
    onVoteProblem(id, true, name);
  };

  const guardedVoteCategory = (categoryName: string) => {
    if (votingLocked) return blockedByRound();
    onVoteCategory(categoryName);
  };

  const guardedVoteTrustee = (candidateId: string) => {
    if (votingLocked) return blockedByRound();
    onVoteTrustee(candidateId);
  };

  const guardedOpenPitch = () => {
    if (!canSubmitProblem) return blockedForPhase('Problem submission');
    setIsSubmitPitchOpen(true);
  };

  const guardedOpenNominate = () => {
    if (!canNominateTrustee) return blockedForPhase('Trustee nomination');
    if (nextFreeSeat === null) {
      sounds.playTapSound();
      return onNotify({
        type: 'info',
        title: 'All 12 trustee seats are filled',
        message: 'Every founding seat already has a nominee. Speak to the host to swap one out.',
        duration: 4000
      });
    }
    setIsNominateOpen(true);
  };

  // Quick Submit Pitch Handler
  const handleQuickSubmitPitch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitProblem) return blockedForPhase('Problem submission');
    if (!pitchTitle.trim() || !pitchDesc.trim()) return;

    onSubmitProblem({
      title: pitchTitle.trim(),
      description: pitchDesc.trim(),
      category: pitchCategory,
      submittedBy: currentProfile?.name || 'Jos Innovator',
      skillsNeeded: [],
      autoCommit: true
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

  // Trustee Nomination Handler. The floor nominates a person into the lowest
  // free founding seat; scoring, CAMA checks and confirmation stay with the
  // host console, so we deliberately do not fake them from a phone.
  const handleSubmitNomination = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canNominateTrustee) return blockedForPhase('Trustee nomination');
    if (!nomineeName.trim() || nextFreeSeat === null) return;

    onNominateTrustee({
      seatNumber: nextFreeSeat,
      name: nomineeName.trim(),
      titleOrOrg: nomineeTitle.trim() || 'Founding Trustee Nominee',
      bio: nomineeWhy.trim(),
      // Optional, and never rendered back to the room: the server strips
      // phoneOrContact out of every public trustee payload.
      phoneOrContact: nomineeContact.trim(),
      confirmed: false,
      nominatedBy: currentProfile?.name || 'Assembly Attendee',
      notes: 'Nominated from the audience floor.'
    });

    sounds.playSquadJoinedSound();
    setNomineeName('');
    setNomineeTitle('');
    setNomineeWhy('');
    setNomineeContact('');
    setIsNominateOpen(false);

    onNotify({
      type: 'problem_submitted',
      title: 'Trustee Nomination Submitted!',
      message: `${nomineeName.trim()} has been put forward for Seat ${nextFreeSeat}.`,
      duration: 4000
    });
  };

  return (
    <div className={`min-h-screen ${pageBgClass} text-stone-900 flex flex-col font-sans pb-10 selection:bg-[#0D4734] selection:text-white relative overflow-x-clip transition-colors duration-300`}>
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

          {/* Right Controls: Profile / Check-in */}
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
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-xl mx-auto w-full px-4 pt-4 space-y-4">
        {/* Live Voting Status Banner (Prominent indicator for Voting Open vs Voting Closed) */}
        {isVotingOpen ? (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-600/40 flex items-center justify-between shadow-xs transition-all duration-300">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-600"></span>
              </span>
              <div>
                <div className="text-xs font-display font-black text-[#0D4734] uppercase tracking-wide flex items-center gap-1.5">
                  <span>Voting is Open</span>
                  {sessionState.activeRound?.title && (
                    <span className="text-[11px] font-normal text-emerald-800 lowercase truncate max-w-[200px]">
                      — {sessionState.activeRound.title}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-900 font-medium mt-0.5">
                  Upvoting is enabled! Tap <strong>Upvote</strong> on any challenge below to vote for it.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-[#0D4734] text-white shrink-0 shadow-xs">
              LIVE
            </span>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-orange-100/90 border-2 border-orange-300 text-orange-950 flex items-center justify-between shadow-xs transition-all duration-300">
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-600 shrink-0"></span>
              <div>
                <div className="text-xs font-display font-black text-amber-950 uppercase tracking-wide">
                  Voting is Currently Closed
                </div>
                <p className="text-xs text-amber-900 font-medium mt-0.5">
                  Upvoting is locked. The host will open live voting from the stage when ready.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-amber-700 text-white shrink-0 shadow-xs">
              CLOSED
            </span>
          </div>
        )}

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

        {/* Round result — one card, two moods. While the host holds the reveal
            this is the live result and gets the room's attention; once the
            round is archived the same card stays on as the quiet catch-up for
            a phone that was locked through the whole reveal window. */}
        {resultsRound && (
          <div
            className={`p-3 rounded-2xl bg-white shadow-xs ${
              isLiveReveal
                ? 'border-2 border-amber-400 shadow-md animate-in fade-in slide-in-from-top-2 duration-300'
                : 'border border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700">
                <Award className="w-3.5 h-3.5" />
                {isLiveReveal ? 'Results are in' : 'Last round result'}
              </div>
              <span className="text-[10px] font-mono text-stone-400 shrink-0">
                {resultsRound.ballotsCast} ballot{resultsRound.ballotsCast === 1 ? '' : 's'}
              </span>
            </div>

            <div
              className={`font-display font-black text-stone-900 leading-snug ${
                isLiveReveal ? 'text-base' : 'text-sm'
              }`}
            >
              {resultsRound.title}
            </div>

            <div className="mt-2 space-y-1">
              {(resultsRound.results || []).slice(0, isLiveReveal ? 5 : 3).map((r, i) => {
                const mine = myResultPicks.includes(r.optionId);
                return (
                  <div
                    key={r.optionId}
                    className={`flex items-center gap-2 text-xs rounded-lg ${
                      mine ? 'bg-emerald-50 px-1.5 py-1' : ''
                    }`}
                  >
                    <span className="w-4 shrink-0 font-mono text-stone-400">{i + 1}</span>
                    <span className="flex-1 truncate text-stone-700 font-semibold">{r.label}</span>
                    {mine && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    <span className="font-mono font-bold text-stone-900 shrink-0">
                      {r.votes} vote{r.votes === 1 ? '' : 's'}
                      {isLiveReveal && (
                        <span className="text-stone-400"> · {Math.round(r.share * 100)}%</span>
                      )}
                    </span>
                  </div>
                );
              })}
              {!(resultsRound.results || []).length && (
                <div className="text-xs text-stone-500">No ballots were cast in that round.</div>
              )}
            </div>

            {myResultLabels.length > 0 && (
              <div className="mt-2 pt-2 border-t border-stone-200 text-[11px] text-emerald-800 font-semibold flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span className="truncate">
                  Your pick{myResultLabels.length === 1 ? '' : 's'}: {myResultLabels.join(', ')}
                </span>
              </div>
            )}
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
            {/* Quick Pitch Submission Action Header */}
            <div className="bg-gradient-to-br from-[#0D4734] to-[#09251B] text-white rounded-2xl p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase bg-amber-400 text-stone-950 px-2 py-0.5 rounded font-black">
                  Floor Pitches Open
                </span>
                <span className="text-xs font-mono font-bold text-amber-200">
                  {problems.length} {problems.length === 1 ? 'Pitch' : 'Pitches'} Submitted
                </span>
              </div>
              <h2 className="text-base font-display font-black text-white leading-snug">
                60-Second Plateau Problem Pitches
              </h2>
              <p className="text-xs text-white/85 leading-relaxed">
                Step up to the floor! Pitch challenges facing Plateau State or browse and support proposals submitted by other founders.
              </p>
              <button
                onClick={guardedOpenPitch}
                disabled={!canSubmitProblem}
                className="disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-display font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 transition mt-1"
              >
                <Plus className="w-4 h-4 text-stone-950 stroke-[3]" />
                <span>Submit a 60-Second Plateau Problem Pitch</span>
              </button>
            </div>

            {/* Spotlight Pitch Card (when a pitch is actively pinned on the stage mic) */}
            {sessionState.pinnedProblemId && currentPitchProblem && (
              <div className="bg-white rounded-2xl p-5 border-2 border-amber-500 ring-2 ring-amber-400/20 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 font-black flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    🎙️ CURRENT STAGE PITCH
                  </span>
                  <span className="text-xs font-mono font-bold text-stone-500">
                    {currentPitchProblem.upvotes} Upvotes
                  </span>
                </div>

                <h2 className="text-base font-display font-black text-[#0D4734] leading-snug">
                  {currentPitchProblem.title}
                </h2>

                <div className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">
                  {currentPitchProblem.description}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#0D4734] font-bold text-[11px]">
                    {currentPitchProblem.category}
                  </span>
                  <span className="text-stone-500 text-[11px]">
                    Pitched by: <strong>{currentPitchProblem.submittedBy}</strong>
                  </span>
                </div>

                {/* 1-Tap Fast Pitch Support Buttons */}
                <div className="pt-2 border-t border-stone-100">
                  <button
                    onClick={() => guardedVoteProblem(currentPitchProblem.id, false)}
                    disabled={votingLocked}
                    className={`w-full py-2.5 rounded-xl border text-xs font-display font-black flex items-center justify-center gap-1.5 transition active:scale-95 ${
                      myVotes.problems.includes(currentPitchProblem.id)
                        ? 'bg-[#0D4734] text-white border-[#0D4734] cursor-pointer'
                        : votingLocked
                          ? 'bg-stone-100/90 text-stone-400 border-stone-200 cursor-not-allowed'
                          : 'bg-stone-100 hover:bg-emerald-50 text-stone-800 border-stone-300 hover:border-emerald-500 cursor-pointer'
                    }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${myVotes.problems.includes(currentPitchProblem.id) ? 'fill-current text-white' : ''}`} />
                    <span>
                      {myVotes.problems.includes(currentPitchProblem.id)
                        ? `Upvoted ✓ (${currentPitchProblem.upvotes})`
                        : votingLocked
                          ? `Vote Closed (${currentPitchProblem.upvotes})`
                          : `Upvote Pitch (${currentPitchProblem.upvotes})`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Submissions Section Heading and Search / Sector Filters */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-black uppercase text-stone-800 flex items-center gap-1.5">
                  <span>All Floor Pitch Submissions</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-[#0D4734] font-mono text-[10px] font-bold">
                    {filteredProblems.length}
                  </span>
                </h3>
                {problems.length > 0 && (
                  <span className="text-[10px] font-mono text-stone-500">
                    Live room feed
                  </span>
                )}
              </div>

            </div>

            {/* List of ALL Submitted Problems & Pitches */}
            <div className="space-y-3">
              {filteredProblems.length > 0 ? (
                filteredProblems.map((prob, idx) => {
                  const hasUpvoted = myVotes.problems.includes(prob.id);
                  const hasCommitted = myVotes.squads.includes(prob.id);
                  const isPinned = sessionState.pinnedProblemId === prob.id;
                  const isExpanded = !!expandedProblemIds[prob.id];
                  const isLongDesc = prob.description.length > 180 || prob.description.includes('\n');

                  return (
                    <div
                      key={prob.id}
                      className={`bg-white rounded-2xl p-4 border transition-all shadow-xs space-y-2.5 ${
                        isPinned
                          ? 'border-amber-400 ring-2 ring-amber-400/20'
                          : hasCommitted
                          ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                          : hasUpvoted
                          ? 'border-emerald-700/60'
                          : 'border-stone-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                            #{idx + 1}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-[#0D4734] font-bold">
                            {prob.category}
                          </span>
                          {isPinned && (
                            <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-amber-400 text-stone-950">
                              🎙️ On Stage
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-sm font-display font-black text-[#0D4734] leading-snug">
                        {prob.title}
                      </h3>

                      <div className={`text-xs text-stone-700 leading-relaxed whitespace-pre-line ${
                        !isExpanded && isLongDesc ? 'line-clamp-3' : ''
                      }`}>
                        {prob.description}
                      </div>

                      {isLongDesc && (
                        <button
                          onClick={() => toggleExpandProblem(prob.id)}
                          className="text-[11px] font-bold text-[#0D4734] hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>{isExpanded ? 'Show less' : 'Show full pitch details'}</span>
                        </button>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[11px] text-stone-500 font-mono">
                        <span>Pitched by: <strong>{prob.submittedBy}</strong></span>
                      </div>

                      {/* 1-Tap Fast Pitch Support Buttons */}
                      <div className="pt-2 border-t border-stone-100">
                        <button
                          onClick={() => guardedVoteProblem(prob.id, false)}
                          disabled={votingLocked}
                          className={`w-full py-2 px-3 rounded-xl border text-xs font-display font-black flex items-center justify-center gap-1.5 transition active:scale-95 ${
                            hasUpvoted
                              ? 'bg-[#0D4734] text-white border-[#0D4734] cursor-pointer'
                              : votingLocked
                                ? 'bg-stone-100/90 text-stone-400 border-stone-200 cursor-not-allowed'
                                : 'bg-stone-50 hover:bg-emerald-50 text-stone-800 border-stone-200 hover:border-emerald-500 cursor-pointer'
                          }`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${hasUpvoted ? 'fill-current text-white' : ''}`} />
                          <span>
                            {hasUpvoted
                              ? `Upvoted (${prob.upvotes})`
                              : votingLocked
                                ? `Vote Closed (${prob.upvotes})`
                                : `Upvote (${prob.upvotes})`}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#0D4734] flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-display font-black text-stone-800">
                      No Pitches Submitted Yet
                    </h4>
                    <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
                      Step up to the floor and pitch a startup challenge for Plateau State!
                    </p>
                  </div>
                  <button
                    onClick={guardedOpenPitch}
                    disabled={!canSubmitProblem}
                    className="disabled:opacity-40 px-4 py-2 rounded-xl bg-[#0D4734] text-white text-xs font-display font-black cursor-pointer shadow-sm active:scale-95 transition"
                  >
                    Pitch the First Problem
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PHASE 3: LIVE PROBLEM VOTING & SECTOR PRIORITIES */}
        {sessionState.activePhase === 'voting' && (
          <div className="space-y-4">
            {/* Sticky Submit Challenge Container (Options scroll cleanly behind) */}
            <div className={`sticky top-[52px] z-30 -mx-4 px-4 py-2.5 border-b shadow-xs transition-colors duration-200 ${stickyBgClass}`}>
              <button
                onClick={guardedOpenPitch}
                disabled={!canSubmitProblem}
                className="disabled:opacity-40 disabled:cursor-not-allowed w-full py-2.5 rounded-xl bg-white border-2 border-[#0D4734] hover:bg-emerald-50/70 text-[#0D4734] text-xs font-display font-black flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition"
              >
                <Plus className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
                <span>Submit Another Plateau Challenge</span>
              </button>
            </div>

            {/* Problem Cards Deck */}
            <div className="space-y-3">
              {filteredProblems.map((prob, idx) => {
                const hasUpvoted = myVotes.problems.includes(prob.id);
                const hasCommitted = myVotes.squads.includes(prob.id);
                const isExpanded = !!expandedProblemIds[prob.id];
                const isLongDesc = prob.description.length > 180 || prob.description.includes('\n');

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
                    </div>

                    <h3 className="text-sm font-display font-black text-[#0D4734] leading-snug">
                      {prob.title}
                    </h3>

                    <div className={`text-xs text-stone-700 leading-relaxed whitespace-pre-line ${
                      !isExpanded && isLongDesc ? 'line-clamp-3' : ''
                    }`}>
                      {prob.description}
                    </div>

                    {isLongDesc && (
                      <button
                        onClick={() => toggleExpandProblem(prob.id)}
                        className="text-[11px] font-bold text-[#0D4734] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Show less' : 'Show full points / pitch'}</span>
                      </button>
                    )}

                    <div className="flex items-center justify-between pt-1 text-[11px] text-stone-500 font-mono">
                      <span>Submitted by <strong>{prob.submittedBy}</strong></span>
                    </div>

                    {/* Action Buttons: 1-Tap Upvote */}
                    <div className="pt-2 border-t border-stone-100">
                      <button
                        onClick={() => guardedVoteProblem(prob.id, false)}
                        disabled={votingLocked}
                        className={`w-full py-2.5 px-3 rounded-xl border text-xs font-display font-black flex items-center justify-center gap-1.5 transition active:scale-95 ${
                          hasUpvoted
                            ? 'bg-[#0D4734] text-white border-[#0D4734] cursor-pointer'
                            : votingLocked
                              ? 'bg-stone-100/90 text-stone-400 border-stone-200 cursor-not-allowed'
                              : 'bg-stone-50 hover:bg-emerald-50 text-stone-800 border-stone-200 hover:border-emerald-500 cursor-pointer'
                        }`}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${hasUpvoted ? 'fill-current text-white' : ''}`} />
                        <span>
                          {hasUpvoted
                            ? `Upvoted (${prob.upvotes})`
                            : votingLocked
                              ? `Vote Closed (${prob.upvotes})`
                              : `Upvote (${prob.upvotes})`}
                        </span>
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
                      onClick={() => guardedVoteTrustee(cand.id)}
                      disabled={votingLocked}
                      className={`disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit w-full py-2 rounded-xl text-xs font-display font-black flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 ${
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

            {/* Nominate from the floor. Endorsing stays round-only above; putting
                a name forward is open for the whole election phase. */}
            {nextFreeSeat !== null ? (
              <button
                onClick={guardedOpenNominate}
                disabled={!canNominateTrustee}
                className="disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit w-full py-3 rounded-xl bg-white border-2 border-dashed border-amber-600/60 hover:border-amber-600 text-amber-800 text-xs font-display font-black flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 transition"
              >
                <Plus className="w-4 h-4 text-amber-700" />
                <span>Nominate a Founding Trustee (Seat {nextFreeSeat})</span>
              </button>
            ) : (
              <div className="p-4 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
                All 12 founding seats have a nominee. Speak to the host to put another name forward.
              </div>
            )}
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
                {/* Sticky Submit Challenge Container in Free Roam */}
                <div className={`sticky top-[52px] z-30 -mx-4 px-4 py-2.5 border-b shadow-xs transition-colors duration-200 ${stickyBgClass}`}>
                  <button
                    onClick={guardedOpenPitch}
                    disabled={!canSubmitProblem}
                    className="disabled:opacity-40 disabled:cursor-not-allowed w-full py-2.5 rounded-xl bg-white border-2 border-[#0D4734] hover:bg-emerald-50/70 text-[#0D4734] text-xs font-display font-black flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
                    <span>Submit a Plateau Problem Pitch</span>
                  </button>
                </div>

                {problems.map((prob, idx) => {
                  const hasUpvoted = myVotes.problems.includes(prob.id);
                  const hasCommitted = myVotes.squads.includes(prob.id);
                  const isExpanded = !!expandedProblemIds[prob.id];
                  const isLongDesc = prob.description.length > 180 || prob.description.includes('\n');

                  return (
                    <div key={prob.id} className="bg-white rounded-2xl p-4 border border-stone-200 space-y-2.5 shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                            #{idx + 1}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-[#0D4734] font-bold">
                            {prob.category}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-stone-500 font-bold">
                          {prob.upvotes} upvotes
                        </span>
                      </div>

                      <h3 className="text-xs font-display font-black text-[#0D4734] leading-snug">{prob.title}</h3>

                      <div className={`text-xs text-stone-700 leading-relaxed whitespace-pre-line ${
                        !isExpanded && isLongDesc ? 'line-clamp-3' : ''
                      }`}>
                        {prob.description}
                      </div>

                      {isLongDesc && (
                        <button
                          onClick={() => toggleExpandProblem(prob.id)}
                          className="text-[11px] font-bold text-[#0D4734] hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>{isExpanded ? 'Show less' : 'Show full points / pitch'}</span>
                        </button>
                      )}

                      <div className="text-[11px] text-stone-500 font-mono">
                        Pitched by: <strong>{prob.submittedBy}</strong>
                      </div>

                      <div className="pt-1 border-t border-stone-100">
                        <button
                          onClick={() => guardedVoteProblem(prob.id, false)}
                          disabled={votingLocked}
                          className={`w-full py-2 px-3 rounded-xl border text-xs font-display font-black flex items-center justify-center gap-1.5 transition active:scale-95 ${
                            hasUpvoted
                              ? 'bg-[#0D4734] text-white border-[#0D4734] cursor-pointer'
                              : votingLocked
                                ? 'bg-stone-100/90 text-stone-400 border-stone-200 cursor-not-allowed'
                                : 'bg-stone-50 hover:bg-emerald-50 text-stone-800 border-stone-200 hover:border-emerald-500 cursor-pointer'
                          }`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${hasUpvoted ? 'fill-current text-white' : ''}`} />
                          <span>
                            {hasUpvoted
                              ? `Upvoted (${prob.upvotes})`
                              : votingLocked
                                ? `Vote Closed (${prob.upvotes})`
                                : `Upvote (${prob.upvotes})`}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {audienceSubTab === 'trustees' && (
              <div className="space-y-3">
                {trusteeCandidates.map(cand => (
                  <div key={cand.id} className="bg-white rounded-2xl p-4 border border-stone-200 space-y-1">
                    <div className="text-xs font-display font-black text-stone-900">Seat {cand.seatNumber}: {cand.name}</div>
                    <div className="text-[11px] text-stone-600">{cand.titleOrOrg}</div>
                    <button
                      onClick={() => guardedVoteTrustee(cand.id)}
                      disabled={votingLocked}
                      className="disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit mt-2 w-full py-1.5 bg-amber-400 text-stone-950 font-black rounded-lg text-xs"
                    >
                      Endorse ({cand.votes})
                    </button>
                  </div>
                ))}

                {nextFreeSeat !== null ? (
                  <button
                    onClick={guardedOpenNominate}
                    disabled={!canNominateTrustee}
                    className="disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit w-full py-3 rounded-xl bg-white border-2 border-dashed border-amber-600/60 hover:border-amber-600 text-amber-800 text-xs font-display font-black flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4 text-amber-700" />
                    <span>Nominate a Founding Trustee (Seat {nextFreeSeat})</span>
                  </button>
                ) : (
                  <div className="p-4 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
                    All 12 founding seats have a nominee. Speak to the host to put another name forward.
                  </div>
                )}
              </div>
            )}

            {audienceSubTab === 'directory' && (
              <div className="space-y-2">
                {effectiveAttendees.length === 0 ? (
                  <div className="p-4 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
                    No founders have checked in yet. Tap <strong>Check In</strong> at the top to add your profile to the directory!
                  </div>
                ) : (
                  effectiveAttendees.map(att => (
                    <div key={att.id} className="bg-white rounded-xl p-3 border border-stone-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-stone-900">{att.name}</div>
                        <div className="text-[11px] text-stone-600">{att.title}</div>
                      </div>
                      <span className="text-[10px] font-mono text-stone-500">{att.location}</span>
                    </div>
                  ))
                )}
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
                  rows={4}
                  placeholder="Describe the challenge, key bottlenecks, or action points. Numbered or bulleted points are welcome!"
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

      {/* Nominate Trustee Modal */}
      {isNominateOpen && nextFreeSeat !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#FAF6EE] rounded-2xl max-w-md w-full p-5 shadow-2xl border border-emerald-900/20 text-stone-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-display font-black text-[#0D4734]">
                Nominate a Founding Trustee
              </h3>
              <button
                onClick={() => setIsNominateOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-stone-600 mb-3 leading-relaxed">
              Putting a name forward for <strong>Seat {nextFreeSeat}</strong> of the 12 CAMA 2020
              statutory trustees. The host verifies scoring and eligibility in the console.
            </p>

            <form onSubmit={handleSubmitNomination} className="space-y-3">
              <div>
                <label className="block text-xs font-display font-bold uppercase text-stone-700 mb-1">
                  Nominee Full Name
                </label>
                <input
                  type="text"
                  value={nomineeName}
                  onChange={e => setNomineeName(e.target.value)}
                  placeholder="e.g. Amina Bature"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0D4734]"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase text-stone-700 mb-1">
                  Role or Organisation <span className="text-stone-400 font-mono normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={nomineeTitle}
                  onChange={e => setNomineeTitle(e.target.value)}
                  placeholder="e.g. Founder, Jos Agro Cooperative"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0D4734]"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase text-stone-700 mb-1">
                  Why This Person <span className="text-stone-400 font-mono normal-case">(optional)</span>
                </label>
                <textarea
                  value={nomineeWhy}
                  onChange={e => setNomineeWhy(e.target.value)}
                  rows={3}
                  placeholder="What do they reliably deliver, and which doors do they open for Tin City Founders?"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0D4734] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase text-stone-700 mb-1">
                  Contact for the Host <span className="text-stone-400 font-mono normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={nomineeContact}
                  onChange={e => setNomineeContact(e.target.value)}
                  placeholder="Phone or email, only if you have their permission"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0D4734]"
                />
                <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
                  Goes to the host console only — contact details are never shown on the room screen.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsNominateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0D4734] hover:bg-[#166E52] text-white text-xs font-display font-black cursor-pointer shadow-sm active:scale-95"
                >
                  Submit Nomination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
