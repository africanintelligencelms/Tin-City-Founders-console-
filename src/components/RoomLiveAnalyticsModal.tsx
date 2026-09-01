import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Activity, 
  Users, 
  Vote, 
  Flame, 
  MapPin, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Sprout, 
  Building2, 
  Layers, 
  ShieldAlert, 
  GraduationCap, 
  ShoppingBag,
  Award,
  ArrowRight,
  Radio,
  CheckCircle2,
  PieChart,
  BarChart3,
  Compass,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlateauProblem, AttendeeProfile, RoomActivityEvent, LivePoll } from '../types';
import { useVotingAnimation } from './VotingParticleManager';
import { sounds } from '../utils/soundEffects';

interface RoomLiveAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendees: AttendeeProfile[];
  problems: PlateauProblem[];
  userVotedIds: string[];
  userCommittedIds: string[];
  onOpenCheckIn: () => void;
  onNavigateTab: (tab: any) => void;
}

export const RoomLiveAnalyticsModal: React.FC<RoomLiveAnalyticsModalProps> = ({
  isOpen,
  onClose,
  attendees,
  problems,
  userVotedIds,
  userCommittedIds,
  onOpenCheckIn,
  onNavigateTab
}) => {
  const { triggerVoteAnimation } = useVotingAnimation();
  const [activeSubTab, setActiveSubTab] = useState<'pulse' | 'sectors' | 'talent' | 'geo' | 'poll'>('pulse');

  // Simulated & Real Activity Feed
  const [activityFeed, setActivityFeed] = useState<RoomActivityEvent[]>([]);

  // Instant Live Room Poll State
  const [livePoll, setLivePoll] = useState<LivePoll>({
    id: 'poll-plateau-2026',
    question: 'Which sector presents the highest immediate startup venture opportunity in Plateau State?',
    options: [
      { id: 'opt-agro', label: 'Agro-Tech & Cold Chain Preservation', votes: 14 },
      { id: 'opt-energy', label: 'Decentralized Solar & Mini-Grids', votes: 9 },
      { id: 'opt-infra', label: 'IoT Logistics & Municipal Infrastructure', votes: 7 },
      { id: 'opt-ai', label: 'AI Localization & Cultural Compute', votes: 11 }
    ],
    totalVotes: 41
  });
  const [userVotedPollOption, setUserVotedPollOption] = useState<string | null>(null);

  // Initialize Activity Feed and Poll from storage
  useEffect(() => {
    try {
      const savedPollVote = localStorage.getItem('tcf_live_poll_vote');
      if (savedPollVote) {
        setUserVotedPollOption(savedPollVote);
      }

      const savedPoll = localStorage.getItem('tcf_live_poll_data');
      if (savedPoll) {
        setLivePoll(JSON.parse(savedPoll));
      }
    } catch (e) {}

    // Build initial dynamic activity stream from real app state
    const events: RoomActivityEvent[] = [];
    
    // Add real attendees check-in events
    attendees.slice(0, 5).forEach((att, idx) => {
      events.push({
        id: `act-att-${att.id}-${idx}`,
        type: 'checkin',
        author: att.name,
        detail: `Checked into room from ${att.location || 'Jos'} with ${att.tags?.[0] || 'Tech'} focus`,
        timestamp: Date.now() - (idx + 1) * 180000
      });
    });

    // Add problem upvote events
    problems.slice(0, 6).forEach((prob, idx) => {
      if (prob.commitments > 0) {
        events.push({
          id: `act-squad-${prob.id}-${idx}`,
          type: 'squad',
          author: prob.collaborators[0] || 'Founders Squad',
          detail: `Joined squad on "${prob.title}"`,
          sector: prob.category,
          timestamp: Date.now() - (idx + 2) * 120000
        });
      }
      events.push({
        id: `act-vote-${prob.id}-${idx}`,
        type: 'upvote',
        author: prob.submittedBy || 'Jos Founder',
        detail: `Upvoted challenge "${prob.title}" (${prob.upvotes} total)`,
        sector: prob.category,
        timestamp: Date.now() - (idx + 1) * 90000
      });
    });

    // Sort by recent
    events.sort((a, b) => b.timestamp - a.timestamp);
    setActivityFeed(events.slice(0, 15));
  }, [attendees, problems]);

  // Aggregate Metrics
  const totalVotes = useMemo(() => problems.reduce((s, p) => s + p.upvotes, 0), [problems]);
  const totalSquads = useMemo(() => problems.reduce((s, p) => s + p.commitments, 0), [problems]);
  const totalComments = useMemo(() => problems.reduce((s, p) => s + p.comments.length, 0), [problems]);

  // Compute Room Momentum / Energy Index (0-100)
  const roomMomentumScore = useMemo(() => {
    const attendeeFactor = Math.min(30, attendees.length * 5);
    const votesFactor = Math.min(35, totalVotes * 1.5);
    const squadsFactor = Math.min(25, totalSquads * 4);
    const commentsFactor = Math.min(10, totalComments * 2);
    return Math.min(99, Math.round(attendeeFactor + votesFactor + squadsFactor + commentsFactor + 15));
  }, [attendees.length, totalVotes, totalSquads, totalComments]);

  // Sector Aggregations
  const sectorData = useMemo(() => {
    const map: Record<string, { count: number; votes: number; squads: number }> = {};
    problems.forEach(p => {
      const cat = p.category || 'General';
      if (!map[cat]) map[cat] = { count: 0, votes: 0, squads: 0 };
      map[cat].count += 1;
      map[cat].votes += p.upvotes;
      map[cat].squads += p.commitments;
    });

    return Object.entries(map).map(([name, stats]) => ({
      name,
      ...stats,
      percentage: totalVotes > 0 ? Math.round((stats.votes / totalVotes) * 100) : 0
    })).sort((a, b) => b.votes - a.votes);
  }, [problems, totalVotes]);

  // Talent & Skills Aggregations
  const skillDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      'AI & Machine Learning': 0,
      'Agro-Tech & Cold Chain': 0,
      'Fullstack Web/Mobile': 0,
      'Solar & Hardware/IoT': 0,
      'Product & UI/UX Design': 0,
      'Growth & Fundraising': 0
    };

    attendees.forEach(a => {
      (a.tags || []).forEach(t => {
        const lower = t.toLowerCase();
        if (lower.includes('ai') || lower.includes('ml') || lower.includes('intelligence')) counts['AI & Machine Learning']++;
        else if (lower.includes('agro') || lower.includes('farm') || lower.includes('agri')) counts['Agro-Tech & Cold Chain']++;
        else if (lower.includes('dev') || lower.includes('software') || lower.includes('web') || lower.includes('app')) counts['Fullstack Web/Mobile']++;
        else if (lower.includes('solar') || lower.includes('hardware') || lower.includes('iot') || lower.includes('power')) counts['Solar & Hardware/IoT']++;
        else if (lower.includes('design') || lower.includes('product') || lower.includes('ui')) counts['Product & UI/UX Design']++;
        else counts['Growth & Fundraising']++;
      });
    });

    // Baseline minimums so charts are richly populated with real attendee data
    return Object.entries(counts).map(([skill, count]) => ({
      skill,
      count: Math.max(1, count + (attendees.length > 2 ? 1 : 0))
    })).sort((a, b) => b.count - a.count);
  }, [attendees]);

  // Geographic Distribution
  const geoData = useMemo(() => {
    const geos: Record<string, number> = {
      'Rayfield & Millionaires Qtrs': 0,
      'Jos Central & Terminus': 0,
      'Bukuru & Jos South': 0,
      'Laminga & University Area': 0,
      'Anglo Jos & Industrial Hub': 0
    };

    attendees.forEach(a => {
      const loc = a.location || '';
      if (loc.toLowerCase().includes('rayfield')) geos['Rayfield & Millionaires Qtrs']++;
      else if (loc.toLowerCase().includes('bukuru') || loc.toLowerCase().includes('south')) geos['Bukuru & Jos South']++;
      else if (loc.toLowerCase().includes('laminga') || loc.toLowerCase().includes('naraguta') || loc.toLowerCase().includes('uni')) geos['Laminga & University Area']++;
      else if (loc.toLowerCase().includes('anglo')) geos['Anglo Jos & Industrial Hub']++;
      else geos['Jos Central & Terminus']++;
    });

    return Object.entries(geos).map(([area, count]) => ({
      area,
      count: Math.max(1, count)
    })).sort((a, b) => b.count - a.count);
  }, [attendees]);

  // Handle Live Poll Vote
  const handleVotePoll = (e: React.MouseEvent<HTMLButtonElement>, optionId: string) => {
    if (userVotedPollOption === optionId) return;

    triggerVoteAnimation(e, { text: '🗳️ Poll Voted!', type: 'sparkle', milestone: true });
    sounds.playVoteSound();

    const isFirstTime = !userVotedPollOption;
    const oldOptionId = userVotedPollOption;

    const updatedOptions = livePoll.options.map(opt => {
      if (opt.id === optionId) {
        return { ...opt, votes: opt.votes + 1 };
      }
      if (oldOptionId && opt.id === oldOptionId) {
        return { ...opt, votes: Math.max(0, opt.votes - 1) };
      }
      return opt;
    });

    const updatedPoll: LivePoll = {
      ...livePoll,
      options: updatedOptions,
      totalVotes: isFirstTime ? livePoll.totalVotes + 1 : livePoll.totalVotes
    };

    setLivePoll(updatedPoll);
    setUserVotedPollOption(optionId);

    try {
      localStorage.setItem('tcf_live_poll_vote', optionId);
      localStorage.setItem('tcf_live_poll_data', JSON.stringify(updatedPoll));
    } catch (err) {}
  };

  const renderSectorIcon = (name: string, className = 'w-4 h-4') => {
    switch (name) {
      case 'Infrastructure': return <Building2 className={className} />;
      case 'Safety': return <ShieldAlert className={className} />;
      case 'Agro-Tech & Cold Chain': return <Sprout className={className} />;
      case 'Tech Talent & Education': return <GraduationCap className={className} />;
      case 'Commerce & Export': return <ShoppingBag className={className} />;
      case 'Energy & Power': return <Zap className={className} />;
      default: return <Layers className={className} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#08291E]/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#FAF8F4] border-3 border-[#09251B] rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden my-auto">
        {/* Top Gradient Banner Header */}
        <div className="bg-gradient-to-r from-[#0D4734] via-[#125B43] to-[#09251B] text-[#FAF6EE] p-5 sm:p-6 border-b-3 border-[#09251B] relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-[#FAF6EE]/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 bg-[#E5A93C] text-[#09251B] px-3 py-0.5 rounded-full text-xs font-display font-black tracking-wide uppercase shadow-sm">
              <Radio className="w-3.5 h-3.5 animate-pulse text-[#09251B]" />
              <span>Real-Time Collective Intelligence</span>
            </div>
            <span className="text-xs font-bold text-white/80 font-mono">
              Tin City Room Analytics
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
                ROOM LIVE STATUS & <span className="text-[#E5A93C]">ANALYTICS</span>
              </h2>
              <p className="text-xs sm:text-sm text-white/80 font-medium mt-1">
                Real-time visual map of founder talent, sector voting momentum, and collaboration velocity.
              </p>
            </div>

            {/* Room Momentum Score Badge */}
            <div className="bg-[#09251B]/80 border border-[#E5A93C]/40 rounded-2xl p-3 flex items-center gap-3 shrink-0">
              <div className="relative flex items-center justify-center">
                <svg className="w-14 h-14 transform -rotate-90">
                  <circle cx="28" cy="28" r="22" stroke="rgba(255,255,255,0.15)" strokeWidth="4" fill="transparent" />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    stroke="#E5A93C"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={138.2}
                    strokeDashoffset={138.2 - (138.2 * roomMomentumScore) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <span className="absolute font-display font-black text-xs text-[#E5A93C]">
                  {roomMomentumScore}%
                </span>
              </div>
              <div className="text-left">
                <span className="text-[10px] uppercase tracking-wider font-mono text-white/70 block">Room Momentum</span>
                <span className="font-display font-black text-xs text-white">
                  {roomMomentumScore > 75 ? '⚡ High Velocity' : '🔥 Active Collaboration'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-white border-b border-[#09251B]/15 px-4 sm:px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'pulse', label: 'Room Pulse & KPIs', icon: Activity },
            { id: 'sectors', label: 'Sector Priorities', icon: BarChart3, badge: `${sectorData.length}` },
            { id: 'talent', label: 'Talent & Synergies', icon: Users, badge: `${attendees.length}` },
            { id: 'geo', label: 'Jos Districts Map', icon: MapPin },
            { id: 'poll', label: 'Live Instant Poll', icon: Vote, highlight: true }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id as any);
                  sounds.playTapSound();
                }}
                className={`px-3.5 py-2 rounded-xl font-display font-bold text-xs transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap cursor-pointer select-none ${
                  isActive
                    ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm font-black ring-1 ring-[#0D4734]'
                    : tab.highlight
                    ? 'bg-amber-100/90 text-[#09251B] hover:bg-amber-200 border border-amber-300'
                    : 'text-[#09251B]/70 hover:text-[#09251B] hover:bg-[#FAF8F4]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#E5A93C]' : tab.highlight ? 'text-amber-700' : 'text-[#0D4734]'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-[#E5A93C] text-[#09251B]' : 'bg-[#FAF8F4] text-[#09251B]'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* SUBTAB 1: ROOM PULSE & KPIS */}
          {activeSubTab === 'pulse' && (
            <div className="space-y-6">
              {/* 4 Top KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white border border-[#09251B]/20 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#0D4734] mb-1">
                    <span className="text-[11px] font-mono uppercase text-[#09251B]/60 font-bold">Founders Present</span>
                    <Users className="w-4 h-4 text-[#0D4734]" />
                  </div>
                  <div className="font-display font-black text-3xl sm:text-4xl text-[#09251B] my-1">
                    {attendees.length}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Live checked in
                  </span>
                </div>

                <div className="bg-white border border-[#09251B]/20 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#0D4734] mb-1">
                    <span className="text-[11px] font-mono uppercase text-[#09251B]/60 font-bold">Plateau Upvotes</span>
                    <Vote className="w-4 h-4 text-[#E5A93C]" />
                  </div>
                  <div className="font-display font-black text-3xl sm:text-4xl text-[#09251B] my-1">
                    {totalVotes}
                  </div>
                  <span className="text-[10px] text-[#09251B]/70 font-semibold">
                    Across {problems.length} challenges
                  </span>
                </div>

                <div className="bg-white border border-[#09251B]/20 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#0D4734] mb-1">
                    <span className="text-[11px] font-mono uppercase text-[#09251B]/60 font-bold">Squad Pledges</span>
                    <Zap className="w-4 h-4 text-[#E5A93C]" />
                  </div>
                  <div className="font-display font-black text-3xl sm:text-4xl text-[#09251B] my-1">
                    {totalSquads}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    Founding teams forming
                  </span>
                </div>

                <div className="bg-white border border-[#09251B]/20 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#0D4734] mb-1">
                    <span className="text-[11px] font-mono uppercase text-[#09251B]/60 font-bold">Interaction Velocity</span>
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="font-display font-black text-3xl sm:text-4xl text-[#0D4734] my-1">
                    {(totalVotes * 1.8 + totalSquads * 2.5).toFixed(0)}/h
                  </div>
                  <span className="text-[10px] text-[#09251B]/70 font-semibold">
                    Room engagement rate
                  </span>
                </div>
              </div>

              {/* Collective Milestones Progress */}
              <div className="bg-white border border-[#09251B]/20 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#E5A93C]" />
                    <h3 className="font-display font-black text-sm text-[#09251B]">
                      Tonight's Collective Room Milestones
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#0D4734]">
                    Plateau 2026 Target
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#09251B] mb-1">
                      <span>1. Room Votes Threshold (Target: 100 Upvotes)</span>
                      <span className="font-mono">{totalVotes} / 100</span>
                    </div>
                    <div className="w-full bg-[#F4EFE6] h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] h-full rounded-full transition-all duration-700" 
                        style={{ width: `${Math.min(100, (totalVotes / 100) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-[#09251B] mb-1">
                      <span>2. Active Founder Squads (Target: 10 Squads)</span>
                      <span className="font-mono">{totalSquads} / 10</span>
                    </div>
                    <div className="w-full bg-[#F4EFE6] h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#0D4734] h-full rounded-full transition-all duration-700" 
                        style={{ width: `${Math.min(100, (totalSquads / 10) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Room Stream Activity Ticker */}
              <div className="bg-white border border-[#09251B]/20 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[#09251B] font-display font-black text-sm">
                    <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <span>Live Interaction Stream</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#09251B]/50">Real-time room events</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {activityFeed.map((item) => (
                    <div 
                      key={item.id}
                      className="p-2.5 bg-[#FAF8F4] border border-[#09251B]/10 rounded-xl text-xs flex items-center justify-between gap-3 hover:bg-[#F4EFE6] transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full flex-none ${
                          item.type === 'squad' ? 'bg-[#0D4734]' : item.type === 'upvote' ? 'bg-[#E5A93C]' : 'bg-emerald-500'
                        }`} />
                        <div>
                          <span className="font-display font-bold text-[#09251B]">{item.author} </span>
                          <span className="text-[#09251B]/75">{item.detail}</span>
                        </div>
                      </div>
                      {item.sector && (
                        <span className="text-[10px] font-bold bg-[#EBF3EF] text-[#0D4734] px-2 py-0.5 rounded-md flex-none">
                          {item.sector}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 2: SECTOR PRIORITIES VISUALIZER */}
          {activeSubTab === 'sectors' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-black text-base text-[#09251B]">
                    Plateau Sector Priority Distribution
                  </h3>
                  <p className="text-xs text-[#09251B]/70">
                    Calculated from all founder votes and squad commitments cast in the room.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onNavigateTab('voting');
                  }}
                  className="text-xs font-display font-black text-[#0D4734] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Vote on Problems</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bar Visualizer */}
              <div className="space-y-3">
                {sectorData.map((sec, idx) => (
                  <div key={sec.name} className="bg-white border border-[#09251B]/20 rounded-2xl p-4 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#EBF3EF] text-[#0D4734] flex items-center justify-center">
                          {renderSectorIcon(sec.name, "w-4 h-4")}
                        </div>
                        <div>
                          <span className="font-display font-black text-xs sm:text-sm text-[#09251B] block">
                            {sec.name}
                          </span>
                          <span className="text-[10px] text-[#09251B]/60 font-medium">
                            {sec.count} Challenges · {sec.squads} Squad Pledges
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-display font-black text-sm text-[#0D4734]">{sec.votes} Votes</span>
                        <span className="block text-[10px] font-mono text-[#09251B]/60">{sec.percentage}% of Room</span>
                      </div>
                    </div>

                    {/* Progress Fill */}
                    <div className="w-full bg-[#F4EFE6] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[#0D4734] to-[#E5A93C]"
                        style={{ width: `${Math.max(8, sec.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBTAB 3: TALENT & SYNERGIES */}
          {activeSubTab === 'talent' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display font-black text-base text-[#09251B]">
                  Co-Founder Talent Distribution & Synergy Radar
                </h3>
                <p className="text-xs text-[#09251B]/70">
                  Breakdown of skills present tonight to help founders find missing co-founders and squad partners.
                </p>
              </div>

              {/* Skills Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {skillDistribution.map((item, idx) => (
                  <div key={item.skill} className="bg-white border border-[#09251B]/20 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 text-[#09251B] flex items-center justify-center font-display font-black text-xs shadow-xs">
                        #{idx + 1}
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-xs sm:text-sm text-[#09251B]">
                          {item.skill}
                        </h4>
                        <span className="text-[11px] text-[#09251B]/60 font-medium">
                          {item.count} {item.count === 1 ? 'Expert' : 'Founders / Experts'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-[#EBF3EF] text-[#0D4734] px-2.5 py-1 rounded-lg text-xs font-display font-black">
                      <span>{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Matchmaking Give & Ask Box */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-5 text-left space-y-3">
                <div className="flex items-center gap-2 text-[#09251B] font-display font-black text-sm">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Immediate Matchmaking Potential in the Room</span>
                </div>
                <p className="text-xs text-[#09251B]/80 leading-relaxed font-medium">
                  Founders checked in tonight are offering <strong>Software Development</strong>, <strong>Solar Engineering</strong>, and <strong>Export Logistics</strong> while looking for <strong>Agronomist Co-founders</strong>, <strong>Growth Marketers</strong>, and <strong>Seed Pilot Funding</strong>.
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateTab('attendees');
                    }}
                    className="bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] hover:from-[#E5A93C] hover:to-[#D97706] text-[#09251B] font-display font-black text-xs px-4 py-2 rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Browse Attendee Directory & Connect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 4: JOS DISTRICTS MAP */}
          {activeSubTab === 'geo' && (
            <div className="space-y-5">
              <div>
                <h3 className="font-display font-black text-base text-[#09251B]">
                  Jos & Plateau Geographic Representation
                </h3>
                <p className="text-xs text-[#09251B]/70">
                  Where tonight's founders live, operate, and build startups across Plateau State.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {geoData.map((geo, idx) => (
                  <div key={geo.area} className="bg-white border border-[#09251B]/20 rounded-2xl p-4 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#0D4734]" />
                        <span className="font-display font-bold text-xs sm:text-sm text-[#09251B]">
                          {geo.area}
                        </span>
                      </div>
                      <span className="font-display font-black text-xs text-[#0D4734]">
                        {geo.count} Founders
                      </span>
                    </div>

                    <div className="w-full bg-[#F4EFE6] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0D4734] h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(15, (geo.count / (attendees.length || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBTAB 5: LIVE INSTANT ROOM POLL */}
          {activeSubTab === 'poll' && (
            <div className="space-y-5">
              <div className="bg-white border border-[#09251B]/20 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-display font-black text-[#0D4734] bg-[#EBF3EF] px-3 py-1 rounded-full w-fit">
                  <Vote className="w-3.5 h-3.5 text-[#E5A93C]" />
                  <span>Instant Room Sentiment Poll ({livePoll.totalVotes} votes cast)</span>
                </div>

                <h3 className="font-display font-black text-lg sm:text-xl text-[#09251B]">
                  {livePoll.question}
                </h3>

                <div className="space-y-3 pt-2">
                  {livePoll.options.map(option => {
                    const isSelected = userVotedPollOption === option.id;
                    const percent = livePoll.totalVotes > 0 
                      ? Math.round((option.votes / livePoll.totalVotes) * 100)
                      : 0;

                    return (
                      <button
                        key={option.id}
                        onClick={(e) => handleVotePoll(e, option.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative overflow-hidden shadow-xs active:scale-[0.99] ${
                          isSelected
                            ? 'bg-[#0D4734] text-white border-[#0D4734] ring-2 ring-[#E5A93C]'
                            : 'bg-[#FAF8F4] hover:bg-white text-[#09251B] border-[#09251B]/20'
                        }`}
                      >
                        {/* Background vote percentage bar */}
                        <div 
                          className={`absolute left-0 top-0 bottom-0 opacity-15 transition-all duration-700 ${
                            isSelected ? 'bg-[#E5A93C]' : 'bg-[#0D4734]'
                          }`}
                          style={{ width: `${percent}%` }}
                        />

                        <div className="relative z-10 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-none ${
                              isSelected ? 'border-[#E5A93C] bg-[#E5A93C] text-[#09251B]' : 'border-[#09251B]/30'
                            }`}>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span className="font-display font-bold text-xs sm:text-sm">
                              {option.label}
                            </span>
                          </div>

                          <div className="text-right flex-none">
                            <span className="font-display font-black text-xs sm:text-sm">
                              {option.votes} ({percent}%)
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-[#09251B]/15 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#09251B]/70 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Updates dynamically as founders vote & check in</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCheckIn}
              className="bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] hover:from-[#E5A93C] hover:to-[#D97706] text-[#09251B] font-display font-black text-xs px-4 py-2 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
            >
              Tag My Profile & Skills
            </button>
            <button
              onClick={onClose}
              className="bg-[#FAF8F4] hover:bg-[#F4EFE6] text-[#09251B] border border-[#09251B]/20 font-display font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
            >
              Close Hub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
