import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  Award, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Edit3, 
  ThumbsUp, 
  FileText, 
  Download, 
  Info, 
  Scale, 
  HelpCircle, 
  Search, 
  Filter, 
  Layers, 
  Briefcase, 
  Phone, 
  Mail, 
  Building2, 
  ChevronRight, 
  X, 
  Check, 
  Printer, 
  Share2,
  Tv,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrusteeSeatDefinition, TrusteeCandidate, TrusteeTier, AttendeeProfile, MyVotes, ToastNotification } from '../types';
import { TRUSTEE_SEATS, INITIAL_TRUSTEE_CANDIDATES } from '../data/trusteeSeatsData';
import { useVotingAnimation } from './VotingParticleManager';
import { sounds } from '../utils/soundEffects';
import { hostFetch } from '../utils/hostKey';

interface TrusteeSelectionVotingProps {
  attendees?: AttendeeProfile[];
  currentProfile?: AttendeeProfile | null;
  onNavigateTab?: (tab: any) => void;
  // Live server state (owned by App, fed by SSE)
  liveCandidates?: TrusteeCandidate[];
  endorsedIds?: string[];
  onMyVotesChange?: (mine: MyVotes) => void;
  onNotify?: (toast: Omit<ToastNotification, 'id'>) => void;
}

export const TrusteeSelectionVoting: React.FC<TrusteeSelectionVotingProps> = ({
  attendees = [],
  currentProfile,
  onNavigateTab,
  liveCandidates,
  endorsedIds,
  onMyVotesChange,
  onNotify
}) => {
  const { triggerVoteAnimation } = useVotingAnimation();

  // Candidates state with local persistence
  const [candidates, setCandidates] = useState<TrusteeCandidate[]>(() => {
    try {
      const saved = localStorage.getItem('tcf_trustee_candidates_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_TRUSTEE_CANDIDATES;
  });

  // User Voted Candidate IDs with local persistence
  const [userEndorsedIds, setUserEndorsedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tcf_trustee_endorsed_ids');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Active filters and view mode
  const [selectedTier, setSelectedTier] = useState<'ALL' | TrusteeTier>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSeatModal, setActiveSeatModal] = useState<number | null>(null);
  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false);
  const [isCamaInfoModalOpen, setIsCamaInfoModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [nominateForSeatNumber, setNominateForSeatNumber] = useState<number>(1);
  const [editingCandidate, setEditingCandidate] = useState<TrusteeCandidate | null>(null);

  // Form state for nomination / editing
  const [formName, setFormName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formScoreR, setFormScoreR] = useState(5);
  const [formScoreN, setFormScoreN] = useState(5);
  const [formScoreT, setFormScoreT] = useState(5);
  const [formReachable, setFormReachable] = useState(true);
  const [formConfirmed, setFormConfirmed] = useState(true);
  const [formCama18, setFormCama18] = useState(true);
  const [formCamaMind, setFormCamaMind] = useState(true);
  const [formCamaBankrupt, setFormCamaBankrupt] = useState(true);
  const [formCamaFraud, setFormCamaFraud] = useState(true);
  const [formNotes, setFormNotes] = useState('');

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tcf_trustee_candidates_v1', JSON.stringify(candidates));
    } catch (e) {}
  }, [candidates]);

  useEffect(() => {
    try {
      localStorage.setItem('tcf_trustee_endorsed_ids', JSON.stringify(userEndorsedIds));
    } catch (e) {}
  }, [userEndorsedIds]);

  // Server truth (via SSE in App) beats the local cache
  useEffect(() => {
    if (liveCandidates && liveCandidates.length > 0) setCandidates(liveCandidates);
  }, [liveCandidates]);

  useEffect(() => {
    if (endorsedIds) setUserEndorsedIds(endorsedIds);
  }, [endorsedIds]);

  // Nominee phone numbers are stripped from every public payload (the room runs
  // on a public URL), so the console reads them back from the host-gated
  // /api/admin/trustees and merges them in for display, editing and export.
  const [contactsById, setContactsById] = useState<Record<string, string>>({});

  const loadContacts = React.useCallback(async () => {
    try {
      const res = await hostFetch('/api/admin/trustees');
      if (!res.ok) return; // no host key on this device: contacts stay hidden
      const data = await res.json();
      if (!Array.isArray(data?.candidates)) return;
      const map: Record<string, string> = {};
      for (const c of data.candidates) {
        if (c?.id && c.phoneOrContact) map[c.id] = c.phoneOrContact;
      }
      setContactsById(map);
    } catch (e) {
      // Offline or not the host — the rest of the grid still works.
    }
  }, []);

  const candidateIdSignature = candidates.map(c => c.id).join('|');
  useEffect(() => {
    loadContacts();
  }, [candidateIdSignature, loadContacts]);

  const contactFor = (cand: TrusteeCandidate) => contactsById[cand.id] || cand.phoneOrContact || '';

  // Apply a server response: candidate list + what this device has voted on
  const syncFromServer = (data: any) => {
    if (!data) return;
    if (Array.isArray(data.candidates)) setCandidates(data.candidates);
    if (data.myVotes && onMyVotesChange) onMyVotesChange(data.myVotes);
    loadContacts();
  };

  // hostFetch attaches x-tcf-host when this device holds the host key; audience
  // phones send no header and the open routes here are unaffected.
  const postJson = (url: string, body: unknown, method: 'POST' | 'DELETE' = 'POST') =>
    hostFetch(url, method === 'DELETE'
      ? { method }
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // Aggregate Board Health Metrics
  const totalSeats = 12;
  const seatsWithCandidate = useMemo(() => {
    const seatMap = new Set(candidates.map(c => c.seatNumber));
    return seatMap.size;
  }, [candidates]);

  const confirmedTrusteesCount = useMemo(() => {
    return candidates.filter(c => c.confirmed).length;
  }, [candidates]);

  const camaCompliantCount = useMemo(() => {
    return candidates.filter(c => 
      c.camaChecks.isOver18 && 
      c.camaChecks.isSoundMind && 
      c.camaChecks.notBankrupt && 
      c.camaChecks.noFraudConviction
    ).length;
  }, [candidates]);

  const avgR = useMemo(() => {
    if (!candidates.length) return 0;
    return (candidates.reduce((s, c) => s + c.scoreR, 0) / candidates.length).toFixed(1);
  }, [candidates]);

  const avgT = useMemo(() => {
    if (!candidates.length) return 0;
    return (candidates.reduce((s, c) => s + c.scoreT, 0) / candidates.length).toFixed(1);
  }, [candidates]);

  const avgN = useMemo(() => {
    if (!candidates.length) return 0;
    return (candidates.reduce((s, c) => s + c.scoreN, 0) / candidates.length).toFixed(1);
  }, [candidates]);

  // Handle Endorsement / Upvote. One endorsement per device per candidate, enforced by the server.
  const handleEndorse = async (e: React.MouseEvent<HTMLButtonElement>, candidateId: string) => {
    const isEndorsed = userEndorsedIds.includes(candidateId);
    const candidate = candidates.find(c => c.id === candidateId);

    triggerVoteAnimation(e, {
      text: isEndorsed ? '-1 Endorsement' : '⭐ +1 Trustee Vote',
      type: 'squad',
      milestone: !isEndorsed
    });

    // Optimistic local update; the server response below is authoritative
    if (isEndorsed) {
      setUserEndorsedIds(prev => prev.filter(id => id !== candidateId));
      setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, votes: Math.max(0, c.votes - 1) } : c));
    } else {
      sounds.playSquadJoinedSound();
      setUserEndorsedIds(prev => [...prev, candidateId]);
      setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, votes: c.votes + 1 } : c));
    }

    try {
      const res = await postJson(
        `/api/trustees/${encodeURIComponent(candidateId)}/vote`,
        { voterName: currentProfile?.name || 'Founder' },
        isEndorsed ? 'DELETE' : 'POST'
      );
      const data = await res.json().catch(() => null);
      syncFromServer(data);

      if (res.status === 409 && onNotify) {
        onNotify({
          type: 'info',
          title: 'Endorsement already counted',
          message: data?.message || `This device has already endorsed ${candidate?.name || 'this candidate'}.`,
          duration: 3500
        });
      }
    } catch (err) {
      console.error('Server endorsement failed, kept local state:', err);
    }
  };

  // Handle Quick Score Adjustments directly on card
  const handleUpdateScore = (candidateId: string, field: 'scoreR' | 'scoreN' | 'scoreT', newScore: number) => {
    sounds.playTapSound();
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        return { ...c, [field]: newScore };
      }
      return c;
    }));

    postJson(`/api/trustees/${encodeURIComponent(candidateId)}/score`, { [field]: newScore })
      .then(res => (res.ok ? res.json() : null))
      .then(syncFromServer)
      .catch(err => console.error('Server score update failed:', err));
  };

  // Handle Toggle Reachable / Confirmed
  const handleToggleFlag = (candidateId: string, field: 'reachable' | 'confirmed') => {
    sounds.playTapSound();
    const current = candidates.find(c => c.id === candidateId);
    const nextValue = current ? !current[field] : true;

    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        return { ...c, [field]: nextValue };
      }
      return c;
    }));

    postJson(`/api/trustees/${encodeURIComponent(candidateId)}/score`, { [field]: nextValue })
      .then(res => (res.ok ? res.json() : null))
      .then(syncFromServer)
      .catch(err => console.error('Server flag update failed:', err));
  };

  // Open Nominate Modal for specific seat
  const handleOpenNominate = (seatNumber: number, existingCand?: TrusteeCandidate) => {
    setNominateForSeatNumber(seatNumber);
    if (existingCand) {
      setEditingCandidate(existingCand);
      setFormName(existingCand.name);
      setFormTitle(existingCand.titleOrOrg);
      setFormBio(existingCand.bio || '');
      setFormContact(contactFor(existingCand));
      setFormScoreR(existingCand.scoreR);
      setFormScoreN(existingCand.scoreN);
      setFormScoreT(existingCand.scoreT);
      setFormReachable(existingCand.reachable);
      setFormConfirmed(existingCand.confirmed);
      setFormCama18(existingCand.camaChecks.isOver18);
      setFormCamaMind(existingCand.camaChecks.isSoundMind);
      setFormCamaBankrupt(existingCand.camaChecks.notBankrupt);
      setFormCamaFraud(existingCand.camaChecks.noFraudConviction);
      setFormNotes(existingCand.notes || '');
    } else {
      setEditingCandidate(null);
      setFormName('');
      setFormTitle('');
      setFormBio('');
      setFormContact('');
      setFormScoreR(5);
      setFormScoreN(5);
      setFormScoreT(5);
      setFormReachable(true);
      setFormConfirmed(false);
      setFormCama18(true);
      setFormCamaMind(true);
      setFormCamaBankrupt(true);
      setFormCamaFraud(true);
      setFormNotes('');
    }
    setIsNominateModalOpen(true);
  };

  // Save / Submit Nomination
  const handleSaveNomination = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingCandidate) {
      // Update existing
      setCandidates(prev => prev.map(c => {
        if (c.id === editingCandidate.id) {
          return {
            ...c,
            name: formName.trim(),
            titleOrOrg: formTitle.trim(),
            bio: formBio.trim(),
            phoneOrContact: formContact.trim(),
            scoreR: formScoreR,
            scoreN: formScoreN,
            scoreT: formScoreT,
            reachable: formReachable,
            confirmed: formConfirmed,
            camaChecks: {
              isOver18: formCama18,
              isSoundMind: formCamaMind,
              notBankrupt: formCamaBankrupt,
              noFraudConviction: formCamaFraud
            },
            notes: formNotes.trim()
          };
        }
        return c;
      }));
    } else {
      // Create new candidate
      const newCand: TrusteeCandidate = {
        id: `cand-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        seatNumber: nominateForSeatNumber,
        name: formName.trim(),
        titleOrOrg: formTitle.trim() || 'Founding Trustee Nominee',
        bio: formBio.trim(),
        phoneOrContact: formContact.trim(),
        scoreR: formScoreR,
        scoreN: formScoreN,
        scoreT: formScoreT,
        reachable: formReachable,
        confirmed: formConfirmed,
        camaChecks: {
          isOver18: formCama18,
          isSoundMind: formCamaMind,
          notBankrupt: formCamaBankrupt,
          noFraudConviction: formCamaFraud
        },
        votes: 1,
        nominatedBy: currentProfile?.name || 'Assembly Attendee',
        createdAt: Date.now(),
        notes: formNotes.trim()
      };

      setCandidates(prev => [...prev.filter(c => c.seatNumber !== nominateForSeatNumber), newCand]);
    }

    // Persist to the room server (it replaces the seat holder and records the nominator's endorsement)
    const camaChecks = {
      isOver18: formCama18,
      isSoundMind: formCamaMind,
      notBankrupt: formCamaBankrupt,
      noFraudConviction: formCamaFraud
    };
    postJson('/api/trustees/nominate', {
      id: editingCandidate ? editingCandidate.id : undefined,
      seatNumber: nominateForSeatNumber,
      name: formName.trim(),
      titleOrOrg: formTitle.trim() || 'Founding Trustee Nominee',
      bio: formBio.trim(),
      phoneOrContact: formContact.trim(),
      scoreR: formScoreR,
      scoreN: formScoreN,
      scoreT: formScoreT,
      reachable: formReachable,
      confirmed: formConfirmed,
      camaChecks,
      nominatedBy: editingCandidate ? editingCandidate.nominatedBy : (currentProfile?.name || 'Assembly Attendee'),
      notes: formNotes.trim()
    })
      .then(res => (res.ok ? res.json() : null))
      .then(syncFromServer)
      .catch(err => console.error('Server nomination failed, kept local state:', err));

    sounds.playSquadJoinedSound();
    setIsNominateModalOpen(false);
  };

  // Quick Autocomplete from Room Attendees
  const handleSelectAttendeeNominee = (att: AttendeeProfile) => {
    setFormName(att.name);
    setFormTitle(att.title || 'Tech Founder / Operator');
    setFormBio(att.bio || `${att.name} is an active founder building in Jos with ${att.tags?.join(', ')}.`);
    setFormContact(att.location ? `Jos (${att.location})` : '');
    sounds.playTapSound();
  };

  // Export CAC Table as CSV
  const handleDownloadCSV = () => {
    sounds.playVoteSound();
    const headers = [
      'Seat Number',
      'Tier',
      'Role Title',
      'Nominee Name',
      'Title / Organization',
      'Contact',
      'Score R (Reliable 1-5)',
      'Score N (New Network 1-5)',
      'Score T (Trust 1-5)',
      'Total Score (out of 15)',
      'Reachable?',
      'Confirmed?',
      'CAMA 2020 Compliant',
      'Votes / Endorsements',
      'Rule Verdict'
    ];

    const rows = TRUSTEE_SEATS.map(seat => {
      const cand = candidates.find(c => c.seatNumber === seat.seatNumber);
      if (!cand) {
        return [
          seat.seatNumber,
          seat.tier,
          `"${seat.title.replace(/"/g, '""')}"`,
          'VACANT',
          '',
          '',
          '',
          '',
          '',
          '',
          'No',
          'No',
          'Pending',
          '0',
          'SEAT VACANT'
        ];
      }

      const total = cand.scoreR + cand.scoreN + cand.scoreT;
      const isCama = cand.camaChecks.isOver18 && cand.camaChecks.isSoundMind && cand.camaChecks.notBankrupt && cand.camaChecks.noFraudConviction;
      const ruleVerdict = (cand.scoreR < 3 || cand.scoreT < 3)
        ? 'FAIL (Low R/T Rule)'
        : !isCama
        ? 'DISQUALIFIED (CAMA Check)'
        : cand.confirmed
        ? 'APPROVED & CONFIRMED'
        : 'NOMINATED (Pending Confirmation)';

      return [
        seat.seatNumber,
        seat.tier,
        `"${seat.title.replace(/"/g, '""')}"`,
        `"${cand.name.replace(/"/g, '""')}"`,
        `"${cand.titleOrOrg.replace(/"/g, '""')}"`,
        `"${contactFor(cand).replace(/"/g, '""')}"`,
        cand.scoreR,
        cand.scoreN,
        cand.scoreT,
        total,
        cand.reachable ? 'Yes' : 'No',
        cand.confirmed ? 'Yes' : 'No',
        isCama ? 'Yes' : 'No',
        cand.votes,
        `"${ruleVerdict}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TinCityFounders_Trustee_Selection_Grid_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Seats
  const filteredSeats = useMemo(() => {
    return TRUSTEE_SEATS.filter(seat => {
      const matchTier = selectedTier === 'ALL' || seat.tier === selectedTier;
      if (!matchTier) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const cand = candidates.find(c => c.seatNumber === seat.seatNumber);

      return (
        seat.title.toLowerCase().includes(q) ||
        seat.roleDescription.toLowerCase().includes(q) ||
        (cand && (cand.name.toLowerCase().includes(q) || cand.titleOrOrg.toLowerCase().includes(q)))
      );
    });
  }, [selectedTier, searchQuery, candidates]);

  // Styling helper for Tier badge
  const getTierColorInfo = (tier: TrusteeTier) => {
    switch (tier) {
      case 'CORE':
        return {
          bg: 'bg-[#0D4734]',
          text: 'text-[#FAF6EE]',
          badgeBg: 'bg-[#0D4734]',
          border: 'border-[#0D4734]',
          lightBg: 'bg-[#EBF3EF]',
          label: 'CORE (Seats 1-4)',
          desc: 'Day-to-day Operators & Community Stewards'
        };
      case 'CREDIBILITY':
        return {
          bg: 'bg-[#E5A93C]',
          text: 'text-[#09251B]',
          badgeBg: 'bg-[#E5A93C]',
          border: 'border-[#E5A93C]',
          lightBg: 'bg-[#FEF6E9]',
          label: 'CREDIBILITY (Seats 5-8)',
          desc: 'Senior Gravitas, Mentors & Institutional Links'
        };
      case 'BRIDGES':
        return {
          bg: 'bg-[#0E7490]',
          text: 'text-[#FAF6EE]',
          badgeBg: 'bg-[#0E7490]',
          border: 'border-[#0E7490]',
          lightBg: 'bg-[#E0F2FE]',
          label: 'BRIDGES (Seats 9-12)',
          desc: 'Real-Economy SME, Women, Youth & Diversity'
        };
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Executive Boardroom Selection Banner */}
      <div className="bg-gradient-to-br from-[#09251B] via-[#0D4734] to-[#125B43] rounded-3xl p-5 sm:p-7 border-3 border-[#09251B] text-[#FAF6EE] shadow-xl relative overflow-hidden">
        {/* Ambient watermark pattern */}
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <Scale className="w-80 h-80 text-white" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5A93C] text-[#09251B] font-display font-black text-xs uppercase tracking-wider shadow-sm">
                <Scale className="w-3.5 h-3.5" />
                <span>Association Governance</span>
              </span>
              <span className="text-xs font-mono font-bold text-white/70">
                CAC Part F / CAMA 2020 Registration
              </span>
            </div>

            <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight leading-tight">
              FOUNDING TRUSTEES <span className="text-[#E5A93C]">SELECTION MATRIX</span>
            </h1>

            <p className="text-xs sm:text-sm text-white/85 font-medium leading-relaxed">
              Evaluating and electing the <strong>12 statutory founding trustees</strong> for the registered Tin City Founders association using the standardized <strong>R-N-T Reliability, Network & Trust Test</strong>.
            </p>

            <button
              onClick={() => handleOpenNominate(1)}
              className="w-fit bg-white text-[#09251B] hover:bg-[#FAF6EE] text-sm font-display font-black px-5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-5 h-5 text-[#0D4734]" />
              <span>Nominate New Candidate</span>
            </button>
          </div>

          {/* Quick Stat Pillboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5 shrink-0">
            <div className="bg-[#09251B]/80 border border-[#E5A93C]/40 rounded-2xl p-3 text-left">
              <span className="text-[10px] uppercase font-mono text-white/70 block">Board Fill Quorum</span>
              <div className="font-display font-black text-xl text-white flex items-baseline gap-1">
                <span className="text-[#E5A93C]">{seatsWithCandidate}</span>
                <span className="text-xs text-white/60">/ {totalSeats} Seats</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">{confirmedTrusteesCount} Confirmed</span>
            </div>

            <div className="bg-[#09251B]/80 border border-[#E5A93C]/40 rounded-2xl p-3 text-left">
              <span className="text-[10px] uppercase font-mono text-white/70 block">CAMA Legal Cleared</span>
              <div className="font-display font-black text-xl text-emerald-400">
                {camaCompliantCount} / {candidates.length}
              </div>
              <span className="text-[10px] text-white/70">Sec. 826 verified</span>
            </div>

            <div className="bg-[#09251B]/80 border border-[#E5A93C]/40 rounded-2xl p-3 text-left">
              <span className="text-[10px] uppercase font-mono text-white/70 block">Avg R (Reliability)</span>
              <div className="font-display font-black text-xl text-amber-300">
                {avgR} <span className="text-xs text-white/50">/ 5.0</span>
              </div>
              <span className="text-[10px] text-white/70">Legal sign-off speed</span>
            </div>

            <div className="bg-[#09251B]/80 border border-[#E5A93C]/40 rounded-2xl p-3 text-left">
              <span className="text-[10px] uppercase font-mono text-white/70 block">Avg T (Trust)</span>
              <div className="font-display font-black text-xl text-emerald-300">
                {avgT} <span className="text-xs text-white/50">/ 5.0</span>
              </div>
              <span className="text-[10px] text-white/70">Pressure integrity</span>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCamaInfoModalOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-display font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-white/20"
            >
              <Info className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>The R-N-T Rule & CAMA Checklist</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              className="bg-[#E5A93C] hover:bg-[#D97706] text-[#09251B] text-xs font-display font-black px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CAC Legal Roster (CSV)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Standardized Formula Quick Bar */}
      <div className="bg-[#FAF8F4] border-2 border-[#09251B]/20 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 font-display font-black text-[#09251B] shrink-0">
          <Scale className="w-4 h-4 text-[#0D4734]" />
          <span>THE TEST (Score each 1-5):</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <div className="bg-white p-2.5 rounded-xl border border-[#09251B]/15 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#0D4734] text-[#FAF6EE] font-display font-black text-xs flex items-center justify-center flex-none">
              R
            </span>
            <div>
              <span className="font-display font-bold text-[#09251B] block">Reliable</span>
              <span className="text-[10px] text-[#09251B]/70">Will they sign / respond on time?</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-[#09251B]/15 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#E5A93C] text-[#09251B] font-display font-black text-xs flex items-center justify-center flex-none">
              N
            </span>
            <div>
              <span className="font-display font-bold text-[#09251B] block">New Network</span>
              <span className="text-[10px] text-[#09251B]/70">A door the others don't open</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-[#09251B]/15 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#0E7490] text-[#FAF6EE] font-display font-black text-xs flex items-center justify-center flex-none">
              T
            </span>
            <div>
              <span className="font-display font-bold text-[#09251B] block">Trust under pressure</span>
              <span className="text-[10px] text-[#09251B]/70">Name on a legal document</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="bg-white border-2 border-[#09251B] rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Tier filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All 12 Seats' },
            { id: 'CORE', label: 'Core (1-4)', color: 'text-emerald-800' },
            { id: 'CREDIBILITY', label: 'Credibility (5-8)', color: 'text-amber-800' },
            { id: 'BRIDGES', label: 'Bridges (9-12)', color: 'text-cyan-800' }
          ].map(tab => {
            const isActive = selectedTier === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedTier(tab.id as any);
                  sounds.playTapSound();
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#0D4734] text-[#FAF6EE] font-black shadow-xs'
                    : 'bg-[#FAF8F4] text-[#09251B] hover:bg-[#F4EFE6]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#09251B]/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate or seat..."
            className="w-full bg-[#FAF8F4] border border-[#09251B]/20 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-[#09251B] focus:outline-none focus:border-[#0D4734] focus:ring-1 focus:ring-[#0D4734]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-[#09251B]/40 hover:text-[#09251B]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 4. The 12 Seats Interactive Selection Matrix */}
      <div className="space-y-4">
        {filteredSeats.map((seat) => {
          const cand = candidates.find(c => c.seatNumber === seat.seatNumber);
          const tierInfo = getTierColorInfo(seat.tier);
          const isEndorsed = cand ? userEndorsedIds.includes(cand.id) : false;

          // Rule compliance checks
          const isLowScoreFail = cand ? (cand.scoreR < 3 || cand.scoreT < 3) : false;
          const isCamaClear = cand ? (
            cand.camaChecks.isOver18 &&
            cand.camaChecks.isSoundMind &&
            cand.camaChecks.notBankrupt &&
            cand.camaChecks.noFraudConviction
          ) : false;

          const totalScore = cand ? cand.scoreR + cand.scoreN + cand.scoreT : 0;

          return (
            <div
              key={seat.seatNumber}
              className={`bg-white border-2 rounded-3xl transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                isLowScoreFail
                  ? 'border-amber-400 bg-amber-50/30'
                  : !isCamaClear && cand
                  ? 'border-red-400 bg-red-50/20'
                  : 'border-[#09251B]/20'
              }`}
            >
              {/* Seat Header Bar */}
              <div className="px-5 py-3.5 bg-[#FAF8F4] border-b border-[#09251B]/15 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl ${tierInfo.bg} ${tierInfo.text} flex items-center justify-center font-display font-black text-sm shadow-xs`}>
                    {seat.seatNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-md ${tierInfo.lightBg} text-[#09251B]`}>
                        {seat.tier} SEAT #{seat.seatNumber}
                      </span>
                      <span className="text-xs text-[#09251B]/60 font-medium hidden sm:inline">
                        · {tierInfo.desc}
                      </span>
                    </div>
                    <h3 className="font-display font-black text-sm sm:text-base text-[#09251B]">
                      {seat.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cand ? (
                    <button
                      onClick={() => handleOpenNominate(seat.seatNumber, cand)}
                      className="px-2.5 py-1.5 bg-white hover:bg-[#FAF8F4] text-[#09251B] border border-[#09251B]/20 rounded-xl text-xs font-display font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                      title="Edit nominee or scores"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#0D4734]" />
                      <span>Edit Nominee</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenNominate(seat.seatNumber)}
                      className="px-3 py-1.5 bg-[#0D4734] hover:bg-[#125B43] text-[#FAF6EE] rounded-xl text-xs font-display font-black flex items-center gap-1 cursor-pointer transition shadow-xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nominate Candidate</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Seat Body */}
              <div className="p-5 sm:p-6">
                {cand ? (
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Candidate Info Column */}
                    <div className="space-y-3 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-display font-black text-base sm:text-lg text-[#09251B]">
                              {cand.name}
                            </h4>
                            {cand.confirmed && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-display font-black">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Confirmed</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-[#0D4734]">
                            {cand.titleOrOrg}
                          </p>
                        </div>
                      </div>

                      {cand.bio && (
                        <p className="text-xs text-[#09251B]/80 font-medium leading-relaxed">
                          {cand.bio}
                        </p>
                      )}

                      {/* Contact / CAMA Badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {contactFor(cand) && (
                          <span className="text-[11px] font-mono text-[#09251B]/70 bg-[#FAF8F4] px-2.5 py-1 rounded-lg border border-[#09251B]/10 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-[#0D4734]" />
                            <span>{contactFor(cand)}</span>
                          </span>
                        )}

                        <span className={`text-[11px] font-display font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                          isCamaClear 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                            : 'bg-red-50 text-red-800 border-red-300'
                        }`}>
                          <ShieldCheck className="w-3 h-3" />
                          <span>{isCamaClear ? 'CAMA 2020 Cleared' : 'CAMA Disqualified'}</span>
                        </span>

                        {isLowScoreFail && (
                          <span className="text-[11px] font-display font-black px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            <span>Low R/T Score Rule Fail</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Scores & Matrix Column */}
                    <div className="bg-[#FAF8F4] border border-[#09251B]/15 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-5 shrink-0 lg:w-96">
                      {/* R, N, T Score Pickers */}
                      <div className="space-y-2.5 w-full">
                        {/* Score R */}
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-[#0D4734] text-[#FAF6EE] font-display font-black text-[10px] flex items-center justify-center">
                              R
                            </span>
                            <span className="font-display font-bold text-[#09251B]">Reliable</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(val => (
                              <button
                                key={val}
                                onClick={() => handleUpdateScore(cand.id, 'scoreR', val)}
                                className={`w-6 h-6 rounded-lg text-xs font-display font-black transition cursor-pointer ${
                                  cand.scoreR === val
                                    ? 'bg-[#0D4734] text-[#FAF6EE] shadow-xs scale-110 ring-1 ring-[#0D4734]'
                                    : 'bg-white text-[#09251B]/60 hover:bg-[#EBF3EF]'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Score N */}
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-[#E5A93C] text-[#09251B] font-display font-black text-[10px] flex items-center justify-center">
                              N
                            </span>
                            <span className="font-display font-bold text-[#09251B]">New Network</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(val => (
                              <button
                                key={val}
                                onClick={() => handleUpdateScore(cand.id, 'scoreN', val)}
                                className={`w-6 h-6 rounded-lg text-xs font-display font-black transition cursor-pointer ${
                                  cand.scoreN === val
                                    ? 'bg-[#E5A93C] text-[#09251B] shadow-xs scale-110 ring-1 ring-[#D97706]'
                                    : 'bg-white text-[#09251B]/60 hover:bg-[#FEF6E9]'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Score T */}
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-[#0E7490] text-[#FAF6EE] font-display font-black text-[10px] flex items-center justify-center">
                              T
                            </span>
                            <span className="font-display font-bold text-[#09251B]">Trust</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(val => (
                              <button
                                key={val}
                                onClick={() => handleUpdateScore(cand.id, 'scoreT', val)}
                                className={`w-6 h-6 rounded-lg text-xs font-display font-black transition cursor-pointer ${
                                  cand.scoreT === val
                                    ? 'bg-[#0E7490] text-[#FAF6EE] shadow-xs scale-110 ring-1 ring-[#0E7490]'
                                    : 'bg-white text-[#09251B]/60 hover:bg-[#E0F2FE]'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Reachable / Confirmed Checkboxes */}
                        <div className="pt-2 border-t border-[#09251B]/10 flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleToggleFlag(cand.id, 'reachable')}
                            className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-display font-bold flex items-center justify-center gap-1 cursor-pointer transition border ${
                              cand.reachable 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-gray-100 text-gray-600 border-gray-300'
                            }`}
                          >
                            <CheckSquare className="w-3 h-3" />
                            <span>Reachable: {cand.reachable ? 'Yes' : 'No'}</span>
                          </button>

                          <button
                            onClick={() => handleToggleFlag(cand.id, 'confirmed')}
                            className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-display font-bold flex items-center justify-center gap-1 cursor-pointer transition border ${
                              cand.confirmed 
                                ? 'bg-[#0D4734] text-[#FAF6EE] border-[#0D4734]'
                                : 'bg-gray-100 text-gray-600 border-gray-300'
                            }`}
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Confirmed: {cand.confirmed ? 'Yes' : 'No'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Total Score & Endorsement Button */}
                      <div className="flex flex-col items-center justify-center gap-2 border-t sm:border-t-0 sm:border-l border-[#09251B]/15 pt-3 sm:pt-0 sm:pl-4 w-full sm:w-auto">
                        <div className="text-center">
                          <span className="text-[10px] font-mono uppercase text-[#09251B]/60 block font-bold">Total Score</span>
                          <span className="font-display font-black text-2xl text-[#0D4734]">
                            {totalScore} <span className="text-xs text-[#09251B]/40 font-normal">/ 15</span>
                          </span>
                        </div>

                        <button
                          onClick={(e) => handleEndorse(e, cand.id)}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-display font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 border ${
                            isEndorsed
                              ? 'bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] text-[#09251B] border-amber-600'
                              : 'bg-white hover:bg-[#EBF3EF] text-[#0D4734] border-[#0D4734]/30'
                          }`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${isEndorsed ? 'fill-current' : ''}`} />
                          <span>{cand.votes} Votes</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Vacant Seat Empty State */
                  <div className="py-6 px-4 bg-[#FAF8F4] border-2 border-dashed border-[#09251B]/20 rounded-2xl text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-[#EBF3EF] text-[#0D4734] flex items-center justify-center mx-auto">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-sm text-[#09251B]">
                        Seat #{seat.seatNumber} is Currently Vacant
                      </h4>
                      <p className="text-xs text-[#09251B]/60 max-w-md mx-auto mt-1">
                        Recommended archetype: {seat.recommendedArchetype}
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenNominate(seat.seatNumber)}
                      className="bg-[#0D4734] hover:bg-[#125B43] text-[#FAF6EE] font-display font-black text-xs px-4 py-2 rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nominate a Jos Leader or Founder for Seat #{seat.seatNumber}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Association Legal Rules & Constitutional Principles */}
      <div className="bg-[#FAF8F4] border-2 border-[#09251B]/20 rounded-3xl p-6 sm:p-7 space-y-5">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-[#0D4734]" />
          <h3 className="font-display font-black text-lg text-[#09251B]">
            Official Selection Criteria & CAMA 2020 Statutory Guidelines
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-[#09251B]/15 rounded-2xl p-4 space-y-2">
            <h4 className="font-display font-black text-xs sm:text-sm text-[#09251B] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>The Reliability & Trust Non-Negotiable Rule</span>
            </h4>
            <p className="text-xs text-[#09251B]/80 leading-relaxed font-medium">
              <strong>RULE:</strong> Anyone who scores low on <strong>R (Reliable)</strong> or <strong>T (Trust under pressure)</strong> is <strong>OUT</strong> — no matter how impressive their resume or network. <strong>N (New Network)</strong> acts as the tiebreaker so you don't end up picking 12 of the exact same profile.
            </p>
          </div>

          <div className="bg-white border border-[#09251B]/15 rounded-2xl p-4 space-y-2">
            <h4 className="font-display font-black text-xs sm:text-sm text-[#09251B] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0D4734]" />
              <span>CAMA 2020 Section 826 Statutory Disqualifications</span>
            </h4>
            <p className="text-xs text-[#09251B]/80 leading-relaxed font-medium">
              Under Nigerian Companies and Allied Matters Act (CAMA 2020), a Trustee <strong>CANNOT</strong> be:
              <br />• Under 18 years of age
              <br />• Of unsound mind (as determined by a competent court)
              <br />• An undischarged bankrupt
              <br />• Convicted of fraud / dishonesty within the last 5 years
            </p>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-[#EBF3EF] to-[#DEF0E7] border border-[#0D4734]/30 rounded-2xl text-xs text-[#0D4734] font-medium flex items-center justify-between gap-4">
          <div>
            <strong>Constitutional 4 vs 8 Balance:</strong> Aim for 12 named trustees for reach + institutional legitimacy; the <strong>4 CORE seats</strong> run day-to-day operations. Build that split directly into the association's constitution.
          </div>
          <span className="font-display font-black text-xs uppercase px-3 py-1 bg-[#0D4734] text-[#FAF6EE] rounded-lg shrink-0">
            Give Before You Take
          </span>
        </div>
      </div>

      {/* 6. Nominate Candidate Modal */}
      {isNominateModalOpen && (
        <div className="fixed inset-0 bg-[#08291E]/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[#FAF8F4] border-3 border-[#09251B] rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-[#0D4734] text-[#FAF6EE] p-5 border-b-2 border-[#09251B] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-[#E5A93C] block">
                  Trustee Board Nomination
                </span>
                <h3 className="font-display font-black text-xl text-white">
                  {editingCandidate ? `Edit Nominee for Seat #${nominateForSeatNumber}` : `Nominate for Seat #${nominateForSeatNumber}: ${TRUSTEE_SEATS[nominateForSeatNumber - 1]?.title}`}
                </h3>
              </div>
              <button
                onClick={() => setIsNominateModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Pick from Checked-in Attendees */}
            {attendees.length > 0 && !editingCandidate && (
              <div className="bg-[#EBF3EF] border-b border-[#0D4734]/20 p-3.5">
                <span className="text-[11px] font-display font-black text-[#0D4734] block mb-2">
                  ⚡ Quick Nominate from Verified Attendees in the Room:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {attendees.slice(0, 8).map(att => (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => handleSelectAttendeeNominee(att)}
                      className="px-2.5 py-1 bg-white hover:bg-amber-50 text-[#09251B] border border-[#0D4734]/30 rounded-lg text-xs font-display font-bold whitespace-nowrap cursor-pointer transition shadow-xs"
                    >
                      + {att.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveNomination} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Seat Selector */}
                <div>
                  <label className="block text-xs font-display font-bold text-[#09251B] mb-1">
                    Select Target Seat
                  </label>
                  <select
                    value={nominateForSeatNumber}
                    onChange={(e) => setNominateForSeatNumber(Number(e.target.value))}
                    className="w-full bg-white border border-[#09251B]/20 rounded-xl px-3 py-2 text-xs font-display font-bold text-[#09251B] focus:outline-none focus:border-[#0D4734]"
                  >
                    {TRUSTEE_SEATS.map(s => (
                      <option key={s.seatNumber} value={s.seatNumber}>
                        Seat #{s.seatNumber} ({s.tier}) - {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Candidate Full Name */}
                <div>
                  <label className="block text-xs font-display font-bold text-[#09251B] mb-1">
                    Candidate Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Nanle Jerry / Samuel Adebayo"
                    className="w-full bg-white border border-[#09251B]/20 rounded-xl px-3 py-2 text-xs font-medium text-[#09251B] focus:outline-none focus:border-[#0D4734]"
                  />
                </div>
              </div>

              {/* Title & Organization */}
              <div>
                <label className="block text-xs font-display font-bold text-[#09251B] mb-1">
                  Title & Organization / Track Record
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. CEO @ AgriGrid / Dean of Computer Science @ Unijos"
                  className="w-full bg-white border border-[#09251B]/20 rounded-xl px-3 py-2 text-xs font-medium text-[#09251B] focus:outline-none focus:border-[#0D4734]"
                />
              </div>

              {/* Phone / Contact */}
              <div>
                <label className="block text-xs font-display font-bold text-[#09251B] mb-1">
                  Phone / Email / WhatsApp (For Official CAC Notice)
                </label>
                <input
                  type="text"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder="+234 803 000 0000 / email@plateau.org"
                  className="w-full bg-white border border-[#09251B]/20 rounded-xl px-3 py-2 text-xs font-medium text-[#09251B] focus:outline-none focus:border-[#0D4734]"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-display font-bold text-[#09251B] mb-1">
                  Bio / Justification & Board Value
                </label>
                <textarea
                  rows={2}
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Briefly state why this candidate fits this specific seat..."
                  className="w-full bg-white border border-[#09251B]/20 rounded-xl p-2.5 text-xs font-medium text-[#09251B] focus:outline-none focus:border-[#0D4734]"
                />
              </div>

              {/* The Test Scores (R, N, T 1 to 5) */}
              <div className="bg-white border border-[#09251B]/15 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-display font-black text-[#09251B] block">
                  The Test Scorecard (1 = Low, 5 = Exceptional):
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-display font-bold text-[#09251B] mb-1">
                      R - Reliable (1-5)
                    </label>
                    <select
                      value={formScoreR}
                      onChange={(e) => setFormScoreR(Number(e.target.value))}
                      className="w-full bg-[#FAF8F4] border border-[#09251B]/20 rounded-xl p-2 text-xs font-bold text-[#09251B]"
                    >
                      {[1, 2, 3, 4, 5].map(v => (
                        <option key={v} value={v}>{v} - {v >= 4 ? 'Very Reliable' : v === 3 ? 'Average' : 'Unreliable (Out)'}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-display font-bold text-[#09251B] mb-1">
                      N - New Network (1-5)
                    </label>
                    <select
                      value={formScoreN}
                      onChange={(e) => setFormScoreN(Number(e.target.value))}
                      className="w-full bg-[#FAF8F4] border border-[#09251B]/20 rounded-xl p-2 text-xs font-bold text-[#09251B]"
                    >
                      {[1, 2, 3, 4, 5].map(v => (
                        <option key={v} value={v}>{v} - {v >= 4 ? 'Unlocks New Doors' : v === 3 ? 'Moderate' : 'Same Network'}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-display font-bold text-[#09251B] mb-1">
                      T - Trust (1-5)
                    </label>
                    <select
                      value={formScoreT}
                      onChange={(e) => setFormScoreT(Number(e.target.value))}
                      className="w-full bg-[#FAF8F4] border border-[#09251B]/20 rounded-xl p-2 text-xs font-bold text-[#09251B]"
                    >
                      {[1, 2, 3, 4, 5].map(v => (
                        <option key={v} value={v}>{v} - {v >= 4 ? 'High Trust' : v === 3 ? 'Moderate' : 'Untested / Low (Out)'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* CAMA Statutory Checklist */}
              <div className="bg-white border border-[#09251B]/15 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-display font-black text-[#09251B] block">
                  CAMA 2020 Statutory Eligibility Checks:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCama18}
                      onChange={(e) => setFormCama18(e.target.checked)}
                      className="rounded border-[#09251B] text-[#0D4734] focus:ring-[#0D4734]"
                    />
                    <span>Candidate is 18 years of age or older</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCamaMind}
                      onChange={(e) => setFormCamaMind(e.target.checked)}
                      className="rounded border-[#09251B] text-[#0D4734] focus:ring-[#0D4734]"
                    />
                    <span>Candidate is of sound mind</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCamaBankrupt}
                      onChange={(e) => setFormCamaBankrupt(e.target.checked)}
                      className="rounded border-[#09251B] text-[#0D4734] focus:ring-[#0D4734]"
                    />
                    <span>Candidate is not an undischarged bankrupt</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCamaFraud}
                      onChange={(e) => setFormCamaFraud(e.target.checked)}
                      className="rounded border-[#09251B] text-[#0D4734] focus:ring-[#0D4734]"
                    />
                    <span>No fraud conviction in the last 5 years</span>
                  </label>
                </div>
              </div>

              {/* Reachable & Confirmed */}
              <div className="flex items-center gap-4 text-xs font-display font-bold">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formReachable}
                    onChange={(e) => setFormReachable(e.target.checked)}
                    className="rounded border-[#09251B] text-[#0D4734] focus:ring-[#0D4734]"
                  />
                  <span>Reachable (in touch with team)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formConfirmed}
                    onChange={(e) => setFormConfirmed(e.target.checked)}
                    className="rounded border-[#09251B] text-[#0D4734] focus:ring-[#0D4734]"
                  />
                  <span>Confirmed (Nomination accepted)</span>
                </label>
              </div>

              {/* Submit / Action */}
              <div className="pt-4 border-t border-[#09251B]/15 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNominateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-display font-bold text-[#09251B] bg-white hover:bg-gray-100 border border-[#09251B]/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-display font-black text-[#09251B] bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] hover:from-[#E5A93C] hover:to-[#D97706] shadow-xs cursor-pointer active:scale-95 transition"
                >
                  {editingCandidate ? 'Save Changes' : 'Submit Trustee Nomination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. CAMA Statutory Info Modal */}
      {isCamaInfoModalOpen && (
        <div className="fixed inset-0 bg-[#08291E]/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[#FAF8F4] border-3 border-[#09251B] rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden my-auto">
            <div className="bg-[#0D4734] text-white p-5 flex items-center justify-between border-b-2 border-[#09251B]">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#E5A93C]" />
                <h3 className="font-display font-black text-lg">
                  Trustee Selection Rules & Legal Framework
                </h3>
              </div>
              <button
                onClick={() => setIsCamaInfoModalOpen(false)}
                className="text-white/70 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs text-[#09251B]/85 leading-relaxed">
              <div className="space-y-2">
                <h4 className="font-display font-black text-sm text-[#09251B]">
                  1. The R-N-T Reliability, Network & Trust Test
                </h4>
                <p>
                  • <strong>R = Reliable (1-5):</strong> Will they sign CAC legal documents on time and respond to governance quorum deadlines?
                  <br />• <strong>N = New Network (1-5):</strong> Does this trustee unlock a door or ecosystem that the other 11 trustees do not?
                  <br />• <strong>T = Trust under pressure (1-5):</strong> Are they trusted to have their name on a legal corporate document when under stress?
                </p>
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 font-semibold">
                  RULE: Anyone who scores low on R (Reliable) or T (Trust) is OUT — no matter how impressive. N (New Network) is the tiebreaker so you don't pick 12 of the same person.
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#09251B]/15">
                <h4 className="font-display font-black text-sm text-[#09251B]">
                  2. CAMA 2020 Disqualification Criteria (Section 826)
                </h4>
                <p>
                  A person is legally disqualified from being appointed as an Incorporated Trustee in Nigeria if they are:
                  <br />1. Under the age of 18
                  <br />2. Found to be of unsound mind by a court of competent jurisdiction
                  <br />3. An undischarged bankrupt
                  <br />4. Convicted of an offence involving fraud or dishonesty within 5 years of proposed appointment
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#09251B]/15">
                <h4 className="font-display font-black text-sm text-[#09251B]">
                  3. The 12-Seat Quorum Structure
                </h4>
                <p>
                  • <strong>Core Tier (Seats 1-4):</strong> 4 founders/operators handling day-to-day governance and execution.
                  <br />• <strong>Credibility Tier (Seats 5-8):</strong> 4 established business, mentorship, and institutional leaders.
                  <br />• <strong>Bridges Tier (Seats 9-12):</strong> 4 leaders bridging non-tech SMEs, women founders, youth, and Plateau regional diversity.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-[#09251B]/15 text-right">
              <button
                onClick={() => setIsCamaInfoModalOpen(false)}
                className="bg-[#0D4734] text-white font-display font-bold text-xs px-5 py-2 rounded-xl"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
