import { TrusteeSeatDefinition, TrusteeCandidate } from '../types';

export const TRUSTEE_SEATS: TrusteeSeatDefinition[] = [
  // CORE (Seats 1-4)
  {
    seatNumber: 1,
    tier: 'CORE',
    title: 'Convener / Community Steward',
    roleDescription: 'Primary custodian of association vision, constitution execution, and community cohesion.',
    recommendedArchetype: 'Active founder or community builder with high moral authority and daily commitment.'
  },
  {
    seatNumber: 2,
    tier: 'CORE',
    title: 'Growth & Outreach lead',
    roleDescription: 'Drives founder onboarding, cross-hub partnerships, and expansion across Jos & Plateau LGAs.',
    recommendedArchetype: 'Ecosystem connector, energetic networker, founder relations lead.'
  },
  {
    seatNumber: 3,
    tier: 'CORE',
    title: 'Marketing & Content lead',
    roleDescription: 'Amplifies Plateau startup narratives, media visibility, newsletters, and investor awareness.',
    recommendedArchetype: 'Tech journalist, creative director, growth marketer, or media founder.'
  },
  {
    seatNumber: 4,
    tier: 'CORE',
    title: 'Ops & Programming lead',
    roleDescription: 'Maintains operational cadence, demo days, hackathons, and legal documentation compliance.',
    recommendedArchetype: 'Operations executive, project manager, or experienced tech event organizer.'
  },

  // CREDIBILITY (Seats 5-8)
  {
    seatNumber: 5,
    tier: 'CREDIBILITY',
    title: 'Established Jos entrepreneur / business figure',
    roleDescription: 'Brings private sector track record, corporate governance, and local capital access.',
    recommendedArchetype: 'Established Plateau business leader with 10+ years commercial experience in Jos.'
  },
  {
    seatNumber: 6,
    tier: 'CREDIBILITY',
    title: 'Founders coach / mentor (e.g. Samuel Adebayo)',
    roleDescription: 'Provides strategic venture guidance, founder mental resilience, and investor readiness.',
    recommendedArchetype: 'Seasoned founder coach, accelerator partner, or venture advisor.'
  },
  {
    seatNumber: 7,
    tier: 'CREDIBILITY',
    title: 'Institutional standing (university / assoc.)',
    roleDescription: 'Anchor connection with University of Jos, PLASU, ITF, GIZ, or government innovation agencies.',
    recommendedArchetype: 'Professor, Dean of CS/Eng, or senior representative from Plateau tertiary/research institutions.'
  },
  {
    seatNumber: 8,
    tier: 'CREDIBILITY',
    title: 'Civic or respected community elder',
    roleDescription: 'Lends moral gravitas, mediation capabilities, and deep institutional respect in Plateau.',
    recommendedArchetype: 'Respected civic leader, traditional titleholder, or non-partisan public figure.'
  },

  // BRIDGES (Seats 9-12)
  {
    seatNumber: 9,
    tier: 'BRIDGES',
    title: 'Non-tech SME owner (mechanic / market / shop)',
    roleDescription: 'Ensures association tech solutions solve real-world informal economy and retail commerce needs.',
    recommendedArchetype: 'Terminus market trader leader, automotive tech entrepreneur, or manufacturing SME owner.'
  },
  {
    seatNumber: 10,
    tier: 'BRIDGES',
    title: 'Woman founder',
    roleDescription: 'Champion for female venture participation, mentorship pipelines, and inclusive tech leadership.',
    recommendedArchetype: 'Female CEO, technical co-founder, or active women-in-tech chapter lead in Jos.'
  },
  {
    seatNumber: 11,
    tier: 'BRIDGES',
    title: 'Younger / student founder',
    roleDescription: 'Represents the heartbeat of next-generation builders, campus hackathons, and student startups.',
    recommendedArchetype: 'Undergrad / recent graduate founder building active prototypes at Unijos or PLASU.'
  },
  {
    seatNumber: 12,
    tier: 'BRIDGES',
    title: "Represents Plateau's ethnic / regional diversity",
    roleDescription: 'Bridges Plateau North, Central, and Southern zones to reflect unity and diverse heritage.',
    recommendedArchetype: 'Founder with strong ties across diverse Plateau communities and regional hubs (Pankshin, Shendam, Bokkos).'
  }
];

export const INITIAL_TRUSTEE_CANDIDATES: TrusteeCandidate[] = [
  {
    id: 'cand-1',
    seatNumber: 1,
    name: 'Nanle Jerry',
    titleOrOrg: 'Tin City Founders Convener & AgriGrid CEO',
    bio: 'Pioneering agricultural tech and developer communities in Jos since 2019. Committed to full CAC legal incorporation.',
    phoneOrContact: '+234 803 123 4567',
    scoreR: 5,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 38,
    nominatedBy: 'Founding Assembly',
    createdAt: Date.now() - 86400000 * 3,
    notes: 'Primary convener signatory for CAC Part F association registration.'
  },
  {
    id: 'cand-2',
    seatNumber: 2,
    name: 'Bitrus Longbap',
    titleOrOrg: 'Ecosystem Lead @ Plateau Tech Grid',
    bio: 'Spearheaded outreach across 6 Plateau universities and connected over 140 engineers to startups.',
    phoneOrContact: '+234 812 987 6543',
    scoreR: 4,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 27,
    nominatedBy: 'Jos Founders Collective',
    createdAt: Date.now() - 86400000 * 2,
    notes: 'Handles partnerships with northern developer networks.'
  },
  {
    id: 'cand-3',
    seatNumber: 3,
    name: 'Keziah Mallo',
    titleOrOrg: 'Founder, J-Town Creative Studio & Tech Narratives',
    bio: 'Brand strategist & documentary producer telling stories of Plateau entrepreneurs and tech innovators.',
    phoneOrContact: '+234 809 333 8899',
    scoreR: 5,
    scoreN: 4,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 31,
    nominatedBy: 'Media & Growth Track',
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: 'cand-4',
    seatNumber: 4,
    name: 'David Choji',
    titleOrOrg: 'VP Operations, Highland Hub & Jos DevCon',
    bio: 'Manages multi-track programming, hackathons, and governance schedules for tech gatherings.',
    phoneOrContact: '+234 805 777 1122',
    scoreR: 5,
    scoreN: 4,
    scoreT: 4,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 24,
    nominatedBy: 'Founding Ops Squad',
    createdAt: Date.now() - 86400000
  },
  {
    id: 'cand-5',
    seatNumber: 5,
    name: 'Chief Dachung Gyang',
    titleOrOrg: 'Chairman, Plateau Enterprise Holdings & Jos Commercial Chamber',
    bio: '30+ years leading manufacturing and agro-processing businesses in Plateau State.',
    phoneOrContact: '+234 802 444 5555',
    scoreR: 4,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 42,
    nominatedBy: 'Chamber of Commerce Alliance',
    createdAt: Date.now() - 86400000 * 4,
    notes: 'Key board sponsor for regional industrial alignment.'
  },
  {
    id: 'cand-6',
    seatNumber: 6,
    name: 'Samuel Adebayo',
    titleOrOrg: 'Founders Coach & Angel Mentor',
    bio: 'Venture mentor advising top African early-stage startups and structuring founder governance pacts.',
    phoneOrContact: '+234 806 888 9900',
    scoreR: 5,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 46,
    nominatedBy: 'Founders Assembly',
    createdAt: Date.now() - 86400000 * 5,
    notes: 'Exemplary R=5, T=5 mentor identified on official template.'
  },
  {
    id: 'cand-7',
    seatNumber: 7,
    name: 'Prof. Victor Datong',
    titleOrOrg: 'Dean of Computing & Applied AI, University of Jos',
    bio: 'Spearheading campus-to-industry tech pipelines and federal research grant collaborations.',
    phoneOrContact: '+234 803 999 1100',
    scoreR: 4,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: false,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 29,
    nominatedBy: 'Academic Working Group',
    createdAt: Date.now() - 86400000
  },
  {
    id: 'cand-8',
    seatNumber: 8,
    name: 'Elder Grace Pam',
    titleOrOrg: 'Plateau Civic Trust & Peace Building Council Trustee',
    bio: 'Highly respected mediator and community elder with 25 years of civic leadership across Plateau communities.',
    phoneOrContact: '+234 802 111 2233',
    scoreR: 5,
    scoreN: 4,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 35,
    nominatedBy: 'Civic Council',
    createdAt: Date.now() - 86400000 * 3
  },
  {
    id: 'cand-9',
    seatNumber: 9,
    name: 'Malam Ibrahim Danladi',
    titleOrOrg: 'President, Terminus Traders & Automotive Spares Union',
    bio: 'Bridge between high-tech platforms and 10,000+ daily physical merchants in Jos main market.',
    phoneOrContact: '+234 808 222 3344',
    scoreR: 4,
    scoreN: 5,
    scoreT: 4,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 28,
    nominatedBy: 'Real-Economy SME Wing',
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: 'cand-10',
    seatNumber: 10,
    name: 'Pamela Dung',
    titleOrOrg: 'Founder & CEO, AgroCold Jos',
    bio: 'Award-winning agri-logistics founder building solar cold-chain storage for Plateau farmers.',
    phoneOrContact: '+234 814 555 6677',
    scoreR: 5,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 39,
    nominatedBy: 'Women Techmakers Jos',
    createdAt: Date.now() - 86400000 * 3
  },
  {
    id: 'cand-11',
    seatNumber: 11,
    name: 'Emmanuel Pwajok',
    titleOrOrg: 'Lead Builder @ Jos Student Devs (Finalist, NITDA Hackathon)',
    bio: 'Final year computer engineering student at PLASU who created offline mesh networking for rural students.',
    phoneOrContact: '+234 816 777 8899',
    scoreR: 4,
    scoreN: 4,
    scoreT: 4,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 33,
    nominatedBy: 'Campus Builders Forum',
    createdAt: Date.now() - 86400000
  },
  {
    id: 'cand-12',
    seatNumber: 12,
    name: 'Luka Goyol',
    titleOrOrg: 'Director, Central Plateau Innovation Hub (Pankshin)',
    bio: 'Connects central and southern Plateau agricultural hubs into the Jos tech ecosystem.',
    phoneOrContact: '+234 807 333 4455',
    scoreR: 5,
    scoreN: 5,
    scoreT: 5,
    reachable: true,
    confirmed: true,
    camaChecks: {
      isOver18: true,
      isSoundMind: true,
      notBankrupt: true,
      noFraudConviction: true
    },
    votes: 36,
    nominatedBy: 'Regional Unity Coalition',
    createdAt: Date.now() - 86400000 * 2
  }
];
