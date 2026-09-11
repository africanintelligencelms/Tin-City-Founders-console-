import { TrusteeSeatDefinition } from '../types';

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
