export interface AttendeeProfile {
  id: string;
  name: string;
  title: string;
  tags: string[];
  bio?: string;
  giveAsk?: string;
  location?: string;
  avatarColor?: string;
  checkedInAt?: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  date: string;
}

export interface PlateauProblem {
  id: string;
  title: string;
  description: string;
  category: string;
  submittedBy: string;
  submittedByProfileId?: string;
  upvotes: number;
  commitments: number;
  status: 'Ideation' | 'Squad Forming' | 'Active Squad' | 'Prototype Built';
  collaborators: string[];
  skillsNeeded: string[];
  createdAt: string;
  comments: Comment[];
}

export interface CategoryInfo {
  name: string;
  upvotes: number;
  description: string;
  iconName: string;
  problemCount?: number;
}

export interface AISolutionPlan {
  summary: string;
  sprintRoadmap: string[];
  requiredTechStack: string[];
  keyPlateauPartners: string[];
  growthHackTip: string;
}

export type NavigationTab = 'voting' | 'attendees' | 'speed' | 'prompts' | 'bingo' | 'score' | 'join';

export type ToastType = 'problem_submitted' | 'squad_joined' | 'upvote' | 'info' | 'success';

export interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  sector?: string;
  author?: string;
  timestamp?: number;
  duration?: number;
}

export interface RoomActivityEvent {
  id: string;
  type: 'upvote' | 'squad' | 'checkin' | 'comment' | 'problem';
  author: string;
  detail: string;
  sector?: string;
  timestamp: number;
}

export interface LivePollOption {
  id: string;
  label: string;
  votes: number;
}

export interface LivePoll {
  id: string;
  question: string;
  options: LivePollOption[];
  totalVotes: number;
}

export type TrusteeTier = 'CORE' | 'CREDIBILITY' | 'BRIDGES';

export interface TrusteeSeatDefinition {
  seatNumber: number;
  tier: TrusteeTier;
  title: string;
  roleDescription: string;
  recommendedArchetype: string;
}

export interface TrusteeCandidate {
  id: string;
  seatNumber: number;
  name: string;
  titleOrOrg: string;
  bio?: string;
  phoneOrContact?: string;
  
  // The Test Scores (1 to 5)
  scoreR: number; // Reliable (will they sign/respond on time?)
  scoreN: number; // New Network (a door the others don't open)
  scoreT: number; // Trust under pressure (name on a legal doc)
  
  reachable: boolean;
  confirmed: boolean;
  
  // CAMA 2020 Legal Disqualification Checks
  camaChecks: {
    isOver18: boolean;
    isSoundMind: boolean;
    notBankrupt: boolean;
    noFraudConviction: boolean;
  };
  
  votes: number;
  nominatedBy: string;
  createdAt: number;
  notes?: string;
}

// What this device (identified by the server's tcf_vid cookie) has already voted for
export interface MyVotes {
  voterId?: string;
  problems: string[];
  squads: string[];
  categories: string[];
  trustees: string[];
}

export type RoomPhase =
  | 'welcome'           // Check-In & Attendee Directory
  | 'problem_pitch'     // Pitch Floor & Live Reactions
  | 'voting'            // Upvote Problems & Sector Priorities
  | 'trustee_election'  // 12 Founding Trustees CAMA Election Matrix
  | 'squad_commit'      // Action Squad Formation & WhatsApp Roster
  | 'free_roam';        // Free Roam (Unlocked for all views)

export interface LiveAnnouncement {
  id: string;
  message: string;
  author: string;
  timestamp: number;
}

export interface LiveReactionEvent {
  id: string;
  emoji: string;
  author?: string;
  timestamp: number;
}

export interface RoomSessionState {
  activePhase: RoomPhase;
  phaseTitle?: string;
  announcement?: LiveAnnouncement | null;
  pinnedProblemId?: string;
  allowAudienceNavigation: boolean;
  updatedAt: number;
}

