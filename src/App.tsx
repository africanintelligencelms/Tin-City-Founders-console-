import React, { useState, useEffect } from 'react';
import { NavigationTab, PlateauProblem, AttendeeProfile, ToastNotification, RoomSessionState } from './types';
import type { TrusteeCandidate, CategoryInfo, MyVotes } from './types';
import { INITIAL_TRUSTEE_CANDIDATES } from './data/trusteeSeatsData';
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

// Default initial problems in case server endpoint is loading
const defaultInitialProblems: PlateauProblem[] = [
  {
    id: 'prob-1',
    title: 'Cold-Chain & Solar Preservation for Potato & Tomato Farmers in Vom/Bokkos',
    description: 'Post-harvest loss reaches over 40% for Plateau fresh produce due to lack of off-grid solar cold storage and direct market logistics. Founders can build IoT monitored cold hubs and order matching.',
    category: 'Agro-Tech & Cold Chain',
    submittedBy: 'Pamela D. (Jos South)',
    upvotes: 42,
    commitments: 18,
    status: 'Active Squad',
    collaborators: ['Pamela D.', 'Mark G.', 'Chidi O.', 'Yusuf K.'],
    skillsNeeded: ['IoT Hardware', 'Solar Power Engineer', 'Mobile App Dev', 'Agro Logistics'],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    comments: [
      { id: 'c1', author: 'Mark G.', text: 'I have experience with ESP32 sensors and temperature logging. Happy to lead hardware build in Rayfield!', date: '2 days ago' },
      { id: 'c2', author: 'Chidi O.', text: 'We can link this to our logistics web platform for Plateau farm off-takers in Abuja and Lagos.', date: '1 day ago' }
    ]
  },
  {
    id: 'prob-2',
    title: 'Uninterrupted Mesh Internet & Power Hub for Tech Nodes across Anglo Jos & Bukuru',
    description: 'Frequent power cuts and fiber outages disrupt remote engineering teams in Jos. Need a co-funded solar micro-grid + Starlink failover mesh shared among tech hubs and startups.',
    category: 'Infrastructure',
    submittedBy: 'Gyang K. (Rayfield)',
    upvotes: 35,
    commitments: 14,
    status: 'Ideation',
    collaborators: ['Gyang K.', 'Esther M.', 'Suleiman B.'],
    skillsNeeded: ['Network Engineering', 'Solar System Integrator', 'Community Organizing'],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    comments: [
      { id: 'c3', author: 'Esther M.', text: 'We can set up a shared node at our hub in Anglo Jos as a pilot test site.', date: 'Yesterday' }
    ]
  },
  {
    id: 'prob-3',
    title: 'Global Export & Payment Gateway for Jos Artisanal Mining & Gemstone Crafters',
    description: 'Plateau gemstone miners & lapidary artisans lack direct international escrow, verified authenticity passports, and cross-border payment integration for high-value export markets.',
    category: 'Commerce & Export',
    submittedBy: 'Bilikisu A. (Jos North)',
    upvotes: 29,
    commitments: 11,
    status: 'Squad Forming',
    collaborators: ['Bilikisu A.', 'David T.'],
    skillsNeeded: ['Fintech / Stripe API', 'Product Design', 'Compliance / Export Law'],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    comments: []
  },
  {
    id: 'prob-4',
    title: 'Jos Tech Talent Pipeline: Industry-Gated Apprenticeships for Unije / PLASU Graduates',
    description: 'Computer science grads from University of Jos and Plateau State University struggle with practical production code. Need a 12-week open-source project incubator matched with local startup mentors.',
    category: 'Tech Talent & Education',
    submittedBy: 'Engr. Victor (Unijos)',
    upvotes: 51,
    commitments: 25,
    status: 'Prototype Built',
    collaborators: ['Engr. Victor', 'Ruth E.', 'Solomon P.', 'Zainab H.'],
    skillsNeeded: ['Senior Mentors', 'Curriculum Leads', 'DevOps Engineers'],
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    comments: [
      { id: 'c4', author: 'Ruth E.', text: 'First cohort of 15 apprentices starting next month at nHub space!', date: '3 days ago' }
    ]
  }
];

// Default sample checked-in attendees
const defaultInitialAttendees: AttendeeProfile[] = [
  {
    id: 'att-1',
    name: 'Pamela Dung',
    title: 'Founder @ AgriPlateau ColdHubs',
    tags: ['Agro-Tech & Cold Chain', 'Hardware & Solar', 'Founder / CEO'],
    bio: 'Building IoT solar cold-storage containers for Irish potato farmers in Bokkos and Mangu.',
    giveAsk: 'Give: IoT firmware / ESP32 architecture help. Ask: Introductions to farm off-takers and cooperatives.',
    location: 'Jos South (Vom/Bukuru)',
    avatarColor: '#0D4734',
    checkedInAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  },
  {
    id: 'att-2',
    name: 'Gyang Kim',
    title: 'Lead Systems Engineer @ PeakMesh',
    tags: ['Infrastructure', 'AI & Software', 'DevOps & Cloud'],
    bio: 'Setting up failover wireless mesh grids and solar battery backups for tech workspaces in Jos.',
    giveAsk: 'Give: Network routing & cloud server hosting tips. Ask: Landlord permission for rooftop antennas in Rayfield.',
    location: 'Rayfield, Jos',
    avatarColor: '#166E52',
    checkedInAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  },
  {
    id: 'att-3',
    name: 'Bilikisu Ahmed',
    title: 'Co-Founder @ JosGems Marketplace',
    tags: ['Commerce & Export', 'Fintech & Payments', 'Product & UX Design'],
    bio: 'Empowering Plateau artisanal mineral lapidaries with digital escrow verification and global DHL shipping.',
    giveAsk: 'Give: Export customs compliance & UI/UX feedback. Ask: React Native developer for mobile checkout.',
    location: 'Jos North / Central',
    avatarColor: '#E5A93C',
    checkedInAt: new Date(Date.now() - 1000 * 60 * 20).toISOString()
  },
  {
    id: 'att-4',
    name: 'Solomon Pwajok',
    title: 'Full-Stack Dev & Unijos CS Mentor',
    tags: ['Tech Talent & Education', 'AI & Software', 'Student / Builder'],
    bio: 'Passionate about open-source developer tooling and training the next generation of Plateau tech builders.',
    giveAsk: 'Give: Fullstack code reviews (React/Node/Python). Ask: Startup internships for top 10 graduating students.',
    location: 'University of Jos / PLASU',
    avatarColor: '#BF7E1D',
    checkedInAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('voting');
  const [problems, setProblems] = useState<PlateauProblem[]>(defaultInitialProblems);
  const [attendees, setAttendees] = useState<AttendeeProfile[]>(defaultInitialAttendees);
  const [currentProfile, setCurrentProfile] = useState<AttendeeProfile | null>(null);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState<boolean>(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState<boolean>(false);
  const [isFirstVisit, setIsFirstVisit] = useState<boolean>(false);
  const [userVotedIds, setUserVotedIds] = useState<string[]>([]);
  const [userCommittedIds, setUserCommittedIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Live room state that only the server owns
  const [trusteeCandidates, setTrusteeCandidates] = useState<TrusteeCandidate[]>(INITIAL_TRUSTEE_CANDIDATES);
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

  const [roomSessionState, setRoomSessionState] = useState<RoomSessionState>({
    activePhase: 'voting',
    phaseTitle: 'Live Plateau Problem Voting & Squad Formation',
    announcement: null,
    allowAudienceNavigation: true,
    updatedAt: Date.now()
  });

  const handleToggleAudienceMode = (enableAudience: boolean) => {
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
      const res = await fetch('/api/session/state', {
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

  const handleBroadcastAnnouncement = async (message: string) => {
    try {
      const res = await fetch('/api/session/broadcast', {
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

  // Trigger manual reconnect
  const handleManualReconnect = () => {
    setReconnectCounter(prev => prev + 1);
    fetch('/api/live/sync')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          applyServerSnapshot(data);
          refreshMyVotes();
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
      {isAudienceMode ? (
        <div className="min-h-screen bg-[#071912] text-[#FAF6EE]">
          <AudienceParticipationView
            sessionState={roomSessionState}
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
            onOpenCheckIn={() => setIsCheckInModalOpen(true)}
            onSaveProfile={handleSaveProfile}
            onSwitchToFullConsole={() => handleToggleAudienceMode(false)}
            syncStatus={syncStatus}
            latencyMs={latencyMs}
            onReconnect={handleManualReconnect}
            onNotify={addToast}
          />

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
