import React, { useState, useEffect } from 'react';
import { PlateauProblem, AISolutionPlan, CategoryInfo, AttendeeProfile, TrusteeCandidate, MyVotes, ToastNotification } from '../types';
import { 
  ThumbsUp, Users, Plus, Sparkles, MessageSquare, Search, Filter, 
  MapPin, Tag, CheckCircle2, Bot, ArrowUpRight, Send, Loader2, X, Flame, Lightbulb,
  Building2, ShieldAlert, Layers, Sprout, GraduationCap, ShoppingBag, Zap, FolderKanban,
  BarChart2, Edit3, Trophy, ArrowRight, Scale
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { SeamlessProblemWizard } from './SeamlessProblemWizard';
import { useVotingAnimation } from './VotingParticleManager';
import { TrusteeSelectionVoting } from './TrusteeSelectionVoting';
import { hostFetch } from '../utils/hostKey';

interface ProblemVotingProps {
  problems: PlateauProblem[];
  onVote: (id: string, commit: boolean, name?: string) => Promise<void>;
  onAddProblem: (newProblem: { 
    title: string; 
    description: string; 
    category: string; 
    submittedBy: string; 
    skillsNeeded: string[];
    autoUpvote?: boolean;
    autoCommit?: boolean;
  }) => Promise<void>;
  onAddComment: (id: string, author: string, text: string) => Promise<void>;
  onUpdateProblemCategory: (problemId: string, newCategory: string) => Promise<void>;
  userVotedIds: string[];
  userCommittedIds: string[];
  currentProfile?: AttendeeProfile | null;
  attendees?: AttendeeProfile[];
  onNavigateTab?: (tab: any) => void;
  // Live server state (owned by App, fed by SSE)
  categories?: CategoryInfo[];
  trusteeCandidates?: TrusteeCandidate[];
  myVotes?: MyVotes;
  onMyVotesChange?: (mine: MyVotes) => void;
  onNotify?: (toast: Omit<ToastNotification, 'id'>) => void;
}

export const PREDEFINED_CATEGORIES = [
  'Infrastructure',
  'Safety',
  'Services',
  'Agro-Tech & Cold Chain',
  'Tech Talent & Education',
  'Commerce & Export',
  'Energy & Power'
];

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Infrastructure': 'Roads, transit hubs, internet mesh grids & physical facility access across Jos and Plateau State.',
  'Safety': 'Community security networks, rapid emergency alerts, streetlight power & verified identity systems.',
  'Services': 'Public health access, waste management, municipal tools & digital civic administration for citizens.',
  'Agro-Tech & Cold Chain': 'Solar cold storage, farmer-to-market logistics, soil telemetry & crop preservation in Bokkos/Vom.',
  'Tech Talent & Education': 'University incubators (Unijos/PLASU), developer bootcamps & industry mentorship pipelines.',
  'Commerce & Export': 'Gemstone lapidary exports, artisan escrow, cross-border payment gateways & local trade platforms.',
  'Energy & Power': 'Off-grid renewable power systems, solar micro-grids & battery swap infrastructure for businesses.'
};

export const ProblemVoting: React.FC<ProblemVotingProps> = ({
  problems,
  onVote,
  onAddProblem,
  onAddComment,
  onUpdateProblemCategory,
  userVotedIds,
  userCommittedIds,
  currentProfile,
  attendees = [],
  onNavigateTab,
  categories: liveCategories,
  trusteeCandidates,
  myVotes,
  onMyVotesChange,
  onNotify,
}) => {
  const { triggerVoteAnimation } = useVotingAnimation();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'votes' | 'commitments' | 'newest'>('votes');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // View mode toggle: problems | trustees | categories
  const [dashboardViewMode, setDashboardViewMode] = useState<'problems' | 'trustees' | 'categories'>('problems');

  // Categories list & voting
  const [categoriesList, setCategoriesList] = useState<CategoryInfo[]>([
    { name: 'Infrastructure', upvotes: 38, description: CATEGORY_DESCRIPTIONS['Infrastructure'], iconName: 'Building2' },
    { name: 'Safety', upvotes: 45, description: CATEGORY_DESCRIPTIONS['Safety'], iconName: 'ShieldAlert' },
    { name: 'Services', upvotes: 29, description: CATEGORY_DESCRIPTIONS['Services'], iconName: 'Layers' },
    { name: 'Agro-Tech & Cold Chain', upvotes: 52, description: CATEGORY_DESCRIPTIONS['Agro-Tech & Cold Chain'], iconName: 'Sprout' },
    { name: 'Tech Talent & Education', upvotes: 41, description: CATEGORY_DESCRIPTIONS['Tech Talent & Education'], iconName: 'GraduationCap' },
    { name: 'Commerce & Export', upvotes: 33, description: CATEGORY_DESCRIPTIONS['Commerce & Export'], iconName: 'ShoppingBag' },
    { name: 'Energy & Power', upvotes: 36, description: CATEGORY_DESCRIPTIONS['Energy & Power'], iconName: 'Zap' }
  ]);
  const [userVotedCategories, setUserVotedCategories] = useState<string[]>([]);

  // Live sector counts pushed from the server beat the mount-time fetch
  useEffect(() => {
    if (liveCategories && liveCategories.length > 0) setCategoriesList(liveCategories);
  }, [liveCategories]);

  // Once the server has told us who we are, it also knows which sectors we prioritized
  useEffect(() => {
    if (!myVotes?.voterId) return;
    setUserVotedCategories(myVotes.categories);
    try {
      localStorage.setItem('tcf_voted_categories', JSON.stringify(myVotes.categories));
    } catch (e) {}
  }, [myVotes?.voterId, myVotes?.categories]);

  // Modals & Active State
  const [isSubmitOpen, setIsSubmitOpen] = useState<boolean>(false);
  const [activeProblem, setActiveProblem] = useState<PlateauProblem | null>(null);
  const [activeTabDetail, setActiveTabDetail] = useState<'discussion' | 'collaborators' | 'aiPlan'>('discussion');
  const [assigningCategoryProblemId, setAssigningCategoryProblemId] = useState<string | null>(null);

  // Commit / Join Squad State
  const [commitName, setCommitName] = useState(currentProfile?.name || '');
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [targetProblemForCommit, setTargetProblemForCommit] = useState<PlateauProblem | null>(null);

  // Comment Form State
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState(currentProfile?.name || '');

  // Update defaults if currentProfile changes
  useEffect(() => {
    if (currentProfile) {
      if (!commitName) setCommitName(currentProfile.name);
      if (!commentAuthor) setCommentAuthor(currentProfile.name);
    }
  }, [currentProfile]);

  // AI Roadmap State
  const [aiPlanMap, setAiPlanMap] = useState<Record<string, AISolutionPlan>>({});
  const [loadingAiId, setLoadingAiId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Fetch Categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.categories)) {
            setCategoriesList(data.categories);
          }
        }
      } catch (err) {
        console.error('Failed to fetch categories from server:', err);
      }
    };

    fetchCategories();

    try {
      const savedCategoryVotes = localStorage.getItem('tcf_voted_categories');
      if (savedCategoryVotes) {
        setUserVotedCategories(JSON.parse(savedCategoryVotes));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Filter category dropdown list
  const categoryFilterOptions = ['All', ...PREDEFINED_CATEGORIES];

  // Category Icon Renderer
  const renderCategoryIcon = (categoryName: string, className: string = 'w-5 h-5') => {
    switch (categoryName) {
      case 'Infrastructure':
        return <Building2 className={`${className} text-[#0D4734]`} />;
      case 'Safety':
        return <ShieldAlert className={`${className} text-[#C85A28]`} />;
      case 'Services':
        return <Layers className={`${className} text-[#0D4734]`} />;
      case 'Agro-Tech & Cold Chain':
        return <Sprout className={`${className} text-[#166E52]`} />;
      case 'Tech Talent & Education':
        return <GraduationCap className={`${className} text-[#0D4734]`} />;
      case 'Commerce & Export':
        return <ShoppingBag className={`${className} text-[#BF7E1D]`} />;
      case 'Energy & Power':
        return <Zap className={`${className} text-[#E5A93C]`} />;
      default:
        return <FolderKanban className={`${className} text-[#0D4734]`} />;
    }
  };

  // Vote on Category Sector
  const handleVoteCategory = async (e: React.MouseEvent<HTMLButtonElement>, categoryName: string) => {
    const isVoted = userVotedCategories.includes(categoryName);
    triggerVoteAnimation(e, {
      text: isVoted ? '-1 Sector' : '⚡ +1 Sector',
      type: 'category',
      milestone: !isVoted
    });

    const updatedVoted = isVoted
      ? userVotedCategories.filter(c => c !== categoryName)
      : [...userVotedCategories, categoryName];

    setUserVotedCategories(updatedVoted);
    try {
      localStorage.setItem('tcf_voted_categories', JSON.stringify(updatedVoted));
    } catch (e) {}

    // Local optimistic update
    setCategoriesList(prev => prev.map(c => {
      if (c.name === categoryName) {
        return {
          ...c,
          upvotes: isVoted ? Math.max(0, c.upvotes - 1) : c.upvotes + 1
        };
      }
      return c;
    }));

    try {
      const res = await fetch(
        `/api/categories/${encodeURIComponent(categoryName)}/vote`,
        isVoted
          ? { method: 'DELETE' }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ increment: true })
            }
      );
      const data = await res.json().catch(() => null);

      // Server truth wins, whatever the verdict
      if (data?.categories && Array.isArray(data.categories)) setCategoriesList(data.categories);
      if (data?.myVotes && onMyVotesChange) onMyVotesChange(data.myVotes);

      if (res.status === 409 && onNotify) {
        onNotify({
          type: 'info',
          title: 'Sector vote already counted',
          message: data?.message || `This device has already prioritized ${categoryName}.`,
          duration: 3500
        });
      }
    } catch (err) {
      console.error('Server category vote failed:', err);
    }
  };

  // Assign category to problem
  const handleAssignCategory = async (problemId: string, newCategoryName: string) => {
    await onUpdateProblemCategory(problemId, newCategoryName);
    setAssigningCategoryProblemId(null);
  };

  // Filtering & Sorting problems
  const filteredProblems = problems.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.submittedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.skillsNeeded.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'votes') return b.upvotes - a.upvotes;
    if (sortBy === 'commitments') return b.commitments - a.commitments;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Calculate total category upvotes for progress bars
  const totalCategoryUpvotes = categoriesList.reduce((sum, c) => sum + c.upvotes, 0) || 1;

  // Sorted Categories by upvotes
  const sortedCategories = [...categoriesList].sort((a, b) => b.upvotes - a.upvotes);

  // Handle Commit modal submit
  const handleConfirmCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProblemForCommit) return;
    
    await onVote(targetProblemForCommit.id, true, commitName.trim() || 'Jos Innovator');
    setIsCommitModalOpen(false);
    setTargetProblemForCommit(null);
  };

  // Handle Comment submit
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProblem || !commentText.trim()) return;

    await onAddComment(activeProblem.id, commentAuthor || 'Jos Founder', commentText);
    setCommentText('');
    
    const updatedProblem = problems.find(p => p.id === activeProblem.id);
    if (updatedProblem) {
      setActiveProblem({ ...updatedProblem });
    }
  };

  // Trigger Gemini AI Action Plan Generation
  const generateAiPlan = async (problem: PlateauProblem) => {
    if (aiPlanMap[problem.id]) {
      setActiveProblem(problem);
      setActiveTabDetail('aiPlan');
      return;
    }

    setLoadingAiId(problem.id);
    setAiError(null);
    try {
      const res = await hostFetch('/api/generate-solution-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemTitle: problem.title,
          problemDescription: problem.description,
          category: problem.category
        })
      });

      const data = await res.json();
      if (data.success && data.plan) {
        setAiPlanMap(prev => ({ ...prev, [problem.id]: data.plan }));
        setActiveProblem(problem);
        setActiveTabDetail('aiPlan');
      } else {
        setAiError(data.error || 'Failed to generate plan. Ensure GEMINI_API_KEY is configured.');
      }
    } catch (err: any) {
      console.error(err);
      setAiError('Connection error while contacting Gemini AI.');
    } finally {
      setLoadingAiId(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Hero Banner Section */}
      <div className="bg-white border-4 border-[#09251B] rounded-3xl p-6 sm:p-10 mb-8 shadow-[8px_8px_0px_0px_#09251B] relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
          <Flame className="w-80 h-80 text-[#0D4734]" />
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <span className="font-display font-black tracking-wider text-xs sm:text-sm text-[#09251B] bg-[#E5A93C] border-2 border-[#09251B] px-3.5 py-1 rounded-full uppercase shadow-[2px_2px_0px_0px_#09251B]">
              PLATEAU PROBLEMS & SECTOR PRIORITIES
            </span>
            <span className="text-xs font-bold text-[#09251B] flex items-center gap-1 font-mono bg-[#FAF8F4] border border-[#09251B]/30 px-3 py-1 rounded-full">
              <MapPin className="w-3.5 h-3.5 text-[#0D4734]" /> JOS & BOKKOS & RAYFIELD ECOSYSTEM
            </span>
          </div>

          <h1 className="font-display font-black text-3xl sm:text-5xl text-[#09251B] leading-tight mb-4">
            Vote on Categories & Problems. <span className="text-[#0D4734] underline decoration-[#E5A93C] decoration-8">Drive Real Impact.</span>
          </h1>

          <p className="text-base sm:text-lg text-[#09251B]/80 max-w-3xl leading-relaxed mb-6 font-medium">
            Categorize reported challenges into key Plateau sectors like <strong>Infrastructure</strong>, <strong>Safety</strong>, and <strong>Services</strong>. Vote on overarching categories to prioritize community resources, or vote on individual problems to form founder squads.
          </p>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              onClick={() => setIsSubmitOpen(true)}
              className="bg-gradient-to-r from-[#F59E0B] via-[#E5A93C] to-[#D97706] hover:from-[#E5A93C] hover:to-[#B45309] text-[#09251B] font-display font-black tracking-wide text-xs sm:text-sm px-5 sm:px-6 py-3 sm:py-3.5 rounded-2xl border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] hover:shadow-[4px_4px_0px_0px_#09251B] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] transition-all duration-150 flex items-center gap-2 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-[#09251B] text-[#FAF6EE] flex items-center justify-center flex-none">
                <Plus className="w-4 h-4 stroke-[3] text-[#E5A93C]" />
              </div>
              <span>Submit & Categorize Problem</span>
            </button>

            <div className="inline-flex flex-wrap items-center p-1 bg-[#F4EFE6]/90 border border-[#09251B]/20 rounded-2xl shadow-inner gap-1">
              <button
                onClick={() => setDashboardViewMode('problems')}
                className={`font-display font-black text-xs sm:text-sm px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                  dashboardViewMode === 'problems'
                    ? 'bg-[#0D4734] text-[#FAF6EE] shadow-md shadow-[#0D4734]/30 ring-1 ring-[#0D4734]'
                    : 'text-[#09251B]/75 hover:text-[#09251B] hover:bg-white/80'
                }`}
              >
                <Flame className={`w-4 h-4 ${dashboardViewMode === 'problems' ? 'text-[#E5A93C]' : 'text-amber-600'}`} />
                <span>Problems ({problems.length})</span>
              </button>

              <button
                onClick={() => setDashboardViewMode('trustees')}
                className={`font-display font-black text-xs sm:text-sm px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                  dashboardViewMode === 'trustees'
                    ? 'bg-[#0D4734] text-[#FAF6EE] shadow-md shadow-[#0D4734]/30 ring-1 ring-[#0D4734]'
                    : 'text-[#09251B]/75 hover:text-[#09251B] hover:bg-white/80'
                }`}
              >
                <Scale className={`w-4 h-4 ${dashboardViewMode === 'trustees' ? 'text-[#E5A93C]' : 'text-[#0D4734]'}`} />
                <span>Trustees Grid</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#E5A93C] text-[#09251B] text-[10px] font-black">
                  12 Seats
                </span>
              </button>

              <button
                onClick={() => setDashboardViewMode('categories')}
                className={`font-display font-black text-xs sm:text-sm px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                  dashboardViewMode === 'categories'
                    ? 'bg-[#0D4734] text-[#FAF6EE] shadow-md shadow-[#0D4734]/30 ring-1 ring-[#0D4734]'
                    : 'text-[#09251B]/75 hover:text-[#09251B] hover:bg-white/80'
                }`}
              >
                <BarChart2 className={`w-4 h-4 ${dashboardViewMode === 'categories' ? 'text-[#E5A93C]' : 'text-emerald-700'}`} />
                <span>Sectors ({categoriesList.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: OVERARCHING CATEGORIES PRIORITY LEADERBOARD */}
      {dashboardViewMode === 'categories' && (
        <div className="mb-12">
          <div className="bg-white border-4 border-[#09251B] rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_#09251B] mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-display font-black text-[#09251B] bg-[#E5A93C] border border-[#09251B] px-3 py-1 rounded-full uppercase shadow-[1px_1px_0px_0px_#09251B]">
                  OVERARCHING SECTOR VOTING
                </span>
                <h2 className="font-display font-black text-2xl sm:text-3xl text-[#09251B] mt-2">
                  Category Priority Leaderboard
                </h2>
                <p className="text-sm font-medium text-[#09251B]/70">
                  Vote directly on overarching categories (Infrastructure, Safety, Services, etc.) to signal where founders and government partners should focus first in Jos.
                </p>
              </div>

              <div className="bg-[#FEF7EB] border-2 border-[#09251B] rounded-2xl p-4 text-center flex-none shadow-[2px_2px_0px_0px_#09251B]">
                <span className="text-[10px] font-display font-black text-[#0D4734] uppercase block">Total Sector Votes</span>
                <span className="font-display font-black text-3xl text-[#09251B]">{totalCategoryUpvotes}</span>
              </div>
            </div>

            {/* Category Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sortedCategories.map((cat, rank) => {
                const isVoted = userVotedCategories.includes(cat.name);
                const problemCount = problems.filter(p => p.category === cat.name).length;
                const percentage = Math.round((cat.upvotes / totalCategoryUpvotes) * 100);

                return (
                  <div
                    key={cat.name}
                    className={`bg-white border-3 border-[#09251B] rounded-2xl p-5 transition-all flex flex-col justify-between shadow-[4px_4px_0px_0px_#09251B] hover:shadow-[6px_6px_0px_0px_#09251B] relative ${
                      rank === 0 ? 'ring-2 ring-[#E5A93C] bg-[#FEF7EB]/40' : ''
                    }`}
                  >
                    <div>
                      {/* Rank & Badge Header */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-lg font-display font-black text-xs flex items-center justify-center border border-[#09251B] ${
                            rank === 0 ? 'bg-[#E5A93C] text-[#09251B]' :
                            rank === 1 ? 'bg-[#FAF8F4] text-[#09251B]' :
                            rank === 2 ? 'bg-[#EBF3EF] text-[#0D4734]' :
                            'bg-[#FAF8F4] text-[#09251B]/60'
                          }`}>
                            #{rank + 1}
                          </span>
                          <span className="p-1.5 bg-[#FAF8F4] border border-[#09251B]/20 rounded-xl">
                            {renderCategoryIcon(cat.name)}
                          </span>
                        </div>

                        {rank === 0 && (
                          <span className="text-[10px] font-display font-black tracking-wider bg-[#E5A93C] text-[#09251B] border border-[#09251B] px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase">
                            <Trophy className="w-3 h-3 stroke-[2.5]" /> Top Sector
                          </span>
                        )}
                      </div>

                      <h3 className="font-display font-black text-lg text-[#09251B] mb-1 leading-snug">
                        {cat.name}
                      </h3>

                      <p className="text-xs text-[#09251B]/70 font-medium mb-4 leading-relaxed min-h-[36px]">
                        {cat.description || CATEGORY_DESCRIPTIONS[cat.name] || 'Community reported challenges in Plateau.'}
                      </p>

                      {/* Problem Count & Upvote Ratio */}
                      <div className="mb-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono font-bold text-[#09251B]">
                          <span>{problemCount} Reported Problems</span>
                          <span className="text-[#0D4734]">{percentage}% Priority</span>
                        </div>
                        <div className="w-full bg-[#FAF8F4] h-2.5 rounded-full overflow-hidden border border-[#09251B]/30">
                          <div
                            className="bg-[#0D4734] h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(5, percentage)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-[#09251B]/15 flex items-center justify-between gap-2.5">
                      <button
                        onClick={(e) => handleVoteCategory(e, cat.name)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-display font-black tracking-wide transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer border ${
                          isVoted
                            ? 'bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] text-[#09251B] border-amber-600 shadow-sm'
                            : 'bg-white hover:bg-[#F4EFE6] text-[#09251B] border-[#09251B]/20 hover:border-[#09251B]/40 shadow-xs'
                        } active:scale-95`}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${isVoted ? 'fill-current text-[#09251B]' : 'text-[#0D4734]'}`} />
                        <span>{cat.upvotes} {cat.upvotes === 1 ? 'Vote' : 'Votes'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedCategory(cat.name);
                          setDashboardViewMode('problems');
                        }}
                        className="py-2 px-3.5 rounded-xl bg-[#0D4734] hover:bg-[#125B43] text-[#FAF6EE] font-display font-bold text-xs transition-all duration-200 shadow-xs hover:shadow-sm cursor-pointer flex items-center gap-1 active:scale-95"
                        title={`View all problems assigned to ${cat.name}`}
                      >
                        <span>View ({problemCount})</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: FOUNDING TRUSTEES SELECTION MATRIX (CAMA 2020) */}
      {dashboardViewMode === 'trustees' && (
        <div className="mb-12">
          <TrusteeSelectionVoting
            attendees={attendees}
            currentProfile={currentProfile}
            onNavigateTab={onNavigateTab}
            liveCandidates={trusteeCandidates}
            endorsedIds={myVotes?.voterId ? myVotes.trustees : undefined}
            onMyVotesChange={onMyVotesChange}
            onNotify={onNotify}
          />
        </div>
      )}

      {/* VIEW MODE 3: PROBLEM STATEMENTS LIST */}
      {dashboardViewMode === 'problems' && (
        <>
          {/* Filter & Search Bar */}
          <div id="problem-list" className="bg-white border-2 border-[#09251B]/25 rounded-2xl p-4 sm:p-5 mb-8 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0D4734]/60" />
              <input
                type="text"
                placeholder="Search problems by keyword, sector, skill, or area (e.g. Infrastructure, Safety)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F4] border border-[#09251B]/20 focus:border-[#0D4734] focus:bg-white rounded-xl text-xs sm:text-sm font-semibold text-[#09251B] placeholder-[#09251B]/40 focus:outline-none focus:ring-2 focus:ring-[#0D4734]/20 transition-all"
              />
            </div>

            {/* Categories Pills & Sort */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 md:pb-0">
              <div className="flex items-center gap-1.5 flex-none">
                <Filter className="w-3.5 h-3.5 text-[#0D4734]" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-[#FAF8F4] hover:bg-[#F4EFE6] text-[#09251B] text-xs border border-[#09251B]/25 rounded-xl px-3 py-2 font-display font-bold tracking-wide focus:outline-none focus:border-[#09251B] cursor-pointer transition shadow-xs"
                >
                  {categoryFilterOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 flex-none bg-[#F4EFE6]/90 border border-[#09251B]/15 rounded-xl p-1 text-xs font-display font-bold shadow-inner">
                <button
                  onClick={() => setSortBy('votes')}
                  className={`px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${sortBy === 'votes' ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm font-extrabold' : 'text-[#09251B]/70 hover:text-[#09251B] hover:bg-white/60'}`}
                >
                  Top Voted
                </button>
                <button
                  onClick={() => setSortBy('commitments')}
                  className={`px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${sortBy === 'commitments' ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm font-extrabold' : 'text-[#09251B]/70 hover:text-[#09251B] hover:bg-white/60'}`}
                >
                  Squad Size
                </button>
                <button
                  onClick={() => setSortBy('newest')}
                  className={`px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${sortBy === 'newest' ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm font-extrabold' : 'text-[#09251B]/70 hover:text-[#09251B] hover:bg-white/60'}`}
                >
                  Newest
                </button>
              </div>
            </div>
          </div>

          {/* Problems List Grid */}
          {filteredProblems.length === 0 ? (
            <div className="text-center py-16 bg-white border-4 border-[#09251B] rounded-3xl p-8 shadow-[6px_6px_0px_0px_#09251B]">
              <Lightbulb className="w-14 h-14 text-[#E5A93C] mx-auto mb-4" />
              <h3 className="font-display font-black text-2xl text-[#09251B] mb-2">No Plateau Problems Found</h3>
              <p className="text-sm font-medium text-[#09251B]/70 mb-6 max-w-md mx-auto">
                No challenges match your search or filter criteria. Be the first to add one for Jos founders!
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setIsSubmitOpen(true); }}
                className="bg-[#0D4734] text-[#FAF6EE] font-display font-black text-sm px-6 py-3 rounded-xl border-2 border-[#09251B] shadow-[3px_3px_0px_0px_#09251B] hover:bg-[#125B43] transition cursor-pointer"
              >
                Submit New Problem Statement
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredProblems.map((prob) => {
                const hasVoted = userVotedIds.includes(prob.id);
                const hasCommitted = userCommittedIds.includes(prob.id);
                const isEditingCategory = assigningCategoryProblemId === prob.id;

                return (
                  <div
                    key={prob.id}
                    className="bg-white border-3 border-[#09251B] rounded-3xl p-6 hover:shadow-[8px_8px_0px_0px_#09251B] transition-all flex flex-col justify-between shadow-[4px_4px_0px_0px_#09251B] group relative overflow-hidden"
                  >
                    {/* Status & Category Indicator Header */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        {/* Category Badge with Interactive Category Quick-Switch Popover */}
                        <div className="relative">
                          {isEditingCategory ? (
                            <div className="absolute top-0 left-0 z-30 bg-white border-3 border-[#09251B] p-3 rounded-2xl shadow-[6px_6px_0px_0px_#09251B] min-w-[260px] animate-in fade-in zoom-in-95 duration-150">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#09251B]/15">
                                <span className="text-[10px] font-display font-black text-[#0D4734] uppercase tracking-wider">
                                  Assign Sector
                                </span>
                                <button
                                  onClick={() => setAssigningCategoryProblemId(null)}
                                  className="text-[#09251B]/60 hover:text-[#09251B] p-0.5 rounded cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="space-y-1">
                                {PREDEFINED_CATEGORIES.map(catName => (
                                  <button
                                    key={catName}
                                    type="button"
                                    onClick={() => handleAssignCategory(prob.id, catName)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                                      prob.category === catName
                                        ? 'bg-[#0D4734] text-[#FAF6EE]'
                                        : 'hover:bg-[#EBF3EF] text-[#09251B]'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2">
                                      {renderCategoryIcon(catName, "w-3.5 h-3.5")}
                                      <span>{catName}</span>
                                    </span>
                                    {prob.category === catName && <CheckCircle2 className="w-3.5 h-3.5 text-[#E5A93C]" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssigningCategoryProblemId(prob.id)}
                              className="text-[11px] font-display font-black tracking-wider bg-[#EBF3EF] text-[#0D4734] border border-[#0D4734]/40 px-3 py-1 rounded-full uppercase flex items-center gap-1.5 hover:bg-[#D5E5DE] transition cursor-pointer shadow-[1px_1px_0px_0px_#09251B]"
                              title="Click to quickly reassign sector for this problem"
                            >
                              {renderCategoryIcon(prob.category, "w-3.5 h-3.5")}
                              <span>{prob.category}</span>
                              <Edit3 className="w-3 h-3 text-[#0D4734] opacity-60 group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                        
                        <span className={`text-[10px] font-display font-black tracking-wider px-2.5 py-1 rounded-full uppercase border-2 border-[#09251B] ${
                          prob.status === 'Active Squad' ? 'bg-[#E5A93C] text-[#09251B]' :
                          prob.status === 'Prototype Built' ? 'bg-[#FAF8F4] text-[#09251B]' :
                          prob.status === 'Squad Forming' ? 'bg-[#EBF3EF] text-[#0D4734]' :
                          'bg-[#FAF8F4] text-[#09251B]/70 border-[#09251B]/30'
                        }`}>
                          {prob.status}
                        </span>
                      </div>

                      {/* Problem Content */}
                      <h3 className="font-display font-black text-xl sm:text-2xl text-[#09251B] mb-2 leading-snug group-hover:text-[#0D4734] transition">
                        {prob.title}
                      </h3>
                      
                      <p className="text-sm text-[#09251B]/70 font-medium line-clamp-3 mb-4 leading-relaxed">
                        {prob.description}
                      </p>

                      {/* Skills tags */}
                      {prob.skillsNeeded && prob.skillsNeeded.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {prob.skillsNeeded.map((skill, i) => (
                            <span key={i} className="text-[11px] font-bold bg-[#FAF8F4] text-[#0D4734] border border-[#0D4734]/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <Tag className="w-3 h-3 text-[#E5A93C]" /> {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-[11px] text-[#09251B]/60 mb-5 flex items-center justify-between font-mono font-bold">
                        <span>Submitted by: <strong className="text-[#09251B]">{prob.submittedBy}</strong></span>
                        <span className="text-[#0D4734] bg-[#EBF3EF] px-2 py-0.5 rounded border border-[#0D4734]/30">{prob.collaborators.length} Squad Members</span>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-3.5 border-t border-[#09251B]/15 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Upvote Button */}
                        <button
                          onClick={(e) => {
                            triggerVoteAnimation(e, {
                              text: hasVoted ? '-1 Vote' : '+1 Upvote!',
                              type: 'upvote',
                              milestone: !hasVoted && (prob.upvotes >= 4 || prob.upvotes % 5 === 0)
                            });
                            onVote(prob.id, false);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-display font-black tracking-wide transition-all duration-150 flex items-center gap-1.5 cursor-pointer border ${
                            hasVoted
                              ? 'bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] text-[#09251B] border-amber-600 shadow-sm'
                              : 'bg-white hover:bg-[#F4EFE6] text-[#09251B] border-[#09251B]/25 hover:border-[#09251B]/40 shadow-xs'
                          } active:scale-95`}
                          title={hasVoted ? "You upvoted this problem" : "Upvote this Plateau Problem"}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-current text-[#09251B]' : 'text-[#0D4734]'}`} />
                          <span>{prob.upvotes}</span>
                        </button>

                        {/* Join / Commit Squad Button */}
                        <button
                          onClick={(e) => {
                            triggerVoteAnimation(e, {
                              text: '⚡ Squad Formation',
                              type: 'squad',
                              milestone: true
                            });
                            setTargetProblemForCommit(prob);
                            setIsCommitModalOpen(true);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-display font-black tracking-wide transition-all duration-150 flex items-center gap-1.5 cursor-pointer border ${
                            hasCommitted
                              ? 'bg-[#EBF3EF] text-[#0D4734] border-[#0D4734]/30 shadow-xs'
                              : 'bg-[#0D4734] hover:bg-[#125B43] text-[#FAF6EE] border-[#09251B] shadow-sm hover:shadow-md'
                          } active:scale-95`}
                        >
                          <Users className="w-3.5 h-3.5 text-[#E5A93C]" />
                          <span>{hasCommitted ? 'Joined' : 'Join Squad'} ({prob.commitments})</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* AI Plan Button */}
                        <button
                          onClick={() => generateAiPlan(prob)}
                          disabled={loadingAiId === prob.id}
                          className="px-3 py-2 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 text-[#09251B] border border-amber-300/80 transition-all duration-150 text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                          title="Generate Gemini AI Action Plan for this problem"
                        >
                          {loadingAiId === prob.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0D4734]" />
                          ) : (
                            <Bot className="w-3.5 h-3.5 text-[#0D4734]" />
                          )}
                          <span className="hidden sm:inline">AI Roadmap</span>
                        </button>

                        {/* View Details & Discussion */}
                        <button
                          onClick={() => {
                            setActiveProblem(prob);
                            setActiveTabDetail('discussion');
                          }}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-[#F4EFE6] text-[#09251B] border border-[#09251B]/25 transition-all duration-150 text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-[#0D4734]" />
                          <span>{prob.comments.length}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Seamless Interactive Problem & Categorization Wizard */}
      <SeamlessProblemWizard
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        onSubmit={onAddProblem}
        currentProfile={currentProfile || null}
        categories={categoriesList}
      />

      {/* Modal: Commit / Join Squad Pledge */}
      {isCommitModalOpen && targetProblemForCommit && (
        <div className="fixed inset-0 bg-[#08291E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-[#09251B] rounded-3xl w-full max-w-md p-6 sm:p-8 relative shadow-[10px_10px_0px_0px_#09251B]">
            <button
              onClick={() => setIsCommitModalOpen(false)}
              className="absolute right-5 top-5 text-[#09251B]/60 hover:text-[#09251B] cursor-pointer"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </button>

            <div className="flex items-center gap-2 text-[#0D4734] font-display font-black text-xs uppercase mb-1">
              <Users className="w-4 h-4 text-[#E5A93C]" /> FOUNDER COMMITMENT PLEDGE
            </div>

            <h2 className="font-display font-black text-2xl text-[#09251B] mb-2">
              Join Collaboration Squad
            </h2>

            <p className="text-xs text-[#09251B]/70 font-medium mb-4 leading-relaxed">
              Pledging your commitment signals to other Jos founders that you are willing to spend weekend hack time, offer mentorship, or lend hardware to solve: <strong className="text-[#0D4734]">{targetProblemForCommit.title}</strong> under <span className="text-[#BF7E1D] font-black">[{targetProblemForCommit.category}]</span>.
            </p>

            <form onSubmit={handleConfirmCommit} className="space-y-4">
              <div>
                <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wider mb-1">
                  YOUR NAME / HANDLE
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Solomon P. (Frontend Lead)"
                  value={commitName}
                  onChange={(e) => setCommitName(e.target.value)}
                  className="w-full bg-[#FAF8F4] border-2 border-[#09251B] rounded-xl p-3 text-sm font-semibold text-[#09251B] focus:outline-none focus:ring-2 focus:ring-[#0D4734]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCommitModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#09251B]/20 text-xs font-bold text-[#09251B] hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] text-[#09251B] border border-amber-600 shadow-sm hover:shadow font-display font-black text-xs tracking-wide transition active:scale-95 cursor-pointer"
                >
                  Confirm Squad Pledge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Problem Detail & Discussion & Gemini AI Plan */}
      {activeProblem && (
        <div className="fixed inset-0 bg-[#08291E]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-3 border-[#09251B] rounded-3xl w-full max-w-3xl p-6 sm:p-8 relative shadow-xl my-8">
            <button
              onClick={() => setActiveProblem(null)}
              className="absolute right-5 top-5 text-[#09251B]/60 hover:text-[#09251B] p-1 rounded-lg cursor-pointer transition hover:bg-[#FAF8F4]"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>

            {/* Problem Title Header */}
            <div className="mb-6 border-b border-[#09251B]/15 pb-5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-display font-black text-[#0D4734] bg-[#EBF3EF] border border-[#0D4734]/30 px-3 py-1 rounded-full uppercase flex items-center gap-1.5">
                  {renderCategoryIcon(activeProblem.category, "w-3.5 h-3.5")}
                  <span>{activeProblem.category}</span>
                </span>
              </div>
              
              <h2 className="font-display font-black text-2xl sm:text-3xl text-[#09251B] mt-3 mb-2.5">
                {activeProblem.title}
              </h2>
              <p className="text-sm text-[#09251B]/80 font-medium leading-relaxed">
                {activeProblem.description}
              </p>
            </div>

            {/* Tabs for Detail View */}
            <div className="flex items-center gap-1.5 p-1 bg-[#F4EFE6] border border-[#09251B]/15 rounded-2xl mb-6 overflow-x-auto">
              <button
                onClick={() => setActiveTabDetail('discussion')}
                className={`py-2 px-3.5 font-display font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 select-none ${
                  activeTabDetail === 'discussion'
                    ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm'
                    : 'text-[#09251B]/70 hover:text-[#09251B] hover:bg-white/60'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Discussion ({activeProblem.comments.length})</span>
              </button>

              <button
                onClick={() => setActiveTabDetail('collaborators')}
                className={`py-2 px-3.5 font-display font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 select-none ${
                  activeTabDetail === 'collaborators'
                    ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm'
                    : 'text-[#09251B]/70 hover:text-[#09251B] hover:bg-white/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Squad Members ({activeProblem.collaborators.length})</span>
              </button>

              <button
                onClick={() => generateAiPlan(activeProblem)}
                className={`py-2 px-3.5 font-display font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 select-none ${
                  activeTabDetail === 'aiPlan'
                    ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm'
                    : 'text-[#09251B]/70 hover:text-[#09251B] hover:bg-white/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#E5A93C]" />
                <span>Gemini AI Strategy</span>
              </button>
            </div>

            {/* TAB CONTENT: DISCUSSION */}
            {activeTabDetail === 'discussion' && (
              <div>
                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
                  {activeProblem.comments.length === 0 ? (
                    <p className="text-xs text-[#09251B]/50 italic text-center py-6 font-medium">
                      No comments yet. Share an idea or local context to kick off the thread!
                    </p>
                  ) : (
                    activeProblem.comments.map((c) => (
                      <div key={c.id} className="bg-[#FAF8F4] border border-[#09251B]/15 rounded-2xl p-3.5 text-xs">
                        <div className="flex items-center justify-between text-[#0D4734] font-display font-black mb-1">
                          <span>{c.author}</span>
                          <span className="text-[10px] text-[#09251B]/40 font-mono">{c.date}</span>
                        </div>
                        <p className="text-[#09251B] font-medium leading-relaxed">{c.text}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendComment} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Your Name (e.g. Pam)"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    className="w-full sm:w-1/3 bg-[#FAF8F4] border border-[#09251B]/20 rounded-xl px-3 py-2 text-xs font-semibold text-[#09251B] focus:outline-none focus:ring-2 focus:ring-[#0D4734]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Add your local insight or solution idea..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 bg-[#FAF8F4] border border-[#09251B]/20 rounded-xl px-3 py-2 text-xs font-semibold text-[#09251B] focus:outline-none focus:ring-2 focus:ring-[#0D4734]"
                  />
                  <button
                    type="submit"
                    className="bg-[#0D4734] hover:bg-[#125B43] text-[#FAF6EE] font-display font-black text-xs px-4 py-2 rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                  >
                    <Send className="w-3.5 h-3.5 text-[#E5A93C]" />
                    <span>Post</span>
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: COLLABORATORS */}
            {activeTabDetail === 'collaborators' && (
              <div>
                <p className="text-xs text-[#09251B]/70 font-semibold mb-4">
                  These founders and experts in Jos have pledged to collaborate on building a solution:
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {activeProblem.collaborators.map((collab, i) => (
                    <div key={i} className="bg-[#FAF8F4] border-2 border-[#09251B]/20 rounded-2xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#E5A93C] border-2 border-[#09251B] text-[#09251B] font-display font-black flex items-center justify-center text-sm shadow-[2px_2px_0px_0px_#09251B]">
                        {collab.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-display font-black text-sm text-[#09251B]">{collab}</div>
                        <div className="text-[10px] font-bold text-[#0D4734]">Active Squad Member</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-center pt-3 border-t border-[#09251B]/15">
                  <button
                    onClick={() => {
                      setTargetProblemForCommit(activeProblem);
                      setIsCommitModalOpen(true);
                    }}
                    className="bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] hover:from-[#E5A93C] hover:to-[#D97706] text-[#09251B] border border-amber-600 shadow-sm hover:shadow-md font-display font-black text-xs px-6 py-2.5 rounded-xl cursor-pointer transition active:scale-95 flex items-center gap-1.5 mx-auto"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Join This Squad Now</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: GEMINI AI PLAN */}
            {activeTabDetail === 'aiPlan' && (
              <div className="space-y-4">
                {loadingAiId === activeProblem.id ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-10 h-10 animate-spin text-[#0D4734] mx-auto mb-3" />
                    <p className="font-display font-black text-[#09251B] text-lg">Generating Action Roadmap with Gemini AI...</p>
                    <p className="text-xs text-[#09251B]/60 mt-1 font-medium">Analyzing Jos market, local partners, and tech stack options</p>
                  </div>
                ) : aiError ? (
                  <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 text-xs text-rose-900 font-medium">
                    <p className="font-black text-rose-700 mb-1">AI Plan Generation Notice:</p>
                    <p>{aiError}</p>
                    <p className="mt-2 text-[11px] text-rose-700 font-mono">
                      Ensure <code className="bg-rose-100 px-1 rounded">GEMINI_API_KEY</code> is configured in AI Studio Secrets to unlock automated roadmap synthesis.
                    </p>
                  </div>
                ) : aiPlanMap[activeProblem.id] ? (
                  <div className="space-y-4 text-xs">
                    {/* Executive Summary */}
                    <div className="bg-[#EBF3EF] border-2 border-[#0D4734]/40 rounded-2xl p-4">
                      <div className="font-display font-black text-[#0D4734] tracking-wider text-xs uppercase mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#E5A93C]" /> EXECUTIVE OPPORTUNITY SUMMARY
                      </div>
                      <p className="text-[#09251B] font-medium leading-relaxed font-sans text-sm">
                        {aiPlanMap[activeProblem.id].summary}
                      </p>
                    </div>

                    {/* 4 Sprint Milestones */}
                    <div>
                      <h4 className="font-display font-black text-[#09251B] tracking-wider text-xs uppercase mb-2">
                        4-WEEK SPRINT MILESTONES (FOR JOS HACKERS)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {aiPlanMap[activeProblem.id].sprintRoadmap.map((step, idx) => (
                          <div key={idx} className="bg-[#FAF8F4] border-2 border-[#09251B]/20 rounded-xl p-3 flex gap-2">
                            <span className="font-display font-black text-[#0D4734] text-sm">#{idx + 1}</span>
                            <span className="text-[#09251B] font-medium leading-normal">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Required Tech Stack & Partners */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-[#FAF8F4] border-2 border-[#09251B]/20 rounded-2xl p-4">
                        <h4 className="font-display font-black text-[#09251B] tracking-wider text-[11px] uppercase mb-2">
                          RECOMMENDED TECH STACK
                        </h4>
                        <ul className="space-y-1.5 text-[#09251B]/80 font-medium">
                          {aiPlanMap[activeProblem.id].requiredTechStack.map((tech, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#0D4734]" /> {tech}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-[#FAF8F4] border-2 border-[#09251B]/20 rounded-2xl p-4">
                        <h4 className="font-display font-black text-[#09251B] tracking-wider text-[11px] uppercase mb-2">
                          KEY PLATEAU PARTNERS
                        </h4>
                        <ul className="space-y-1.5 text-[#09251B]/80 font-medium">
                          {aiPlanMap[activeProblem.id].keyPlateauPartners.map((partner, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <ArrowUpRight className="w-3.5 h-3.5 text-[#0D4734]" /> {partner}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Growth Hack Tip */}
                    <div className="bg-[#FEF7EB] border-2 border-[#E5A93C] rounded-2xl p-4">
                      <div className="font-display font-black text-[#BF7E1D] tracking-wider text-[11px] uppercase mb-1">
                        LOCAL JOS FOUNDER ADVANTAGE
                      </div>
                      <p className="text-[#09251B] text-xs italic font-semibold">
                        "{aiPlanMap[activeProblem.id].growthHackTip}"
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
