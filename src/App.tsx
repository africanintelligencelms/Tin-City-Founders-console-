import React, { useState, useEffect } from 'react';
import { NavigationTab, PlateauProblem, AttendeeProfile, ToastNotification, RoomSessionState } from './types';
import type { TrusteeCandidate, CategoryInfo, MyVotes, MyRoundBallot, RoundKind, VotingRound } from './types';
import { Header } from './components/Header';
import { ProblemVoting } from './components/ProblemVoting';
import { AttendeeDirectory } from './components/AttendeeDirectory';
import { JoinQR } from './components/JoinQR';
import { SpeedFounding } from './components/SpeedFounding';
import { IcebreakerPrompts } from './components/IcebreakerPrompts';
import { FounderBingo } from './components/FounderBingo';
import { Scoreboard } from './components/Scoreboard';
import { FounderCheckInModal } from './components/FounderCheckInModal';
import { ToastContainer } from './components/ToastContainer';
import { VotingParticleProvider } from './components/VotingParticleManager';
import { RoomLiveAnalyticsModal } from './components/RoomLiveAnalyticsModal';
import { AudienceParticipationView } from './components/AudienceParticipationView';
import { StageConductorBar } from './components/StageConductorBar';
import { RoundTakeover } from './components/RoundTakeover';
import { captureHostKeyFromUrl, hostFetch, verifyHostKey } from './utils/hostKey';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('voting');
  const [problems, setProblems] = useState<PlateauProblem[]>([]);
  const [attendees, setAttendees] = useState<AttendeeProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<AttendeeProfile | null>(null);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState<boolean>(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState<boolean>(false);
  const [isFirstVisit, setIsFirstVisit] = useState<boolean>(false);
  const [userVotedIds, setUserVotedIds] = useState<string[]>([]);
  const [userCommittedIds, setUserCommittedIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Live room state that only the server owns
  const [trusteeCandidates, setTrusteeCandidates] = useState<TrusteeCandidate[]>([]);
  const [liveCategories, setLiveCategories] = useState<CategoryInfo[]>([]);
  const [myVotes, setMyVotes] = useState<MyVotes>({ problems: [], squads: [], categories: [], trustees: [] });

  // Live SSE connection & latency state
  const [syncStatus, setSyncStatus] = useState<'connected' | 'connecting' | 'reconnecting' | 'offline'>('connecting');
  const [latencyMs, setLatencyMs] = useState<number | null>(18);
  const [reconnectCounter, setReconnectCounter] = useState(0);

  // Audience Streamlined Mode & Stage Session Conductor State
  const [isAudienceMode, setIsAudienceMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'audience' || params.has('join') || window.location.pathname === '/join';
  });

  // Pull ?host=<key> out of the URL on the very first render (before anything is
  // painted on a projector) and stash it. Audience phones never carry one.
  useState<string>(() => captureHostKeyFromUrl());

  // Server's verdict on this device's host key. Optimistic until /api/host/verify
  // answers, then authoritative: a false locks the app into audience mode no
  // matter what the URL says, so dropping ?mode=audience no longer reveals the
  // console. The server enforces the same key on every host route regardless.
  const [isHostVerified, setIsHostVerified] = useState<boolean>(true);
  const audienceOnly = isAudienceMode || !isHostVerified;

  const [roomSessionState, setRoomSessionState] = useState<RoomSessionState>({
    activePhase: 'voting',
    phaseTitle: 'Live Plateau Problem Voting & Squad Formation',
    announcement: null,
    allowAudienceNavigation: true,
    activeRound: null,
    updatedAt: Date.now()
  });

  // What this device has submitted in the active round (server is source of truth).
  const [myRoundBallot, setMyRoundBallot] = useState<MyRoundBallot>({
    roundId: null,
    selections: [],
    hasVoted: false
  });

  // The most recently archived round. A phone that was locked or offline through
  // the whole reveal window reconnects to the idle screen; without this it would
  // have no clue a round ever ran.
  const [lastRound, setLastRound] = useState<VotingRound | null>(null);

  const handleToggleAudienceMode = (enableAudience: boolean) => {
    // Without a valid host key there is no way out of audience mode.
    if (!enableAudience && !isHostVerified) return;
    setIsAudienceMode(enableAudience);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (enableAudience) {
        url.searchParams.set('mode', 'audience');
      } else {
        url.searchParams.delete('mode');
      }
      window.history.pushState({}, '', url.toString());
    }
  };

  // Toast Notification Dispatcher
  const addToast = (toastData: Omit<ToastNotification, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts(prev => [
      ...prev.slice(-3), // Keep max 4 toasts at a time
      { ...toastData, id }
    ]);
  };

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // The server (tcf_vid cookie) is the source of truth for what this device has voted on
  const applyMyVotes = (mine: Partial<MyVotes> | null | undefined) => {
    if (!mine) return;
    const next: MyVotes = {
      voterId: mine.voterId,
      problems: Array.isArray(mine.problems) ? mine.problems : [],
      squads: Array.isArray(mine.squads) ? mine.squads : [],
      categories: Array.isArray(mine.categories) ? mine.categories : [],
      trustees: Array.isArray(mine.trustees) ? mine.trustees : []
    };
    setMyVotes(next);
    setUserVotedIds(next.problems);
    setUserCommittedIds(next.squads);
    try {
      localStorage.setItem('tcf_user_votes', JSON.stringify(next.problems));
      localStorage.setItem('tcf_user_commits', JSON.stringify(next.squads));
    } catch (e) {}
  };

  const refreshMyVotes = async () => {
    try {
      const res = await fetch('/api/votes/mine');
      if (res.ok) {
        const data = await res.json();
        if (data.success) applyMyVotes(data);
      }
    } catch (e) {
      // Offline: keep whatever localStorage restored
    }
  };

  // Restores this device's ballot after a refresh or reconnect mid-round.
  const refreshMyRound = async () => {
    try {
      const res = await fetch('/api/round');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;
      setRoomSessionState(prev => ({ ...prev, activeRound: data.round ?? null }));
      if (data.myBallot) setMyRoundBallot(data.myBallot);
      // history[0] is the newest archived round — what the idle screen shows as
      // "last round result" for anyone who missed the live reveal.
      if (Array.isArray(data.history)) setLastRound(data.history[0] ?? null);
    } catch (e) {
      // Offline: the SSE snapshot will fill this in when the link comes back
    }
  };

  // Apply a full room snapshot (SSE INIT_SYNC / STATE_UPDATE or REST /api/live/sync)
  const applyServerSnapshot = (data: any) => {
    if (!data) return;
    if (data.problems && Array.isArray(data.problems)) setProblems(data.problems);
    if (data.attendees && Array.isArray(data.attendees)) setAttendees(data.attendees);
    if (data.trusteeCandidates && Array.isArray(data.trusteeCandidates)) setTrusteeCandidates(data.trusteeCandidates);
    if (data.categories && Array.isArray(data.categories)) setLiveCategories(data.categories);
    if (data.sessionState) setRoomSessionState(data.sessionState);
  };

  // Stage Conductor Remote Control Handlers
  const handleUpdateSessionState = async (partial: Partial<RoomSessionState>) => {
    try {
      const res = await hostFetch('/api/session/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionState) setRoomSessionState(data.sessionState);
      }
    } catch (err) {
      console.error('Failed to update session state:', err);
    }
  };

  // ---------------- Voting round lifecycle ----------------

  // timeoutMs arms an AbortController so a request that never comes back on a
  // half-dead venue connection fails loudly instead of spinning forever.
  const postRound = async (path: string, method: string, body?: any, timeoutMs?: number) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer =
      controller && timeoutMs
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;
    let res: Response;
    try {
      res = await hostFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller ? controller.signal : undefined
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('The room did not answer in time. Check your connection and try again.');
      }
      throw new Error('Could not reach the room. Check your connection and try again.');
    } finally {
      if (timer) clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Round request failed (${res.status})`);
    }
    return data;
  };

  const applyRound = (round: RoomSessionState['activeRound']) => {
    setRoomSessionState(prev => ({ ...prev, activeRound: round ?? null }));
  };

  const handleOpenRound = async (opts: { kind: RoundKind; title: string; maxSelections: number }) => {
    const data = await postRound('/api/round/open', 'POST', opts);
    applyRound(data.round);
    // A fresh round means this device has not voted yet.
    setMyRoundBallot({ roundId: data.round?.id ?? null, selections: [], hasVoted: false });
  };

  const handleCloseRound = async () => {
    const data = await postRound('/api/round/close', 'POST', {});
    applyRound(data.round);
  };

  const handleClearRound = async () => {
    await postRound('/api/round', 'DELETE');
    applyRound(null);
    setMyRoundBallot({ roundId: null, selections: [], hasVoted: false });
  };

  const handleSubmitBallot = async (selections: string[]) => {
    const roundId = roomSessionState.activeRound?.id;
    // 10s cap. Resubmitting is idempotent server-side (one ballot per voterId),
    // so a retry after a timeout can never double-count.
    const data = await postRound(
      '/api/round/vote',
      'POST',
      { roundId, selections, voterName: currentProfile?.name },
      10000
    );
    applyRound(data.round);
    if (data.myBallot) setMyRoundBallot(data.myBallot);
    addToast({
      type: 'success',
      title: 'Ballot submitted',
      message: 'Your vote is counted. You can change it until the host closes the round.',
      duration: 3500
    });
  };

  // ---------------- Room backup (host failsafe) ----------------

  // Pulls the whole room down as a file. On a host with no persistent disk the
  // room dies with the process, so this is what gets the evening onto the
  // backup laptop: save it as .data/room_state.json there and start the server.
  const handleDownloadBackup = async () => {
    let url: string | null = null;
    try {
      const res = await hostFetch('/api/admin/state');
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? 'This device is not signed in as host.'
            : `Server refused the backup (${res.status}).`
        );
      }
      const text = await res.text();
      // Guard against saving an error page as if it were a room.
      JSON.parse(text);

      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `room_state-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      addToast({
        type: 'success',
        title: 'Room backup downloaded',
        message: 'Save it as .data/room_state.json on the backup machine, then start the server.',
        duration: 6000
      });
    } catch (err) {
      addToast({
        type: 'info',
        title: 'Backup failed',
        message: err instanceof Error ? err.message : 'Could not download the room state.',
        duration: 6000
      });
    } finally {
      // Revoke on the next tick so the click has already been handled.
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000);
    }
  };

  const handleBroadcastAnnouncement = async (message: string) => {
    try {
      const res = await hostFetch('/api/session/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          author: currentProfile?.name || 'Stage Host'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionState) setRoomSessionState(data.sessionState);
      }
    } catch (err) {
      console.error('Failed to broadcast announcement:', err);
    }
  };

  // Restore user profile & local votes from localStorage
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem('tcf_my_profile');
      if (savedProfile) {
        setCurrentProfile(JSON.parse(savedProfile));
      } else {
        // First-time visitor walking in: prompt check-in modal
        setIsFirstVisit(true);
        setIsCheckInModalOpen(true);
      }

      const savedVotes = localStorage.getItem('tcf_user_votes');
      if (savedVotes) setUserVotedIds(JSON.parse(savedVotes));

      const savedCommits = localStorage.getItem('tcf_user_commits');
      if (savedCommits) setUserCommittedIds(JSON.parse(savedCommits));
    } catch (e) {
      console.error(e);
    }

    // Then let the server correct the local cache
    refreshMyVotes();
    refreshMyRound();
  }, []);

  // Ask the server whether this device holds the host key. ok:false forces
  // audience mode; ok:true (including when HOST_KEY is unset, e.g. local dev)
  // leaves behaviour exactly as it was.
  useEffect(() => {
    let cancelled = false;
    verifyHostKey().then(ok => {
      if (cancelled) return;
      setIsHostVerified(ok);
      if (!ok) setIsAudienceMode(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Real-Time Server-Sent Events (SSE) Stream Connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isCancelled = false;
    let pingStartTime = Date.now();

    const connectSSE = () => {
      setSyncStatus('connecting');
      try {
        eventSource = new EventSource('/api/live/stream');

        eventSource.onopen = () => {
          if (!isCancelled) {
            setSyncStatus('connected');
          }
        };

        // Initial snapshot payload
        eventSource.addEventListener('INIT_SYNC', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            applyServerSnapshot(data);
            setSyncStatus('connected');
          } catch (err) {
            console.error('Failed to parse initial sync data:', err);
          }
        });

        // Real-time incremental state broadcast updates
        eventSource.addEventListener('STATE_UPDATE', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            applyServerSnapshot(data);
            setSyncStatus('connected');
          } catch (err) {
            console.error('Failed to parse live broadcast update:', err);
          }
        });

        // Stage session phase changed by host
        eventSource.addEventListener('SESSION_PHASE_CHANGED', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            if (data.sessionState) {
              setRoomSessionState(data.sessionState);
              addToast({
                type: 'info',
                title: `Room Phase: ${data.sessionState.activePhase.toUpperCase()}`,
                message: data.sessionState.phaseTitle || 'Stage host switched the active session phase.',
                duration: 4000
              });
            }
          } catch (err) {
            console.error('Failed to parse session phase event:', err);
          }
        });

        // Live host announcement broadcast
        eventSource.addEventListener('ANNOUNCEMENT_BROADCAST', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            if (data.announcement) {
              setRoomSessionState(prev => ({ ...prev, announcement: data.announcement }));
              addToast({
                type: 'info',
                title: `Stage Broadcast from ${data.announcement.author || 'Host'}`,
                message: data.announcement.message,
                duration: 6000
              });
            }
          } catch (err) {
            console.error('Failed to parse announcement event:', err);
          }
        });

        eventSource.addEventListener('ANNOUNCEMENT_CLEARED', () => {
          if (isCancelled) return;
          setRoomSessionState(prev => ({ ...prev, announcement: null }));
        });

        // ---- Voting round lifecycle events ----

        eventSource.addEventListener('ROUND_OPENED', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            if (!data.round) return;
            setRoomSessionState(prev => ({ ...prev, activeRound: data.round }));
            setMyRoundBallot({ roundId: data.round.id, selections: [], hasVoted: false });
            addToast({
              type: 'info',
              title: 'Voting round open',
              message: data.round.title,
              duration: 5000
            });
          } catch (err) {
            console.error('Failed to parse round opened event:', err);
          }
        });

        // Running total only — per-option tallies stay hidden until the reveal.
        eventSource.addEventListener('ROUND_BALLOT_CAST', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            setRoomSessionState(prev =>
              prev.activeRound && prev.activeRound.id === data.roundId
                ? { ...prev, activeRound: { ...prev.activeRound, ballotsCast: data.ballotsCast } }
                : prev
            );
          } catch (err) {}
        });

        eventSource.addEventListener('ROUND_CLOSED', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(e.data);
            if (!data.round) return;
            setRoomSessionState(prev => ({ ...prev, activeRound: data.round }));
            addToast({
              type: 'success',
              title: 'Round closed',
              message: `${data.round.ballotsCast} ballot(s) counted — results are up.`,
              duration: 5000
            });
          } catch (err) {
            console.error('Failed to parse round closed event:', err);
          }
        });

        eventSource.addEventListener('ROUND_CLEARED', (e: MessageEvent) => {
          if (isCancelled) return;
          setRoomSessionState(prev => ({ ...prev, activeRound: null }));
          setMyRoundBallot({ roundId: null, selections: [], hasVoted: false });
          // Keep the result on the idle screen rather than letting the round
          // disappear the instant the reveal window closes.
          try {
            const data = JSON.parse(e.data);
            if (data?.round) setLastRound(data.round);
          } catch (err) {}
        });

        // Audience live reaction bubble event
        eventSource.addEventListener('AUDIENCE_REACTION', (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const reaction = JSON.parse(e.data);
            // Optionally handle room reaction floating particles
          } catch (err) {}
        });

        // Periodic heartbeat ping to measure latency
        eventSource.addEventListener('PING', (_e: MessageEvent) => {
          if (isCancelled) return;
          const currentLatency = Math.max(12, Math.min(180, Math.round(Date.now() - pingStartTime) % 50 + 15));
          setLatencyMs(currentLatency);
          pingStartTime = Date.now();
          setSyncStatus('connected');
        });

        eventSource.onerror = () => {
          if (!isCancelled) {
            setSyncStatus('reconnecting');
            // Try REST snapshot fallback
            fetch('/api/live/sync')
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  applyServerSnapshot(data);
                }
              })
              .catch(() => {});
            // The room snapshot does not carry this device's ballot, so a
            // dropped stream would otherwise leave "have I already voted?"
            // answered from stale memory.
            refreshMyRound();
          }
        };
      } catch (err) {
        console.error('SSE initialization error:', err);
        setSyncStatus('offline');
      }
    };

    connectSSE();

    return () => {
      isCancelled = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [reconnectCounter]);

  // Mobile browsers routinely freeze or kill an SSE connection while a tab is
  // backgrounded, and a locked phone gets no events at all. When the screen
  // comes back, re-ask the server what round is live and whether this device
  // has already voted, rather than trusting whatever was on screen before.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshMyRound();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Trigger manual reconnect
  const handleManualReconnect = () => {
    setReconnectCounter(prev => prev + 1);
    fetch('/api/live/sync')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          applyServerSnapshot(data);
          refreshMyVotes();
          refreshMyRound();
          addToast({
            type: 'success',
            title: 'Live Room Resynchronized',
            message: 'All device data refreshed directly with server.',
            duration: 3000
          });
        }
      })
      .catch(() => {});
  };

  // Save profile handler
  const handleSaveProfile = async (profile: AttendeeProfile) => {
    setCurrentProfile(profile);
    try {
      localStorage.setItem('tcf_my_profile', JSON.stringify(profile));
      setIsFirstVisit(false);
      addToast({
        type: 'success',
        title: 'Founder Checked In',
        message: `${profile.name} is now checked in to the Tin City Founders room.`,
        author: profile.name,
        duration: 4000
      });
    } catch (e) {
      console.error(e);
    }

    // Post to server
    try {
      const res = await fetch('/api/attendees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.attendees) {
          setAttendees(data.attendees);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to sync attendee with server:', err);
    }

    // Fallback local state update
    setAttendees(prev => {
      const exists = prev.some(a => a.id === profile.id);
      if (exists) {
        return prev.map(a => a.id === profile.id ? profile : a);
      }
      return [profile, ...prev];
    });
  };

  // Save user vote tracking to local storage
  const saveUserVoteLocal = (problemId: string, isCommit: boolean) => {
    if (!userVotedIds.includes(problemId)) {
      const updatedVotes = [...userVotedIds, problemId];
      setUserVotedIds(updatedVotes);
      try {
        localStorage.setItem('tcf_user_votes', JSON.stringify(updatedVotes));
      } catch (e) {}
    }

    if (isCommit && !userCommittedIds.includes(problemId)) {
      const updatedCommits = [...userCommittedIds, problemId];
      setUserCommittedIds(updatedCommits);
      try {
        localStorage.setItem('tcf_user_commits', JSON.stringify(updatedCommits));
      } catch (e) {}
    }
  };

  // Upvote (toggle) or Commit to Squad. The server enforces one vote per device.
  const handleVote = async (id: string, commit: boolean, name?: string) => {
    const alreadyVoted = userVotedIds.includes(id);
    const alreadyCommitted = userCommittedIds.includes(id);
    const collaboratorName = name || currentProfile?.name || 'Jos Founder';
    const targetProblem = problems.find(p => p.id === id);

    if (commit && alreadyCommitted) {
      addToast({
        type: 'info',
        title: 'Already in this squad',
        message: `You have already committed to "${targetProblem?.title || 'this problem'}".`,
        duration: 3500
      });
      return;
    }

    // Tapping an upvote you already cast withdraws it
    const retract = !commit && alreadyVoted;

    // Optimistic local tracking; the server response below is authoritative
    if (retract) {
      const updatedVotes = userVotedIds.filter(v => v !== id);
      setUserVotedIds(updatedVotes);
      try {
        localStorage.setItem('tcf_user_votes', JSON.stringify(updatedVotes));
      } catch (e) {}
    } else {
      saveUserVoteLocal(id, commit);
    }

    // Trigger non-intrusive bottom toast notifications
    if (commit) {
      addToast({
        type: 'squad_joined',
        title: `${collaboratorName} Joined the Squad!`,
        message: `Pledged to collaborate on: "${targetProblem?.title || 'Plateau Problem'}"`,
        sector: targetProblem?.category,
        author: collaboratorName,
        duration: 5000
      });
    } else if (!retract) {
      addToast({
        type: 'upvote',
        title: 'Challenge Upvoted',
        message: `Supported: "${targetProblem?.title || 'Plateau Challenge'}"`,
        sector: targetProblem?.category,
        duration: 3500
      });
    }

    try {
      const res = await fetch(
        `/api/problems/${id}/vote`,
        retract
          ? { method: 'DELETE' }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ commit, name: collaboratorName })
            }
      );
      const data = await res.json().catch(() => null);

      // Whatever the verdict, sync to the server's truth
      if (data?.myVotes) applyMyVotes(data.myVotes);
      if (data?.problems && Array.isArray(data.problems)) setProblems(data.problems);

      if (res.status === 409) {
        addToast({
          type: 'info',
          title: commit ? 'Already in this squad' : 'Vote already counted',
          message: data?.message || 'This device has already voted here.',
          duration: 3500
        });
        return;
      }
      if (data) return;
    } catch (err) {
      console.error('Server vote failed, updating locally:', err);
    }

    // Offline fallback: local update only
    setProblems(prev => prev.map(p => {
      if (p.id === id) {
        const newCollaborators = commit && !p.collaborators.includes(collaboratorName)
          ? [...p.collaborators, collaboratorName]
          : p.collaborators;
        return {
          ...p,
          upvotes: Math.max(0, p.upvotes + (retract ? -1 : 1)),
          commitments: commit ? p.commitments + 1 : p.commitments,
          collaborators: newCollaborators
        };
      }
      return p;
    }));
  };

  // Upvote category priority
  const handleVoteCategory = async (categoryName: string) => {
    const retract = myVotes.categories.includes(categoryName);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(categoryName)}/vote`, {
        method: retract ? 'DELETE' : 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.myVotes) applyMyVotes(data.myVotes);
        if (data.categories) setLiveCategories(data.categories);
        addToast({
          type: 'upvote',
          title: retract ? 'Priority Vote Removed' : 'Category Priority Voted',
          message: `Your vote for "${categoryName}" has been updated.`,
          duration: 3000
        });
      }
    } catch (err) {
      console.error('Failed to vote category:', err);
    }
  };

  // Upvote trustee candidate
  const handleVoteTrustee = async (candidateId: string) => {
    const retract = myVotes.trustees.includes(candidateId);
    try {
      const res = await fetch(`/api/trustees/${candidateId}/vote`, {
        method: retract ? 'DELETE' : 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.myVotes) applyMyVotes(data.myVotes);
        if (data.trusteeCandidates) setTrusteeCandidates(data.trusteeCandidates);
        addToast({
          type: 'upvote',
          title: retract ? 'Trustee Vote Retracted' : 'Trustee Vote Counted',
          message: `Your vote has been recorded on the live room ledger.`,
          duration: 3000
        });
      }
    } catch (err) {
      console.error('Failed to vote trustee:', err);
    }
  };

  // Nominate a founding trustee (audience floor + console share this path).
  // This only puts a name into a seat - endorsing stays host-driven.
  const handleNominateTrustee = async (data: {
    seatNumber: number;
    name: string;
    titleOrOrg?: string;
    bio?: string;
    phoneOrContact?: string;
    confirmed?: boolean;
    nominatedBy?: string;
    notes?: string;
  }) => {
    const nominator = data.nominatedBy || currentProfile?.name || 'Assembly Attendee';

    try {
      const res = await fetch('/api/trustees/nominate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, nominatedBy: nominator })
      });

      if (res.ok) {
        const payload = await res.json();
        if (payload.success) {
          if (payload.candidates) setTrusteeCandidates(payload.candidates);
          if (payload.myVotes) applyMyVotes(payload.myVotes);
          return;
        }
      }

      addToast({
        type: 'info',
        title: 'Nomination not saved',
        message: 'The room server rejected that nomination. Try again, or ask the host to add it.',
        duration: 4500
      });
    } catch (err) {
      console.error('Failed to nominate trustee:', err);
      addToast({
        type: 'info',
        title: 'Nomination not saved',
        message: 'Lost connection to the room server. Try again once you are reconnected.',
        duration: 4500
      });
    }
  };

  // Add new Plateau problem / Topic proposal
  const handleAddProblem = async (newProbData: {
    title: string;
    description: string;
    category: string;
    submittedBy: string;
    skillsNeeded: string[];
    autoUpvote?: boolean;
    autoCommit?: boolean;
  }) => {
    const author = newProbData.submittedBy || (currentProfile ? `${currentProfile.name}${currentProfile.title ? ` (${currentProfile.title})` : ''}` : 'Jos Founder');

    // Trigger non-intrusive bottom toast notifications for new problem
    addToast({
      type: 'problem_submitted',
      title: newProbData.title,
      message: `Challenge published in ${newProbData.category}. Open for founder upvotes and squad formation!`,
      sector: newProbData.category,
      author: author,
      duration: 5500
    });

    if (newProbData.autoCommit) {
      setTimeout(() => {
        addToast({
          type: 'squad_joined',
          title: `${author} Joined as Squad Lead`,
          message: `Committed to building and leading the squad for "${newProbData.title}".`,
          sector: newProbData.category,
          author: author,
          duration: 5000
        });
      }, 450);
    }

    try {
      const res = await fetch('/api/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProbData,
          submittedBy: author
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.problems) {
          setProblems(data.problems);
          if (data.problem) {
            if (newProbData.autoUpvote !== false) {
              saveUserVoteLocal(data.problem.id, false);
            }
            if (newProbData.autoCommit) {
              saveUserVoteLocal(data.problem.id, true);
            }
          }
          return;
        }
      }
    } catch (err) {
      console.error('Failed to send problem to server, using local fallback:', err);
    }

    // Fallback local creation
    const isCommit = newProbData.autoCommit === true;
    const newProblemObj: PlateauProblem = {
      id: `prob-${Date.now()}`,
      title: newProbData.title,
      description: newProbData.description,
      category: newProbData.category,
      submittedBy: author,
      upvotes: 1,
      commitments: isCommit ? 1 : 0,
      status: isCommit ? 'Squad Forming' : 'Ideation',
      collaborators: [author],
      skillsNeeded: newProbData.skillsNeeded,
      createdAt: new Date().toISOString(),
      comments: []
    };

    setProblems(prev => [newProblemObj, ...prev]);
    if (newProbData.autoUpvote !== false) {
      saveUserVoteLocal(newProblemObj.id, false);
    }
    if (isCommit) {
      saveUserVoteLocal(newProblemObj.id, true);
    }
  };

  // Add comment to problem
  const handleAddComment = async (id: string, author: string, text: string) => {
    const authorName = author || currentProfile?.name || 'Tin City Founder';
    try {
      const res = await fetch(`/api/problems/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: authorName, text })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.problems) {
          setProblems(data.problems);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to send comment to server, updating locally:', err);
    }

    // Fallback local update
    setProblems(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          comments: [
            ...p.comments,
            { id: `c-${Date.now()}`, author: authorName, text, date: 'Just now' }
          ]
        };
      }
      return p;
    }));
  };

  // Update problem's category assignment
  const handleUpdateProblemCategory = async (problemId: string, newCategory: string) => {
    try {
      const res = await fetch(`/api/problems/${problemId}/category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.problems) {
          setProblems(data.problems);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to update category on server, updating locally:', err);
    }

    // Fallback local update
    setProblems(prev => prev.map(p => p.id === problemId ? { ...p, category: newCategory } : p));
  };

  // Total voted count for badge
  const totalVotesCount = problems.reduce((sum, p) => sum + p.upvotes, 0);
  const totalSquadsCount = problems.reduce((sum, p) => sum + p.commitments, 0);

  return (
    <VotingParticleProvider>
      {audienceOnly ? (
        <div className="min-h-screen bg-[#071912] text-[#FAF6EE]">
          {/* A live round takes the phone over; outside one, the room view is the idle screen. */}
          {roomSessionState.activeRound ? (
            <RoundTakeover
              round={roomSessionState.activeRound}
              myBallot={myRoundBallot}
              onSubmitBallot={handleSubmitBallot}
              voterName={currentProfile?.name}
              syncStatus={syncStatus}
              onReconnect={handleManualReconnect}
            />
          ) : (
          <AudienceParticipationView
            /* Idle room screen: all VOTING happens inside a host round, but the
               floor can still pitch problems and nominate trustees in the
               phases where that is the point. */
            readOnly
            sessionState={roomSessionState}
            lastRound={lastRound}
            problems={problems}
            attendees={attendees}
            categories={liveCategories}
            trusteeCandidates={trusteeCandidates}
            currentProfile={currentProfile}
            myVotes={myVotes}
            onVoteProblem={handleVote}
            onVoteCategory={handleVoteCategory}
            onVoteTrustee={handleVoteTrustee}
            onSubmitProblem={handleAddProblem}
            onNominateTrustee={handleNominateTrustee}
            onOpenCheckIn={() => setIsCheckInModalOpen(true)}
            onSaveProfile={handleSaveProfile}
            onSwitchToFullConsole={() => handleToggleAudienceMode(false)}
            syncStatus={syncStatus}
            latencyMs={latencyMs}
            onReconnect={handleManualReconnect}
            onNotify={addToast}
          />
          )}

          {/* Profile / Check-in Modal */}
          <FounderCheckInModal
            isOpen={isCheckInModalOpen}
            onClose={() => setIsCheckInModalOpen(false)}
            currentProfile={currentProfile}
            onSaveProfile={handleSaveProfile}
            isFirstCheckIn={isFirstVisit}
          />

          {/* Non-intrusive Toast Notifications (Bottom Screen) */}
          <ToastContainer
            toasts={toasts}
            onDismiss={handleDismissToast}
            onToastClick={() => {}}
          />
        </div>
      ) : (
        <div className="min-h-screen flex flex-col bg-[#F6F3EC] text-[#09251B]">
          {/* Navigation Header */}
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            votedCount={userVotedIds.length}
            attendeeCount={attendees.length}
            currentProfile={currentProfile}
            onOpenProfile={() => setIsCheckInModalOpen(true)}
            onOpenAnalytics={() => setIsAnalyticsModalOpen(true)}
            onSwitchToAudienceView={() => handleToggleAudienceMode(true)}
            syncStatus={syncStatus}
            latencyMs={latencyMs}
            onReconnect={handleManualReconnect}
          />

          {/* Host Stage Conductor Control Ribbon */}
          <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 pt-3">
            <StageConductorBar
              sessionState={roomSessionState}
              onUpdateSessionState={handleUpdateSessionState}
              onBroadcastAnnouncement={handleBroadcastAnnouncement}
              connectedClientsCount={attendees.length}
              isCompact={true}
              onNotify={addToast}
              onOpenRound={handleOpenRound}
              onCloseRound={handleCloseRound}
              onClearRound={handleClearRound}
              onDownloadBackup={handleDownloadBackup}
            />
          </div>

          {/* Main View Area */}
          <main className="flex-1 py-3 sm:py-5">
            {activeTab === 'voting' && (
              <ProblemVoting
                problems={problems}
                onVote={handleVote}
                onAddProblem={handleAddProblem}
                onAddComment={handleAddComment}
                onUpdateProblemCategory={handleUpdateProblemCategory}
                userVotedIds={userVotedIds}
                userCommittedIds={userCommittedIds}
                currentProfile={currentProfile}
                attendees={attendees}
                onNavigateTab={(tab) => setActiveTab(tab)}
                categories={liveCategories}
                trusteeCandidates={trusteeCandidates}
                myVotes={myVotes}
                onMyVotesChange={applyMyVotes}
                onNotify={addToast}
              />
            )}

            {activeTab === 'attendees' && (
              <AttendeeDirectory
                attendees={attendees}
                currentProfile={currentProfile}
                onOpenCheckIn={() => setIsCheckInModalOpen(true)}
              />
            )}

            {activeTab === 'join' && (
              <JoinQR
                attendeesCount={attendees.length}
                latestProblem={problems[0] || null}
                problems={problems}
                attendees={attendees}
                trusteeCandidates={trusteeCandidates}
                sessionState={roomSessionState}
                onUpdateSessionState={handleUpdateSessionState}
                onBroadcastAnnouncement={handleBroadcastAnnouncement}
                connectedClientsCount={attendees.length}
                onOpenCheckIn={() => setIsCheckInModalOpen(true)}
                onSaveProfile={handleSaveProfile}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenAnalytics={() => setIsAnalyticsModalOpen(true)}
              />
            )}

            {activeTab === 'speed' && <SpeedFounding />}

            {activeTab === 'prompts' && <IcebreakerPrompts />}

            {activeTab === 'bingo' && <FounderBingo />}

            {activeTab === 'score' && (
              <Scoreboard
                totalProblemsVoted={totalVotesCount}
                totalSquadsFormed={totalSquadsCount}
                onOpenAnalytics={() => setIsAnalyticsModalOpen(true)}
              />
            )}
          </main>

          {/* Profile / Check-in Modal */}
          <FounderCheckInModal
            isOpen={isCheckInModalOpen}
            onClose={() => setIsCheckInModalOpen(false)}
            currentProfile={currentProfile}
            onSaveProfile={handleSaveProfile}
            isFirstCheckIn={isFirstVisit}
          />

          {/* Deep Room Live Analytics & Collective Visualization Modal */}
          <RoomLiveAnalyticsModal
            isOpen={isAnalyticsModalOpen}
            onClose={() => setIsAnalyticsModalOpen(false)}
            problems={problems}
            attendees={attendees}
            onVoteProblem={(id) => handleVote(id, false)}
            onNavigateTab={(tab) => {
              setIsAnalyticsModalOpen(false);
              setActiveTab(tab);
            }}
          />

          {/* Non-intrusive Toast Notifications (Bottom Screen) */}
          <ToastContainer
            toasts={toasts}
            onDismiss={handleDismissToast}
            onToastClick={() => setActiveTab('voting')}
          />

          {/* Footer */}
          <footer className="py-4 px-6 border-t-3 border-[#09251B] bg-[#0D4734] text-[#FAF6EE] font-display font-black text-xs tracking-wider text-center uppercase shadow-inner">
            <div className="flex items-center justify-center gap-2">
              <span>TIN CITY FOUNDERS</span>
              <span className="text-[#E5A93C]">◆</span>
              <span>SERIOUS AMBITION · SERIOUS COLLABORATION</span>
              <span className="text-[#E5A93C]">◆</span>
              <span>JOS, PLATEAU STATE</span>
            </div>
          </footer>
        </div>
      )}
    </VotingParticleProvider>
  );
}
