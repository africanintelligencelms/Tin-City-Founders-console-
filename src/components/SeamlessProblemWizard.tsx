import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Sparkles, 
  Building2, 
  ShieldAlert, 
  Layers, 
  Sprout, 
  GraduationCap, 
  ShoppingBag, 
  Zap, 
  ThumbsUp, 
  Users, 
  MapPin, 
  Plus, 
  Lightbulb, 
  CheckCircle2, 
  Tag, 
  Wand2, 
  Rocket, 
  Loader2 
} from 'lucide-react';
import { AttendeeProfile, CategoryInfo } from '../types';

interface SeamlessProblemWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (problemData: {
    title: string;
    description: string;
    category: string;
    submittedBy: string;
    skillsNeeded: string[];
    autoUpvote?: boolean;
    autoCommit?: boolean;
  }) => Promise<void>;
  currentProfile: AttendeeProfile | null;
  categories: CategoryInfo[];
}

// Popular predefined Plateau categories with metadata
const SECTOR_OPTIONS = [
  {
    name: 'Infrastructure',
    icon: Building2,
    color: '#0D4734',
    accent: '#E5A93C',
    tagline: 'Power grids, fiber mesh, transit & physical hubs in Jos',
    template: {
      title: 'Solar & Starlink Failover Mesh for Rayfield Tech Hubs',
      desc: 'Frequent grid drops slow engineering velocity. Build a shared solar micro-battery grid with Starlink backup for 10 tech nodes.'
    }
  },
  {
    name: 'Agro-Tech & Cold Chain',
    icon: Sprout,
    color: '#0D4734',
    accent: '#E5A93C',
    tagline: 'Solar cold storage, farmer logistics & crop telemetry in Bokkos/Vom',
    template: {
      title: 'Solar Cold Storage Hubs for Bokkos Potato & Tomato Farmers',
      desc: 'Over 40% harvest loss occurs before reaching markets. Deploy off-grid IoT temperature containers with SMS logistics matching.'
    }
  },
  {
    name: 'Safety',
    icon: ShieldAlert,
    color: '#0D4734',
    accent: '#E5A93C',
    tagline: 'Community alerts, neighborhood networks & rapid dispatch',
    template: {
      title: 'Plateau Community Verified Emergency & Alert Network',
      desc: 'Enable neighborhood vigilante and community leads to share geo-verified alerts, road safety reports, and dispatch medical aid fast.'
    }
  },
  {
    name: 'Tech Talent & Education',
    icon: GraduationCap,
    color: '#0D4734',
    accent: '#E5A93C',
    tagline: 'University incubators (Unijos/PLASU), developer apprenticeships',
    template: {
      title: 'Unijos & PLASU Graduate Software Apprenticeship Lab',
      desc: 'Bridge the campus-to-industry gap by matching top CS finalists with local startups for 12 weeks of live production shipping.'
    }
  },
  {
    name: 'Commerce & Export',
    icon: ShoppingBag,
    color: '#0D4734',
    accent: '#E5A93C',
    tagline: 'Gemstone export escrow, lapidary markets & cross-border trade',
    template: {
      title: 'Digital Escrow & Provenance Passport for Jos Gemstone Artisans',
      desc: 'Connect local tourmaline and sapphire lapidaries directly with global buyers using digital escrow and verified origin certificates.'
    }
  },
  {
    name: 'Services',
    icon: Layers,
    color: '#0D4734',
    accent: '#E5A93C',
    tagline: 'Civic utilities, healthcare delivery, waste tracking & local SME tools',
    template: {
      title: 'Digital Health Supply & Clinic Booking for Plateau Suburbs',
      desc: 'Allow rural clinics in Jos South and Barkin Ladi to order essential medication from central Jos distributors with 3-hour dispatch.'
    }
  },
  {
    name: 'Energy & Power',
    icon: Zap,
    color: '#0D4734',
    accent: '#E5A93C',
    tagline: 'Clean solar microgrids, battery swap stations & inverter diagnostics',
    template: {
      title: 'Pay-As-You-Go Solar Micro-Grid for Anglo Jos Commercial Workshops',
      desc: 'Provide shared solar battery inverter banks for welding and carpentry clusters to operate continuously despite public power outages.'
    }
  }
];

// Popular 1-tap skill badges for Jos builders
const POPULAR_SKILLS = [
  'IoT & Firmware',
  'Solar / Electrical Eng',
  'Full-Stack Web Dev',
  'Mobile App (React Native/Flutter)',
  'Agro Logistics',
  'Fintech / Payment APIs',
  'UI/UX Design',
  'DevOps & Mesh Networking',
  'Legal & Compliance',
  'Growth & Distribution',
  'Community Organizing',
  'Data Analytics / AI'
];

// Plateau location tags to quickly append
const JOS_LOCATIONS = [
  'Jos South (Vom/Bukuru)',
  'Rayfield',
  'Anglo Jos',
  'Jos North / Central',
  'Bokkos / Mangu',
  'Unijos Campus',
  'Lamingo / Tudun Wada'
];

export const SeamlessProblemWizard: React.FC<SeamlessProblemWizardProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentProfile,
  categories
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [category, setCategory] = useState<string>('Agro-Tech & Cold Chain');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [author, setAuthor] = useState<string>('');
  const [authorLocation, setAuthorLocation] = useState<string>('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['Full-Stack Web Dev', 'IoT & Firmware']);
  const [customSkillInput, setCustomSkillInput] = useState<string>('');
  const [autoUpvote, setAutoUpvote] = useState<boolean>(true);
  const [autoCommit, setAutoCommit] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasLaunchedSuccess, setHasLaunchedSuccess] = useState<boolean>(false);

  // Initialize author from profile
  useEffect(() => {
    if (currentProfile) {
      setAuthor(currentProfile.name);
      if (currentProfile.location) {
        setAuthorLocation(currentProfile.location);
      }
    }
  }, [currentProfile]);

  if (!isOpen) return null;

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleAddCustomSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    if (!customSkillInput.trim()) return;
    const skill = customSkillInput.trim();
    if (!selectedSkills.includes(skill)) {
      setSelectedSkills(prev => [...prev, skill]);
    }
    setCustomSkillInput('');
  };

  const applyTemplate = (tmpl: { title: string; desc: string }) => {
    setTitle(tmpl.title);
    setDescription(tmpl.desc);
    setCurrentStep(2);
  };

  const handleFinalSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setCurrentStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      const fullAuthorName = author.trim() 
        ? `${author.trim()}${authorLocation ? ` (${authorLocation})` : ''}`
        : (currentProfile ? `${currentProfile.name}${currentProfile.location ? ` (${currentProfile.location})` : ''}` : 'Jos Founder');

      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        submittedBy: fullAuthorName,
        skillsNeeded: selectedSkills.length > 0 ? selectedSkills : ['Developers', 'Domain Experts'],
        autoUpvote,
        autoCommit
      });

      setHasLaunchedSuccess(true);
      setTimeout(() => {
        setHasLaunchedSuccess(false);
        onClose();
        // Reset wizard state
        setCurrentStep(1);
        setTitle('');
        setDescription('');
      }, 1400);
    } catch (err) {
      console.error('Wizard submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSectorObj = SECTOR_OPTIONS.find(s => s.name === category) || SECTOR_OPTIONS[0];
  const IconComponent = selectedSectorObj.icon;

  return (
    <div className="fixed inset-0 bg-[#08291E]/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#FAF8F4] border-4 border-[#09251B] rounded-3xl w-full max-w-2xl relative shadow-[12px_12px_0px_0px_#09251B] my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="bg-[#0D4734] border-b-3 border-[#09251B] px-6 py-4 text-[#FAF6EE] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E5A93C] border-2 border-[#09251B] text-[#09251B] font-display font-black flex items-center justify-center text-sm shadow-[2px_2px_0px_0px_#09251B]">
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-display font-black text-lg sm:text-xl tracking-wide uppercase leading-tight text-white">
                Submit & Categorize Challenge
              </h2>
              <p className="text-[11px] text-[#FAF6EE]/80 font-medium font-mono">
                Plateau Problem Engine · Step {currentStep} of 4
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#FAF6EE]/70 hover:text-[#FAF6EE] p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5 stroke-[3]" />
          </button>
        </div>

        {/* Step Progression Visualizer */}
        <div className="bg-[#EBF3EF] border-b-2 border-[#09251B]/15 px-6 py-2.5 flex items-center justify-between text-xs font-display font-black">
          {[
            { num: 1, label: '1. Sector' },
            { num: 2, label: '2. Challenge' },
            { num: 3, label: '3. Skills' },
            { num: 4, label: '4. Preview & Vote' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => {
                if (s.num <= currentStep || (title && description)) {
                  setCurrentStep(s.num as any);
                }
              }}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg transition cursor-pointer ${
                currentStep === s.num
                  ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm'
                  : currentStep > s.num
                  ? 'text-[#0D4734] hover:bg-[#0D4734]/10'
                  : 'text-[#09251B]/40'
              }`}
            >
              {currentStep > s.num ? (
                <Check className="w-3.5 h-3.5 stroke-[3] text-[#E5A93C]" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-[#09251B]/10 text-[10px] flex items-center justify-center">
                  {s.num}
                </span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Wizard Step Body */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto max-h-[70vh]">
          
          {/* SUCCESS SCREEN */}
          {hasLaunchedSuccess ? (
            <div className="py-12 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 mx-auto bg-[#E5A93C] border-4 border-[#09251B] text-[#09251B] rounded-full flex items-center justify-center shadow-[6px_6px_0px_0px_#09251B] mb-6 animate-bounce">
                <Rocket className="w-10 h-10 stroke-[2.5]" />
              </div>
              <h3 className="font-display font-black text-3xl text-[#09251B] mb-2">
                Challenge Published & Voted!
              </h3>
              <p className="text-sm font-semibold text-[#0D4734] max-w-md mx-auto">
                Your problem statement is now live in the <strong>{category}</strong> sector for all Jos founders to upvote, comment, and pledge to solve.
              </p>
            </div>
          ) : (
            <>
              {/* STEP 1: PICK SECTOR CATEGORY (Visual & Interactive) */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-display font-black uppercase text-[#0D4734] bg-[#EBF3EF] border border-[#0D4734]/30 px-2.5 py-0.5 rounded-full">
                        Step 1: Choose Sector
                      </span>
                      <h3 className="font-display font-black text-2xl text-[#09251B] mt-1.5">
                        Which Plateau Sector Needs This?
                      </h3>
                      <p className="text-xs text-[#09251B]/70 font-medium">
                        Categorizing unlocks focused voting pools and links your challenge directly to domain mentors in Jos.
                      </p>
                    </div>
                  </div>

                  {/* Visual Sector Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {SECTOR_OPTIONS.map((sec) => {
                      const isSelected = category === sec.name;
                      const Icon = sec.icon;
                      const catData = categories.find(c => c.name === sec.name);
                      const voteCount = catData ? catData.upvotes : 25;

                      return (
                        <div
                          key={sec.name}
                          onClick={() => setCategory(sec.name)}
                          className={`p-4 rounded-2xl border-3 cursor-pointer transition-all flex flex-col justify-between text-left relative group ${
                            isSelected
                              ? 'bg-white border-[#09251B] shadow-[5px_5px_0px_0px_#0D4734] ring-2 ring-[#0D4734]'
                              : 'bg-white/80 border-[#09251B]/40 hover:border-[#09251B] hover:bg-white hover:shadow-[3px_3px_0px_0px_#09251B]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className={`p-2 rounded-xl border-2 border-[#09251B] ${
                                isSelected ? 'bg-[#0D4734] text-[#E5A93C]' : 'bg-[#FAF8F4] text-[#09251B]'
                              }`}>
                                <Icon className="w-5 h-5 stroke-[2.5]" />
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold text-[#0D4734] bg-[#EBF3EF] px-2 py-0.5 rounded-full border border-[#0D4734]/20">
                                  {voteCount} votes
                                </span>
                                {isSelected && (
                                  <span className="w-5 h-5 rounded-full bg-[#E5A93C] border border-[#09251B] flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 stroke-[3] text-[#09251B]" />
                                  </span>
                                )}
                              </div>
                            </div>

                            <h4 className="font-display font-black text-base text-[#09251B] mb-1">
                              {sec.name}
                            </h4>
                            <p className="text-xs text-[#09251B]/70 font-medium leading-snug mb-3">
                              {sec.tagline}
                            </p>
                          </div>

                          {/* Quick Template Pill */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategory(sec.name);
                              applyTemplate(sec.template);
                            }}
                            className="mt-1 text-[11px] font-bold text-[#0D4734] hover:text-[#09251B] bg-[#FAF8F4] hover:bg-[#E5A93C]/30 border border-[#09251B]/30 rounded-lg py-1 px-2 flex items-center justify-between transition cursor-pointer text-left"
                          >
                            <span className="truncate flex items-center gap-1">
                              <Wand2 className="w-3 h-3 text-[#E5A93C]" /> Use Quick Theme: "{sec.template.title.slice(0, 24)}..."
                            </span>
                            <ArrowRight className="w-3 h-3 flex-none" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: PROBLEM STATEMENT & IMPACT */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-display font-black uppercase text-[#0D4734] bg-[#EBF3EF] border border-[#0D4734]/30 px-2.5 py-0.5 rounded-full">
                        Step 2: Define Challenge
                      </span>
                      <span className="text-[11px] font-bold text-[#09251B] bg-[#E5A93C] border border-[#09251B] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <IconComponent className="w-3 h-3" /> {category}
                      </span>
                    </div>
                    <h3 className="font-display font-black text-2xl text-[#09251B]">
                      What's the Bottleneck & Opportunity?
                    </h3>
                    <p className="text-xs text-[#09251B]/70 font-medium">
                      Keep it crisp so founders immediately understand who is affected in Jos and what can be engineered.
                    </p>
                  </div>

                  {/* Title Input */}
                  <div>
                    <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wider mb-1.5">
                      Challenge Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Solar Cold-Storage for Bokkos Potato Farmers"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-white border-3 border-[#09251B] rounded-2xl p-3.5 text-sm sm:text-base font-bold text-[#09251B] placeholder-[#09251B]/35 focus:outline-none focus:ring-3 focus:ring-[#0D4734] shadow-[3px_3px_0px_0px_#09251B]"
                    />
                  </div>

                  {/* Detailed Description */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wider">
                        Problem & Potential Solution *
                      </label>
                      <span className="text-[11px] text-[#09251B]/60 font-medium">
                        {description.length} chars
                      </span>
                    </div>
                    <textarea
                      required
                      rows={4}
                      placeholder="Describe: (1) The bottleneck in Plateau State, (2) Who suffers the loss, (3) What tech or business model founders could deploy..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-white border-3 border-[#09251B] rounded-2xl p-3.5 text-sm font-semibold text-[#09251B] placeholder-[#09251B]/35 focus:outline-none focus:ring-3 focus:ring-[#0D4734] shadow-[3px_3px_0px_0px_#09251B]"
                    />
                  </div>

                  {/* Author / Location Quick Tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div>
                      <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wider mb-1">
                        Your Name / Handle
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Pam Dung"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        className="w-full bg-white border-2 border-[#09251B] rounded-xl p-2.5 text-xs font-bold text-[#09251B] focus:outline-none focus:ring-2 focus:ring-[#0D4734]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wider mb-1">
                        Plateau Area / Hub
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rayfield, Jos South, Bokkos"
                        value={authorLocation}
                        onChange={(e) => setAuthorLocation(e.target.value)}
                        className="w-full bg-white border-2 border-[#09251B] rounded-xl p-2.5 text-xs font-bold text-[#09251B] focus:outline-none focus:ring-2 focus:ring-[#0D4734]"
                      />
                    </div>
                  </div>

                  {/* Fast Location Chips */}
                  <div>
                    <span className="text-[10px] font-display font-black text-[#09251B]/60 uppercase tracking-wider block mb-1.5">
                      Quick Location Pins:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {JOS_LOCATIONS.map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setAuthorLocation(loc)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            authorLocation === loc
                              ? 'bg-[#0D4734] text-[#FAF6EE] border-[#09251B]'
                              : 'bg-white text-[#09251B] border-[#09251B]/30 hover:border-[#09251B]'
                          }`}
                        >
                          <MapPin className="w-3 h-3 inline mr-1 text-[#E5A93C]" />
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: SKILLS NEEDED (Interactive Pill Cloud) */}
              {currentStep === 3 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div>
                    <span className="text-[11px] font-display font-black uppercase text-[#0D4734] bg-[#EBF3EF] border border-[#0D4734]/30 px-2.5 py-0.5 rounded-full">
                      Step 3: Squad Recruitment
                    </span>
                    <h3 className="font-display font-black text-2xl text-[#09251B] mt-1.5">
                      What Skills Are Needed to Solve This?
                    </h3>
                    <p className="text-xs text-[#09251B]/70 font-medium">
                      Select 2–4 skills to help matching developers, engineers, and marketers in tonight's room.
                    </p>
                  </div>

                  {/* Selected Skills Badges */}
                  <div className="bg-white border-3 border-[#09251B] rounded-2xl p-4 shadow-[3px_3px_0px_0px_#09251B]">
                    <span className="text-[11px] font-display font-black uppercase text-[#09251B] block mb-2">
                      Active Squad Tags ({selectedSkills.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedSkills.length === 0 ? (
                        <span className="text-xs text-[#09251B]/40 italic">
                          Tap any skill below to add to your challenge card...
                        </span>
                      ) : (
                        selectedSkills.map((sk) => (
                          <span
                            key={sk}
                            className="bg-[#0D4734] text-[#FAF6EE] font-display font-black text-xs px-3 py-1.5 rounded-xl border border-[#09251B] flex items-center gap-1.5 shadow-sm"
                          >
                            <span>{sk}</span>
                            <button
                              type="button"
                              onClick={() => toggleSkill(sk)}
                              className="hover:text-[#E5A93C] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 1-Tap Popular Skills Cloud */}
                  <div>
                    <span className="text-xs font-display font-black text-[#09251B] uppercase tracking-wider block mb-2">
                      Tap to Add / Remove:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_SKILLS.map((sk) => {
                        const isChosen = selectedSkills.includes(sk);
                        return (
                          <button
                            key={sk}
                            type="button"
                            onClick={() => toggleSkill(sk)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-2 ${
                              isChosen
                                ? 'bg-[#E5A93C] text-[#09251B] border-[#09251B] shadow-[2px_2px_0px_0px_#09251B] font-black'
                                : 'bg-white text-[#09251B] border-[#09251B]/30 hover:border-[#09251B] hover:bg-[#FAF8F4]'
                            }`}
                          >
                            {isChosen ? (
                              <Check className="w-3.5 h-3.5 stroke-[3] text-[#09251B]" />
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-[#0D4734]" />
                            )}
                            <span>{sk}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Skill Input */}
                  <div className="pt-2">
                    <label className="block text-xs font-display font-black text-[#09251B] uppercase tracking-wider mb-1">
                      Add Custom Skill or Hardware:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Drone Surveying, 3D Printing, Python FastApi"
                        value={customSkillInput}
                        onChange={(e) => setCustomSkillInput(e.target.value)}
                        onKeyDown={handleAddCustomSkill}
                        className="flex-1 bg-white border-2 border-[#09251B] rounded-xl px-3 py-2 text-xs font-bold text-[#09251B] focus:outline-none focus:ring-2 focus:ring-[#0D4734]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSkill}
                        className="bg-[#0D4734] text-[#FAF6EE] font-display font-black text-xs px-4 py-2 rounded-xl border-2 border-[#09251B] shadow-[2px_2px_0px_0px_#09251B] hover:bg-[#125B43] cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: REAL-TIME CARD PREVIEW & SEAMLESS VOTE LAUNCH */}
              {currentStep === 4 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div>
                    <span className="text-[11px] font-display font-black uppercase text-[#0D4734] bg-[#EBF3EF] border border-[#0D4734]/30 px-2.5 py-0.5 rounded-full">
                      Step 4: Final Preview
                    </span>
                    <h3 className="font-display font-black text-2xl text-[#09251B] mt-1.5">
                      Ready to Publish & Vote!
                    </h3>
                    <p className="text-xs text-[#09251B]/70 font-medium">
                      Here is how your problem card will appear live in the Tin City Founders room.
                    </p>
                  </div>

                  {/* LIVE PROBLEM CARD PREVIEW */}
                  <div className="bg-white border-4 border-[#09251B] rounded-3xl p-6 shadow-[8px_8px_0px_0px_#09251B] relative overflow-hidden">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-display font-black text-[#0D4734] bg-[#EBF3EF] border border-[#0D4734]/30 px-3 py-1 rounded-full uppercase flex items-center gap-1.5">
                        <IconComponent className="w-3.5 h-3.5 text-[#E5A93C]" />
                        <span>{category}</span>
                      </span>

                      <span className="text-[11px] font-bold font-mono text-[#09251B]/60 bg-[#FAF8F4] px-2.5 py-0.5 rounded-full border border-[#09251B]/20">
                        Just Now
                      </span>
                    </div>

                    <h4 className="font-display font-black text-xl text-[#09251B] mb-2 leading-tight">
                      {title || 'Untitled Plateau Problem'}
                    </h4>

                    <p className="text-xs text-[#09251B]/80 font-medium leading-relaxed mb-4">
                      {description || 'No description provided yet.'}
                    </p>

                    {/* Skills pills */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {selectedSkills.map((sk, i) => (
                        <span key={i} className="text-[10px] font-bold bg-[#FAF8F4] text-[#09251B] border border-[#09251B]/30 px-2.5 py-1 rounded-lg">
                          {sk}
                        </span>
                      ))}
                    </div>

                    {/* Author & Stats bar */}
                    <div className="pt-3 border-t-2 border-[#09251B]/10 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#E5A93C] border border-[#09251B] text-[#09251B] font-display font-black flex items-center justify-center text-xs">
                          {(author || 'J').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-[#09251B]">
                          By {author || 'Jos Founder'} {authorLocation ? `(${authorLocation})` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-display font-black text-xs text-[#0D4734] bg-[#EBF3EF] px-2.5 py-1 rounded-lg border border-[#0D4734]/30">
                          {autoUpvote ? '1 Opening Vote' : '0 Votes'}
                        </span>
                        {autoCommit && (
                          <span className="font-display font-black text-xs text-[#09251B] bg-[#E5A93C] px-2.5 py-1 rounded-lg border border-[#09251B]">
                            1 Squad Lead
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Instant Voting Options */}
                  <div className="bg-[#FEF7EB] border-2 border-[#09251B] rounded-2xl p-4 space-y-3">
                    <span className="text-xs font-display font-black text-[#09251B] uppercase tracking-wider block">
                      Automated Room Actions:
                    </span>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoUpvote}
                        onChange={(e) => setAutoUpvote(e.target.checked)}
                        className="w-4 h-4 text-[#0D4734] rounded border-2 border-[#09251B] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#09251B]">
                        Automatically cast my opening upvote on this challenge
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCommit}
                        onChange={(e) => setAutoCommit(e.target.checked)}
                        className="w-4 h-4 text-[#0D4734] rounded border-2 border-[#09251B] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#09251B]">
                        Pledge myself as first squad collaborator / builder
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Navigation & Action Footer */}
        {!hasLaunchedSuccess && (
          <div className="bg-white border-t border-[#09251B]/15 px-6 py-3.5 flex items-center justify-between gap-3">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 rounded-xl border border-[#09251B]/20 text-[#09251B] hover:bg-[#FAF8F4] text-xs font-display font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#09251B]/20 text-[#09251B]/70 hover:text-[#09251B] hover:bg-[#FAF8F4] text-xs font-display font-bold cursor-pointer transition"
              >
                Cancel
              </button>
            )}

            <div className="flex items-center gap-3">
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 2 && (!title.trim() || !description.trim())) {
                      alert('Please provide both a title and description before continuing.');
                      return;
                    }
                    setCurrentStep((prev) => (prev + 1) as any);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#E5A93C] to-[#D97706] hover:from-[#E5A93C] hover:to-[#B45309] text-[#09251B] font-display font-black text-xs tracking-wide border border-amber-600 shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting || !title.trim() || !description.trim()}
                  onClick={handleFinalSubmit}
                  className="px-6 py-2.5 rounded-xl bg-[#0D4734] hover:bg-[#125B43] text-[#FAF6EE] font-display font-black text-xs sm:text-sm tracking-wide border border-[#0D4734] shadow-sm hover:shadow-md flex items-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#E5A93C]" />
                  ) : (
                    <Rocket className="w-4 h-4 text-[#E5A93C]" />
                  )}
                  <span>Launch & Vote Challenge</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
